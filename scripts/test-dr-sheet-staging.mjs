import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  appendDrCandidatesToStaging, assertStagingWriteGate, buildStagingPlan,
  buildStagingRow, CATALOGUE_HEADERS, ORIGINAL_SHEET_ID, STAGING_HEADERS, StagingSheetsApiClient
} from "./google-sheets-staging.mjs";
import { VERIFIED_DR_SERIES_METADATA } from "./verified-dr-series-metadata.mjs";
import { mergeAutoDiscoveredBakspejlRows } from "./bakspejl-auto-discovery.mjs";
import { mergeAutoDiscoveredDjaevlenRows } from "./djaevlen-auto-discovery.mjs";
import { buildRecommendationData } from "./build-recommendation-metadata.mjs";
import { preserveCatalogueIdsByPodcastId } from "./sync-sheet-data.mjs";
import { TYRAN_PROTECTED_IDS } from "./tyran-auto-discovery.mjs";

function recordFor(id) {
  const metadata = VERIFIED_DR_SERIES_METADATA[id];
  return {
    title: metadata.title, podcast_id: id, hovedserie: metadata.mainSeries,
    source_episode_guid: metadata.sourceEpisodeGuid, source_url: metadata.sourceUrl,
    source_description: metadata.sourceDescription || metadata.longDescription, cover: "https://api.dr.dk/covers/test.jpg"
  };
}
const candidates = Object.keys(VERIFIED_DR_SERIES_METADATA).map(recordFor);
const tyranRegistry = JSON.parse(await readFile(new URL("../data/auto-discovered-tyran.json", import.meta.url), "utf8"));

class MockStaging {
  constructor(rows = []) { this.rows = structuredClone(rows); this.appendCalls = 0; this.updateCalls = 0; this.failAfterAppend = false; this.failBeforeAppend = false; this.mutateOldRow = false; this.mutateAppend = false; }
  async readSheet() { return { headers: [...STAGING_HEADERS], rows: structuredClone(this.rows) }; }
  async appendRows(values) {
    this.appendCalls += 1;
    if (this.failBeforeAppend) { this.failBeforeAppend = false; throw new Error("simulated failure before staging append"); }
    this.rows.push(...structuredClone(values));
    if (this.mutateOldRow && this.rows.length > 1) this.rows[0][CATALOGUE_HEADERS.indexOf("Titel")] = "tampered";
    if (this.mutateAppend) this.rows[this.rows.length - 1][CATALOGUE_HEADERS.indexOf("Titel")] = "tampered append";
    if (this.failAfterAppend) { this.failAfterAppend = false; throw new Error("simulated timeout after commit"); }
  }
  async updateHostCells(updates) {
    this.updateCalls += 1;
    for (const update of updates) {
      const row = this.rows[update.rowNumber - 2];
      assert.equal(row[STAGING_HEADERS.indexOf("Vært")], "", "host-only staging updates are planned only for blank cells");
      row[STAGING_HEADERS.indexOf("Vært")] = update.host;
    }
  }
}

// Staging is append-only and idempotent; existing editor changes win.
const staging = new MockStaging();
assert.deepEqual(await appendDrCandidatesToStaging({ client: staging, candidates, dryRun: true }), { dryRun: true, appended: 0, alreadyPresent: 0 });
assert.equal(staging.appendCalls, 0);
assert.deepEqual(await appendDrCandidatesToStaging({ client: staging, candidates, dryRun: false }), { dryRun: false, appended: candidates.length, alreadyPresent: 0 });
assert.equal(staging.appendCalls, 1);
const manuallyEditedStaging = structuredClone(staging.rows[0]);
manuallyEditedStaging[STAGING_HEADERS.indexOf("Kort beskrivelse")] = "Redaktørens rettelse";
manuallyEditedStaging[STAGING_HEADERS.indexOf("Vært")] = "Redaktørens værtsrettelse";
staging.rows[0] = manuallyEditedStaging;
assert.deepEqual(await appendDrCandidatesToStaging({ client: staging, candidates, dryRun: false }), { dryRun: false, appended: 0, alreadyPresent: candidates.length });
assert.equal(staging.rows[0][STAGING_HEADERS.indexOf("Kort beskrivelse")], "Redaktørens rettelse");
assert.equal(staging.rows[0][STAGING_HEADERS.indexOf("Vært")], "Redaktørens værtsrettelse", "an existing editorial host edit is preserved");
assert.equal(staging.appendCalls, 1);
assert.equal(staging.updateCalls, 0, "a populated editorial host cell is never overwritten");
const blankHostExisting = structuredClone(staging.rows[0]);
blankHostExisting[STAGING_HEADERS.indexOf("Vært")] = "";
const hostFillClient = new MockStaging([blankHostExisting]);
const hostFillBefore = structuredClone(hostFillClient.rows[0]);
assert.deepEqual(await appendDrCandidatesToStaging({ client: hostFillClient, candidates: candidates.slice(0, 1), dryRun: false }), {
  dryRun: false, appended: 0, alreadyPresent: 1, hostFilled: 1
});
assert.equal(hostFillClient.rows.length, 1, "filling a blank host cell does not add a duplicate row");
assert.equal(hostFillClient.rows[0][STAGING_HEADERS.indexOf("Vært")], "Per Lysholt");
for (let index = 0; index < STAGING_HEADERS.length; index += 1) {
  if (index !== STAGING_HEADERS.indexOf("Vært")) assert.equal(hostFillClient.rows[0][index], hostFillBefore[index], `host-only update preserves staging cell ${index + 1}`);
}
const blankHostPreserved = new MockStaging([blankHostExisting]);
assert.deepEqual(await appendDrCandidatesToStaging({ client: blankHostPreserved, candidates: candidates.slice(0, 1), dryRun: false, allowHostUpdates: false }), {
  dryRun: false, appended: 0, alreadyPresent: 1
});
assert.equal(blankHostPreserved.updateCalls, 0, "the integrated owner-staging pipeline leaves every existing row unchanged");
assert.equal(blankHostPreserved.rows[0][STAGING_HEADERS.indexOf("Vært")], "", "integrated staging never edits an existing blank cell");
const draeberurten = candidates.find((candidate) => candidate.podcast_id === "dræberurten");
const draeberurtenRow = buildStagingRow(draeberurten);
assert.equal(draeberurtenRow[CATALOGUE_HEADERS.indexOf("Podcast-ID")], "dræberurten", "the existing legacy identity is preserved");
assert.equal(draeberurtenRow[STAGING_HEADERS.indexOf("DR source GUID")], "16122692641");
assert.match(draeberurtenRow[STAGING_HEADERS.indexOf("DR source URL")], /dr.dk\/lyd\/special-radio\/djaevlen-i-detaljen\/.*16122692641/u);
assert.equal(draeberurtenRow[STAGING_HEADERS.indexOf("Review status")], "SOURCE_VERIFIED_REQUIRES_OWNER_APPROVAL");
assert.equal(draeberurtenRow[STAGING_HEADERS.indexOf("Vært")], "Per Lysholt");
for (const header of ["Vuring (1-10)", "Antal afsnit", "Årstal afspillet", "Afgivet vurdering", "Episoder", "Feed", "Undervurderet perle"]) {
  assert.equal(draeberurtenRow[CATALOGUE_HEADERS.indexOf(header)], "", `Dræberurten ${header} remains blank without source evidence`);
}
assert.throws(() => buildStagingRow({ ...draeberurten, title: "A different series" }), /identity\/source mismatch/u);
assert.throws(() => buildStagingRow({ ...draeberurten, source_description: "Conflicting source text" }), /identity\/source mismatch/u);
const identityConflict = structuredClone(staging.rows[0]);
identityConflict[STAGING_HEADERS.indexOf("Titel")] = "A different identity";
await assert.rejects(() => appendDrCandidatesToStaging({
  client: new MockStaging([identityConflict, staging.rows[1]]), candidates: candidates.slice(0, 1), dryRun: false
}), /identity\/source conflict/);

