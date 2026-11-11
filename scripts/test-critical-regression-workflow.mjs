import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(
  new URL("../.github/workflows/critical-regression-gate.yml", import.meta.url),
  "utf8"
);

assert.match(workflow, /pnpm exec playwright install chromium/u,
  "the pinned Playwright package still installs its matching Chromium browser");
assert.doesNotMatch(workflow, /playwright install --with-deps/u,
  "the gate does not require DNS access to Ubuntu package archives to install browser dependencies");
assert.match(workflow, /node scripts\/critical-regression-gate\.mjs/u,
  "the full mandatory regression gate remains in CI");
assert.match(workflow, /pnpm install --frozen-lockfile/u,
  "CI continues to install the committed dependency lockfile exactly");
assert.match(workflow, /Verify regression tests leave the checkout unchanged/u,
  "the CI mutation guard remains enabled");
assert.match(workflow, /python scripts\/test_manual_cover_intake\.py/u,
  "the required cover-intake regression remains in the workflow");
assert.match(workflow, /python scripts\/intake_manual_podcast_covers\.py/u,
  "the dry-run cover intake contract remains in the workflow");

console.log("Critical regression workflow preserves Chromium and all required checks without apt installation.");
