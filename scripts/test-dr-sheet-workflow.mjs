import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/sync-sheet-data.yml", import.meta.url), "utf8");
const writer = await readFile(new URL("../scripts/google-sheets-append.mjs", import.meta.url), "utf8");
assert.match(workflow, /name: Sync Podcastlisten catalogue/u);
assert.match(workflow, /append-verified-dr-series:[\s\S]*?needs: sync-sheet-data/u);
assert.match(workflow, /if: github\.ref == 'refs\/heads\/main' && needs\.sync-sheet-data\.result == 'success'/u);
assert.match(workflow, /group: append-verified-dr-series-ark1[\s\S]*?cancel-in-progress: false/u);
assert.match(workflow, /id-token: write/u);
assert.match(workflow, /google-github-actions\/auth@v2/u);
assert.match(workflow, /access_token_scopes: https:\/\/www\.googleapis\.com\/auth\/spreadsheets/u);
assert.match(workflow, /GOOGLE_SHEETS_WRITE_ENABLED/u);
assert.match(workflow, /GOOGLE_SHEETS_BACKUP_VERIFIED/u);
assert.match(writer, /valueInputOption=RAW/u);
assert.doesNotMatch(workflow, /pull_request_target/u);

console.log("DR Sheets workflow trust, serialization, and opt-in checks passed");