const ambiguous = new MockStaging();
ambiguous.failAfterAppend = true;
assert.equal((await appendDrCandidatesToStaging({ client: ambiguous, candidates: candidates.slice(0, 1), dryRun: false })).recoveredAfterAmbiguousFailure, true);
assert.equal(ambiguous.rows.length, 1);
const beforeFailure = new MockStaging();
beforeFailure.failBeforeAppend = true;
await assert.rejects(() => appendDrCandidatesToStaging({ client: beforeFailure, candidates: candidates.slice(0, 1), dryRun: false }), /read-back mismatch/);
assert.equal(beforeFailure.rows.length, 0, "pre-append failure causes no staging write and is safe to rerun");
assert.equal((await appendDrCandidatesToStaging({ client: beforeFailure, candidates: candidates.slice(0, 1), dryRun: false })).appended, 1);
const corrupting = new MockStaging([staging.rows[0]]);
corrupting.mutateOldRow = true;
await assert.rejects(() => appendDrCandidatesToStaging({ client: corrupting, candidates: candidates.slice(1), dryRun: false }), /Existing DR staging rows changed/);
const badReadback = new MockStaging();
badReadback.mutateAppend = true;
await assert.rejects(() => appendDrCandidatesToStaging({ client: badReadback, candidates: candidates.slice(0, 1), dryRun: false }), /read-back mismatch/);

// Source-derived future suggestions are factual excerpts but stay review-only.
const future = {
  title: "Et nyt DR-forløb", podcast_id: "bakspejl-auto-v1-1234abcd", hovedserie: "Bakspejl",
  source_episode_guid: "999999999999", source_url: "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/et-nyt-forloeb-999999999999",
  source_description: "En verificeret kildebeskrivelse med faktuelle oplysninger om emnet. Den næste sætning står også i DR-kilden.", cover: ""
};
const genericPlan = buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [], candidates: [future] });
assert.equal(genericPlan.append.length, 1);
assert.equal(genericPlan.append[0][STAGING_HEADERS.indexOf("Review status")], "NEEDS_EDITORIAL_REVIEW");
assert.equal(genericPlan.append[0][CATALOGUE_HEADERS.indexOf("Kort beskrivelse")], future.source_description);
for (const forbidden of ["Vært", "Vuring (1-10)", "Antal afsnit", "Årstal afspillet", "Afgivet vurdering", "Episoder", "Feed", "Undervurderet perle"]) {
  assert.equal(genericPlan.append[0][CATALOGUE_HEADERS.indexOf(forbidden)], "");
}
const celineChild = buildStagingRow({ ...future, source_description: "Medvirkende: Charlie Krautwald. Tilrettelæggelse, vært og lyddesign: Celine Klint Redaktion: Anne Jeppesen." });
const martinChild = buildStagingRow({ ...future, podcast_id: "bakspejl-auto-v1-1234abce", title: "En anden Bakspejl-serie", source_episode_guid: "999999999998", source_url: "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/en-anden-serie-999999999998", source_description: "Vært: Martin Grønne. Producer: Niels Hansen." });
assert.equal(celineChild[STAGING_HEADERS.indexOf("Vært")], "Celine Klint", "combined role credits identify the explicitly credited Bakspejl host");
assert.equal(martinChild[STAGING_HEADERS.indexOf("Vært")], "Martin Grønne", "a separate Bakspejl series uses its own exact episode credit");
const guestOnly = buildStagingRow({ ...future, source_description: "Medvirkende: Celine Klint. Producer: Martin Grønne." });
assert.equal(guestOnly[STAGING_HEADERS.indexOf("Vært")], "");
assert.equal(guestOnly[STAGING_HEADERS.indexOf("Review status")], "NEEDS_EDITORIAL_REVIEW");
const uncertainHost = buildStagingRow({ ...future, source_description: "Vært: Celine Klint. Vært: Martin Grønne." });
assert.equal(uncertainHost[STAGING_HEADERS.indexOf("Vært")], "", "conflicting host credits fail closed");
assert.equal(uncertainHost[STAGING_HEADERS.indexOf("Review status")], "NEEDS_EDITORIAL_REVIEW");
const isdalenRow = buildStagingRow(recordFor("djaevlen-auto-v1-1139735b"));
const bakspejlRow = buildStagingRow(recordFor("bakspejl-auto-v1-4962cdc5"));
assert.equal(isdalenRow[STAGING_HEADERS.indexOf("Vært")], "Per Lysholt");
assert.equal(isdalenRow[STAGING_HEADERS.indexOf("DR source GUID")], "16122692642");
assert.equal(isdalenRow[STAGING_HEADERS.indexOf("DR source URL")], VERIFIED_DR_SERIES_METADATA["djaevlen-auto-v1-1139735b"].sourceUrl);
assert.equal(bakspejlRow[STAGING_HEADERS.indexOf("Vært")], "Celine Klint");
assert.equal(bakspejlRow[STAGING_HEADERS.indexOf("DR source GUID")], "11162611015");
assert.equal(bakspejlRow[STAGING_HEADERS.indexOf("DR source URL")], VERIFIED_DR_SERIES_METADATA["bakspejl-auto-v1-4962cdc5"].sourceUrl);
assert.throws(() => buildStagingPlan({ headers: [...STAGING_HEADERS].reverse(), existingRows: [], candidates: [] }), /header schema drift/);
const duplicate = candidates.concat(candidates[0]);
assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [], candidates: duplicate }), /Duplicate DR staging candidate/);
const duplicateRow = [...staging.rows[0]];
assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [duplicateRow, duplicateRow], candidates: [] }), /duplicate Podcast-ID/);
assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [["orphan"]], candidates: [] }), /without Podcast-ID/);
assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [], candidates: [{ ...future, source_url: "https://evil.invalid/a/999999999999" }] }), /official full-episode source/);
assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [], candidates: [{ ...future, source_episode_guid: "1" }] }), /official full-episode source/);

