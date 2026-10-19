import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const catalogue = JSON.parse(readFileSync(new URL("../data/podcasts.json", import.meta.url), "utf8"));
const records = (catalogue.rows || []).filter((row) => row.Hovedserie === "Tyran");
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
const catalogueIds = records.map((row) => row["Podcast-ID"]);
assert.equal(mappedIds.length, 22, "Exactly 22 explicitly reviewed DR mappings must remain defined");
assert.deepEqual(
  Object.entries(lookup).sort(([left], [right]) => left.localeCompare(right)),
  Object.entries(expectedImageIds).sort(([left], [right]) => left.localeCompare(right)),
  "All 22 reviewed canonical IDs must retain their exact DR image IDs"
);
assert.ok(mappedIds.every((id) => catalogueIds.includes(id)), "All 22 reviewed IDs must remain in the Tyran catalogue");
assert.equal(new Set(Object.values(lookup)).size, mappedIds.length, "Every mapped Tyran series must use a distinct official image ID");
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
}

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

console.log("All 22 DR Tyran official square-image identities and existing cover fallbacks PASS; shared getter covers mobile and desktop.");
