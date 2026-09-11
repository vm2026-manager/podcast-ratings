import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function extract(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}
const aliases = source.match(/const LEGACY_PODCAST_RATING_KEY_ALIASES = Object\.freeze\([\s\S]*?\n\}\);/);
assert.ok(aliases);
const ids = ["bedraget pa hvidovre hospital", "agenterne politiken", "bjarne corydon", "fa mere eventyr ind i hverdagen", "christian fuhlendorff", "joachim b olsen", "helle thorning", "saddam hussein", "hvem bortførte vores børn", "anders fogh"];
const context = { console, state: { podcastById: Object.fromEntries(ids.map((podcastId) => [podcastId, { podcastId }])), podcastByLegacyKey: {}, userRatingPersistedKeyByCanonical: {} } };
vm.createContext(context);
vm.runInContext([aliases[0], "function normalizeText(v) { return String(v ?? '').trim(); }", "function normalizeMatchKey(v) { return normalizeText(v).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/&/g, ' og ').replace(/[^a-z0-9æøå]+/g, ' ').replace(/\\s+/g, ' ').trim(); }", "function parseNumber(v) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; }", extract("getPodcastId"), extract("resolvePodcastByStoredKey"), extract("resolveCanonicalPodcastId"), extract("canonicalizeCommunityStats"), extract("canonicalizeUserRatingRows"), extract("getPersistedUserRatingKey")].join("\n\n"), context);

const expected = [["bedraget", ids[0]], ["agenterne politiken", ids[1]], ["et kapitel for sig bjarne corydon", ids[2]], ["adfærd fa mere eventyr ind i hverdagen med morten kirckhoff fra 0 stjerner", ids[3]], ["et kapitel for sig christian fuhlendorff", ids[4]], ["et kapitel for sig joachim b olsen", ids[5]], ["et kapitel for sig helle thorning", ids[6]], ["tyran saddam hussein", ids[7]], ["mørklagt hvem bortførte vores børn", ids[8]], ["et kapitel for sig anders fogh", ids[9]]];
for (const [legacy, canonical] of expected) assert.equal(context.resolveCanonicalPodcastId(legacy), canonical);
assert.equal(context.resolveCanonicalPodcastId("similar but unrelated"), "");
for (const rows of [[{ podcast_key: "mørklagt hvem bortførte vores børn", average_rating: 8.5, rating_count: 1 }, { podcast_key: "hvem bortførte vores børn", average_rating: 8, rating_count: 1 }], [{ podcast_key: "hvem bortførte vores børn", average_rating: 8, rating_count: 1 }, { podcast_key: "mørklagt hvem bortførte vores børn", average_rating: 8.5, rating_count: 1 }]]) { const stat = context.canonicalizeCommunityStats(rows).statsByKey[ids[8]]; assert.equal(stat.averageRating, 8.25); assert.equal(stat.ratingCount, 2); }
let stat = context.canonicalizeCommunityStats([{ podcast_key: "bedraget", average_rating: 9, rating_count: 1 }, { podcast_key: ids[0], average_rating: 7, rating_count: 3 }]).statsByKey[ids[0]];
assert.equal(stat.averageRating, 7.5); assert.equal(stat.ratingCount, 4);
let hydrated = context.canonicalizeUserRatingRows([{ podcast_key: "bedraget", rating: 8 }]);
context.state.userRatingPersistedKeyByCanonical = hydrated.persistedKeyByCanonical;
assert.equal(context.getPersistedUserRatingKey(ids[0]), "bedraget");
assert.equal(context.getPersistedUserRatingKey(ids[1]), ids[1]);
hydrated = context.canonicalizeUserRatingRows([{ podcast_key: "bedraget", rating: 7 }, { podcast_key: ids[0], rating: 9 }]);
assert.equal(hydrated.ratingsByKey[ids[0]], 9); assert.equal(hydrated.persistedKeyByCanonical[ids[0]], ids[0]); assert.equal(hydrated.duplicates.length, 1);
assert.match(source, /podcast_key: persistedKey/); assert.match(source, /\.eq\("podcast_key", persistedKey\)/);
console.log("community rating identity regression tests passed");
