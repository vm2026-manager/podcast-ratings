import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migration-plans/20261104210000_add_protected_episode_import_monitor.sql", import.meta.url), "utf8");
const documentation = await readFile(new URL("../docs/episode-feed-monitor-readonly-plan.md", import.meta.url), "utf8");

assert.match(migration, /CREATE ROLE episode_monitor_rpc_owner\s+NOLOGIN[^;]*NOBYPASSRLS/iu);
assert.match(migration, /CREATE SCHEMA episode_monitor_private AUTHORIZATION postgres/iu);
assert.match(migration, /CREATE POLICY episode_monitor_rpc_owner_identity_read[\s\S]+?TO episode_monitor_rpc_owner[\s\S]+?auth\.uid\(\) = '00000000-0000-4000-8000-000000000061'::uuid/iu);
assert.match(migration, /CREATE FUNCTION episode_monitor_private\.status_for_podcasts[\s\S]+?SECURITY DEFINER[\s\S]+?SET search_path = ''[\s\S]+?SET row_security = on/iu);
assert.match(migration, /CREATE FUNCTION public\.episode_import_monitor_status[\s\S]+?SECURITY INVOKER[\s\S]+?SET search_path = ''[\s\S]+?SET row_security = on/iu);
assert.equal((migration.match(/SECURITY DEFINER/giu) || []).length, 1, "only the private implementation may be SECURITY DEFINER");
assert.equal((migration.match(/auth\.uid\(\) IS DISTINCT FROM '00000000-0000-4000-8000-000000000061'::uuid/giu) || []).length, 2,
  "both public wrapper and private implementation must check the exact identity");
assert.match(migration, /REVOKE ALL ON FUNCTION public\.episode_import_monitor_status\(text\[\], timestamptz\)\s+FROM PUBLIC, anon/iu);
assert.match(migration, /GRANT EXECUTE ON FUNCTION public\.episode_import_monitor_status\(text\[\], timestamptz\)\s+TO authenticated/iu);
assert.match(migration, /GRANT SELECT \(podcast_key, started_at, status\)[\s\S]+?TO episode_monitor_rpc_owner/iu);
assert.match(migration, /LIMIT 2/iu);
assert.match(migration, /interval '14 days'/iu);
assert.match(migration, /cardinality\(p_podcast_ids\) > 10/iu, "queries are bounded to at most 10 exact IDs");
assert.match(migration, /count\(DISTINCT supplied\.id\)/iu, "duplicate input IDs are rejected");
assert.match(migration, /REVOKE SELECT ON TABLE public\.episode_import_runs FROM PUBLIC, anon, authenticated/iu,
  "direct table SELECT is explicitly revoked from public API roles");
assert.match(migration, /LEFT JOIN LATERAL/iu, "unknown exact IDs return a zero-run aggregate instead of widening the query");
assert.match(migration, /coalesce\(latest\.run_count, 0\)::smallint/iu, "a missing run is represented as a zero count");
assert.match(migration, /latest\.statuses\[1\] = 'failed' AND latest\.statuses\[2\] = 'failed'/iu,
  "two consecutive latest failures are exposed as an actionable aggregate");
assert.match(migration, /r\.podcast_key = requested\.podcast_key[\s\S]+?ORDER BY r\.started_at DESC[\s\S]+?LIMIT 2/iu,
  "latest-two-run lookup is exact-ID and index-order bounded");
assert.doesNotMatch(migration, /error_message|details|service_role|(?<!NO)BYPASSRLS\s*(?:;|,|$)/iu);
assert.match(documentation, /minimal `SECURITY INVOKER` wrapper/iu);
assert.match(documentation, /dedicated non-exposed `episode_monitor_private` schema/iu);
assert.doesNotMatch(documentation, /`SECURITY DEFINER` RPC in exposed `public`/iu);

console.log("Protected episode monitor migration static security checks: PASS");
