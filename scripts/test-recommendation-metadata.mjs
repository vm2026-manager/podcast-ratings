import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildRecommendationData,
  mapPrimaryGenre,
  normalizeHostIdentity,
  normalizeTopics,
  normalizeUrlIdentity,
  podcastKey,
  topicIdentity,
  topicKey,
  validateAliasConfig,
  validateGenreConfig,
  writeRecommendationArtifacts
} from "./build-recommendation-metadata.mjs";

const aliasConfig = {
  version: 1,
  aliases: [
    {
      alias: "dansk fodbold",
      canonical: "Dansk fodbold",
      type: "capitalization",
      status: "approved",
      note: "test"
    },
    {
      alias: "Adfærdspsykologi",
      canonical: "Psykologi",
      type: "synonym",
      status: "review",
      note: "test"
    },
    {
      alias: "gammel betegnelse",
      canonical: "Ny betegnelse",
      type: "deprecated",
      status: "rejected",
      note: "test"
    }
  ]
};
const genreConfig = JSON.parse(
  await readFile(
    new URL("../config/recommendation-genre-mapping.json", import.meta.url),
    "utf8"
  )
);
const { approvedLookup: approvedGenreLookup } = validateGenreConfig(genreConfig);

const { approvedLookup } = validateAliasConfig(aliasConfig);
assert.deepEqual(normalizeTopics(["Svindel"], approvedLookup).topicsCanonical, ["Svindel"]);
assert.deepEqual(normalizeTopics(["dansk fodbold"], approvedLookup).topicsCanonical, [
  "Dansk fodbold"
]);
assert.deepEqual(normalizeTopics(["Adfærdspsykologi"], approvedLookup).topicsCanonical, [
  "Adfærdspsykologi"
]);
assert.deepEqual(normalizeTopics(["gammel betegnelse"], approvedLookup).topicsCanonical, [
  "gammel betegnelse"
]);

