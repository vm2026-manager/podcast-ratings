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
const ids = ["bedraget", "bedraget pa hvidovre hospital", "super", "superligaens sandheder", "the super always rings twice", "bomben", "genvej", "kapret", "barn med den forkerte sæson 1", "barn med den forkerte sæson 2", "kvinden med den tunge kuffert", "kvinden med den tunge kuffert det sidste kapitel", "agenterne politiken", "agenterne ekstra bladet", "bjarne corydon", "fa mere eventyr ind i hverdagen", "christian fuhlendorff", "joachim b olsen", "helle thorning", "saddam hussein", "hvem bortførte vores børn", "anders fogh", "hva sa"];
const context = { console, state: { podcastById: Object.fromEntries(ids.map((podcastId) => [podcastId, { podcastId }])), podcastByLegacyKey: {}, userRatingPersistedKeyByCanonical: {}, userRatingsByKey: {} } };
vm.createContext(context);
vm.runInContext([aliases[0], "function normalizeText(v) { return String(v ?? '').trim(); }", "function normalizeMatchKey(v) { return normalizeText(v).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/&/g, ' og ').replace(/[^a-z0-9æøå]+/g, ' ').replace(/\\s+/g, ' ').trim(); }", "function parseNumber(v) { const n = Number(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; }", extract("getPodcastId"), extract("getLegacyPodcastKey"), extract("getPodcastKey"), extract("resolvePodcastByStoredKey"), extract("resolveCanonicalPodcastId"), extract("canonicalizeCommunityStats"), extract("canonicalizeUserRatingRows"), extract("getPersistedUserRatingKey"), extract("getUserRatingForPodcast")].join("\n\n"), context);

const expected = [["agenterne politiken", ids[12]], ["et kapitel for sig bjarne corydon", ids[14]], ["adfærd fa mere eventyr ind i hverdagen med morten kirckhoff fra 0 stjerner", ids[15]], ["et kapitel for sig christian fuhlendorff", ids[16]], ["et kapitel for sig joachim b olsen", ids[17]], ["et kapitel for sig helle thorning", ids[18]], ["tyran saddam hussein", ids[19]], ["mørklagt hvem bortførte vores børn", ids[20]], ["et kapitel for sig anders fogh", ids[21]]];
for (const [legacy, canonical] of expected) assert.equal(context.resolveCanonicalPodcastId(legacy), canonical);
assert.equal(context.resolveCanonicalPodcastId("similar but unrelated"), "");
assert.equal(context.resolveCanonicalPodcastId("hva så"), "", "The duplicate historical key must remain unresolved until public deduplication exists");
for (const rows of [[{ podcast_key: "mørklagt hvem bortførte vores børn", average_rating: 8.5, rating_count: 1 }, { podcast_key: "hvem bortførte vores børn", average_rating: 8, rating_count: 1 }], [{ podcast_key: "hvem bortførte vores børn", average_rating: 8, rating_count: 1 }, { podcast_key: "mørklagt hvem bortførte vores børn", average_rating: 8.5, rating_count: 1 }]]) { const stat = context.canonicalizeCommunityStats(rows).statsByKey[ids[20]]; assert.equal(stat.averageRating, 8.25); assert.equal(stat.ratingCount, 2); }
assert.equal(context.resolveCanonicalPodcastId("bedraget"), ids[0]);
assert.equal(context.resolveCanonicalPodcastId(ids[1]), ids[1]);
let hydrated = context.canonicalizeUserRatingRows([{ podcast_key: "bedraget", rating: 8 }]);
context.state.userRatingPersistedKeyByCanonical = hydrated.persistedKeyByCanonical;
assert.equal(context.getPersistedUserRatingKey(ids[0]), "bedraget");
assert.equal(context.getPersistedUserRatingKey(ids[1]), ids[1]);

function ownRating(podcastId, ratings) {
  context.state.userRatingsByKey = { ...ratings };
  return context.getUserRatingForPodcast({ podcastId, title: podcastId });
}

assert.equal(ownRating(ids[2], { [ids[3]]: 6.4 }), null, "Super must not inherit Superligaens Sandheder");
assert.equal(ownRating(ids[2], { [ids[2]]: 6.4 }), 6.4, "Super must retain its exact rating");
assert.equal(ownRating(ids[2], { [ids[4]]: 8.2 }), null, "The Super Always Rings Twice must not leak to Super");
assert.equal(ownRating(ids[0], { [ids[0]]: 7.9 }), 7.9, "Bedraget belongs to Mayday");
assert.equal(ownRating(ids[1], { [ids[0]]: 7.9 }), null, "Mayday Bedraget must not leak to Hvidovre");
assert.equal(ownRating(ids[8], { [ids[9]]: 8.4 }), null, "Season 1 must not leak to season 2");
assert.equal(ownRating(ids[10], { [ids[11]]: 8.7 }), null, "Kvinden series must remain distinct");
assert.equal(ownRating(ids[13], { [ids[12]]: 6.9 }), null, "Politiken Agenterne must not leak to Ekstra Bladet");
for (const shortId of [ids[2], ids[5], ids[6], ids[7]]) assert.equal(ownRating(shortId, { [`${shortId} extended title`]: 9 }), null, `${shortId} must not match a containing title`);
hydrated = context.canonicalizeUserRatingRows([{ podcast_key: "et kapitel for sig bjarne corydon", rating: 8 }]);
assert.equal(ownRating(ids[14], hydrated.ratingsByKey), 8, "Canonicalized explicit legacy aliases remain accessible");
assert.match(source, /podcast_key: persistedKey/); assert.match(source, /\.eq\("podcast_key", persistedKey\)/);
console.log("community rating identity regression tests passed");
