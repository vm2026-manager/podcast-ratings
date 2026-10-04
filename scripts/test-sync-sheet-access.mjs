import assert from "node:assert/strict";
import { mapAccessType } from "./sync-sheet-data.mjs";

assert.equal(mapAccessType(""), "free", "blank access defaults to free");
assert.equal(mapAccessType("Gratis"), "free");
assert.equal(mapAccessType("Delvist"), "paid");
assert.equal(mapAccessType("Betalt"), "paid");
assert.equal(mapAccessType("Betaling"), "paid");

const warnings = [];
const originalWarn = console.warn;
console.warn = (message) => warnings.push(message);
try {
  assert.doesNotThrow(() => mapAccessType("fremtidig adgangstype", "Eksempel"));
  assert.equal(mapAccessType("fremtidig adgangstype", "Eksempel"), "free");
} finally {
  console.warn = originalWarn;
}

assert.equal(warnings.length, 2, "each unknown non-empty value warns without failing");
assert.ok(warnings.every((message) => message.includes("Ukendt værdi i Adgang")));

console.log("Sheet access mapping tests passed.");