// Tyran uses the current DR staging schema. Marcos is a historical Ark1
// identity; Macias is the only new owner-review proposal.
const tyranPlan = buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [], candidates: tyranRegistry.records });
assert.equal(tyranPlan.append.length, 1);
assert.equal(tyranPlan.alreadyPresent, 1);
const tyranRow = tyranPlan.append[0];
const tyranValue = (header) => tyranRow[STAGING_HEADERS.indexOf(header)];
assert.equal(tyranValue("Podcast-ID"), "tyran-auto-v1-08d0021f");
assert.equal(tyranValue("Titel"), "Macias");
assert.equal(tyranValue("Hovedserie"), "Tyran");
assert.equal(tyranValue("DR source GUID"), "16122693681");
assert.equal(tyranValue("DR source URL"), tyranRegistry.records.find((record) => record.discovery_key === "macias").first_full_episode.source_url);
assert.equal(tyranValue("Link"), tyranValue("DR source URL"));
assert.equal(tyranValue("Kilde"), tyranValue("DR source URL"));
assert.equal(tyranValue("Billedlink"), tyranRegistry.records.find((record) => record.discovery_key === "macias").cover_source_url);
assert.equal(tyranValue("Review status"), "NEEDS_EDITORIAL_REVIEW");
assert.equal(tyranValue("Vært"), "");
for (const header of ["Genre", "2. genre", "Emner", "Feed", "Episoder", "Vuring (1-10)", "Antal afsnit", "Årstal afspillet", "Afgivet vurdering", "Undervurderet perle"]) {
  assert.equal(tyranValue(header), "", `Tyran ${header} remains blank without independent evidence`);
}
assert.match(tyranValue("DR source description"), /TYRAN_DR_PROVENANCE_V1/u);
assert.match(tyranValue("DR source description"), /"seriesId":"urn:dr:radio:series:6a3e55fa1645505efca628b6"/u);
assert.match(tyranValue("DR source description"), /"seriesProductionNumber":"6641072699897"/u);
assert.match(tyranValue("DR source description"), /"episodeGuid":"16122693681"/u);
assert.match(tyranValue("DR source description"), /"coverSha256":"5f8fa9bba69c3a5718623ea846d2608affd0074c8437411159c3240b429e4425"/u);
assert.equal(buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [tyranRow], candidates: tyranRegistry.records }).append.length, 0, "a rerun adds no duplicate Tyran row");
const tyranMockStaging = new MockStaging();
assert.deepEqual(await appendDrCandidatesToStaging({ client: tyranMockStaging, candidates: tyranRegistry.records, dryRun: false }), {
  dryRun: false, appended: 1, alreadyPresent: 1
});
assert.equal(tyranMockStaging.rows.length, 1, "only Macias is appended; Marcos is already in Ark1");
const editorialTyran = [...tyranRow];
editorialTyran[STAGING_HEADERS.indexOf("Lang beskrivelse")] = "Redaktørens rettelse";
assert.equal(buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [editorialTyran], candidates: tyranRegistry.records }).append.length, 0, "a rerun preserves an edited Tyran description");
tyranMockStaging.rows[0][STAGING_HEADERS.indexOf("Lang beskrivelse")] = "Redaktørens rettelse";
assert.deepEqual(await appendDrCandidatesToStaging({ client: tyranMockStaging, candidates: tyranRegistry.records, dryRun: false }), {
  dryRun: false, appended: 0, alreadyPresent: 2
});
assert.equal(tyranMockStaging.rows[0][STAGING_HEADERS.indexOf("Lang beskrivelse")], "Redaktørens rettelse", "staging reruns do not overwrite editorial changes");
const tyranConflict = [...tyranRow];
tyranConflict[STAGING_HEADERS.indexOf("Titel")] = "Another series";
assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [tyranConflict], candidates: tyranRegistry.records }), /identity\/source conflict/u);
for (const [label, mutate, pattern] of [
  ["teaser", (record) => { record.first_full_episode.title = "Teaser - Macias"; }, /episode, cover/u],
  ["wrong GUID", (record) => { record.first_full_episode.production_number = "12345678901"; }, /episode, cover/u],
  ["wrong episode URL", (record) => { record.first_full_episode.source_url = "https://www.dr.dk/lyd/p3/tyran-macias/teaser-12345678901"; }, /episode, cover/u],
  ["wrong series ID", (record) => { record.dr_series_id = "urn:dr:radio:series:wrong"; }, /source, identity/u],
  ["wrong productionNumber", (record) => { record.source_series_production_number = "1234567890123"; }, /source, identity/u],
  ["wrong cover", (record) => { record.cover_source_url = tyranRegistry.records[0].cover_source_url; }, /cover/u],
  ["reused image", (record) => { record.first_full_episode.square_image_ids = ["different", "different"]; }, /cover/u],
  ["wrong checksum", (record) => { record.cover_sha256 = "0".repeat(64); }, /cover/u],
  ["feed activation", (record) => { record.feed_activation_approved = true; }, /source, identity/u],
  ["review bypass", (record) => { record.needs_editorial_review = false; }, /source, identity/u],
  ["missing description", (record) => { record.description = ""; }, /description/u],
  ["wrong description source", (record) => { record.description_source_url = "https://evil.invalid/"; }, /description/u]
]) {
  const changed = structuredClone(tyranRegistry.records.find((record) => record.discovery_key === "macias"));
  mutate(changed);
  assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [], candidates: [changed] }), pattern, `Tyran rejects ${label}`);
}
const macias = tyranRegistry.records.find((record) => record.discovery_key === "macias");
const reusedTyranSource = [...tyranRow];
reusedTyranSource[STAGING_HEADERS.indexOf("Podcast-ID")] = "other-id";
reusedTyranSource[STAGING_HEADERS.indexOf("Titel")] = "Different title";
assert.throws(() => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [reusedTyranSource], candidates: [macias] }), /source collision/u);
assert.throws(() => new StagingSheetsApiClient({ accessToken: "test", spreadsheetId: ORIGINAL_SHEET_ID }), /original-sheet writes are forbidden/);
assert.throws(() => new StagingSheetsApiClient({}), /credentials are missing/);
assert.throws(() => assertStagingWriteGate({}), /gate is closed/);
assert.doesNotThrow(() => assertStagingWriteGate({ GITHUB_ACTIONS: "true", GITHUB_REF: "refs/heads/main", GOOGLE_DR_STAGING_WRITE_ENABLED: "true", GOOGLE_DR_STAGING_SHEET_ID: "staging-sheet-test", GOOGLE_ACCESS_TOKEN: "test-token" }));

