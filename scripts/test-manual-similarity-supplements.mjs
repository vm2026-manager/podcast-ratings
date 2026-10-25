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

// Distinct Podcast-IDs remain distinct even when the display titles match.
const fodboldFmBt = row("fodbold-fm-bt", "Fodbold FM", "fodbold fm bt");
const fodboldFm24Syv = row("fodbold-fm-24syv", "Fodbold FM", "fodbold fm 24syv");
const fodboldResolution = resolve(
  "fodbold fm 24syv",
  fodboldFmBt,
  [fodboldFmBt, fodboldFm24Syv]
);
assert.equal(fodboldResolution.audit[0].status, "resolved_podcast_id");
assert.equal(fodboldResolution.resolved[0].candidate.recommendationId, "fodbold-fm-24syv");

// The same Podcast-ID remains a self-reference even when titles differ.
const sameIdSource = row("same-id-source", "Original title", "same-podcast-id");
const sameIdCandidate = row("same-id-candidate", "Target title", "same-podcast-id");
assert.equal(
  resolve("Target title", sameIdSource, [sameIdSource, sameIdCandidate]).audit[0].status,
  "self_reference"
);

// Legacy rows without Podcast-IDs retain the conservative title fallback.
const legacySource = row("legacy-source", "Dobbeltgænger", "", "Third Ear");
const legacyCandidate = row("legacy-candidate", "Dobbeltgænger", "", "Zetland");
assert.equal(
  resolve("Dobbeltgænger [Zetland]", legacySource, [legacySource, legacyCandidate]).audit[0].status,
  "self_reference"
);

// Semicolon-separated legacy references retain their ordering and resolution.
assert.deepEqual(
  resolve("Historien om alt; Gidselforhandleren [Per Lysholt]").resolved.map(
    ({ candidate }) => candidate.recommendationId
  ),
  ["title-target", "per"]
);

const approvedIdentityPairs = [
  ["candace", "the ben shapiro show"],
  ["menneskedyret", "dagmar overby"],
  ["øverste hylde", "dkpol"],
  ["charles manson det glemte mord", "manson familien"],
  ["ny afslørende virginia giuffre bog", "efter epstein filerne"],
  ["den charmerende bedrager", "svindlerne"],
  ["smat brændbart", "ugens krise"],
  ["kvinden med den tunge kuffert det sidste kapitel", "victor lustig"],
  ["charles manson", "manson familien"],
  ["dkpol", "borgen unplugged 2 0"],
  ["under gulvtæppet", "dkpol"],
  ["marathonmanden", "man kan aldrig vide"],
  ["espn laliga espn dk", "mediano la liga"],
  ["man kan aldrig vide", "victor lustig"],
  ["borgen unplugged 2 0", "øverste hylde"],
  ["fra fodboldstjerne til narkohaj", "pusheren fra provinsen"],
  ["p1 morgen", "24syv morgen"]
];
const approvedCatalog = [...new Set(approvedIdentityPairs.flat())].map((podcastId) =>
  row(`catalog:${podcastId}`, podcastId, podcastId)
);
assert.equal(approvedIdentityPairs.length, 17);
for (const [sourceId, targetId] of approvedIdentityPairs) {
  const approvedSource = approvedCatalog.find((item) => item.podcastId === sourceId);
  const { resolved, audit } = resolve(targetId, approvedSource, approvedCatalog);
  assert.equal(resolved.length, 1, `${sourceId} resolves the approved target ID ${targetId}`);
  assert.equal(resolved[0].candidate.podcastId, targetId);
  assert.equal(audit[0].status, "resolved_podcast_id");
}

const invalidReference = resolve("not-a-canonical-id");
assert.equal(invalidReference.resolved.length, 0, "invalid targets are safely skipped");
assert.equal(invalidReference.audit[0].status, "unresolved_title");

console.log("Manual supplementary similarity tests passed.");
