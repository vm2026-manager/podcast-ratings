// Pure cluster recommendation logic. It intentionally consumes the same
// catalogue IDs, display-group definitions and similarity-product payload that
// the public catalogue already uses, without importing browser/UI state.

export const POSITIVE_RATING_THRESHOLD = 7;

export function normalizeComparable(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/&/gu, " og ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function normalizeMatchKey(value) {
  return normalizeComparable(value)
    .replace(/[^a-z0-9æøå ]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function interestScoreForRating(rating) {
  const value = Number(rating);
  if (!Number.isFinite(value)) return 0;
  if (value >= 10) return 4;
  if (value >= 9) return 3;
  if (value >= 8) return 2;
  if (value >= 7) return 1;
  if (value >= 6) return 0;
  if (value >= 5) return -1;
  return -2;
}

function podcastId(podcast) {
  return String(podcast?.["Podcast-ID"] ?? podcast?.podcastId ?? podcast?.id ?? "").trim();
}

function title(podcast) {
  return String(podcast?.Titel ?? podcast?.title ?? "").trim();
}

function mainSeries(podcast) {
  return String(podcast?.Hovedserie ?? podcast?.["Hoved serie"] ?? podcast?.mainSeries ?? "").trim();
}

export function buildCanonicalGroupResolver(podcasts, displayGroups = []) {
  const groupByMemberKey = new Map();
  for (const group of displayGroups?.groups ?? displayGroups ?? []) {
    if (!group?.id) continue;
    for (const member of group.memberLegacyKeys ?? []) {
      const key = normalizeMatchKey(member);
      if (key) groupByMemberKey.set(key, `display-group:${group.id}`);
    }
  }

  const byPodcastId = new Map((podcasts ?? []).map((podcast) => [podcastId(podcast), podcast]));
  const groupForPodcast = (podcastOrId) => {
    const podcast = typeof podcastOrId === "string" ? byPodcastId.get(podcastOrId) : podcastOrId;
    const id = podcastId(podcast);
    if (!id) return "";
    const displayGroup = groupByMemberKey.get(normalizeMatchKey(title(podcast)));
    if (displayGroup) return displayGroup;
    const series = normalizeComparable(mainSeries(podcast));
    return series ? `series:${series}` : `podcast:${id}`;
  };
  return { byPodcastId, groupForPodcast };
}

function normaliseRatings(ratings) {
  const entries = Array.isArray(ratings)
    ? ratings.map((item) => [item?.podcastId ?? item?.id, item?.rating])
    : Object.entries(ratings ?? {});
  return new Map(
    entries
      .map(([id, rating]) => [String(id ?? "").trim(), Number(rating)])
      .filter(([id, rating]) => id && Number.isFinite(rating))
  );
}

function productByPodcastId(similarityProduct) {
  const rows = Object.values(similarityProduct?.results ?? similarityProduct ?? {});
  return new Map(rows.map((row) => [String(row?.existingId ?? "").trim(), row]).filter(([id]) => id));
}

function compareClusters(left, right) {
  return (
    right.positiveSeedCount - left.positiveSeedCount ||
    right.interestScore - left.interestScore ||
    right.averagePositiveRating - left.averagePositiveRating ||
    right.candidateGroupCount - left.candidateGroupCount ||
    right.candidateQuality - left.candidateQuality ||
    right.specificity - left.specificity ||
    left.sortOrder - right.sortOrder ||
    left.clusterId.localeCompare(right.clusterId)
  );
}

function jaccard(left, right) {
  const intersection = [...left].filter((value) => right.has(value)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 0;
}

function candidateSignals(product) {
  const signals = new Map();
  for (const candidate of [
    ...(product?.automaticSimilarResults ?? []),
    ...(product?.manualSupplementaryResults ?? []),
    ...(product?.sameSeriesResults ?? []),
    ...(product?.combinedSimilarResults ?? [])
  ]) {
    const id = String(candidate?.existingId ?? "").trim();
    if (!id) continue;
    const score = Number(candidate?.contentSimilarityScore ?? 0);
    signals.set(id, Math.max(signals.get(id) ?? 0, Number.isFinite(score) ? score : 0));
  }
  return signals;
}

function buildRecommendations({ cluster, clusterPodcasts, ratedPodcastIds, positiveSeedIds, resolver, products }) {
  const byGroup = new Map();
  for (const candidate of clusterPodcasts) {
    const id = podcastId(candidate);
    if (!id || ratedPodcastIds.has(id)) continue;
    const groupId = resolver.groupForPodcast(candidate);
    let score = 0;
    let signalCount = 0;
    for (const seedId of positiveSeedIds) {
      const signal = candidateSignals(products.get(seedId)).get(id);
      if (signal !== undefined) {
        score += signal;
        signalCount += 1;
      }
    }
    // The pool remains cluster-defined. Product signals choose the order; a
    // deterministic editorial-score fallback orders otherwise equal members.
    const editorialScore = Number(candidate["Vuring (1-10)"] ?? candidate.ratingValue ?? 0) || 0;
    const result = {
      podcastId: id,
      title: title(candidate),
      canonicalGroupId: groupId,
      score: Math.round((score + editorialScore / 100) * 10000) / 10000,
      similaritySignalCount: signalCount,
      editorialScore
    };
    const current = byGroup.get(groupId);
    if (!current || result.score > current.score || (result.score === current.score && result.podcastId.localeCompare(current.podcastId) < 0)) {
      byGroup.set(groupId, result);
    }
  }
  return [...byGroup.values()].sort(
    (left, right) => right.score - left.score || right.similaritySignalCount - left.similaritySignalCount || right.editorialScore - left.editorialScore || left.podcastId.localeCompare(right.podcastId)
  );
}

export function buildExploreClusterRecommendations({
  clusters,
  podcasts,
  ratings,
  similarityProduct,
  displayGroups = []
}) {
  const clusterRows = clusters?.clusters ?? clusters ?? [];
  const resolver = buildCanonicalGroupResolver(podcasts, displayGroups);
  const ratingById = normaliseRatings(ratings);
  const ratedPodcastIds = new Set(ratingById.keys());
  const products = productByPodcastId(similarityProduct);
  const eligible = [];

  for (const cluster of clusterRows) {
    const clusterPodcasts = (cluster.podcastIds ?? []).map((id) => resolver.byPodcastId.get(id)).filter(Boolean);
    const ratingsByGroup = new Map();
    for (const podcast of clusterPodcasts) {
      const id = podcastId(podcast);
      if (!ratingById.has(id)) continue;
      const groupId = resolver.groupForPodcast(podcast);
      const group = ratingsByGroup.get(groupId) ?? { ratings: [], podcastIds: [] };
      group.ratings.push(ratingById.get(id));
      group.podcastIds.push(id);
      ratingsByGroup.set(groupId, group);
    }
    const groupedRatings = [...ratingsByGroup.entries()].map(([groupId, value]) => ({
      groupId,
      rating: value.ratings.reduce((sum, rating) => sum + rating, 0) / value.ratings.length,
      podcastIds: value.podcastIds
    }));
    const positiveGroups = groupedRatings.filter((group) => group.rating >= POSITIVE_RATING_THRESHOLD);
    const positiveSeedIds = positiveGroups.flatMap((group) => group.podcastIds).sort();
    const recommendations = buildRecommendations({ cluster, clusterPodcasts, ratedPodcastIds, positiveSeedIds, resolver, products });
    const interestScore = groupedRatings.reduce((sum, group) => sum + interestScoreForRating(group.rating), 0);
    if (positiveGroups.length < 2 || interestScore <= 0 || recommendations.length < 3) continue;
    eligible.push({
      clusterId: cluster.id,
      title: cluster.title,
      description: cluster.description,
      specificity: Number(cluster.specificity) || 0,
      sortOrder: Number(cluster.sortOrder) || 0,
      positiveSeedCount: positiveGroups.length,
      interestScore,
      averagePositiveRating: positiveGroups.reduce((sum, group) => sum + group.rating, 0) / positiveGroups.length,
      seedPodcastIds: positiveSeedIds,
      seedCanonicalGroupIds: positiveGroups.map((group) => group.groupId).sort(),
      candidateGroupCount: recommendations.length,
      candidateQuality: recommendations.reduce((sum, candidate) => sum + candidate.score, 0),
      recommendations
    });
  }

  eligible.sort(compareClusters);
  const retained = [];
  for (const candidate of eligible) {
    const triggerGroups = new Set(candidate.seedCanonicalGroupIds);
    const candidateGroups = new Set(candidate.recommendations.map((item) => item.canonicalGroupId));
    const duplicate = retained.some((existing) =>
      jaccard(triggerGroups, new Set(existing.seedCanonicalGroupIds)) >= 0.75 &&
      jaccard(candidateGroups, new Set(existing.recommendations.map((item) => item.canonicalGroupId))) > 0.5
    );
    if (!duplicate) retained.push(candidate);
  }
  return retained.map(({ candidateGroupCount, candidateQuality, ...cluster }) => cluster);
}
