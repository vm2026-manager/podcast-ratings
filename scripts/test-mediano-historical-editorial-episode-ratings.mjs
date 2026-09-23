import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, payload] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")
]);
const rows = JSON.parse(payload).rows || [];
const aliases = {
  "mediano special hvad siger data om superligaen": "mediano special",
  "sagen om de 15 point forsvandt fra i lommen af den gamle dame": "mediano special",
  "her er vores bud pa de ti spillere har været de største transfersucceser i superligaen": "transfer special",
  "kristjaan speakmann": "bruchmann ringer til",
  "der var engang et mal af peter møller mod farum": "der var engang et mal",
  "vi præsenterer erik skjærbæk": "klub mediano",
  "ciao gianni": "magasinet jennings"
};
const scoreFor = (id) => String(rows.find((row) => row["Podcast-ID"] === id)?.["Vuring (1-10)"] || "").trim();
const normalizeText = (value) => String(value ?? "").trim();
const normalizeMatchKey = (value) => normalizeText(value)
  .toLocaleLowerCase("da-DK")
  .replace(/[^a-z0-9æøå ]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const getField = (row, candidates) => row[candidates[0]];
const sourceFunction = (name, nextName) => {
  const start = app.indexOf(`function ${name}`);
  const end = app.indexOf(`\nfunction ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return app.slice(start, end);
};
const mergeManualEpisodeEntries = new Function(
  "normalizeText",
  "normalizeMatchKey",
  `${sourceFunction("mergeManualEpisodeEntries", "getManualEpisodeEditorialRating")}\nreturn mergeManualEpisodeEntries;`
)(normalizeText, normalizeMatchKey);
const buildHistoricalMedianoEpisodeEntries = new Function(
  "normalizeText",
  "getField",
  "MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS",
  "MEDIANO_HISTORICAL_CATALOGUE_CANONICAL_EPISODE_IDS",
  `${sourceFunction("buildHistoricalMedianoEpisodeEntries", "withHistoricalMedianoEpisodeEntries")}\nreturn buildHistoricalMedianoEpisodeEntries;`
)(normalizeText, getField, aliases, {});

assert.deepEqual(
  Object.fromEntries(Object.keys(aliases).map((id) => [id, scoreFor(id)])),
  {
    "mediano special hvad siger data om superligaen": "8,3",
    "sagen om de 15 point forsvandt fra i lommen af den gamle dame": "6,7",
    "her er vores bud pa de ti spillere har været de største transfersucceser i superligaen": "7,3",
    "kristjaan speakmann": "5,8",
    "der var engang et mal af peter møller mod farum": "7,3",
    "vi præsenterer erik skjærbæk": "6,7",
    "ciao gianni": "7"
  },
  "representative editorial scores are read from the current catalogue payload"
);

for (const [legacyId, canonicalId] of Object.entries(aliases)) {
  assert.match(app, new RegExp(`"${legacyId}": "${canonicalId}"`, "u"));
}

const historicalEntries = buildHistoricalMedianoEpisodeEntries(
  rows,
  new Set(Object.values(aliases))
);
for (const [legacyId, canonicalId] of Object.entries(aliases)) {
  const expectedTitle = rows.find((row) => row["Podcast-ID"] === legacyId).Titel;
  const entry = historicalEntries.get(canonicalId)?.find((candidate) => candidate.title === expectedTitle);
  assert.equal(entry?.editorialRating, scoreFor(legacyId), `${legacyId} keeps its catalogue score`);
}

const preconfiguredTitle = "Sagen om de 15 point, forsvandt fra i lommen af Den Gamle Dame";
const liveCatalogueTitle = rows.find((row) => row["Podcast-ID"] === "sagen om de 15 point forsvandt fra i lommen af den gamle dame").Titel;
const mergedEntries = mergeManualEpisodeEntries(
  [preconfiguredTitle],
  [{ title: liveCatalogueTitle, editorialRating: "6,7" }]
);
assert.equal(mergedEntries.length, 1, "an existing manual episode is not duplicated");
assert.equal(mergedEntries[0].editorialRating, "6,7", "the live catalogue score is retained on that episode");

assert.match(app, /function buildHistoricalMedianoEpisodeEntries\(podcastRows, catalogueIds\)/u);
assert.match(app, /editorialRating: getField\(row, \["Vuring \(1-10\)"\]\)/u);
assert.match(app, /function mergeManualEpisodeEntries/u);
assert.match(app, /existing\.editorialRating.*entry\.editorialRating/us);
assert.match(app, /editorial_rating: getManualEpisodeEditorialRating\(podcast, title\)/u);
assert.match(app, /Podcastlistens vurdering:/u);
assert.match(app, /podcast-detail-sheet__episode-source-score/u);
assert.match(app, /podcast-detail-sheet__episode-own-score/u);
assert.match(app, /"magasinet jennings"[\s\S]*?includeManualEpisodes/u);

// The resolution path must use only reviewed source identities. Similar text
// without an exact legacy Podcast-ID is not eligible for an editorial score.
const unknownLegacyId = "mediano special hvad siger data om superligaen ekstra";
assert.equal(aliases[unknownLegacyId], undefined);
assert.doesNotMatch(app, /MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS\[[^\]]*normalizeMatchKey/u);

console.log("Mediano historical editorial episode-rating regression checks passed.");
