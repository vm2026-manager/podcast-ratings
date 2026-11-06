import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CATALOGUE_SYNC_RECOVERY_COOLDOWN_MS,
  decideCatalogueSyncRecovery,
  recoverCatalogueSyncIfNeeded
} from "./catalogue-sync-recovery.mjs";

const now = Date.parse("2026-11-06T09:30:00Z");
const ids = ["marcos", "louvrekuppet", "marcos"];
const noDrift = await recoverCatalogueSyncIfNeeded({ driftedPodcastIds: [], now });
assert.deepEqual(noDrift, { dispatch: false, reason: "no-verified-catalogue-drift", podcastIds: [] });

const recoveryCalls = [];
const fetchImpl = async (url, init = {}) => {
  recoveryCalls.push({ url, init });
  if (init.method === "POST") return { ok: true, status: 204, json: async () => null };
  if (url.includes("/actions/workflows/sync-sheet-data.yml/runs?")) {
    return { ok: true, status: 200, json: async () => ({ workflow_runs: [] }) };
  }
  if (url.includes("/pulls?")) return { ok: true, status: 200, json: async () => [] };
  throw new Error(`Unexpected URL ${url}`);
};
const positive = await recoverCatalogueSyncIfNeeded({
  driftedPodcastIds: ids,
  repository: "owner/repository",
  token: "test-token",
  now,
  fetchImpl
});
assert.equal(positive.dispatch, true, "verified drift with no active work dispatches the existing sync workflow");
assert.deepEqual(positive.podcastIds, ["louvrekuppet", "marcos"], "drifted Podcast-IDs are deduplicated and stable");
assert.equal(recoveryCalls.filter(({ init }) => init.method === "POST").length, 1, "recovery dispatch happens once");
const dispatchCall = recoveryCalls.find(({ init }) => init.method === "POST");
assert.match(dispatchCall.url, /actions\/workflows\/sync-sheet-data\.yml\/dispatches$/u);
assert.deepEqual(JSON.parse(dispatchCall.init.body), { ref: "main" });

const active = decideCatalogueSyncRecovery({
  driftedPodcastIds: ids,
  runs: [{ id: 10, status: "queued", event: "schedule" }],
  now
});
assert.equal(active.reason, "sync-run-active", "queued sync runs suppress recovery");

const pendingPr = decideCatalogueSyncRecovery({
  driftedPodcastIds: ids,
  pullRequests: [{ number: 466 }],
  now
});
assert.equal(pendingPr.reason, "catalogue-sync-pr-open", "an existing catalogue PR suppresses concurrent updates");

const recentDispatch = decideCatalogueSyncRecovery({
  driftedPodcastIds: ids,
  runs: [{ id: 11, event: "workflow_dispatch", status: "completed", created_at: new Date(now - 5 * 60 * 60 * 1000).toISOString() }],
  now
});
assert.equal(recentDispatch.reason, "recovery-cooldown", "a recent dispatch is rate limited");

const cooledDown = decideCatalogueSyncRecovery({
  driftedPodcastIds: ids,
  runs: [{ id: 12, event: "workflow_dispatch", status: "completed", created_at: new Date(now - CATALOGUE_SYNC_RECOVERY_COOLDOWN_MS).toISOString() }],
  now
});
assert.equal(cooledDown.dispatch, true, "the six-hour cooldown expires at its boundary");

await assert.rejects(
  recoverCatalogueSyncIfNeeded({
    driftedPodcastIds: ids,
    repository: "owner/repository",
    token: "test-token",
    now,
    fetchImpl: async () => ({ ok: false, status: 403 })
  }),
  /HTTP 403/u,
  "GitHub API failures fail closed without a dispatch"
);

const healthWorkflow = await readFile(new URL("../.github/workflows/production-catalogue-health.yml", import.meta.url), "utf8");
assert.match(healthWorkflow, /actions: write/u, "health has only the permission needed to dispatch the existing workflow");
assert.match(healthWorkflow, /Recover catalogue drift through existing sync workflow[\s\S]*?steps\.sheet-source-check\.outcome == 'failure'/u);
assert.match(healthWorkflow, /node scripts\/catalogue-sync-recovery\.mjs --candidate-dir \.sync-health/u);
assert.match(healthWorkflow, /cron: "\*\/15 \* \* \* \*"/u, "existing health schedule is reused without adding a job or cron");
assert.match(healthWorkflow, /resolve_incident:[\s\S]*?type: boolean[\s\S]*?default: false/u);
assert.match(healthWorkflow, /github\.event_name == 'workflow_dispatch' && inputs\.resolve_incident == true/u);
assert.doesNotMatch(healthWorkflow, /github\.event_name == 'schedule'[\s\S]*?Resolve production catalogue alert/u);

console.log("Catalogue drift recovery deduplication, cooldown, fail-closed, and workflow gates passed.");
