import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

function extract(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const context = {
  Object,
  Array,
  Set,
  state: { coverMetaByPrimarySrc: {} },
  normalizeText: (value) => String(value ?? "").trim(),
  normalizeImageSource: (value) => String(value ?? "").trim(),
  getPodcastId: (podcast) => String(podcast?.podcastId ?? "").trim(),
  getLegacyPodcastKey: (podcast) => String(podcast?.legacyKey ?? "").trim(),
  getCoverManifestSignature: () => "",
  getManifestVariantEntries: (entry) => Object.values(entry?.variants || {})
    .map((variant) => ({ path: String(variant.path || ""), width: Number(variant.actualWidth || variant.width || 0) }))
    .filter((variant) => variant.path && variant.width)
    .sort((left, right) => left.width - right.width)
};
context.globalThis = context;
vm.runInNewContext(`${extract("applyLocalCoverManifest")}\n${extract("getPodcastImageSources")}`, context);

const variants = {
  "480": { path: "data/covers/480/current.webp", width: 480 },
  "800": { path: "data/covers/800/current.webp", width: 800 }
};
const resolve = ({ image = "https://example.test/current.jpg", imageFallbacks = ["https://example.test/fallback.jpg"], originalImageUrl = "https://example.test/current.jpg", ...entryPatch } = {}) => {
  const podcast = { podcastId: "podcast-id", legacyKey: "podcast", image, imageFallbacks };
  context.applyLocalCoverManifest([podcast], { byPodcastId: { "podcast-id": { variants, originalImageUrl, ...entryPatch } } });
  return { podcast, sources: Array.from(context.getPodcastImageSources(podcast)) };
};

const tipsbladetSources = Array.from(context.getPodcastImageSources({ podcastId: "transferguru tipsbladet", image: "https://example.test/old-transferguru.jpg", imageFallbacks: [] }));
assert.deepEqual(tipsbladetSources, ["assets/podcast-covers/manual-originals/series/transferguru_tipsbladet.webp"], "new Tipsbladet identity uses its own local TG artwork");
const podimoSources = Array.from(context.getPodcastImageSources({ podcastId: "transferguru", image: "https://example.test/podimo.jpg", imageFallbacks: [] }));
assert.deepEqual(podimoSources, ["https://example.test/podimo.jpg"], "historical Podimo artwork remains untouched");
const realCoverBytes = await readFile(new URL("../assets/podcast-covers/manual-originals/series/transferguru_tipsbladet.webp", import.meta.url));
assert.equal(realCoverBytes.subarray(0, 4).toString(), "RIFF", "new cover must exist as a WebP image");

let result = resolve();
assert.equal(result.podcast.preferExternalCoverSource, false, "current automatic local covers stay local-first");
assert.deepEqual(result.sources.slice(0, 2), [variants["480"].path, variants["800"].path]);

result = resolve({ originalImageUrl: "https://example.test/old.jpg" });
assert.equal(result.podcast.preferExternalCoverSource, true, "stale automatic local covers prefer the current Sheet image");
assert.deepEqual(result.sources, ["https://example.test/current.jpg", "https://example.test/fallback.jpg", variants["480"].path, variants["800"].path]);

result = resolve({ originalImageUrl: "https://example.test/old.jpg", manualOverride: true });
assert.equal(result.podcast.preferExternalCoverSource, false, "manual overrides remain local-first");
assert.equal(result.sources[0], variants["480"].path);

result = resolve({ originalImageUrl: "https://example.test/old.jpg", sourceKind: "manual" });
assert.equal(result.podcast.preferExternalCoverSource, false, "manual sourceKind remains protected");
assert.equal(result.sources[0], variants["480"].path);

result = resolve({
  originalImageUrl: "https://example.test/old.jpg",
  sourceKind: "manual-series",
  manualSeriesOverride: true
});
assert.equal(result.podcast.preferExternalCoverSource, false, "manual series overrides remain local-first");
assert.equal(result.sources[0], variants["480"].path);

result = resolve({ originalImageUrl: "" });
assert.equal(result.podcast.preferExternalCoverSource, false, "missing comparison metadata preserves local-first behavior");

const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const manifest = JSON.parse(await readFile(new URL("../data/podcast-cover-manifest.json", import.meta.url), "utf8"));
const mediano = (payload.rows || []).find((row) => row["Podcast-ID"] === "mediano superliga");
const medianoEntry = (manifest.podcasts || []).find((entry) => entry.stableKey === "mediano-superliga-c5a5aa1ea6");
assert.ok(mediano && medianoEntry, "Mediano Superliga source data must exist");
const currentMediano = resolve({ image: mediano.Billedlink, imageFallbacks: [], ...medianoEntry });
assert.equal(currentMediano.podcast.preferExternalCoverSource, true, "Mediano Superliga's changed Sheet image is external-first");
assert.equal(currentMediano.sources[0], mediano.Billedlink);

assert.match(app, /manualSeriesOverride === true/u);
assert.match(app, /sourceKind === "manual-series"/u);
assert.match(app, /podcast\.preferExternalCoverSource/u);
assert.match(app, /if \(!responsiveMeta && index === 0\)/u, "external-first covers must not receive a local srcset");
console.log("Cover source freshness regression checks passed.");
