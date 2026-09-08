import assert from "node:assert/strict";
import {
  buildExploreClustersPayload,
  parseClusterPodcastIds,
  validateRequiredHeaders
} from "./sync-sheet-data.mjs";

const headers = [
  "Klynge-ID", "Titel", "Beskrivelse", "Podcast-ID'er", "Aktiv", "Specificitet", "Sortering"
];
validateRequiredHeaders([headers], headers, "Udforsk-klynger");
assert.throws(() => validateRequiredHeaders([["Titel"]], headers, "Udforsk-klynger"), /mangler påkrævede kolonner/);
assert.deepEqual(parseClusterPodcastIds(" agent storm ; ; agent samsam "), ["agent storm", "agent samsam"]);

const payload = buildExploreClustersPayload([
  {
    "Klynge-ID": "spioner-agenter-undercover",
    Titel: "Spioner, agenter og undercover",
    Beskrivelse: "Efterretning, infiltration og ægte undercoveroperationer.",
    "Podcast-ID'er": "agent storm;agent samsam;agenterne",
    Aktiv: "JA", Specificitet: "3", Sortering: "20"
  },
  {
    "Klynge-ID": "inaktiv", Titel: "Inaktiv", Beskrivelse: "Udgår.",
    "Podcast-ID'er": "ukendt", Aktiv: "NEJ", Specificitet: "1", Sortering: "30"
  }
], [
  { "Podcast-ID": "agent storm" }, { "Podcast-ID": "agent samsam" }, { "Podcast-ID": "agenterne" }
], "2026-09-08T00:00:00.000Z");

assert.equal(payload.version, 1);
assert.equal(payload.positiveRatingThreshold, 7);
assert.equal(payload.clusters.length, 1);
assert.equal(payload.clusters[0].description.includes("ægte"), true);
assert.deepEqual(payload.clusters[0].podcastIds, ["agent storm", "agent samsam", "agenterne"]);
assert.throws(() => buildExploreClustersPayload([{
  "Klynge-ID": "fejl", Titel: "Fejl", Beskrivelse: "Fejl.",
  "Podcast-ID'er": "agent storm;agent storm;ukendt", Aktiv: "JA", Specificitet: "4", Sortering: "nej"
}], [{ "Podcast-ID": "agent storm" }]), /validering fejlede/);

console.log("Explore cluster sync tests passed.");
