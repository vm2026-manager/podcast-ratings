import assert from "node:assert/strict";
import fs from "node:fs";
import {
  buildExploreClusterRecommendations,
  interestScoreForRating
} from "./explore-cluster-recommendations.mjs";

const podcast = (id, { series = "", score = 8 } = {}) => ({
  "Podcast-ID": id,
  Titel: id,
  Hovedserie: series,
  "Vuring (1-10)": String(score)
});
const cluster = (id, podcastIds, specificity = 2, sortOrder = 10) => ({
  id, title: id, description: `${id} beskrivelse`, specificity, sortOrder, podcastIds
});
const run = (clusters, podcasts, ratings, extras = {}) =>
  buildExploreClusterRecommendations({ clusters, podcasts, ratings, ...extras });

assert.equal(interestScoreForRating(7), 1, "7 is positive");
assert.equal(interestScoreForRating(6), 0, "6 is not positive");

const core = ["seed-a", "seed-b", "candidate-a", "candidate-b", "candidate-c"].map((id) => podcast(id));
let result = run([cluster("core", core.map((row) => row["Podcast-ID"]))], core, { "seed-a": 7, "seed-b": 8 });
assert.equal(result.length, 1, "two different positive groups activate a cluster");
assert.equal(result[0].positiveSeedCount, 2);

const seasons = [
  podcast("season-1", { series: "Saga" }), podcast("season-2", { series: "Saga" }), podcast("season-3", { series: "Saga" }),
  podcast("candidate-a"), podcast("candidate-b"), podcast("candidate-c")
];
result = run([cluster("seasons", seasons.map((row) => row["Podcast-ID"]))], seasons, { "season-1": 9, "season-2": 8, "season-3": 7 });
assert.equal(result.length, 0, "three same-series ratings are one independent signal");

const weak = [...core, podcast("negative")];
result = run([cluster("weak", weak.map((row) => row["Podcast-ID"]))], weak, { "seed-a": 7, "seed-b": 7, negative: 1 });
assert.equal(result.length, 0, "negative ratings prevent a zero-interest cluster");

result = run([cluster("rated", core.map((row) => row["Podcast-ID"]))], core, { "seed-a": 9, "seed-b": 8, "candidate-a": 4 });
assert.equal(result.length, 0, "fewer than three unrated canonical candidates suppresses a cluster");

const dedupe = [
  podcast("seed-a"), podcast("seed-b"), podcast("candidate-a-1", { series: "Candidate saga" }),
  podcast("candidate-a-2", { series: "Candidate saga" }), podcast("candidate-b"), podcast("candidate-c")
];
result = run([cluster("dedupe", dedupe.map((row) => row["Podcast-ID"]))], dedupe, { "seed-a": 9, "seed-b": 8 });
assert.equal(result[0].recommendations.length, 3, "candidate groups are deduplicated");
assert.equal(new Set(result[0].recommendations.map((item) => item.canonicalGroupId)).size, 3);
assert.ok(!result[0].recommendations.some((item) => ["seed-a", "seed-b"].includes(item.podcastId)), "rated podcasts are never candidates");

const overlapPodcasts = ["a", "b", "x", "y", "z"].map((id) => podcast(id));
result = run([
  cluster("less-specific", ["a", "b", "x", "y", "z"], 1, 1),
  cluster("more-specific", ["a", "b", "x", "y", "z"], 3, 20)
], overlapPodcasts, { a: 8, b: 8 });
assert.deepEqual(result.map((item) => item.clusterId), ["more-specific"], "overlap uses specificity as a deterministic tie-break");

const separate = ["a", "b", "c", "d", "x", "y", "z"].map((id) => podcast(id));
result = run([
  cluster("left", ["a", "b", "c", "x", "y", "z"]),
  cluster("right", ["a", "d", "c", "x", "y", "z"])
], separate, { a: 9, b: 8, c: 1, d: 8 });
assert.equal(result.length, 2, "separately supported overlapping clusters remain");

const priority = ["a1", "a2", "a3", "b1", "b2", "x", "y", "z"].map((id) => podcast(id));
result = run([
  cluster("two-high", ["a1", "a2", "x", "y", "z"]),
  cluster("three-positive", ["b1", "b2", "a3", "x", "y", "z"])
], priority, { a1: 10, a2: 10, a3: 7, b1: 7, b2: 7 });
assert.equal(result[0].clusterId, "three-positive", "three positive groups outrank two");

const ratingTie = ["h1", "h2", "m1", "m2", "x", "y", "z"].map((id) => podcast(id));
result = run([
  cluster("medium", ["m1", "m2", "x", "y", "z"]),
  cluster("high", ["h1", "h2", "x", "y", "z"])
], ratingTie, { h1: 9, h2: 9, m1: 8, m2: 8 });
assert.equal(result[0].clusterId, "high", "higher ratings break equal seed-count ties");

const deterministic = JSON.stringify(run([cluster("core", core.map((row) => row["Podcast-ID"]))], core, { "seed-a": 7, "seed-b": 8 }));
assert.equal(JSON.stringify(run([cluster("core", core.map((row) => row["Podcast-ID"]))], core, { "seed-a": 7, "seed-b": 8 })), deterministic, "output is deterministic");

const productionClusters = JSON.parse(fs.readFileSync("data/explore-clusters.json", "utf8"));
const productionPodcasts = JSON.parse(fs.readFileSync("data/podcasts.json", "utf8")).rows;
const productionProduct = JSON.parse(fs.readFileSync("data/podcast-similarity-product-v1.3.json", "utf8"));
const displayGroups = JSON.parse(fs.readFileSync("data/podcast-display-groups.json", "utf8"));
assert.equal(productionClusters.clusters.length, 23, "all production clusters load");
const realistic = run(productionClusters, productionPodcasts, {
  "agent storm": 9, "agent samsam": 8, "i krig med pet": 7
}, { similarityProduct: productionProduct, displayGroups });
assert.ok(realistic.some((item) => item.clusterId === "spioner-agenter-undercover"), "Agent Storm, Agent Samsam and I krig med PET activate Spies");

console.log("Explore cluster recommendation tests passed.");
