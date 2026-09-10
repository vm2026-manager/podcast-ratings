import assert from "node:assert/strict";
import { validatePodcastIdentityContinuity } from "./podcast-identity-integrity.mjs";

const before = [{ Titel: "Bakspejl", "Podcast-ID": "bakspejl" }, { Titel: "Det vi taler om", "Podcast-ID": "det vi taler om" }];
const ratedPodcastKeys = ["bakspejl", "det vi taler om"];
const check = (candidate, migrations = {}) => validatePodcastIdentityContinuity({ previousRows: before, candidateRows: candidate, ratedPodcastKeys, migrations });
assert.equal(check([{ Titel: "Bakspejl", "Podcast-ID": "bakspejl" }, { Titel: "Det vi taler om", "Podcast-ID": "det vi taler om", Billedlink: "new-cover" }]).ok, true);
assert.equal(check([{ Titel: "Bakspejl" }, before[1]]).ok, false, "September-style blank identity must fail");
assert.equal(check([{ Titel: "Bakspejl", "Podcast-ID": "bakspejl-v2" }, before[1]]).ok, false, "changed identity must fail");
assert.equal(check([before[0]]).ok, false, "removed rated podcast must fail");
assert.equal(check([{ Titel: "Bakspejl", "Podcast-ID": "bakspejl-v2" }, before[1]], { bakspejl: "bakspejl-v2" }).ok, true, "explicit migration may pass");
console.log("Podcast identity integrity tests passed");
