import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  CATALOGUE_HEADERS, RADIO_IIII_STAGING_HEADERS, STAGING_HEADERS,
  buildRadioIIIIStagingRow, buildStagingRow
} from "./google-sheets-staging.mjs";

const load = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const [radio, bakspejl, djaevlen, tyran] = await Promise.all([
  load("../data/auto-discovered-radio-iiii.json"), load("../data/auto-discovered-bakspejl.json"),
  load("../data/auto-discovered-djaevlen.json"), load("../data/auto-discovered-tyran.json")
]);
const known = (records, id) => records.find((record) => record.podcast_id === id);
const radioRows = [RADIO_IIII_STAGING_HEADERS, ...radio.records.map((record) => buildRadioIIIIStagingRow(record, "2026-11-07"))];
const drRecords = [
  known(bakspejl.records, "bakspejl-auto-v1-4962cdc5"),
  known(djaevlen.records, "djaevlen-auto-v1-1139735b"),
  known(djaevlen.records, "dræberurten")
];
const drRows = [STAGING_HEADERS, ...drRecords.map((record) => buildStagingRow(record, "2026-11-07"))];
const maciasRow = buildStagingRow(known(tyran.records, "tyran-auto-v1-08d0021f"), "2026-11-07");
drRows.push(maciasRow);

const script = await readFile(new URL("../apps-script/append-dr-staging-to-ark1/Code.gs", import.meta.url), "utf8");
const index = (header) => CATALOGUE_HEADERS.indexOf(header);
function targetRow(source) { return CATALOGUE_HEADERS.map((header) => source[header] ?? ""); }

function protectedMattiasRow() {
  const staged = buildRadioIIIIStagingRow(known(radio.records, "radio-iiii-auto-v1-7f0dfeb9"), "2026-11-07");
  const row = staged.slice(0, CATALOGUE_HEADERS.length).map(String);
  row[index("Genre")] = "Samfund";
  return row;
}

function protectedMarcosRow() {
  const expected = Object.values(awaitImportTyran).find((entry) => entry.title === "Marcos");
  const row = Array(CATALOGUE_HEADERS.length).fill("");
  row[index("Titel")] = "Marcos";
  row[index("Hovedserie")] = "Tyran";
  row[index("Udgiver")] = "DR";
  row[index("Podcast-ID")] = "marcos";
  row[index("Link")] = expected.seriesUrl;
  row[index("Kilde")] = expected.seriesUrl;
  row[index("Billedlink")] = expected.coverUrl;
  row[index("Vuring (1-10)")] = 8;
  row[index("Afgivet vurdering")] = "user-42:8";
  row[index("Årstal afspillet")] = "2026";
  row[index("Undervurderet perle")] = "TRUE";
  return row;
}
const awaitImportTyran = {
  marcos: {
    title: "Marcos", seriesUrl: "https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949",
    coverUrl: "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6ad8a63dd1248e67782813bf?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29"
  }
};

