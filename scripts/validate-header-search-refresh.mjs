import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");

const helperStart = app.indexOf("function refreshOpenHeaderSearchResults() {");
const helperEnd = app.indexOf("\nfunction openHeaderSearchResult", helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, "Header-refresh helper is missing");
const helper = app.slice(helperStart, helperEnd);

assert.match(helper, /results\.classList\.contains\("is-hidden"\)/, "Closed header search must remain closed");
assert.match(helper, /normalizeSearchValue\(input\.value\)\.length < 2/, "Empty header query must remain untouched");
assert.match(helper, /renderHeaderSearchResults\(\)/, "Open header search must be recomputed through the normal renderer");

const refreshStart = app.indexOf("function applyPodcastDataRefresh(");
const refreshEnd = app.indexOf("\nfunction renderAfterPodcastDataRefresh", refreshStart);
assert.ok(refreshStart >= 0 && refreshEnd > refreshStart, "Podcast refresh function is missing");
const refresh = app.slice(refreshStart, refreshEnd);
assert.ok(
  refresh.indexOf("state.podcasts = deduplicatePodcasts(mappedPodcasts);") <
    refresh.indexOf("refreshOpenHeaderSearchResults();"),
  "Header search must refresh only after the catalogue has been replaced"
);

console.log("Header search refresh validation passed.");
