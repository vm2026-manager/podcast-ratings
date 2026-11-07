import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");
const groups = JSON.parse(await readFile(new URL("../data/podcast-display-groups.json", import.meta.url), "utf8"));

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const open = app.indexOf(") {", start) + 2;
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = open; index < app.length; index += 1) {
    const character = app[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === quote) quote = "";
      continue;
    }
    if (["\"", "'", "`"].includes(character)) {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const group = groups.groups.find((item) => item.id === "kirsten-ringer-til-rasmus");
assert.ok(group);
assert.deepEqual(group.memberLegacyKeys, ["kirsten ringer til rasmus sæson 4"]);
assert.deepEqual(group.seasonIdentities.map(({ season }) => season), [1, 2, 3, 5, 6]);
assert.equal(group.memberLegacyKeys.length + group.seasonIdentities.length, 6);
assert.notEqual(`display-group:${group.id}`, group.memberLegacyKeys[0], "the direct podcast rating never reuses season 4's key");
assert.ok(group.seasonIdentities.every(({ podcast_key }) => podcast_key !== `display-group:${group.id}`));

const ratingState = new Map([
  ["display-group:kirsten-ringer-til-rasmus", 4.2],
  ["kirsten ringer til rasmus sæson 4", 8.5],
  ["display-season:kirsten-ringer-til-rasmus:5", 9.5]
]);
const getPodcastKey = (podcast) => podcast?.key || podcast?.legacyKey || "";
const getUserRating = (key) => ratingState.get(key) ?? null;
const parseNumber = (value) => value === null || value === undefined ? null : Number(value);
const stats = new Function("getPodcastKey", "getUserRating", "parseNumber", "isDisplayGroupRatingKey", extractFunction("getDisplayGroupOwnRatingStats") + "; return getDisplayGroupOwnRatingStats;")(
  getPodcastKey,
  getUserRating,
  parseNumber,
  (key) => key === "display-group:kirsten-ringer-til-rasmus"
);
const markup = new Function(
  "parseNumber", "formatCompactRating", "escapeHtml", "getPodcastKey", "isDisplayGroupRatingKey",
  extractFunction("getPodcastDisplayGroupOwnRatingMarkup") + "; return getPodcastDisplayGroupOwnRatingMarkup;"
)(parseNumber, (value) => Number(value).toFixed(1).replace(".", ","), String, getPodcastKey,
  (key) => key === "display-group:kirsten-ringer-til-rasmus");

const displayGroup = { legacyKey: `display-group:${group.id}`, title: group.title, isDisplayGroup: true };
const seasons = [
  { key: "kirsten ringer til rasmus sæson 4" },
  { key: "display-season:kirsten-ringer-til-rasmus:5" }
];
let own = stats(seasons, displayGroup);
assert.deepEqual(own, { directRating: 4.2, average: 9, count: 2 });
let html = markup(displayGroup, own);
assert.match(html, /4,2/u, "the direct whole-podcast value takes display priority");
assert.match(html, /Direkte vurdering af hele podcasten/u);
assert.match(html, /data-podcast-display-group-rate/u);
assert.match(html, /Redigér samlet/u);
assert.doesNotMatch(html, /Beregnet fra 2 sæsonvurderinger/u);
assert.equal(ratingState.get("kirsten ringer til rasmus sæson 4"), 8.5, "the existing season 4 score is untouched");
assert.equal(ratingState.get("display-season:kirsten-ringer-til-rasmus:5"), 9.5, "the existing synthetic season score is untouched");

const narkobetjenten = { legacyKey: "display-group:narkobetjenten", id: "narkobetjenten", title: "Narkobetjenten" };
const narkobetjentenOwn = stats(seasons, narkobetjenten);
assert.deepEqual(narkobetjentenOwn, { directRating: null, average: 9, count: 2 }, "Narkobetjenten keeps its season-derived rating");
const narkobetjentenMarkup = markup(narkobetjenten, narkobetjentenOwn);
assert.match(narkobetjentenMarkup, /is-episode-calculated/u);
assert.match(narkobetjentenMarkup, /data-podcast-detail-season-rating-lock-trigger/u);
assert.doesNotMatch(narkobetjentenMarkup, /data-podcast-display-group-rate/u, "Narkobetjenten keeps its existing season lock");

const rankingOwnScore = new Function(
  "isLoggedIn", "getDisplayGroupMemberPodcasts", "getDisplayGroupOwnRatingStats", "parseNumber", "getUserRatingForPodcast",
  extractFunction("getEffectiveOwnRatingForRanking") + "; return getEffectiveOwnRatingForRanking;"
)(() => true, () => seasons, stats, parseNumber, () => null);
assert.equal(rankingOwnScore(displayGroup), 4.2, "the group ranking uses a direct whole-podcast rating when present");

ratingState.delete(displayGroup.legacyKey);
own = stats(seasons, displayGroup);
assert.deepEqual(own, { directRating: null, average: 9, count: 2 }, "season-derived display remains the fallback without a direct score");
assert.equal(rankingOwnScore(displayGroup), 9, "season-derived ranking remains the fallback without a direct score");
html = markup(displayGroup, own);
assert.match(html, /9,0/u);
assert.match(html, /Beregnet fra 2 sæsonvurderinger/u);
assert.match(html, /Vurdér podcasten/u, "the group remains directly rateable alongside season scores");

let opened = null;
const bind = new Function("openRatingDialog", extractFunction("bindPodcastDisplayGroupRatingEvents") + "; return bindPodcastDisplayGroupRatingEvents;")(
  (podcast) => { opened = podcast; }
);
const button = { addEventListener: (_type, listener) => { button.listener = listener; } };
bind({ querySelector: () => button }, displayGroup);
button.listener();
assert.equal(opened, displayGroup, "the whole-podcast action opens its own rating dialog");

const dialogStart = app.indexOf("async function openRatingDialog(");
const dialogEnd = app.indexOf("\nfunction openEpisodeRatingDialog(", dialogStart);
const dialogSource = app.slice(dialogStart, dialogEnd);
assert.match(dialogSource, /!isDirectDisplayGroupRating && podcastSupportsEpisodes\(podcast\)/u,
  "direct group ratings do not inherit a season's episode lock");
assert.match(dialogSource, /ensurePodcastRatingEditState\(podcast, \{ retry: true \}\)/u,
  "season ratings still run their verified episode-lock check");
assert.doesNotMatch(dialogSource, /ensurePodcastRatingEditState\(podcast, \{ retry: true, force: true \}\)/u,
  "opening a dialog reuses the verified user-bound episode state");

console.log("display-group direct-rating identity, priority, fallback and action regressions passed.");
