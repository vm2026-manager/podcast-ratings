import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = app.indexOf("function removeMigratedLocalEpisodeRatingAliases(");
const end = app.indexOf("async function ensureManualCatalogueEpisodeMapping(", start);
assert.ok(start >= 0 && end > start, "local episode rating migration helpers exist");
const implementation = app.slice(start, end);

const userId = "user-current";
const canonicalId = "canonical-episode";
const localPodcastKey = "bitcoin bedraget";
const episode = {
  id: "legacy-episode",
  legacy_manual_episode_id: "legacy-title-key",
  manual_episode_key: "manual-catalogue-v1:canonical-episode",
  podcast_key: localPodcastKey,
  dataSource: "manual"
};

function createHarness({ ratings = {}, queryResult = { data: [], error: null }, insertResult = { error: null }, onQuery, onInsert } = {}) {
  const storeRef = { value: { [userId]: structuredClone(ratings), "another-user": {} } };
  const calls = { query: 0, insert: [], filters: [] };
  const state = {
    authUser: { id: userId },
    userScopedRequestGeneration: 0,
    activePodcastDetailKey: localPodcastKey,
    manualCanonicalEpisodeMappings: new Map([[episode.manual_episode_key, { episodeId: canonicalId }]]),
    supabase: {
      from(table) {
        assert.equal(table, "episode_ratings");
        return {
          select(columns) {
            assert.equal(columns, "rating");
            return {
              eq(column, value) {
                calls.filters.push([column, value]);
                return this;
              },
              async limit(count) {
                assert.equal(count, 1);
                calls.query += 1;
                if (onQuery) return onQuery();
                return queryResult;
              }
            };
          },
          async insert(payload) {
            calls.insert.push(structuredClone(payload));
            if (onInsert) return onInsert(payload);
            return insertResult;
          }
        };
      }
    }
  };
  const runtime = new Function(
    "state",
    "normalizeText",
    "getLocalEpisodePodcastKey",
    "getEpisodePodcastKey",
    "getPodcastEpisodeState",
    "readLocalEpisodeRatingStore",
    "writeLocalEpisodeRatingStore",
    "parseNumber",
    "getUserScopedRequestContext",
    "isCurrentUserScopedRequest",
    "console",
    `${implementation}\nreturn { removeMigratedLocalEpisodeRatingAliases, migrateLocalManualEpisodeRatingToSupabase };`
  )(
    state,
    (value) => String(value ?? "").trim(),
    (value) => typeof value === "string" ? value : value?.Podcast-ID || "",
    () => localPodcastKey,
    () => ({ userRatingsById: {} }),
    () => structuredClone(storeRef.value),
    (next) => { storeRef.value = structuredClone(next); return true; },
    (value) => {
      const number = Number(value);
      return Number.isFinite(number) && number >= 0 && number <= 10 ? number : null;
    },
    () => ({ userId: state.authUser?.id || "", generation: state.userScopedRequestGeneration }),
    (request) => Boolean(request.userId && state.authUser?.id === request.userId && state.userScopedRequestGeneration === request.generation),
    { warn() {} }
  );
  return { runtime, state, storeRef, calls };
}

const localRating = (podcastKey, rating) => ({ podcastKey, rating, updatedAt: "2026-09-01T00:00:00Z" });

// Only a local rating whose podcast identity matches the verified manual episode
// is transferred. A reused episode UUID carrying another podcast's rating is kept.
{
  const { runtime, storeRef, calls } = createHarness({ ratings: {
    [canonicalId]: localRating("unrelated podcast", 3.2),
    "legacy-episode": localRating(localPodcastKey, 8.4),
    "legacy-title-key": localRating(localPodcastKey, 6.1)
  } });
  await runtime.migrateLocalManualEpisodeRatingToSupabase(episode);
  assert.equal(calls.insert.length, 1);
  assert.deepEqual(calls.insert[0], { user_id: userId, episode_id: canonicalId, rating: 8.4 });
  assert.equal(storeRef.value[userId][canonicalId].rating, 3.2, "wrong-podcast rating is preserved");
  assert.equal(storeRef.value[userId]["legacy-episode"], undefined, "verified migrated copy is removed");
  assert.equal(storeRef.value[userId]["legacy-title-key"].rating, 6.1, "different score is preserved for review");
  assert.deepEqual(storeRef.value["another-user"], {}, "other users' local buckets are unchanged");
}

