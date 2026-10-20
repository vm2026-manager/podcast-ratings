import assert from "node:assert/strict";
import { applyEditorialAccessMetadata, mapAccessType, validateAccessEvidenceUrl } from "./sync-sheet-data.mjs";

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


const invalidEvidenceWarnings = [];
console.warn = (message) => invalidEvidenceWarnings.push(message);
try {
  assert.equal(validateAccessEvidenceUrl("https://radio4.dk/podcasts/fjerde-oplag", "Fjerde oplag"), "https://radio4.dk/podcasts/fjerde-oplag");
  assert.equal(validateAccessEvidenceUrl("Radio IIII; Apple Podcasts; RSS", "Fjerde oplag"), "");
  assert.equal(validateAccessEvidenceUrl("javascript:alert(1)", "Anden podcast"), "");

  const podcast = { Titel: "Fjerde oplag" };
  applyEditorialAccessMetadata(podcast, {
    Adgang: "Gratis",
    Kilde: "Radio IIII; Apple Podcasts; RSS",
    "Tjekket dato": "2026-10-16"
  }, "Fjerde oplag");
  assert.equal(podcast.accessType, "free", "invalid evidence must not remove the podcast");
  assert.equal(podcast.accessEvidenceUrl, undefined, "never publish unvalidated source URLs");
  assert.equal(podcast.accessCheckedAt, "2026-10-16", "valid metadata must still be retained");
} finally {
  console.warn = originalWarn;
}

assert.equal(invalidEvidenceWarnings.length, 3, "each invalid evidence field emits a warning");
assert.ok(invalidEvidenceWarnings.every((message) => message.includes("Ignorerer kildefeltet")));


const flashbackWarnings = [];
console.warn = (message) => flashbackWarnings.push(message);
try {
  const em1992 = { Titel: "EM i 1992" };
  applyEditorialAccessMetadata(em1992, {
    Adgang: "Betaling",
    Kilde: "Politiken / Apple Podcasts",
    "Tjekket dato": "20-10-2026"
  }, "EM i 1992");
  assert.equal(em1992.accessType, "paid");
  assert.equal(em1992.accessEvidenceUrl, undefined);
  assert.equal(em1992.accessCheckedAt, "2026-10-20");
  assert.throws(() => applyEditorialAccessMetadata({}, { "Tjekket dato": "31-02-2026" }, "Ugyldig dato"), /gyldig dato/);
  assert.throws(() => applyEditorialAccessMetadata({}, { "Tjekket dato": "2026-02-29" }, "Ugyldig dato"), /gyldig dato/);
  assert.throws(() => applyEditorialAccessMetadata({}, { "Tjekket dato": "20/10/2026" }, "Ugyldigt format"), /formatet/);
} finally {
  console.warn = originalWarn;
}
assert.equal(flashbackWarnings.length, 2);
assert.ok(flashbackWarnings.some((message) => message.includes("Normaliserer Tjekket dato")));
assert.ok(flashbackWarnings.some((message) => message.includes("Ignorerer kildefeltet")));

console.log("Sheet access mapping tests passed.");
