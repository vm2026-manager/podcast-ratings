import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const patchPath = new URL("./apply-podcast-similarity-sheet-patch-2026-10-25.gs", import.meta.url);
const source = fs.readFileSync(patchPath, "utf8");

function makeSpreadsheet({ conflictPodcastId = "", duplicatePodcastId = "" } = {}) {
  const patchStart = source.indexOf("const PODCAST_SIMILARITY_PATCH_20261025 = ") +
    "const PODCAST_SIMILARITY_PATCH_20261025 = ".length;
  const patchEnd = source.indexOf("function applyPodcastSimilarityPatch20261025", patchStart);
  const patch = JSON.parse(source.slice(patchStart, patchEnd).trim().replace(/;[\r\n]*$/u, ""));
  const rowCount = Math.max(...patch.map((item) => item.sourceRow));
  const values = Array.from({ length: rowCount }, () => Array(22).fill(""));
  for (const item of patch) {
    values[item.sourceRow - 1][19] = item.before;
    values[item.sourceRow - 1][21] = item.podcastId;
  }
  if (conflictPodcastId) {
    const edit = patch.find((item) => item.podcastId === conflictPodcastId);
    values[edit.sourceRow - 1][19] = "concurrent editorial update";
  }
  if (duplicatePodcastId) {
    const edit = patch.find((item) => item.podcastId === duplicatePodcastId);
    values.push(Array(22).fill(""));
    values.at(-1)[21] = edit.podcastId;
    values.at(-1)[19] = edit.before;
  }

  const writes = [];
  const sheets = new Map();
  const ark1 = {
    getLastRow: () => values.length,
    getRange(row, column, rowCount = 1, columnCount = 1) {
      return {
        getDisplayValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: columnCount }, (_, columnOffset) =>
            String(values[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? "")
          )
        ),
        getValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
          Array.from({ length: columnCount }, (_, columnOffset) =>
            values[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ""
          )
        ),
        setValue(value) {
          writes.push({ row, column, value });
          values[row - 1][column - 1] = value;
        },
        setValues(rows) {
          rows.forEach((line, rowOffset) => line.forEach((value, columnOffset) => {
            writes.push({ row: row + rowOffset, column: column + columnOffset, value });
          }));
        }
      };
    }
  };
  sheets.set("Ark1", ark1);
  const spreadsheet = {
    getSheetByName: (name) => sheets.get(name) || null,
    insertSheet(name) {
      const backup = { name, getRange: ark1.getRange };
      sheets.set(name, backup);
      return backup;
    },
    getSheetNames: () => [...sheets.keys()]
  };
  const context = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => spreadsheet,
      flush() {}
    }
  });
  vm.runInContext(source, context);
  return { context, patch, spreadsheet, writes, values };
}

const applied = makeSpreadsheet();
const result = applied.context.applyPodcastSimilarityPatch20261025();
assert.equal(applied.patch.length, 43);
assert.equal(result.status, "applied");
assert.equal(result.changed, 43);
assert.ok(applied.spreadsheet.getSheetByName(result.backupSheet));
assert.equal(applied.writes.filter((write) => write.column === 20).length, 43);
assert.ok(applied.writes.every((write) => write.column === 20 || write.column <= 5),
  "the patch writes only backup columns and Ark1 column T");
assert.equal(applied.writes.filter((write) => write.column === 22).length, 0,
  "Podcast-ID is read-only");
assert.equal(applied.context.applyPodcastSimilarityPatch20261025().status, "already_applied",
  "rerunning is idempotent");
assert.equal(applied.writes.filter((write) => write.column === 20).length, 43,
  "an idempotent run does not write the sheet again");

const byId = new Map(applied.patch.map((edit) => [edit.podcastId, edit]));
const approvedPairs = [
  ["candace", "the ben shapiro show"],
  ["menneskedyret", "dagmar overby"],
  ["øverste hylde", "dkpol"],
  ["charles manson det glemte mord", "manson familien"],
  ["ny afslørende virginia giuffre bog", "efter epstein filerne"],
  ["den charmerende bedrager", "svindlerne"],
  ["smat brændbart", "ugens krise"],
  ["kvinden med den tunge kuffert det sidste kapitel", "victor lustig"],
  ["charles manson", "manson familien"],
  ["dkpol", "borgen unplugged 2 0"],
  ["under gulvtæppet", "dkpol"],
  ["marathonmanden", "man kan aldrig vide"],
  ["espn laliga espn dk", "mediano la liga"],
  ["man kan aldrig vide", "victor lustig"],
  ["borgen unplugged 2 0", "øverste hylde"],
  ["fra fodboldstjerne til narkohaj", "pusheren fra provinsen"],
  ["p1 morgen", "24syv morgen"]
];
assert.equal(approvedPairs.length, 17);
for (const [sourceId, targetId] of approvedPairs) {
  const changedReferences = byId.get(sourceId).after.split(";").map((value) => value.trim());
  assert.ok(changedReferences.includes(targetId), `${sourceId} points to canonical target ${targetId}`);
}
const removedNarkobetjentenReferences = applied.patch.reduce((total, edit) => {
  const before = new Set(edit.before.split(";").map((value) => value.trim()).filter(Boolean));
  const after = new Set(edit.after.split(";").map((value) => value.trim()).filter(Boolean));
  return total + [...before].filter((value) =>
    /^(?:narkobetjenten sæson |narkobetjenten og den kriminelle underverden sæson )/u.test(value) &&
    !after.has(value)
  ).length;
}, 0);
assert.equal(removedNarkobetjentenReferences, 55);

for (const setup of [
  { conflictPodcastId: "candace" },
  { duplicatePodcastId: "candace" }
]) {
  const blocked = makeSpreadsheet(setup);
  assert.throws(() => blocked.context.applyPodcastSimilarityPatch20261025(), /Preflight conflict/u);
  assert.equal(blocked.writes.length, 0, "a conflict aborts before backup or Sheet writes");
  assert.equal(blocked.spreadsheet.getSheetNames().length, 1,
    "a conflict does not create a backup sheet or write anything");
}

console.log("Podcast similarity one-time Sheet patch tests passed.");
