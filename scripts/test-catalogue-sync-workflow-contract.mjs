import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(
  new URL("../.github/workflows/sync-sheet-data.yml", import.meta.url),
  "utf8"
);

assert.match(workflow, /token: \$\{\{ secrets\.CATALOGUE_SYNC_PR_TOKEN \}\}/u);
assert.doesNotMatch(workflow, /CATALOGUE_SYNC_PR_TOKEN \|\| github\.token/u);
assert.match(workflow, /Refusing to create a catalogue PR without its real pull_request checks/u);
assert.match(workflow, /CATALOGUE_SYNC_PR_TOKEN is invalid, expired/u);
assert.match(workflow, /event=pull_request&head_sha=\$\{HEAD_SHA\}/u);
assert.match(workflow, /select\(\.head_sha == \$sha\)/u);
assert.match(workflow, /if \[ "\$conclusion" != "success" \]/u);
assert.doesNotMatch(workflow, /gh workflow run critical-regression-gate/u);
assert.match(workflow, /gh pr merge --auto --merge --match-head-commit "\$HEAD_SHA"/u);
assert.match(workflow, /if: steps\.required-gate\.outcome == 'success'/u);
assert.match(workflow, /data\/podcasts\.json data\/featured-reviews\.json data\/explore-clusters\.json/u);
assert.match(workflow, /data\/covers\//u);
assert.match(workflow, /steps\.catalogue\.outputs\.podcasts_changed == 'true'/u);
assert.match(workflow, /Catalogue sync blocked: unattended publication/u);
assert.match(workflow, /existing\) await github\.rest\.issues\.update/u);
assert.match(workflow, /assignees: \[context\.repo\.owner\]/u);
assert.match(workflow, /core\.setFailed\("Catalogue publication blocked/u);

console.log("Catalogue sync workflow security and publication contract passed.");
