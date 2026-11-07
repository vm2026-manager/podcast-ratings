import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  applyImportStatusAlarms, monitorEpisodeImportStatus, renderImportStatusSection,
  IMPORT_STATUS_BATCH_LIMIT, IMPORT_STATUS_GRACE_MS
} from "./episode-import-status-monitor.mjs";

const now = new Date("2026-11-05T12:00:00.000Z");
const iso = hours => new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
const baseObservation = overrides => ({
  podcast_key: "grebet af gvfb", activated_at: iso(48), import_status_received: true,
  run_count: 2, consecutive_failure_count: 2, latest_run_status: "failed",
  last_success_at: iso(24), last_failure_at: iso(1), active_episode_count: 3, status: "counted",
  ...overrides
});

const firstFailure = applyImportStatusAlarms({ observations: [baseObservation()], now: now.toISOString(), workflowUrl: "https://example.test/run/1" });
assert.equal(firstFailure.alarms.length, 1, "two failed imports produce one actionable alarm");
assert.equal(firstFailure.alarms[0].problem_type, "two_consecutive_import_failures");
assert.equal(firstFailure.alarms[0].last_success_at, iso(24));
assert.equal(firstFailure.alarms[0].last_failure_at, iso(1));
assert.match(renderImportStatusSection({ ...firstFailure, access_status: "authorized", checked_count: 1, candidate_count: 1,
  supabase_request_count: 3, max_supabase_requests: 12 }), /grebet af gvfb/u);
assert.match(renderImportStatusSection({ ...firstFailure, access_status: "authorized", checked_count: 1, candidate_count: 1,
  supabase_request_count: 3, max_supabase_requests: 12 }), /Edge-deploystatus=ukendt/u,
  "an import result never stands in for an independently verified deployment signal");

const duplicateDaily = applyImportStatusAlarms({ observations: [baseObservation()], previousAlarms: firstFailure.alarms,
  now: new Date(now.getTime() + 86400000).toISOString(), workflowUrl: "https://example.test/run/2" });
assert.equal(duplicateDaily.changed, false, "same alarm state does not create a daily issue edit");
assert.deepEqual(duplicateDaily.alarms, firstFailure.alarms);

const recovery = applyImportStatusAlarms({ observations: [baseObservation({ run_count: 1,
  consecutive_failure_count: 0, latest_run_status: "success", last_success_at: now.toISOString(), status: "counted" })],
  previousAlarms: firstFailure.alarms, now: now.toISOString(), workflowUrl: "https://example.test/run/3" });
assert.equal(recovery.alarms.length, 0);
assert.equal(recovery.recovered_now.length, 1, "a later successful import plus a usable active episode resolves the alarm");

const datedOutcomes = applyImportStatusAlarms({ observations: [
  baseObservation({ podcast_key: "older-activation", activated_at: iso(120), run_count: 2,
    consecutive_failure_count: 2, latest_run_status: "failed", import_history_status: "import_observed_after_activation" }),
  baseObservation({ podcast_key: "newer-activation", activated_at: iso(2), run_count: 1,
    consecutive_failure_count: 0, latest_run_status: "success", last_success_at: iso(1), last_failure_at: null,
    import_history_status: "import_observed_after_activation" }),
  baseObservation({ podcast_key: "only-pre-activation-run", activated_at: iso(48), run_count: 0,
    consecutive_failure_count: 0, latest_run_status: null, last_success_at: null, last_failure_at: null,
    import_history_status: "no_import_after_activation" }),
  baseObservation({ podcast_key: "stale-history", activated_at: iso(30 * 24), run_count: 0,
    consecutive_failure_count: 0, latest_run_status: null, last_success_at: null, last_failure_at: null,
    import_history_status: "unknown_outside_window" })
], now: now.toISOString() });
assert.ok(datedOutcomes.alarms.some(alarm => alarm.podcast_key === "older-activation" &&
  alarm.problem_type === "two_consecutive_import_failures"), "older ID retains failures within its own activation window");
assert.ok(datedOutcomes.alarms.some(alarm => alarm.podcast_key === "newer-activation" &&
  alarm.problem_type === "zero_usable_episodes") === false, "the newer ID's successful post-activation run is evaluated independently");
assert.ok(datedOutcomes.alarms.some(alarm => alarm.podcast_key === "only-pre-activation-run" &&
  alarm.problem_type === "missing_first_import"), "a pre-activation import does not satisfy the first-import check");
assert.ok(!datedOutcomes.alarms.some(alarm => alarm.podcast_key === "stale-history" &&
  alarm.problem_type === "missing_first_import"), "history older than the bounded window is unknown, not a proven missing import");

const zeroAfterSuccess = applyImportStatusAlarms({ observations: [baseObservation({ run_count: 1,
  consecutive_failure_count: 0, latest_run_status: "success", last_success_at: now.toISOString(), active_episode_count: 0,
  status: "counted" })], previousAlarms: firstFailure.alarms, now: now.toISOString() });
