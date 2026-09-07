import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { REPRESENTATIVE_SEED_TITLES } from "./build-podcast-similarity-prototype.mjs";
import {
  buildTopicSpecificityIndex,
  calculatePodcastSimilarity,
  normalizeDisplayTitle,
  validateSimilarityConfig
} from "./podcast-similarity-engine-v1.1.mjs";
import {
  buildStructuralCatalog,
  normalizeStructuralIdentity
} from "./podcast-similarity-engine-v1.2.mjs";
import { resolveSupplementarySimilarities } from "./manual-similarity-supplements.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function writeUtf8(filePath, content, bom = false) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${bom ? "\uFEFF" : ""}${content}`, "utf8");
}

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function rowsFrom(payload, label) {
  const rows = Array.isArray(payload) ? payload : payload?.rows;
  if (!Array.isArray(rows)) throw new Error(`${label} must contain a rows array.`);
  return rows;
}

function csvCell(value) {
  const raw = Array.isArray(value)
    ? value.join(" | ")
    : value === null || value === undefined
      ? ""
      : String(value);
  return /[;"\r\n]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

function csvText(headers, rows) {
  return [
    headers.map(csvCell).join(";"),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(";"))
  ].join("\r\n") + "\r\n";
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid product v1.3 config: ${label} must be a positive integer.`);
  }
}

function validateProductConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Invalid product v1.3 config: expected an object.");
  }
  if (config.version !== 1.3 || config.contentSourceVersion !== 1.1) {
    throw new Error("Invalid product v1.3 config: versions must be 1.3 and 1.1.");
  }
  positiveInteger(config.similarResults?.minimumToShow, "similarResults.minimumToShow");
  positiveInteger(config.similarResults?.maximumResults, "similarResults.maximumResults");
  positiveInteger(
    config.sameSeriesResults?.minimumToShow,
    "sameSeriesResults.minimumToShow"
  );
  positiveInteger(
    config.sameSeriesResults?.maximumResults,
    "sameSeriesResults.maximumResults"
  );
  if (
    config.similarResults.minimumToShow > config.similarResults.maximumResults ||
    config.sameSeriesResults.minimumToShow > config.sameSeriesResults.maximumResults
  ) {
    throw new Error("Invalid product v1.3 config: minimums may not exceed maximums.");
  }
  if (!Array.isArray(config.authoritativeMainSeries?.sourceFields)) {
    throw new Error(
      "Invalid product v1.3 config: authoritativeMainSeries.sourceFields must be an array."
    );
  }
  if (!Array.isArray(config.authoritativeMainSeries?.placeholderValues)) {
    throw new Error(
      "Invalid product v1.3 config: authoritativeMainSeries.placeholderValues must be an array."
    );
  }
  return config;
}

function normalizeAuthoritativeMainSeries(value, config) {
  const normalized = normalizeStructuralIdentity(value);
  const placeholders = new Set(
    config.authoritativeMainSeries.placeholderValues.map(normalizeStructuralIdentity)
  );
  return placeholders.has(normalized) ? "" : normalized;
}

function getAuthoritativeMainSeries(sourceRow, config) {
  for (const field of config.authoritativeMainSeries.sourceFields) {
    const value = text(sourceRow?.[field]);
    if (value) {
      return {
        value,
        normalized: normalizeAuthoritativeMainSeries(value, config)
      };
    }
  }
  return { value: "", normalized: "" };
}

function buildProductCatalog(metadataPayload, podcastPayload, config) {
  validateProductConfig(config);
  const metadataRows = rowsFrom(metadataPayload, "Recommendation metadata");
  const podcastRows = rowsFrom(podcastPayload, "Podcast data");
  if (metadataRows.length !== podcastRows.length) {
    throw new Error(
      `Unsafe product join: metadata has ${metadataRows.length} rows and podcast data has ${podcastRows.length}.`
    );
  }
  const catalog = buildStructuralCatalog(metadataPayload, podcastPayload);
  const recommendationIds = new Set();
  const podcastIds = new Set();
  for (const item of catalog) {
    const sourceRow = podcastRows[item.displayRowIndex];
    const metadataRow = metadataRows[item.displayRowIndex];
    if (!sourceRow || !metadataRow) {
      throw new Error(`Unsafe product join: missing row for ${item.recommendationId}.`);
    }
    if (
      text(sourceRow.Titel) !== text(metadataRow.title) ||
      metadataRow.recommendationId !== item.recommendationId
    ) {
      throw new Error(
        `Unsafe product join at row ${item.displayRowIndex}: title or recommendationId mismatch.`
      );
    }
    if (recommendationIds.has(item.recommendationId)) {
      throw new Error(`Duplicate recommendationId ${item.recommendationId}.`);
    }
    recommendationIds.add(item.recommendationId);
    const podcastId = text(sourceRow["Podcast-ID"]);
    if (!podcastId) {
      throw new Error(`Unsafe product join: missing Podcast-ID for ${item.recommendationId}.`);
    }
    if (podcastIds.has(podcastId)) {
      throw new Error(`Duplicate Podcast-ID ${podcastId}.`);
    }
    podcastIds.add(podcastId);
    item.existingId = podcastId;
    const mainSeries = getAuthoritativeMainSeries(sourceRow, config);
    item.authoritativeMainSeries = mainSeries.value;
    item.normalizedAuthoritativeMainSeries = mainSeries.normalized;
    item.sourceLink = text(sourceRow.Link);
    item.sourceTitle = text(sourceRow.Titel);
    item.supplementarySimilaritiesRaw = text(sourceRow.supplementarySimilaritiesRaw);
    item.supplementarySimilarities = Array.isArray(sourceRow.supplementarySimilarities)
      ? sourceRow.supplementarySimilarities
      : [];
  }
  return catalog.sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId)
  );
}

function isSafePair(source, candidate) {
  return Boolean(
    candidate &&
      source.recommendationId !== candidate.recommendationId &&
      !(
        source.identityDuplicateGroup &&
        source.identityDuplicateGroup === candidate.identityDuplicateGroup
      ) &&
      normalizeDisplayTitle(source.title) !== normalizeDisplayTitle(candidate.title)
  );
}

function danishSharedTopicReason(sharedTopics) {
  const topics = (sharedTopics || []).map(text).filter(Boolean);
  if (topics.length === 1) return `Fælles emne: ${topics[0]}`;
  if (topics.length === 2) return `Fælles emner: ${topics[0]} og ${topics[1]}`;
  if (topics.length >= 3) {
    return `Fælles emner: ${topics[0]}, ${topics[1]} m.fl.`;
  }
  return "";
}

function packageProductCandidate(candidate, reason, candidateType) {
  return {
    recommendationId: candidate.recommendationId,
    existingId: candidate.existingId,
    title: candidate.title,
    publisher: candidate.publisher,
    authoritativeMainSeries: candidate.authoritativeMainSeries ?? "",
    primaryGenre: candidate.primaryGenre,
    secondaryGenre: candidate.secondaryGenre,
    topicsCanonical: candidate.topicsCanonical,
    editorialScore: candidate.editorialScore,
    image: candidate.image,
    link: candidate.link,
    contentSimilarityScore: candidate.contentSimilarityScore ?? 0,
    topicSimilarityScore: candidate.topicSimilarityScore ?? 0,
    genreSimilarityScore: candidate.genreSimilarityScore ?? 0,
    sharedTopics: candidate.sharedTopics ?? [],
    similarityReason: reason,
    candidateType
  };
}

function combineProductSimilarResults(
  source,
  manualSupplementaryResults,
  automaticSimilarResults,
  maximumResults
) {
  const combinedSimilarResults = [];
  const seenCombinedIds = new Set();
  const seenCombinedTitles = new Set();
  for (const candidate of [...automaticSimilarResults, ...manualSupplementaryResults]) {
    const titleKey = normalizeDisplayTitle(candidate.title);
    if (
      combinedSimilarResults.length >= maximumResults ||
      candidate.recommendationId === source.recommendationId ||
      seenCombinedIds.has(candidate.recommendationId) ||
      seenCombinedTitles.has(titleKey)
    ) {
      continue;
    }
    seenCombinedIds.add(candidate.recommendationId);
    seenCombinedTitles.add(titleKey);
    combinedSimilarResults.push(candidate);
  }
  return combinedSimilarResults;
}

function compareSameSeries(left, right) {
  return (
    right.contentSimilarityScore - left.contentSimilarityScore ||
    right.sharedTopics.length - left.sharedTopics.length ||
    (right.editorialScore ?? -Infinity) - (left.editorialScore ?? -Infinity) ||
    left.recommendationId.localeCompare(right.recommendationId)
  );
}

function buildProductResultForSource(
  source,
  catalog,
  catalogById,
  v11Source,
  specificityIndex,
  v11Config,
  productConfig,
  manualResolution = { resolved: [], audit: [] }
) {
  if (!v11Source || v11Source.recommendationId !== source.recommendationId) {
    throw new Error(`Missing v1.1 source result for ${source.recommendationId}.`);
  }

  const automaticSimilarResults = [];
  const seenSimilarTitles = new Set();
  const separatedSameSeriesIds = new Set();
  for (const existing of v11Source.displayResults || []) {
    if (automaticSimilarResults.length >= productConfig.similarResults.maximumResults) break;
    if (existing.candidateType === "genre_only" || !existing.credibleForDisplay) continue;
    const candidate = catalogById.get(existing.recommendationId);
    if (!isSafePair(source, candidate)) continue;
    const sameSeries = Boolean(
      source.normalizedAuthoritativeMainSeries &&
        source.normalizedAuthoritativeMainSeries ===
          candidate.normalizedAuthoritativeMainSeries
    );
    if (sameSeries) {
      separatedSameSeriesIds.add(candidate.recommendationId);
      continue;
    }
    const normalizedTitle = normalizeDisplayTitle(candidate.title);
    if (seenSimilarTitles.has(normalizedTitle)) continue;
    seenSimilarTitles.add(normalizedTitle);
    automaticSimilarResults.push(
      packageProductCandidate(
        { ...existing, ...candidate },
        danishSharedTopicReason(existing.sharedTopics),
        "content_similarity"
      )
    );
  }

  const sameSeriesCandidates = source.normalizedAuthoritativeMainSeries
    ? catalog.filter(
        (candidate) =>
          isSafePair(source, candidate) &&
          candidate.normalizedAuthoritativeMainSeries ===
            source.normalizedAuthoritativeMainSeries
      )
    : [];
  const scoredSameSeries = sameSeriesCandidates.map((candidate) => {
    const content = calculatePodcastSimilarity(
      source,
      candidate,
      specificityIndex,
      v11Config
    );
    return {
      ...candidate,
      ...content,
      candidateType: "same_series"
    };
  });
  scoredSameSeries.sort(compareSameSeries);

  let sameSeriesResults = [];
  const seenSeriesTitles = new Set();
  for (const candidate of scoredSameSeries) {
    if (sameSeriesResults.length >= productConfig.sameSeriesResults.maximumResults) break;
    const normalizedTitle = normalizeDisplayTitle(candidate.title);
    if (seenSeriesTitles.has(normalizedTitle)) continue;
    seenSeriesTitles.add(normalizedTitle);
    sameSeriesResults.push(
      packageProductCandidate(candidate, "Fra samme serie", "same_series")
    );
  }

  const manualSupplementaryResults = manualResolution.resolved.map(({ candidate }) =>
    packageProductCandidate(candidate, "", "manual_supplementary")
  );
  const automaticIds = new Set(
    [...automaticSimilarResults, ...sameSeriesResults].map(
      (candidate) => candidate.recommendationId
    )
  );
  const automaticTitles = new Set(
    [...automaticSimilarResults, ...sameSeriesResults].map((candidate) =>
      normalizeDisplayTitle(candidate.title)
    )
  );
  for (const manual of manualResolution.resolved) {
    manual.audit.presentInAutomatic =
      automaticIds.has(manual.candidate.recommendationId) ||
      automaticTitles.has(normalizeDisplayTitle(manual.candidate.title));
  }

  const combinedSimilarResults = combineProductSimilarResults(
    source,
    manualSupplementaryResults,
    automaticSimilarResults,
    productConfig.similarResults.maximumResults
  );

  const combinedIds = new Set(
    combinedSimilarResults.map((candidate) => candidate.recommendationId)
  );
  const combinedTitles = new Set(
    combinedSimilarResults.map((candidate) => normalizeDisplayTitle(candidate.title))
  );
  sameSeriesResults = sameSeriesResults.filter(
    (candidate) =>
      !combinedIds.has(candidate.recommendationId) &&
      !combinedTitles.has(normalizeDisplayTitle(candidate.title))
  );

  const similarIds = new Set(
    combinedSimilarResults.map((candidate) => candidate.recommendationId)
  );
  if (sameSeriesResults.some((candidate) => similarIds.has(candidate.recommendationId))) {
    throw new Error(`Product sections overlap for ${source.recommendationId}.`);
  }

  const showSimilarSection =
    combinedSimilarResults.length >= productConfig.similarResults.minimumToShow;
  const showSameSeriesSection =
    sameSeriesResults.length >= productConfig.sameSeriesResults.minimumToShow;
  const warnings = [];
  if (!showSimilarSection && combinedSimilarResults.length) {
    warnings.push("similar_section_below_minimum");
  }
  if (separatedSameSeriesIds.size) warnings.push("same_series_removed_from_similarity");

  return {
    recommendationId: source.recommendationId,
    existingId: source.existingId,
    sourceLink: source.sourceLink,
    title: source.title,
    authoritativeMainSeries: source.authoritativeMainSeries,
    supplementarySimilaritiesRaw: source.supplementarySimilaritiesRaw,
    automaticSimilarResults,
    manualSupplementaryResults,
    combinedSimilarResults,
    similarResults: combinedSimilarResults,
    sameSeriesResults,
    automaticSimilarResultCount: automaticSimilarResults.length,
    manualSupplementaryResultCount: manualSupplementaryResults.length,
    combinedSimilarResultCount: combinedSimilarResults.length,
    similarResultCount: combinedSimilarResults.length,
    sameSeriesResultCount: sameSeriesResults.length,
    showSimilarSection,
    showSameSeriesSection,
    warnings
  };
}

function buildProductOutput(
  podcastPayload,
  metadataPayload,
  v11Output,
  v11Config,
  productConfig,
  { reverseCatalog = false } = {}
) {
  validateSimilarityConfig(v11Config);
  validateProductConfig(productConfig);
  const catalog = buildProductCatalog(metadataPayload, podcastPayload, productConfig);
  const orderedCatalog = reverseCatalog ? [...catalog].reverse() : catalog;
  const catalogById = new Map(catalog.map((row) => [row.recommendationId, row]));
  const specificityIndex = buildTopicSpecificityIndex(catalog, v11Config);
  const results = {};
  const manualReferenceAudit = [];
  for (const source of [...orderedCatalog].sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId)
  )) {
    const manualResolution = resolveSupplementarySimilarities({ source, catalog });
    manualReferenceAudit.push(...manualResolution.audit);
    results[source.recommendationId] = buildProductResultForSource(
      source,
      catalog,
      catalogById,
      v11Output.results[source.recommendationId],
      specificityIndex,
      v11Config,
      productConfig,
      manualResolution
    );
  }
  return {
    version: productConfig.version,
    contentSourceVersion: productConfig.contentSourceVersion,
    sourceCount: catalog.length,
    results,
    manualReferenceAudit: manualReferenceAudit.sort(
      (left, right) =>
        left.sourceRecommendationId.localeCompare(right.sourceRecommendationId) ||
        left.position - right.position
    )
  };
}

function distribution(values) {
  const counts = {};
  for (const value of values) counts[value] = (counts[value] || 0) + 1;
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => Number(left) - Number(right))
  );
}

function buildCoverage(output) {
  return Object.values(output.results).map((source) => ({
    recommendation_id: source.recommendationId,
    title: source.title,
    authoritative_main_series: source.authoritativeMainSeries,
    similar_result_count: source.similarResultCount,
    same_series_result_count: source.sameSeriesResultCount,
    show_similar_section: source.showSimilarSection,
    show_same_series_section: source.showSameSeriesSection,
    outcome:
      source.showSimilarSection && source.showSameSeriesSection
        ? "both"
        : source.showSimilarSection
          ? "similar_only"
          : source.showSameSeriesSection
            ? "same_series_only"
            : "neither",
    warnings: source.warnings
  }));
}

function buildStructuralExclusions(output, v12Output, catalog) {
  const catalogById = new Map(catalog.map((row) => [row.recommendationId, row]));
  const rows = [];
  const keys = new Set();
  const add = (source, candidate, signal, reason, reviewNote = "") => {
    const key = `${source.recommendationId}\u0000${candidate.recommendationId}\u0000${signal}`;
    if (keys.has(key)) return;
    keys.add(key);
    rows.push({
      source_title: source.title,
      candidate_title: candidate.title,
      structural_signal: signal,
      shared_host: candidate.sharedHosts ?? [],
      same_publisher: Boolean(candidate.samePublisher),
      same_main_series: Boolean(candidate.sameMainSeries),
      content_similarity_score: candidate.contentSimilarityScore ?? 0,
      genre_compatibility: candidate.genreSimilarityScore ?? 0,
      excluded_from_product: true,
      exclusion_reason: reason,
      review_note: reviewNote
    });
  };

  for (const sourceResult of Object.values(v12Output.results)) {
    const source = catalogById.get(sourceResult.recommendationId);
    const product = output.results[sourceResult.recommendationId];
    for (const candidate of sourceResult.displayResults || []) {
      if (candidate.selectionTier === "B" && candidate.candidateType === "same_host_supported") {
        add(
          source,
          candidate,
          "same_host",
          "host_not_product_eligible",
          "V1.2 structural supplement intentionally excluded."
        );
      }
      if (candidate.selectionTier === "B" && candidate.candidateType === "same_main_series") {
        add(
          source,
          candidate,
          "same_main_series",
          "same_series_rendered_separately",
          product.sameSeriesResults.some(
            (row) => row.recommendationId === candidate.recommendationId
          )
            ? "Rendered in Fra samme serie."
            : "Eligible relationship retained in diagnostics but not selected."
        );
      }
    }
  }

  const sorted = [...catalog].sort((left, right) =>
    left.recommendationId.localeCompare(right.recommendationId)
  );
  for (const source of sorted) {
    const visible = new Set([
      ...output.results[source.recommendationId].similarResults,
      ...output.results[source.recommendationId].sameSeriesResults
    ].map((candidate) => candidate.recommendationId));
    for (const candidate of sorted) {
      if (
        !isSafePair(source, candidate) ||
        visible.has(candidate.recommendationId) ||
        !source.normalizedPublisher ||
        source.normalizedPublisher !== candidate.normalizedPublisher ||
        (source.normalizedHost && source.normalizedHost === candidate.normalizedHost) ||
        (source.normalizedAuthoritativeMainSeries &&
          source.normalizedAuthoritativeMainSeries ===
            candidate.normalizedAuthoritativeMainSeries)
      ) {
        continue;
      }
      add(
        source,
        {
          ...candidate,
          sharedHosts: [],
          samePublisher: true,
          sameMainSeries: false,
          contentSimilarityScore: 0,
          genreSimilarityScore: 0
        },
        "same_publisher",
        "publisher_not_product_eligible",
        "Publisher alone never creates a product result."
      );
    }
  }
  return rows.sort(
    (left, right) =>
      left.source_title.localeCompare(right.source_title, "da") ||
      left.candidate_title.localeCompare(right.candidate_title, "da") ||
      left.structural_signal.localeCompare(right.structural_signal)
  );
}

function representativeRows(output) {
  const sources = Object.values(output.results);
  return REPRESENTATIVE_SEED_TITLES.map((title) => {
    const matches = sources.filter((source) => source.title === title);
    if (matches.length !== 1) {
      throw new Error(`Representative seed ${JSON.stringify(title)} matched ${matches.length}.`);
    }
    return matches[0];
  }).flatMap((source) => [
    ...source.similarResults.map((candidate, index) => ({
      source_recommendation_id: source.recommendationId,
      source_title: source.title,
      section: "Minder om denne podcast",
      rank: index + 1,
      candidate_recommendation_id: candidate.recommendationId,
      candidate_title: candidate.title,
      content_similarity_score: candidate.contentSimilarityScore,
      shared_topics: candidate.sharedTopics,
      reason: candidate.similarityReason
    })),
    ...source.sameSeriesResults.map((candidate, index) => ({
      source_recommendation_id: source.recommendationId,
      source_title: source.title,
      section: "Fra samme serie",
      rank: index + 1,
      candidate_recommendation_id: candidate.recommendationId,
      candidate_title: candidate.title,
      content_similarity_score: candidate.contentSimilarityScore,
      shared_topics: candidate.sharedTopics,
      reason: candidate.similarityReason
    }))
  ]);
}

function seedMarkdown(output) {
  const sources = Object.values(output.results);
  const lines = ["# Representative product results", ""];
  for (const title of REPRESENTATIVE_SEED_TITLES) {
    const source = sources.find((item) => item.title === title);
    lines.push(`## ${source.title}`, "");
    lines.push(
      `- Show similar: ${source.showSimilarSection} (${source.similarResultCount})`,
      `- Show same series: ${source.showSameSeriesSection} (${source.sameSeriesResultCount})`,
      ""
    );
    for (const [heading, candidates] of [
      ["Minder om denne podcast", source.similarResults],
      ["Fra samme serie", source.sameSeriesResults]
    ]) {
      lines.push(`### ${heading}`, "");
      if (!candidates.length) lines.push("- Ingen resultater.");
      candidates.forEach((candidate, index) => {
        lines.push(
          `${index + 1}. ${candidate.title} — ${candidate.similarityReason} — content ${candidate.contentSimilarityScore}`
        );
      });
      lines.push("");
    }
  }
  return `${lines.join("\n")}\n`;
}

