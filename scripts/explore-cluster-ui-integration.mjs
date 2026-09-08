import {
  buildCanonicalGroupResolver,
  buildExploreClusterRecommendations
} from "./explore-cluster-recommendations.mjs";

function idOf(podcast) {
  return String(podcast?.["Podcast-ID"] ?? podcast?.podcastId ?? podcast?.id ?? "").trim();
}

function titleOf(podcast) {
  return String(podcast?.Titel ?? podcast?.title ?? "").trim();
}

function representativeSeedTitles(cluster, podcasts, displayGroups, ratings = {}) {
  const resolver = buildCanonicalGroupResolver(podcasts, displayGroups);
  const byId = new Map((podcasts ?? []).map((podcast) => [idOf(podcast), podcast]));
  const byGroup = new Map();
  for (const seedId of cluster.seedPodcastIds ?? []) {
    const podcast = byId.get(seedId);
    const groupId = resolver.groupForPodcast(podcast);
    const current = byGroup.get(groupId);
    const rating = Number(ratings?.[seedId] ?? 0);
    if (!current || rating > current.rating || (rating === current.rating && seedId.localeCompare(current.id) < 0)) {
      byGroup.set(groupId, { id: seedId, rating, title: titleOf(podcast) || seedId });
    }
  }
  return [...byGroup.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value.title);
}

export function formatExploreClusterExplanation(cluster, podcasts, displayGroups, ratings) {
  const titles = representativeSeedTitles(cluster, podcasts, displayGroups, ratings);
  if (cluster.positiveSeedCount === 2 && titles.length >= 2) {
    return `Fordi du kunne lide ${titles[0]} og ${titles[1]}.`;
  }
  if (cluster.positiveSeedCount === 3 && titles.length >= 3) {
    return `Baseret på ${titles[0]}, ${titles[1]} og ${titles[2]}.`;
  }
  return `Baseret på ${cluster.positiveSeedCount} podcasts, du har vurderet positivt.`;
}

export function buildExploreClusterSections({
  clusters,
  podcasts,
  ratings,
  similarityProduct,
  displayGroups,
  matchesPodcast = () => true
}) {
  const output = buildExploreClusterRecommendations({
    clusters,
    podcasts,
    ratings,
    similarityProduct,
    displayGroups
  });
  const byId = new Map((podcasts ?? []).map((podcast) => [idOf(podcast), podcast]));
  return output.map((cluster) => {
    const items = cluster.recommendations
      .map((recommendation) => byId.get(recommendation.podcastId))
      .filter((podcast) => podcast && matchesPodcast(podcast))
      .slice(0, 12)
      .map((podcast) => ({ podcast, reason: "Anbefalet til dig" }));
    return {
      clusterId: cluster.clusterId,
      eyebrow: "Ud fra dine vurderinger",
      title: cluster.title,
      note: formatExploreClusterExplanation(cluster, podcasts, displayGroups, ratings),
      seedPodcastIds: [...cluster.seedPodcastIds],
      items
    };
  }).filter((section) => section.items.length >= 3);
}

export function mergeExploreClusterSections({ clusterSections = [], individualSections = [], limit = 0 }) {
  const retainedClusters = clusterSections.slice(0, Math.max(0, limit));
  const absorbedSeedIds = new Set(retainedClusters.flatMap((section) => section.seedPodcastIds));
  const remaining = individualSections.filter(
    (section) => !section.seedPodcastKey || !absorbedSeedIds.has(section.seedPodcastKey)
  );
  return [...retainedClusters, ...remaining].slice(0, Math.max(0, limit));
}
