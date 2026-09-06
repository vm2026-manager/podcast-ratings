import assert from "node:assert/strict";
import {
  normalizeManualSimilarityIdentity,
  parseSupplementarySimilarities,
  resolveSupplementarySimilarities
} from "./manual-similarity-supplements.mjs";

const row = (recommendationId, title, podcastId, host = "", duplicateGroup = "") => ({
  recommendationId,
  title,
  podcastId,
  host,
  identityDuplicateGroup: duplicateGroup,
  displayRowIndex: 0
});

const source = row("source", "Kildeserien", "source-id", "Kilde Vært");
const idTarget = row("id-target", "Et helt nyt navn", "MÅL-ID", "Vært A");
const titleTarget = row("title-target", "Historien om alt", "title-id", "Vært B");
const duplicatePer = row("per", "Gidselforhandleren", "per-id", "Per Lysholt");
const duplicateJens = row("jens", "Gidselforhandleren", "jens-id", "Jens Serup");
const duplicateIdOne = row("duplicate-id-one", "Første titel", "delt-id");
const duplicateIdTwo = row("duplicate-id-two", "Anden titel", "delt-id");
const catalog = [
  source,
  idTarget,
  titleTarget,
  duplicatePer,
  duplicateJens,
  duplicateIdOne,
  duplicateIdTwo
];

const resolve = (rawValue, currentSource = source, currentCatalog = catalog) =>
  resolveSupplementarySimilarities({
    source: { ...currentSource, supplementarySimilaritiesRaw: rawValue },
    catalog: currentCatalog
  });

assert.equal(normalizeManualSimilarityIdentity("  Ærø\tPodcast  "), "ærø podcast");
assert.deepEqual(
  parseSupplementarySimilarities("Historien om alt; ; Gidselforhandleren [Per Lysholt]"),
  [
    { title: "Historien om alt", hostQualifier: null },
    { title: "Gidselforhandleren", hostQualifier: "Per Lysholt" }
  ]
);

// Podcast-ID takes precedence and stays stable when a display title changes.
assert.equal(resolve(" mål-id ").audit[0].status, "resolved_podcast_id");
assert.equal(resolve("mål-id").resolved[0].candidate.recommendationId, "id-target");
assert.equal(resolve("MÅL-ID").resolved[0].candidate.title, "Et helt nyt navn");

// A duplicated Podcast-ID is never silently resolved or treated as a title.
assert.equal(resolve("delt-id").audit[0].status, "ambiguous_podcast_id");
assert.equal(
  resolve("delt-id").audit[0].rejectionReason,
  "multiple_exact_podcast_id_matches"
);

// Existing title-only and title-plus-host references remain supported.
assert.equal(resolve("Historien om alt").audit[0].status, "resolved_unique_title");
assert.equal(
  resolve("Gidselforhandleren [Per Lysholt]").resolved[0].candidate.recommendationId,
  "per"
);

// A source cannot point at itself by Podcast-ID, even if its title differs.
assert.equal(resolve("source-id").audit[0].status, "self_reference");

// Semicolon-separated legacy references retain their ordering and resolution.
assert.deepEqual(
  resolve("Historien om alt; Gidselforhandleren [Per Lysholt]").resolved.map(
    ({ candidate }) => candidate.recommendationId
  ),
  ["title-target", "per"]
);

console.log("Manual supplementary similarity tests passed.");
