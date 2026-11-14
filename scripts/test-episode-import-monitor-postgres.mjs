import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationPath = path.join(root, "supabase/migration-plans/20261104210000_add_protected_episode_import_monitor.sql");
const fixturePath = path.join(root, "supabase/migration-plans/episode-monitor-test-fixture.sql");
const seedPath = path.join(root, "supabase/migration-plans/episode-monitor-test-seed.sql");
const explainPath = path.join(root, "supabase/migration-plans/episode-monitor-explain.sql");
const databaseUrl = process.env.EPISODE_MONITOR_DATABASE_URL;
const apiUrl = process.env.EPISODE_MONITOR_POSTGREST_URL || "http://127.0.0.1:3000";
const jwtSecret = process.env.EPISODE_MONITOR_TEST_JWT_SECRET;
const machineId = "00000000-0000-4000-8000-000000000061";
const now = Date.now();

assert.ok(databaseUrl, "EPISODE_MONITOR_DATABASE_URL is required; this runner must target an isolated test database");
assert.ok(jwtSecret && jwtSecret.length >= 32, "a separate test-only JWT secret of at least 32 characters is required");
assert.match(databaseUrl, /(?:localhost|127\.0\.0\.1)(?::\d+)?\//u,
  "refusing any database URL that does not resolve to the local PostgreSQL service");

function psql(args, { allowFailure = false } = {}) {
  try {
    return { status: 0, stdout: execFileSync("psql", ["-X", "-q", "-v", "ON_ERROR_STOP=1", "--no-psqlrc", ...args], {
      encoding: "utf8", env: { ...process.env, PGPASSWORD: process.env.EPISODE_MONITOR_TEST_DB_PASSWORD || "postgres" },
      maxBuffer: 16 * 1024 * 1024
    }) };
  } catch (error) {
    const result = { status: error.status ?? 1, stdout: error.stdout?.toString?.() || "", stderr: error.stderr?.toString?.() || "" };
    if (!allowFailure) throw new Error(`Isolated PostgreSQL test command failed (exit ${result.status}).\n${result.stderr.slice(-3000)}`);
    return result;
  }
}

function applySqlFile(file) {
  psql(["--dbname", databaseUrl, "--file", file]);
}

function scalar(sql) {
  return psql(["--dbname", databaseUrl, "--tuples-only", "--no-align", "--command", sql]).stdout.trim();
}

function expectSqlDenied(sql, label) {
  const result = psql(["--dbname", databaseUrl, "--command", sql], { allowFailure: true });
  assert.notEqual(result.status, 0, `${label} unexpectedly succeeded`);
}

function signedToken({ role = "authenticated", sub = machineId, exp = Math.floor(Date.now() / 1000) + 300 } = {}) {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "HS256", typ: "JWT" })}.${encode({ role, ...(sub ? { sub } : {}), exp })}`;
  const signature = createHmac("sha256", jwtSecret).update(unsigned).digest("base64url");
  return `${unsigned}.${signature}`;
}

async function api(pathname, { token, method = "GET", body } = {}) {
  const response = await fetch(new URL(pathname, apiUrl), {
    method,
    headers: {
      apikey: signedToken({ role: "anon", sub: null }),
      authorization: `Bearer ${token}`,
      ...(body ? { "content-type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await response.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  return { status: response.status, ok: response.ok, payload, text };
}

function statusQuery(ids, activatedAfter = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) {
  const activationDates = Array.isArray(activatedAfter) ? activatedAfter : ids.map(() => activatedAfter);
  return api("/rpc/episode_import_monitor_status", {
    token: signedToken(), method: "POST", body: { p_podcast_ids: ids, p_activated_after: activationDates }
  });
}

function planNodes(node, output = []) {
  if (!node || typeof node !== "object") return output;
  if (node["Node Type"]) output.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) for (const item of value) planNodes(item, output);
    else if (value && typeof value === "object") planNodes(value, output);
  }
  return output;
}

// This exact sequence applies the draft SQL only to the localhost PostgreSQL
// 17 service. No Supabase URL, project, or production credential is accepted.
if (!process.argv.includes("--skip-prepare")) {
  applySqlFile(fixturePath);
  applySqlFile(migrationPath);
  applySqlFile(seedPath);
  if (process.argv.includes("--prepare-only")) {
    console.log("Isolated PostgreSQL 17 fixture, migration and synthetic seed: PASS");
    process.exit(0);
  }
}

const privileges = JSON.parse(scalar(`
  SELECT json_build_object(
    'rls', c.relrowsecurity,
    'owner_login', r.rolcanlogin,
    'owner_bypassrls', r.rolbypassrls,
    'owner_superuser', r.rolsuper,
    'owner_owns_table', c.relowner = r.oid,
    'owner_owns_private_schema', n.nspowner = r.oid,
    'anon_select', has_any_column_privilege('anon', c.oid, 'SELECT'),
    'authenticated_select', has_any_column_privilege('authenticated', c.oid, 'SELECT'),
    'function_role_table_select', has_table_privilege(r.oid, c.oid, 'SELECT'),
    'function_role_key_select', has_column_privilege(r.oid, c.oid, 'podcast_key', 'SELECT'),
    'function_role_started_select', has_column_privilege(r.oid, c.oid, 'started_at', 'SELECT'),
    'function_role_status_select', has_column_privilege(r.oid, c.oid, 'status', 'SELECT'),
    'function_role_error_select', has_column_privilege(r.oid, c.oid, 'error_message', 'SELECT'),
    'public_is_definer', (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='public' AND p.proname='episode_import_monitor_status'),
    'private_is_definer', (SELECT p.prosecdef FROM pg_proc p JOIN pg_namespace s ON s.oid=p.pronamespace WHERE s.nspname='episode_monitor_private' AND p.proname='status_for_podcasts')
  )
  FROM pg_class c
  JOIN pg_namespace n ON n.oid=c.relnamespace
  JOIN pg_roles r ON r.rolname='episode_monitor_rpc_owner'
  WHERE n.nspname='public' AND c.relname='episode_import_runs'
