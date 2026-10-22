import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS,
  checkProductionCatalogue,
  validateProductionCataloguePayload,
  validateProductionDisplayGroups
} from "./production-catalogue-health.mjs";
import {
  PRODUCTION_CATALOGUE_ALERT_TITLE,
  productionHealthExcerpt,
  updateProductionCatalogueAlert
} from "./production-catalogue-alert.mjs";

const rows = Array.from({ length: MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS }, (_, index) => ({
  Titel: `Podcast ${index}`,
  "Podcast-ID": `podcast-${index}`
}));

assert.equal(validateProductionCataloguePayload({ rows }).ok, true);
assert.equal(
  validateProductionCataloguePayload({ rows: rows.slice(1) }).ok,
  false,
  "999 rows must fail the absolute floor"
);
assert.equal(
  validateProductionCataloguePayload({ rows: [...rows.slice(0, -1), { Titel: "Missing" }] }).ok,
  false,
  "blank Podcast-ID must fail"
);
assert.equal(
  validateProductionCataloguePayload({
    rows: [...rows.slice(0, -1), { Titel: "Duplicate", "Podcast-ID": "podcast-0" }]
  }).ok,
  false,
  "duplicate Podcast-ID must fail"
);
assert.equal(validateProductionDisplayGroups({ version: 1, groups: [] }).ok, true);
assert.equal(validateProductionDisplayGroups({ version: 2, groups: [] }).ok, false);

const expectedAppSource = "const marker = true;\ninitialPodcastStartup = loadPodcasts();\n";
const fetchImpl = async (url) => {
  if (url.includes("/data/podcasts.json")) {
    return new Response(JSON.stringify({ generatedAt: "expected", rows }), { status: 200 });
  }
  if (url.includes("/data/podcast-display-groups.json")) {
    return new Response(JSON.stringify({ version: 1, groups: [] }), { status: 200 });
  }
  return new Response("old app\ninitialPodcastStartup = loadPodcasts();\n", { status: 200 });
};
await assert.rejects(
  checkProductionCatalogue({
    expectedRows: rows.length,
    expectedGeneratedAt: "expected",
    expectedAppSource,
    fetchImpl,
    attempts: 1,
    retryDelays: [0]
  }),
  /production app\.js does not match current main/u
);

const expectedDataAssets = {
  "data/featured-reviews.json": [{ title: "featured" }],
  "data/explore-clusters.json": { version: 1, clusters: [] },
  "data/recommendation-metadata.json": { version: 1, rows: [] }
};
const healthyFetch = async (url) => {
  if (url.includes("/data/podcasts.json")) return new Response(JSON.stringify({ generatedAt: "expected", rows }), { status: 200 });
  if (url.includes("/data/podcast-display-groups.json")) return new Response(JSON.stringify({ version: 1, groups: [] }), { status: 200 });
  if (url.includes("/app.js")) return new Response(expectedAppSource, { status: 200 });
  const key = Object.keys(expectedDataAssets).find((file) => url.includes(`/${file}?`));
  return new Response(JSON.stringify(expectedDataAssets[key]), { status: 200 });
};
const healthyResult = await checkProductionCatalogue({
  expectedRows: rows.length,
  expectedGeneratedAt: "expected",
  expectedCatalogue: { generatedAt: "expected", rows },
  expectedDataAssets,
  expectedAppSource,
  fetchImpl: healthyFetch,
  attempts: 1,
  retryDelays: [0]
});
assert.equal(healthyResult.ok, true);
const pendingDeployment = await checkProductionCatalogue({
  expectedRows: rows.length,
  expectedGeneratedAt: "expected",
  expectedCatalogue: { generatedAt: "expected", rows },
  expectedDataAssets: { ...expectedDataAssets, "data/explore-clusters.json": { version: 2 } },
  expectedAppSource,
  mainCommitAt: "2026-10-22T12:00:00.000Z",
  nowMs: Date.parse("2026-10-22T13:00:00.000Z"),
  fetchImpl: healthyFetch,
  attempts: 1,
  retryDelays: [0]
});
assert.equal(pendingDeployment.pendingDeployment, true, "Pages mismatch is grace-period pending before two hours");
await assert.rejects(
  checkProductionCatalogue({
    expectedRows: rows.length,
    expectedGeneratedAt: "expected",
    expectedCatalogue: { generatedAt: "expected", rows },
    expectedDataAssets: { ...expectedDataAssets, "data/explore-clusters.json": { version: 2 } },
    expectedAppSource,
    fetchImpl: healthyFetch,
    attempts: 1,
    retryDelays: [0]
  }),
  /production data\/explore-clusters\.json does not match main/u
);
await assert.rejects(
  checkProductionCatalogue({
    expectedRows: rows.length,
    expectedGeneratedAt: "expected",
    expectedCatalogue: { generatedAt: "expected", rows },
    expectedDataAssets: { ...expectedDataAssets, "data/explore-clusters.json": { version: 2 } },
    expectedAppSource,
    mainCommitAt: "2026-10-22T12:00:00.000Z",
    nowMs: Date.parse("2026-10-22T14:01:00.000Z"),
    fetchImpl: healthyFetch,
    attempts: 1,
    retryDelays: [0]
  }),
  /production data\/explore-clusters\.json does not match main/u
);