let requests = [];
const apiClient = new StagingSheetsApiClient({
  accessToken: "short-lived-test-token", spreadsheetId: "staging-sheet-test",
  fetchImpl: async (url, options) => {
    requests.push({ url: String(url), method: options.method || "GET", body: options.body });
    if (options.method === "POST") return new Response("{}", { status: 200 });
    return requests.length === 1 ? new Response("rate limited", { status: 429 }) :
      new Response(JSON.stringify({ values: [STAGING_HEADERS] }), { status: 200 });
  }
});
assert.equal((await apiClient.readSheet()).headers.length, STAGING_HEADERS.length);
assert.equal(requests.length, 2, "staging read retries a bounded rate-limit response");
await apiClient.appendRows([["=IMPORTXML(\"https://example.invalid\",\"//x\")"]]);
assert.match(requests[2].url, /staging-sheet-test/u);
assert.doesNotMatch(requests[2].url, new RegExp(ORIGINAL_SHEET_ID, "u"));
assert.match(requests[2].url, /valueInputOption=RAW/u);
assert.equal(requests[2].method, "POST", "ambiguous appends are never blindly retried");
await apiClient.updateHostCells([{ rowNumber: 4, podcastId: "bakspejl-auto-v1-1234abcd", host: "Celine Klint" }]);
assert.match(requests[3].url, /values:batchUpdate/u);
assert.match(requests[3].body, /DR staging.*C4/u);
assert.match(requests[3].body, /"valueInputOption":"RAW"/u);
assert.doesNotMatch(requests[3].url, new RegExp(ORIGINAL_SHEET_ID, "u"));

// Run the owner Apps Script against isolated mocks; no Google auth/network.
const script = await readFile(new URL("../apps-script/append-dr-staging-to-ark1/Code.gs", import.meta.url), "utf8");
function makeAppsScriptHarness({
  originalId = ORIGINAL_SHEET_ID, targetGid = 0, badHeader = false, targetRows = [], stagingRows,
  properties = {}, promptText, promptButton = "OK", lockAvailable = true, lockState = { locked: false },
  appendFault = null, onAppend = null, stagingFormulas = null
} = {}) {
  const headers = [...CATALOGUE_HEADERS];
  if (badHeader) headers[19] = "Wrong header";
  const originalData = [headers, ...structuredClone(targetRows)];
  let targetLockAcquires = 0;
  const target = {
    getName: () => "Ark1", getSheetId: () => targetGid, getLastRow: () => originalData.length, getLastColumn: () => CATALOGUE_HEADERS.length,
    getRange(row, col, height, width) {
      return {
        getDisplayValues: () => originalData.slice(row - 1, row - 1 + height).map((r) => r.slice(col - 1, col - 1 + width).map(String)),
        getValues: () => structuredClone(originalData.slice(row - 1, row - 1 + height).map((r) => r.slice(col - 1, col - 1 + width))),
        getFormulas: () => originalData.slice(row - 1, row - 1 + height).map((r) => r.map(() => "")),
        setValues(values) {
          if (appendFault === "before-append") throw new Error("simulated failure before append");
          if (appendFault === "mutate-old") originalData[1][CATALOGUE_HEADERS.indexOf("Titel")] = "tampered";
          originalData.push(...structuredClone(values));
          if (onAppend) onAppend();
          if (appendFault === "after-commit") throw new Error("simulated timeout after append");
        }
      };
    }
  };
  const stagingTab = {
    getDataRange() {
      return {
        getValues: () => structuredClone(stagingRows),
        getFormulas: () => structuredClone(stagingFormulas || stagingRows.map((row) => row.map(() => "")))
      };
    }
  };
  const backupData = structuredClone(originalData);
  const backupTab = {
    getName: () => "Ark1", getSheetId: () => 0,
    getLastRow: () => backupData.length, getLastColumn: () => CATALOGUE_HEADERS.length,
    getRange(row, col, height, width) {
      return {
        getValues: () => structuredClone(backupData.slice(row - 1, row - 1 + height).map((r) => r.slice(col - 1, col - 1 + width))),
        getFormulas: () => backupData.slice(row - 1, row - 1 + height).map((r) => r.map(() => ""))
      };
    }
  };
  const props = new Map(Object.entries({
    OWNER_EMAIL: "owner@example.invalid", APPEND_ENABLED: "true", BACKUP_RESTORE_TEST_VERIFIED: "true", BACKUP_VERIFIED_AT: new Date().toISOString(),
    BACKUP_SPREADSHEET_ID: "backup-test", STAGING_SPREADSHEET_ID: "staging-test", ...properties
  }));
  const ui = {
    alerts: [], alert(message) { this.alerts.push(message); },
    prompt() { return { getSelectedButton: () => promptButton, getResponseText: () => promptText || "" }; },
    createMenu() { return { addItem() { return this; }, addToUi() {} }; }, ButtonSet: { OK_CANCEL: "buttons" }, Button: { OK: "OK" }
  };
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getId: () => originalId, getSheets: () => [target], getSheetByName: (name) => name === "Ark1" ? target : null }),
      openById: (id) => id === "staging-test" ? { getSheetByName: (name) => name === "DR staging" ? stagingTab : null } : {
        getId: () => id, getName: () => "Backup", getSheets: () => [backupTab], getSheetByName: (name) => name === "Ark1" ? backupTab : null
      },
      getUi: () => ui
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => props.get(key) || "" }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.invalid" }) },
    LockService: { getDocumentLock: () => ({
      tryLock: () => { targetLockAcquires += 1; if (!lockAvailable || lockState.locked) return false; lockState.locked = true; return true; },
      releaseLock: () => { lockState.locked = false; }
    }) },
    Logger: { logs: [], log(message) { this.logs.push(message); } },
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" }, Charset: { UTF_8: "UTF_8" },
      computeDigest(algorithm, value) { assert.equal(algorithm, "SHA_256"); return [...createHash("sha256").update(String(value), "utf8").digest()].map((byte) => byte > 127 ? byte - 256 : byte); }
    },
    Map, Set, JSON, String, Date, Error, Math, RegExp
  };
  vm.createContext(context);
  vm.runInContext(script, context, { filename: "Code.gs" });
  return { context, originalData, ui, props, get targetLockAcquires() { return targetLockAcquires; } };
}

