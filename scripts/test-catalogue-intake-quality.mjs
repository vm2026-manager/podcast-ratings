import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { parseCsv, rowsToObjects } from "./sync-sheet-data.mjs";
import { partitionSheetPodcastRows, validateCatalogueIntake } from "./catalogue-intake.mjs";
import { suggestGenres, suggestSearchTopics } from "./catalogue-quality-rules.mjs";

const require = createRequire(import.meta.url);
const canonical = require("../canonical-genres.js");
assert.deepEqual(canonical, ["True Crime", "Historie", "Krig", "Politik", "Finans", "Samfund", "Sport", "Dokumentar", "Viden", "Underholdning"]);

const source = [
  ["Titel", "Podcast-ID", "Genre", "2. genre", "3. genre", "Udgiver", "Link", "Feed", "Billedlink", "Kort beskrivelse", "Lang beskrivelse", "Undervurderet perle", "Emner", "Vuring (1-10)"],
  ["Krig", "", "Dokumentar", "", "", "DR", "https://www.dr.dk/lyd/special-radio/krig-4109741269000", "", "https://asset.dr.dk/cover.jpg", "https://api.dr.dk/podcasts/v1/feeds/krig-4", "", "Afsnit 1; Afsnit 2; Afsnit 3; Afsnit 4; Afsnit 5; Afsnit 6", "Danmark; Forsvar", "9"]
];
const [candidateRow] = rowsToObjects(parseCsv(source.map((row) => row.map((cell) => "\"" + cell.replaceAll("\"", "\"\"") + "\"").join(",")).join("\n")));
assert.equal(candidateRow.__sourceRowNumber, 2);
assert.equal(Object.keys(candidateRow).includes("__sourceRowNumber"), false, "source provenance is not serialized as catalogue metadata");
const published = [{ Titel: "Existing record", "Podcast-ID": "existing-record", catalogue_id: "cat-existing", Genre: "Samfund" }];
const partition = partitionSheetPodcastRows([candidateRow], published);
assert.equal(partition.publishableRows.length, 0);
assert.equal(partition.intakeRows.length, 1);
assert.equal(partition.intakeRows[0].title, "Krig");
assert.equal(partition.intakeRows[0].declaredPodcastId, null);
assert.equal(partition.intakeRows[0].identityCreated, false);
assert.equal(Object.hasOwn(partition.intakeRows[0], "catalogue_id"), false);
assert.ok(partition.intakeRows[0].issues.some((issue) => issue.code === "missing-podcast-id"));
assert.ok(partition.intakeRows[0].issues.some((issue) => issue.code === "url-in-description"));
assert.ok(partition.intakeRows[0].issues.some((issue) => issue.code === "episode-list-in-editorial-field"));
assert.equal(Object.hasOwn(partition.intakeRows[0], "Vuring (1-10)"), false, "intake excludes ratings");
const passing = validateCatalogueIntake({ publishedRows: published, candidateRows: published, intakeCandidates: partition.intakeRows });
assert.equal(passing.ok, true, passing.errors.join("\n"));
const duplicateId = validateCatalogueIntake({
  publishedRows: [...published, published[0]],
  candidateRows: [...published, published[0]],
  intakeCandidates: []
});
assert.equal(duplicateId.ok, false, "duplicate published identities fail the separate intake validator");
const identityLeak = validateCatalogueIntake({
  publishedRows: published,
  candidateRows: published,
  intakeCandidates: [{ ...partition.intakeRows[0], catalogue_id: "new-id" }]
});
assert.equal(identityLeak.ok, false, "intake candidates cannot acquire catalogue_id values");

const collisionPartition = partitionSheetPodcastRows([candidateRow], [...published, { Titel: "Krig", "Podcast-ID": "krig-old", catalogue_id: "cat-krig" }]);
const collision = validateCatalogueIntake({ publishedRows: [...published, { Titel: "Krig", "Podcast-ID": "krig-old", catalogue_id: "cat-krig" }], candidateRows: [...published, { Titel: "Krig", "Podcast-ID": "krig-old", catalogue_id: "cat-krig" }], intakeCandidates: collisionPartition.intakeRows });
assert.equal(collision.ok, false, "a blank-ID candidate must fail if its title matches a published record");
assert.ok(collision.errors.some((error) => error.includes("exactly matches a published title")));

const warCandidate = suggestGenres({
  Titel: "Den spanske borgerkrig",
  "Kort beskrivelse": "Soldater og frontlinje former konflikten.",
  "Lang beskrivelse": "",
  topics: []
});
assert.ok(warCandidate.some((item) => item.genre === "Krig"), "multi-field military evidence can suggest Krig");
assert.deepEqual(suggestGenres({ Titel: "Krig", "Kort beskrivelse": "", "Lang beskrivelse": "", topics: [] }), [], "one title word is insufficient evidence");
assert.deepEqual(suggestGenres({
  Titel: "Bandekrig i Aarhus",
  "Kort beskrivelse": "Rockerkrig og bandekrig mellem grupper i byen.",
  "Lang beskrivelse": "En podcast om almindelige konflikter mellem personer.",
  topics: ["Bandekrig", "Rockerkrig"]
}).filter((item) => item.genre === "Krig"), [], "bandekrig and rockerkrig are not armed-conflict genre evidence");
assert.deepEqual(suggestSearchTopics({
  Titel: "Bandekrig i Aarhus",
  "Kort beskrivelse": "Rockerkrig og bandekrig mellem grupper i byen.",
  "Lang beskrivelse": "Konflikter mellem personer.",
  topics: []
}), [], "false war matches do not become broad Krig topics");
assert.ok(suggestSearchTopics({ Titel: "Ukraine under invasion", "Kort beskrivelse": "Reportage om Ukraine og ukrainske byer.", topics: [] }).some((item) => item.topic === "Ukraine"));

console.log("Catalogue intake and quality-rule regressions passed.");
