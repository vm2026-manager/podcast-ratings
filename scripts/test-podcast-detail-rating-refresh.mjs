import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const plainStart = app.indexOf(`function ${name}(`);
  const start = app.lastIndexOf("async ", plainStart) === plainStart - 6 ? plainStart - 6 : plainStart;
  assert.ok(start >= 0, `${name} must exist`);
  const bodyStart = app.indexOf(") {", start);
  assert.ok(bodyStart >= 0, `${name} must have a function body`);
  let depth = 0;
  for (let index = bodyStart + 2; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const fetchUserState = extractFunction("fetchUserState");
const refreshSupabaseState = extractFunction("refreshSupabaseState");
const preservingRefresh = extractFunction("refreshSupabaseStatePreservingCurrentUserState");
const inlineSave = extractFunction("savePodcastDetailInlineRating");
const detailRenderer = extractFunction("renderPodcastDetailSheetContent");

assert.match(fetchUserState, /async function fetchUserState\(options = \{\}\)/u);
assert.match(fetchUserState, /const preserveCurrentState = Boolean\(options\.preserveCurrentState\);/u);
assert.match(fetchUserState, /if \(!preserveCurrentState\) \{\s*clearUserScopedState\(\);\s*\}/u);
assert.match(refreshSupabaseState, /fetchUserState\(\)/u);
assert.match(preservingRefresh, /fetchUserState\(\{ preserveCurrentState: true \}\)/u);
assert.match(inlineSave, /refreshSupabaseStatePreservingCurrentUserState\(\)\s*\.then\(refreshOpenPodcastDetailSheet\)/u);
assert.doesNotMatch(inlineSave, /Indlæser episodevurderinger/u, "podcast saves never own episode-loading copy");
assert.match(detailRenderer, /rating\.userCount\s*\?\s*formatUserRatingCount\(rating\.userCount\)\s*:\s*state\.communityStatsStatus === "loading" && !state\.communityStatsHasSuccessfulLoad\s*\?\s*"Indlæser brugervurderinger …"\s*:\s*"Ingen vurderinger endnu"/u);

console.log("Podcast detail async rating-refresh regression checks passed.");