function summaryMarkdown(coverage, exclusions) {
  const similar = coverage.filter((row) => row.show_similar_section).length;
  const series = coverage.filter((row) => row.show_same_series_section).length;
  const both = coverage.filter((row) => row.outcome === "both").length;
  const neither = coverage.filter((row) => row.outcome === "neither").length;
  const hostExcluded = exclusions.filter(
    (row) => row.exclusion_reason === "host_not_product_eligible"
  ).length;
  const publisherExcluded = exclusions.filter(
    (row) => row.exclusion_reason === "publisher_not_product_eligible"
  ).length;
  return `# Podcast similarity product v1.3

## Product coverage

- Sources: ${coverage.length}
- Showing Minder om denne podcast: ${similar}
- Showing Fra samme serie: ${series}
- Showing both: ${both}
- Showing neither: ${neither}
- Similar-result count distribution: ${JSON.stringify(
    distribution(coverage.map((row) => row.similar_result_count))
  )}
- Same-series count distribution: ${JSON.stringify(
    distribution(coverage.map((row) => row.same_series_result_count))
  )}

## Deliberately excluded structure

- V1.2 host supplements excluded: ${hostExcluded}
- Publisher-only candidate relationships excluded: ${publisherExcluded}
- Host and publisher signals are diagnostic only.
- Same-series relationships use only authoritative source Hovedserie and are rendered separately.
`;
}

