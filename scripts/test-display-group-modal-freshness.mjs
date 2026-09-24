import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const app = await readFile(fileURLToPath(new URL("../app.js", import.meta.url)), "utf8");

function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing ${name}`);
  let depth = 0;
  for (let index = start; index < app.length; index += 1) {
    if (app[index] === "{") depth += 1;
    if (app[index] === "}" && --depth === 0) return app.slice(start, index + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

// Reproduce the production ordering: the catalogue lookup is ready before the
// RPC. It must store a static group definition, and resolving a member later
// must create a fresh display item from the current community state.
const state = {
  displayGroupCommunityStatsById: {},
  podcastDetailPublicItemByPodcastKey: {
    "narkobetjenten-season-1": { id: "narkobetjenten", rankingEnabled: true }
  }
};
const resolve = new Function(
  "state", "getPodcastKey", "createRankingDisplayGroup",
  `${extractFunction("resolvePublicPodcastDisplayItem")}; return resolvePublicPodcastDisplayItem;`
)(
  state,
  (podcast) => podcast.key,
  (group) => ({
    isDisplayGroup: true,
    key: `display-group:${group.id}`,
    userAverageRating: state.displayGroupCommunityStatsById[group.id]?.averageRating ?? null,
    userRatingCount: state.displayGroupCommunityStatsById[group.id]?.ratingCount ?? 0
  })
);

const member = { key: "narkobetjenten-season-1" };
assert.deepEqual(resolve(member), {
  isDisplayGroup: true, key: "display-group:narkobetjenten", userAverageRating: null, userRatingCount: 0
});
state.displayGroupCommunityStatsById.narkobetjenten = { averageRating: 7.45, ratingCount: 1 };
assert.deepEqual(resolve(member), {
  isDisplayGroup: true, key: "display-group:narkobetjenten", userAverageRating: 7.45, userRatingCount: 1
});
// A later refresh cannot retain the first RPC value in a cached public item.
state.displayGroupCommunityStatsById.narkobetjenten = { averageRating: 8.2, ratingCount: 2 };
assert.equal(resolve(member).userAverageRating, 8.2);
assert.equal(resolve(member).userRatingCount, 2);

const rebuild = extractFunction("rebuildPodcastDetailRecommendationLookups");
assert.match(rebuild, /publicItemByPodcastKey\[key\] = group/u);
assert.doesNotMatch(rebuild, /createRankingDisplayGroup\(group\)/u);
const fetchGroups = extractFunction("fetchDisplayGroupCommunityStats");
assert.match(fetchGroups, /podcastDetailRecommendationCache\?\.clear\(\)/u);

// The group aggregate is only a disabled calculated presentation. It contains
// no direct save or rating-dialog action; individual season buttons remain the
// separate editable path.
const groupRender = extractFunction("renderPodcastDisplayGroupContent");
assert.match(groupRender, /is-episode-rating-locked/u);
assert.match(groupRender, /is-episode-calculated/u);
assert.match(groupRender, /disabled/u);
assert.match(groupRender, /Beregnet fra \$\{own\.count\} sæsonvurderinger\. Redigér under Vurder sæsoner\./u);
assert.match(app, /data-podcast-season-rate/u);
assert.doesNotMatch(groupRender, /data-podcast-detail-inline-rating-save/u);
assert.match(app, /function getDisplayGroupOwnRatingStats\(members\)/u);

console.log("Display-group modal freshness and derived-own-rating regression checks passed.");
