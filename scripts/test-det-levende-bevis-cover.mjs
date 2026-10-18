import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const podcastPayload = JSON.parse(await readFile(new URL("data/podcasts.json", root), "utf8"));
const manifestPayload = JSON.parse(await readFile(new URL("data/podcast-cover-manifest.json", root), "utf8"));
const rows = podcastPayload.rows || [];
const entries = manifestPayload.podcasts || [];
const drCover = "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6926eb04f813fbba9054e2aa?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29";
const stableKey = "det-levende-bevis-4f6d5ab6c4";
const oldPaths = [
  `assets/podcast-covers/manual-originals/${stableKey}.png`,
  `data/covers/original/${stableKey}.png`,
  `data/covers/480/${stableKey}.webp`,
  `data/covers/800/${stableKey}.webp`,
  `data/covers/1400/${stableKey}.webp`
];

const podcast = rows.find((row) => row["Podcast-ID"] === "det levende bevis");
assert.ok(podcast, "canonical podcast ID must exist");
assert.equal(podcast.Titel, "Det levende bevis");
assert.equal(podcast["Vært"], "Frederik Hugo Ledegaard Thim");
assert.equal(podcast.Udgiver, "DR");
assert.equal(podcast.Billedlink, drCover, "the DR cover remains the direct external image source");

assert.equal(entries.some((entry) => entry.stableKey === stableKey), false, "old manual override must not resolve");
assert.equal(
  entries.some((entry) => entry.title === podcast.Titel && entry.host === podcast["Vært"] && entry.publisher === podcast.Udgiver),
  false,
  "no local manifest entry may match this podcast by identity"
);
for (const entry of entries) {
  for (const oldPath of oldPaths) {
    assert.notEqual(entry.originalImageUrl, oldPath, `manifest must not reference ${oldPath}`);
    assert.notEqual(entry.manualSourcePath, oldPath, `manifest must not reference ${oldPath}`);
    assert.equal(Object.values(entry.variants || {}).some((variant) => variant.path === oldPath), false);
  }
}
for (const oldPath of oldPaths) {
  await assert.rejects(access(new URL(oldPath, root)), { code: "ENOENT" }, `${oldPath} must be removed`);
}

const denLevende = rows.find((row) => row["Podcast-ID"] === "den levende");
assert.ok(denLevende, "Den levende must remain in the catalogue");
assert.equal(denLevende.Titel, "Den levende");
assert.equal(denLevende["Vært"], "Lotte Folke & Eva Eistrup");
assert.equal(denLevende.Udgiver, "Politiken");
const denLevendeCover = entries.find((entry) => entry.stableKey === "den-levende-e0c5866181");
assert.ok(denLevendeCover, "Den levende's separate local cover entry must remain");
assert.equal(denLevendeCover.title, "Den levende");
assert.equal(denLevendeCover.manualOverride, true);
assert.equal(denLevendeCover.manualSourcePath, "assets/podcast-covers/manual-originals/den-levende-e0c5866181.jpg");

console.log("Det levende bevis uses its DR cover; stale variants are absent; Den levende is preserved.");
