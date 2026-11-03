import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  CATALOGUE_HEADERS, RADIO_IIII_STAGING_HEADERS, buildRadioIIIIStagingRow
} from "./google-sheets-staging.mjs";

const registry = JSON.parse(await readFile(new URL("../data/auto-discovered-radio-iiii.json", import.meta.url), "utf8"));
const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const candidates = registry.records;
assert.equal(candidates.length, 4);
assert.deepEqual(candidates.map((candidate) => candidate.podcast_id).sort(), [
  "radio-iiii-auto-v1-7f0dfeb9", "radio-iiii-auto-v1-915a06b7",
  "radio-iiii-auto-v1-ad97bb06", "radio-iiii-auto-v1-f143ebcd"
].sort());
const stagedRows = [RADIO_IIII_STAGING_HEADERS, ...candidates.map((candidate) => buildRadioIIIIStagingRow(candidate, "2026-11-03"))];
const script = await readFile(new URL("../apps-script/append-dr-staging-to-ark1/Code.gs", import.meta.url), "utf8");

function targetRow(record) {
  return CATALOGUE_HEADERS.map((header) => record[header] ?? "");
}

function makeHarness({
  targetRows = [], stagingRows = stagedRows, properties = {}, promptResponses = [], promptButtons = [],
  originalId = "1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss", targetGid = 0, badHeader = false,
  lockState = { locked: false }, lockAvailable = true, appendFault = null, onAppend = null,
  physicalStagingWidth = 66
} = {}) {
  const originalHeaders = [...CATALOGUE_HEADERS];
  if (badHeader) originalHeaders[19] = "Wrong header";
  const originalData = [originalHeaders, ...structuredClone(targetRows)];
  const stagingData = structuredClone(stagingRows).map((row) => [
    ...row, ...Array(Math.max(0, physicalStagingWidth - row.length)).fill("")
  ]);
  let lockAcquires = 0;
  const stagingWidths = [];
  const target = {
    getName: () => "Ark1", getSheetId: () => targetGid,
    getLastRow: () => originalData.length, getLastColumn: () => CATALOGUE_HEADERS.length,
    getRange(row, col, height, width) {
      return {
        getDisplayValues: () => originalData.slice(row - 1, row - 1 + height).map((r) => r.slice(col - 1, col - 1 + width).map(String)),
        getValues: () => structuredClone(originalData.slice(row - 1, row - 1 + height).map((r) => r.slice(col - 1, col - 1 + width))),
        getFormulas: () => originalData.slice(row - 1, row - 1 + height).map((r) => r.slice(col - 1, col - 1 + width).map(() => "")),
        setValues(values) {
          if (appendFault === "before-append") throw new Error("simulated interruption before append");
          if (appendFault === "mutate-old") originalData[1][CATALOGUE_HEADERS.indexOf("Titel")] = "tampered";
          originalData.push(...structuredClone(values));
          if (onAppend) onAppend();
          if (appendFault === "after-commit") throw new Error("simulated timeout after append");
        }
      };
    }
  };
  const stagingTab = {
    getLastRow: () => stagingData.length,
    getRange(row, col, height, width) {
      stagingWidths.push(width);
      const selected = stagingData.slice(row - 1, row - 1 + height).map((r) => r.slice(col - 1, col - 1 + width));
      return {
        getValues: () => structuredClone(selected),
        getDisplayValues: () => structuredClone(selected.map((r) => r.map((v) => String(v ?? "")))),
        getFormulas: () => selected.map((r) => r.map(() => ""))
      };
    }
  };
  const props = new Map(Object.entries({
    OWNER_EMAIL: "owner@example.invalid", APPEND_ENABLED: "true", BACKUP_RESTORE_TEST_VERIFIED: "true",
    BACKUP_VERIFIED_AT: new Date().toISOString(), BACKUP_SPREADSHEET_ID: "isolated-test-reference",
    STAGING_SPREADSHEET_ID: "separate-staging-test", ...properties
  }));
  const menus = [];
  const promptLog = [];
  const ui = {
    alerts: [], alert(message) { this.alerts.push(String(message)); },
    prompt(title, message) {
      promptLog.push({ title, message });
      const responseText = promptResponses.shift() ?? "";
      const button = promptButtons.shift() ?? "OK";
      return { getSelectedButton: () => button, getResponseText: () => responseText };
    },
    createMenu(name) {
      const menu = { name, entries: [], addItem(label, handler) { this.entries.push({ label, handler }); return this; }, addToUi() { menus.push(this); } };
      return menu;
    },
    ButtonSet: { OK_CANCEL: "OK_CANCEL" }, Button: { OK: "OK" }
  };
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getId: () => originalId, getSheetByName: (name) => name === "Ark1" ? target : null }),
      openById: (id) => id === "separate-staging-test" ? {
        getSheetByName: (name) => name === "Radio IIII staging" ? stagingTab : name === "DR staging" ? stagingTab : null
      } : { getId: () => id },
      getUi: () => ui
    },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (key) => props.get(key) ?? "" }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.invalid" }) },
    LockService: { getDocumentLock: () => ({
      tryLock: () => { lockAcquires += 1; if (!lockAvailable || lockState.locked) return false; lockState.locked = true; return true; },
      releaseLock: () => { lockState.locked = false; }
    }) },
    Logger: { logs: [], log(message) { this.logs.push(String(message)); } },
    Map, Set, JSON, String, Date, Error, Math, RegExp, Number
  };
  vm.createContext(context);
  vm.runInContext(script, context, { filename: "Code.gs" });
  return {
    context, originalData, ui, props, menus, promptLog, stagingWidths,
    get lockAcquires() { return lockAcquires; },
    run(id, options = {}) {
      const c = candidates.find((record) => record.podcast_id === id);
      const responses = [id, `GENRE Samfund ${id}`, `APPEND ${id}`];
      return makeHarness({ stagingRows: [RADIO_IIII_STAGING_HEADERS, buildRadioIIIIStagingRow(c, "2026-11-03")], promptResponses: responses, ...options });
    }
  };
}