`));
assert.deepEqual(privileges, {
  rls: true,
  owner_login: false,
  owner_bypassrls: false,
  owner_superuser: false,
  owner_owns_table: false,
  owner_owns_private_schema: false,
  anon_select: false,
  authenticated_select: false,
  function_role_table_select: false,
  function_role_key_select: true,
  function_role_started_select: true,
  function_role_status_select: true,
  function_role_error_select: false,
  public_is_definer: false,
  private_is_definer: true
});

expectSqlDenied("SET ROLE anon; SELECT count(*) FROM public.episode_import_runs", "anon direct table SELECT");
expectSqlDenied("SET ROLE authenticated; SELECT count(*) FROM public.episode_import_runs", "authenticated direct table SELECT");
expectSqlDenied("SET ROLE episode_monitor_rpc_owner; SELECT error_message FROM public.episode_import_runs LIMIT 1",
  "function owner SELECT of non-granted raw error column");

const ownerAllowed = scalar(`
  BEGIN;
  SET LOCAL ROLE episode_monitor_rpc_owner;
  SET LOCAL request.jwt.claims='{"sub":"${machineId}","role":"authenticated"}';
  SELECT count(*) FROM public.episode_import_runs WHERE podcast_key='monitor-one-success';
  COMMIT;
`);
assert.equal(ownerAllowed.split(/\r?\n/u).at(-1), "1", "function role reads exact rows under its identity RLS policy");
const ownerRlsDenied = scalar(`
  BEGIN;
  SET LOCAL ROLE episode_monitor_rpc_owner;
  SET LOCAL request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
  SELECT count(*) FROM public.episode_import_runs WHERE podcast_key='monitor-one-success';
  COMMIT;
`);
assert.equal(ownerRlsDenied.split(/\r?\n/u).at(-1), "0", "RLS hides import rows from a different identity");

expectSqlDenied(`
  BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
  SELECT * FROM episode_monitor_private.status_for_podcasts(ARRAY['monitor-one-success'], ARRAY[now()-interval '1 day']);
  ROLLBACK;