const workflow = await readFile(
  new URL("../.github/workflows/production-catalogue-health.yml", import.meta.url),
  "utf8"
);
assert.match(workflow, /cron: "\*\/15 \* \* \* \*"/u);
assert.match(workflow, /push:[\s\S]*branches:[\s\S]*- main/u);
assert.match(workflow, /issues: write/u);
assert.match(
  workflow,
  /node scripts\/production-catalogue-health\.mjs 2>&1 \| tee -a \.production-catalogue-health\.log/u
);
assert.match(workflow, /Alert on production catalogue failure/u);
assert.match(workflow, /Resolve production catalogue alert/u);

assert.equal(PRODUCTION_CATALOGUE_ALERT_TITLE, "Catalogue sync blocked: unattended publication");
const excerpt = productionHealthExcerpt(
  "noise\nError: CRITICAL PRODUCTION CATALOGUE HEALTH FAILURE\n- catalogue row count 0 is below safety minimum 1000\nsecret=x"
);
assert.match(excerpt, /CRITICAL PRODUCTION CATALOGUE HEALTH FAILURE/u);
assert.match(excerpt, /catalogue row count 0/u);
assert.doesNotMatch(excerpt, /secret=x/u);

const alertCalls = [];
const existingSyncAlert = {
  number: 289,
  title: "Catalogue sync blocked: unattended publication",
  body: "The Sheet sync is blocked because CATALOGUE_SYNC_PR_TOKEN is missing."
};
const alertGithub = {
  paginate: async () => [existingSyncAlert],
  rest: {
    issues: {
      async listForRepo() {},
      async update(args) { alertCalls.push(["update", args]); },
      async createComment(args) { alertCalls.push(["comment", args]); },
      async create(args) { alertCalls.push(["create", args]); }
    }
  }
};
await updateProductionCatalogueAlert({
  github: alertGithub,
  context: { repo: { owner: "owner", repo: "repo" }, serverUrl: "https://github.com", runId: 42, sha: "abc123" },
  core: { error() {} },
  outcome: "failure",
  readLog: async () => "Error: CRITICAL CATALOGUE PIPELINE FAILURE\n- Google Sheet changes are not present in main: data/podcasts.json",
  now: () => "2026-10-22T10:00:00.000Z"
});
assert.deepEqual(alertCalls.map(([name]) => name), ["update"], "health monitoring updates the one shared sync issue instead of creating a second issue or adding repeated comments");
assert.equal(alertCalls[0][1].issue_number, 289);
assert.equal(alertCalls[0][1].title, undefined, "the existing shared issue keeps its deduplicated title");
assert.equal(alertCalls[0][1].body.includes("Google Sheet changes"), true);
assert.equal(alertCalls[0][1].body.includes("CATALOGUE_SYNC_PR_TOKEN is missing"), true, "health updates preserve the token setup instructions");

console.log("Production catalogue health safety checks passed.");