assert.equal(zeroAfterSuccess.alarms.length, 2, "success alone cannot hide a source with no usable active episodes or erase its prior failure");
assert.ok(zeroAfterSuccess.alarms.some(alarm => alarm.problem_type === "zero_usable_episodes"));
assert.equal(zeroAfterSuccess.recovered_now.length, 0);

const firstImportMissing = applyImportStatusAlarms({ observations: [baseObservation({ run_count: 0,
  consecutive_failure_count: 0, latest_run_status: null, last_success_at: null, last_failure_at: null, active_episode_count: 0 })],
  now: now.toISOString() });
assert.deepEqual(firstImportMissing.alarms.map(alarm => alarm.problem_type).sort(),
  ["missing_first_import", "zero_usable_episodes"].sort(), "36-hour activation grace separates missing import from empty source");
assert.equal(IMPORT_STATUS_GRACE_MS, 36 * 60 * 60 * 1000);
const withinGrace = applyImportStatusAlarms({ observations: [baseObservation({ activated_at: iso(12), run_count: 0,
  consecutive_failure_count: 0, latest_run_status: null, active_episode_count: 0 })], now: now.toISOString() });
assert.equal(withinGrace.alarms.length, 0, "new adapter activation gets its documented grace period");
const staleHistory = applyImportStatusAlarms({ observations: [baseObservation({ activated_at: iso(30 * 24), run_count: 0,
  consecutive_failure_count: 0, latest_run_status: null, last_success_at: null, last_failure_at: null,
  active_episode_count: 3, import_history_status: "unknown_outside_window" })], now: now.toISOString() });
assert.equal(staleHistory.alarms.length, 0, "an activation outside the bounded history is not misreported as a missing first import");
const staleHistoryNote = renderImportStatusSection({ ...staleHistory, observations: [baseObservation({
  activated_at: iso(30 * 24), import_history_status: "unknown_outside_window" })], access_status: "authorized",
  checked_count: 1, candidate_count: 1, supabase_request_count: 3, max_supabase_requests: 3 });
assert.match(staleHistoryNote, /unknown_outside_window/u,
  "insufficient history remains visible in the deduplicated incident report");
assert.match(staleHistoryNote, /beviser ikke, om første import fandt sted/u);

const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const row = catalogue.rows.find(item => item["Podcast-ID"] === "grebet af gvfb");
assert.ok(row?.Feed, "test uses a current approved exact-ID catalogue row");
const candidate = { podcast_key: row["Podcast-ID"], feed: row.Feed, change_type: "adapter_config_changed",
  adapter_status: "approved_active", observed_at: iso(48) };
const report = { candidates: [candidate] };
const secondRow = catalogue.rows.find(item => item["Podcast-ID"] === "sig det løgn");
assert.ok(secondRow?.Feed, "test uses a second current approved exact-ID catalogue row");
const secondCandidate = { podcast_key: secondRow["Podcast-ID"], feed: secondRow.Feed,
  change_type: "adapter_config_changed", adapter_status: "approved_active", observed_at: iso(2) };
const multiReport = { candidates: [candidate, secondCandidate] };
const fetchMock = responses => async (url, options = {}) => {
  const parsed = new URL(url);
  const request = { url: parsed, options };
  calls.push(request);
  const next = responses.shift();
  if (typeof next === "function") return next(request);
  if (!next) throw new Error(`Unexpected request: ${parsed}`);
  return next;
};
const jsonResponse = (status, body) => ({ status, ok: status >= 200 && status < 300, json: async () => body });
const headResponse = count => ({ status: 200, ok: true,
  headers: { get: name => name.toLowerCase() === "content-range" ? (count ? `0-0/${count}` : "*/0") : null } });

let calls = [];
const authorized = await monitorEpisodeImportStatus({ feedReport: multiReport, feedPayload: catalogue, monitorState: {},
  baseUrl: "https://testproject.supabase.co", anonKey: "test-anon", projectRef: "testproject",
  email: "machine@example.test", password: "test-only-password", now: () => now,
  fetchImpl: fetchMock([jsonResponse(200, { access_token: "test-jwt" }),
    jsonResponse(200, [candidate.podcast_key, secondCandidate.podcast_key].map(podcast_key => ({
      podcast_key, latest_run_status: "success", latest_run_started_at: iso(1), last_success_at: iso(1),
      last_failure_at: null, consecutive_failure_count: 0, run_count: 1, imported_after_activation: true
    }))), headResponse(2), headResponse(5)]) });
assert.equal(authorized.access_status, "authorized");
assert.equal(authorized.observations.length, 2);
assert.deepEqual(authorized.observations.map(item => item.podcast_key).sort(),
  [candidate.podcast_key, secondCandidate.podcast_key].sort());
