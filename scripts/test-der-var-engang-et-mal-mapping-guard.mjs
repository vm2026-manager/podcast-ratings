import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const gate = await readFile(new URL("./critical-regression-gate.mjs", import.meta.url), "utf8");
assert.match(gate, /Der var engang et mål manual mapping write guard.*test-der-var-engang-et-mal-mapping-guard\.mjs/s);
const part = (start, end) => {
  const first = app.indexOf(start);
  const last = app.indexOf(end);
  assert.ok(first >= 0 && last > first, `Missing app section: ${start}`);
  return app.slice(first, last);
};

const context = {
  console: { error() {}, warn() {} },
  normalizeText: (value) => String(value ?? "").trim(),
  state: null,
  MANUAL_CATALOGUE_SOURCE: "manual_catalogue_v1",
  REVIEWED_LEGACY_MANUAL_CATALOGUE_SOURCE: "reviewed_legacy_manual_catalogue_v1",
  getEpisodePodcastKey: () => "der var engang et mal",
  getEpisodePodcastConfig: (key) => key === "der var engang et mal"
    ? { manualEpisodeMappingPolicy: "require_existing" }
    : {},
  writes: { rpc: 0, upsert: 0, insert: 0 },
  mappingRows: [],
  ratingQueries: [],
  hydrated: [],
  messages: [],
  episodeState: { userRatingsById: {}, parentUserRatingsResolvedFor: "user-1", parentUserRatingsById: {} },
  getPodcastEpisodeState: () => context.episodeState,
  getPodcastEpisodeUserRatingSummary: () => ({ count: 1 }),
  getEpisodeParentRatingKey: () => "parent-rating",
  getEpisodeRatingPersistenceConfig: () => ({ persistence: "supabase" }),
  getEpisodeKey: (episode) => episode.id,
  getEpisodeParentRatingBackup: () => true,
  isCurrentUserScopedRequest: () => true,
  getUserScopedRequestContext: () => ({ userId: "user-1" }),
  normalizeRatingInputField() {},
  parseRatingInputValue: Number,
  setAuthBusy() {},
  closeRatingDialog() {},
  updatePodcastEpisodeOverviewRatingRow() {},
  updateOpenEpisodeDetailScores() {},
  setAuthMessage() {},
  finalizeSavedEpisodeRating() {},
  updateRatingDialogMessage: (message, type) => context.messages.push({ message, type }),
  elements: { ratingInput: { value: "8" }, ratingSaveButton: { textContent: "Gem vurdering" } },
  document: { getElementById: () => null },
  fetchEpisodeRatingMetaForEpisodes: async (_episodes, options) => context.ratingQueries.push(options),
  hydrateLocalEpisodeRatingState: (_podcastKey, episodes) => context.hydrated.push(...episodes),
  captureEpisodeParentRatingBackup() {},
  clearEpisodeParentRatingBackup() {},
  saveLocalEpisodeRating() { return true; },
  deleteLocalEpisodeRating() {},
  updateProfileEpisodeRatingAfterSave() {},
  getGenstartEpisodeById: () => null,
  getActivePodcastEpisodeState: () => context.episodeState,
  statePlaceholder: true
};
context.state = {
  authUser: null,
  activePodcastDetailKey: "der var engang et mal",
  manualCanonicalEpisodeMappings: new Map(),
  manualCanonicalResolutionLoadingKeys: new Set(),
  episodeParentRatingEditPendingKeys: new Set(),
  userRatingsByKey: {},
  authUserRequestSequence: 1,
  activeEpisodeRatingId: null,
  activeEpisodeRatingContext: null,
  supabase: {
    from(table) {
      if (table === "manual_catalogue_episode_map") {
        const query = {
          select() { return this; },
          in() { return this; },
          eq: async () => ({ data: context.mappingRows, error: null })
        };
        return query;
      }
      return {
        upsert: async () => { context.writes.upsert++; return { error: null }; },
        insert: async () => { context.writes.insert++; return { error: null }; }
      };
    },
    rpc: async () => { context.writes.rpc++; return { data: "unexpected", error: null }; }
  }
};
context.globalThis = context;
vm.createContext(context);
vm.runInContext(part("const MEDIANO_EPISODE_DESTINATIONS", "const MANUAL_CATALOGUE_SOURCE")
  .replace("const MEDIANO_EPISODE_DESTINATIONS", "globalThis.MEDIANO_EPISODE_DESTINATIONS")
  .replace("const MEDIANO_EPISODE_PODCAST_CONFIG", "globalThis.MEDIANO_EPISODE_PODCAST_CONFIG")
  .replace("const EPISODE_PODCAST_CONFIG", "globalThis.EPISODE_PODCAST_CONFIG"), context);
