import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildSimilarityCatalog,
  buildSimilarityResultsForCatalog,
  buildSimilarityResultsForPodcast,
  validateSimilarityConfig
} from "./podcast-similarity-engine-v1.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const REPRESENTATIVE_SEED_TITLES = [
  "Marathonmanden",
  "Kapret",
  "Agent Piccadilly",
  "Bomben",
  "Mediano Business",
  "Superliga for voksne",
  "Verdens klogeste land",
  "Det, vi taler om",
  "Robert og Thetanerne",
  "I en danskers blodspor",
  "Uopklaret: Gåden på Christianshavn",
  "Det Digitale Menneske"
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeUtf8(filePath, content, bom = false) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${bom ? "\uFEFF" : ""}${content}`, "utf8");
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

function average(values) {
  const usable = values.filter((value) => typeof value === "number" && Number.isFinite(value));
  return usable.length
    ? usable.reduce((sum, value) => sum + value, 0) / usable.length
    : 0;
}

function median(values) {
  const sorted = values
    .filter((value) => typeof value === "number" && Number.isFinite(value))
    .sort((left, right) => left - right);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function number(value, digits = 2) {
  return Number(value ?? 0).toFixed(digits);
}

function validateSeeds(catalog) {
  const byTitle = new Map();
  for (const row of catalog) {
    const items = byTitle.get(row.title) ?? [];
    items.push(row);
    byTitle.set(row.title, items);
  }
  return REPRESENTATIVE_SEED_TITLES.map((title) => {
    const matches = byTitle.get(title) ?? [];
    if (matches.length !== 1) {
      throw new Error(
        `Representative seed ${JSON.stringify(title)} matched ${matches.length} rows; expected exactly one.`
      );
    }
    if (!matches[0].recommendationId || matches[0].topicsCanonical.length === 0) {
      throw new Error(`Representative seed ${JSON.stringify(title)} lacks usable metadata.`);
    }
    return matches[0];
  });
}

function strippedOutput(fullOutput) {
  return {
    version: fullOutput.version,
    sourceCount: fullOutput.sourceCount,
    results: fullOutput.results
  };
}

function safeDuplicateRemovalCount(catalog) {
  const groupCounts = new Map();
  for (const row of catalog) {
    if (!row.identityDuplicateGroup) continue;
    groupCounts.set(
      row.identityDuplicateGroup,
      (groupCounts.get(row.identityDuplicateGroup) ?? 0) + 1
    );
  }
  return Array.from(groupCounts.values()).reduce(
    (sum, count) => sum + count * (count - 1),
    0
  );
}

function coverageRows(fullOutput) {
  return Object.values(fullOutput.results).map((source) => {
    const scores = source.selectedResults.map((candidate) => candidate.contentSimilarityScore);
    return {
      recommendation_id: source.recommendationId,
      title: source.title,
      topic_count: source.topicsCanonical.length,
      topic_supported_candidate_count: source.topicSupportedCandidateCount,
      genre_only_candidate_count: source.genreOnlyCandidateCount,
      selected_topic_supported_count: source.selectedTopicSupportedCount,
      selected_genre_only_count: source.selectedGenreOnlyCount,
      maximum_similarity_score: scores.length ? Math.max(...scores) : 0,
      average_selected_similarity_score: average(scores).toFixed(4),
      fewer_than_three_topic_matches: source.topicSupportedCandidateCount < 3,
      fewer_than_eight_topic_matches: source.topicSupportedCandidateCount < 8,
      warnings: source.warnings
    };
  });
}

function seedResultRows(seedOutputs) {
  return seedOutputs.flatMap(({ source, output }) =>
    output.selectedResults.map((candidate) => ({
      source_recommendation_id: source.recommendationId,
      source_title: source.title,
      source_topics: source.topicsCanonical,
      candidate_rank: candidate.diversifiedRank,
      candidate_recommendation_id: candidate.recommendationId,
      candidate_title: candidate.title,
      candidate_publisher: candidate.publisher,
      candidate_main_series: candidate.mainSeries,
      candidate_topics: candidate.topicsCanonical,
      content_similarity_score: number(candidate.contentSimilarityScore, 4),
      topic_similarity_score: number(candidate.topicSimilarityScore, 4),
      genre_similarity_score: number(candidate.genreSimilarityScore, 4),
      similarity_class: candidate.similarityClass,
      shared_topics: candidate.sharedTopics,
      strongest_shared_topic: candidate.strongestSharedTopic,
      strongest_shared_topic_centrality: number(
        candidate.strongestSharedTopicCentrality,
        4
      ),
      same_main_series: candidate.sameMainSeries,
      editorial_score: candidate.editorialScore,
      candidate_type: candidate.candidateType,
      original_rank: candidate.originalRank,
      fallback_stage: candidate.fallbackStage,
      similarity_reasons: candidate.similarityReasons,
      similarity_warnings: candidate.similarityWarnings
    }))
  );
}

function candidateAuditRows(seedOutputs) {
  return seedOutputs.flatMap(({ source, output }) =>
    output.candidateDiagnostics.map((candidate) => ({
      source_recommendation_id: source.recommendationId,
      source_title: source.title,
      candidate_recommendation_id: candidate.recommendationId,
      candidate_title: candidate.title,
      eligible: candidate.eligible,
      exclusion_reason: candidate.exclusionReason,
      topic_similarity: number(candidate.topicSimilarityScore, 4),
      genre_similarity: number(candidate.genreSimilarityScore, 4),
      total_content_similarity: number(candidate.contentSimilarityScore, 4),
      shared_topics: candidate.sharedTopics,
      source_topic_positions: candidate.sourceTopicPositions,
      candidate_topic_positions: candidate.candidateTopicPositions,
      strongest_shared_topic_centrality: number(
        candidate.strongestSharedTopicCentrality,
        4
      ),
      same_main_series: candidate.sameMainSeries,
      duplicate_group: candidate.identityDuplicateGroup,
      editorial_score: candidate.editorialScore,
      original_rank: candidate.originalRank,
      selected: candidate.selected,
      diversified_rank: candidate.diversifiedRank,
      diversity_action: candidate.diversityAction,
      candidate_type: candidate.candidateType,
      similarity_warnings: candidate.similarityWarnings
    }))
  );
}

function buildSeedMarkdown(seedOutputs) {
  const lines = ["# Representative seed results", ""];
  for (const { source, output } of seedOutputs) {
    lines.push(
      `## ${source.title}`,
      "",
      `- recommendationId: \`${source.recommendationId}\``,
      `- Primær/sekundær genre: ${source.primaryGenre || "—"} / ${source.secondaryGenre || "—"}`,
      `- Emner: ${source.topicsCanonical.join(", ") || "—"}`,
      `- Emneunderstøttede kandidater: ${output.topicSupportedCandidateCount}`,
      `- Genre-only kandidater: ${output.genreOnlyCandidateCount}`,
      `- Valgte fallbacks: ${output.selectedGenreOnlyCount}`,
      "",
      "| # | Kandidat | Total | Emne | Genre | Klasse | Fælles emner | Begrundelse |",
      "|---:|---|---:|---:|---:|---|---|---|"
    );
    for (const candidate of output.selectedResults) {
      lines.push(
        `| ${candidate.diversifiedRank} | ${candidate.title.replaceAll("|", "\\|")} | ${number(
          candidate.contentSimilarityScore
        )} | ${number(candidate.topicSimilarityScore)} | ${number(
          candidate.genreSimilarityScore
        )} | ${candidate.similarityClass} | ${
          candidate.sharedTopics.join(", ").replaceAll("|", "\\|") || "—"
        } | ${candidate.similarityReasons.join(" ").replaceAll("|", "\\|")} |`
      );
    }
    const strong = output.selectedResults
      .filter(
        (candidate) =>
          ["very_high", "high"].includes(candidate.similarityClass) &&
          candidate.sharedTopics.length >= 2
      )
      .slice(0, 5)
      .map((candidate) => candidate.title);
    const questionable = output.selectedResults
      .filter(
        (candidate) =>
          candidate.candidateType === "genre_only" ||
          candidate.similarityWarnings.includes("shared_topic_is_peripheral") ||
          (candidate.sharedTopics.length === 1 &&
            candidate.similarityClass === "low")
      )
      .slice(0, 5)
      .map((candidate) => candidate.title);
    lines.push(
      "",
      `**Klart stærke resultater:** ${strong.join("; ") || "Ingen med mindst to emner i high/very_high."}`,
      "",
      `**Kræver særlig menneskelig vurdering:** ${questionable.join("; ") || "Ingen automatisk markeret."}`,
      ""
    );
  }
  return `${lines.join("\n")}\n`;
}

