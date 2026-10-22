import assert from "node:assert/strict";
import { evaluateCataloguePipeline } from "./catalogue-pipeline-watch.mjs";

const now = Date.parse("2026-10-22T18:00:00Z");
const recentSuccess = {
  run_number: 19,
  created_at: "2026-10-22T17:30:00Z",
  status: "completed",
  conclusion: "success",
  html_url: "https://github.com/example/repo/actions/runs/19"
};
assert.equal(evaluateCataloguePipeline({ runs: [recentSuccess], pullRequests: [], now }).ok, true);

const delayedFailure = evaluateCataloguePipeline({
  runs: [{ ...recentSuccess, created_at: "2026-10-22T15:30:00Z", conclusion: "failure" }],
  pullRequests: [],
  now
});
assert.equal(delayedFailure.ok, false);
assert.match(delayedFailure.errors[0], /run #19 is completed\/failure/u);

const stuckPullRequest = evaluateCataloguePipeline({
  runs: [recentSuccess],
  pullRequests: [{
    number: 272,
    created_at: "2026-10-22T15:00:00Z",
    html_url: "https://github.com/example/repo/pull/272",
    head: { sha: "deadbeef" }
  }],
  now
});
assert.equal(stuckPullRequest.ok, false);
assert.match(stuckPullRequest.errors[0], /PR #272 has remained open/u);

console.log("Catalogue pipeline freshness and stuck PR checks passed.");
