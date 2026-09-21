import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { slimPodcastRows } from "./sync-sheet-data.mjs";

const appSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const predicateMatch = appSource.match(
  /function isOutdatedPodcast\(podcast\) \{[\s\S]*?\n\}/
);

assert.ok(predicateMatch, "The runtime Uaktuel predicate must exist.");
const isOutdatedPodcast = new Function(
  `${predicateMatch[0]}; return isOutdatedPodcast;`
)();

for (const value of ["x", "X", " x ", " X "]) {
  assert.equal(isOutdatedPodcast({ uaktuel: value }), true, `${JSON.stringify(value)} is outdated`);
}

for (const value of ["", undefined, "STOPPET", "ja"]) {
  assert.equal(isOutdatedPodcast({ uaktuel: value }), false, `${JSON.stringify(value)} remains eligible`);
}

const mappedRows = await slimPodcastRows([
  { Titel: "Æ Ø Å", Uaktuel: " X " },
  { Titel: "Uden markering" },
  { Titel: "Anden værdi", Uaktuel: "STOPPET" }
]);
assert.equal(mappedRows[0].Uaktuel, "X");
assert.ok(!Object.hasOwn(mappedRows[1], "Uaktuel"));
assert.equal(mappedRows[2].Uaktuel, "STOPPET");

assert.match(
  appSource,
  /function matchesExploreFilters\([\s\S]*?if \(isOutdatedPodcast\(podcast\)\)/,
  "Explore must exclude outdated podcasts before result selection."
);
assert.match(
  appSource,
  /function getPodcastlistenTopPodcasts[\s\S]*?!isOutdatedPodcast\(podcast\)[\s\S]*?\.sort\(/,
  "The homepage Top-150 pool must exclude outdated podcasts before ranking."
);

console.log("Uaktuel eligibility tests passed.");
