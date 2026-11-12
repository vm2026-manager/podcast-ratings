import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [source, gateWorkflow] = await Promise.all([
  readFile(new URL("../.github/workflows/episode-feed-coverage.yml", import.meta.url), "utf8"),
  readFile(new URL("../.github/workflows/critical-regression-gate.yml", import.meta.url), "utf8")
]);
const sidecarTrigger = source.indexOf('"data/fri-mads-articles.json"');
const dailyScheduleCount = (source.match(/cron:/gu) || []).length;

assert.equal(dailyScheduleCount, 1, "the existing daily workflow cadence remains the only schedule");
assert.match(source, /cron:\s*"37 6 \* \* \*"/u, "the established daily 06:37 UTC cadence is retained");
assert.ok(sidecarTrigger >= 0, "a merged sidecar update is checked by the existing workflow");
assert.match(source, /permissions:\s*\n\s+contents:\s+read\s*\n\s+issues:\s+write/u,
  "the workflow token remains read-only for contents and the trusted PR token carries the write scope");
assert.doesNotMatch(source, /pull-requests:\s+write/u,
  "workflow-dispatch cannot use the default workflow token to write pull requests");
assert.match(source, /persist-credentials:\s+false/u, "checkout does not persist the broad workflow token in Git credentials");
assert.match(source, /node scripts\/discover-fri-mads-releases\.mjs --dry-run --report-file/u,
  "daily publication consumes the existing official overview parser exactly once");
assert.match(source, /node scripts\/update-fri-mads-article-sidecar\.mjs --report-file/u,
  "the sidecar is generated from the bounded parser report");
assert.match(source, /if git diff --quiet -- data\/fri-mads-articles\.json/u,
  "no-op source polls do not create PRs");
assert.match(source, /CATALOGUE_SYNC_PR_TOKEN/u,
  "unattended PR publication uses the repository's existing trusted token");
assert.match(source, /if:\s+github\.ref == 'refs\/heads\/main'/u,
  "the secret-bearing publisher is restricted to the trusted main ref");
assert.ok(source.indexOf("CATALOGUE_SYNC_PR_TOKEN is missing") < source.indexOf("peter-evans/create-pull-request@v7"),
  "missing token fails before PR creation");
assert.match(source, /uses:\s+peter-evans\/create-pull-request@v7/u,
  "metadata changes go through the trusted pull-request action");
assert.match(source, /add-paths:\s+data\/fri-mads-articles\.json/u,
  "the automation can stage only the sidecar file");
assert.match(source, /event=pull_request&head_sha=\$\{HEAD_SHA\}/u,
  "the real pull_request check is queried by the exact PR head SHA");
assert.match(source, /select\(\.name == "Critical Regression Gate"\) \| select\(\.head_sha == \$sha\)/u,
  "only the real critical gate on that exact SHA can authorize auto-merge");
assert.match(source, /gh pr merge --auto --merge --match-head-commit "\$HEAD_SHA"/u,
  "auto-merge is pinned to the SHA whose real pull_request gate passed");
assert.doesNotMatch(source, /git push\s+origin\s+main/iu,
  "the workflow never writes directly to main");
const gateIndex = gateWorkflow.indexOf("node scripts/critical-regression-gate.mjs");
const previewIndex = gateWorkflow.indexOf("node scripts/test-fri-mads-article-preview.mjs");
assert.ok(gateIndex >= 0 && previewIndex > gateIndex,
  "the browser preview test runs only after the unchanged cold-search gate, so it cannot prewarm that measurement");
assert.match(gateWorkflow, /node scripts\/test-fri-mads-article-sidecar\.mjs/u);
assert.match(gateWorkflow, /node scripts\/test-fri-mads-article-sidecar-workflow\.mjs/u);

console.log("Fri Mads scheduled sidecar publication workflow contract tests passed.");