const stageRows = [STAGING_HEADERS, ...candidates.map((candidate) => buildStagingPlan({ headers: STAGING_HEADERS, existingRows: [], candidates: [candidate] }).append[0])];
const tyranStageRows = [STAGING_HEADERS, tyranRow];
const marcosArk1Row = Array(CATALOGUE_HEADERS.length).fill("");
marcosArk1Row[CATALOGUE_HEADERS.indexOf("Titel")] = "Marcos";
marcosArk1Row[CATALOGUE_HEADERS.indexOf("Hovedserie")] = "Tyran";
marcosArk1Row[CATALOGUE_HEADERS.indexOf("Udgiver")] = "DR";
marcosArk1Row[CATALOGUE_HEADERS.indexOf("Podcast-ID")] = "marcos";
marcosArk1Row[CATALOGUE_HEADERS.indexOf("Link")] = "https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949";
marcosArk1Row[CATALOGUE_HEADERS.indexOf("Kilde")] = "https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949";
marcosArk1Row[CATALOGUE_HEADERS.indexOf("Billedlink")] = "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6ad8a63dd1248e67782813bf?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29";
const tyranDryRunClosed = makeAppsScriptHarness({ stagingRows: tyranStageRows, targetRows: [marcosArk1Row] });
assert.deepEqual(Object.keys(tyranDryRunClosed.context.TYRAN_PROTECTED_IDENTITIES_).sort(), Object.keys(TYRAN_PROTECTED_IDS).sort(), "the owner gate protects all 22 historical Tyran identities");
tyranDryRunClosed.context.reviewAndAppendTyranStagingRows();
assert.equal(tyranDryRunClosed.originalData.length, 2, "the default-closed Tyran gate allows validation but performs no Ark1 write");
assert.match(tyranDryRunClosed.ui.alerts[0], /dry run bestået/u);
const tyranApproved = makeAppsScriptHarness({
  stagingRows: tyranStageRows, targetRows: [marcosArk1Row], promptText: "APPEND tyran-auto-v1-08d0021f",
  properties: { TYRAN_APPEND_ENABLED: "true" }
});
const appsTyranIdentities = tyranApproved.context.VERIFIED_TYRAN_IDENTITIES_;
for (const record of tyranRegistry.records) {
  const staged = appsTyranIdentities[record.podcast_id];
  assert.ok(staged, `Apps Script has the exact owner gate identity for ${record.podcast_id}`);
  assert.equal(staged.title, record.title);
  assert.equal(staged.seriesId, record.dr_series_id);
  assert.equal(staged.seriesProductionNumber, record.source_series_production_number);
  assert.equal(staged.seriesUrl, record.source_url);
  assert.equal(staged.episodeTitle, record.first_full_episode.title);
  assert.equal(staged.guid, record.first_full_episode.production_number);
  assert.equal(staged.episodeUrl, record.first_full_episode.source_url);
  assert.equal(staged.coverImageId, record.cover_image_id);
  assert.equal(staged.coverUrl, record.cover_source_url);
  assert.equal(staged.coverSha256, record.cover_sha256);
}
tyranApproved.context.reviewAndAppendTyranStagingRows();
assert.equal(tyranApproved.originalData.length, 3, "one exact owner approval appends Macias after an existing Marcos identity");
assert.equal(tyranApproved.originalData[1][CATALOGUE_HEADERS.indexOf("Podcast-ID")], "marcos", "the existing Marcos row is unchanged");
assert.equal(tyranApproved.originalData[2][CATALOGUE_HEADERS.indexOf("Podcast-ID")], "tyran-auto-v1-08d0021f");
assert.equal(tyranApproved.originalData[2][CATALOGUE_HEADERS.indexOf("Link")], "https://www.dr.dk/lyd/p3/tyran-macias/tyran-macias-22/1-4-macias-16122693681");
assert.equal(tyranApproved.originalData[2][CATALOGUE_HEADERS.indexOf("Feed")], "");
assert.equal(tyranApproved.originalData[2][CATALOGUE_HEADERS.indexOf("Vuring (1-10)")], "");
assert.equal(tyranApproved.context.Logger.logs.some((line) => line.includes("TYRAN_STAGING_APPEND")), true);
const tyranWrongApproval = makeAppsScriptHarness({
  stagingRows: tyranStageRows, promptText: "APPEND tyran-auto-v1-08d0021f2",
  properties: { TYRAN_APPEND_ENABLED: "true" }
});
tyranWrongApproval.context.reviewAndAppendTyranStagingRows();
assert.equal(tyranWrongApproval.originalData.length, 1, "Tyran append requires the exact approval phrase");
const tyranStaleBackup = makeAppsScriptHarness({
  stagingRows: tyranStageRows, promptText: "APPEND tyran-auto-v1-08d0021f",
  properties: { TYRAN_APPEND_ENABLED: "true", BACKUP_VERIFIED_AT: new Date(Date.now() - 30 * 60 * 1000).toISOString() }
});
assert.throws(() => tyranStaleBackup.context.reviewAndAppendTyranStagingRows(), /15 minutter/u);
assert.equal(tyranStaleBackup.originalData.length, 1, "stale backup prevents Tyran append");
const tyranExistingExact = makeAppsScriptHarness({
  stagingRows: tyranStageRows, targetRows: [tyranRow.slice(0, CATALOGUE_HEADERS.length)],
  properties: { TYRAN_APPEND_ENABLED: "true" }
});
tyranExistingExact.context.reviewAndAppendTyranStagingRows();
assert.equal(tyranExistingExact.originalData.length, 2, "an exact existing Ark1 Podcast-ID is an idempotent no-op");
const marcosRegistryRecord = tyranRegistry.records.find((record) => record.discovery_key === "marcos");
const stagedHistoricalMarcos = buildStagingRow(marcosRegistryRecord);
const tyranExistingMarcos = makeAppsScriptHarness({
  stagingRows: [STAGING_HEADERS, stagedHistoricalMarcos], targetRows: [marcosArk1Row],
  properties: { TYRAN_APPEND_ENABLED: "true" }
});
tyranExistingMarcos.context.reviewAndAppendTyranStagingRows();
assert.equal(tyranExistingMarcos.originalData.length, 2, "the owner gate verifies and skips the original Marcos Ark1 identity");
const tyranCollisionTarget = [...marcosArk1Row];
tyranCollisionTarget[CATALOGUE_HEADERS.indexOf("Podcast-ID")] = "different-id";
tyranCollisionTarget[CATALOGUE_HEADERS.indexOf("Titel")] = "Macias";
const tyranTitleCollision = makeAppsScriptHarness({
  stagingRows: tyranStageRows, targetRows: [tyranCollisionTarget], properties: { TYRAN_APPEND_ENABLED: "true" }
});
assert.throws(() => tyranTitleCollision.context.reviewAndAppendTyranStagingRows(), /Tyran-titlen findes allerede/u);
assert.equal(tyranTitleCollision.originalData.length, 2, "an Ark1 title collision blocks Tyran append");
const tyranWrongSourceRow = [...tyranRow];
tyranWrongSourceRow[STAGING_HEADERS.indexOf("DR source URL")] = "https://www.dr.dk/lyd/p3/tyran-macias/teaser-16122693681";
const tyranWrongSource = makeAppsScriptHarness({
  stagingRows: [STAGING_HEADERS, tyranWrongSourceRow], properties: { TYRAN_APPEND_ENABLED: "true" }
});
assert.throws(() => tyranWrongSource.context.reviewAndAppendTyranStagingRows(), /identitet, cover, reviewstatus/u);
assert.equal(tyranWrongSource.originalData.length, 1);
const tyranFormulaRow = tyranRow.map((cell) => cell);
const tyranFormulaGrid = [STAGING_HEADERS.map(() => ""), tyranRow.map(() => "")];
tyranFormulaGrid[1][STAGING_HEADERS.indexOf("Lang beskrivelse")] = "=IMPORTXML(\"https://evil.invalid\",\"//x\")";
const tyranFormula = makeAppsScriptHarness({ stagingRows: tyranStageRows, stagingFormulas: tyranFormulaGrid, properties: { TYRAN_APPEND_ENABLED: "true" } });
assert.throws(() => tyranFormula.context.reviewAndAppendTyranStagingRows(), /Formler i Tyran/u);
assert.equal(tyranFormula.originalData.length, 1);
const stagedIsdalenId = "djaevlen-auto-v1-1139735b";
const existingIsdalenWithoutInlineCredit = [...stageRows[1]];
existingIsdalenWithoutInlineCredit[STAGING_HEADERS.indexOf("DR source description")] = existingIsdalenWithoutInlineCredit[STAGING_HEADERS.indexOf("DR source description")].replace(" Vært: Per Lysholt.", "");
const exactSourceGate = makeAppsScriptHarness({
  stagingRows: [STAGING_HEADERS, existingIsdalenWithoutInlineCredit], promptText: `APPEND ${stagedIsdalenId}`
});
exactSourceGate.context.reviewAndAppendDrStagingRows();
assert.equal(exactSourceGate.originalData.length, 2, "the curated host credit remains verifiable from the exact ID, GUID and URL even when an existing staging source-description cell is unchanged");
assert.equal(exactSourceGate.originalData[1][CATALOGUE_HEADERS.indexOf("Vært")], "Per Lysholt");
const conflictingExactSource = [...existingIsdalenWithoutInlineCredit];
conflictingExactSource[STAGING_HEADERS.indexOf("DR source description")] += " Vært: Martin Grønne.";
const conflictingExactGate = makeAppsScriptHarness({
  stagingRows: [STAGING_HEADERS, conflictingExactSource], promptText: `APPEND ${stagedIsdalenId}`
});
assert.throws(() => conflictingExactGate.context.reviewAndAppendDrStagingRows(), /matchende DR-værtskreditering/u);
assert.equal(conflictingExactGate.originalData.length, 1, "an exact-source whitelist does not override conflicting explicit credit text");
const idIndex = CATALOGUE_HEADERS.indexOf("Podcast-ID");
const existingEditorial = Array(CATALOGUE_HEADERS.length).fill("");
existingEditorial[CATALOGUE_HEADERS.indexOf("Titel")] = "Existing podcast";
existingEditorial[idIndex] = "existing-id";
existingEditorial[CATALOGUE_HEADERS.indexOf("Hovedserie")] = "Bakspejl";
existingEditorial[CATALOGUE_HEADERS.indexOf("Vuring (1-10)")] = "9,1";
existingEditorial[CATALOGUE_HEADERS.indexOf("Afgivet vurdering")] = "2024-02-03";
const candidateId = candidates[0].podcast_id;
const accepted = makeAppsScriptHarness({ targetRows: [existingEditorial], stagingRows: stageRows, promptText: `APPEND ${candidateId}` });
accepted.context.reviewAndAppendDrStagingRows();
assert.equal(accepted.originalData.length, 3, "one manually approved new series appends once");
assert.equal(accepted.originalData[1][idIndex], "existing-id");
assert.equal(accepted.originalData[2][CATALOGUE_HEADERS.indexOf("Vært")], "Per Lysholt", "Apps Script carries the explicitly credited host into Ark1 after owner approval");
assert.equal(accepted.originalData[1][CATALOGUE_HEADERS.indexOf("Vuring (1-10)")], "9,1");
assert.equal(accepted.originalData[1][CATALOGUE_HEADERS.indexOf("Afgivet vurdering")], "2024-02-03");
assert.deepEqual(accepted.originalData[1], existingEditorial, "rating, episode fields, history, and every other old cell remain byte-for-byte unchanged");
const again = makeAppsScriptHarness({ targetRows: [existingEditorial, accepted.originalData[2]], stagingRows: stageRows, promptText: `APPEND ${candidateId}` });
again.context.reviewAndAppendDrStagingRows();
assert.equal(again.originalData.length, 3, "rerun recognizes exact ID and never appends a duplicate");
assert.equal(again.targetLockAcquires, 0, "already-present ID never enters a write lock");
const bakspejlId = "bakspejl-auto-v1-4962cdc5";
const bakspejlApproved = makeAppsScriptHarness({ stagingRows: stageRows, promptText: `APPEND ${bakspejlId}` });
bakspejlApproved.context.reviewAndAppendDrStagingRows();
assert.equal(bakspejlApproved.originalData.length, 2);
assert.equal(bakspejlApproved.originalData[1][CATALOGUE_HEADERS.indexOf("Vært")], "Celine Klint", "the owner gate accepts the combined host credit after manual approval");