function buildSummary(catalog, fullOutput, config, seedOutputs) {
  const rows = coverageRows(fullOutput);
  const selected = Object.values(fullOutput.results).flatMap(
    (source) => source.selectedResults
  );
  const classDistribution = {};
  for (const candidate of selected) {
    classDistribution[candidate.similarityClass] =
      (classDistribution[candidate.similarityClass] ?? 0) + 1;
  }
  const strongestScores = rows.map((row) => Number(row.maximum_similarity_score));
  const sourcesAtLeast3 = rows.filter(
    (row) => row.topic_supported_candidate_count >= 3
  ).length;
  const sourcesAtLeast8 = rows.filter(
    (row) => row.topic_supported_candidate_count >= 8
  ).length;
  const requiringFallback = rows.filter(
    (row) => row.selected_genre_only_count > 0
  ).length;
  const zeroTopic = rows.filter(
    (row) => row.topic_supported_candidate_count === 0
  ).length;
  const mainSeriesRemovals = Object.values(fullOutput.results).reduce(
    (sum, source) => sum + source.mainSeriesRemovalCount,
    0
  );
  const publisherRemovals = Object.values(fullOutput.results).reduce(
    (sum, source) => sum + source.publisherRemovalCount,
    0
  );
  return `# Podcast similarity engine v1 — coverage summary

## Catalog

- Sources: ${catalog.length}
- Sources with at least 3 topic-supported candidates: ${sourcesAtLeast3}
- Sources with at least 8 topic-supported candidates: ${sourcesAtLeast8}
- Sources using genre-only fallback: ${requiringFallback}
- Sources with zero topic-supported candidates: ${zeroTopic}
- Average strongest similarity: ${number(average(strongestScores))}
- Median strongest similarity: ${number(median(strongestScores))}
- Same-main-series diversity removals: ${mainSeriesRemovals}
- Safe-duplicate removals: ${safeDuplicateRemovalCount(catalog)}
- Publisher-diversity actions: ${publisherRemovals}

## Selected similarity classes

${Object.entries(classDistribution)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, count]) => `- ${key}: ${count}`)
  .join("\n")}

## Exact model

- Topic weight: ${config.weights.topics}; genre weight: ${config.weights.genres}.
- Shared-topic centrality: \`sqrt(sourcePositionWeight × candidatePositionWeight)\`.
- Bounded centrality: strongest × ${config.topicAggregation.strongestMatchWeight}, second × ${config.topicAggregation.secondMatchWeight}, and the mean of all remaining matches × ${config.topicAggregation.remainingMatchesWeight}; available slots are normalized.
- Coverage factor: one shared topic ${config.topicAggregation.coverageBySharedTopicCount.one}, two ${config.topicAggregation.coverageBySharedTopicCount.two}, three or more ${config.topicAggregation.coverageBySharedTopicCount.threeOrMore}.
- Genre signals: same primary ${config.genreSignals.samePrimary}, primary/secondary cross ${config.genreSignals.primarySecondaryCrossMatch}, same secondary ${config.genreSignals.sameSecondary}; unique genre signals are summed and capped at 1.
- Final content score: topic score + genre score. Editorial rating, image and link never enter the content score.
- Tie-break: content score, number of shared topics, strongest centrality, editorial rating (missing last), recommendationId.
- Diversity: maximum ${config.diversity.maximumPerMainSeries} per main series; maximum ${config.diversity.maximumPerPublisherInTopEight} per publisher in the first ${config.candidateRules.displayLimit}; genre-only candidates are considered only after topic candidates and only to fill the visible ${config.candidateRules.displayLimit}.

## Representative seeds

${seedOutputs
  .map(
    ({ source }) =>
      `- ${source.title} — \`${source.recommendationId}\` — ${source.primaryGenre} — ${source.topicsCanonical.join(", ")}`
  )
  .join("\n")}

