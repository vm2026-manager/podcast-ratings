import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { slimPodcastRows } from "./sync-sheet-data.mjs";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const extractFunction = (source, name) => {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `Missing ${name}`);
  const opening = source.indexOf("{", start);
  let depth = 0;
  for (let index = opening; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed function ${name}`);
};
const normalizeComparable = (value) => String(value ?? "")
  .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/gu, "")
  .replace(/&/gu, " og ").replace(/\s+/gu, " ").trim();
const canonicalGenres = ["True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund", "Sport", "Dokumentar", "Viden", "Underholdning"];
const genreContext = { normalizeComparable, CANONICAL_GENRES: canonicalGenres };
const evaluate = (name, context) => vm.runInNewContext(`${extractFunction(app, name)}\n${name}`, context);
const normalizeGenre = evaluate("normalizeGenre", genreContext);
for (const genre of ["Krig", "Politik", "Finans"]) assert.equal(normalizeGenre(genre), genre);
assert.equal(normalizeGenre(""), "");
assert.equal(normalizeGenre("Sladder"), "Sladder");
assert.equal(normalizeGenre("Økonomi"), "");
assert.equal(normalizeGenre("Aktier"), "");

const hasGenre = evaluate("podcastHasGenre", { normalizeComparable });
assert.equal(hasGenre({ genre: "Historie", secondaryGenre: "Politik" }, "Politik"), true);
assert.equal(hasGenre({ genre: "Historie", secondaryGenre: "", tertiaryGenre: "Finans" }, "Finans"), true);
assert.equal(hasGenre({ genre: "Historie", secondaryGenre: "" }, "Krig"), false);
const candidateFit = evaluate("getExploreCandidateFit", {
  normalizeComparable,
  getExplorePodcastStats: () => ({ communityRating: 7, madsRating: 8, ratingCount: 3 }),
  getExploreSignalWeight: (signals, genre) => signals.get(normalizeComparable(genre)) || 0,
  getExploreHostSignalWeight: () => 0
});
const secondaryFit = candidateFit(
  { genre: "Samfund", secondaryGenre: "Politik", title: "Politisk serie" },
  { genreSignals: new Map([["politik", 0.8]]), mainSeriesSignals: new Map(), publisherSignals: new Map(), hostSignals: [] }
);
assert.ok(secondaryFit.tasteScore > 0);
assert.equal(secondaryFit.reason, "Mere Politik");

const topicMatch = evaluate("matchesPodcastTopicSearch", { normalizeComparable });
assert.equal(topicMatch({ searchTopics: ["Den Kolde Krig"] }, "Den Kolde Krig"), true);
assert.equal(topicMatch({ searchTopics: ["Den Kolde Krig"] }, "Kolde Krig"), true);
assert.equal(topicMatch({ searchTopics: ["Dansk politik", "Europæisk historie"] }, "dansk historie"), false);

const deduplicate = evaluate("deduplicatePodcastResults", {
  getPodcastKey: (podcast) => podcast.id
});
const duplicateInput = [{ id: "podcast-1" }, { id: "podcast-1" }, { id: "podcast-2" }];
assert.deepEqual(deduplicate(duplicateInput).map((podcast) => podcast.id), ["podcast-1", "podcast-2"]);

const urlContext = {
  URL,
  window: {
    location: { href: "https://podcastlisten.dk/?existing=1#ranglister" },
    history: { state: null, replaceState(_state, _title, url) { this.url = String(url); } }
  },
  normalizeText: (value) => String(value ?? "").trim(),
  getRouteInfoFromHash: () => ({ route: "ranglister" })
};
const updateUrl = evaluate("updateRankingSearchUrl", urlContext);
updateUrl("Den Kolde Krig");
const sharedUrl = new URL(urlContext.window.history.url);
assert.equal(sharedUrl.searchParams.get("s"), "Den Kolde Krig");
assert.equal(sharedUrl.searchParams.get("existing"), "1");
assert.equal(sharedUrl.hash, "#ranglister");
urlContext.window.location.href = sharedUrl.href;
updateUrl("");
assert.equal(new URL(urlContext.window.history.url).searchParams.has("s"), false);
assert.equal(new URL(urlContext.window.history.url).searchParams.get("existing"), "1");

let pageShowState = { restored: true, clearCalls: 0, routeCalls: 0, renderCalls: 0 };
const pageShowContext = {
  restoreRankingSearchFromUrl: () => pageShowState.restored,
  renderRoute: () => { pageShowState.routeCalls += 1; },
  render: () => { pageShowState.renderCalls += 1; },
  clearSearchInput: () => { pageShowState.clearCalls += 1; }
};
const handlePageShow = evaluate("restoreOrClearRankingSearchOnPageShow", pageShowContext);
assert.equal(handlePageShow(), true);
assert.equal(pageShowState.clearCalls, 0);
assert.equal(pageShowState.routeCalls, 1);
assert.equal(pageShowState.renderCalls, 1);
pageShowState = { restored: false, clearCalls: 0, routeCalls: 0, renderCalls: 0 };
assert.equal(handlePageShow(), false);
assert.equal(pageShowState.clearCalls, 1);
assert.equal(pageShowState.routeCalls, 0);
assert.equal(pageShowState.renderCalls, 0);

const oldSheetRow = await slimPodcastRows([{ Titel: "Ældre ark", Genre: "Krig", "2. genre": "Politik" }]);
assert.equal(oldSheetRow[0].secondaryGenre, "Politik");
assert.equal(Object.hasOwn(oldSheetRow[0], "tertiaryGenre"), false);
const newSheetRow = await slimPodcastRows([{ Titel: "Tredje genre", Genre: "Historie", "2. genre": "Krig", "3. genre": "Finans" }]);
assert.equal(newSheetRow[0].tertiaryGenre, "Finans");

assert.match(app, /searchTopics:\s*topics/u);
assert.match(app, /deduplicatePodcastResults\(getRankingCandidates\(\)\s*\.filter/u);
assert.match(app, /restoreRankingSearchFromUrl\(\)/u);

console.log("Genre expansion regression tests passed.");
