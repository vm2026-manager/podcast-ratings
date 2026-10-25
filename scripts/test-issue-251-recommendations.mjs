import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const start = source.indexOf("function getPodcastDetailDynamicRecommendations(");
const end = source.indexOf("function getPodcastDetailCanonicalGroupKey(", start);
assert.ok(start >= 0 && end > start, "detail recommendation selector is present");

const sourcePodcast = { id: "kvinden-i-isdalen", title: "Kvinden i Isdalen", mainSeries: "Djævlen i detaljen", genre: "True Crime", topics: ["falske identiteter"] };
const manual = { id: "manden-med-de-mange-navne", title: "Manden med de mange navne", mainSeries: "Djævlen i detaljen", genre: "True Crime", topics: ["falske identiteter"] };
const contentMatch = { id: "kvinden-med-den-tunge-kuffert", title: "Kvinden med den tunge kuffert", mainSeries: "Anden serie", genre: "True Crime", topics: ["falske identiteter"] };
const sameSeriesFallback = { id: "mysteriet-om-lisbeth-hagen", title: "Mysteriet om Lisbeth Hagen", mainSeries: "Djævlen i detaljen", genre: "True Crime", topics: ["Norge"] };
const context = {
  state: { podcasts: [sourcePodcast, manual, contentMatch, sameSeriesFallback], podcastSimilarityPodcastByRecommendationId: {} },
  normalizeComparable: (value) => String(value || "").trim().toLocaleLowerCase("da-DK"),
  getPodcastKey: (podcast) => podcast?.id || "",
  getPodcastTopicKeys: (podcast) => new Set((podcast?.topics || []).map((topic) => String(topic).toLocaleLowerCase("da-DK"))),
  getCatalogueManualSupplementaryPodcasts: () => [manual],
  hostsMatchComparable: () => false
};
vm.createContext(context);
vm.runInContext(`${source.slice(start, end)}; globalThis.select = getPodcastDetailDynamicRecommendations;`, context);
const selected = Array.from(context.select(sourcePodcast, null), (entry) => entry.item.podcast.id);
assert.deepEqual(selected.slice(0, 3), [manual.id, contentMatch.id, sameSeriesFallback.id]);
assert.equal(new Set(selected).size, selected.length);

console.log("Issue #251 content recommendation order test passed");