for (const options of [
  { originalId: "wrong-sheet" }, { targetGid: 5 }, { badHeader: true },
  { properties: { APPEND_ENABLED: "false" } },
  { properties: { BACKUP_RESTORE_TEST_VERIFIED: "false" } },
  { properties: { OWNER_EMAIL: "someone-else@example.invalid" } }
]) {
  const blocked = makeAppsScriptHarness({ stagingRows: stageRows, promptText: `APPEND ${candidateId}`, ...options });
  assert.throws(() => blocked.context.reviewAndAppendDrStagingRows());
  assert.equal(blocked.originalData.length, 1);
}

const skip = makeAppsScriptHarness({ stagingRows: stageRows, promptText: "", promptButton: "CANCEL" });
skip.context.reviewAndAppendDrStagingRows();
assert.equal(skip.originalData.length, 1, "owner can leave a proposal in staging without appending");

const lockRefused = makeAppsScriptHarness({ stagingRows: stageRows, promptText: `APPEND ${candidateId}`, lockAvailable: false });
assert.throws(() => lockRefused.context.reviewAndAppendDrStagingRows(), /låse/);
assert.equal(lockRefused.originalData.length, 1);

const sharedLock = { locked: false };
let parallelSecond;
const parallelFirst = makeAppsScriptHarness({
  stagingRows: stageRows, promptText: `APPEND ${candidateId}`, lockState: sharedLock,
  onAppend: () => assert.throws(() => parallelSecond.context.reviewAndAppendDrStagingRows(), /låse/)
});
parallelSecond = makeAppsScriptHarness({ stagingRows: stageRows, promptText: `APPEND ${candidateId}`, lockState: sharedLock });
parallelFirst.context.reviewAndAppendDrStagingRows();
assert.equal(parallelFirst.originalData.length, 2);
assert.equal(parallelSecond.originalData.length, 1, "a concurrent owner execution is excluded by the shared document lock");

