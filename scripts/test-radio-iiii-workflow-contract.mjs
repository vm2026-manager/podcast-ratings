import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [discovery, workflow, script] = await Promise.all([
  readFile(".github/workflows/discover-bakspejl-children.yml", "utf8"),
  readFile(".github/workflows/sync-sheet-data.yml", "utf8"),
  readFile("scripts/append-radio-iiii-to-staging.mjs", "utf8")
]);
assert.match(discovery, /schedule:\s*\n\s*- cron: ['"]?47 \*\/6 \* \* \*['"]?/u, "RADIO IIII reuses the existing six-hour discovery schedule");
assert.doesNotMatch(discovery, /radio-iiii:[\s\S]*?cron:/u, "no separate RADIO IIII cron job is introduced");
assert.match(discovery, /discover-radio-iiii:[\s\S]*?data\/auto-discovered-radio-iiii\.json/u);
assert.match(discovery, /branch: automation\/radio-iiii-discovery/u);
assert.match(discovery, /test-radio-iiii-auto-discovery\.mjs/u);
assert.match(discovery, /test-radio-iiii-staging-and-routing\.mjs/u);
assert.match(discovery, /node scripts\/critical-regression-gate\.mjs/u);
assert.match(workflow, /stage-verified-dr-series:/u);
assert.match(workflow, /Authenticate with short-lived Google credentials/u);
assert.match(workflow, /Append verified RADIO IIII guest candidates to their separate review tab/u);
assert.match(workflow, /node scripts\/append-radio-iiii-to-staging\.mjs --write/u);
assert.doesNotMatch(workflow, /GOOGLE_SHEET_ID|ORIGINAL_SHEET_ID|Ark1.*append-radio-iiii/u);
assert.match(script, /assertStagingWriteGate\(\)/u);
assert.match(script, /RADIO_IIII_STAGING_TAB/u);
assert.match(script, /GOOGLE_DR_STAGING_SHEET_ID/u);
assert.doesNotMatch(script, /ORIGINAL_SHEET_ID|1V21y9uMx_fGethr/u);
console.log("RADIO IIII discovery and WIF staging workflow contract passed.");
