import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const MOUNIR_LEGACY_ID = "landsholdets analytiker mounir akhiat";
const MOUNIR_TITLE = "Landsholdets analytiker: Mounir Akhiat";
const MOUNIR_UUID = "59389cfb-aa8c-40a3-94b4-9e2b04e832cc";
const THOMAS_TITLE = "Troels Bech i en samtale med Thomas Thomasberg";
const [app, payload] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")
]);
const rows = JSON.parse(payload).rows || [];
const mounirRow = rows.find((row) => row["Podcast-ID"] === MOUNIR_LEGACY_ID);

assert.deepEqual(
  {
    "Podcast-ID": mounirRow?.["Podcast-ID"],
    Titel: mounirRow?.Titel,
    "Vuring (1-10)": mounirRow?.["Vuring (1-10)"],
    Hovedserie: mounirRow?.Hovedserie
  },
  {
    "Podcast-ID": MOUNIR_LEGACY_ID,
    Titel: MOUNIR_TITLE,
    "Vuring (1-10)": "6,7",
    Hovedserie: "Bech bag bolden"
  },
  "the exact reviewed Mounir catalogue row remains the sole score source"
);

const normalizeText = (value) => String(value ?? "").trim();
const normalizeMatchKey = (value) => normalizeText(value)
  .toLocaleLowerCase("da-DK")
  .replace(/[^a-z0-9æøå ]/g, " ")
  .replace(/\s+/g, " ")
  .trim();
const parseNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const normalized = normalizeText(value).replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};
const getField = (row, candidates) => row[candidates[0]];
const sourceFunction = (name, nextName) => {
  const start = app.indexOf(`function ${name}`);
  const end = app.indexOf(`\nfunction ${nextName}`, start);
  assert.notEqual(start, -1, `${name} must exist`);
  assert.notEqual(end, -1, `${nextName} must follow ${name}`);
  return app.slice(start, end);
};
const aliases = { [MOUNIR_LEGACY_ID]: "troels bech i en samtale" };
const reviewedEpisodeIds = { [MOUNIR_LEGACY_ID]: MOUNIR_UUID };
const buildHistoricalMedianoEpisodeEntries = new Function(
  "normalizeText",
  "getField",
  "MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS",
  "MEDIANO_HISTORICAL_CATALOGUE_CANONICAL_EPISODE_IDS",
  `${sourceFunction("buildHistoricalMedianoEpisodeEntries", "withHistoricalMedianoEpisodeEntries")}\nreturn buildHistoricalMedianoEpisodeEntries;`
)(normalizeText, getField, aliases, reviewedEpisodeIds);
const getManualEpisodeCanonicalId = new Function(
  "normalizeText",
  "normalizeMatchKey",
  `${sourceFunction("getManualEpisodeCanonicalId", "parseManualEpisodeTitles")}\nreturn getManualEpisodeCanonicalId;`
)(normalizeText, normalizeMatchKey);

const historicalMounir = buildHistoricalMedianoEpisodeEntries(
  [mounirRow],
  new Set(["troels bech i en samtale"])
).get("troels bech i en samtale");
assert.equal(historicalMounir?.length, 1);
assert.equal(historicalMounir?.[0]?.title, MOUNIR_TITLE);
assert.equal(historicalMounir?.[0]?.editorialRating, "6,7");
assert.equal(historicalMounir?.[0]?.canonicalEpisodeId, MOUNIR_UUID);
assert.equal(
  getManualEpisodeCanonicalId(
    { manualEpisodeCanonicalIds: { [normalizeMatchKey(MOUNIR_TITLE)]: MOUNIR_UUID } },
    MOUNIR_TITLE
  ),
  MOUNIR_UUID,
  "the manual/catalogue representation resolves to the existing UUID"
);

const state = { manualCanonicalEpisodeMappings: new Map() };
const getEpisodeKey = new Function(
  "state",
  "normalizeText",
  `${sourceFunction("getEpisodeKey", "mergeEpisodes")}\nreturn getEpisodeKey;`
)(state, normalizeText);
const mergeEpisodes = new Function(
  "getEpisodeKey",
  "parseNumber",
  `${sourceFunction("mergeEpisodes", "formatEpisodeDate")}\nreturn mergeEpisodes;`
)(getEpisodeKey, parseNumber);
const remoteMounir = { id: MOUNIR_UUID, title: MOUNIR_TITLE, dataSource: "supabase", communityRating: 4.2, userRating: 3 };
const remoteThomas = { id: "a1f0dbde-8aa6-4eb3-8aa0-d67c6fe4ef5d", title: THOMAS_TITLE, dataSource: "supabase" };
const manualMounir = { id: MOUNIR_UUID, title: MOUNIR_TITLE, dataSource: "manual", editorial_rating: 6.7 };
const mergedEpisodes = mergeEpisodes([remoteMounir, remoteThomas], [manualMounir]);

assert.equal(mergedEpisodes.filter((episode) => episode.title === MOUNIR_TITLE).length, 1, "Mounir is not duplicated");
assert.equal(mergedEpisodes.length, 2, "the Mounir bridge does not add a second displayed episode");
assert.equal(mergedEpisodes[0].id, MOUNIR_UUID, "the remote Supabase UUID is retained");
assert.equal(mergedEpisodes[0].dataSource, "supabase", "the displayed episode remains the Supabase row");
assert.equal(mergedEpisodes[0].editorial_rating, 6.7, "catalogue editorial metadata is attached to that row");
assert.equal(mergedEpisodes[0].communityRating, 4.2, "community state is not reused as editorial state");
assert.equal(mergedEpisodes[0].userRating, 3, "personal state is not reused as editorial state");
assert.equal(mergedEpisodes[1], remoteThomas, "Thomas Thomasberg remains unchanged");

assert.match(app, /"landsholdets analytiker mounir akhiat": "troels bech i en samtale"/u);
assert.match(app, /"landsholdets analytiker mounir akhiat": "59389cfb-aa8c-40a3-94b4-9e2b04e832cc"/u);
assert.match(app, /"troels bech i en samtale"[\s\S]*?includeManualEpisodes/u);
assert.match(app, /Podcastlistens vurdering: <strong>\$\{escapeHtml\(formatCompactRating\(editorialScore\)\)\}\/10<\/strong>/u);
assert.match(app, /podcast-detail-sheet__episode-source-score/u);
assert.match(app, /podcast-detail-sheet__episode-own-score/u);
assert.match(app, /const uniqueManualEpisodeCount =/u);

console.log("Mounir canonical Mediano editorial-rating regression checks passed.");