const ambiguousAppsScript = makeAppsScriptHarness({ stagingRows: stageRows, promptText: `APPEND ${candidateId}`, appendFault: "after-commit" });
ambiguousAppsScript.context.reviewAndAppendDrStagingRows();
assert.equal(ambiguousAppsScript.originalData.length, 2, "timeout after commit is recovered by exact-ID readback");

const noCommitFailure = makeAppsScriptHarness({ stagingRows: stageRows, promptText: `APPEND ${candidateId}`, appendFault: "before-append" });
assert.throws(() => noCommitFailure.context.reviewAndAppendDrStagingRows(), /before append/);
assert.equal(noCommitFailure.originalData.length, 1, "failure before append leaves production unchanged");

const staleBackup = makeAppsScriptHarness({ targetRows: [existingEditorial], stagingRows: stageRows, promptText: `APPEND ${candidateId}`, properties: { BACKUP_VERIFIED_AT: "2020-01-01T00:00:00.000Z" } });
assert.throws(() => staleBackup.context.reviewAndAppendDrStagingRows(), /backup/);
assert.equal(staleBackup.originalData.length, 2, "stale backup attestation prevents the production append");

const oldCellMutation = makeAppsScriptHarness({ targetRows: [existingEditorial], stagingRows: stageRows, promptText: `APPEND ${candidateId}`, appendFault: "mutate-old" });
assert.throws(() => oldCellMutation.context.reviewAndAppendDrStagingRows(), /Ark1-celler ændrede sig/);

const formulaRow = [...stageRows[1]];
formulaRow[CATALOGUE_HEADERS.indexOf("Kort beskrivelse")] = "=IMPORTXML(\"https://evil.invalid\",\"//x\")";
const formulaHarness = makeAppsScriptHarness({ stagingRows: [STAGING_HEADERS, formulaRow], promptText: `APPEND ${candidateId}` });
assert.throws(() => formulaHarness.context.reviewAndAppendDrStagingRows(), /Formel-lignende/);
assert.equal(formulaHarness.originalData.length, 1);

const futureRow = [...genericPlan.append[0]];
const futureHarnessNeedsReview = makeAppsScriptHarness({ stagingRows: [STAGING_HEADERS, futureRow], promptText: "APPEND bakspejl-auto-v1-1234abcd" });
assert.throws(() => futureHarnessNeedsReview.context.reviewAndAppendDrStagingRows(), /genre og emner/);
assert.equal(futureHarnessNeedsReview.originalData.length, 1, "source-derived proposals without editorial classification cannot reach Ark1");
futureRow[CATALOGUE_HEADERS.indexOf("Genre")] = "Historie";
futureRow[CATALOGUE_HEADERS.indexOf("Emner")] = "Verificeret emne";
const futureApproved = makeAppsScriptHarness({ stagingRows: [STAGING_HEADERS, futureRow], promptText: "APPEND bakspejl-auto-v1-1234abcd" });
futureApproved.context.reviewAndAppendDrStagingRows();
assert.equal(futureApproved.originalData.length, 2, "a future DR series can be reviewed without a hardcoded catalogue entry");