assert.equal(authorized.unchanged, false, "first access status is persisted once");
assert.equal(authorized.supabase_request_count, 4, "two IDs share one auth + one aggregate RPC and use two exact-ID counts");
assert.equal(authorized.max_supabase_requests, 4);
assert.equal(calls.length, 4);
assert.equal(calls[1].url.pathname, "/rest/v1/rpc/episode_import_monitor_status");
const rpcBody = JSON.parse(calls[1].options.body);
assert.equal(rpcBody.p_podcast_ids.length, 2, "both exact IDs travel in the same RPC request");
assert.equal(rpcBody.p_activated_after.length, 2, "the bounded RPC receives one activation timestamp per ID");
const activationById = new Map(rpcBody.p_podcast_ids.map((id, index) => [id, rpcBody.p_activated_after[index]]));
assert.equal(activationById.get(candidate.podcast_key), iso(48));
assert.equal(activationById.get(secondCandidate.podcast_key), iso(2));
assert.ok(authorized.observations.every(item => item.import_history_status === "import_observed_after_activation"),
  "each returned row is classified against its paired activation timestamp");
assert.equal(calls[2].options.method, "HEAD");
assert.equal(calls[3].options.method, "HEAD");

calls = [];
const authorizationMissing = await monitorEpisodeImportStatus({ feedReport: report, feedPayload: catalogue,
  baseUrl: "https://testproject.supabase.co", anonKey: "test-anon", projectRef: "testproject", now: () => now,
  fetchImpl: fetchMock([]) });
assert.equal(authorizationMissing.access_status, "authorization_missing");
assert.equal(authorizationMissing.supabase_request_count, 0);
assert.equal(calls.length, 0, "missing credentials never attempt an API call");

calls = [];
const wrongProject = await monitorEpisodeImportStatus({ feedReport: report, feedPayload: catalogue,
  baseUrl: "https://not-the-configured-project.supabase.co", anonKey: "test-anon", projectRef: "testproject",
  email: "machine@example.test", password: "test-only-password", now: () => now, fetchImpl: fetchMock([]) });
assert.equal(wrongProject.access_status, "project_identity_mismatch");
assert.equal(calls.length, 0, "project-ref mismatch fails closed without network access");

const collisionFeedPayload = { rows: [...catalogue.rows, { ...row, Titel: `${row.Titel} duplicate` }] };
const identityCollision = await monitorEpisodeImportStatus({ feedReport: report, feedPayload: collisionFeedPayload,
  baseUrl: "https://testproject.supabase.co", anonKey: "test-anon", projectRef: "testproject",
  email: "machine@example.test", password: "test-only-password", now: () => now,
  fetchImpl: async () => { throw new Error("identity collisions must never trigger a protected request"); } });
assert.equal(identityCollision.access_status, "not_needed");
assert.equal(identityCollision.candidate_count, 0, "catalogue identity collisions are withheld from production queries");

calls = [];
const protectedApiFailure = await monitorEpisodeImportStatus({ feedReport: report, feedPayload: catalogue,
  baseUrl: "https://testproject.supabase.co", anonKey: "test-anon", projectRef: "testproject",
  email: "machine@example.test", password: "test-only-password", now: () => now,
  fetchImpl: fetchMock([jsonResponse(200, { access_token: "test-jwt" }), jsonResponse(503, { message: "synthetic outage" })]) });
assert.equal(protectedApiFailure.access_status, "api_error");
assert.equal(protectedApiFailure.observations.length, 0, "API failure is never interpreted as zero episodes");

const wrongIdentity = await monitorEpisodeImportStatus({ feedReport: report, feedPayload: catalogue,
  baseUrl: "https://testproject.supabase.co", anonKey: "test-anon", projectRef: "testproject",
  email: "machine@example.test", password: "test-only-password", now: () => now,
  fetchImpl: fetchMock([jsonResponse(200, { access_token: "wrong-identity-test-jwt" }),
    { status: 403, ok: false, json: async () => ({ message: "episode status unavailable" }) }]) });
assert.equal(wrongIdentity.access_status, "authorization_denied", "a valid but different identity is not reported as an API outage");

calls = [];
const emptyButAuthorized = await monitorEpisodeImportStatus({ feedReport: report, feedPayload: catalogue,
  baseUrl: "https://testproject.supabase.co", anonKey: "test-anon", projectRef: "testproject",
  email: "machine@example.test", password: "test-only-password", now: () => now,
  fetchImpl: fetchMock([jsonResponse(200, { access_token: "test-jwt" }), jsonResponse(200, [{
    podcast_key: candidate.podcast_key, latest_run_status: null, latest_run_started_at: null,
    last_success_at: null, last_failure_at: null, consecutive_failure_count: 0, run_count: 0,
    imported_after_activation: false
  }]), headResponse(0)]) });
assert.equal(emptyButAuthorized.access_status, "authorized");
assert.equal(emptyButAuthorized.observations[0].active_episode_count, 0, "only an exact valid count represents zero episodes");
assert.ok(emptyButAuthorized.alarms.some(alarm => alarm.problem_type === "missing_first_import"));

assert.equal(IMPORT_STATUS_BATCH_LIMIT, 10);
console.log("Protected import status alarm, deduplication, recovery and bounded API tests: PASS");