const normalized = normalizeTopics(
  ["Svindel", "dansk fodbold", "Historie", "Dansk fodbold", "Økonomi"],
  approvedLookup
);
assert.deepEqual(normalized.topicsCanonical, [
  "Svindel",
  "Dansk fodbold",
  "Historie",
  "Økonomi"
]);
assert.equal(normalized.duplicateAfterAlias, true);
assert.equal(normalized.aliasApplied, true);
assert.equal(topicIdentity("  Familiehemmeligheder  "), "familiehemmeligheder");
assert.equal(topicIdentity("Familie\u00a0hemmeligheder"), "familie hemmeligheder");
assert.equal(topicKey("Falske identiteter"), "falske-identiteter");
assert.equal(topicKey("Æbler, øl & ål"), "aebler-oel-og-aal");
assert.equal(topicKey("Økonomi"), topicKey("Økonomi"));
assert.match(topicKey("Dansk fodbold"), /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
assert.deepEqual(
  normalizeHostIdentity("Anna Ågård & Søren Øster"),
  normalizeHostIdentity("Søren Øster og Anna Ågård")
);
assert.equal(
  normalizeUrlIdentity("HTTPS://Example.COM/show/?utm_source=test&series=42#episode"),
  "https://example.com/show?series=42"
);
assert.notEqual(
  normalizeUrlIdentity("https://example.com/show?series=42"),
  normalizeUrlIdentity("https://example.com/show?series=43")
);

for (const genre of genreConfig.allowedGenres) {
  const mapped = mapPrimaryGenre(genre, approvedGenreLookup);
  assert.equal(mapped.primaryGenre, genre);
  assert.equal(mapped.primaryGenreMappingType, "native");
}
assert.equal(mapPrimaryGenre(" true crime ", approvedGenreLookup).primaryGenre, "True Crime");
assert.equal(
  mapPrimaryGenre(" true crime ", approvedGenreLookup).primaryGenreMappingType,
  "capitalization"
);
assert.equal(mapPrimaryGenre("Unholdning", approvedGenreLookup).primaryGenre, "Underholdning");
assert.equal(
  mapPrimaryGenre("Unholdning", approvedGenreLookup).primaryGenreMappingType,
  "spelling"
);
for (const mapping of genreConfig.directMappings.filter(
  (entry) => entry.status === "approved"
)) {
  const mapped = mapPrimaryGenre(` ${mapping.source.toLocaleLowerCase("da-DK")} `, approvedGenreLookup);
  assert.equal(mapped.primaryGenre, mapping.target, mapping.source);
  assert.equal(mapped.primaryGenreMappingType, "direct", mapping.source);
  assert.equal(mapped.primaryGenreNeedsReview, false, mapping.source);
}
for (const mapping of genreConfig.conditionalMappings.filter(
  (entry) => entry.status === "approved"
)) {
  const mapped = mapPrimaryGenre(mapping.source, approvedGenreLookup);
  assert.equal(mapped.primaryGenre, mapping.target, mapping.source);
  assert.equal(mapped.primaryGenreMappingType, "conditional_default", mapping.source);
  assert.equal(mapped.primaryGenreNeedsReview, true, mapping.source);
  assert.equal(mapped.primaryGenreReviewReason, mapping.reviewReason, mapping.source);
}
const unknownGenre = mapPrimaryGenre("Ukendt genre", approvedGenreLookup);
assert.equal(unknownGenre.primaryGenre, "");
assert.equal(unknownGenre.primaryGenreValid, false);
assert.equal(unknownGenre.primaryGenreMappingType, "unmapped");
assert.equal(unknownGenre.primaryGenreNeedsReview, true);
assert.equal(unknownGenre.primaryGenreReviewReason, "unmapped_primary_genre");
assert.throws(
  () =>
    validateGenreConfig({
      ...genreConfig,
      directMappings: [
        ...genreConfig.directMappings,
        {
          source: "Fejl",
          target: "Ukendt",
          type: "direct",
          status: "approved",
          note: "test"
        }
      ]
    }),
  /unknown target/u
);
assert.throws(
  () =>
    validateGenreConfig({
      ...genreConfig,
      directMappings: [
        ...genreConfig.directMappings,
        {
          source: "Politik",
          target: "Viden",
          type: "direct",
          status: "approved",
          note: "test"
        }
      ]
    }),
  /Multiple approved genre mappings/u
);
assert.throws(
  () =>
    validateGenreConfig({
      ...genreConfig,
      conditionalMappings: [
        {
          source: "Test",
          target: "Dokumentar",
          type: "conditional_default",
          status: "approved",
          note: "test"
        }
      ]
    }),
  /must have a reviewReason/u
);
assert.throws(
  () =>
    validateGenreConfig({
      ...genreConfig,
      directMappings: [
        {
          source: "Sport",
          target: "Viden",
          type: "direct",
          status: "approved",
          note: "test"
        }
      ]
    }),
  /Canonical genre.*cannot map/u
);
assert.throws(
  () =>
    validateGenreConfig({
      ...genreConfig,
      technicalAliases: [
        {
          source: "Fejl",
          target: "Underholdning",
          type: "fuzzy",
          status: "approved",
          note: "test"
        }
      ]
    }),
  /invalid type/u
);
assert.throws(
  () =>
    validateGenreConfig({
      ...genreConfig,
      technicalAliases: [
        {
          source: "Fejl",
          target: "Underholdning",
          type: "spelling",
          status: "automatic",
          note: "test"
        }
      ]
    }),
  /invalid status/u
);

const samplePayload = {
  generatedAt: "2026-07-28T00:00:00.000Z",
  count: 4,
  rows: [
    {
      Titel: "Gyldig",
      Genre: "Sport",
      Udgiver: "Third Ear",
      secondaryGenre: "",
      topics: ["dansk fodbold", "Dansk fodbold"],
      Link: "https://example.com/gyldig",
      Billedlink: "https://example.com/gyldig.jpg"
    },
    {
      Titel: "Ugyldig",
      Genre: "Fodbold",
      secondaryGenre: "Sport",
      topics: ["Økonomi"]
    },
    {
      Titel: "Samme genre",
      Genre: "Viden",
      secondaryGenre: "Viden",
      topics: ["Forskning"]
    },
    {
      Titel: "Uden emner",
      Genre: "Historie",
      secondaryGenre: "",
      topics: []
    }
  ]
};
const built = buildRecommendationData(samplePayload, aliasConfig, genreConfig);
const genreConfigWithoutFodbold = {
  ...genreConfig,
  directMappings: genreConfig.directMappings.filter((entry) => entry.source !== "Fodbold")
};
const builtWithoutFodboldMapping = buildRecommendationData(
  samplePayload,
  aliasConfig,
  genreConfigWithoutFodbold
);
assert.deepEqual(
  built.payload.rows.map((row) => row.id),
  builtWithoutFodboldMapping.payload.rows.map((row) => row.id)
);
assert.deepEqual(
  built.payload.rows.map((row) => row.recommendationId),
  builtWithoutFodboldMapping.payload.rows.map((row) => row.recommendationId)
);
assert.equal(built.payload.rows[0].primaryGenreValid, true);
assert.equal(built.payload.rows[0].id, podcastKey(samplePayload.rows[0].Titel));
assert.ok(built.payload.rows.every((row) => row.recommendationId));
assert.equal(new Set(built.payload.rows.map((row) => row.recommendationId)).size, 4);
assert.equal(built.payload.rows[0].mainSeries, "Third Ear");
assert.equal(built.payload.rows[0].secondaryGenreValid, true);
assert.equal(built.payload.rows[1].secondaryGenre, samplePayload.rows[1].secondaryGenre);
assert.equal(built.payload.rows[0].topicEligible, true);
assert.equal(built.payload.rows[0].recommendationMetadataEligible, true);
assert.deepEqual(built.payload.rows[0].topicsCanonical, ["Dansk fodbold"]);
assert.deepEqual(built.payload.rows[1].topicsRaw, samplePayload.rows[1].topics);
assert.deepEqual(built.payload.rows[1].topicsCanonical, samplePayload.rows[1].topics);
assert.ok(built.payload.rows[0].metadataIssues.includes("topic_alias_applied"));
assert.ok(built.payload.rows[0].metadataIssues.includes("duplicate_topic_after_alias"));
assert.equal(built.payload.rows[1].primaryGenre, "Sport");
assert.equal(built.payload.rows[1].primaryGenreRaw, "Fodbold");
assert.equal(built.payload.rows[1].primaryGenreMappingType, "direct");
assert.equal(built.payload.rows[1].genreEligible, true);
assert.equal(built.payload.rows[1].recommendationMetadataEligible, true);
assert.ok(!built.payload.rows[1].metadataIssues.includes("invalid_primary_genre"));
assert.ok(built.payload.rows[2].metadataIssues.includes("same_primary_secondary_genre"));
assert.equal(built.payload.rows[3].topicEligible, false);
assert.ok(built.payload.rows[3].metadataIssues.includes("missing_topics"));

const identityRows = [
  {
    Titel: "Samme titel",
    Vært: "Anna Ågård & Søren Øster",
    Genre: "Viden",
    Udgiver: "Udgiver A",
    Link: "https://example.com/show?series=42&utm_medium=test#fragment",
    Billedlink: "https://example.com/a.jpg",
    topics: []
  },
  {
    Titel: "Samme titel",
    Vært: "Søren Øster og Anna Ågård",
    Genre: "Viden",
    Udgiver: "Udgiver B",
    Link: "https://example.com/show/?series=42#other-fragment",
    Billedlink: "https://example.com/b.jpg",
    topics: []
  },
  {
    Titel: "Uden link",
    Genre: "Historie",
    Udgiver: "Udgiver A",
    Link: "",
    Billedlink: "https://example.com/no-link.jpg",
    topics: []
  }
];
const identityPayload = { generatedAt: "first-build", rows: identityRows };
const identityBuilt = buildRecommendationData(
  identityPayload,
  { version: 1, aliases: [] },
  genreConfig
);
assert.equal(identityBuilt.payload.rows[0].id, identityBuilt.payload.rows[1].id);
assert.notEqual(
  identityBuilt.payload.rows[0].recommendationId,
  identityBuilt.payload.rows[1].recommendationId
);
assert.ok(identityBuilt.payload.rows[2].recommendationId);
const samePublisherDifferentLinks = buildRecommendationData(
  {
    rows: [
      {
        Titel: "Linkserie",
        Genre: "Viden",
        Udgiver: "Samme udgiver",
        Link: "https://example.com/show?series=42",
        Billedlink: "https://example.com/42.jpg",
        topics: []
      },
      {
        Titel: "Linkserie",
        Genre: "Viden",
        Udgiver: "Samme udgiver",
        Link: "https://example.com/show?series=43",
        Billedlink: "https://example.com/43.jpg",
        topics: []
      }
    ]
  },
  { version: 1, aliases: [] },
  genreConfig
);
assert.notEqual(
  samePublisherDifferentLinks.payload.rows[0].recommendationId,
  samePublisherDifferentLinks.payload.rows[1].recommendationId
);
const identityByPublisher = new Map(
  identityBuilt.payload.rows.map((row, index) => [
    `${row.title}|${identityRows[index].Udgiver}`,
    row.recommendationId
  ])
);
const reversedIdentityRows = [...identityRows].reverse();
const reorderedBuilt = buildRecommendationData(
  { generatedAt: "different-build-time", rows: reversedIdentityRows },
  { version: 1, aliases: [] },
  genreConfig
);
const reorderedByPublisher = new Map(
  reorderedBuilt.payload.rows.map((row, index) => [
    `${row.title}|${reversedIdentityRows[index].Udgiver}`,
    row.recommendationId
  ])
);
assert.equal(
  identityByPublisher.get("Samme titel|Udgiver A"),
  reorderedByPublisher.get("Samme titel|Udgiver A")
);
assert.equal(
  identityByPublisher.get("Samme titel|Udgiver B"),
  reorderedByPublisher.get("Samme titel|Udgiver B")
);

assert.throws(
  () =>
    buildRecommendationData(
      {
        rows: [
          {
            Titel: "Kollision",
            Genre: "Viden",
            topics: ["før", "foer"]
          }
        ]
      },
      { version: 1, aliases: [] },
      genreConfig
    ),
  /Topic key collision.*foer.*(?:før.*foer|foer.*før)/u
);

function topicFixture(rows, aliases = []) {
  return buildRecommendationData(
    {
      rows: rows.map((row, index) => ({
        Titel: row.title ?? `Emnetest ${index + 1}`,
        Genre: "Viden",
        Udgiver: `Udgiver ${index + 1}`,
        Link: `https://example.com/topic-${index + 1}`,
        Billedlink: `https://example.com/topic-${index + 1}.jpg`,
        topics: row.topics
      }))
    },
    { version: 1, aliases },
    genreConfig
  );
}

const capitalizationTopics = topicFixture([
  { topics: ["Familiehemmeligheder"] },
  { topics: ["familiehemmeligheder"] }
]);
assert.deepEqual(
  capitalizationTopics.payload.rows.map((row) => row.topicsCanonical),
  [["Familiehemmeligheder"], ["Familiehemmeligheder"]]
);
assert.equal(capitalizationTopics.payload.summary.safeTopicCollisionGroups, 1);
assert.equal(capitalizationTopics.payload.summary.unsafeTopicCollisionGroups, 0);

const frequentSpelling = topicFixture([
  { topics: ["dansk politik"] },
  { topics: ["dansk politik"] },
  { topics: ["Dansk politik"] }
]);
assert.ok(frequentSpelling.payload.rows.every((row) => row.topicsCanonical[0] === "dansk politik"));

const tiedCapitalization = topicFixture([
  { topics: ["mediekritik"] },
  { topics: ["Mediekritik"] }
]);
assert.ok(tiedCapitalization.payload.rows.every((row) => row.topicsCanonical[0] === "Mediekritik"));

const acronymTopics = topicFixture([{ topics: ["dna"] }, { topics: ["DNA"] }]);
assert.ok(acronymTopics.payload.rows.every((row) => row.topicsCanonical[0] === "DNA"));

const nfkcTopics = topicFixture([{ topics: ["ＤＮＡ"] }, { topics: ["DNA"] }]);
assert.ok(nfkcTopics.payload.rows.every((row) => row.topicsCanonical[0] === "DNA"));

const whitespaceTopics = topicFixture([
  { topics: ["Familie   hemmeligheder"] },
  { topics: [" Familie hemmeligheder "] }
]);
assert.ok(
  whitespaceTopics.payload.rows.every(
    (row) => row.topicsCanonical[0] === "Familie hemmeligheder"
  )
);

assert.throws(
  () => topicFixture([{ topics: ["politik/snakke"] }, { topics: ["politik snakke"] }]),
  /Topic key collision/u
);
assert.throws(
  () => topicFixture([{ topics: ["mål"] }, { topics: ["maal"] }]),
  /Topic key collision/u
);
const distinctSingularPlural = topicFixture([{ topics: ["krig"] }, { topics: ["krige"] }]);
assert.equal(distinctSingularPlural.payload.summary.normalizedTopicIdentities, 2);
assert.notEqual(
  distinctSingularPlural.payload.rows[0].topicKeys[0],
  distinctSingularPlural.payload.rows[1].topicKeys[0]
);

const orderedTopics = topicFixture([
  {
    topics: [
      "Familiehemmeligheder",
      "Svindel",
      "familiehemmeligheder",
      "Politik"
    ]
  }
]);
assert.deepEqual(orderedTopics.payload.rows[0].topicsCanonical, [
  "Familiehemmeligheder",
  "Svindel",
  "Politik"
]);
assert.deepEqual(orderedTopics.payload.rows[0].topicsRaw, [
  "Familiehemmeligheder",
  "Svindel",
  "familiehemmeligheder",
  "Politik"
]);

const reversedTopicRows = [...frequentSpelling.payload.rows].reverse();
const frequentReversed = topicFixture([
  { topics: ["Dansk politik"] },
  { topics: ["dansk politik"] },
  { topics: ["dansk politik"] }
]);
assert.ok(frequentReversed.payload.rows.every((row) => row.topicsCanonical[0] === "dansk politik"));
assert.equal(reversedTopicRows.length, frequentReversed.payload.rows.length);
assert.throws(
  () =>
    buildRecommendationData(
      {
        rows: [
          {
            Titel: "Identisk",
            Genre: "Viden",
            Udgiver: "DR",
            Link: "https://example.com/show",
            Billedlink: "https://example.com/same.jpg",
            topics: []
          },
          {
            Titel: "Identisk",
            Genre: "Viden",
            Udgiver: "DR",
            Link: "https://example.com/show",
            Billedlink: "https://example.com/same.jpg",
            topics: []
          }
        ]
      },
      { version: 1, aliases: [] },
      genreConfig
    ),
  /RecommendationId collision.*Identisk/u
);

const temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "recommendation-metadata-test-"));
try {
  const inputPath = path.join(temporaryDirectory, "podcasts.json");
  const aliasPath = path.join(temporaryDirectory, "aliases.json");
  const genreMappingPath = path.join(temporaryDirectory, "genres.json");
  const outputPath = path.join(temporaryDirectory, "recommendation.json");
  const readinessPath = path.join(temporaryDirectory, "readiness.md");
  const identityCsvPath = path.join(temporaryDirectory, "identity.csv");
  const identityReportPath = path.join(temporaryDirectory, "identity.md");
  const genreCsvPath = path.join(temporaryDirectory, "genre.csv");
  const genreUnmappedCsvPath = path.join(temporaryDirectory, "genre-unmapped.csv");
  const genreReportPath = path.join(temporaryDirectory, "genre.md");
  const topicCollisionCsvPath = path.join(temporaryDirectory, "topic-collisions.csv");
  const topicCollisionReportPath = path.join(temporaryDirectory, "topic-collisions.md");
  const sourceText = `${JSON.stringify(samplePayload, null, 2)}\n`;
  await writeFile(inputPath, sourceText, "utf8");
  await writeFile(aliasPath, `${JSON.stringify(aliasConfig, null, 2)}\n`, "utf8");
  await writeFile(genreMappingPath, `${JSON.stringify(genreConfig, null, 2)}\n`, "utf8");

  await writeRecommendationArtifacts({
    inputPath,
    aliasPath,
    genreMappingPath,
    outputPath,
    readinessPath,
    identityCsvPath,
    identityReportPath,
    genreCsvPath,
    genreUnmappedCsvPath,
    genreReportPath,
    topicCollisionCsvPath,
    topicCollisionReportPath,
    repoRoot: temporaryDirectory
  });
  const firstOutput = await readFile(outputPath);
  const firstReadiness = await readFile(readinessPath);
  const firstIdentityCsv = await readFile(identityCsvPath);
  const firstIdentityReport = await readFile(identityReportPath);
  const firstGenreCsv = await readFile(genreCsvPath);
  const firstGenreUnmappedCsv = await readFile(genreUnmappedCsvPath);
  const firstGenreReport = await readFile(genreReportPath);
  const firstTopicCollisionCsv = await readFile(topicCollisionCsvPath);
  const firstTopicCollisionReport = await readFile(topicCollisionReportPath);
  await writeRecommendationArtifacts({
    inputPath,
    aliasPath,
    genreMappingPath,
    outputPath,
    readinessPath,
    identityCsvPath,
    identityReportPath,
    genreCsvPath,
    genreUnmappedCsvPath,
    genreReportPath,
    topicCollisionCsvPath,
    topicCollisionReportPath,
    repoRoot: temporaryDirectory
  });
  assert.deepEqual(await readFile(outputPath), firstOutput);
  assert.deepEqual(await readFile(readinessPath), firstReadiness);
  assert.deepEqual(await readFile(identityCsvPath), firstIdentityCsv);
  assert.deepEqual(await readFile(identityReportPath), firstIdentityReport);
  assert.deepEqual(await readFile(genreCsvPath), firstGenreCsv);
  assert.deepEqual(await readFile(genreUnmappedCsvPath), firstGenreUnmappedCsv);
  assert.deepEqual(await readFile(genreReportPath), firstGenreReport);
  assert.deepEqual(await readFile(topicCollisionCsvPath), firstTopicCollisionCsv);
  assert.deepEqual(await readFile(topicCollisionReportPath), firstTopicCollisionReport);
  assert.equal(await readFile(inputPath, "utf8"), sourceText);
  assert.doesNotThrow(() => JSON.parse(firstOutput.toString("utf8")));
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log("Recommendation metadata tests passed.");
