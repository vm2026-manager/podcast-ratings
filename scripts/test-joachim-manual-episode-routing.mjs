import assert from "node:assert/strict";
import { slimPodcastRows } from "./sync-sheet-data.mjs";

const episodeTitles = [
  "Kapitel 1: Fodret som en foie gras-gås - Joachim B. Olsen",
  "Kapitel 2: Smidt hjem fra OL - Joachim B. Olsen",
  "Kapitel 3: Er du ikke ham Joachim Boldsen? - Joachim B. Olsen",
  "Kapitel 4: En grinagtig spidskandidat - Joachim B. Olsen",
  "Kapitel 5: Hovedet oppe i egen røv - Joachim B. Olsen"
];

const brokenSheetRows = [
  {
    "Podcast-ID": "superzoom",
    Titel: "SuperZoom",
    "Episoder": episodeTitles.join(";")
  },
  {
    "Podcast-ID": "joachim b olsen",
    Titel: "Joachim B. Olsen",
    Hovedserie: "Et kapitel for sig",
    "Antal afsnit": "5"
  },
  {
    "Podcast-ID": "another-podcast",
    Titel: "En anden podcast",
    "Episoder": "Bevar denne episode"
  }
];

const corrected = await slimPodcastRows(brokenSheetRows);
const superzoom = corrected.find((row) => row["Podcast-ID"] === "superzoom");
const joachim = corrected.find((row) => row["Podcast-ID"] === "joachim b olsen");
const another = corrected.find((row) => row["Podcast-ID"] === "another-podcast");

assert.equal(superzoom.manualEpisodes, undefined, "SuperZoom must not retain the five Joachim episodes");
assert.deepEqual(joachim.manualEpisodes, episodeTitles, "all five episodes must appear once and in chapter order");
for (const title of episodeTitles) {
  assert.equal(joachim.manualEpisodes.filter((episode) => episode === title).length, 1);
}
assert.deepEqual(another.manualEpisodes, ["Bevar denne episode"], "other podcast episode data must be unchanged");
assert.equal(joachim.Hovedserie, "Et kapitel for sig");
assert.equal(joachim["Antal afsnit"], "5");
assert.deepEqual(brokenSheetRows[0]["Episoder"], episodeTitles.join(";"), "source rows must not be mutated");

const secondPass = await slimPodcastRows(brokenSheetRows);
assert.deepEqual(
  secondPass.find((row) => row["Podcast-ID"] === "superzoom").manualEpisodes,
  undefined,
  "a second sync must not reintroduce the faulty assignment"
);
assert.deepEqual(
  secondPass.find((row) => row["Podcast-ID"] === "joachim b olsen").manualEpisodes,
  episodeTitles,
  "repeating a sync from the same faulty Sheet source must remain idempotent"
);
assert.deepEqual(secondPass, corrected, "repeated sync output must be identical");

const alreadyCorrectSheet = [
  { "Podcast-ID": "superzoom", Titel: "SuperZoom", "Episoder": "SuperZoom episode" },
  {
    "Podcast-ID": "joachim b olsen",
    Titel: "Joachim B. Olsen",
    "Episoder": `${episodeTitles.join(";")};Sheet note episode`
  }
];
const correctSourceOutput = await slimPodcastRows(alreadyCorrectSheet);
assert.deepEqual(
  correctSourceOutput.find((row) => row["Podcast-ID"] === "superzoom").manualEpisodes,
  ["SuperZoom episode"],
  "a corrected Sheet source must be left as authored"
);
assert.deepEqual(
  correctSourceOutput.find((row) => row["Podcast-ID"] === "joachim b olsen").manualEpisodes,
  [...episodeTitles, "Sheet note episode"],
  "a corrected Sheet source and its unrelated episodes must not be overwritten"
);

console.log("Joachim manual episode routing passed: exact identities, order, idempotency, and unaffected rows.");
