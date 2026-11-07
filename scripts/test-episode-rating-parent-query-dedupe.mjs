import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

function extractAsyncFunction(name) {
  const start = app.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} exists`);
  const end = app.indexOf("\nfunction ", start);
  assert.ok(end > start, `Could not find the end of ${name}`);
  return app.slice(start, end).trimEnd();
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function createHarness(userId = "user-a") {
  const episodeState = {
    items: [], userRatingsById: {}, parentUserRatingsById: {}, parentEpisodesById: {},
    parentUserRatingsResolvedFor: "", parentUserRatingsLoading: false,
    parentUserRatingsPromise: null, parentUserRatingsErrorFor: "", parentUserRatingsError: ""
  };
  const state = {
    authUser: { id: userId }, userScopedRequestGeneration: 1,
    supabase: { from: () => ({ select() { return this; }, eq() { return this; } }) }
  };
  const requests = [];
  const harness = new Function(
    "state", "normalizeText", "getEpisodePodcastConfig", "getPodcastEpisodeState",
    "getUserScopedRequestContext", "isCurrentUserScopedRequest", "getEpisodeDatabasePodcastKey",
    "applyPodcastEpisodeSourceBoundary", "parseNumber", "getAppleSeasonEpisodeNumber", "console",
    `${extractAsyncFunction("fetchPodcastEpisodeParentRatings")}; return fetchPodcastEpisodeParentRatings;`
  )(
    state,
    (value) => String(value ?? "").trim(),
    (podcast) => podcast ? { persistence: "supabase", dataSource: "feed", databasePodcastKey: "show-db" } : null,
    () => episodeState,
    () => ({ userId: state.authUser?.id || "", generation: state.userScopedRequestGeneration }),
    (request) => Boolean(request.userId && request.userId === state.authUser?.id && request.generation === state.userScopedRequestGeneration),
    (config) => config.databasePodcastKey,
    (_query, _config, _prefix) => {
      const next = deferred();
      requests.push(next);
      return next.promise;
    },
    (value) => Number(value),
    () => null,
    { error() {} }
  );
  return { fetch: harness, state, episodeState, requests };
}

// Concurrent entry points share one request, and a successful user-bound
// verification is reused when the same control is opened again.
{
  const h = createHarness();
  const first = h.fetch({ key: "show" });
  const second = h.fetch({ key: "show" });
  assert.equal(h.requests.length, 1, "an observer and a dialog cannot duplicate an in-flight check");
  h.requests[0].resolve({
    data: [{ episode_id: "episode-a", rating: 7, podcast_episodes: { title: "Afsnit A" } }],
    error: null
  });
  await Promise.all([first, second]);
  assert.equal(h.episodeState.parentUserRatingsResolvedFor, "user-a");
  assert.equal(h.episodeState.parentUserRatingsById["episode-a"], 7);
  await h.fetch({ key: "show" });
  assert.equal(h.requests.length, 1, "verified state avoids a second control-open request");
}

// A failed check never resolves as an empty rating set or unlocks the editor.
// The failure is visible and a deliberate retry starts one fresh request.
{
  const h = createHarness();
  const failed = h.fetch({ key: "show" });
  h.requests[0].reject(new Error("offline"));
  await failed;
  assert.equal(h.episodeState.parentUserRatingsResolvedFor, "");
  assert.equal(h.episodeState.parentUserRatingsErrorFor, "user-a");
  assert.match(h.episodeState.parentUserRatingsError, /kunne ikke hentes/u);
  await h.fetch({ key: "show" });
  assert.equal(h.requests.length, 1, "automatic rereads do not spin after an error");
  const retried = h.fetch({ key: "show" }, { retry: true });
  assert.equal(h.requests.length, 2, "the explicit retry makes one new request");
  h.requests[1].resolve({ data: [], error: null });
  await retried;
  assert.equal(h.episodeState.parentUserRatingsResolvedFor, "user-a");
  assert.equal(h.episodeState.parentUserRatingsError, "");
  assert.deepEqual(h.episodeState.parentUserRatingsById, {});
}

// Account changes clear the user-bound cache and invalidate the older
// in-flight response. A late user A response cannot populate user B's state.
{
  const h = createHarness();
  const oldUserRequest = h.fetch({ key: "show" });
  h.state.authUser = { id: "user-b" };
  h.state.userScopedRequestGeneration += 1;
  Object.assign(h.episodeState, {
    userRatingsById: {}, parentUserRatingsById: {}, parentEpisodesById: {},
    parentUserRatingsResolvedFor: "", parentUserRatingsLoading: false,
    parentUserRatingsPromise: null, parentUserRatingsErrorFor: "", parentUserRatingsError: ""
  });
  const newUserRequest = h.fetch({ key: "show" });
  assert.equal(h.requests.length, 2, "the new account gets a fresh query");
  h.requests[0].resolve({
    data: [{ episode_id: "episode-a", rating: 1, podcast_episodes: { title: "Afsnit A" } }],
    error: null
  });
  await oldUserRequest;
  assert.deepEqual(h.episodeState.parentUserRatingsById, {}, "a stale response cannot unlock account B");
  h.requests[1].resolve({
    data: [{ episode_id: "episode-b", rating: 8, podcast_episodes: { title: "Afsnit B" } }],
    error: null
  });
  await newUserRequest;
  assert.equal(h.episodeState.parentUserRatingsResolvedFor, "user-b");
  assert.deepEqual(h.episodeState.parentUserRatingsById, { "episode-b": 8 });
}

const dialogStart = app.indexOf("async function openRatingDialog(");
const dialogEnd = app.indexOf("\nfunction openEpisodeRatingDialog(", dialogStart);
const dialogSource = app.slice(dialogStart, dialogEnd);
assert.match(dialogSource, /ensurePodcastRatingEditState\(podcast, \{ retry: true \}\)/u);
assert.doesNotMatch(dialogSource, /fetchCommunityStats|fetchDisplayGroupCommunityStats/u,
  "a user's episode eligibility check is separate from the public community-score load");

console.log("episode-parent request deduplication, retry and account-scope regressions passed.");