// A server rating is authoritative and never overwritten or used to clear local data.
{
  const { runtime, storeRef, calls } = createHarness({
    ratings: { "legacy-episode": localRating(localPodcastKey, 8.4) },
    queryResult: { data: [{ rating: 7.7 }], error: null }
  });
  await runtime.migrateLocalManualEpisodeRatingToSupabase(episode);
  assert.equal(calls.insert.length, 0);
  assert.equal(storeRef.value[userId]["legacy-episode"].rating, 8.4);
}

// Read and insert failures preserve the original browser value for a safe retry.
for (const failure of [
  { stage: "read", queryResult: { data: null, error: new Error("read failed") } },
  { stage: "insert", insertResult: { error: new Error("insert failed") } }
]) {
  const { runtime, storeRef } = createHarness({
    ratings: { "legacy-episode": localRating(localPodcastKey, 8.4) },
    queryResult: failure.queryResult || { data: [], error: null },
    insertResult: failure.insertResult || { error: null }
  });
  await assert.rejects(runtime.migrateLocalManualEpisodeRatingToSupabase(episode), /failed/u);
  assert.equal(storeRef.value[userId]["legacy-episode"].rating, 8.4, `${failure.stage} failure preserves local rating`);
}

// A duplicate canonical insert means another writer won; never delete local recovery data.
{
  const { runtime, storeRef } = createHarness({
    ratings: { "legacy-episode": localRating(localPodcastKey, 8.4) },
    insertResult: { error: { code: "23505" } }
  });
  await runtime.migrateLocalManualEpisodeRatingToSupabase(episode);
  assert.equal(storeRef.value[userId]["legacy-episode"].rating, 8.4);
}

// If the account changes while the lookup is pending, no insert or cleanup occurs.
{
  let finishQuery;
  const { runtime, state, storeRef, calls } = createHarness({
    ratings: { "legacy-episode": localRating(localPodcastKey, 8.4) },
    onQuery: () => new Promise((resolve) => { finishQuery = resolve; })
  });
  const pending = runtime.migrateLocalManualEpisodeRatingToSupabase(episode);
  await new Promise((resolve) => setImmediate(resolve));
  state.authUser = { id: "different-user" };
  state.userScopedRequestGeneration += 1;
  finishQuery({ data: [], error: null });
  await pending;
  assert.equal(calls.insert.length, 0, "stale account lookup cannot insert a rating");
  assert.equal(storeRef.value[userId]["legacy-episode"].rating, 8.4, "stale account lookup cannot delete local data");
}

// If the account changes while an insert is pending, the old local value is retained.
{
  let finishInsert;
  const { runtime, state, storeRef, calls } = createHarness({
    ratings: { "legacy-episode": localRating(localPodcastKey, 8.4) },
    onInsert: () => new Promise((resolve) => { finishInsert = resolve; })
  });
  const pending = runtime.migrateLocalManualEpisodeRatingToSupabase(episode);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.insert.length, 1);
  state.authUser = { id: "different-user" };
  state.userScopedRequestGeneration += 1;
  finishInsert({ error: null });
  await pending;
  assert.equal(calls.insert[0].user_id, userId, "insert remains scoped to its starting user");
  assert.equal(storeRef.value[userId]["legacy-episode"].rating, 8.4, "stale insert cannot clear local data");
}

console.log("Local episode-rating migration identity, overwrite, failure, and account-switch safeguards: PASS");