const legacyApproved = makeAppsScriptHarness({ stagingRows: [STAGING_HEADERS, draeberurtenRow], promptText: "APPEND dræberurten" });
legacyApproved.context.reviewAndAppendDrStagingRows();
assert.equal(legacyApproved.originalData.length, 2, "the documented legacy identity can pass the same owner review gate");
assert.equal(legacyApproved.originalData[1][idIndex], "dræberurten");
assert.equal(legacyApproved.originalData[1][CATALOGUE_HEADERS.indexOf("Vært")], "Per Lysholt");
assert.equal(legacyApproved.originalData[1][CATALOGUE_HEADERS.indexOf("Vuring (1-10)")], "");
assert.equal(legacyApproved.originalData[1][CATALOGUE_HEADERS.indexOf("Afgivet vurdering")], "");
const legacyCollisionRow = [...draeberurtenRow];
legacyCollisionRow[CATALOGUE_HEADERS.indexOf("Titel")] = "Another title";
const legacyCollision = makeAppsScriptHarness({ stagingRows: [STAGING_HEADERS, legacyCollisionRow], promptText: "APPEND dræberurten" });
assert.throws(() => legacyCollision.context.reviewAndAppendDrStagingRows(), /full-episode-proveniens/u);
assert.equal(legacyCollision.originalData.length, 1, "legacy ID collisions fail closed");

const fabricatedHostRow = [...futureRow];
fabricatedHostRow[CATALOGUE_HEADERS.indexOf("Vært")] = "Celine Klint";
const fabricatedHost = makeAppsScriptHarness({ stagingRows: [STAGING_HEADERS, fabricatedHostRow], promptText: "APPEND bakspejl-auto-v1-1234abcd" });
assert.throws(() => fabricatedHost.context.reviewAndAppendDrStagingRows(), /matchende DR-værtskreditering/u);
assert.equal(fabricatedHost.originalData.length, 1, "the owner gate rejects a host without exact source credit");

// Existing editorial Sheet rows and immutable identities continue to win catalogue sync.
const editorialSourceRow = { Titel: "Kvinden i Isdalen", "Podcast-ID": Object.keys(VERIFIED_DR_SERIES_METADATA)[0], Hovedserie: "Djævlen i detaljen", "Kort beskrivelse": "Redaktørens rettelse" };
assert.equal(mergeAutoDiscoveredDjaevlenRows([editorialSourceRow], { records: [{
  title: "Kvinden i Isdalen", podcast_id: editorialSourceRow["Podcast-ID"],
  discovery_key: "kvinden i isdalen", hovedserie: "Djævlen i detaljen"
}] })[0]["Kort beskrivelse"], "Redaktørens rettelse");
const autoRows = mergeAutoDiscoveredBakspejlRows([], { records: [{
  title: "Den spanske borgerkrig", podcast_id: "bakspejl-auto-v1-4962cdc5", discovery_key: "den spanske borgerkrig", hovedserie: "Bakspejl"
}] });
assert.equal(autoRows[0]["Podcast-ID"], "bakspejl-auto-v1-4962cdc5");
assert.ok(autoRows[0]["Kort beskrivelse"].includes("Harald, Aage og Kai"));
assert.equal(preserveCatalogueIdsByPodcastId(autoRows, [{ "Podcast-ID": "bakspejl-auto-v1-4962cdc5", catalogue_id: "catalogue-v1-existing" }])[0].catalogue_id, "catalogue-v1-existing");
const drRegistry = JSON.parse(await readFile(new URL("../data/auto-discovered-djaevlen.json", import.meta.url), "utf8"));
const drRecord = drRegistry.records.find((record) => record.podcast_id === "dræberurten");
assert.equal(drRecord?.source_episode_guid, "16122692641");
assert.equal(drRecord?.source_url, VERIFIED_DR_SERIES_METADATA["dræberurten"].sourceUrl);
assert.equal(drRecord?.needs_editorial_review, true);
const drCatalogueRow = mergeAutoDiscoveredDjaevlenRows([], { records: [drRecord] })[0];
assert.equal(drCatalogueRow["Podcast-ID"], "dræberurten");
assert.equal(drCatalogueRow.Genre, "True Crime");
assert.ok(drCatalogueRow.Emner.includes("Victor Licata"));
assert.equal(drCatalogueRow["Kort beskrivelse"], VERIFIED_DR_SERIES_METADATA["dræberurten"].shortDescription);
const drSheetRow = Object.fromEntries(CATALOGUE_HEADERS.map((header, index) => [header, legacyApproved.originalData[1][index]]));
drSheetRow["Kort beskrivelse"] = "Ejerens redigerede beskrivelse";
drSheetRow["Vuring (1-10)"] = "8,7";
const resyncedDrRows = mergeAutoDiscoveredDjaevlenRows([drSheetRow], { records: [drRecord] });
assert.equal(resyncedDrRows.length, 1, "the next Sheet catalogue sync does not add a second Dræberurten identity");
assert.equal(resyncedDrRows[0]["Podcast-ID"], "dræberurten");
assert.equal(resyncedDrRows[0]["Kort beskrivelse"], "Ejerens redigerede beskrivelse");
assert.equal(resyncedDrRows[0]["Vuring (1-10)"], "8,7", "manual editorial data wins the next catalogue sync");
const files = ["../data/podcasts.json", "../data/auto-discovered-djaevlen.json", "../data/auto-discovered-bakspejl.json", "../config/recommendation-topic-aliases.json", "../config/recommendation-genre-mapping.json", "../data/recommendation-metadata.json"];
const [catalogue, , , aliases, genres, previousMetadata] = await Promise.all(files.map((path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse)));
const ids = new Set(Object.keys(VERIFIED_DR_SERIES_METADATA));
let recommendationRows = catalogue.rows.filter((row) => !ids.has(row["Podcast-ID"]));
recommendationRows = mergeAutoDiscoveredDjaevlenRows(recommendationRows, { records: [recordFor("djaevlen-auto-v1-1139735b"), drRecord] });
recommendationRows = mergeAutoDiscoveredBakspejlRows(recommendationRows, { records: [recordFor([...ids][1])] });
recommendationRows = recommendationRows.map((row) => ({
  ...row, secondaryGenre: row.secondaryGenre || row["2. genre"] || "",
  topics: Array.isArray(row.topics) ? row.topics : String(row.Emner || "").split(";").map((topic) => topic.trim()).filter(Boolean)
}));
const built = buildRecommendationData({ rows: recommendationRows }, aliases, genres, { repoRoot: process.cwd(), existingMetadata: previousMetadata });
for (const title of ["Kvinden i Isdalen", "Den spanske borgerkrig", "Dræberurten"]) {
  const metadata = built.payload.rows.find((row) => row.title === title);
  assert.equal(metadata?.recommendationMetadataEligible, true, `${title} must remain recommendation-eligible`);
  assert.ok(metadata.topicsCanonical.length > 0);
}
console.log("DR staging and owner append-gate tests passed (mock-only; no production Sheets writes)");
