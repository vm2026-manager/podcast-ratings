import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  formatExploreClusterExplanation,
  mergeExploreClusterSections
} from "./explore-cluster-ui-integration.mjs";

const cluster = (id, seeds, items = 3) => ({
  clusterId: id,
  seedPodcastIds: seeds,
  items: Array.from({ length: items }, (_, index) => ({ podcast: { podcastId: `${id}-${index}` } }))
});
const individual = (seed) => ({ seedPodcastKey: seed, items: [{ podcast: { podcastId: `${seed}-item` } }] });

assert.deepEqual(
  mergeExploreClusterSections({ individualSections: [individual("a"), individual("b")], limit: 2 }),
  [individual("a"), individual("b")],
  "no active clusters preserves existing personal sections"
);
let merged = mergeExploreClusterSections({
  clusterSections: [cluster("cluster-a", ["a"])],
  individualSections: [individual("a"), individual("b"), individual("c")],
  limit: 3
});
assert.deepEqual(merged.map((section) => section.clusterId || section.seedPodcastKey), ["cluster-a", "b", "c"], "one cluster consumes one slot and absorbs its seed");
merged = mergeExploreClusterSections({
  clusterSections: [cluster("cluster-a", ["a"]), cluster("cluster-b", ["b"])],
  individualSections: [individual("a"), individual("b"), individual("c"), individual("d")],
  limit: 4
});
assert.deepEqual(merged.map((section) => section.clusterId || section.seedPodcastKey), ["cluster-a", "cluster-b", "c", "d"], "two clusters share the existing four-row budget");
assert.equal(merged.length, 4, "personal section limit is never exceeded");
assert.deepEqual(merged[0].items.map((item) => item.podcast.podcastId), ["cluster-a-0", "cluster-a-1", "cluster-a-2"], "cluster candidate order is preserved");
assert.ok(merged[0].items.length <= 12, "cluster rows use the existing twelve-card capacity");

const podcasts = [
  { podcastId: "agent-storm-id", title: "Agent Storm" },
  { podcastId: "b", title: "Undercover" },
  { podcastId: "c", title: "I krig med PET" },
  { podcastId: "d", title: "Agent Samsam" }
];
assert.equal(
  formatExploreClusterExplanation({ positiveSeedCount: 2, seedPodcastIds: ["agent-storm-id", "b"] }, podcasts, [], { "agent-storm-id": 9, b: 8 }),
  "Fordi du kunne lide Agent Storm og Undercover."
);
assert.equal(
  formatExploreClusterExplanation({ positiveSeedCount: 3, seedPodcastIds: ["agent-storm-id", "b", "c"] }, podcasts, [], { "agent-storm-id": 9, b: 8, c: 7 }),
  "Baseret på Agent Storm, Undercover og I krig med PET."
);
assert.equal(
  formatExploreClusterExplanation({ positiveSeedCount: 4, seedPodcastIds: ["agent-storm-id", "b", "c", "d"] }, podcasts, [], { "agent-storm-id": 9, b: 8, c: 7, d: 7 }),
  "Baseret på 4 podcasts, du har vurderet positivt."
);
assert.doesNotMatch(
  formatExploreClusterExplanation({ positiveSeedCount: 2, seedPodcastIds: ["agent-storm-id", "b"] }, podcasts, [], { "agent-storm-id": 9, b: 8 }),
  /agent-storm-id/u,
  "explanations use catalogue display titles rather than IDs"
);

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
assert.match(app, /import\("\.\/scripts\/explore-cluster-ui-integration\.mjs"\)/u, "classic app dynamically imports the narrow adapter");
assert.match(app, /state\.exploreClustersStatus = "error"/u, "failed cluster loading degrades safely");
assert.match(app, /if \(!isLoggedIn\(\)\) return \[\];/u, "logged-out clusters are disabled");
assert.match(app, /matchesPodcast: \(podcast\) => matchesExploreFilters/u, "search and genre filters apply before a cluster row renders");
assert.match(app, /section\.clusterId\s*\?\s*section\.items\.slice\(0, 12\)/u, "cluster rows preserve engine ordering and cap at twelve");

console.log("Explore cluster UI integration tests passed.");