function buildManualSupplementCoverage(output) {
  return Object.values(output.results).map((source) => ({
    source_recommendation_id: source.recommendationId,
    source_title: source.title,
    automatic_result_count: source.automaticSimilarResultCount ?? source.similarResultCount,
    manual_supplementary_result_count: source.manualSupplementaryResultCount ?? 0,
    combined_result_count: source.combinedSimilarResultCount ?? source.similarResultCount,
    automatic_section_visible:
      (source.automaticSimilarResultCount ?? source.similarResultCount) >= 3,
    combined_section_visible: source.showSimilarSection,
    gained_visible_section:
      (source.automaticSimilarResultCount ?? source.similarResultCount) < 3 &&
      source.showSimilarSection
  }));
}

function manualSupplementSummaryMarkdown(output, manualAudit, coverage) {
  const count = (status) => manualAudit.filter((row) => row.status === status).length;
  const unresolved = manualAudit.filter(
    (row) => row.status === "unresolved_title" || row.status === "host_mismatch"
  );
  const ambiguous = manualAudit.filter((row) => row.status.startsWith("ambiguous_"));
  const resolved = manualAudit.filter((row) => row.status.startsWith("resolved_"));
  const alreadyAutomatic = manualAudit.filter((row) => row.presentInAutomatic).length;
  const supplements = resolved.length - alreadyAutomatic;
  const sourceRowsWithManualInput = Object.values(output.results).filter(
    (row) => text(row.supplementarySimilaritiesRaw)
  ).length;
  const list = (rows) =>
    rows.length
      ? rows
          .map((row) => `- Row ${row.sourceRow}: ${row.sourceTitle} â†’ ${row.parsedTargetTitle}`)
          .join("\n")
      : "- None.";

  return `# Manual supplementary similarity audit

- Podcast rows with non-empty column T: ${sourceRowsWithManualInput}
- Parsed manual references: ${manualAudit.length}
- Resolved references: ${resolved.length}
- Unresolved references: ${unresolved.length}
- Ambiguous references: ${ambiguous.length}
- Self-references rejected: ${count("self_reference")}
- Safe duplicates rejected: ${count("safe_duplicate_reference")}
- Duplicate manual entries removed: ${count("duplicate_manual_reference")}
- Already present automatically: ${alreadyAutomatic}
- Newly supplementing automatic results: ${supplements}
- Sources gaining at least three visible results: ${coverage.filter((row) => row.gained_visible_section).length}
- Sources still below three: ${coverage.filter((row) => !row.combined_section_visible).length}

## Unresolved titles and source rows

${list(unresolved)}

## Ambiguous titles and source rows

${list(ambiguous)}
`;
}