function makeHarness({
  approval = "GODKEND BATCH 5", properties = {}, targetRows = [protectedMattiasRow(), protectedMarcosRow()],
  drStageRows = drRows, radioStageRows = radioRows, promptButton = "OK", changeStagingOnPrompt = false,
  changeStagingAfterFirstWrite = false, failWrite = null, lockAvailable = true
} = {}) {
  const originalData = [CATALOGUE_HEADERS, ...structuredClone(targetRows)];
  const maciasNote = Array(STAGING_HEADERS.length).fill("");
  maciasNote[STAGING_HEADERS.indexOf("DR source GUID")] = "Macias";
  const drData = [...structuredClone(drStageRows), [...maciasNote], [...maciasNote]];
  const radioData = structuredClone(radioStageRows);
  const stagingTabs = {
    "DR staging": makeStagingTab(drData, STAGING_HEADERS.length),
    "Radio IIII staging": makeStagingTab(radioData, RADIO_IIII_STAGING_HEADERS.length)
  };
  function makeStagingTab(data, width) {
    return {
      getLastRow: () => data.length,
      getRange(row, col, height, columns) {
        assert.equal(columns, width, "the owner gate reads only defined staging columns and leaves Macias notes untouched");
        const selected = data.slice(row - 1, row - 1 + height).map((item) => item.slice(col - 1, col - 1 + columns));
        return {
          getValues: () => structuredClone(selected), getFormulas: () => selected.map((line) => line.map(() => "")),
          getDisplayValues: () => selected.map((line) => line.map((value) => String(value ?? "")))
        };
      },
      changeFirstRow() { data[1][index("Titel")] = "Changed during approval"; }
    };
  }
  let writes = 0;
  const target = {
    getName: () => "Ark1", getSheetId: () => 0, getLastRow: () => originalData.length,
    getRange(row, col, height, width) {
      const selected = originalData.slice(row - 1, row - 1 + height).map((line) => line.slice(col - 1, col - 1 + width));
      return {
        getValues: () => structuredClone(selected),
        getDisplayValues: () => selected.map((line) => line.map((value) => String(value ?? ""))),
        getFormulas: () => selected.map((line) => line.map(() => "")),
        setValues(values) {
          writes += 1;
          if (failWrite === "before-first" || (Number.isInteger(failWrite) && writes === failWrite)) throw new Error("simulated write failure");
          originalData.push(...structuredClone(values));
          if (changeStagingAfterFirstWrite && writes === 1) stagingTabs["DR staging"].changeFirstRow();
          if (failWrite === "after-first" && writes === 1) throw new Error("simulated timeout after commit");
        }
      };
    }
  };
  const now = Date.now();
  const propertyValues = new Map(Object.entries({
    OWNER_EMAIL: "owner@example.invalid", APPEND_ENABLED: "true", BACKUP_RESTORE_TEST_VERIFIED: "true",
    BACKUP_VERIFIED_AT: new Date(now).toISOString(), BACKUP_SPREADSHEET_ID: "independent-full-backup",
    STAGING_SPREADSHEET_ID: "separate-staging", ...properties
  }));
  let backupReads = 0;
  const props = {
    getProperty(key) { if (key === "BACKUP_VERIFIED_AT") backupReads += 1; return propertyValues.get(key) ?? ""; },
    setProperty(key, value) { propertyValues.set(key, value); return this; }
  };
  const promptLog = [];
  const ui = {
    alerts: [], alert(message) { this.alerts.push(String(message)); },
    prompt(title, message) {
      promptLog.push({ title, message });
      if (changeStagingOnPrompt) stagingTabs["DR staging"].changeFirstRow();
      return { getSelectedButton: () => promptButton, getResponseText: () => approval };
    },
    createMenu(name) {
      const menu = { name, entries: [], addItem(label, handler) { this.entries.push({ label, handler }); return this; }, addToUi() { menus.push(this); } };
      return menu;
    }, ButtonSet: { OK_CANCEL: "OK_CANCEL" }, Button: { OK: "OK" }
  };
  const menus = [];
  let lockAcquires = 0;
  const lockState = { locked: false };
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getId: () => "1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss", getSheetByName: (name) => name === "Ark1" ? target : null }),
      openById: () => ({ getSheetByName: (name) => stagingTabs[name] || null }), getUi: () => ui
    },
    PropertiesService: { getScriptProperties: () => props },
    Session: { getEffectiveUser: () => ({ getEmail: () => "owner@example.invalid" }) },
    LockService: { getDocumentLock: () => ({
      tryLock: () => { lockAcquires += 1; if (!lockAvailable || lockState.locked) return false; lockState.locked = true; return true; },
      releaseLock: () => { lockState.locked = false; }
    }) },
    Logger: { logs: [], log(value) { this.logs.push(String(value)); } },
    Utilities: { DigestAlgorithm: { SHA_256: "SHA_256" }, Charset: { UTF_8: "UTF_8" }, computeDigest(algorithm, value) {
      assert.equal(algorithm, "SHA_256");
      return [...createHash("sha256").update(String(value), "utf8").digest()].map((byte) => byte > 127 ? byte - 256 : byte);
    } },
    Map, Set, JSON, String, Date, Error, Math, RegExp, Number
  };
  vm.createContext(context);
  vm.runInContext(script, context, { filename: "Code.gs" });
  return { context, originalData, drData, ui, promptLog, menus, propertyValues, get writes() { return writes; }, get backupReads() { return backupReads; }, get lockAcquires() { return lockAcquires; } };
}

