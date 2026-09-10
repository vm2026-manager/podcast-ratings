import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const next = app.indexOf("\nfunction ", start + 1);
  return app.slice(start, next === -1 ? app.length : next);
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const startup = extractFunction("startInitialRatingHydration");
assert.match(startup, /Promise\.allSettled\(\[\s*initialSupabaseStartup,\s*initialPodcastStartup\s*\]\)/su);
assert.match(startup, /catalogueResult\.status !== "fulfilled"/u);
assert.match(startup, /!catalogueResult\.value/u);
assert.match(startup, /state\.podcastDataStatus !== "ready"/u);
assert.match(startup, /return refreshSupabaseState\(\);/u);
assert.doesNotMatch(
  startup,
  /if \(!state\.authUser\) return/u,
  "public community stats must not be gated on authentication"
);

const initSupabase = extractFunction("initSupabase");
assert.doesNotMatch(
  initSupabase,
  /startInitialRatingHydration\(\)/u,
  "initSupabase must not await or start the coordinator that waits for its own promise"
);

const exploreStartup = extractFunction("startInitialExplorePersonalization");
assert.doesNotMatch(
  exploreStartup,
  /refreshSupabaseState\(\)/u,
  "Explore warming must not issue a second initial rating fetch"
);

assert.match(
  app,
  /initialPodcastStartup = loadPodcasts\(\);\s*initialRatingHydrationStartup = startInitialRatingHydration\(\);/su,
  "the one-shot hydration must start only after both startup promises are assigned"
);

function createHarness({ state, refreshSupabaseState }) {
  const factory = new Function(
    "state",
    "refreshSupabaseState",
    "setAuthMessage",
    "console",
    `let initialSupabaseStartup = null;
     let initialPodcastStartup = null;
     let initialRatingHydrationStartup = null;
     ${startup}
     return (supabaseStartup, podcastStartup) => {
       initialSupabaseStartup = supabaseStartup;
       initialPodcastStartup = podcastStartup;
       return startInitialRatingHydration();
     };`
  );
  return factory(state, refreshSupabaseState, () => {}, { error() {} });
}

async function settle() {
  await new Promise((resolve) => setImmediate(resolve));
}

// Anonymous startup: public stats are hydrated after the catalogue commits,
// without requiring an auth user. The refresh callback models canonicalizing the
// public stats into the user ranking source.
{
  const state = {
    supabase: {},
    authUser: null,
    podcastDataStatus: "loading",
    podcastById: {},
    communityStatsByKey: {}
  };
  let refreshes = 0;
  const run = createHarness({
    state,
    refreshSupabaseState: async () => {
      refreshes += 1;
      assert.ok(state.podcastById.rated, "catalogue identity map exists before public stats resolve");
      state.communityStatsByKey.rated = { ratingCount: 9 };
    }
  });
  const supabaseReady = deferred();
  const catalogueReady = deferred();
  const hydration = run(supabaseReady.promise, catalogueReady.promise);
  assert.strictEqual(
    run(supabaseReady.promise, catalogueReady.promise),
    hydration,
    "the startup guard returns the same hydration promise instead of adding a second fetch"
  );

  supabaseReady.resolve();
  await settle();
  assert.equal(refreshes, 0, "fast Supabase must not hydrate before a slow catalogue");

  state.podcastById.rated = { podcastId: "rated" };
  state.podcastDataStatus = "ready";
  catalogueReady.resolve(true);
  await hydration;
  assert.equal(refreshes, 1);
  assert.equal(state.communityStatsByKey.rated.ratingCount, 9, "logged-out Brugere ranking receives public stats");
}

// Authenticated startup is correct in either completion order, including the
// signed-in user's own ratings/saves that share the same catalogue resolver.
for (const order of ["supabase-first", "catalogue-first"]) {
  const state = {
    supabase: {},
    authUser: { id: "test-user" },
    podcastDataStatus: "loading",
    podcastById: {},
    communityStatsByKey: {},
    userRatings: {}
  };
  let refreshes = 0;
  const run = createHarness({
    state,
    refreshSupabaseState: async () => {
      refreshes += 1;
      assert.ok(state.podcastById.rated);
      state.communityStatsByKey.rated = { ratingCount: 2 };
      state.userRatings.rated = 8;
    }
  });
  const supabaseReady = deferred();
  const catalogueReady = deferred();
  const hydration = run(supabaseReady.promise, catalogueReady.promise);

  if (order === "supabase-first") {
    supabaseReady.resolve();
    await settle();
    assert.equal(refreshes, 0, "fast Supabase cannot discard rows before catalogue readiness");
  } else {
    state.podcastById.rated = { podcastId: "rated" };
    state.podcastDataStatus = "ready";
    catalogueReady.resolve(true);
    await settle();
    assert.equal(refreshes, 0, "slow Supabase has not fetched yet");
  }

  state.podcastById.rated = { podcastId: "rated" };
  state.podcastDataStatus = "ready";
  supabaseReady.resolve();
  catalogueReady.resolve(true);
  await hydration;
  assert.equal(refreshes, 1, `${order} performs exactly one initial fetch`);
  assert.equal(state.communityStatsByKey.rated.ratingCount, 2);
  assert.equal(state.userRatings.rated, 8);
}

// A failed initial catalogue must not commit a falsely empty rating map. A later
// genuine refresh can hydrate normally after a successful catalogue retry.
{
  const state = {
    supabase: {},
    authUser: { id: "test-user" },
    podcastDataStatus: "error",
    communityStatsByKey: { retained: { ratingCount: 3 } }
  };
  let refreshes = 0;
  const run = createHarness({ state, refreshSupabaseState: async () => { refreshes += 1; } });
  await run(Promise.resolve(), Promise.resolve(false));
  assert.equal(refreshes, 0, "failed catalogue prevents premature canonicalization");
  assert.deepEqual(state.communityStatsByKey, { retained: { ratingCount: 3 } });
}

console.log("Startup rating hydration regression checks passed.");
