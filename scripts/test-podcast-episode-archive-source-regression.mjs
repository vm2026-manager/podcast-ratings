import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../app.js", import.meta.url));
const app = await readFile(appPath, "utf8");

function extractFunction(name) {
  const start = app.indexOf(`async function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const followingSource = app.slice(start + 1);
  const nextFunction = followingSource.search(/\n(?:async )?function /u);
  const end = nextFunction === -1 ? -1 : start + 1 + nextFunction;
  return app.slice(start, end === -1 ? app.length : end);
}

const loader = extractFunction("fetchGenstartEpisodes");
const search = extractFunction("searchGenstartEpisodes");
const ownRatingFetch = extractFunction("fetchEpisodeUserRatingsForIds");

for (const [name, body] of [["loader", loader], ["search", search]]) {
  assert.match(body, /\.eq\("podcast_key", getEpisodeDatabasePodcastKey\(config\)\)/u, `${name} uses canonical podcast_key`);
  assert.match(body, /\.eq\("is_active", true\)/u, `${name} keeps the active-episode boundary`);
  assert.doesNotMatch(body, /\.eq\("source", config\.source\)/u, `${name} does not restrict the archive to one provider`);
}

assert.match(loader, /\.range\(offset, offset \+ EPISODE_PAGE_SIZE - 1\)/u, "loader keeps Vis flere pagination");
assert.match(search, /\.range\(offset, offset \+ EPISODE_PAGE_SIZE - 1\)/u, "search keeps result pagination");
assert.match(search, /title\.ilike\.\$\{pattern\},description\.ilike\.\$\{pattern\}/u, "search still searches title and description");
assert.match(loader, /mergeEpisodes\(rows, manualEpisodes\)/u, "manual catalogue episodes remain merged through their existing separation path");
assert.match(search, /mergeEpisodes\(rows, manualEpisodes\)/u, "manual catalogue search remains separated and merged");
assert.match(app, /episode\?\.dataSource === "manual"[\s\S]*?manualCanonicalEpisodeMappings/u, "manual rating persistence remains distinct");
assert.match(app, /select\("id,podcast_key,title/u, "episode IDs remain selected for rating identity");
assert.match(loader, /fetchEpisodeRatingMetaForEpisodes\(rows\)/u, "existing episode rating lookup remains attached to unchanged IDs");
assert.match(ownRatingFetch, /\.eq\("user_id", state\.authUser\.id\)/u, "own ratings use the authenticated user");
assert.match(ownRatingFetch, /\.in\("episode_id", queryIds\)/u, "own ratings resolve by exact episode UUID");
assert.doesNotMatch(ownRatingFetch, /source|podcast_key/u, "own rating lookup has no current-source or podcast-identity restriction");
assert.match(app, /"Ægte par"/u, "Æ is preserved");
assert.match(app, /"mørkeland"/u, "ø is preserved");
assert.match(app, /"sagen genåbnet"/u, "å is preserved");

// With source absent from both predicates, these provider rows share one
// canonical archive boundary and are both eligible before pagination/search.
const historicalRows = [
  { id: "old-id", podcast_key: "det vi taler om", source: "radio4_det_vi_taler_om_rss", title: "Ældre episode" },
  { id: "new-id", podcast_key: "det vi taler om", source: "new_provider_rss", title: "Ny episode" }
];
const canonicalArchive = historicalRows.filter((row) => row.podcast_key === "det vi taler om");
assert.deepEqual(canonicalArchive.map((row) => row.id), ["old-id", "new-id"]);
assert.equal(canonicalArchive.find((row) => row.source === "radio4_det_vi_taler_om_rss").id, "old-id", "historical episode ID is unchanged");
assert.equal(canonicalArchive.find((row) => row.source === "new_provider_rss").id, "new-id", "new provider episode ID is distinct");
assert.deepEqual(canonicalArchive.filter((row) => /ældre|ny/i.test(row.title)).map((row) => row.source), ["radio4_det_vi_taler_om_rss", "new_provider_rss"]);

const personalRatingsByEpisodeId = new Map([["old-id", 8.5]]);
const publicStatsByEpisodeId = new Map([["old-id", { averageRating: 8.5, ratingCount: 1 }]]);
assert.equal(personalRatingsByEpisodeId.get(canonicalArchive[0].id), 8.5, "historical own rating remains attached to its exact UUID");
assert.deepEqual(publicStatsByEpisodeId.get(canonicalArchive[0].id), { averageRating: 8.5, ratingCount: 1 }, "the same UUID retains its public aggregate contribution");

console.log("Podcast episode archive/source regression checks passed.");