context.MANUAL_CATALOGUE_SOURCE = "manual_catalogue_v1";
context.REVIEWED_LEGACY_MANUAL_CATALOGUE_SOURCE = "reviewed_legacy_manual_catalogue_v1";
vm.runInContext(part("function requiresExistingManualEpisodeMapping(", "async function fetchEpisodeStatsForIds("), context);
vm.runInContext(part("async function saveActiveEpisodeRating()", "async function saveActiveRating()"), context);

const ids = ["iniesta", "carlos-alberto", "beckham", "germany"];
const episodes = ids.map((key) => ({
  id: `episode-${key}`,
  title: `Verified ${key}`,
  podcast_key: "der var engang et mal",
  manual_episode_key: `manual:${key}`,
  dataSource: "manual"
}));
assert.equal(context.MEDIANO_EPISODE_PODCAST_CONFIG["der var engang et mal"].manualEpisodeMappingPolicy,
  "require_existing", "the write guard is limited to the exact series ID");
assert.equal(context.getEpisodePodcastConfig("stot mediano").manualEpisodeMappingPolicy, undefined,
  "the umbrella podcast keeps its existing mapping policy");

for (const authUser of [null, { id: "user-1" }]) {
  context.state.authUser = authUser;
  context.state.manualCanonicalEpisodeMappings.clear();
  context.mappingRows = [];
  context.hydrated.length = 0;
  context.ratingQueries.length = 0;
  await context.refreshManualEpisodeRatingData("der var engang et mal", episodes, { force: true });
  assert.equal(context.writes.rpc, 0, `no mapping-creation RPC runs on page load (auth=${Boolean(authUser)})`);
  assert.equal(context.hydrated.length, episodes.length, "unmapped episodes retain local display hydration");
  assert.equal(context.ratingQueries.length, 0, "unmapped IDs do not query production rating rows");
  for (const episode of episodes) {
    assert.equal(context.isManualEpisodeRatingAvailable(episode), false, "unmapped rating is unavailable");
  }
}

context.state.authUser = { id: "user-1" };
const target = episodes[0];
context.state.manualCanonicalEpisodeMappings.clear();
context.state.activeEpisodeRatingId = target.id;
context.state.activeEpisodeRatingContext = { episode: target, episodeId: target.id, podcastKey: target.podcast_key };
context.writes = { rpc: 0, upsert: 0, insert: 0 };
context.messages = [];
await context.saveActiveEpisodeRating();
assert.deepEqual({ ...context.writes }, { rpc: 0, upsert: 0, insert: 0 },
  "rating action for an authenticated user makes zero mapping or rating writes when mapping is absent");
assert.ok(context.messages.some(({ message, type }) => type === "error" && /episodevurderingen kunne ikke bekræftes/i.test(message)),
  "missing mapping produces a clear blocked-save message");

context.state.manualCanonicalEpisodeMappings.set(target.manual_episode_key, {
  episodeId: target.id,
  canonicalSource: "manual_catalogue_v1"
});
assert.equal(context.isManualEpisodeRatingAvailable(target), true, "the exact canonical mapping enables rating");
assert.equal(await context.resolveManualEpisodeRatingMapping(target), true,
  "a correct existing mapping resolves without calling the create RPC");
await context.saveActiveEpisodeRating();
assert.equal(context.writes.rpc, 0, "existing mapping still never invokes the creation RPC");
assert.equal(context.writes.upsert, 1, "existing mapping uses the established Supabase episode rating upsert");

for (const wrongMapping of [
  { episodeId: "another-episode", canonicalSource: "manual_catalogue_v1" },
  { episodeId: target.id, canonicalSource: "unreviewed_source" }
]) {
  context.state.manualCanonicalEpisodeMappings.set(target.manual_episode_key, wrongMapping);
  assert.equal(context.isManualEpisodeRatingAvailable(target), false,
    "only the matching episode ID and accepted canonical source unlock ratings");
}
console.log(JSON.stringify({ status: "PASS", absentMappingWrites: 0, mappedRatingUpserts: context.writes.upsert }, null, 2));
