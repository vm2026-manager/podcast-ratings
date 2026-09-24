import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");
function extract(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  let depth = 0;
  for (let i = start; i < app.length; i += 1) {
    if (app[i] === "{") depth += 1;
    if (app[i] === "}" && --depth === 0) return app.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const seasonRatings = [8, 8.2, 8.2, 6.9, 6.9, 6.5];
const members = Array.from({ length: 12 }, (_, index) => ({
  key: `narko-${index + 1}`, legacyKey: `narko-${index + 1}`,
  title: `Narkobetjenten sæson ${index + 1}`, ratingValue: 7.4, image: index === 0 ? "cover" : ""
}));
const group = { id: "narkobetjenten", title: "Narkobetjenten", rankingEnabled: true,
  representativeMemberLegacyKey: "narko-1", memberLegacyKeys: members.map((member) => member.legacyKey) };
const state = { podcasts: members, displayGroupCommunityStatsById: {}, podcastDetailPublicItemByPodcastKey: {}, podcastDetailRecommendationCache: new Map(), podcastDetailView: "", activePodcastDetailKey: "" };
const ownRatings = Object.fromEntries(members.slice(0, 6).map((member, index) => [member.key, seasonRatings[index]]));

const runtime = new Function("state", "ownRatings", `
  const normalizeText = (value) => String(value ?? "").trim().toLowerCase();
  const normalizeMatchKey = normalizeText;
  const parseNumber = (value) => value === null || value === undefined || value === '' ? null : (Number.isFinite(Number(value)) ? Number(value) : null);
  const getLegacyPodcastKey = (podcast) => podcast.legacyKey;
  const getPodcastKey = (podcast) => podcast.key || podcast.legacyKey || \`display-group:\${podcast.id}\`;
  const getUserRating = (key) => ownRatings[key] ?? null;
  const buildSearchText = (values) => values.join(' ').toLowerCase();
  const averageNumbers = (values) => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
  const formatCompactRating = (value) => Number(value).toFixed(1).replace('.', ',');
  const formatUserRatingCount = (count) => String(count) + (count === 1 ? ' bruger' : ' brugere');
  const escapeHtml = (value) => String(value);
  const getDisplayGroupSeasonNumber = (podcast) => Number(podcast.key.split('-').at(-1));
  const getDisplayGroupSharedMetadata = () => ({});
  const getDisplayGroupSimilarityMarkup = () => '<div data-related>related</div>';
  const setPodcastDetailPlacementControl = () => {};
  const setImage = () => {};
  const getPodcastImageSources = () => ({});
  const hydratePodcastSimilarityProduct = () => {};
  const bindPodcastDetailFilterButtons = () => {};
  const renderFavoriteButton = () => {};
  const isMobileViewport = () => false;
  ${extract("getDisplayGroupMemberPodcasts")}
  ${extract("getDisplayGroupUserStats")}
  ${extract("createRankingDisplayGroup")}
  ${extract("resolvePublicPodcastDisplayItem")}
  ${extract("getDisplayGroupOwnRatingStats")}
  ${extract("renderPodcastDisplayGroupContent")}
  return { createRankingDisplayGroup, resolvePublicPodcastDisplayItem, getDisplayGroupOwnRatingStats, renderPodcastDisplayGroupContent };
`)(state, ownRatings);

// Catalogue lookup exists before the RPC: member resolution is allowed to be null/0.
state.podcastDetailPublicItemByPodcastKey[members[0].key] = group;
let resolved = runtime.resolvePublicPodcastDisplayItem(members[0]);
assert.equal(resolved.userAverageRating, null);
assert.equal(resolved.userRatingCount, 0);

// The same member is resolved after each asynchronous response; it must never
// retain a stats-bearing object from the earlier lookup.
state.displayGroupCommunityStatsById.narkobetjenten = { averageRating: 7.45, ratingCount: 1 };
resolved = runtime.resolvePublicPodcastDisplayItem(members[0]);
assert.equal(resolved.userAverageRating, 7.45);
assert.equal(resolved.userRatingCount, 1);
state.displayGroupCommunityStatsById.narkobetjenten = { averageRating: 8.15, ratingCount: 2 };
assert.equal(runtime.resolvePublicPodcastDisplayItem(members[0]).userAverageRating, 8.15);

// Render the real modal function using the fresh production-shaped response.
state.displayGroupCommunityStatsById.narkobetjenten = { averageRating: 7.45, ratingCount: 1 };
resolved = runtime.resolvePublicPodcastDisplayItem(members[0]);
let markup = "";
const content = { classList: { remove() {}, add() {} }, querySelector: () => null, querySelectorAll: () => [], set innerHTML(value) { markup = value; }, get innerHTML() { return markup; } };
const dialog = { querySelector: (selector) => selector === "[data-podcast-detail-content]" ? content : { replaceChildren() {} }, classList: { remove() {} } };
runtime.renderPodcastDisplayGroupContent(dialog, resolved);
assert.match(markup, /Podcastlistens vurdering[\s\S]*7,4[\s\S]*12 sæsoner med score/u);
assert.match(markup, /Brugernes vurdering[\s\S]*7,5[\s\S]*1 bruger/u);
assert.match(markup, /Din vurdering[\s\S]*value="7,5"[\s\S]*Beregnet fra 6 sæsonvurderinger/u);
assert.match(markup, /is-episode-rating-locked[\s\S]*is-episode-calculated[\s\S]*disabled/u);
assert.match(markup, /data-podcast-detail-season-rating-lock-trigger/u);
assert.match(markup, /podcast-detail-sheet__episode-rating-lock-help[\s\S]*beregnes automatisk ud fra dine sæsonvurderinger[\s\S]*Redigér under Vurder sæsoner/u);
assert.match(markup, /podcast-detail-sheet__episode-rating-mobile-help[\s\S]*data-podcast-detail-season-rating-mobile-help[\s\S]*beregnes automatisk ud fra dine sæsonvurderinger/u);
assert.doesNotMatch(markup, /data-podcast-detail-inline-rating-save/u);
assert.match(markup, /Vurder sæsoner/u);

function classList() {
  const values = new Set();
  return { contains: (value) => values.has(value), toggle: (value, force) => force ? values.add(value) : values.delete(value), add: (value) => values.add(value), remove: (value) => values.delete(value) };
}
function eventTarget() {
  const listeners = new Map();
  const attributes = new Map();
  return { classList: classList(), addEventListener: (name, handler) => listeners.set(name, handler), click() { listeners.get("click")?.({ preventDefault() {}, target: this }); }, contains: (target) => target === this, setAttribute: (name, value) => attributes.set(name, value), getAttribute: (name) => attributes.get(name) };
}
const ratingCell = eventTarget();
const seasonTrigger = eventTarget();
seasonTrigger.closest = () => ratingCell;
seasonTrigger.setAttribute("aria-expanded", "false");
const seasonMobileHelp = eventTarget();
const interactiveContent = eventTarget();
interactiveContent.classList = { remove() {}, add() {} };
interactiveContent.querySelector = (selector) => ({
  "[data-podcast-detail-season-rating-lock-trigger]": seasonTrigger,
  "[data-podcast-detail-season-rating-mobile-help]": seasonMobileHelp
}[selector] || null);
interactiveContent.querySelectorAll = () => [];
Object.defineProperty(interactiveContent, "innerHTML", { set() {} });
const interactiveDialog = { querySelector: (selector) => selector === "[data-podcast-detail-content]" ? interactiveContent : { replaceChildren() {} }, classList: { remove() {} } };
const originalMatchMedia = globalThis.matchMedia;
globalThis.matchMedia = () => ({ matches: true });
runtime.renderPodcastDisplayGroupContent(interactiveDialog, resolved);
assert.equal(seasonTrigger.getAttribute("aria-expanded"), "false");
assert.equal(ratingCell.classList.contains("is-episode-rating-lock-open"), false);
assert.equal(seasonMobileHelp.classList.contains("is-episode-rating-lock-open"), false);
seasonTrigger.click();
assert.equal(seasonTrigger.getAttribute("aria-expanded"), "true");
assert.equal(ratingCell.classList.contains("is-episode-rating-lock-open"), true);
assert.equal(seasonMobileHelp.classList.contains("is-episode-rating-lock-open"), true);
seasonTrigger.click();
assert.equal(seasonTrigger.getAttribute("aria-expanded"), "false");
assert.equal(ratingCell.classList.contains("is-episode-rating-lock-open"), false);
assert.equal(seasonMobileHelp.classList.contains("is-episode-rating-lock-open"), false);
globalThis.matchMedia = () => ({ matches: false });
seasonTrigger.click();
assert.equal(ratingCell.classList.contains("is-episode-rating-lock-open"), false);
assert.equal(seasonMobileHelp.classList.contains("is-episode-rating-lock-open"), false);
globalThis.matchMedia = originalMatchMedia;

const own = runtime.getDisplayGroupOwnRatingStats(members);
assert.deepEqual(own, { average: 7.45, count: 6 });
for (const [value, expected] of [[7.44, "7,4"], [7.45, "7,5"], [7.46, "7,5"]]) assert.equal(Number(value).toFixed(1).replace('.', ','), expected);

// Fail closed: clearing only group stats preserves ordinary stats and all own/editorial inputs.
const ordinary = { ordinary: { averageRating: 8, ratingCount: 2 } };
state.communityStatsByKey = ordinary;
state.displayGroupCommunityStatsById = {};
resolved = runtime.resolvePublicPodcastDisplayItem(members[0]);
assert.equal(resolved.userAverageRating, null);
assert.deepEqual(state.communityStatsByKey, ordinary);
assert.deepEqual(runtime.getDisplayGroupOwnRatingStats(members), own);

// No own season scores cannot expose a synthetic group save path.
for (const key of Object.keys(ownRatings)) delete ownRatings[key];
resolved = runtime.resolvePublicPodcastDisplayItem(members[0]);
runtime.renderPodcastDisplayGroupContent(dialog, resolved);
assert.match(markup, /Ingen sæsoner vurderet\. Vurdér under Vurder sæsoner\./u);
assert.doesNotMatch(markup, /data-podcast-detail-inline-rating-save/u);
assert.match(app, /data-podcast-season-rate/u, "season workspace retains editable member controls");
console.log("Display-group modal lifecycle regression checks passed.");
