import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const catalogue = JSON.parse(readFileSync(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const records = (catalogue.rows || []).filter((row) => row.Hovedserie === "Tyran");
assert.equal(records.length, 22, "Tyran must have exactly 22 pre-existing catalogue identities");
assert.equal(new Set(records.map((row) => row["Podcast-ID"])).size, records.length);

const mapStart = app.indexOf("const TYRAN_OFFICIAL_SQUARE_IMAGE_IDS = Object.freeze({");
const mapEnd = app.indexOf("});", mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, "Official DR series map must exist");
const functionStart = app.indexOf("function getPodcastImageSources(podcast) {");
const functionEnd = app.indexOf("\nfunction getPodcastCoverRevision(", functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart);
const mapCode = app.slice(mapStart, mapEnd + 3);
const getterCode = app.slice(functionStart, functionEnd);
const context = { Set, Array, Object, String,
  normalizeText: (value) => String(value ?? "").trim(),
  getPodcastId: (podcast) => String(podcast?.podcastId ?? "").trim()
};
context.globalThis = context;
vm.runInNewContext(`${mapCode}\n${getterCode}\nglobalThis.getSources = getPodcastImageSources;\nglobalThis.getTyranMap = () => TYRAN_OFFICIAL_SQUARE_IMAGE_IDS;`, context);
const lookup = context.getTyranMap();
const ids = records.map((row) => row["Podcast-ID"]);
assert.deepEqual([...Object.keys(lookup)].sort(), [...ids].sort(), "No new, missing, or renamed podcast IDs");
assert.equal(new Set(Object.values(lookup)).size, 22, "Every Tyran series must use a distinct official image ID");

for (const row of records) {
  const id = row["Podcast-ID"];
  const oldUrl = row.Billedlink;
  const podcast = {
    podcastId: id, image: oldUrl, imageFallbacks: [],
    localCoverVariants: [{ path: `data/covers/480/${id}.webp` }],
    preferExternalCoverSource: false
  };
  const sources = Array.from(context.getSources(podcast));
  assert.match(sources[0], /^https:\/\/asset\.dr\.dk\/drlyd\/images\/urn:dr:radio:image:[0-9a-f]{24}\?im=AspectCrop%3D%28720%2C720%29/u);
  assert.ok(sources[0].includes(lookup[id]), `Wrong cover for canonical ID ${id}`);
  assert.ok(sources.includes(oldUrl), `Old image fallback must survive for ${id}`);
  assert.ok(sources.some((s) => s.startsWith("data/covers/480/")), `Local fallback lost for ${id}`);
}

// Changes must not spill over to a similarly named non-Tyran podcast.
const unrelated = { podcastId: "tyran unrelated", image: "https://example.test/unchanged.jpg", localCoverVariants: [], imageFallbacks: [], preferExternalCoverSource: false };
assert.deepEqual(Array.from(context.getSources(unrelated)), [unrelated.image]);
const historicalTransferguru = { podcastId: "transferguru", image: "https://example.test/podimo.jpg", localCoverVariants: [], imageFallbacks: [] };
assert.deepEqual(Array.from(context.getSources(historicalTransferguru)), [historicalTransferguru.image]);
assert.deepEqual(Array.from(context.getSources({ podcastId: "transferguru tipsbladet" })),
  ["assets/podcast-covers/manual-originals/series/transferguru_tipsbladet.webp"]);
assert.deepEqual(Array.from(context.getSources({ podcastId: "svindlerne" })),
  ["assets/podcast-covers/manual-originals/series/svindlerne_podimo_saeson_1.webp"]);

console.log("All 22 DR Tyran official square-image identities and existing cover fallbacks PASS; shared getter covers mobile and desktop.");
