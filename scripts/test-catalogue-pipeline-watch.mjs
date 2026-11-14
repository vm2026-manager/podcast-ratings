import assert from "node:assert/strict";
import { evaluateCataloguePipeline, mergeCatalogueRunHistory } from "./catalogue-pipeline-watch.mjs";

const now = Date.parse("2026-10-22T18:00:00Z");
const recentScheduledSuccess = {
  id: 19,
  run_number: 19,
  event: "schedule",
  created_at: "2026-10-22T17:30:00Z",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/example/repo/actions/runs/19"
};
const recentDispatchSuccess = {
  id: 20,
  run_number: 20,
  event: "workflow_dispatch",
  created_at: "2026-10-22T17:55:00Z",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/example/repo/actions/runs/20"
};

assert.equal(evaluateCataloguePipeline({ runs: [recentScheduledSuccess], pullRequests: [], now }).ok, true);
assert.equal(evaluateCataloguePipeline({ runs: [recentScheduledSuccess, recentDispatchSuccess], pullRequests: [], now }).ok, true);

const dispatchCannotSubstituteForSchedule = evaluateCataloguePipeline({
  runs: [{ ...recentDispatchSuccess, created_at: "2026-10-22T17:59:00Z" }],
  pullRequests: [],
  now
});
assert.equal(dispatchCannotSubstituteForSchedule.ok, false);
assert.match(dispatchCannotSubstituteForSchedule.errors.join("\n"), /No scheduled Sync Podcastlisten catalogue run is recorded/u);

const staleScheduleCannotBeHiddenByDispatch = evaluateCataloguePipeline({
  runs: [
    { ...recentScheduledSuccess, created_at: "2026-10-22T15:30:00Z" },
    recentDispatchSuccess
  ],
  pullRequests: [],
  now
});
assert.equal(staleScheduleCannotBeHiddenByDispatch.ok, false);
assert.match(staleScheduleCannotBeHiddenByDispatch.errors.join("\n"), /No scheduled catalogue sync run has started for 150 minutes/u);

const scheduledRunOutsideRecentMixedPage = { ...recentScheduledSuccess, id: 10, created_at: "2026-10-22T15:30:00Z" };
const manyRecentManualRuns = Array.from({ length: 12 }, (_, index) => ({
  ...recentDispatchSuccess,
  id: 100 + index,
  run_number: 100 + index,
  created_at: new Date(Date.parse("2026-10-22T17:50:00Z") + index * 1000).toISOString()
}));
const mergedHistory = mergeCatalogueRunHistory(manyRecentManualRuns, [scheduledRunOutsideRecentMixedPage]);
assert.equal(mergedHistory.length, 13, "the scheduled-only API page supplements a busy mixed-event page");
const staleScheduleOutsideMixedPage = evaluateCataloguePipeline({ runs: mergedHistory, pullRequests: [], now });
assert.equal(staleScheduleOutsideMixedPage.ok, false);
assert.match(staleScheduleOutsideMixedPage.errors.join("\n"), /No scheduled catalogue sync run has started for 150 minutes/u);

const staleScheduledFailure = evaluateCataloguePipeline({
  runs: [{ ...recentScheduledSuccess, created_at: "2026-10-22T15:30:00Z", conclusion: "failure" }],
  pullRequests: [],
  now
});
assert.equal(staleScheduledFailure.ok, false);
assert.match(staleScheduledFailure.errors.join("\n"), /Latest scheduled catalogue sync run #19 is completed\/failure/u);

const failedOrdinaryRun = evaluateCataloguePipeline({
  runs: [
    { ...recentScheduledSuccess, created_at: "2026-10-22T15:00:00Z" },
    { ...recentDispatchSuccess, created_at: "2026-10-22T15:30:00Z", conclusion: "failure" }
  ],
  pullRequests: [],
  now
});
assert.equal(failedOrdinaryRun.ok, false);
assert.match(failedOrdinaryRun.errors.join("\n"), /Latest non-scheduled catalogue sync run #20 \(workflow_dispatch\) is completed\/failure/u);
assert.match(failedOrdinaryRun.errors.join("\n"), /No scheduled catalogue sync run has started/u);

const stuckPullRequest = evaluateCataloguePipeline({
  runs: [recentScheduledSuccess],
  pullRequests: [{
    number: 272,
    created_at: "2026-10-22T15:00:00Z",
    html_url: "https://github.com/example/repo/pull/272",
    head: { sha: "deadbeef" }
  }],
  now
});
assert.equal(stuckPullRequest.ok, false);
assert.match(stuckPullRequest.errors.join("\n"), /PR #272 has remained open/u);

const preservedThreshold = evaluateCataloguePipeline({
  runs: [{ ...recentScheduledSuccess, created_at: "2026-10-22T16:01:00Z" }],
  pullRequests: [],
  now
});
assert.equal(preservedThreshold.ok, true, "the existing two-hour freshness threshold remains unchanged");

console.log("Catalogue scheduled-event freshness, failed-run and stuck PR checks passed.");