## Critical evaluation prompts

The detailed, result-specific review is in \`seed-results.md\` and the primary human worksheet is \`human-review.csv\`. Exact-topic coverage is deliberately reported rather than hidden: a source with fewer than three topic matches is weak coverage, even if genre-only cards could fill the visual row.
`;
}

function buildReadme() {
  return `# Offline podcast similarity v1 audit

This folder is generated deterministically by \`scripts/build-podcast-similarity-prototype.mjs\`.

- \`summary.md\`: catalog coverage and exact model.
- \`seed-results.md\` / \`seed-results.csv\`: full top-20 output for representative sources.
- \`catalog-coverage.csv\`: one row per source podcast.
- \`candidate-audit.csv\`: every considered candidate for the representative sources, including exclusions and diversity removals.
- \`human-review.csv\`: top ten per seed with blank reviewer columns.
- \`TEST-RESULTS.md\`: populated by the verification pass.

All CSV files are UTF-8 with BOM and semicolon separators. Similarity is metadata-only, symmetric and independent of editorial quality. No user profile or rating data is used.
`;
}

function runBuild({
  rootDir = PROJECT_ROOT,
  dataOutputPath = path.join(rootDir, "data", "podcast-similarity-v1.json"),
  auditDir = path.join(rootDir, "audit-podcast-similarity-v1")
} = {}) {
  const config = validateSimilarityConfig(
    readJson(path.join(rootDir, "config", "podcast-similarity-engine-v1.json"))
  );
  const metadataPayload = readJson(
    path.join(rootDir, "data", "recommendation-metadata.json")
  );
  const podcastPayload = readJson(path.join(rootDir, "data", "podcasts.json"));
  const catalog = buildSimilarityCatalog(metadataPayload, podcastPayload);
  const seeds = validateSeeds(catalog);
  const fullOutput = buildSimilarityResultsForCatalog(catalog, config);
  const seedOutputs = seeds.map((source) => ({
    source,
    output: buildSimilarityResultsForPodcast(source, catalog, config)
  }));
  writeUtf8(dataOutputPath, `${JSON.stringify(strippedOutput(fullOutput), null, 2)}\n`);

  const coverage = coverageRows(fullOutput);
  const seedRows = seedResultRows(seedOutputs);
  const candidateRows = candidateAuditRows(seedOutputs);
  const humanRows = seedRows
    .filter((row) => Number(row.candidate_rank) <= 10)
    .map((row) => ({
      source_recommendation_id: row.source_recommendation_id,
      source_title: row.source_title,
      source_topics: row.source_topics,
      candidate_rank: row.candidate_rank,
      candidate_recommendation_id: row.candidate_recommendation_id,
      candidate_title: row.candidate_title,
      candidate_topics: row.candidate_topics,
      content_similarity_score: row.content_similarity_score,
      topic_similarity_score: row.topic_similarity_score,
      genre_similarity_score: row.genre_similarity_score,
      similarity_class: row.similarity_class,
      shared_topics: row.shared_topics,
      strongest_shared_topic: row.strongest_shared_topic,
      same_main_series: row.same_main_series,
      editorial_score: row.editorial_score,
      similarity_reasons: row.similarity_reasons,
      similarity_warnings: row.similarity_warnings,
      reviewer_similarity: "",
      reviewer_notes: ""
    }));
  writeUtf8(path.join(auditDir, "summary.md"), buildSummary(catalog, fullOutput, config, seedOutputs));
  writeUtf8(path.join(auditDir, "seed-results.md"), buildSeedMarkdown(seedOutputs));
  writeUtf8(
    path.join(auditDir, "seed-results.csv"),
    csvText(Object.keys(seedRows[0]), seedRows),
    true
  );
  writeUtf8(
    path.join(auditDir, "catalog-coverage.csv"),
    csvText(Object.keys(coverage[0]), coverage),
    true
  );
  writeUtf8(
    path.join(auditDir, "candidate-audit.csv"),
    csvText(Object.keys(candidateRows[0]), candidateRows),
    true
  );
  writeUtf8(
    path.join(auditDir, "human-review.csv"),
    csvText(Object.keys(humanRows[0]), humanRows),
    true
  );
  writeUtf8(path.join(auditDir, "README.md"), buildReadme());
  if (!fs.existsSync(path.join(auditDir, "TEST-RESULTS.md"))) {
    writeUtf8(
      path.join(auditDir, "TEST-RESULTS.md"),
      "# Test results\n\nPending verification pass.\n"
    );
  }
  return { catalog, config, fullOutput, seedOutputs, auditDir, dataOutputPath };
}

const isMain =
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const result = runBuild();
  console.log(
    JSON.stringify(
      {
        sourceCount: result.fullOutput.sourceCount,
        seedCount: result.seedOutputs.length,
        dataOutputPath: result.dataOutputPath,
        auditDir: result.auditDir
      },
      null,
      2
    )
  );
}

export {
  PROJECT_ROOT,
  REPRESENTATIVE_SEED_TITLES,
  csvText,
  runBuild,
  validateSeeds
};