function runBuild({
  rootDir = PROJECT_ROOT,
  dataOutputPath = path.join(rootDir, "data", "podcast-similarity-product-v1.3.json"),
  auditDir = path.join(rootDir, "audit-podcast-similarity-product-v1.3"),
  manualAuditDir = path.join(rootDir, "audit-podcast-similarity-manual-supplements")
} = {}) {
  const podcasts = readJson(path.join(rootDir, "data", "podcasts.json"));
  const metadata = readJson(path.join(rootDir, "data", "recommendation-metadata.json"));
  const v11Output = readJson(path.join(rootDir, "data", "podcast-similarity-v1.1.json"));
  const v12Output = readJson(path.join(rootDir, "data", "podcast-similarity-v1.2.json"));
  const v11Config = validateSimilarityConfig(
    readJson(path.join(rootDir, "config", "podcast-similarity-engine-v1.1.json"))
  );
  const productConfig = validateProductConfig(
    readJson(path.join(rootDir, "config", "podcast-similarity-product-v1.3.json"))
  );
  const output = buildProductOutput(
    podcasts,
    metadata,
    v11Output,
    v11Config,
    productConfig
  );
  const catalog = buildProductCatalog(metadata, podcasts, productConfig);
  const coverage = buildCoverage(output);
  const exclusions = buildStructuralExclusions(output, v12Output, catalog);
  const manualAudit = output.manualReferenceAudit || [];
  const manualCoverage = buildManualSupplementCoverage(output);
  const unresolvedManual = manualAudit.filter(
    (row) => row.status === "unresolved_title" || row.status === "host_mismatch"
  );
  const ambiguousManual = manualAudit.filter((row) => row.status.startsWith("ambiguous_"));
  const resolvedManual = manualAudit.filter((row) => row.status.startsWith("resolved_"));
  const seeds = representativeRows(output);
  const humanReview = seeds.map((row) => ({
    ...row,
    reviewer_relevance: "",
    reviewer_notes: ""
  }));

  writeUtf8(dataOutputPath, `${JSON.stringify(output, null, 2)}\n`);
  writeUtf8(path.join(auditDir, "summary.md"), summaryMarkdown(coverage, exclusions));
  writeUtf8(
    path.join(auditDir, "catalog-coverage.csv"),
    csvText(Object.keys(coverage[0]), coverage),
    true
  );
  writeUtf8(path.join(auditDir, "seed-results.md"), seedMarkdown(output));
  writeUtf8(
    path.join(auditDir, "seed-results.csv"),
    csvText(Object.keys(seeds[0]), seeds),
    true
  );
  writeUtf8(
    path.join(auditDir, "excluded-structural-candidates.csv"),
    csvText(Object.keys(exclusions[0]), exclusions),
    true
  );
  writeUtf8(
    path.join(auditDir, "human-review.csv"),
    csvText(Object.keys(humanReview[0]), humanReview),
    true
  );
  writeUtf8(
    path.join(auditDir, "TEST-RESULTS.md"),
    `# Test results

Generated by the deterministic product builder. Final command and browser results are recorded after verification.
`
  );
  writeUtf8(
    path.join(auditDir, "README.md"),
    `# Podcast similarity product v1.3 audit

The product layer packages unchanged v1.1 content results separately from exact authoritative same-series relationships.

- \`summary.md\`: product coverage and exclusion counts.
- \`catalog-coverage.csv\`: section visibility for every source.
- \`seed-results.*\`: representative product results.
- \`excluded-structural-candidates.csv\`: host, publisher and separated-series diagnostics.
- \`human-review.csv\`: review worksheet.

CSV files use UTF-8 BOM and semicolon separators.
`
  );
  const manualHeaders = [
    "sourceRecommendationId",
    "sourceTitle",
    "sourceRow",
    "rawCellValue",
    "parsedTargetTitle",
    "parsedHostQualifier",
    "position",
    "status",
    "resolvedRecommendationId",
    "resolvedTitle",
    "resolvedHost",
    "resolutionMethod",
    "rejectionReason",
    "presentInAutomatic"
  ];
  writeUtf8(
    path.join(manualAuditDir, "summary.md"),
    manualSupplementSummaryMarkdown(output, manualAudit, manualCoverage)
  );
  writeUtf8(
    path.join(manualAuditDir, "manual-reference-audit.csv"),
    csvText(manualHeaders, manualAudit),
    true
  );
  writeUtf8(
    path.join(manualAuditDir, "unresolved-manual-references.csv"),
    csvText(manualHeaders, unresolvedManual),
    true
  );
  writeUtf8(
    path.join(manualAuditDir, "ambiguous-manual-references.csv"),
    csvText(manualHeaders, ambiguousManual),
    true
  );
  writeUtf8(
    path.join(manualAuditDir, "resolved-manual-references.csv"),
    csvText(manualHeaders, resolvedManual),
    true
  );
  writeUtf8(
    path.join(manualAuditDir, "combined-result-coverage.csv"),
    csvText(Object.keys(manualCoverage[0]), manualCoverage),
    true
  );
  writeUtf8(
    path.join(manualAuditDir, "human-review.csv"),
    csvText(
      [...manualHeaders, "reviewerNotes"],
      manualAudit.map((row) => ({ ...row, reviewerNotes: "" }))
    ),
    true
  );
  writeUtf8(
    path.join(manualAuditDir, "TEST-RESULTS.md"),
    "# Test results\n\nGenerated by the deterministic manual-supplement product build.\n"
  );
  writeUtf8(
    path.join(manualAuditDir, "README.md"),
    "# Manual supplementary similarities audit\n\nColumn T values are parsed conservatively and resolved only by exact normalized title, with an optional exact host qualifier. CSV files use UTF-8 BOM and semicolon separators.\n"
  );
  return {
    output,
    catalog,
    coverage,
    exclusions,
    seeds,
    manualAudit,
    manualCoverage,
    dataOutputPath,
    auditDir,
    manualAuditDir
  };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const built = runBuild();
  const summary = {
    sourceCount: built.output.sourceCount,
    showSimilar: built.coverage.filter((row) => row.show_similar_section).length,
    showSameSeries: built.coverage.filter((row) => row.show_same_series_section).length,
    showBoth: built.coverage.filter((row) => row.outcome === "both").length,
    showNeither: built.coverage.filter((row) => row.outcome === "neither").length,
    hostExcluded: built.exclusions.filter(
      (row) => row.exclusion_reason === "host_not_product_eligible"
    ).length,
    publisherOnlyExcluded: built.exclusions.filter(
      (row) => row.exclusion_reason === "publisher_not_product_eligible"
    ).length,
    output: built.dataOutputPath,
    audit: built.auditDir
  };
  console.log(JSON.stringify(summary, null, 2));
}

export {
  PROJECT_ROOT,
  buildProductCatalog,
  buildProductOutput,
  buildProductResultForSource,
  combineProductSimilarResults,
  danishSharedTopicReason,
  getAuthoritativeMainSeries,
  normalizeAuthoritativeMainSeries,
  runBuild,
  validateProductConfig
};