`, "direct private function call by an unrelated authenticated identity");

const apiWaitUntil = Date.now() + 30_000;
let apiReady = false;
while (Date.now() < apiWaitUntil) {
  try {
    const response = await fetch(new URL("/", apiUrl));
    if (response.ok) { apiReady = true; break; }
  } catch { /* PostgREST container is still starting. */ }
  await new Promise(resolve => setTimeout(resolve, 500));
}
assert.ok(apiReady, "isolated PostgREST test service did not become ready");

for (const [label, token] of [
  ["anon", signedToken({ role: "anon", sub: null })],
  ["ordinary authenticated", signedToken({ role: "authenticated", sub: "22222222-2222-4222-8222-222222222222" })],
  ["machine identity direct table read", signedToken()]
]) {
  const response = await api("/episode_import_runs?select=*", { token });
  assert.ok(response.status === 401 || response.status === 403, `${label} read returned HTTP ${response.status}`);
}

for (const [label, token] of [
  ["anon", signedToken({ role: "anon", sub: null })],
  ["ordinary authenticated", signedToken({ role: "authenticated", sub: "22222222-2222-4222-8222-222222222222" })]
]) {
  const response = await api("/rpc/episode_import_monitor_status", {
    token, method: "POST", body: { p_podcast_ids: ["monitor-one-success"],
      p_activated_after: [new Date(Date.now() - 60_000).toISOString()] }
  });
  assert.ok(response.status >= 400, `${label} unexpectedly fetched protected statuses`);
}

const machineToken = signedToken();
const directPrivateRpc = await api("/rpc/status_for_podcasts", {
  token: machineToken, method: "POST", body: { p_podcast_ids: ["monitor-one-success"],
    p_activated_after: [new Date(Date.now() - 60_000).toISOString()] }
});
assert.equal(directPrivateRpc.status, 404, "private schema is not exposed by PostgREST");

const activated = new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString();
const nowIso = Date.now();
const activationById = new Map([
  ["monitor-never-imported", new Date(nowIso - 12 * 86400000).toISOString()],
  ["monitor-one-success", new Date(nowIso - 3 * 86400000).toISOString()],
  ["monitor-two-failures", new Date(nowIso - 6 * 86400000).toISOString()],
  ["monitor-recovery", new Date(nowIso - 5 * 86400000).toISOString()],
  ["monitor-partial", new Date(nowIso - 3 * 86400000).toISOString()],
  ["monitor-running", new Date(nowIso - 3 * 86400000).toISOString()],
  ["monitor-newer-activation", new Date(nowIso - 2 * 3600000).toISOString()],
  ["monitor-import-before-activation", new Date(nowIso - 2 * 86400000).toISOString()],
  ["monitor-old-activation-no-recent-runs", new Date(nowIso - 30 * 86400000).toISOString()]
]);
const idsWithDifferentActivations = [...activationById.keys()];
const results = await statusQuery(idsWithDifferentActivations, [...activationById.values()]);
assert.equal(results.status, 200, `authorized test machine RPC failed: HTTP ${results.status} ${results.text}`);
const rows = new Map(results.payload.map(row => [row.podcast_key, row]));
assert.equal(results.payload.length, idsWithDifferentActivations.length, "one bounded RPC returns one result per exact ID");
assert.equal(rows.get("monitor-never-imported").run_count, 0, "no first import is an explicit zero-run row");
assert.equal(rows.get("monitor-never-imported").latest_run_status, null);
assert.equal(rows.get("monitor-never-imported").imported_after_activation, false);
assert.equal(rows.get("monitor-one-success").run_count, 1, "one latest run is represented accurately");
assert.equal(rows.get("monitor-one-success").latest_run_status, "success");
assert.equal(rows.get("monitor-one-success").last_success_at !== null, true);
assert.equal(rows.get("monitor-two-failures").run_count, 2, "only latest two runs are counted");
assert.equal(rows.get("monitor-two-failures").latest_run_status, "failed");
assert.equal(rows.get("monitor-two-failures").consecutive_failure_count, 2);
assert.ok(Date.parse(rows.get("monitor-two-failures").last_success_at) < Date.parse(rows.get("monitor-two-failures").last_failure_at),
  "last success remains observable when two newer runs failed");
assert.equal(rows.get("monitor-recovery").latest_run_status, "success");
assert.equal(rows.get("monitor-recovery").consecutive_failure_count, 0, "a successful run resets consecutive failures");
assert.ok(Date.parse(rows.get("monitor-recovery").last_success_at) > Date.parse(rows.get("monitor-recovery").last_failure_at),
  "recovery success follows the last failure");
assert.equal(rows.get("monitor-partial").latest_run_status, "partial");
assert.equal(rows.get("monitor-partial").consecutive_failure_count, 0, "partial is not silently reclassified as failed");
assert.equal(rows.get("monitor-running").latest_run_status, "running", "in-progress import remains distinguishable");
assert.equal(rows.get("monitor-newer-activation").run_count, 1,
  "the newer ID counts only runs after its own activation, not its earlier failed run");
assert.equal(rows.get("monitor-newer-activation").latest_run_status, "success");
assert.equal(rows.get("monitor-newer-activation").last_failure_at, null,
  "a failure before that ID's activation is excluded from its failure history");
assert.equal(rows.get("monitor-import-before-activation").run_count, 0,
  "an import before activation does not count as the first activated import");
assert.equal(rows.get("monitor-import-before-activation").latest_run_status, null);
assert.equal(rows.get("monitor-old-activation-no-recent-runs").run_count, 0,
  "an activation outside the 14-day window never widens the database history scan");
assert.doesNotMatch(results.text, /SYNTHETIC_PRIVATE_ERROR|error_message|details/iu, "raw error data and JSON details are never returned");

const unknown = await statusQuery(["valid-but-unknown-id"]);
assert.equal(unknown.status, 200, "an unknown exact ID is not an authorization error");
assert.equal(unknown.payload.length, 1);
assert.equal(unknown.payload[0].run_count, 0, "unknown exact ID is an explicit zero-run result");
assert.equal(unknown.payload[0].latest_run_status, null);

const maxBatch = await statusQuery(Array.from({ length: 10 }, (_, i) => `valid-unknown-${i}`));
assert.equal(maxBatch.status, 200, "the maximum of 10 exact IDs is accepted");
assert.equal(maxBatch.payload.length, 10);
const fourteenDayBoundary = await statusQuery(["valid-at-fourteen-day-boundary"],
  new Date(Date.now() - 14 * 24 * 60 * 60 * 1000 + 5_000).toISOString());
assert.equal(fourteenDayBoundary.status, 200, "an activation timestamp within five seconds of the 14-day boundary is accepted");
const olderActivationIsBounded = await statusQuery(["valid-old-activation"],
  new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
assert.equal(olderActivationIsBounded.status, 200,
  "an older activation is accepted as input while SQL still clamps history to the last 14 days");

for (const [label, ids, date] of [
  ["zero IDs", [], activated],
  ["more than ten IDs", Array.from({ length: 11 }, (_, i) => `over-limit-${i}`), activated],
  ["duplicate IDs", ["monitor-one-success", "monitor-one-success"], activated],
  ["empty ID", [""], activated],
  ["whitespace ID", ["   "], activated],
  ["oversized ID", ["x".repeat(301)], activated]
]) {
  const response = await statusQuery(ids, date);
  assert.ok(response.status >= 400, `${label} unexpectedly returned HTTP ${response.status}`);
}
for (const [label, ids, activations] of [
  ["activation array length mismatch", ["monitor-one-success", "monitor-recovery"], [activated]],
  ["null activation timestamp", ["monitor-one-success"], [null]],
  ["future activation timestamp", ["monitor-one-success"], [new Date(Date.now() + 60_000).toISOString()]]
]) {
  const response = await statusQuery(ids, activations);
  assert.ok(response.status >= 400, `${label} unexpectedly returned HTTP ${response.status}`);
}

const expired = await api("/rpc/episode_import_monitor_status", {
  token: signedToken({ exp: Math.floor(Date.now() / 1000) - 60 }), method: "POST",
  body: { p_podcast_ids: ["monitor-one-success"], p_activated_after: [activated] }
});
assert.equal(expired.status, 401, "PostgREST rejects an expired test JWT");

const identityDenied = await api("/rpc/episode_import_monitor_status", {
  token: signedToken({ sub: "22222222-2222-4222-8222-222222222222" }), method: "POST",
  body: { p_podcast_ids: ["monitor-one-success"], p_activated_after: [activated] }
});
assert.ok(identityDenied.status === 401 || identityDenied.status === 403,
  `the wrong authenticated identity must be denied as authorization, got ${identityDenied.status}`);

const planText = psql(["--dbname", databaseUrl, "--tuples-only", "--no-align", "--file", explainPath]).stdout.trim();
const planRoot = JSON.parse(planText)[0].Plan;
const nodes = planNodes(planRoot);
const seqScans = nodes.filter(node => /Seq Scan/u.test(node["Node Type"] || ""));
assert.equal(seqScans.length, 0, "bounded status plan must not use a sequential scan");
const indexScans = nodes.filter(node => /Index Scan/u.test(node["Node Type"] || ""));
assert.ok(indexScans.length >= 3 && indexScans.length <= 30, `expected bounded index probes, got ${indexScans.length}`);
assert.ok(indexScans.every(node => String(node["Index Name"] || "").includes("episode_import_runs_podcast_key_started_at_idx")),
  "all status lookup index scans use the existing Podcast-ID/started_at index");
const tempRead = nodes.reduce((sum, node) => sum + (node["Temp Read Blocks"] || 0), 0);
const tempWritten = nodes.reduce((sum, node) => sum + (node["Temp Written Blocks"] || 0), 0);
const sharedBuffers = nodes.reduce((sum, node) => sum + (node["Shared Hit Blocks"] || 0) + (node["Shared Read Blocks"] || 0), 0);
assert.equal(tempRead + tempWritten, 0, "bounded plan must not spill to temporary disk");
assert.ok(sharedBuffers <= 5000, `buffer budget exceeded: ${sharedBuffers} shared blocks`);
assert.ok(planRoot["Actual Total Time"] <= 3000, `query runtime budget exceeded: ${planRoot["Actual Total Time"]} ms`);
console.log(JSON.stringify({
  status: "PASS",
  postgresql: psql(["--dbname", databaseUrl, "--tuples-only", "--no-align", "--command", "SHOW server_version"]).stdout.trim(),
  postgrest: "JWT, roles, RPC, RLS and expiry verified",
  requested_id_max: 10,
  plan: { index_scans: indexScans.length, seq_scans: seqScans.length, shared_buffers: sharedBuffers,
    temp_blocks: tempRead + tempWritten, actual_ms: planRoot["Actual Total Time"] }
}, null, 2));
