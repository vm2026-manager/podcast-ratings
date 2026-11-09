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
let activeRatingState = { resolved: true, count: 0, average: null };
const markup = new Function(
  "parseNumber", "formatCompactRating", "escapeHtml", "getPodcastKey", "isDisplayGroupRatingKey", "getPodcastRatingEditState", "getPodcastDisplayGroupSeasonLockMarkup",
  extractFunction("getPodcastDisplayGroupOwnRatingMarkup") + "; return getPodcastDisplayGroupOwnRatingMarkup;"
)(parseNumber, (value) => Number(value).toFixed(1).replace(".", ","), String, getPodcastKey,
  (key) => key === "display-group:kirsten-ringer-til-rasmus", () => activeRatingState,
  new Function("escapeHtml", "formatCompactRating", extractFunction("getPodcastDisplayGroupSeasonLockMarkup") + "; return getPodcastDisplayGroupSeasonLockMarkup;")(String, (value) => Number(value).toFixed(1).replace(".", ",")));

const displayGroup = { legacyKey: `display-group:${group.id}`, title: group.title, isDisplayGroup: true };
const seasons = [
  { key: "kirsten ringer til rasmus sæson 4" },
  { key: "display-season:kirsten-ringer-til-rasmus:5" }
];
let own = stats(seasons, displayGroup);
assert.deepEqual(own, { directRating: 4.2, average: 9, count: 2 });
activeRatingState = { resolved: false, count: 0, average: null, error: "" };
let html = markup(displayGroup, own);
assert.match(html, /Indlæser sæsonvurderinger/u);
assert.doesNotMatch(html, /data-podcast-display-group-rate/u, "an unverified state does not expose the direct editor");
activeRatingState = { resolved: false, count: 0, average: null, error: "Sæsonvurderingerne kunne ikke hentes lige nu." };
html = markup(displayGroup, own);
assert.match(html, /data-podcast-display-group-rating-retry/u);
assert.doesNotMatch(html, /data-podcast-display-group-rate/u, "a failed check remains locked until an explicit retry succeeds");
activeRatingState = { resolved: true, count: 0, average: null };
html = markup(displayGroup, { ...own, count: 0, average: null });
assert.match(html, /4,2/u, "a direct whole-podcast score remains available before any season is rated");
assert.match(html, /Direkte vurdering af hele podcasten/u);
assert.match(html, /data-podcast-display-group-rate/u);
assert.match(html, /Redigér samlet/u);
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
  "isLoggedIn", "getDisplayGroupMemberPodcasts", "getDisplayGroupOwnRatingStats", "parseNumber", "getUserRatingForPodcast", "getPodcastRatingEditState", "getPodcastKey", "isDisplayGroupRatingKey",
  extractFunction("getEffectiveOwnRatingForRanking") + "; return getEffectiveOwnRatingForRanking;"
)(() => true, () => seasons, stats, parseNumber, () => null, () => activeRatingState, getPodcastKey,
  (key) => key === "display-group:kirsten-ringer-til-rasmus");
activeRatingState = { resolved: false, count: 0, average: null, error: "offline" };
assert.equal(rankingOwnScore(displayGroup), null, "ranking does not show a stale direct score while season verification is unresolved");
activeRatingState = { resolved: true, count: 2, average: 9 };
assert.equal(rankingOwnScore(displayGroup), 9, "a season-derived score takes priority over a preserved direct score");
html = markup(displayGroup, own);
assert.match(html, /9,0/u);
assert.match(html, /Beregnet fra 2 sæsonvurderinger/u);
assert.match(html, /data-podcast-detail-season-rating-lock-trigger/u);
assert.doesNotMatch(html, /data-podcast-display-group-rate/u, "the direct editor closes once a season has been rated");

ratingState.delete(displayGroup.legacyKey);
own = stats(seasons, displayGroup);
assert.deepEqual(own, { directRating: null, average: 9, count: 2 }, "season-derived display remains the fallback without a direct score");
assert.equal(rankingOwnScore(displayGroup), 9, "season-derived ranking remains the fallback without a direct score");
activeRatingState = { resolved: true, count: 0, average: null };
own = stats([], displayGroup);
html = markup(displayGroup, own);
assert.match(html, /Vurdér podcasten/u, "after all season ratings are removed the direct editor is available again");

let opened = null;
const bind = new Function("openRatingDialog", extractFunction("bindPodcastDisplayGroupRatingEvents") + "; return bindPodcastDisplayGroupRatingEvents;")(
  (podcast) => { opened = podcast; }
);
const button = { addEventListener: (_type, listener) => { button.listener = listener; } };
bind({ querySelector: (selector) => selector === "[data-podcast-display-group-rate]" ? button : null }, displayGroup);
button.listener();
assert.equal(opened, displayGroup, "the whole-podcast action opens its own rating dialog");

const dialogStart = app.indexOf("async function openRatingDialog(");
const dialogEnd = app.indexOf("\nfunction openEpisodeRatingDialog(", dialogStart);
const dialogSource = app.slice(dialogStart, dialogEnd);
assert.match(dialogSource, /isDirectDisplayGroupRating \|\| podcastSupportsEpisodes\(podcast\)/u,
  "direct group rating entry verifies season ratings before opening");
assert.match(dialogSource, /ensurePodcastRatingEditState\(podcast, \{ retry: true \}\)/u,
  "opening the dialog reuses the verified user-bound season state");
assert.doesNotMatch(dialogSource, /ensurePodcastRatingEditState\(podcast, \{ retry: true, force: true \}\)/u,
  "opening a dialog reuses the verified user-bound episode state");
assert.match(app, /async function ensurePodcastRatingEditState\(podcast,[\s\S]{0,180}if \(isDisplayGroupRatingKey\(getPodcastKey\(podcast\)\)\)\s*\{\s*return ensureKirstenDisplayGroupRatingEditState/u,
  "the general mutation guard delegates direct group writes to the season check");

console.log("display-group direct-rating identity, priority, fallback and action regressions passed.");
