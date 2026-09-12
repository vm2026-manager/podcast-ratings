import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const plainStart = app.indexOf(`function ${name}(`);
  const start = app.lastIndexOf("async ", plainStart) === plainStart - 6 ? plainStart - 6 : plainStart;
  assert.ok(start >= 0, `${name} must exist`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function deferred() {
  let resolve;
  const promise = new Promise((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const fetchCommunityStats = extractFunction("fetchCommunityStats");
const getDesktopRankingDataState = extractFunction("getDesktopRankingDataState");

function createFetchHarness(state, responses) {
  const messages = [];
  const fetch = new Function(
    "state",
    "PODCAST_RATING_PUBLIC_STATS_VIEW",
    "canonicalizeCommunityStats",
    "invalidateRankingListCache",
    "setAuthMessage",
    "console",
    `${fetchCommunityStats}; return fetchCommunityStats;`
  )(
    state,
    "podcast_rating_public_stats",
    (rows) => ({ statsByKey: Object.fromEntries(rows.map((row) => [row.podcast_key, row])), unresolvedKeys: [] }),
    () => { state.cacheInvalidations = (state.cacheInvalidations || 0) + 1; },
    (...args) => messages.push(args),
    { error() {}, warn() {} }
  );
  state.supabase = {
    from() {
      return {
        select() {
          const next = responses.shift();
          assert.ok(next, "each fetch receives a prepared response");
          return next.promise || Promise.resolve(next);
        }
      };
    }
  };
  return { fetch, messages };
}

function createRankingState(state, desktop) {
  return new Function(
    "state",
    "isDesktopRankingViewport",
    `${getDesktopRankingDataState}; return getDesktopRankingDataState;`
  )(state, () => desktop);
}

function baseState() {
  return {
    communityStatsByKey: {},
    communityStatsHasSuccessfulLoad: false,
    communityStatsRequestToken: 0,
    communityStatsStatus: "idle",
    podcastDataStatus: "ready",
    rankingSource: "users"
  };
}

// A first successful response, including a normal public-stat row, establishes
// the explicit usable snapshot independently of whether it later has entries.
{
  const state = baseState();
  const { fetch } = createFetchHarness(state, [{ data: [{ podcast_key: "dagmar", average_rating: 7, rating_count: 3 }], error: null }]);
  await fetch();
  assert.equal(state.communityStatsStatus, "ready");
  assert.equal(state.communityStatsHasSuccessfulLoad, true);
  assert.equal(state.communityStatsByKey.dagmar.average_rating, 7);
  assert.equal(state.cacheInvalidations, 1);
  assert.deepEqual(createRankingState(state, true)(), { status: "ready" });
  assert.deepEqual(createRankingState(state, false)(), { status: "ready" });
}

// A genuine empty success is usable too; the flag must not be inferred from an
// empty object, otherwise an empty ranking would be mistaken for a failure.
{
  const state = baseState();
  const { fetch } = createFetchHarness(state, [{ data: [], error: null }]);
  await fetch();
  assert.equal(state.communityStatsStatus, "ready");
  assert.equal(state.communityStatsHasSuccessfulLoad, true);
  assert.deepEqual(state.communityStatsByKey, {});
  assert.deepEqual(createRankingState(state, true)(), { status: "ready" });
}

// An initial failure still blocks the desktop Brugere ranking, but mobile keeps
// its established independent rendering path.
{
  const state = baseState();
  const { fetch, messages } = createFetchHarness(state, [{ data: null, error: new Error("offline") }]);
  await fetch();
  assert.equal(state.communityStatsStatus, "error");
  assert.equal(state.communityStatsHasSuccessfulLoad, false);
  assert.equal(messages.length, 1);
  const desktop = createRankingState(state, true)();
  assert.equal(desktop.status, "error");
  assert.equal(desktop.title, "Brugervurderinger kunne ikke indlæses");
  assert.doesNotMatch(`${desktop.title} ${desktop.message}`, /Ingen brugere endnu|empty/iu);
  assert.deepEqual(createRankingState(state, false)(), { status: "ready" });
}

// A later error retains the exact previous snapshot, leaves desktop rankings
// renderable, and exposes a small non-blocking stale-data warning.
{
  const state = baseState();
  const retained = { dagmar: { average_rating: 7, rating_count: 3 } };
  state.communityStatsByKey = retained;
  state.communityStatsHasSuccessfulLoad = true;
  const { fetch } = createFetchHarness(state, [{ data: null, error: new Error("timeout") }]);
  const pending = fetch();
  assert.equal(state.communityStatsStatus, "refreshing");
  await pending;
  assert.equal(state.communityStatsStatus, "error");
  assert.strictEqual(state.communityStatsByKey, retained);
  const desktop = createRankingState(state, true)();
  assert.equal(desktop.status, "ready");
  assert.equal(desktop.warning, "Brugervurderinger kunne ikke opdateres. Viser senest indlæste data.");
}

// An old failed request cannot overwrite a newer successful response.
{
  const state = baseState();
  const oldResponse = deferred();
  const newResponse = deferred();
  const { fetch, messages } = createFetchHarness(state, [oldResponse, newResponse]);
  const oldFetch = fetch();
  const newFetch = fetch();
  newResponse.resolve({ data: [{ podcast_key: "fresh", average_rating: 8, rating_count: 4 }], error: null });
  await newFetch;
  oldResponse.resolve({ data: null, error: new Error("old failure") });
  await oldFetch;
  assert.equal(state.communityStatsStatus, "ready");
  assert.equal(state.communityStatsByKey.fresh.average_rating, 8);
  assert.equal(messages.length, 0, "a superseded failure must not announce an error");
}

console.log("Community ranking load-safety behavioral regression tests passed.");
