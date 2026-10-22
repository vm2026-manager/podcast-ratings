import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const coverPath = "assets/podcast-covers/manual-originals/series/de_efterladte.png";
const bytes = readFileSync(new URL(`../${coverPath}`, import.meta.url));
assert.equal(createHash("sha256").update(bytes).digest("hex"), "1089c01d681926f15cd69c3b6685bcec2731b75b758bd1dc4b11c3826adb9d44");
assert.equal(bytes.toString("ascii", 1, 4), "PNG");
assert.equal(bytes.readUInt32BE(16), 1400, "Original cover width");
assert.equal(bytes.readUInt32BE(20), 1400, "Original cover height");

const catalogue = JSON.parse(readFileSync(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const row = catalogue.rows.find((candidate) => candidate["Podcast-ID"] === "de efterladte");
assert.ok(row, "Canonical podcast row remains present");
assert.equal(row.Billedlink, "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6926eb124f22de874eb4a967");

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const getterStart = app.indexOf("function getPodcastImageSources(podcast) {");
const getterEnd = app.indexOf("\nfunction getPodcastCoverRevision(", getterStart);
assert.ok(getterStart >= 0 && getterEnd > getterStart, "Cover source resolver is present");
const context = {
  getPodcastId: (podcast) => String(podcast?.podcastId ?? "").trim(),
  normalizeText: (value) => String(value ?? "").trim(),
  TYRAN_OFFICIAL_SQUARE_IMAGE_IDS: {}
};
vm.runInNewContext(`${app.slice(getterStart, getterEnd)}\nglobalThis.getSources = getPodcastImageSources;`, context);
const desktopAndMobileSources = Array.from(context.getSources({
  podcastId: "de efterladte",
  image: row.Billedlink,
  localCoverVariants: []
}));
assert.deepEqual(desktopAndMobileSources, [coverPath], "Shared desktop/mobile resolver prioritizes supplied original");
assert.deepEqual(Array.from(context.getSources({
  podcastId: "another podcast",
  image: "https://example.test/unchanged.jpg",
  localCoverVariants: []
})), ["https://example.test/unchanged.jpg"], "Other podcast keeps its existing source");
console.log("De efterladte exact-ID cover source, 1400x1400 original, shared desktop/mobile path, and unrelated-podcast negative control PASS.");