function approvedResponses(id) { return [id, `GENRE Samfund ${id}`, `APPEND ${id}`]; }

const menuHarness = makeHarness();
menuHarness.context.onOpen();
assert.deepEqual(menuHarness.menus.map((menu) => menu.name), ["DR staging", "Radio IIII staging"]);
assert.equal(menuHarness.menus[0].entries[0].handler, "reviewAndAppendDrStagingRows", "existing DR menu target is unchanged");
assert.equal(menuHarness.menus[1].entries[0].handler, "reviewAndAppendRadioIIIIStagingRow");

const activeGenreValues = ["True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund", "Sport", "Dokumentar", "Viden", "Underholdning", "Sladder"];
assert.equal(activeGenreValues.includes("Portræt"), false, "Portræt is not in current main's active genre set");
assert.equal(activeGenreValues.includes("Samfund"), true, "Samfund is an active editorially plausible proposal");

const oldRadioRows = catalogue.rows.filter((row) => row.Hovedserie === "Et kapitel for sig" && !candidates.some((candidate) => candidate.podcast_id === row["Podcast-ID"]));
assert.equal(oldRadioRows.length, 60, "fixture contains all 60 established guest identities");
const oldRows = oldRadioRows.map(targetRow);
const protectedTargetRows = structuredClone(oldRows);
for (const candidate of candidates) {
  const harness = makeHarness({ targetRows: protectedTargetRows, promptResponses: approvedResponses(candidate.podcast_id) });
  harness.context.reviewAndAppendRadioIIIIStagingRow();
  assert.equal(harness.originalData.length, 62, `${candidate.podcast_id} appends exactly one row`);
  assert.deepEqual(harness.originalData.slice(1, 61), oldRows, `${candidate.podcast_id} preserves all 60 old Ark1 rows byte-for-byte`);
  const added = harness.originalData[61];
  const at = (header) => added[CATALOGUE_HEADERS.indexOf(header)];
  assert.equal(at("Podcast-ID"), candidate.podcast_id);
  assert.equal(at("Titel"), candidate.title);
  assert.equal(at("Genre"), "Samfund", "the inactive Portræt staging value changes only after the explicit per-ID genre approval");
  assert.equal(at("Hovedserie"), "Et kapitel for sig");
  assert.equal(at("Vært"), "Anne Sofie Kragh");
  assert.equal(at("Udgiver"), "RADIO IIII");
  for (const header of ["Placering", "Vuring (1-10)", "Årstal afspillet", "Afgivet vurdering", "2. genre", "Feed", "Supplerende ligheder", "Uaktuel", "Undervurderet perle", "Adgang", "Engelsk"]) {
    assert.equal(at(header), "", `${candidate.title} keeps ${header} empty`);
  }
  assert.equal(at("Episoder").split("; ").length, 5, "only verified prolog and chapter titles are staged in the episode catalogue field");
  assert.deepEqual(harness.stagingWidths, [36, 36], "staging is read only from A:AJ despite extra physical columns");
  assert.equal(harness.lockAcquires, 1, "one owner confirmation performs one locked append");
  assert.equal(harness.promptLog.length, 3, "ID selection, genre approval and APPEND confirmation are separate prompts");
  assert.ok(harness.promptLog[2].message.includes(candidate.manual_episodes.join("; ")));
}

