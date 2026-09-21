import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const asyncStart = app.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = [app.indexOf("\nfunction ", start + 1), app.indexOf("\nasync function ", start + 1)]
    .filter((index) => index >= 0);
  return app.slice(start, next.length ? Math.min(...next) : app.length);
}

function deferred() {
  let resolve;
  return { promise: new Promise((resolvePromise) => { resolve = resolvePromise; }), resolve };
}

const parentFetch = extractFunction("fetchPodcastEpisodeParentRatings");
const detailState = extractFunction("getPodcastDetailEpisodeRatingState");
const summary = extractFunction("getPodcastEpisodeUserRatingSummary");

assert.match(parentFetch, /podcast_episodes!inner\(podcast_key,is_active\)/u);
assert.match(parentFetch, /\.eq\("podcast_episodes\.podcast_key"/u);
assert.match(parentFetch, /\.eq\("podcast_episodes\.is_active", true\)/u);
assert.match(parentFetch, /if \(!isCurrentUserScopedRequest\(request\)\) return;/u);
assert.match(detailState, /usesParentRatingQuery[\s\S]*?parentUserRatingsResolvedFor === state\.authUser\.id/u, "production episode state resolves from the complete parent query, not loaded page IDs");
assert.match(detailState, /parentUserRatingsResolvedFor === state\.authUser\.id/u);

const state = { authUser: { id: "user-a" } };
const episodeState = {
  // A Frontlinjen-sized catalogue where only the first page is in the workspace.
  items: Array.from({ length: 16 }, (_, index) => ({ id: `new-${index}` })),
  userRatingsById: Object.fromEntries(Array.from({ length: 16 }, (_, index) => [`new-${index}`, null])),
  parentUserRatingsById: { "older-page-episode": 6.6 },
  parentUserRatingsResolvedFor: "user-a",
  parentUserRatingsLoading: false,
  eligibilityResolved: true,
  loading: false
};
const helpers = new Function(
  "state", "getPodcastEpisodeState", "getEpisodePodcastConfig", "getEpisodeIdsForQuery", "podcastSupportsEpisodes", "parseNumber",
  `${summary}\n${detailState}; return { getPodcastEpisodeUserRatingSummary, getPodcastDetailEpisodeRatingState };`
)(
  state,
  () => episodeState,
  () => ({ dataSource: "supabase" }),
  (items) => items.map((item) => item.id),
  () => true,
  (value) => Number.isFinite(Number(value)) ? Number(value) : null
);

let result = helpers.getPodcastDetailEpisodeRatingState({ key: "frontlinjen" });
assert.deepEqual(result, { resolved: true, count: 1, average: 6.6 }, "an older-page rating immediately locks and supplies the parent score");

episodeState.parentUserRatingsById = { "older-page-episode": 6.6, "another-older-page-episode": 8 };
result = helpers.getPodcastDetailEpisodeRatingState({ key: "frontlinjen" });
assert.equal(result.average, 7.3, "multiple ratings retain the established average calculation");

episodeState.parentUserRatingsById = {};
result = helpers.getPodcastDetailEpisodeRatingState({ key: "frontlinjen" });
assert.equal(result.resolved, true, "a completed empty query unlocks manual podcast rating");
assert.equal(result.count, 0);

// A logout/account switch invalidates both the authoritative result and its
// resolved marker, so a prior user's score cannot be displayed for the next user.
state.authUser = { id: "user-b" };
result = helpers.getPodcastDetailEpisodeRatingState({ key: "frontlinjen" });
assert.equal(result.resolved, false, "the parent result is scoped to its fetching user");

// Exercise the new query's guard, not just its source text: a response begun
// for A must not populate state after logout/B's sign-in.
const responseA = deferred();
const parentState = {
  authUser: { id: "user-a" },
  userScopedRequestGeneration: 1,
  supabase: {
    from(table) {
      assert.equal(table, "episode_ratings");
      return {
        select() { return this; },
        eq() { return this; },
        then(resolve, reject) { return responseA.promise.then(resolve, reject); }
      };
    }
  }
};
const parentEpisodeState = {
  userRatingsById: {}, parentUserRatingsById: {}, parentUserRatingsResolvedFor: "", parentUserRatingsLoading: false
};
const parentFetchRun = new Function(
  "state", "getEpisodePodcastConfig", "getPodcastEpisodeState", "getUserScopedRequestContext", "isCurrentUserScopedRequest",
  "getEpisodeDatabasePodcastKey", "normalizeText", "parseNumber", "console",
  `${parentFetch}; return fetchPodcastEpisodeParentRatings;`
)(
  parentState,
  () => ({ dataSource: "supabase" }),
  () => parentEpisodeState,
  () => ({ userId: parentState.authUser?.id || "", generation: parentState.userScopedRequestGeneration }),
  (request) => parentState.authUser?.id === request.userId && parentState.userScopedRequestGeneration === request.generation,
  () => "frontlinjen",
  (value) => String(value || "").trim(),
  (value) => Number(value),
  { error() { assert.fail("stale parent query must be silent"); } }
);
const pendingA = parentFetchRun({ key: "frontlinjen" });
parentState.authUser = null;
parentState.userScopedRequestGeneration += 1;
parentState.authUser = { id: "user-b" };
parentState.userScopedRequestGeneration += 1;
responseA.resolve({ data: [{ episode_id: "older-page-episode", rating: 6.6 }], error: null });
await pendingA;
assert.deepEqual(parentEpisodeState.parentUserRatingsById, {}, "late A parent result is discarded");
assert.equal(parentEpisodeState.parentUserRatingsResolvedFor, "", "late A response cannot resolve B's detail state");

console.log("Episode-parent rating resolution regression checks passed.");
