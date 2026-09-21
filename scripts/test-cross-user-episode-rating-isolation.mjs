import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const asyncStart = app.indexOf(`async function ${name}(`);
  const start = asyncStart >= 0 ? asyncStart : app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

const requestContext = extractFunction("getUserScopedRequestContext");
const requestCurrent = extractFunction("isCurrentUserScopedRequest");
const fetchEpisodeRatings = extractFunction("fetchEpisodeUserRatingsForIds");

assert.match(fetchEpisodeRatings, /const request = getUserScopedRequestContext\(\)/u);
assert.match(fetchEpisodeRatings, /\.eq\("user_id", state\.authUser\.id\)/u);
assert.match(fetchEpisodeRatings, /if \(!isCurrentUserScopedRequest\(request\)\) return;/u);
assert.match(app, /invalidateUserScopedRequests\(\);\s*state\.session = null;\s*state\.authUser = null;/su);
assert.match(app, /resetProfileEpisodeRatingsState\(\);/u);
assert.match(
  extractFunction("fetchProfileEpisodeRatings"),
  /if \(!isCurrentUserScopedRequest\(request\)\) return;/u,
  "profile ratings must discard stale responses too"
);

const responseA = deferred();
const responseB = deferred();
const responses = [responseA, responseB];
const state = {
  supabase: {
    from(table) {
      assert.equal(table, "episode_ratings");
      return {
        select() { return this; },
        eq(_column, userId) { this.userId = userId; return this; },
        in() { return responses.shift().promise; }
      };
    }
  },
  authUser: { id: "user-a" },
  userScopedRequestGeneration: 1
};
const episodeStateA = { userRatingsById: {}, userRatingLoadingIds: new Set() };
const episodeStateB = { userRatingsById: {}, userRatingLoadingIds: new Set() };
let activeEpisodeState = episodeStateA;
const visibleEpisodeUi = [];

const run = new Function(
  "state", "getPodcastEpisodeState", "getActivePodcastEpisodeState", "getEpisodeIdsForQuery",
  "normalizeText", "parseNumber", "applyLegacyLocalEpisodeRatingFallback", "console",
  `${requestContext}\n${requestCurrent}\n${fetchEpisodeRatings}\nreturn fetchEpisodeUserRatingsForIds;`
)(
  state,
  () => activeEpisodeState,
  () => activeEpisodeState,
  (rows) => rows.map((row) => row.id),
  (value) => String(value || "").trim(),
  Number,
  (_podcastKey, ids) => visibleEpisodeUi.push(...ids),
  { error() { throw new Error("stale request must be silent"); } }
);

// A's request begins while nine ratings are already visible.
Object.assign(episodeStateA.userRatingsById, { e1: 9, e2: 9, e3: 9, e4: 9, e5: 9, e6: 9, e7: 9, e8: 9, e9: 9 });
const pendingA = run(["e1"], { podcastKey: "podcast-1", force: true });

// Logout clears the visible values synchronously; logging into B advances the
// auth generation before A's request is allowed to finish.
state.authUser = null;
state.userScopedRequestGeneration += 1;
episodeStateA.userRatingsById = {};
activeEpisodeState = episodeStateB;
state.authUser = { id: "user-b" };
state.userScopedRequestGeneration += 1;

responseA.resolve({ data: [{ episode_id: "e1", rating: 9 }], error: null });
await pendingA;

assert.deepEqual(episodeStateA.userRatingsById, {}, "logout removes A's visible episode ratings immediately");
assert.deepEqual(episodeStateB.userRatingsById, {}, "late A response cannot populate B's episode state");
assert.deepEqual(visibleEpisodeUi, [], "no stale fallback can update the visible episode UI");

// B's own request remains functional after the account switch. A later sign-in
// as A would use the same persisted rows again; this guard only rejects stale
// requests, never deletes or changes database data.
const pendingB = run(["e1"], { podcastKey: "podcast-1", force: true });
responseB.resolve({ data: [{ episode_id: "e1", rating: 6 }], error: null });
await pendingB;
assert.equal(episodeStateB.userRatingsById.e1, 6, "B's own persisted rating loads normally");

console.log("Cross-user episode rating isolation regression checks passed.");
