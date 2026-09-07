function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeKey(value) {
  return text(value).normalize("NFKC").toLocaleLowerCase("da-DK");
}

function normalizeDisplayTitle(value) {
  return text(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("da-DK");
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
    throw new Error(
      `Invalid similarity v1.1 config: ${path} must be a finite number between ${minimum} and ${maximum}.`
    );
  }
}

function positiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid similarity v1.1 config: ${path} must be a positive integer.`);
  }
}

function validateSimilarityConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Invalid similarity v1.1 config: expected an object.");
  }
  finiteNumber(config.version, "version", { minimum: 1 });
  finiteNumber(config.weights?.topics, "weights.topics", { minimum: 0, maximum: 100 });
  finiteNumber(config.weights?.genres, "weights.genres", { minimum: 0, maximum: 100 });
  if (config.weights.topics + config.weights.genres !== 100) {
    throw new Error("Invalid similarity v1.1 config: topic and genre weights must sum to 100.");
  }
  if (config.weights.topics <= config.weights.genres) {
    throw new Error("Invalid similarity v1.1 config: topics must dominate genres.");
  }
  if (!Array.isArray(config.topicPositionWeights) || !config.topicPositionWeights.length) {
    throw new Error("Invalid similarity v1.1 config: topicPositionWeights must be non-empty.");
  }
  config.topicPositionWeights.forEach((value, index) =>
    finiteNumber(value, `topicPositionWeights[${index}]`, { minimum: 0, maximum: 1 })
  );
  for (let index = 1; index < config.topicPositionWeights.length; index += 1) {
    if (config.topicPositionWeights[index] > config.topicPositionWeights[index - 1]) {
      throw new Error("Invalid similarity v1.1 config: topic-position weights must be non-increasing.");
    }
  }
  const specificity = config.topicSpecificity ?? {};
  finiteNumber(specificity.smoothing, "topicSpecificity.smoothing", { minimum: 0 });
  finiteNumber(specificity.minimum, "topicSpecificity.minimum", { minimum: 0, maximum: 1 });
  finiteNumber(specificity.scale, "topicSpecificity.scale", { minimum: 0, maximum: 1 });
  if (specificity.minimum + specificity.scale > 1) {
    throw new Error("Invalid similarity v1.1 config: specificity minimum plus scale cannot exceed 1.");
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
    throw new Error("Invalid similarity v1.1 config: aggregation weights must sum to 1.");
  }
  for (const key of [
    "oneSharedTopicCoverageBase",
    "oneSharedTopicSpecificityScale",
    "twoSharedTopicsCoverage",
    "threeOrMoreSharedTopicsCoverage"
  ]) {
    finiteNumber(aggregation[key], `topicAggregation.${key}`, { minimum: 0, maximum: 1 });
  }
  if (
    aggregation.oneSharedTopicCoverageBase +
      aggregation.oneSharedTopicSpecificityScale >
    1
  ) {
    throw new Error("Invalid similarity v1.1 config: one-topic coverage can exceed 1.");
  }
  if (aggregation.twoSharedTopicsCoverage > aggregation.threeOrMoreSharedTopicsCoverage) {
    throw new Error("Invalid similarity v1.1 config: topic coverage must be non-decreasing.");
  }
  for (const key of ["samePrimary", "primarySecondaryCrossMatch", "sameSecondary"]) {
    finiteNumber(config.genreSignals?.[key], `genreSignals.${key}`, {
      minimum: 0,
      maximum: 1
    });
  }
  if (
    !(
      config.genreSignals.samePrimary >
        config.genreSignals.primarySecondaryCrossMatch &&
      config.genreSignals.primarySecondaryCrossMatch >
        config.genreSignals.sameSecondary
    )
  ) {
    throw new Error("Invalid similarity v1.1 config: genre signals must descend.");
  }
  const credible = config.credibleResultRules ?? {};
  finiteNumber(credible.minimumAdjustedCentrality, "credibleResultRules.minimumAdjustedCentrality", {
    minimum: 0,
    maximum: 1
  });
  finiteNumber(credible.minimumTopicSpecificity, "credibleResultRules.minimumTopicSpecificity", {
    minimum: 0,
    maximum: 1
  });
  finiteNumber(
    credible.singleTopicWithGenreMinimumScore,
    "credibleResultRules.singleTopicWithGenreMinimumScore",
    { minimum: 0, maximum: 100 }
  );
  finiteNumber(
    credible.meaningfulGenreMinimumScore,
    "credibleResultRules.meaningfulGenreMinimumScore",
    { minimum: 0, maximum: config.weights.genres }
  );
  positiveInteger(config.candidateRules?.auditResultLimit, "candidateRules.auditResultLimit");
  positiveInteger(config.candidateRules?.displayLimit, "candidateRules.displayLimit");
  if (config.candidateRules.displayLimit > config.candidateRules.auditResultLimit) {
    throw new Error("Invalid similarity v1.1 config: displayLimit cannot exceed auditResultLimit.");
  }
  positiveInteger(
    config.diversity?.maximumPerNormalizedDisplayTitle,
    "diversity.maximumPerNormalizedDisplayTitle"
  );
  positiveInteger(config.diversity?.maximumPerMainSeries, "diversity.maximumPerMainSeries");
  positiveInteger(
    config.diversity?.maximumPerPublisherInDisplay,
    "diversity.maximumPerPublisherInDisplay"
  );
  const classes = config.similarityClasses ?? {};
  for (const key of [
    "veryHighMinimum",
    "highMinimum",
    "mediumMinimum"
  ]) {
    finiteNumber(classes[key], `similarityClasses.${key}`, { minimum: 0, maximum: 100 });
  }
  finiteNumber(
    classes.veryHighMinimumAdjustedContribution,
    "similarityClasses.veryHighMinimumAdjustedContribution",
    { minimum: 0, maximum: 1 }
  );
  finiteNumber(
    classes.singleTopicHighMinimumSpecificity,
    "similarityClasses.singleTopicHighMinimumSpecificity",
    { minimum: 0, maximum: 1 }
  );
  positiveInteger(
    classes.veryHighMinimumSharedTopics,
    "similarityClasses.veryHighMinimumSharedTopics"
  );
  positiveInteger(classes.highMinimumSharedTopics, "similarityClasses.highMinimumSharedTopics");
  positiveInteger(
    classes.singleTopicHighMaximumPosition,
    "similarityClasses.singleTopicHighMaximumPosition"
  );
  if (!(classes.veryHighMinimum > classes.highMinimum && classes.highMinimum > classes.mediumMinimum)) {
    throw new Error("Invalid similarity v1.1 config: class score thresholds must descend.");
  }
  finiteNumber(
    config.diagnostics?.broadTopicSpecificityMaximum,
    "diagnostics.broadTopicSpecificityMaximum",
    { minimum: 0, maximum: 1 }
  );
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
      `Cannot safely join similarity v1.1 data: ${metadataRows.length} metadata rows versus ${podcastRows.length} podcast rows.`
    );
  }
  const seen = new Set();
  return metadataRows
    .map((metadata, index) => {
      const display = podcastRows[index] ?? {};
      const recommendationId = text(metadata.recommendationId);
      if (!recommendationId || seen.has(recommendationId)) {
        throw new Error(`Missing or duplicate recommendationId at metadata row ${index + 1}.`);
      }
      seen.add(recommendationId);
      if (text(metadata.title) !== text(display.Titel)) {
        throw new Error(
          `Unsafe similarity v1.1 join at row ${index + 1}: ${JSON.stringify(
            metadata.title
          )} differs from ${JSON.stringify(display.Titel)}.`
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
        normalizedDisplayTitle: normalizeDisplayTitle(metadata.title),
        mainSeries: text(metadata.mainSeries),
        primaryGenre: text(metadata.primaryGenre),
        secondaryGenre: text(metadata.secondaryGenre),
        topicsCanonical,
        topicKeys,
        publisher: text(display.Udgiver),
        editorialScore: parseEditorialScore(
          display["Vuring (1-10)"] ??
            display["Vurdering (1-10)"] ??
            display.editorialScore
        ),
        image: text(display.Billedlink),
        link: text(display.Link),
        metadataEligible: Boolean(metadata.recommendationMetadataEligible),
        displayRowIndex: index
      };
    })
    .sort((left, right) => left.recommendationId.localeCompare(right.recommendationId));
}

function buildTopicSpecificityIndex(catalog, config) {
  validateSimilarityConfig(config);
  const catalogSize = catalog.length;
  if (!catalogSize) throw new Error("Cannot build topic specificity for an empty catalog.");
  const documentFrequency = new Map();
  const canonicalByKey = new Map();
  for (const podcast of catalog) {
    const seenForPodcast = new Set();
    podcast.topicKeys.forEach((topicKey, index) => {
      if (!topicKey || seenForPodcast.has(topicKey)) return;
      seenForPodcast.add(topicKey);
      documentFrequency.set(topicKey, (documentFrequency.get(topicKey) ?? 0) + 1);
      if (!canonicalByKey.has(topicKey)) {
        canonicalByKey.set(topicKey, podcast.topicsCanonical[index] ?? topicKey);
      }
    });
  }
  const index = new Map();
  for (const [topicKey, podcastDocumentFrequency] of [...documentFrequency.entries()].sort(
    ([left], [right]) => left.localeCompare(right)
  )) {
    const rawSpecificity =
      Math.log(
        (catalogSize + config.topicSpecificity.smoothing) /
          (podcastDocumentFrequency + config.topicSpecificity.smoothing)
      ) / Math.log(catalogSize + config.topicSpecificity.smoothing);
    const topicSpecificity =
      config.topicSpecificity.minimum + config.topicSpecificity.scale * rawSpecificity;
    index.set(topicKey, {
      topic: canonicalByKey.get(topicKey) ?? topicKey,
      topicKey,
      podcastDocumentFrequency,
      catalogCoverageRatio: round(podcastDocumentFrequency / catalogSize, 8),
      rawSpecificity: round(rawSpecificity, 8),
      topicSpecificity: round(
        clamp(
          topicSpecificity,
          config.topicSpecificity.minimum,
          config.topicSpecificity.minimum + config.topicSpecificity.scale
        ),
        8
      )
    });
  }
  return { catalogSize, topics: index };
}

function topicWeightAt(config, position) {
  return config.topicPositionWeights[
    Math.min(position, config.topicPositionWeights.length - 1)
  ];
}

function calculateTopicSimilarity(source, candidate, specificityIndex, config) {
  validateSimilarityConfig(config);
  const candidatePositions = new Map(
    candidate.topicKeys.map((key, index) => [key, index])
  );
  const matches = [];
  source.topicKeys.forEach((topicKey, sourceIndex) => {
    if (!candidatePositions.has(topicKey)) return;
    const candidateIndex = candidatePositions.get(topicKey);
    const specificity = specificityIndex.topics.get(topicKey);
    if (!specificity) throw new Error(`Missing specificity for shared topic ${topicKey}.`);
    const sourcePositionWeight = topicWeightAt(config, sourceIndex);
    const candidatePositionWeight = topicWeightAt(config, candidateIndex);
    const centrality = Math.sqrt(sourcePositionWeight * candidatePositionWeight);
    const adjustedContribution = centrality * specificity.topicSpecificity;
    matches.push({
      topic: source.topicsCanonical[sourceIndex] ?? specificity.topic,
      topicKey,
      podcastDocumentFrequency: specificity.podcastDocumentFrequency,
      catalogCoverageRatio: specificity.catalogCoverageRatio,
      topicSpecificity: specificity.topicSpecificity,
      sourcePosition: sourceIndex + 1,
      candidatePosition: candidateIndex + 1,
      sourcePositionWeight,
      candidatePositionWeight,
      centrality: round(centrality, 8),
      adjustedContribution: round(adjustedContribution, 8)
    });
  });
  matches.sort(
    (left, right) =>
      right.adjustedContribution - left.adjustedContribution ||
      right.topicSpecificity - left.topicSpecificity ||
      left.topicKey.localeCompare(right.topicKey)
  );
  if (!matches.length) {
    return {
      sharedTopics: [],
      sharedTopicKeys: [],
      sharedTopicDetails: [],
      strongestSharedTopic: "",
      strongestSharedTopicCentrality: 0,
      strongestAdjustedTopicContribution: 0,
      strongestTopicSpecificity: 0,
      supportingSharedTopics: [],
      topicCoverageFactor: 0,
      topicSimilarityScore: 0
    };
  }
  const aggregation = config.topicAggregation;
  const strongest = matches[0].adjustedContribution;
  const second = matches[1]?.adjustedContribution ?? 0;
  const remaining =
    matches.length > 2
      ? matches.slice(2).reduce((sum, match) => sum + match.adjustedContribution, 0) /
        (matches.length - 2)
      : 0;
  const availableWeight =
    aggregation.strongestMatchWeight +
    (matches.length >= 2 ? aggregation.secondMatchWeight : 0) +
    (matches.length >= 3 ? aggregation.remainingMatchesWeight : 0);
  const boundedAdjustedContribution =
    (strongest * aggregation.strongestMatchWeight +
      second * aggregation.secondMatchWeight +
      remaining * aggregation.remainingMatchesWeight) /
    availableWeight;
  const topicCoverageFactor =
    matches.length === 1
      ? aggregation.oneSharedTopicCoverageBase +
        aggregation.oneSharedTopicSpecificityScale * matches[0].topicSpecificity
      : matches.length === 2
        ? aggregation.twoSharedTopicsCoverage
        : aggregation.threeOrMoreSharedTopicsCoverage;
  return {
    sharedTopics: matches.map((match) => match.topic),
    sharedTopicKeys: matches.map((match) => match.topicKey),
    sharedTopicDetails: matches,
    strongestSharedTopic: matches[0].topic,
    strongestSharedTopicCentrality: matches[0].centrality,
    strongestAdjustedTopicContribution: matches[0].adjustedContribution,
    strongestTopicSpecificity: matches[0].topicSpecificity,
    supportingSharedTopics: matches.slice(1).map((match) => match.topic),
    topicCoverageFactor: round(topicCoverageFactor, 8),
    topicSimilarityScore: round(
      clamp(
        boundedAdjustedContribution * topicCoverageFactor * config.weights.topics,
        0,
        config.weights.topics
      )
    )
  };
}

function calculateGenreSimilarity(source, candidate, config) {
  validateSimilarityConfig(config);
  const sourcePrimary = normalizeKey(source.primaryGenre);
  const sourceSecondary = normalizeKey(source.secondaryGenre);
  const candidatePrimary = normalizeKey(candidate.primaryGenre);
  const candidateSecondary = normalizeKey(candidate.secondaryGenre);
  const signalsByGenre = new Map();
  const add = (genre, type, strength) => {
    if (!genre) return;
    const previous = signalsByGenre.get(genre);
    if (!previous || strength > previous.strength) {
      signalsByGenre.set(genre, { genre, type, strength });
    }
  };
  if (sourcePrimary && sourcePrimary === candidatePrimary) {
    add(sourcePrimary, "same_primary", config.genreSignals.samePrimary);
  }
  if (sourcePrimary && sourcePrimary === candidateSecondary) {
    add(
      sourcePrimary,
      "primary_secondary_cross",
      config.genreSignals.primarySecondaryCrossMatch
    );
  }
  if (sourceSecondary && sourceSecondary === candidatePrimary) {
    add(
      sourceSecondary,
      "primary_secondary_cross",
      config.genreSignals.primarySecondaryCrossMatch
    );
  }
  if (sourceSecondary && sourceSecondary === candidateSecondary) {
    add(sourceSecondary, "same_secondary", config.genreSignals.sameSecondary);
  }
  const labels = new Map(
    [
      source.primaryGenre,
      source.secondaryGenre,
      candidate.primaryGenre,
      candidate.secondaryGenre
    ]
      .filter(Boolean)
      .map((genre) => [normalizeKey(genre), genre])
  );
  const signals = [...signalsByGenre.values()].sort(
    (left, right) =>
      right.strength - left.strength || left.genre.localeCompare(right.genre)
  );
  return {
    sharedPrimaryGenre:
      sourcePrimary && sourcePrimary === candidatePrimary
        ? labels.get(sourcePrimary) ?? source.primaryGenre
        : "",
    crossGenreMatches: signals
      .filter((signal) => signal.type === "primary_secondary_cross")
      .map((signal) => labels.get(signal.genre) ?? signal.genre),
    sharedSecondaryGenre:
      sourceSecondary && sourceSecondary === candidateSecondary
        ? labels.get(sourceSecondary) ?? source.secondaryGenre
        : "",
    genreSignals: signals.map((signal) => ({
      ...signal,
      genre: labels.get(signal.genre) ?? signal.genre
    })),
    genreSimilarityScore: round(
      clamp(
        Math.min(
          1,
          signals.reduce((sum, signal) => sum + signal.strength, 0)
        ) * config.weights.genres,
        0,
        config.weights.genres
      )
    )
  };
}

function classifySimilarity(topicResult, genreResult, totalScore, config) {
  const sharedCount = topicResult.sharedTopics.length;
  if (!sharedCount && genreResult.genreSimilarityScore > 0) return "genre_only";
  if (!sharedCount) return "low";
  const classes = config.similarityClasses;
  if (
    totalScore >= classes.veryHighMinimum &&
    sharedCount >= classes.veryHighMinimumSharedTopics &&
    topicResult.strongestAdjustedTopicContribution >=
      classes.veryHighMinimumAdjustedContribution
  ) {
    return "very_high";
  }
  const multiTopicHigh =
    sharedCount >= classes.highMinimumSharedTopics && totalScore >= classes.highMinimum;
  const strongest = topicResult.sharedTopicDetails[0];
  const specificCentralSingleHigh =
    sharedCount === 1 &&
    strongest.sourcePosition <= classes.singleTopicHighMaximumPosition &&
    strongest.candidatePosition <= classes.singleTopicHighMaximumPosition &&
    strongest.topicSpecificity >= classes.singleTopicHighMinimumSpecificity &&
    totalScore >= classes.highMinimum;
  if (multiTopicHigh || specificCentralSingleHigh) return "high";
  return totalScore >= classes.mediumMinimum ? "medium" : "low";
}

function isCredibleDisplayResult(topicResult, genreResult, totalScore, config) {
  if (!topicResult.sharedTopics.length) {
    return { credible: false, rule: "no_shared_topic" };
  }
  if (topicResult.sharedTopics.length >= 2) {
    return { credible: true, rule: "multiple_shared_topics" };
  }
  const strongest = topicResult.sharedTopicDetails[0];
  if (
    strongest.adjustedContribution >=
      config.credibleResultRules.minimumAdjustedCentrality &&
    strongest.topicSpecificity >= config.credibleResultRules.minimumTopicSpecificity
  ) {
    return { credible: true, rule: "specific_central_topic" };
  }
  if (
    genreResult.genreSimilarityScore >=
      config.credibleResultRules.meaningfulGenreMinimumScore &&
    totalScore >= config.credibleResultRules.singleTopicWithGenreMinimumScore
  ) {
    return { credible: true, rule: "single_topic_with_genre_support" };
  }
  return { credible: false, rule: "insufficient_topic_evidence" };
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
      (source.normalizedDisplayTitle &&
        source.normalizedDisplayTitle === candidate.normalizedDisplayTitle)
  );
}

function generateSimilarityReasons(topicResult, genreResult) {
  if (!topicResult.sharedTopics.length) {
    if (genreResult.sharedPrimaryGenre) {
      return [
        `De har samme primære genre, ${genreResult.sharedPrimaryGenre}, men ingen fælles emner.`
      ];
    }
    const genre =
      genreResult.crossGenreMatches[0] || genreResult.sharedSecondaryGenre;
    return genre
      ? [`De har genreoverlap i ${genre}, men ingen fælles emner.`]
      : [];
  }
  const strongest = topicResult.sharedTopicDetails[0];
  const central =
    strongest.sourcePosition <= 2 && strongest.candidatePosition <= 2;
  const reasons = [];
  if (topicResult.sharedTopics.length >= 2 && central) {
    reasons.push(
      `Begge dækker centralt ${topicResult.sharedTopics.slice(0, 2).join(" og ")}.`
    );
  } else if (topicResult.sharedTopics.length >= 2) {
    reasons.push(
      `De deler emnerne ${topicResult.sharedTopics.slice(0, 2).join(" og ")}.`
    );
  } else {
    reasons.push(
      `De deler ${topicResult.strongestSharedTopic}, men det er det eneste fælles emne.`
    );
  }
  if (topicResult.sharedTopics.length >= 2) {
    reasons.push(
      `Det stærkeste fælles emne er ${topicResult.strongestSharedTopic}.`
    );
  }
  return reasons;
}

function calculatePodcastSimilarity(source, candidate, specificityIndex, config) {
  const topicResult = calculateTopicSimilarity(
    source,
    candidate,
    specificityIndex,
    config
  );
  const genreResult = calculateGenreSimilarity(source, candidate, config);
  const contentSimilarityScore = round(
    clamp(
      topicResult.topicSimilarityScore + genreResult.genreSimilarityScore,
      0,
      100
    )
  );
  const credible = isCredibleDisplayResult(
    topicResult,
    genreResult,
    contentSimilarityScore,
    config
  );
  const sameMainSeries = Boolean(
    normalizeKey(source.mainSeries) &&
      normalizeKey(source.mainSeries) === normalizeKey(candidate.mainSeries)
  );
  const warnings = [];
  if (topicResult.sharedTopics.length === 1) warnings.push("single_shared_topic");
  if (
    topicResult.sharedTopics.length &&
    topicResult.strongestTopicSpecificity <=
      config.diagnostics.broadTopicSpecificityMaximum
  ) {
    warnings.push("broad_shared_topic");
  }
  if (
    topicResult.sharedTopicDetails.some(
      (detail) =>
        detail.sourcePosition >=
          config.diagnostics.peripheralTopicPositionMinimum ||
        detail.candidatePosition >=
          config.diagnostics.peripheralTopicPositionMinimum
    )
  ) {
    warnings.push("peripheral_shared_topic");
  }
  if (sameMainSeries) warnings.push("same_main_series");
  if (!candidate.image) warnings.push("missing_image");
  if (!candidate.link) warnings.push("missing_link");
  if (candidate.editorialScore === null) warnings.push("missing_editorial_rating");
  else if (candidate.editorialScore <= config.diagnostics.lowEditorialRatingMaximum) {
    warnings.push("low_editorial_rating");
  }
  if (possibleUnresolvedDuplicate(source, candidate)) {
    warnings.push("possible_unresolved_duplicate");
  }
  const candidateType =
    topicResult.sharedTopics.length && genreResult.genreSimilarityScore
      ? "topic_and_genre"
      : topicResult.sharedTopics.length
        ? "topic_only"
        : genreResult.genreSimilarityScore
          ? "genre_only"
          : "";
  return {
    recommendationId: candidate.recommendationId,
    existingId: candidate.existingId,
    title: candidate.title,
    normalizedDisplayTitle: candidate.normalizedDisplayTitle,
    publisher: candidate.publisher,
    mainSeries: candidate.mainSeries,
    primaryGenre: candidate.primaryGenre,
    secondaryGenre: candidate.secondaryGenre,
    topicsCanonical: candidate.topicsCanonical,
    editorialScore: candidate.editorialScore,
    image: candidate.image,
    link: candidate.link,
    contentSimilarityScore,
    topicSimilarityScore: topicResult.topicSimilarityScore,
    genreSimilarityScore: genreResult.genreSimilarityScore,
    similarityClass: classifySimilarity(
      topicResult,
      genreResult,
      contentSimilarityScore,
      config
    ),
    sharedTopics: topicResult.sharedTopics,
    sharedTopicKeys: topicResult.sharedTopicKeys,
    sharedTopicDetails: topicResult.sharedTopicDetails,
    strongestSharedTopic: topicResult.strongestSharedTopic,
    strongestSharedTopicCentrality: topicResult.strongestSharedTopicCentrality,
    strongestAdjustedTopicContribution:
      topicResult.strongestAdjustedTopicContribution,
    strongestTopicSpecificity: topicResult.strongestTopicSpecificity,
    supportingSharedTopics: topicResult.supportingSharedTopics,
    topicCoverageFactor: topicResult.topicCoverageFactor,
    sharedPrimaryGenre: genreResult.sharedPrimaryGenre,
    crossGenreMatches: genreResult.crossGenreMatches,
    sharedSecondaryGenre: genreResult.sharedSecondaryGenre,
    genreSignals: genreResult.genreSignals,
    candidateType,
    credibleForDisplay: credible.credible,
    credibleResultRule: credible.rule,
    sameMainSeries,
    identityDuplicateGroup: candidate.identityDuplicateGroup,
    similarityReasons: generateSimilarityReasons(topicResult, genreResult),
    similarityWarnings: warnings
  };
}

function compareRankedCandidates(left, right) {
  return (
    right.contentSimilarityScore - left.contentSimilarityScore ||
    right.sharedTopics.length - left.sharedTopics.length ||
    right.strongestAdjustedTopicContribution -
      left.strongestAdjustedTopicContribution ||
    right.strongestTopicSpecificity - left.strongestTopicSpecificity ||
    (right.editorialScore ?? -Infinity) - (left.editorialScore ?? -Infinity) ||
    left.recommendationId.localeCompare(right.recommendationId)
  );
}

function rankSimilarityCandidates(source, catalog, specificityIndex, config) {
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
    const similarity = calculatePodcastSimilarity(
      source,
      candidate,
      specificityIndex,
      config
    );
    if (eligible && similarity.contentSimilarityScore <= 0) {
      eligible = false;
      exclusionReason = "no_topic_or_genre_similarity";
    }
    diagnostics.push({
      ...similarity,
      eligible,
      exclusionReason,
      originalRank: null,
      auditRank: null,
      selected: false,
      diversifiedRank: null,
      diversityAction: ""
    });
  }
  const ranked = diagnostics.filter((candidate) => candidate.eligible).sort(compareRankedCandidates);
  ranked.forEach((candidate, index) => {
    candidate.originalRank = index + 1;
  });
  return { ranked, diagnostics };
}

function applyDisplayDiversity(rankedCandidates, config) {
  const credibleTopicCandidates = rankedCandidates.filter(
    (candidate) =>
      candidate.candidateType !== "genre_only" && candidate.credibleForDisplay
  );
  const selected = [];
  const titleCounts = new Map();
  const mainSeriesCounts = new Map();
  const publisherCounts = new Map();
  const duplicateTitleKeys = new Set(
    [...credibleTopicCandidates.reduce((map, candidate) => {
      map.set(
        candidate.normalizedDisplayTitle,
        (map.get(candidate.normalizedDisplayTitle) ?? 0) + 1
      );
      return map;
    }, new Map())].filter(([, count]) => count > 1).map(([key]) => key)
  );
  for (const candidate of credibleTopicCandidates) {
    if (selected.length >= config.candidateRules.displayLimit) break;
    const titleKey = candidate.normalizedDisplayTitle;
    if (
      titleKey &&
      (titleCounts.get(titleKey) ?? 0) >=
        config.diversity.maximumPerNormalizedDisplayTitle
    ) {
      candidate.diversityAction = "duplicate_display_title_removed";
      continue;
    }
    const seriesKey = normalizeKey(candidate.mainSeries);
    if (
      seriesKey &&
      (mainSeriesCounts.get(seriesKey) ?? 0) >=
        config.diversity.maximumPerMainSeries
    ) {
      candidate.diversityAction = "removed_main_series_limit";
      continue;
    }
    const publisherKey = normalizeKey(candidate.publisher);
    if (
      publisherKey &&
      (publisherCounts.get(publisherKey) ?? 0) >=
        config.diversity.maximumPerPublisherInDisplay
    ) {
      candidate.diversityAction = "removed_publisher_display_limit";
      continue;
    }
    selected.push(candidate);
    candidate.selected = true;
    candidate.diversifiedRank = selected.length;
    if (titleKey) titleCounts.set(titleKey, (titleCounts.get(titleKey) ?? 0) + 1);
    if (seriesKey) mainSeriesCounts.set(seriesKey, (mainSeriesCounts.get(seriesKey) ?? 0) + 1);
    if (publisherKey) {
      publisherCounts.set(publisherKey, (publisherCounts.get(publisherKey) ?? 0) + 1);
    }
    if (duplicateTitleKeys.has(titleKey)) {
      candidate.similarityWarnings = [
        ...new Set([
          ...candidate.similarityWarnings,
          "unresolved_same_title_candidates"
        ])
      ];
    }
  }
  return {
    selected,
    credibleCandidateCount: credibleTopicCandidates.length,
    duplicateTitleRemovalCount: rankedCandidates.filter(
      (candidate) => candidate.diversityAction === "duplicate_display_title_removed"
    ).length,
    mainSeriesRemovalCount: rankedCandidates.filter(
      (candidate) => candidate.diversityAction === "removed_main_series_limit"
    ).length,
    publisherRemovalCount: rankedCandidates.filter(
      (candidate) => candidate.diversityAction === "removed_publisher_display_limit"
    ).length
  };
}

function coverageStatus(count) {
  if (count >= 8) return "strong";
  if (count >= 3) return "usable";
  if (count >= 1) return "weak";
  return "none";
}

function serializeResult(candidate) {
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
    image: candidate.image,
    link: candidate.link,
    contentSimilarityScore: candidate.contentSimilarityScore,
    topicSimilarityScore: candidate.topicSimilarityScore,
    genreSimilarityScore: candidate.genreSimilarityScore,
    similarityClass: candidate.similarityClass,
    sharedTopics: candidate.sharedTopics,
    sharedTopicDetails: candidate.sharedTopicDetails,
    strongestSharedTopic: candidate.strongestSharedTopic,
    strongestSharedTopicCentrality: candidate.strongestSharedTopicCentrality,
    strongestAdjustedTopicContribution:
      candidate.strongestAdjustedTopicContribution,
    strongestTopicSpecificity: candidate.strongestTopicSpecificity,
    credibleForDisplay: candidate.credibleForDisplay,
    credibleResultRule: candidate.credibleResultRule,
    sameMainSeries: candidate.sameMainSeries,
    similarityReasons: candidate.similarityReasons,
    similarityWarnings: candidate.similarityWarnings,
    candidateType: candidate.candidateType,
    originalRank: candidate.originalRank,
    auditRank: candidate.auditRank,
    diversifiedRank: candidate.diversifiedRank
  };
}

function buildSimilarityResultsForPodcast(
  source,
  catalog,
  specificityIndex,
  config
) {
  const { ranked, diagnostics } = rankSimilarityCandidates(
    source,
    catalog,
    specificityIndex,
    config
  );
  const topicSupported = ranked.filter(
    (candidate) => candidate.candidateType !== "genre_only"
  );
  const genreOnly = ranked.filter(
    (candidate) => candidate.candidateType === "genre_only"
  );
  const auditResults = topicSupported.slice(0, config.candidateRules.auditResultLimit);
  auditResults.forEach((candidate, index) => {
    candidate.auditRank = index + 1;
  });
  const diversified = applyDisplayDiversity(topicSupported, config);
  const displayResults = diversified.selected;
  const status = coverageStatus(displayResults.length);
  const warnings = [];
  if (status === "weak") warnings.push("weak_visible_coverage");
  if (status === "none") warnings.push("no_visible_coverage");
  if (genreOnly.length) warnings.push("genre_only_candidates_excluded_from_selection");
  if (diversified.duplicateTitleRemovalCount) {
    warnings.push("unresolved_same_title_candidates");
  }
  return {
    recommendationId: source.recommendationId,
    title: source.title,
    primaryGenre: source.primaryGenre,
    topicsCanonical: source.topicsCanonical,
    topicSupportedResultCount: topicSupported.length,
    genreOnlyCandidateCount: genreOnly.length,
    credibleCandidateCount: diversified.credibleCandidateCount,
    credibleDisplayResultCount: displayResults.length,
    displayCoverageStatus: status,
    duplicateTitleRemovalCount: diversified.duplicateTitleRemovalCount,
    mainSeriesRemovalCount: diversified.mainSeriesRemovalCount,
    publisherRemovalCount: diversified.publisherRemovalCount,
    auditResults: auditResults.map(serializeResult),
    displayResults: displayResults.map(serializeResult),
    selectedResults: displayResults.map(serializeResult),
    warnings,
    candidateDiagnostics: diagnostics
  };
}

function buildSimilarityResultsForCatalog(catalog, config) {
  validateSimilarityConfig(config);
  const sortedCatalog = [...catalog].sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId)
  );
  const specificityIndex = buildTopicSpecificityIndex(sortedCatalog, config);
  const results = {};
  for (const source of sortedCatalog) {
    const built = buildSimilarityResultsForPodcast(
      source,
      sortedCatalog,
      specificityIndex,
      config
    );
    const { candidateDiagnostics: _candidateDiagnostics, ...serializable } = built;
    results[source.recommendationId] = serializable;
  }
  return {
    version: config.version,
    sourceCount: sortedCatalog.length,
    topicSpecificity: Object.fromEntries(
      [...specificityIndex.topics.entries()].map(([key, value]) => [key, value])
    ),
    results
  };
}

export {
  applyDisplayDiversity,
  buildSimilarityCatalog,
  buildSimilarityResultsForCatalog,
  buildSimilarityResultsForPodcast,
  buildTopicSpecificityIndex,
  calculateGenreSimilarity,
  calculatePodcastSimilarity,
  calculateTopicSimilarity,
  classifySimilarity,
  compareRankedCandidates,
  coverageStatus,
  generateSimilarityReasons,
  isCredibleDisplayResult,
  normalizeDisplayTitle,
  rankSimilarityCandidates,
  validateSimilarityConfig
};
