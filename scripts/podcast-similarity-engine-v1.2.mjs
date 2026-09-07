import {
  buildSimilarityCatalog as buildV11Catalog,
  buildSimilarityResultsForPodcast as buildV11ResultsForPodcast,
  buildTopicSpecificityIndex,
  calculatePodcastSimilarity,
  normalizeDisplayTitle,
  validateSimilarityConfig as validateV11Config
} from "./podcast-similarity-engine-v1.1.mjs";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function normalizeStructuralIdentity(value) {
  return text(value)
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("da-DK");
}

function rowsFrom(payload, label) {
  const rows = Array.isArray(payload) ? payload : payload?.rows;
  if (!Array.isArray(rows)) throw new Error(`${label} must contain a rows array.`);
  return rows;
}

function finiteNumber(value, path, { minimum = -Infinity, maximum = Infinity } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(
      `Invalid similarity v1.2 config: ${path} must be between ${minimum} and ${maximum}.`
    );
  }
}

function positiveInteger(value, path) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid similarity v1.2 config: ${path} must be a positive integer.`);
  }
}

function validateStructuralConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Invalid similarity v1.2 config: expected an object.");
  }
  finiteNumber(config.version, "version", { minimum: 1.2 });
  finiteNumber(config.contentEngineVersion, "contentEngineVersion", {
    minimum: 1.1,
    maximum: 1.1
  });
  const support = config.relationshipSupport ?? {};
  finiteNumber(support.maximum, "relationshipSupport.maximum", { minimum: 1 });
  for (const key of ["sameMainSeries", "exactHost", "samePublisher"]) {
    finiteNumber(support[key], `relationshipSupport.${key}`, {
      minimum: 0,
      maximum: support.maximum
    });
  }
  if (!(support.sameMainSeries > support.exactHost && support.exactHost > support.samePublisher)) {
    throw new Error(
      "Invalid similarity v1.2 config: main-series, host and publisher support must descend."
    );
  }
  const selection = config.selection ?? {};
  positiveInteger(selection.displayLimit, "selection.displayLimit");
  positiveInteger(
    selection.structuralActivationBelowTierACount,
    "selection.structuralActivationBelowTierACount"
  );
  positiveInteger(
    selection.maximumTotalResultsWithStructuralSupport,
    "selection.maximumTotalResultsWithStructuralSupport"
  );
  if (
    selection.maximumTotalResultsWithStructuralSupport >
      selection.structuralActivationBelowTierACount ||
    selection.maximumTotalResultsWithStructuralSupport > selection.displayLimit
  ) {
    throw new Error(
      "Invalid similarity v1.2 config: structural selection caps are inconsistent."
    );
  }
  for (const key of [
    "tierASelectionRankBase",
    "sameMainSeriesSelectionRankBase",
    "sameHostSelectionRankBase"
  ]) {
    finiteNumber(selection[key], `selection.${key}`, { minimum: 0 });
  }
  if (
    !(
      selection.tierASelectionRankBase >
        selection.sameMainSeriesSelectionRankBase &&
      selection.sameMainSeriesSelectionRankBase >
        selection.sameHostSelectionRankBase
    )
  ) {
    throw new Error("Invalid similarity v1.2 config: selection tier bases must descend.");
  }
  const diversity = config.diversity ?? {};
  for (const key of [
    "maximumPerNormalizedDisplayTitle",
    "maximumPerMainSeries",
    "maximumPerPublisher",
    "maximumSameMainSeriesSupplements",
    "maximumPerSharedHost"
  ]) {
    positiveInteger(diversity[key], `diversity.${key}`);
  }
  return config;
}

function buildStructuralCatalog(metadataPayload, podcastPayload) {
  const baseCatalog = buildV11Catalog(metadataPayload, podcastPayload);
  const podcastRows = rowsFrom(podcastPayload, "Podcast data");
  return baseCatalog.map((podcast) => {
    const source = podcastRows[podcast.displayRowIndex] ?? {};
    const host = text(source["Vært"] ?? source.Vaert);
    const publisher = text(source.Udgiver);
    const structuralMainSeries = text(
      source.Hovedserie ?? source["Hoved serie"] ?? source.mainSeries
    );
    return {
      ...podcast,
      host,
      normalizedHost: normalizeStructuralIdentity(host),
      publisher,
      normalizedPublisher: normalizeStructuralIdentity(publisher),
      structuralMainSeries,
      normalizedStructuralMainSeries: normalizeStructuralIdentity(structuralMainSeries),
      metadataMainSeries: podcast.mainSeries
    };
  });
}

function calculateRelationshipSupport(source, candidate, structuralConfig) {
  validateStructuralConfig(structuralConfig);
  const sameMainSeries = Boolean(
    source.normalizedStructuralMainSeries &&
      source.normalizedStructuralMainSeries === candidate.normalizedStructuralMainSeries
  );
  const sameHost = Boolean(
    source.normalizedHost && source.normalizedHost === candidate.normalizedHost
  );
  const samePublisher = Boolean(
    source.normalizedPublisher &&
      source.normalizedPublisher === candidate.normalizedPublisher
  );
  const mainSeriesSupport = sameMainSeries
    ? structuralConfig.relationshipSupport.sameMainSeries
    : 0;
  const hostSupport = sameHost ? structuralConfig.relationshipSupport.exactHost : 0;
  const publisherSupport = samePublisher
    ? structuralConfig.relationshipSupport.samePublisher
    : 0;
  const relationshipSupportScore = Math.min(
    structuralConfig.relationshipSupport.maximum,
    mainSeriesSupport + hostSupport + publisherSupport
  );
  const relationshipReasons = [];
  if (sameMainSeries) relationshipReasons.push("Fra samme hovedserie");
  if (sameHost) relationshipReasons.push("Samme vært");
  if (samePublisher && (sameMainSeries || sameHost)) {
    relationshipReasons.push("Samme udgiver");
  }
  const relationshipWarnings = [];
  if (sameMainSeries) relationshipWarnings.push("same_main_series");
  if (sameHost) relationshipWarnings.push("same_host");
  if (samePublisher && !sameMainSeries && !sameHost) {
    relationshipWarnings.push("publisher_support_only");
  }
  return {
    sameMainSeries,
    sharedHosts: sameHost ? [source.host] : [],
    normalizedSharedHost: sameHost ? source.normalizedHost : "",
    samePublisher,
    mainSeriesSupport,
    hostSupport,
    publisherSupport,
    relationshipSupportScore,
    relationshipReasons,
    relationshipWarnings
  };
}

function hasHostContentCompatibility(contentResult) {
  return Boolean(
    contentResult.sharedTopics.length ||
      contentResult.genreSignals.some((signal) =>
        ["same_primary", "primary_secondary_cross"].includes(signal.type)
      )
  );
}

function classifyStructuralEligibility(contentResult, relationship) {
  if (relationship.sameMainSeries) {
    return { eligible: true, rule: "same_main_series" };
  }
  if (relationship.sharedHosts.length && hasHostContentCompatibility(contentResult)) {
    return { eligible: true, rule: "same_host_supported" };
  }
  return {
    eligible: false,
    rule: relationship.samePublisher
      ? "publisher_alone_not_eligible"
      : relationship.sharedHosts.length
        ? "same_host_without_content_compatibility"
        : "no_structural_qualifier"
  };
}

function tierACandidateType(contentResult, relationship) {
  if (relationship.sameMainSeries) return "topic_and_main_series";
  if (relationship.sharedHosts.length) return "topic_and_host";
  return "topic_supported";
}

function tierBComparator(left, right) {
  const leftMain = left.structuralEligibilityRule === "same_main_series" ? 1 : 0;
  const rightMain = right.structuralEligibilityRule === "same_main_series" ? 1 : 0;
  return (
    rightMain - leftMain ||
    right.relationshipSupportScore - left.relationshipSupportScore ||
    right.contentSimilarityScore - left.contentSimilarityScore ||
    right.genreSimilarityScore - left.genreSimilarityScore ||
    (right.editorialScore ?? -Infinity) - (left.editorialScore ?? -Infinity) ||
    left.recommendationId.localeCompare(right.recommendationId)
  );
}

function selectionRankScore(candidate, structuralConfig) {
  if (candidate.selectionTier === "A") {
    return (
      structuralConfig.selection.tierASelectionRankBase +
      candidate.contentSimilarityScore
    );
  }
  const base =
    candidate.structuralEligibilityRule === "same_main_series"
      ? structuralConfig.selection.sameMainSeriesSelectionRankBase
      : structuralConfig.selection.sameHostSelectionRankBase;
  return Number(
    (
      base +
      candidate.relationshipSupportScore +
      candidate.contentSimilarityScore / 100
    ).toFixed(6)
  );
}

function enrichCandidate(
  source,
  candidate,
  contentResult,
  structuralConfig,
  { selectionTier = "", structuralEligibilityRule = "" } = {}
) {
  const relationship = calculateRelationshipSupport(
    source,
    candidate,
    structuralConfig
  );
  const candidateType =
    selectionTier === "A"
      ? tierACandidateType(contentResult, relationship)
      : structuralEligibilityRule;
  const warnings = [...contentResult.similarityWarnings];
  if (selectionTier === "B") {
    warnings.push("structural_supplement");
    if (!contentResult.sharedTopics.length) warnings.push("no_shared_topic");
    if (contentResult.contentSimilarityScore < 35) warnings.push("weak_content_overlap");
  }
  const relationshipReasons =
    relationship.sharedHosts.length &&
    !contentResult.sharedTopics.length &&
    hasHostContentCompatibility(contentResult)
      ? [
          "Samme vært og beslægtet genre",
          ...(relationship.samePublisher ? ["Samme udgiver"] : [])
        ]
      : relationship.relationshipReasons;
  return {
    ...contentResult,
    host: candidate.host,
    publisher: candidate.publisher,
    mainSeries: candidate.structuralMainSeries,
    metadataMainSeries: candidate.metadataMainSeries,
    sameMainSeries: relationship.sameMainSeries,
    sharedHosts: relationship.sharedHosts,
    samePublisher: relationship.samePublisher,
    mainSeriesSupport: relationship.mainSeriesSupport,
    hostSupport: relationship.hostSupport,
    publisherSupport: relationship.publisherSupport,
    relationshipSupportScore: relationship.relationshipSupportScore,
    relationshipReasons,
    relationshipWarnings: relationship.relationshipWarnings,
    selectionTier,
    structuralEligibilityRule,
    candidateType,
    selectionRankScore: 0,
    similarityWarnings: [...new Set(warnings)],
    selectionReason:
      selectionTier === "A"
        ? "credible_v1.1_content_result"
        : structuralEligibilityRule
  };
}

function buildSimilarityResultsForPodcastV12(
  source,
  catalog,
  specificityIndex,
  v11Config,
  structuralConfig,
  { includeDiagnostics = false } = {}
) {
  validateV11Config(v11Config);
  validateStructuralConfig(structuralConfig);
  const v11 = buildV11ResultsForPodcast(
    source,
    catalog,
    specificityIndex,
    v11Config
  );
  const byId = new Map(catalog.map((candidate) => [candidate.recommendationId, candidate]));
  const diagnosticById = new Map(
    v11.candidateDiagnostics.map((candidate) => [candidate.recommendationId, candidate])
  );
  const tierA = v11.displayResults.map((contentResult) => {
    const candidate = byId.get(contentResult.recommendationId);
    const enriched = enrichCandidate(
      source,
      candidate,
      contentResult,
      structuralConfig,
      { selectionTier: "A" }
    );
    enriched.selectionRankScore = selectionRankScore(enriched, structuralConfig);
    return enriched;
  });

  const structuralCandidates = [];
  const diagnostics = [];
  for (const candidate of catalog) {
    const baseDiagnostic = diagnosticById.get(candidate.recommendationId);
    if (!baseDiagnostic) continue;
    const relationship = calculateRelationshipSupport(
      source,
      candidate,
      structuralConfig
    );
    const structuralEligibility = classifyStructuralEligibility(
      baseDiagnostic,
      relationship
    );
    const alreadyTierA = tierA.some(
      (selected) => selected.recommendationId === candidate.recommendationId
    );
    const hardExcluded = ["source_podcast", "safe_identity_duplicate"].includes(
      baseDiagnostic.exclusionReason
    );
    const eligible = Boolean(
      !hardExcluded &&
        !alreadyTierA &&
        structuralEligibility.eligible
    );
    let enriched = null;
    if (eligible) {
      enriched = enrichCandidate(
        source,
        candidate,
        baseDiagnostic,
        structuralConfig,
        {
          selectionTier: "B",
          structuralEligibilityRule: structuralEligibility.rule
        }
      );
      enriched.selectionRankScore = selectionRankScore(enriched, structuralConfig);
      structuralCandidates.push(enriched);
    }
    if (includeDiagnostics) {
      diagnostics.push({
        recommendationId: candidate.recommendationId,
        title: candidate.title,
        host: candidate.host,
        publisher: candidate.publisher,
        mainSeries: candidate.structuralMainSeries,
        metadataMainSeries: candidate.metadataMainSeries,
        baseEligible: baseDiagnostic.eligible,
        baseExclusionReason: baseDiagnostic.exclusionReason,
        credibleTierA: baseDiagnostic.credibleForDisplay,
        selectedTierA: alreadyTierA,
        contentSimilarityScore: baseDiagnostic.contentSimilarityScore,
        topicSimilarityScore: baseDiagnostic.topicSimilarityScore,
        genreSimilarityScore: baseDiagnostic.genreSimilarityScore,
        sharedTopics: baseDiagnostic.sharedTopics,
        relationshipSupportScore: relationship.relationshipSupportScore,
        sameMainSeries: relationship.sameMainSeries,
        sharedHosts: relationship.sharedHosts,
        samePublisher: relationship.samePublisher,
        structuralEligible: eligible,
        structuralEligibilityRule: structuralEligibility.rule,
        structuralSelected: false,
        diversityAction: ""
      });
    }
  }
  structuralCandidates.sort(tierBComparator);

  const selected = [...tierA];
  const selectedIds = new Set(selected.map((candidate) => candidate.recommendationId));
  const titleCounts = new Map();
  const mainSeriesCounts = new Map();
  const publisherCounts = new Map();
  const selectedHostSupplements = new Map();
  let selectedSameMainSeriesSupplements = 0;
  for (const candidate of selected) {
    const raw = byId.get(candidate.recommendationId);
    const titleKey = normalizeDisplayTitle(candidate.title);
    const seriesKey = raw.normalizedStructuralMainSeries;
    const publisherKey = raw.normalizedPublisher;
    if (titleKey) titleCounts.set(titleKey, (titleCounts.get(titleKey) ?? 0) + 1);
    if (seriesKey) mainSeriesCounts.set(seriesKey, (mainSeriesCounts.get(seriesKey) ?? 0) + 1);
    if (publisherKey) publisherCounts.set(publisherKey, (publisherCounts.get(publisherKey) ?? 0) + 1);
  }

  if (
    tierA.length <
    structuralConfig.selection.structuralActivationBelowTierACount
  ) {
    for (const candidate of structuralCandidates) {
      if (
        selected.length >=
        structuralConfig.selection.maximumTotalResultsWithStructuralSupport
      ) {
        break;
      }
      const raw = byId.get(candidate.recommendationId);
      const titleKey = normalizeDisplayTitle(candidate.title);
      const seriesKey = raw.normalizedStructuralMainSeries;
      const publisherKey = raw.normalizedPublisher;
      const hostKey = candidate.sharedHosts.length ? raw.normalizedHost : "";
      let diversityAction = "";
      if (
        titleKey &&
        (titleCounts.get(titleKey) ?? 0) >=
          structuralConfig.diversity.maximumPerNormalizedDisplayTitle
      ) {
        diversityAction = "duplicate_display_title_removed";
      } else if (
        seriesKey &&
        (mainSeriesCounts.get(seriesKey) ?? 0) >=
          structuralConfig.diversity.maximumPerMainSeries
      ) {
        diversityAction = "removed_main_series_limit";
      } else if (
        publisherKey &&
        (publisherCounts.get(publisherKey) ?? 0) >=
          structuralConfig.diversity.maximumPerPublisher
      ) {
        diversityAction = "removed_publisher_limit";
      } else if (
        candidate.structuralEligibilityRule === "same_main_series" &&
        selectedSameMainSeriesSupplements >=
          structuralConfig.diversity.maximumSameMainSeriesSupplements
      ) {
        diversityAction = "removed_same_main_series_supplement_limit";
      } else if (
        candidate.structuralEligibilityRule === "same_host_supported" &&
        hostKey &&
        (selectedHostSupplements.get(hostKey) ?? 0) >=
          structuralConfig.diversity.maximumPerSharedHost
      ) {
        diversityAction = "removed_shared_host_limit";
      }
      if (diversityAction) {
        const diagnostic = diagnostics.find(
          (row) => row.recommendationId === candidate.recommendationId
        );
        if (diagnostic) diagnostic.diversityAction = diversityAction;
        continue;
      }
      selected.push(candidate);
      selectedIds.add(candidate.recommendationId);
      candidate.diversifiedRank = selected.length;
      if (titleKey) titleCounts.set(titleKey, (titleCounts.get(titleKey) ?? 0) + 1);
      if (seriesKey) mainSeriesCounts.set(seriesKey, (mainSeriesCounts.get(seriesKey) ?? 0) + 1);
      if (publisherKey) publisherCounts.set(publisherKey, (publisherCounts.get(publisherKey) ?? 0) + 1);
      if (candidate.structuralEligibilityRule === "same_main_series") {
        selectedSameMainSeriesSupplements += 1;
      }
      if (candidate.structuralEligibilityRule === "same_host_supported" && hostKey) {
        selectedHostSupplements.set(
          hostKey,
          (selectedHostSupplements.get(hostKey) ?? 0) + 1
        );
      }
      const diagnostic = diagnostics.find(
        (row) => row.recommendationId === candidate.recommendationId
      );
      if (diagnostic) diagnostic.structuralSelected = true;
    }
  }

  selected.forEach((candidate, index) => {
    candidate.diversifiedRank = index + 1;
  });
  const structuralSelected = selected.filter((candidate) => candidate.selectionTier === "B");
  const coverageBefore = v11.displayCoverageStatus;
  const coverageAfter =
    selected.length >= 8
      ? "strong"
      : selected.length >= 3
        ? "usable"
        : selected.length >= 1
          ? "weak"
          : "none";
  const warnings = [...v11.warnings];
  if (structuralSelected.length) warnings.push("structural_supplements_selected");
  if (selected.length < 3) warnings.push("fewer_than_three_display_results");
  return {
    recommendationId: source.recommendationId,
    title: source.title,
    host: source.host,
    publisher: source.publisher,
    mainSeries: source.structuralMainSeries,
    metadataMainSeries: source.metadataMainSeries,
    credibleTierACount: v11.credibleDisplayResultCount,
    structuralSupplementCandidateCount: structuralCandidates.length,
    selectedTierACount: tierA.length,
    selectedStructuralSupplementCount: structuralSelected.length,
    selectedMainSeriesSupplementCount: structuralSelected.filter(
      (candidate) => candidate.candidateType === "same_main_series"
    ).length,
    selectedHostSupplementCount: structuralSelected.filter(
      (candidate) => candidate.candidateType === "same_host_supported"
    ).length,
    publisherSupportSelectedCount: selected.filter(
      (candidate) => candidate.publisherSupport > 0
    ).length,
    displayResultCount: selected.length,
    displayCoverageBeforeStructuralSupport: coverageBefore,
    displayCoverageAfterStructuralSupport: coverageAfter,
    displayResults: selected,
    selectedResults: selected,
    sourceWarnings: [...new Set(warnings)],
    candidateDiagnostics: includeDiagnostics ? diagnostics : undefined
  };
}

function buildSimilarityResultsForCatalogV12(
  catalog,
  v11Config,
  structuralConfig
) {
  validateV11Config(v11Config);
  validateStructuralConfig(structuralConfig);
  const sortedCatalog = [...catalog].sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId)
  );
  const specificityIndex = buildTopicSpecificityIndex(sortedCatalog, v11Config);
  const results = {};
  for (const source of sortedCatalog) {
    const built = buildSimilarityResultsForPodcastV12(
      source,
      sortedCatalog,
      specificityIndex,
      v11Config,
      structuralConfig
    );
    const { candidateDiagnostics: _diagnostics, ...serializable } = built;
    results[source.recommendationId] = serializable;
  }
  return {
    version: structuralConfig.version,
    contentEngineVersion: structuralConfig.contentEngineVersion,
    sourceCount: sortedCatalog.length,
    results
  };
}

export {
  buildSimilarityResultsForCatalogV12,
  buildSimilarityResultsForPodcastV12,
  buildStructuralCatalog,
  calculateRelationshipSupport,
  classifyStructuralEligibility,
  hasHostContentCompatibility,
  normalizeStructuralIdentity,
  selectionRankScore,
  tierBComparator,
  validateStructuralConfig
};
