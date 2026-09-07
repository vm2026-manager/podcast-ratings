function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeKey(value) {
  return text(value).normalize("NFKC").toLocaleLowerCase("da-DK");
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function rowsFrom(payload, label) {
  const rows = Array.isArray(payload) ? payload : payload?.rows;
  if (!Array.isArray(rows)) throw new Error(`${label} must contain a rows array.`);
  return rows;
}

function finiteNumber(value, path, { minimum = -Infinity, maximum = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`Invalid similarity config: ${path} must be a finite number between ${minimum} and ${maximum}.`);
  }
}

function positiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid similarity config: ${path} must be a positive integer.`);
  }
}

function validateSimilarityConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Invalid similarity config: expected an object.");
  }
  positiveInteger(config.version, "version");
  finiteNumber(config.weights?.topics, "weights.topics", { minimum: 0, maximum: 100 });
  finiteNumber(config.weights?.genres, "weights.genres", { minimum: 0, maximum: 100 });
  if (config.weights.topics + config.weights.genres !== 100) {
    throw new Error("Invalid similarity config: topic and genre weights must sum to 100.");
  }
  if (config.weights.topics <= config.weights.genres) {
    throw new Error("Invalid similarity config: topic weight must dominate genre weight.");
  }
  if (!Array.isArray(config.topicPositionWeights) || config.topicPositionWeights.length === 0) {
    throw new Error("Invalid similarity config: topicPositionWeights must be a non-empty array.");
  }
  config.topicPositionWeights.forEach((value, index) =>
    finiteNumber(value, `topicPositionWeights[${index}]`, { minimum: 0, maximum: 1 })
  );
  for (let index = 1; index < config.topicPositionWeights.length; index += 1) {
    if (config.topicPositionWeights[index] > config.topicPositionWeights[index - 1]) {
      throw new Error("Invalid similarity config: topic position weights must be non-increasing.");
    }
  }
  const aggregation = config.topicAggregation ?? {};
  for (const key of ["strongestMatchWeight", "secondMatchWeight", "remainingMatchesWeight"]) {
    finiteNumber(aggregation[key], `topicAggregation.${key}`, { minimum: 0, maximum: 1 });
  }
  if (
    round(
      aggregation.strongestMatchWeight +
        aggregation.secondMatchWeight +
        aggregation.remainingMatchesWeight,
      8
    ) !== 1
  ) {
    throw new Error("Invalid similarity config: topic aggregation weights must sum to 1.");
  }
  const coverage = aggregation.coverageBySharedTopicCount ?? {};
  for (const key of ["one", "two", "threeOrMore"]) {
    finiteNumber(coverage[key], `topicAggregation.coverageBySharedTopicCount.${key}`, {
      minimum: 0,
      maximum: 1
    });
  }
  if (!(coverage.one <= coverage.two && coverage.two <= coverage.threeOrMore)) {
    throw new Error("Invalid similarity config: topic coverage factors must be non-decreasing.");
  }
  for (const key of ["samePrimary", "primarySecondaryCrossMatch", "sameSecondary"]) {
    finiteNumber(config.genreSignals?.[key], `genreSignals.${key}`, { minimum: 0, maximum: 1 });
  }
  if (
    !(
      config.genreSignals.samePrimary >
        config.genreSignals.primarySecondaryCrossMatch &&
      config.genreSignals.primarySecondaryCrossMatch >
        config.genreSignals.sameSecondary
    )
  ) {
    throw new Error("Invalid similarity config: genre signals must descend from primary to cross to secondary.");
  }
  positiveInteger(config.candidateRules?.resultLimit, "candidateRules.resultLimit");
  positiveInteger(config.candidateRules?.displayLimit, "candidateRules.displayLimit");
  positiveInteger(
    config.candidateRules?.minimumTopicSupportedResults,
    "candidateRules.minimumTopicSupportedResults"
  );
  if (typeof config.candidateRules?.allowGenreOnlyFallback !== "boolean") {
    throw new Error("Invalid similarity config: candidateRules.allowGenreOnlyFallback must be boolean.");
  }
  if (config.candidateRules.displayLimit > config.candidateRules.resultLimit) {
    throw new Error("Invalid similarity config: displayLimit cannot exceed resultLimit.");
  }
  positiveInteger(config.diversity?.maximumPerMainSeries, "diversity.maximumPerMainSeries");
  positiveInteger(
    config.diversity?.maximumPerPublisherInTopEight,
    "diversity.maximumPerPublisherInTopEight"
  );
  const classes = config.similarityClasses ?? {};
  for (const key of ["veryHighMinimum", "highMinimum", "mediumMinimum"]) {
    finiteNumber(classes[key], `similarityClasses.${key}`, { minimum: 0, maximum: 100 });
  }
  if (!(classes.veryHighMinimum > classes.highMinimum && classes.highMinimum > classes.mediumMinimum)) {
    throw new Error("Invalid similarity config: class thresholds must be strictly descending.");
  }
  positiveInteger(
    config.diagnostics?.peripheralTopicPositionMinimum,
    "diagnostics.peripheralTopicPositionMinimum"
  );
  finiteNumber(
    config.diagnostics?.lowEditorialRatingMaximum,
    "diagnostics.lowEditorialRatingMaximum",
    { minimum: 0, maximum: 10 }
  );
  return config;
}

function parseEditorialScore(value) {
  const normalized = text(value).replace(",", ".");
  if (!normalized) return null;
  const score = Number(normalized);
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null;
}

function buildSimilarityCatalog(metadataPayload, podcastPayload) {
  const metadataRows = rowsFrom(metadataPayload, "Recommendation metadata");
  const podcastRows = rowsFrom(podcastPayload, "Podcast data");
  if (metadataRows.length !== podcastRows.length) {
    throw new Error(
      `Cannot safely join similarity data: ${metadataRows.length} metadata rows versus ${podcastRows.length} podcast rows.`
    );
  }
  const seen = new Set();
  const catalog = metadataRows.map((metadata, index) => {
    const display = podcastRows[index] ?? {};
    const recommendationId = text(metadata.recommendationId);
    if (!recommendationId || seen.has(recommendationId)) {
      throw new Error(`Missing or duplicate recommendationId at metadata row ${index + 1}.`);
    }
    seen.add(recommendationId);
    if (text(metadata.title) !== text(display.Titel)) {
      throw new Error(
        `Unsafe similarity join at row ${index + 1}: metadata title ${JSON.stringify(
          metadata.title
        )} differs from podcast title ${JSON.stringify(display.Titel)}.`
      );
    }
    const topicsCanonical = Array.isArray(metadata.topicsCanonical)
      ? metadata.topicsCanonical.map(text).filter(Boolean)
      : [];
    const topicKeys = Array.isArray(metadata.topicKeys)
      ? metadata.topicKeys.map(text).filter(Boolean)
      : [];
    if (topicsCanonical.length !== topicKeys.length) {
      throw new Error(`Topic/key length mismatch for ${recommendationId}.`);
    }
    if (new Set(topicKeys).size !== topicKeys.length) {
      throw new Error(`Duplicate topic key within ${recommendationId}.`);
    }
    return {
      recommendationId,
      existingId: text(metadata.id),
      identityDuplicateGroup: text(metadata.identityDuplicateGroup),
      title: text(metadata.title),
      mainSeries: text(metadata.mainSeries),
      primaryGenre: text(metadata.primaryGenre),
      secondaryGenre: text(metadata.secondaryGenre),
      topicsCanonical,
      topicKeys,
      publisher: text(display.Udgiver),
      editorialScore: parseEditorialScore(
        display["Vuring (1-10)"] ?? display["Vurdering (1-10)"] ?? display.editorialScore
      ),
      image: text(display.Billedlink),
      link: text(display.Link),
      metadataEligible: Boolean(metadata.recommendationMetadataEligible),
      displayRowIndex: index
    };
  });
  return catalog.sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId)
  );
}

function topicWeightAt(config, position) {
  const weights = config.topicPositionWeights;
  return weights[Math.min(position, weights.length - 1)];
}

function calculateTopicSimilarity(source, candidate, config) {
  validateSimilarityConfig(config);
  const candidatePositions = new Map(
    candidate.topicKeys.map((key, index) => [key, index])
  );
  const matches = [];
  source.topicKeys.forEach((key, sourceIndex) => {
    if (!candidatePositions.has(key)) return;
    const candidateIndex = candidatePositions.get(key);
    const sourcePositionWeight = topicWeightAt(config, sourceIndex);
    const candidatePositionWeight = topicWeightAt(config, candidateIndex);
    matches.push({
      topicKey: key,
      topic: source.topicsCanonical[sourceIndex] ?? key,
      sourceTopicPosition: sourceIndex + 1,
      candidateTopicPosition: candidateIndex + 1,
      sourcePositionWeight,
      candidatePositionWeight,
      centrality: Math.sqrt(sourcePositionWeight * candidatePositionWeight)
    });
  });
  matches.sort(
    (left, right) =>
      right.centrality - left.centrality ||
      left.topicKey.localeCompare(right.topicKey)
  );
  if (matches.length === 0) {
    return {
      sharedTopics: [],
      sharedTopicKeys: [],
      sourceTopicPositions: [],
      candidateTopicPositions: [],
      strongestSharedTopic: "",
      strongestSharedTopicCentrality: 0,
      supportingSharedTopics: [],
      topicSimilarityScore: 0,
      sharedTopicDetails: []
    };
  }
  const aggregation = config.topicAggregation;
  const strongest = matches[0].centrality;
  const second = matches[1]?.centrality ?? 0;
  const remaining =
    matches.length > 2
      ? matches.slice(2).reduce((sum, match) => sum + match.centrality, 0) /
        (matches.length - 2)
      : 0;
  const availableAggregationWeight =
    aggregation.strongestMatchWeight +
    (matches.length >= 2 ? aggregation.secondMatchWeight : 0) +
    (matches.length >= 3 ? aggregation.remainingMatchesWeight : 0);
  const boundedCentrality =
    (strongest * aggregation.strongestMatchWeight +
      second * aggregation.secondMatchWeight +
      remaining * aggregation.remainingMatchesWeight) /
    availableAggregationWeight;
  const coverage =
    matches.length === 1
      ? aggregation.coverageBySharedTopicCount.one
      : matches.length === 2
        ? aggregation.coverageBySharedTopicCount.two
        : aggregation.coverageBySharedTopicCount.threeOrMore;
  return {
    sharedTopics: matches.map((match) => match.topic),
    sharedTopicKeys: matches.map((match) => match.topicKey),
    sourceTopicPositions: matches.map((match) => match.sourceTopicPosition),
    candidateTopicPositions: matches.map((match) => match.candidateTopicPosition),
    strongestSharedTopic: matches[0].topic,
    strongestSharedTopicCentrality: round(matches[0].centrality),
    supportingSharedTopics: matches.slice(1).map((match) => match.topic),
    topicSimilarityScore: round(
      clamp(boundedCentrality * coverage * config.weights.topics, 0, config.weights.topics)
    ),
    sharedTopicDetails: matches.map((match) => ({
      ...match,
      centrality: round(match.centrality)
    }))
  };
}

function calculateGenreSimilarity(source, candidate, config) {
  validateSimilarityConfig(config);
  const sourcePrimary = normalizeKey(source.primaryGenre);
  const sourceSecondary = normalizeKey(source.secondaryGenre);
  const candidatePrimary = normalizeKey(candidate.primaryGenre);
  const candidateSecondary = normalizeKey(candidate.secondaryGenre);
  const signalsByGenre = new Map();
  const addSignal = (genre, type, strength) => {
    if (!genre) return;
    const previous = signalsByGenre.get(genre);
    if (!previous || strength > previous.strength) {
      signalsByGenre.set(genre, { genre, type, strength });
    }
  };
  if (sourcePrimary && sourcePrimary === candidatePrimary) {
    addSignal(sourcePrimary, "same_primary", config.genreSignals.samePrimary);
  }
  if (sourcePrimary && sourcePrimary === candidateSecondary) {
    addSignal(
      sourcePrimary,
      "primary_secondary_cross",
      config.genreSignals.primarySecondaryCrossMatch
    );
  }
  if (sourceSecondary && sourceSecondary === candidatePrimary) {
    addSignal(
      sourceSecondary,
      "primary_secondary_cross",
      config.genreSignals.primarySecondaryCrossMatch
    );
  }
  if (sourceSecondary && sourceSecondary === candidateSecondary) {
    addSignal(sourceSecondary, "same_secondary", config.genreSignals.sameSecondary);
  }
  const signals = Array.from(signalsByGenre.values()).sort(
    (left, right) =>
      right.strength - left.strength || left.genre.localeCompare(right.genre)
  );
  const combinedStrength = Math.min(
    1,
    signals.reduce((sum, signal) => sum + signal.strength, 0)
  );
  const labelByKey = new Map(
    [
      source.primaryGenre,
      source.secondaryGenre,
      candidate.primaryGenre,
      candidate.secondaryGenre
    ]
      .filter(Boolean)
      .map((genre) => [normalizeKey(genre), genre])
  );
  return {
    sharedPrimaryGenre:
      sourcePrimary && sourcePrimary === candidatePrimary
        ? labelByKey.get(sourcePrimary) ?? source.primaryGenre
        : "",
    crossGenreMatches: signals
      .filter((signal) => signal.type === "primary_secondary_cross")
      .map((signal) => labelByKey.get(signal.genre) ?? signal.genre),
    sharedSecondaryGenre:
      sourceSecondary && sourceSecondary === candidateSecondary
        ? labelByKey.get(sourceSecondary) ?? source.secondaryGenre
        : "",
    genreSignals: signals.map((signal) => ({
      ...signal,
      genre: labelByKey.get(signal.genre) ?? signal.genre
    })),
    genreSimilarityScore: round(
      clamp(combinedStrength * config.weights.genres, 0, config.weights.genres)
    )
  };
}

function classifySimilarity(topicScore, genreScore, totalScore, config) {
  if (topicScore === 0 && genreScore > 0) return "genre_only";
  if (totalScore >= config.similarityClasses.veryHighMinimum) return "very_high";
  if (totalScore >= config.similarityClasses.highMinimum) return "high";
  if (totalScore >= config.similarityClasses.mediumMinimum) return "medium";
  return "low";
}

function possibleUnresolvedDuplicate(source, candidate) {
  if (
    source.identityDuplicateGroup &&
    source.identityDuplicateGroup === candidate.identityDuplicateGroup
  ) {
    return false;
  }
  return Boolean(
    (source.existingId && source.existingId === candidate.existingId) ||
      (normalizeKey(source.title) && normalizeKey(source.title) === normalizeKey(candidate.title))
  );
}

function generateSimilarityReasons(source, candidate, topicResult, genreResult) {
  const reasons = [];
  if (topicResult.sharedTopics.length >= 2) {
    reasons.push(
      `Begge fokuserer på ${topicResult.sharedTopics.slice(0, 2).join(" og ")}.`
    );
  } else if (topicResult.sharedTopics.length === 1) {
    reasons.push(`Deres fælles emne er ${topicResult.strongestSharedTopic}.`);
  } else if (genreResult.sharedPrimaryGenre) {
    reasons.push(
      `De har samme primære genre, ${genreResult.sharedPrimaryGenre}, men ingen fælles emner.`
    );
  } else if (
    genreResult.crossGenreMatches.length > 0 ||
    genreResult.sharedSecondaryGenre
  ) {
    const genre =
      genreResult.crossGenreMatches[0] || genreResult.sharedSecondaryGenre;
    reasons.push(
      `De har genreoverlap i ${genre}, men ingen fælles emner.`
    );
  }
  if (
    topicResult.sharedTopics.length >= 2 &&
    topicResult.strongestSharedTopicCentrality >= 0.8
  ) {
    reasons.push(
      `Det mest centrale fælles emne er ${topicResult.strongestSharedTopic}.`
    );
  }
  if (topicResult.sharedTopics.length > 0 && genreResult.genreSimilarityScore > 0) {
    reasons.push("Emneoverlappet understøttes også af kompatible genrer.");
  }
  return reasons;
}

function calculatePodcastSimilarity(source, candidate, config) {
  validateSimilarityConfig(config);
  const topicResult = calculateTopicSimilarity(source, candidate, config);
  const genreResult = calculateGenreSimilarity(source, candidate, config);
  const contentSimilarityScore = round(
    clamp(
      topicResult.topicSimilarityScore + genreResult.genreSimilarityScore,
      0,
      100
    )
  );
  const candidateType =
    topicResult.topicSimilarityScore > 0 && genreResult.genreSimilarityScore > 0
      ? "topic_and_genre"
      : topicResult.topicSimilarityScore > 0
        ? "topic_only"
        : genreResult.genreSimilarityScore > 0
          ? "genre_only"
          : "";
  const warnings = [];
  if (candidateType === "genre_only") warnings.push("genre_only_fallback");
  if (topicResult.sharedTopics.length === 1) warnings.push("only_one_shared_topic");
  if (
    topicResult.sharedTopics.length > 0 &&
    topicResult.sourceTopicPositions[0] >=
      config.diagnostics.peripheralTopicPositionMinimum &&
    topicResult.candidateTopicPositions[0] >=
      config.diagnostics.peripheralTopicPositionMinimum
  ) {
    warnings.push("shared_topic_is_peripheral");
  }
  const sameMainSeries = Boolean(
    normalizeKey(source.mainSeries) &&
      normalizeKey(source.mainSeries) === normalizeKey(candidate.mainSeries)
  );
  if (sameMainSeries) warnings.push("same_main_series");
  if (candidate.editorialScore === null) warnings.push("missing_editorial_rating");
  else if (candidate.editorialScore <= config.diagnostics.lowEditorialRatingMaximum) {
    warnings.push("low_editorial_rating");
  }
  if (!candidate.image) warnings.push("missing_image");
  if (!candidate.link) warnings.push("missing_link");
  if (possibleUnresolvedDuplicate(source, candidate)) {
    warnings.push("possible_unresolved_duplicate");
  }
  return {
    recommendationId: candidate.recommendationId,
    existingId: candidate.existingId,
    title: candidate.title,
    publisher: candidate.publisher,
    mainSeries: candidate.mainSeries,
    primaryGenre: candidate.primaryGenre,
    secondaryGenre: candidate.secondaryGenre,
    topicsCanonical: candidate.topicsCanonical,
    editorialScore: candidate.editorialScore,
    hasUsableImage: Boolean(candidate.image),
    hasUsableLink: Boolean(candidate.link),
    image: candidate.image,
    link: candidate.link,
    contentSimilarityScore,
    topicSimilarityScore: topicResult.topicSimilarityScore,
    genreSimilarityScore: genreResult.genreSimilarityScore,
    similarityClass: classifySimilarity(
      topicResult.topicSimilarityScore,
      genreResult.genreSimilarityScore,
      contentSimilarityScore,
      config
    ),
    sharedTopics: topicResult.sharedTopics,
    sharedTopicKeys: topicResult.sharedTopicKeys,
    sourceTopicPositions: topicResult.sourceTopicPositions,
    candidateTopicPositions: topicResult.candidateTopicPositions,
    strongestSharedTopic: topicResult.strongestSharedTopic,
    strongestSharedTopicCentrality: topicResult.strongestSharedTopicCentrality,
    supportingSharedTopics: topicResult.supportingSharedTopics,
    sharedTopicDetails: topicResult.sharedTopicDetails,
    sharedPrimaryGenre: genreResult.sharedPrimaryGenre,
    crossGenreMatches: genreResult.crossGenreMatches,
    sharedSecondaryGenre: genreResult.sharedSecondaryGenre,
    genreSignals: genreResult.genreSignals,
    sameMainSeries,
    identityDuplicateGroup: candidate.identityDuplicateGroup,
    candidateType,
    similarityReasons: generateSimilarityReasons(
      source,
      candidate,
      topicResult,
      genreResult
    ),
    similarityWarnings: warnings
  };
}

function compareRankedCandidates(left, right) {
  return (
    right.contentSimilarityScore - left.contentSimilarityScore ||
    right.sharedTopics.length - left.sharedTopics.length ||
    right.strongestSharedTopicCentrality - left.strongestSharedTopicCentrality ||
    (right.editorialScore ?? -Infinity) - (left.editorialScore ?? -Infinity) ||
    left.recommendationId.localeCompare(right.recommendationId)
  );
}

function rankSimilarPodcasts(source, catalog, config) {
  validateSimilarityConfig(config);
  const diagnostics = [];
  for (const candidate of catalog) {
    let eligible = true;
    let exclusionReason = "";
    if (candidate.recommendationId === source.recommendationId) {
      eligible = false;
      exclusionReason = "source_podcast";
    } else if (
      source.identityDuplicateGroup &&
      source.identityDuplicateGroup === candidate.identityDuplicateGroup
    ) {
      eligible = false;
      exclusionReason = "safe_identity_duplicate";
    }
    const similarity = calculatePodcastSimilarity(source, candidate, config);
    if (eligible && similarity.contentSimilarityScore <= 0) {
      eligible = false;
      exclusionReason = "no_topic_or_genre_similarity";
    }
    diagnostics.push({
      ...similarity,
      eligible,
      exclusionReason,
      originalRank: null,
      selected: false,
      diversifiedRank: null,
      diversityAction: ""
    });
  }
  const ranked = diagnostics
    .filter((row) => row.eligible)
    .sort(compareRankedCandidates);
  ranked.forEach((row, index) => {
    row.originalRank = index + 1;
  });
  return { ranked, diagnostics };
}

function applySimilarityDiversity(rankedCandidates, config) {
  validateSimilarityConfig(config);
  const topicCandidates = rankedCandidates.filter(
    (candidate) => candidate.candidateType !== "genre_only"
  );
  const genreOnlyCandidates = rankedCandidates.filter(
    (candidate) => candidate.candidateType === "genre_only"
  );
  const selected = [];
  const mainSeriesCounts = new Map();
  const publisherCountsInTopEight = new Map();
  const attempt = (candidate, fallbackStage = "") => {
    const seriesKey = normalizeKey(candidate.mainSeries);
    if (
      seriesKey &&
      (mainSeriesCounts.get(seriesKey) ?? 0) >=
        config.diversity.maximumPerMainSeries
    ) {
      candidate.diversityAction = "removed_main_series_limit";
      return false;
    }
    const publisherKey = normalizeKey(candidate.publisher);
    if (
      selected.length < config.candidateRules.displayLimit &&
      publisherKey &&
      (publisherCountsInTopEight.get(publisherKey) ?? 0) >=
        config.diversity.maximumPerPublisherInTopEight
    ) {
      candidate.diversityAction = "removed_publisher_top_eight_limit";
      return false;
    }
    selected.push(candidate);
    candidate.selected = true;
    candidate.diversifiedRank = selected.length;
    candidate.fallbackStage = fallbackStage;
    if (seriesKey) mainSeriesCounts.set(seriesKey, (mainSeriesCounts.get(seriesKey) ?? 0) + 1);
    if (selected.length <= config.candidateRules.displayLimit && publisherKey) {
      publisherCountsInTopEight.set(
        publisherKey,
        (publisherCountsInTopEight.get(publisherKey) ?? 0) + 1
      );
    }
    return true;
  };
  for (const candidate of topicCandidates) {
    if (selected.length >= config.candidateRules.resultLimit) break;
    attempt(candidate);
  }
  const selectedTopicCount = selected.length;
  if (
    config.candidateRules.allowGenreOnlyFallback &&
    selected.length < config.candidateRules.displayLimit
  ) {
    for (const candidate of genreOnlyCandidates) {
      if (selected.length >= config.candidateRules.displayLimit) break;
      attempt(candidate, "after_topic_supported_candidates");
    }
  }
  return {
    selected,
    selectedTopicCount,
    selectedGenreOnlyCount: selected.filter(
      (candidate) => candidate.candidateType === "genre_only"
    ).length,
    mainSeriesRemovalCount: rankedCandidates.filter(
      (candidate) => candidate.diversityAction === "removed_main_series_limit"
    ).length,
    publisherRemovalCount: rankedCandidates.filter(
      (candidate) =>
        candidate.diversityAction === "removed_publisher_top_eight_limit"
    ).length
  };
}

function buildSimilarityResultsForPodcast(source, catalog, config) {
  const { ranked, diagnostics } = rankSimilarPodcasts(source, catalog, config);
  const topicSupportedCandidateCount = ranked.filter(
    (candidate) => candidate.candidateType !== "genre_only"
  ).length;
  const genreOnlyCandidateCount = ranked.filter(
    (candidate) => candidate.candidateType === "genre_only"
  ).length;
  const diversified = applySimilarityDiversity(ranked, config);
  const warnings = [];
  if (topicSupportedCandidateCount < config.candidateRules.minimumTopicSupportedResults) {
    warnings.push("fewer_than_three_topic_matches");
  }
  if (topicSupportedCandidateCount < config.candidateRules.displayLimit) {
    warnings.push("fewer_than_eight_topic_matches");
  }
  if (topicSupportedCandidateCount === 0) warnings.push("zero_topic_supported_candidates");
  if (diversified.selectedGenreOnlyCount > 0) warnings.push("genre_only_fallback_used");
  return {
    recommendationId: source.recommendationId,
    title: source.title,
    topicsCanonical: source.topicsCanonical,
    topicSupportedCandidateCount,
    genreOnlyCandidateCount,
    selectedTopicSupportedCount: diversified.selectedTopicCount,
    selectedGenreOnlyCount: diversified.selectedGenreOnlyCount,
    mainSeriesRemovalCount: diversified.mainSeriesRemovalCount,
    publisherRemovalCount: diversified.publisherRemovalCount,
    selectedResults: diversified.selected.map((candidate) => ({
      recommendationId: candidate.recommendationId,
      existingId: candidate.existingId,
      title: candidate.title,
      publisher: candidate.publisher,
      mainSeries: candidate.mainSeries,
      primaryGenre: candidate.primaryGenre,
      secondaryGenre: candidate.secondaryGenre,
      topicsCanonical: candidate.topicsCanonical,
      editorialScore: candidate.editorialScore,
      image: candidate.image,
      link: candidate.link,
      contentSimilarityScore: candidate.contentSimilarityScore,
      topicSimilarityScore: candidate.topicSimilarityScore,
      genreSimilarityScore: candidate.genreSimilarityScore,
      similarityClass: candidate.similarityClass,
      sharedTopics: candidate.sharedTopics,
      strongestSharedTopic: candidate.strongestSharedTopic,
      strongestSharedTopicCentrality: candidate.strongestSharedTopicCentrality,
      supportingSharedTopics: candidate.supportingSharedTopics,
      sameMainSeries: candidate.sameMainSeries,
      similarityReasons: candidate.similarityReasons,
      similarityWarnings: candidate.similarityWarnings,
      candidateType: candidate.candidateType,
      originalRank: candidate.originalRank,
      diversifiedRank: candidate.diversifiedRank,
      fallbackStage: candidate.fallbackStage ?? ""
    })),
    warnings,
    candidateDiagnostics: diagnostics
  };
}

function buildSimilarityResultsForCatalog(catalog, config) {
  validateSimilarityConfig(config);
  const sortedCatalog = [...catalog].sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId)
  );
  const results = {};
  for (const source of sortedCatalog) {
    const built = buildSimilarityResultsForPodcast(
      source,
      sortedCatalog,
      config
    );
    const { candidateDiagnostics: _candidateDiagnostics, ...serializable } = built;
    results[source.recommendationId] = serializable;
  }
  return {
    version: config.version,
    sourceCount: sortedCatalog.length,
    results
  };
}

export {
  applySimilarityDiversity,
  buildSimilarityCatalog,
  buildSimilarityResultsForCatalog,
  buildSimilarityResultsForPodcast,
  calculateGenreSimilarity,
  calculatePodcastSimilarity,
  calculateTopicSimilarity,
  compareRankedCandidates,
  generateSimilarityReasons,
  rankSimilarPodcasts,
  validateSimilarityConfig
};
