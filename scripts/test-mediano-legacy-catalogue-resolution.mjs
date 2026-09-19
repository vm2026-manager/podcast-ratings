import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, payload] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")
]);
const rows = (JSON.parse(payload).rows || []).map((row) => ({
  id: String(row["Podcast-ID"] || "").trim(),
  title: String(row.Titel || "").trim(),
  publisher: String(row.Udgiver || "").trim(),
  mainSeries: String(row.Hovedserie || "").trim(),
  rating: String(row["Vuring (1-10)"] || "").trim()
}));

const aliases = {
  "vi præsenterer erik skjærbæk": "klub mediano",
  "sadan blev han victor froholdt": "klub mediano",
  "sådan blev han victor froholdt": "klub mediano",
  "den store talentserie": "klub mediano"
  , "mediano special hvad siger data om superligaen": "mediano special"
};
const jenningsLegacyIds = rows.filter((row) => row.publisher === "Mediano" && row.mainSeries === "Jennings").map((row) => row.id);
assert.equal(jenningsLegacyIds.length, 18, "all reviewed Jennings legacy rows are enumerated");
const jenningsAliases = Object.fromEntries(jenningsLegacyIds.map((id) => [id, "magasinet jennings"]));
Object.assign(aliases, jenningsAliases);
const localCanonicalIds = new Set(["magasinet jennings", "mediano special", "transfer special", "bruchmann ringer til", "der var engang et mal"]);
const canonicalIds = new Set(rows.map((row) => row.id));
const visibleIds = new Set([
  ...localCanonicalIds,
  ...rows
    .filter((row) => !aliases[row.id] || !(canonicalIds.has(aliases[row.id]) || localCanonicalIds.has(aliases[row.id])))
    .map((row) => row.id)
]);

assert.equal(rows.find((row) => row.id === "vi præsenterer erik skjærbæk")?.mainSeries, "Klub Mediano");
assert.equal(rows.find((row) => row.id === "sadan blev han victor froholdt")?.mainSeries, "Klub Mediano");
assert.equal(rows.find((row) => row.id === "klub mediano")?.title, "Klub Mediano");
assert.equal(rows.find((row) => row.id === "klub mediano")?.publisher, "Mediano");
assert.equal(visibleIds.has("vi præsenterer erik skjærbæk"), false);
assert.equal(visibleIds.has("sadan blev han victor froholdt"), false);
assert.equal(visibleIds.has("den store talentserie"), false);
assert.equal(visibleIds.has("mediano special hvad siger data om superligaen"), false);
assert.equal(visibleIds.has("mediano special"), true);
assert.equal(visibleIds.has("klub mediano"), true);
assert.equal(visibleIds.has("ciao gianni"), false);
assert.equal(visibleIds.has("infantino abner for russisk comeback dbu reagerer"), false);
assert.match(app, /"Podcast-ID": "magasinet jennings"/u);
assert.match(app, /Titel: "Magasinet Jennings"/u);
assert.match(app, /source: "mediano_public_rss"/u);

// No title-prefix or colon-based suppression: reviewed-but-unresolved parents
// remain current catalogue identities until a canonical catalogue row exists.
for (const id of [
  "mediano em speciel 2021",
  "super",
  "troels bech i en samtale",
  "vm manager special"
]) assert.equal(visibleIds.has(id), true, `${id} must remain visible without a present canonical target`);

assert.match(app, /MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS/u);
assert.match(app, /const canonicalId = MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS\[storedKey\]/u);
assert.match(app, /cataloguePodcastIds\.has\(canonicalId\)/u);
assert.match(app, /state\.podcastByKey\[legacyKey\] = canonicalPodcast/u);
assert.match(app, /"sadan blev han victor froholdt": "klub mediano"/u);
assert.match(app, /"sådan blev han victor froholdt": "klub mediano"/u);
assert.match(app, /"den store talentserie": "klub mediano"/u);
assert.match(app, /"mediano special hvad siger data om superligaen": "mediano special"/u);
assert.match(app, /LOCAL_CANONICAL_CATALOGUE_ROW_PATCHES/u);
assert.match(app, /title: "Den store talentserie"/u);
assert.match(app, /manualEpisodeKey: "den-store-talentserie"/u);
assert.match(app, /manualEpisodeKey: "mediano-special-hvad-siger-data-om-superligaen"/u);
assert.match(app, /"klub mediano"[\s\S]*?includeManualEpisodes/u);

// Existing ratings and saved-podcast resolvers operate through
// resolvePodcastByStoredKey(), so these explicit old keys are canonicalized
// before their raw persisted key is retained for writes.
assert.match(app, /function resolveCanonicalPodcastId[\s\S]*?resolvePodcastByStoredKey\(storedKey\)/u);
assert.match(app, /function resolveSavedPodcastKey[\s\S]*?resolveCanonicalPodcastId/u);
assert.match(app, /function getPersistedUserRatingKey[\s\S]*?userRatingPersistedKeyByCanonical/u);
assert.equal(rows.find((row) => row.id === "sadan blev han victor froholdt")?.title, "Sådan blev han Victor Froholdt");

console.log("Mediano legacy catalogue resolution regression checks passed.");