const oneId = candidates[0].podcast_id;
function candidateRun({ stagingRows = stagedRows, targetRows = [], promptResponses = approvedResponses(oneId), ...options } = {}) {
  const harness = makeHarness({ stagingRows, targetRows, promptResponses, ...options });
  return { harness, run: () => harness.context.reviewAndAppendRadioIIIIStagingRow() };
}

for (const options of [
  { stagingRows: [RADIO_IIII_STAGING_HEADERS, stagedRows[1], stagedRows[1]] },
  { stagingRows: [RADIO_IIII_STAGING_HEADERS, stagedRows[1].map((cell, i) => i === RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source GUIDs") ? "changed-guid" : cell)] },
  { stagingRows: [RADIO_IIII_STAGING_HEADERS, stagedRows[1].map((cell, i) => i === RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII season URL") ? "https://radio4.dk/podcasts/et-kapitel-for-sig?season=66" : cell)] },
  { stagingRows: [RADIO_IIII_STAGING_HEADERS, stagedRows[1].map((cell, i) => i === RADIO_IIII_STAGING_HEADERS.indexOf("Genre") ? "Dokumentar" : cell)] },
  { stagingRows: [RADIO_IIII_STAGING_HEADERS, stagedRows[1].map((cell, i) => i === RADIO_IIII_STAGING_HEADERS.indexOf("Review status") ? "APPROVED" : cell)] }
]) {
  const { harness, run } = candidateRun(options);
  assert.throws(run, /dubleret|officielle kilde|kildeidentitet/u);
  assert.equal(harness.originalData.length, 1, "duplicate or altered source identity is rejected before any write");
  assert.equal(harness.lockAcquires, 0);
}

const invalidGenreApproval = candidateRun({ promptResponses: [oneId, `GENRE Portræt ${oneId}`, `APPEND ${oneId}`] });
invalidGenreApproval.run();
assert.equal(invalidGenreApproval.harness.originalData.length, 1, "an inactive or unapproved genre blocks append");
assert.equal(invalidGenreApproval.harness.lockAcquires, 0);

const cancelledAppend = candidateRun({ promptResponses: [oneId, `GENRE Samfund ${oneId}`, `APPEND ${candidates[1].podcast_id}`] });
cancelledAppend.run();
assert.equal(cancelledAppend.harness.originalData.length, 1, "wrong APPEND phrase blocks the selected candidate");

for (const options of [
  { properties: { BACKUP_SPREADSHEET_ID: "" } },
  { properties: { BACKUP_RESTORE_TEST_VERIFIED: "false" } },
  { properties: { BACKUP_VERIFIED_AT: "2020-01-01T00:00:00.000Z" } },
  { properties: { BACKUP_VERIFIED_AT: new Date(Date.now() + 5 * 60 * 1000).toISOString() } },
  { properties: { APPEND_ENABLED: "false" } },
  { properties: { OWNER_EMAIL: "different@example.invalid" } },
  { originalId: "wrong-original" },
  { targetGid: 3 },
  { badHeader: true }
]) {
  const { harness, run } = candidateRun(options);
  assert.throws(run);
  assert.equal(harness.originalData.length, 1, "owner, backup, gate, original ID, gid or header failure blocks production");
  assert.equal(harness.lockAcquires, 0);
}

const targetIdCollisionRow = Array(CATALOGUE_HEADERS.length).fill("");
targetIdCollisionRow[CATALOGUE_HEADERS.indexOf("Podcast-ID")] = oneId;
targetIdCollisionRow[CATALOGUE_HEADERS.indexOf("Titel")] = "A different identity";
const targetIdCollision = candidateRun({ targetRows: [targetIdCollisionRow] });
assert.throws(targetIdCollision.run, /anden titel|kilde/);
assert.equal(targetIdCollision.harness.originalData.length, 2);

const duplicateUrlRow = Array(CATALOGUE_HEADERS.length).fill("");
duplicateUrlRow[CATALOGUE_HEADERS.indexOf("Podcast-ID")] = "unrelated-id";
duplicateUrlRow[CATALOGUE_HEADERS.indexOf("Titel")] = "Unrelated title";
duplicateUrlRow[CATALOGUE_HEADERS.indexOf("Kilde")] = candidates[0].source_url;
const duplicateUrl = candidateRun({ targetRows: [duplicateUrlRow] });
assert.throws(duplicateUrl.run, /kilde- eller episodeidentitet/);

const duplicateGuidRow = Array(CATALOGUE_HEADERS.length).fill("");
duplicateGuidRow[CATALOGUE_HEADERS.indexOf("Podcast-ID")] = "another-id";
duplicateGuidRow[CATALOGUE_HEADERS.indexOf("Titel")] = "Different title";
duplicateGuidRow[CATALOGUE_HEADERS.indexOf("Feed")] = candidates[0].episodes.map((_, index) => candidates[0].episodes[index]).join(" ") + " " + registry.records[0].episodes[0].guid;
const duplicateGuid = candidateRun({ targetRows: [duplicateGuidRow] });
assert.throws(duplicateGuid.run, /kilde- eller episodeidentitet/);

const existingExact = targetRow({
  "Podcast-ID": oneId, Titel: candidates[0].title, "Vært": "Anne Sofie Kragh", Udgiver: "RADIO IIII",
  Genre: "Samfund", Hovedserie: "Et kapitel for sig", "Antal afsnit": "5",
  Link: candidates[0].source_url, Kilde: candidates[0].source_url, Episoder: candidates[0].manual_episodes.join("; ")
});
const idempotent = candidateRun({ targetRows: [existingExact], stagingRows: [RADIO_IIII_STAGING_HEADERS, stagedRows[1]] });
idempotent.run();
assert.equal(idempotent.harness.originalData.length, 2, "an exact existing Radio IIII identity is a no-op on rerun");
assert.equal(idempotent.harness.lockAcquires, 0, "an already-added identity does not acquire a write lock");

for (const fault of ["before-append", "after-commit"]) {
  const interrupted = candidateRun({ appendFault: fault });
  if (fault === "before-append") assert.throws(interrupted.run, /interruption before append/u);
  else interrupted.run();
  assert.equal(interrupted.harness.originalData.length, fault === "before-append" ? 1 : 2);
}

const oldMutation = candidateRun({ targetRows: [oldRows[0]], appendFault: "mutate-old" });
assert.throws(oldMutation.run, /Eksisterende Ark1-celler ændrede sig/u);

const sharedLock = { locked: false };
let secondCall;
const concurrent = candidateRun({ lockState: sharedLock, onAppend: () => assert.throws(() => secondCall.run(), /låse/u) });
secondCall = candidateRun({ lockState: sharedLock, promptResponses: approvedResponses(candidates[1].podcast_id) });
concurrent.run();
assert.equal(concurrent.harness.originalData.length, 2);
assert.equal(secondCall.harness.originalData.length, 1, "a concurrent owner invocation is refused by the document lock");

console.log("RADIO IIII owner-gate tests passed: four exact IDs, staging bounds, source collisions, genre approval, fresh backup, owner/lock checks, interruption recovery, idempotency and 60 preserved guests.");
