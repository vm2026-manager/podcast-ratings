import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function extractAsyncFunction(name) {
  const start = app.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const open = app.indexOf(") {", start) + 2;
  let depth = 0;
  for (let index = open; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const groupKey = "display-group:kirsten-ringer-til-rasmus";
const members = Array.from({ length: 6 }, (_, index) => ({ key: `season-${index + 1}` }));
const group = { key: groupKey, displayGroupMembers: members };
const requestRows = new Map();
const queryErrors = new Map();
const queryCounts = new Map();
let deferredQuery = null;
const state = {
  authUser: { id: "user-a" }, generation: 1, displayGroupRatingEditState: null,
  userRatingsByKey: { [groupKey]: 6.5 }, userRatingPersistedKeyByCanonical: {},
  supabase: {
    from(table) {
      assert.equal(table, "user_ratings");
      const query = { userId: "", keys: [] };
      query.select = () => query;
      query.eq = (key, value) => { if (key === "user_id") query.userId = value; return query; };
      query.in = (_key, value) => { query.keys = value; return query; };
      query.then = (resolve) => {
        queryCounts.set(query.userId, (queryCounts.get(query.userId) || 0) + 1);
        const execute = () => Promise.resolve({
          data: requestRows.get(query.userId) || [],
          error: queryErrors.get(query.userId) || null
        }).then(resolve);
        if (deferredQuery && deferredQuery.userId === query.userId) return deferredQuery.promise.then(resolve);
        return execute();
      };
      return query;
    }
  }
};

const getPodcastKey = (podcast) => podcast.key;
const isDisplayGroupRatingKey = (key) => key === groupKey;
const getDisplayGroupMemberPodcasts = (podcast) => podcast.displayGroupMembers;
const getUserScopedRequestContext = () => ({ userId: state.authUser?.id || "", generation: state.generation });
const isCurrentUserScopedRequest = (request) => request.userId === state.authUser?.id && request.generation === state.generation;
const canonicalizeUserRatingRows = (rows) => ({
  ratingsByKey: Object.fromEntries(rows.map(({ podcast_key, rating }) => [podcast_key, Number(rating)])),
  persistedKeyByCanonical: Object.fromEntries(rows.map(({ podcast_key }) => [podcast_key, podcast_key]))
});
const parseNumber = (value) => value === null || value === undefined ? null : Number(value);
const getUserRating = (key) => state.userRatingsByKey[key] ?? null;
const getDisplayGroupOwnRatingStats = (items, displayGroup) => {
  const ratings = items.map((item) => parseNumber(getUserRating(getPodcastKey(item)))).filter((rating) => rating !== null);
  return {
    directRating: displayGroup ? parseNumber(getUserRating(getPodcastKey(displayGroup))) : null,
    average: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : null,
    count: ratings.length
  };
};

const getState = new Function(
  "state", "isDisplayGroupRatingKey", "getPodcastKey", "getUserScopedRequestContext", "getDisplayGroupMemberPodcasts",
  `${extractFunction("getKirstenDisplayGroupRatingEditState")}; return getKirstenDisplayGroupRatingEditState;`
)(state, isDisplayGroupRatingKey, getPodcastKey, getUserScopedRequestContext, getDisplayGroupMemberPodcasts);
const ensure = new Function(
  "state", "getUserScopedRequestContext", "isCurrentUserScopedRequest", "getPodcastKey", "getDisplayGroupMemberPodcasts",
  "getKirstenDisplayGroupRatingEditState", "canonicalizeUserRatingRows", "getDisplayGroupOwnRatingStats", "console",
  `${extractAsyncFunction("ensureKirstenDisplayGroupRatingEditState")}; return ensureKirstenDisplayGroupRatingEditState;`
)(state, getUserScopedRequestContext, isCurrentUserScopedRequest, getPodcastKey, getDisplayGroupMemberPodcasts,
  getState, canonicalizeUserRatingRows, getDisplayGroupOwnRatingStats, { warn() {} });

// No seasons keeps the old direct score editable and intact.
requestRows.set("user-a", []);
let ratingState = await ensure(group, { retry: true });
assert.equal(ratingState.resolved, true);
assert.equal(ratingState.count, 0);
assert.equal(state.userRatingsByKey[groupKey], 6.5);

// Each rated season contributes one value, regardless of its episode count.
requestRows.set("user-a", [{ podcast_key: "season-1", rating: 8 }]);
ratingState = await ensure(group, { force: true });
assert.equal(ratingState.count, 1);
assert.equal(ratingState.average, 8);
requestRows.set("user-a", [
  { podcast_key: "season-1", rating: 8 },
  { podcast_key: "season-2", rating: 10 }
]);
ratingState = await ensure(group, { force: true });
assert.equal(ratingState.count, 2);
assert.equal(ratingState.average, 9);
requestRows.set("user-a", [
  { podcast_key: "season-1", rating: 6 },
  { podcast_key: "season-2", rating: 10 }
]);
ratingState = await ensure(group, { force: true });
assert.equal(ratingState.average, 8, "editing a season refreshes the total");

// Removing the final season unlocks direct editing while retaining its value.
requestRows.set("user-a", []);
ratingState = await ensure(group, { force: true });
assert.equal(ratingState.count, 0);
assert.equal(state.userRatingsByKey[groupKey], 6.5);

// A missing/error check never returns an editable state.
queryErrors.set("user-a", new Error("offline"));
ratingState = await ensure(group, { retry: true, force: true });
assert.equal(ratingState.resolved, false);
assert.match(ratingState.error, /kunne ikke hentes/u);
queryErrors.delete("user-a");

// Concurrent entry points share one in-flight read.
let releaseQuery;
deferredQuery = { userId: "user-a", promise: new Promise((resolve) => { releaseQuery = resolve; }) };
const first = ensure(group, { retry: true, force: true });
const second = ensure(group, { retry: true });
await Promise.resolve();
const requestsAfterFirst = queryCounts.get("user-a");
assert.equal(requestsAfterFirst, 7);
releaseQuery({ data: [], error: null });
await Promise.all([first, second]);
deferredQuery = null;
assert.equal(queryCounts.get("user-a"), requestsAfterFirst, "the second entry point reused the active request");

// A mutation guard must perform a fresh read after an older render check ends.
let releaseRenderCheck;
deferredQuery = { userId: "user-a", promise: new Promise((resolve) => { releaseRenderCheck = resolve; }) };
state.displayGroupRatingEditState = null;
const renderCheck = ensure(group, { retry: true });
const saveGuardCheck = ensure(group, { retry: true, force: true });
await Promise.resolve();
const beforeForcedRefresh = queryCounts.get("user-a");
deferredQuery = null;
releaseRenderCheck({ data: [], error: null });
await Promise.all([renderCheck, saveGuardCheck]);
assert.equal(queryCounts.get("user-a"), beforeForcedRefresh + 1, "a forced save/delete guard rechecks after any older in-flight read");

// A late response from account A cannot overwrite the state for account B.
let releaseOldQuery;
deferredQuery = { userId: "user-a", promise: new Promise((resolve) => { releaseOldQuery = resolve; }) };
state.displayGroupRatingEditState = null;
const oldUserRequest = ensure(group, { retry: true, force: true });
state.authUser = { id: "user-b" };
state.generation += 1;
requestRows.set("user-b", [{ podcast_key: "season-3", rating: 7 }]);
deferredQuery = null;
const newUserState = await ensure(group, { retry: true });
assert.equal(newUserState.count, 1);
releaseOldQuery({ data: [{ podcast_key: "season-1", rating: 1 }], error: null });
await oldUserRequest;
assert.equal(getState(group).userId, "user-b");
assert.equal(getState(group).average, 7);

// Existing save and delete paths revalidate immediately before database DML.
for (const name of ["saveActiveRating", "deleteActiveRating"]) {
  const source = extractAsyncFunction(name);
  assert.match(source, /ensurePodcastRatingEditState\(podcast, \{ retry: true, force: true \}\)/u, `${name} forces a current lock check`);
  assert.match(source, /!ratingState\.resolved \|\| ratingState\.count > 0/u, `${name} fails closed before DML`);
  assert.match(source, /if \(!isDisplayGroupRatingKey\(getPodcastKey\(podcast\)\)\) void reconcileExistingEpisodeDerivedParentRating/u,
    `${name} does not route a display group through episode-parent synchronization`);
}
assert.match(extractAsyncFunction("openRatingDialog"), /if \(!isDirectDisplayGroupRating\) void reconcileExistingEpisodeDerivedParentRating/u,
  "opening a season-locked group does not modify the preserved direct score");
const seasonWorkspace = extractFunction("renderPodcastDisplayGroupSeasonWorkspace");
assert.ok(seasonWorkspace.includes('content.querySelector("[data-podcast-seasons-back]")?.focus({ preventScroll: true });'),
  "keyboard focus enters the season workspace and returns to its launcher");

console.log("Kirsten season-derived rating lock, retry, account-scope, and save/delete guard regressions passed.");
