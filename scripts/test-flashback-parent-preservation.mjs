import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { preserveFlashbackParentIdentity } from "./sync-sheet-data.mjs";

const previous = JSON.parse(readFileSync(new URL("../data/podcasts.json", import.meta.url), "utf8")).rows;
const parent = previous.find((row) => row["Podcast-ID"] === "flashback politiken");
assert.ok(parent && parent.Titel === "Flashback" && parent.Udgiver === "Politiken" && parent.catalogue_id);
const children = [
  { "Podcast-ID": "tsunamien i 2004", Titel: "Tsunamien i 2004", Hovedserie: "Flashback" },
  { "Podcast-ID": "em i 1992", Titel: "EM i 1992", Hovedserie: "Flashback" }
];
const other = { "Podcast-ID": "unrelated", Titel: "Unrelated" };
const before = JSON.stringify(previous);
const savedWarnings = [];
const savedWarn = console.warn;
console.warn = (message) => savedWarnings.push(message);
let restored;
try {
  restored = preserveFlashbackParentIdentity([...children, other], previous);
} finally {
  console.warn = savedWarn;
}
assert.equal(restored.length, 4);
assert.strictEqual(restored[3], parent, "Must restore the exact, unchanged existing row");
assert.strictEqual(restored[2], other, "Unrelated podcast identity unchanged");
assert.equal(restored.filter((r) => r["Podcast-ID"] === "flashback politiken").length, 1);
assert.ok(savedWarnings.length === 1 && savedWarnings[0].includes("flashback politiken"));
assert.equal(JSON.stringify(previous), before, "Must never mutate original parent or other catalogue records");
const alreadyPresent = [...children, parent];
assert.strictEqual(preserveFlashbackParentIdentity(alreadyPresent, previous), alreadyPresent, "Sheet master wins when parent restored");
const missingChild = [children[0], other];
assert.strictEqual(preserveFlashbackParentIdentity(missingChild, previous), missingChild, "Do not bypass gate for unrelated missing rows");
assert.throws(() => preserveFlashbackParentIdentity(children, []), /eksakte Flashback-moderidentitet/);
assert.throws(() => preserveFlashbackParentIdentity(children, [parent, parent]), /eksakte Flashback-moderidentitet/);
assert.throws(() => preserveFlashbackParentIdentity(children, [{ ...parent, Udgiver: "Forkert" }]), /eksakte Flashback-moderidentitet/);
console.log("Original Flashback parent identity and other catalogue rows remain intact.");
