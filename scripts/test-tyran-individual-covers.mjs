import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const index = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const catalogue = JSON.parse(readFileSync(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const registry = JSON.parse(readFileSync(new URL("../data/auto-discovered-tyran.json", import.meta.url), "utf8"));
const records = (catalogue.rows || []).filter((row) => row.Hovedserie === "Tyran");
assert.equal(new Set(records.map((row) => row["Podcast-ID"])).size, records.length);
const protectedCatalogueIdentities = {
  "saddam hussein": "catalogue-v1-fde8912e",
  "leopold ii": "catalogue-v1-c76dbecf",
  "enver hoxha": "catalogue-v1-fed4a9e5",
  "mao": "catalogue-v1-5e525cad",
  "muammar gaddafi": "catalogue-v1-a5e50793",
  "charles taylor": "catalogue-v1-2ce55da2",
  "ayatollah khomeini": "catalogue-v1-ff1b1dd6",
  "ceausescu": "catalogue-v1-bd3ff358",
  "trujillo": "catalogue-v1-803ff6fc",
  "bokassa": "catalogue-v1-e05ec4b9",
  "franco": "catalogue-v1-6a3b43d4",
  "nijasov": "catalogue-v1-93b3ebd1",
  "milosevic": "catalogue-v1-1ec85fb0",
  "hirohito": "catalogue-v1-f7a562e5",
  "pinochet": "catalogue-v1-feeccc49",
  "lenin": "catalogue-v1-06a51a41",
  "kim il sung og kim jong il": "catalogue-v1-d80ed822",
  "suharto": "catalogue-v1-49ea605b",
  "papa doc": "catalogue-v1-8ff881d1",
  "benito mussolini": "catalogue-v1-42809b2d",
  "pol pot": "catalogue-v1-714cb9c5",
  "idi amin": "catalogue-v1-788e148d",
  "marcos": "catalogue-v1-cccc548b",
  "tyran-auto-v1-08d0021f": "catalogue-v1-862a660c"
};
assert.equal(records.length, 24, "The 22 reviewed Tyran identities plus Marcos and Macias must remain in the catalogue");
assert.deepEqual(Object.fromEntries(records.map((row) => [row["Podcast-ID"], row.catalogue_id]).sort(([left], [right]) => left.localeCompare(right))),
  protectedCatalogueIdentities, "Every Tyran Podcast-ID must retain its exact catalogue_id");
assert.match(index, /app\.js\?v=20261111-issue87-leopold-cover-fallback/u, "The app script cache key must change with the fallback code");

const mapStart = app.indexOf("const TYRAN_OFFICIAL_SQUARE_IMAGE_IDS = Object.freeze({");
const mapEnd = app.indexOf("});", mapStart);
assert.ok(mapStart >= 0 && mapEnd > mapStart, "Official DR series map must exist");
const fallbackMapStart = app.indexOf("const TYRAN_OFFICIAL_SQUARE_IMAGE_FALLBACKS = Object.freeze({");
const fallbackMapEnd = app.indexOf("});", fallbackMapStart);
assert.ok(fallbackMapStart >= 0 && fallbackMapEnd > fallbackMapStart, "Verified DR image fallbacks must exist");
const functionStart = app.indexOf("function getPodcastImageSources(podcast) {");
const functionEnd = app.indexOf("\nfunction getPodcastCoverRevision(", functionStart);
assert.ok(functionStart >= 0 && functionEnd > functionStart);
const mapCode = app.slice(mapStart, mapEnd + 3);
const fallbackMapCode = app.slice(fallbackMapStart, fallbackMapEnd + 3);
const getterCode = app.slice(functionStart, functionEnd);
const context = { Set, Array, Object, String,
  normalizeText: (value) => String(value ?? "").trim(),
  getPodcastId: (podcast) => String(podcast?.podcastId ?? "").trim()
};
context.globalThis = context;
vm.runInNewContext(`${mapCode}\n${fallbackMapCode}\n${getterCode}\nglobalThis.getSources = getPodcastImageSources;\nglobalThis.getTyranMap = () => TYRAN_OFFICIAL_SQUARE_IMAGE_IDS;\nglobalThis.getTyranFallbacks = () => TYRAN_OFFICIAL_SQUARE_IMAGE_FALLBACKS;`, context);
const lookup = context.getTyranMap();
const fallbacks = context.getTyranFallbacks();
const registeredImageIds = {
  macias: "6a4e30ea60319a54701828b9",
  marcos: "6ad8a63dd1248e67782813bf"
};
const expectedImageIds = {
  "ayatollah khomeini": "696f3b31753c04e7ed879d0b",
  "benito mussolini": "689097bbab10e7b0b6977e33",
  "bokassa": "68944676de2818e2a02f4bdf",
  "ceausescu": "69205604a90450d1bd85ffe7",
  "charles taylor": "69b27b8d2b11372a7da944f6",
  "enver hoxha": "69d8daa9fb001330decce834",
  "franco": "6890920cab10e7b0b6975544",
  "hirohito": "6890922a2e199a1c531f835c",
  "idi amin": "68909215ab10e7b0b69756c7",
  "kim il sung og kim jong il": "689092222e199a1c531f82a9",
  "lenin": "68909209ab10e7b0b697551a",
  "leopold ii": "6a96ae037472ce653345f984",
  "mao": "68bed3d32b60b4c321271a43",
  "milosevic": "6890922bab10e7b0b69759ec",
  "muammar gaddafi": "6a0c0f4e7b148e5451e16710",
  "nijasov": "6890920a2e199a1c531f7fad",
  "papa doc": "68909221ab10e7b0b697587e",
  "pinochet": "689092062e199a1c531f7f2a",
  "pol pot": "68909219ab10e7b0b697574e",
  "saddam hussein": "6890920f2e199a1c531f8095",
  "suharto": "689092012e199a1c531f7ebc",
  "trujillo": "6901d9eb91066218a4c409de"
};
const mappedIds = Object.keys(expectedImageIds);
const mappedIdSet = new Set(mappedIds);
const catalogueIds = [...records.map((row) => row["Podcast-ID"]), ...(registry.records || []).map((record) => record.podcast_id)];
assert.equal(mappedIds.length, 22, "Exactly 22 explicitly reviewed DR mappings must remain defined");
assert.deepEqual(
  Object.entries(lookup).filter(([id]) => mappedIdSet.has(id)).sort(([left], [right]) => left.localeCompare(right)),
  Object.entries(expectedImageIds).sort(([left], [right]) => left.localeCompare(right)),
  "All 22 reviewed canonical IDs must retain their exact DR image IDs"
);
assert.deepEqual(Object.fromEntries(Object.entries(lookup).filter(([id]) => Object.hasOwn(registeredImageIds, id))), registeredImageIds,
  "Newly verified DR series use their exact distinct SquareImage IDs");
assert.deepEqual(Object.fromEntries(Object.entries(fallbacks)), {
  "leopold ii": "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6a96ae037472ce653345f984"
}, "Only Leopold II receives the verified raw DR SquareImage fallback");
assert.ok(mappedIds.every((id) => catalogueIds.includes(id)), "All 22 reviewed IDs must remain in the Tyran catalogue");
assert.ok(registry.records.every((record) => record.podcast_id && catalogueIds.includes(record.podcast_id)), "Registered DR series preserve or add exact canonical IDs");
assert.equal(new Set(Object.values(lookup)).size, Object.keys(lookup).length, "Every mapped Tyran series must use a distinct official image ID");
for (const { "Podcast-ID": id } of records) {
  assert.ok(id, "Every Tyran catalogue record must retain a canonical Podcast-ID");
}
const mappedRecords = records.filter((row) => mappedIdSet.has(row["Podcast-ID"]));
assert.equal(mappedRecords.length, mappedIds.length, "Each reviewed mapping must match exactly one current Tyran row");

for (const row of mappedRecords) {
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
  if (id !== "leopold ii") {
    assert.ok(!sources.includes(fallbacks["leopold ii"]), `Leopold's fallback must not affect ${id}`);
  }
}

const leopoldRow = records.find((row) => row["Podcast-ID"] === "leopold ii");
assert.equal(leopoldRow.catalogue_id, "catalogue-v1-c76dbecf", "Leopold II's catalogue identity must remain stable");
const leopoldSources = Array.from(context.getSources({
  podcastId: leopoldRow["Podcast-ID"], title: "Leopold II", image: leopoldRow.Billedlink, imageFallbacks: []
}));
assert.equal(leopoldSources[0], `https://asset.dr.dk/drlyd/images/urn:dr:radio:image:${expectedImageIds["leopold ii"]}?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29`);
assert.equal(leopoldSources[1], fallbacks["leopold ii"], "Leopold's immutable SquareImage URL must be the second source and version its cache key");
assert.equal(new Set(leopoldSources).size, leopoldSources.length, "Repeated source registration must not create duplicate candidates");
assert.deepEqual(Array.from(context.getSources({ podcastId: "marcos", title: "Leopold II", image: `https://asset.dr.dk/drlyd/images/urn:dr:radio:image:${registeredImageIds.marcos}?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29`, imageFallbacks: [] })), [
  `https://asset.dr.dk/drlyd/images/urn:dr:radio:image:${registeredImageIds.marcos}?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29`
], "Marcos keeps only its own official image even when the title resembles Leopold II");
assert.ok(!Array.from(context.getSources({ podcastId: "leopold ii junior", title: "Leopold II", image: "https://example.test/unchanged.jpg", imageFallbacks: [] })).includes(fallbacks["leopold ii"]),
  "A similar title or ID must not infer Leopold's fallback");

// Future Tyran catalogue rows without reviewed mappings keep their ordinary sources.
const newTyranPodcast = {
  podcastId: "tyran ny serie",
  image: "https://example.test/new-tyran.jpg",
  imageFallbacks: ["https://example.test/new-tyran-fallback.jpg"],
  localCoverVariants: [{ path: "data/covers/480/tyran-ny-serie.webp" }],
  preferExternalCoverSource: false
};
const newTyranSources = Array.from(context.getSources(newTyranPodcast));
assert.deepEqual(newTyranSources, [
  "data/covers/480/tyran-ny-serie.webp",
  "https://example.test/new-tyran.jpg",
  "https://example.test/new-tyran-fallback.jpg"
], "An unmapped future Tyran ID must retain its normal cover fallbacks without inferred DR artwork");

// Changes must not spill over to a similarly named non-Tyran podcast.
const unrelated = { podcastId: "tyran unrelated", image: "https://example.test/unchanged.jpg", localCoverVariants: [], imageFallbacks: [], preferExternalCoverSource: false };
assert.deepEqual(Array.from(context.getSources(unrelated)), [unrelated.image]);
const historicalTransferguru = { podcastId: "transferguru", image: "https://example.test/podimo.jpg", localCoverVariants: [], imageFallbacks: [] };
assert.deepEqual(Array.from(context.getSources(historicalTransferguru)), [historicalTransferguru.image]);
assert.deepEqual(Array.from(context.getSources({ podcastId: "transferguru tipsbladet" })),
  ["assets/podcast-covers/manual-originals/series/transferguru_tipsbladet.webp"]);
assert.deepEqual(Array.from(context.getSources({ podcastId: "svindlerne" })),
  ["assets/podcast-covers/manual-originals/series/svindlerne_podimo_saeson_1.webp"]);

// A failed transformed image must advance to the official SquareImage URL
// before the generated initials placeholder, and repeated requests stay unique.
Object.assign(context, {
  state: { failedImageSources: new Set(), coverMetaByPrimarySrc: {} },
  normalizeImageSource: (value) => String(value ?? "").trim(),
  getResponsiveCoverMeta: () => null,
  addImageCandidate(candidates, candidate) {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate);
  },
  getLocalCoverFallbacks: () => [],
  createPodcastPlaceholderSource: (alt) => `data:image/svg+xml,placeholder-${alt}`,
  clearResponsiveImageAttributes(img) { img.removeAttribute("srcset"); img.removeAttribute("sizes"); },
  applyResponsiveImageAttributes() {},
  withLocalCoverRevision: (source) => source
});
const candidatesStart = app.indexOf("function getImageCandidates(image, alt = \"\") {");
const candidatesEnd = app.indexOf("\nfunction getPodcastImageSources(", candidatesStart);
const loaderStart = app.indexOf("function loadImageWithFallback(");
const loaderEnd = app.indexOf("\nconst warmedPodcastCoverSources", loaderStart);
assert.ok(candidatesStart >= 0 && candidatesEnd > candidatesStart && loaderStart >= 0 && loaderEnd > loaderStart);
vm.runInNewContext(`${app.slice(candidatesStart, candidatesEnd)}\n${app.slice(loaderStart, loaderEnd)}\nglobalThis.getCandidates = getImageCandidates; globalThis.loadWithFallback = loadImageWithFallback;`, context);
const leopoldImage = {
  hidden: false,
  removeAttribute(name) { this[name] = ""; },
  set src(value) { this._src = value; this.currentSrc = value; },
  get src() { return this._src; }
};
let fallbackLoaded = false;
context.loadWithFallback(leopoldImage, leopoldSources, "Leopold II", { onLoad: () => { fallbackLoaded = true; } });
assert.equal(leopoldImage.src, leopoldSources[0], "The transformed DR source remains first");
leopoldImage.onerror();
assert.equal(leopoldImage.src, fallbacks["leopold ii"], "A failed primary advances to the verified DR original before SVG");
leopoldImage.onload();
assert.equal(fallbackLoaded, true, "Fallback success is surfaced as a normal image load");
const retriedSources = Array.from(context.getCandidates(leopoldSources, "Leopold II"));
assert.equal(retriedSources[0], fallbacks["leopold ii"], "A repeated request skips the failed primary and retries the reserve");
assert.equal(retriedSources.filter((source) => source === fallbacks["leopold ii"]).length, 1, "Repeated loading must not duplicate the fallback");

console.log("All 22 protected Tyran identities and 2 newer registrations are intact; Leopold's failed primary reaches the verified DR reserve without changing Marcos.");
