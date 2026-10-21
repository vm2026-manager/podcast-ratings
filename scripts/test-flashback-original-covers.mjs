import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import vm from "node:vm";

const files = [
  ["tsunamien i 2004", "flashback_tsunamien_i_2004.jpg", "9da1a4c658e0580bedf6640692b76f31c8dbe5d62293f73069134502a62cfa10", 532199],
  ["em i 1992", "flashback_em_i_1992.jpg", "a7635b21fa57b5e6fe13dbc067b6af0648e0189781d523b92581dd307213358f", 489951]
];
const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const mapStart = app.indexOf("const FLASHBACK_UPLOADED_COVER_BY_ID = Object.freeze({");
const mapEnd = app.indexOf("});", mapStart);
const getterStart = app.indexOf("function getPodcastImageSources(podcast) {");
const getterEnd = app.indexOf("\nfunction getPodcastCoverRevision(", getterStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart && getterStart >= 0 && getterEnd > getterStart);
const context = {
  getPodcastId: (podcast) => String(podcast?.podcastId ?? "").trim(),
  normalizeText: (value) => String(value ?? "").trim(),
  TYRAN_OFFICIAL_SQUARE_IMAGE_IDS: {}
};
context.globalThis = context;
vm.runInNewContext(`${app.slice(mapStart, mapEnd + 3)}\n${app.slice(getterStart, getterEnd)}\nglobalThis.getSources = getPodcastImageSources; globalThis.flashbackCovers = FLASHBACK_UPLOADED_COVER_BY_ID;`, context);
assert.equal(Object.keys(context.flashbackCovers).length, 2);
for (const [id, filename, expectedHash, expectedSize] of files) {
  const path = `assets/podcast-covers/manual-originals/series/${filename}`;
  const bytes = readFileSync(new URL(`../${path}`, import.meta.url));
  assert.equal(bytes.length, expectedSize, `Original JPEG size changed for ${id}`);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), expectedHash, `Original JPEG changed for ${id}`);
  assert.equal(context.flashbackCovers[id], path);
  const sources = Array.from(context.getSources({ podcastId: id, image: "https://example.test/generic.jpg", localCoverVariants: [] }));
  assert.deepEqual(sources, [path], `Exact ID must use its own user-supplied original: ${id}`);
}
for (const id of ["flashback politiken", "tsunamien i 2004 ekstra", "em i 1992 special", "transferguru"]) {
  const original = "https://example.test/original.jpg";
  assert.deepEqual(Array.from(context.getSources({ podcastId: id, image: original, imageFallbacks: [], localCoverVariants: [] })), [original], `Unrelated podcast cover changed: ${id}`);
}
console.log("Flashback original JPEG bytes and both mobile/desktop shared cover sources PASS.");