const expectedNewIds = [
  "radio-iiii-auto-v1-915a06b7", "radio-iiii-auto-v1-ad97bb06", "radio-iiii-auto-v1-f143ebcd",
  "bakspejl-auto-v1-4962cdc5", "djaevlen-auto-v1-1139735b"
];
const approved = makeHarness();
const originalArk1Rows = structuredClone(approved.originalData.slice(1));
const originalMacIasNotes = approved.drData.slice(-2).map((row) => row[STAGING_HEADERS.indexOf("DR source GUID")]);
approved.context.onOpen();
assert.ok(approved.menus.some((menu) => menu.name === "DR staging"), "existing DR staging menu remains");
assert.ok(approved.menus.some((menu) => menu.name === "Radio IIII staging"), "existing Radio IIII menu remains");
assert.ok(approved.menus.some((menu) => menu.entries.some((entry) => entry.label === "Gennemgå stagingforslag samlet" && entry.handler === "reviewAndAppendStagingBatch")));
approved.context.reviewAndAppendStagingBatch();
assert.equal(approved.promptLog.length, 1, "the five verified proposals require one batch confirmation");
assert.equal(approved.promptLog[0].title, "Gennemgå stagingforslag samlet");
assert.match(approved.promptLog[0].message, /Mattias Tesfaye \| radio-iiii-auto-v1-7f0dfeb9 \| verificeret i Ark1/u);
assert.match(approved.promptLog[0].message, /Marcos \| marcos \| verificeret i Ark1/u);
assert.match(approved.promptLog[0].message, /NEEDS_EDITORIAL_REVIEW/u);
assert.match(approved.promptLog[0].message, /Dræberurten[\s\S]*individuel redaktionel/u);
assert.match(approved.promptLog[0].message, /Macias[\s\S]*individuel redaktionel/u);
assert.match(approved.promptLog[0].message, /Kilde-GUID'er:/u);
assert.match(approved.promptLog[0].message, /https:\/\/radio4data\.imgix\.net\/2026\/10\/Birgitte-Kosovic_master_episode_thumbnail\.png/u);
assert.match(approved.promptLog[0].message, /https:\/\/www\.dr\.dk\/lyd\/special-radio\/bakspejl\/bakspejl-2026\/den-spanske-borgerkrig-1-3-11162611015/u);
assert.deepEqual(approved.originalData.slice(-5).map((row) => row[index("Podcast-ID")]).sort(), expectedNewIds.sort());
assert.equal(approved.originalData.length, 8, "five new records append after the protected identities");
assert.equal(approved.originalData[1][index("Podcast-ID")], "radio-iiii-auto-v1-7f0dfeb9", "Mattias is verified and never duplicated");
assert.equal(approved.originalData[2][index("Podcast-ID")], "marcos", "Marcos is verified and never duplicated");
assert.deepEqual(approved.originalData.slice(1, 3), originalArk1Rows, "existing IDs, covers, ratings and history remain byte-for-byte unchanged");
assert.deepEqual(approved.drData.slice(-2).map((row) => row[STAGING_HEADERS.indexOf("DR source GUID")]), originalMacIasNotes, "the two standalone Macias staging notes remain in place");
for (const row of approved.originalData.slice(-5)) {
  assert.ok(row[index("Link")]);
  assert.ok(row[index("Kilde")]);
  assert.ok(row[index("Billedlink")]);
  assert.equal(row[index("Vuring (1-10)")], "");
  assert.equal(row[index("Afgivet vurdering")], "");
}
const radioCovers = approved.originalData.slice(-5).filter((row) => row[index("Hovedserie")] === "Et kapitel for sig").map((row) => row[index("Billedlink")]);
assert.equal(new Set(radioCovers).size, 3, "the three Radio IIII guests retain distinct individual covers");
assert.equal(approved.lockAcquires, 1, "one document lock covers the whole batch");
assert.equal(approved.backupReads, 2, "one backup verification is checked twice around the batch, never once per row");
assert.equal(approved.propertyValues.get("APPEND_ENABLED"), "false", "the write gate closes automatically after success");
assert.equal(approved.writes, 5);
approved.propertyValues.set("APPEND_ENABLED", "true");
approved.context.reviewAndAppendStagingBatch();
assert.equal(approved.writes, 5, "a repeated fully verified batch does not duplicate any of the five guests");
assert.equal(approved.originalData.length, 8);

const futureDr = [...drRows[1]];
futureDr[index("Podcast-ID")] = "bakspejl-auto-v1-a1b2c3d4";
futureDr[index("Titel")] = "Fremtidig Bakspejl-historie";
futureDr[STAGING_HEADERS.indexOf("DR source GUID")] = "99162611015";
const futureDrUrl = "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/fremtidig-historie-99162611015";
futureDr[STAGING_HEADERS.indexOf("DR source URL")] = futureDrUrl;
futureDr[index("Link")] = futureDrUrl;
futureDr[index("Kilde")] = futureDrUrl;
futureDr[index("Billedlink")] = "https://api.dr.dk/podcasts/v1/images/urn:dr:podcast:image:abcdef1234567890.jpg";
const futureRadio = [...radioRows[2]];
futureRadio[index("Podcast-ID")] = "radio-iiii-auto-v1-badc0ffe";
futureRadio[index("Titel")] = "Fremtidig gæst";
const futureRadioUrl = "https://radio4.dk/podcasts/et-kapitel-for-sig/kapitel-1-fremtidig-gaest";
futureRadio[index("Link")] = futureRadioUrl;
futureRadio[index("Kilde")] = futureRadioUrl;
futureRadio[RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source URL")] = futureRadioUrl;
futureRadio[RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII season URL")] = "https://radio4.dk/podcasts/et-kapitel-for-sig?season=99";
futureRadio[index("Billedlink")] = "https://radio4data.imgix.net/2026/11/Fremtidig-gaest.png?width=1000&height=1000&fit=crop";
futureRadio[RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source GUIDs")] = [1, 2, 3, 4, 5].map((n) => `99999999-0000-4000-8000-00000000000${n}`).join(";");
futureRadio[index("Episoder")] = ["Prolog: Fremtidig gæst", "Kapitel 1", "Kapitel 2", "Kapitel 3", "Kapitel 4"].join("; ");
const future = makeHarness({ approval: "GODKEND BATCH 7", drStageRows: [...drRows, futureDr], radioStageRows: [...radioRows, futureRadio] });
future.context.reviewAndAppendStagingBatch();
assert.equal(future.originalData.length, 10, "new series guests with validated IDs and official sources join the shared workflow dynamically");
assert.ok(future.originalData.some((row) => row[index("Podcast-ID")] === "bakspejl-auto-v1-a1b2c3d4"));
assert.ok(future.originalData.some((row) => row[index("Podcast-ID")] === "radio-iiii-auto-v1-badc0ffe"));

const reviewedMacias = [...maciasRow];
reviewedMacias[STAGING_HEADERS.indexOf("Vært")] = "Per Lysholt";
reviewedMacias[index("Genre")] = "True Crime";
reviewedMacias[index("Emner")] = "Macias; Tyran";
reviewedMacias[STAGING_HEADERS.indexOf("Review status")] = "EDITORIALLY_APPROVED_SOURCE_VERIFIED";
const tyranApproval = makeHarness({ approval: "GODKEND BATCH 6", drStageRows: [...drRows.slice(0, 4), reviewedMacias] });
tyranApproval.context.reviewAndAppendStagingBatch();
if (!tyranApproval.originalData.some((row) => row[index("Podcast-ID")] === "tyran-auto-v1-08d0021f")) console.log(tyranApproval.ui.alerts);
assert.ok(tyranApproval.originalData.some((row) => row[index("Podcast-ID")] === "tyran-auto-v1-08d0021f"), "Tyran becomes eligible only after its individual review status and source-backed metadata are complete");
assert.equal(tyranApproval.writes, 6);

for (const options of [
  { approval: "", promptButton: "CANCEL" },
  { approval: "GODKEND BATCH 4" },
  { properties: { BACKUP_RESTORE_TEST_VERIFIED: "false" } },
  { properties: { BACKUP_VERIFIED_AT: new Date(Date.now() - 20 * 60 * 1000).toISOString() } },
  { properties: { BACKUP_SPREADSHEET_ID: "" } },
  { changeStagingOnPrompt: true }
]) {
  const blocked = makeHarness(options);
  blocked.context.reviewAndAppendStagingBatch();
  assert.equal(blocked.writes, 0, "missing approval, backup or unchanged staging blocks every write");
  assert.equal(blocked.originalData.length, 3);
  assert.equal(blocked.propertyValues.get("APPEND_ENABLED"), "false", "the write gate closes on cancellation and errors");
}

const noGate = makeHarness({ properties: { APPEND_ENABLED: "false" } });
noGate.context.reviewAndAppendStagingBatch();
assert.equal(noGate.writes, 0, "the production write gate must be enabled by the owner");
assert.equal(noGate.originalData.length, 3);

const duplicateIdRows = [...drRows, drRows[1]];
const duplicateId = makeHarness({ drStageRows: duplicateIdRows });
duplicateId.context.reviewAndAppendStagingBatch();
assert.equal(duplicateId.writes, 0, "duplicate staging IDs stop the batch before confirmation");

const foreignSource = Array(CATALOGUE_HEADERS.length).fill("");
foreignSource[index("Podcast-ID")] = "unrelated-existing-id";
foreignSource[index("Titel")] = "Unrelated existing row";
foreignSource[index("Kilde")] = "https://www.dr.dk/lyd/special-radio/bakspejl/bakspejl-2026/den-spanske-borgerkrig-1-3-11162611015";
const sourceCollision = makeHarness({ targetRows: [protectedMattiasRow(), protectedMarcosRow(), foreignSource] });
sourceCollision.context.reviewAndAppendStagingBatch();
assert.equal(sourceCollision.writes, 0, "a source URL collision stops before the aggregate confirmation");

const foreignCover = [...foreignSource];
foreignCover[index("Kilde")] = "https://example.invalid/unrelated";
foreignCover[index("Billedlink")] = "https://radio4data.imgix.net/2026/10/Birgitte-Kosovic_master_episode_thumbnail.png?width=1000&height=1000&fit=crop";
const coverCollision = makeHarness({ targetRows: [protectedMattiasRow(), protectedMarcosRow(), foreignCover] });
coverCollision.context.reviewAndAppendStagingBatch();
assert.equal(coverCollision.writes, 0, "a cover reused by an unrelated Ark1 identity stops before approval");

const duplicateRadioGuid = [...futureRadio];
duplicateRadioGuid[RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source GUIDs")] =
  radioRows[2][RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source GUIDs")].split(";")[0] + ";" + duplicateRadioGuid[RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source GUIDs")].split(";").slice(1).join(";");
const guidCollision = makeHarness({ approval: "GODKEND BATCH 6", radioStageRows: [...radioRows, duplicateRadioGuid] });
guidCollision.context.reviewAndAppendStagingBatch();
assert.equal(guidCollision.writes, 0, "overlapping episode GUIDs stop before the first write");

const existingOne = targetRow({
  "Podcast-ID": "radio-iiii-auto-v1-915a06b7", Titel: "Birgithe Kosovic", "Hovedserie": "Et kapitel for sig",
  "Vært": "Anne Sofie Kragh", Udgiver: "RADIO IIII", Genre: "Samfund", "Antal afsnit": "5",
  Link: radio.records[1].source_url, Kilde: radio.records[1].source_url, Billedlink: radio.records[1].image_url,
  Episoder: radio.records[1].manual_episodes.join("; ")
});
const idempotent = makeHarness({ approval: "GODKEND BATCH 4", targetRows: [protectedMattiasRow(), protectedMarcosRow(), existingOne] });
idempotent.context.reviewAndAppendStagingBatch();
assert.equal(idempotent.originalData.length, 8, "an exact already-existing proposal is skipped while the other four append");
assert.equal(idempotent.originalData.filter((row) => row[index("Podcast-ID")] === "radio-iiii-auto-v1-915a06b7").length, 1);

const partial = makeHarness({ failWrite: 3 });
partial.context.reviewAndAppendStagingBatch();
assert.equal(partial.writes, 3, "batch stops at the first failed write without retrying");
assert.equal(partial.originalData.length, 5, "only the two completed rows remain after third-write failure");
assert.match(partial.ui.alerts.at(-1), /Tilføjet og verificeret:[\s\S]*Ikke forsøgt:[\s\S]*Ingen automatisk retry/u);
assert.equal(partial.propertyValues.get("APPEND_ENABLED"), "false");

const committedTimeout = makeHarness({ failWrite: "after-first" });
committedTimeout.context.reviewAndAppendStagingBatch();
assert.equal(committedTimeout.originalData.length, 4, "a timeout-after-commit is recognized only through readback");
assert.match(committedTimeout.ui.alerts.at(-1), /Readback bekræfter at rækken blev skrevet/u);
assert.equal(committedTimeout.propertyValues.get("APPEND_ENABLED"), "false");

const changedMidBatch = makeHarness({ changeStagingAfterFirstWrite: true });
changedMidBatch.context.reviewAndAppendStagingBatch();
assert.equal(changedMidBatch.writes, 1, "a staging edit after the first write stops all remaining writes");
assert.match(changedMidBatch.ui.alerts.at(-1), /Staging ændrede sig under batchen/u);
assert.equal(changedMidBatch.propertyValues.get("APPEND_ENABLED"), "false");

console.log("Unified owner staging gate tests passed: four series, five verified proposals, protected identities, editorial review exclusions, one backup and lock per batch, source/GUID/cover checks, notes preservation, partial-write recovery, idempotency and automatic gate closure.");
