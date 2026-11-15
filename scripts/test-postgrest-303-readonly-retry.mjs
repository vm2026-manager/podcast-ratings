import assert from "node:assert/strict";
import { preflightAutoFeedIdentity } from "../supabase/functions/import-podcast-episodes/core.ts";
import { createSupabaseImportRepository } from "../supabase/functions/import-podcast-episodes/repository.ts";

const podcastKey = "politik for viderekomne med søs og huxi";
const expectedFilters = {
  table: "podcast_episodes",
  select: "id,podcast_key,source,external_guid,external_episode_id,title,description,published_at,duration_seconds,episode_url,audio_url,image_url,is_active,metadata",
  podcast_key: podcastKey,
  order: "id",
  range: [0, 199]
};
const config = { auto_verified_rss: true, podcast_key: podcastKey, source: "target_verified_rss" };
const episodes = [{ external_guid: "target-guid" }];
const withNoGuidOwners = repository => ({
  ...repository,
  async loadAutoFeedGuidOwners() { return []; }
});

function mockClient(results) {
  const calls = [];
  const writes = [];
  const client = {
    from(table) {
      const call = { table };
      calls.push(call);
      const builder = {
        select(fields) { call.select = fields; return this; },
        eq(field, value) { call[field] = value; return this; },
        order(field) { call.order = field; return this; },
        range(start, end) {
          call.range = [start, end];
          const result = results.shift();
          assert.ok(result, "the mock has a result for every attempted read");
          return Promise.resolve(result);
        },
        insert(value) { writes.push({ operation: "insert", value }); throw new Error("unexpected write"); },
        update(value) { writes.push({ operation: "update", value }); throw new Error("unexpected write"); },
        upsert(value) { writes.push({ operation: "upsert", value }); throw new Error("unexpected write"); }
      };
      return builder;
    }
  };
  return { client, calls, writes };
}

const transient = mockClient([
  { data: null, error: { code: "PGRST303", status: 401, message: "JWT claims parse failed" } },
  { data: [], error: null }
]);
const transientRepository = withNoGuidOwners(createSupabaseImportRepository(transient.client));
const safe = await preflightAutoFeedIdentity(config, episodes, transientRepository);
assert.equal(safe.status, "safe", "the full identity preflight runs only after the read retry succeeds");
assert.equal(safe.reason, null);
assert.equal(transient.calls.length, 2, "one PGRST303 is retried once on the read-only inventory GET");
assert.deepEqual(transient.calls, [expectedFilters, expectedFilters],
  "retry repeats the exact Podcast-ID inventory query without broadening it");
assert.deepEqual(transient.writes, [], "identity preflight retry never writes episodes or import runs");

const persistent = mockClient([
  { data: null, error: { code: "PGRST303", status: 401, message: "JWT claims parse failed" } },
  { data: null, error: { code: "PGRST303", status: 401, message: "JWT claims parse failed" } }
]);
await assert.rejects(
  preflightAutoFeedIdentity(config, episodes, withNoGuidOwners(createSupabaseImportRepository(persistent.client))),
  /Automatic RSS podcast identity inventory failed/,
  "a repeated PGRST303 remains fail-closed"
);
assert.equal(persistent.calls.length, 2, "the retry is strictly bounded to one additional read");
assert.deepEqual(persistent.writes, [], "repeated PGRST303 cannot reach any import write");

const otherError = mockClient([
  { data: null, error: { code: "PGRST301", status: 401, message: "invalid JWT" } },
  { data: [], error: null }
]);
await assert.rejects(
  preflightAutoFeedIdentity(config, episodes, withNoGuidOwners(createSupabaseImportRepository(otherError.client))),
  /Automatic RSS podcast identity inventory failed/
);
assert.equal(otherError.calls.length, 1, "other authentication failures are not retried");
assert.deepEqual(otherError.writes, []);

console.log("PGRST303 read-only identity inventory retry and fail-closed regressions: PASS");
