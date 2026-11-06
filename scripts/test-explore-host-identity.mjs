import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const app = await readFile(new URL("../app.js", import.meta.url), "utf8");
const index = await readFile(new URL("../index.html", import.meta.url), "utf8");
const approvedHostCredits = new Map([
  ["hjernero", "Mads Hyldig & Martin Riis Kastrup"],
  ["single igen sæson 3", "Frida Bolm & Boris Hiort"],
  ["hvepsereden", "Fie Nygaard & Laura Krebs"],
  ["historiepodcasten", "Katrine Stegmann & Marie Brinch"],
  ["ugens krise", "Anna Thygesen & Lasse Laursen"],
  ["hr og fru fuhlendorff bare mellem os", "Karina Fuhlendorff & Christian Fuhlendorff"],
  ["slottet og sumpen", "Joachim B. Olsen & Anne Kirstine Cramon"],
  ["flyvende tallerken", "Frederik Dirks Gottlieb & Anja C. Andersen"]
]);
const catalogue = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")).rows
  .map((row) => approvedHostCredits.has(row["Podcast-ID"])
    ? { ...row, Vært: approvedHostCredits.get(row["Podcast-ID"]) }
    : row);
function extractFunction(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} must exist`);
  const end = start + app.slice(start).search(/\n}\r?\n/);
  return app.slice(start, end + 2);
}

const version = Number(app.match(/const UDFORSK_RECOMMENDATION_VERSION = (\d+);/)[1]);
assert.equal(version, 9, "personalized recommendation snapshots use individual host identities");
assert.match(index, /app\.js\?v=20261105-individuelle-vaerter-v1[^"']*issue68-host-identities-v1=1/u,
  "the asset URL changes so clients request individual host identities after deployment");
assert.match(index, /issue66-clickable-hosts-v1=1/u,
  "the clickable ranking host behavior has its own app.js cache version");

const context = vm.createContext({});
vm.runInContext([
  "normalizeText", "normalizeComparable", "normalizeHostPersonKey", "parseHostPeople",
  "getHostPeople", "getComparableHostParts", "hostsMatchComparable", "getExploreMatchedHostName"
].map(extractFunction).join("\n"), context);
const matches = context.hostsMatchComparable;

assert.equal(matches("Mads & Martin", "Martin Grønne & Henning Kristensen"), false,
  "a synthetic short first-name group does not match full Bakspejl names");
assert.equal(matches("Mads & Martin", "Mads Hyldig & Martin Riis Kastrup"), false,
  "the synthetic short-name group remains distinct from HjerneRO's verified full names");
assert.equal(matches("Martin Grønne", "Martin Grønne & Henning Kristensen"), true,
  "a full host name matches the same person in a group");
assert.equal(matches("Henning Kristensen", "Martin Grønne & Henning Kristensen"), true,
  "the other full host name matches the same group");
assert.equal(matches("Martin Grønne & Henning Kristensen", "Henning Kristensen / Martin Grønne"), true,
  "separators identify the same full people in either credit order");
assert.equal(matches("  CÉLINE   KLINT ", "Celine Klint"), true,
  "identical normalized full host names match");
assert.equal(matches("Grønne Martin", "Martin Grønne"), true,
  "a full name remains identifiable when its token order is reversed");
assert.equal(matches("Martin Petersen", "Martin Grønne"), false,
  "a shared first name does not identify a host");
assert.equal(matches("Henning Hansen", "Henning Kristensen"), false,
  "a shared first name does not identify a host");
assert.equal(matches("Grønne", "Martin Grønne"), false,
  "a partial surname does not identify a host");
assert.equal(matches("Anne-Marie Nielsen", "Anne Marie Nielsen"), false,
  "similar or substring names are not fuzzy-matched");
assert.equal(matches("Mads & Martin", "Mads & Martin"), false,
  "an ambiguous group of first names does not invent person identities");
for (const separator of ["&", "og", ",", ";", "/"]) {
  assert.equal(matches(`Martin Grønne ${separator} Henning Kristensen`, "Martin Grønne"), true,
    `${separator} safely separates identifiable full names`);
}
assert.equal(matches("Martin Grønne, m.fl.", "Martin Grønne"), true,
  "an explicit full name remains known without inventing additional people");
assert.equal(matches("Mads", "Mads Martin"), false, "a single given name is never a person identity");
assert.equal(matches("Vært for DR Radio", "Radio DR"), false, "roles and organizations are rejected");
assert.equal(matches("", "Martin Grønne"), false, "empty host fields fail closed");
assert.equal(matches("Ukendt", "Ukendt"), false, "unknown short names do not match themselves");
assert.equal(matches("Joachim B. Olsen", "Joachim B. Olsen"), true,
  "the verified middle-initial credit is an exact identifiable person");
assert.equal(matches("Anja C. Andersen", "Anja C. Andersen"), true,
  "the second verified middle-initial credit is an exact identifiable person");
assert.equal(matches("Joachim Z. Olsen", "Joachim B. Olsen"), false,
  "an unverified initial does not match a verified full name");
assert.equal(matches("Niels Q. Hansen", "Niels Q. Hansen"), false,
  "an arbitrary middle initial does not create a person identity");

const peopleContext = vm.createContext({});
vm.runInContext([
  extractFunction("normalizeText"), extractFunction("normalizeComparable"),
  extractFunction("normalizeHostPersonKey"), extractFunction("parseHostPeople"), extractFunction("getHostPeople"),
  extractFunction("addExploreHostSignal")
].join("\n"), peopleContext);
const people = peopleContext.parseHostPeople("Martin Grønne & Henning Kristensen");
assert.deepEqual(Array.from(people, (person) => person.name), ["Martin Grønne", "Henning Kristensen"]);
assert.equal(peopleContext.parseHostPeople("Mads & Martin").length, 0);
assert.deepEqual(Array.from(peopleContext.parseHostPeople("Joachim B. Olsen & Anja C. Andersen"), (person) => person.name),
  ["Joachim B. Olsen", "Anja C. Andersen"], "verified initials stay as part of two separate full person names");
assert.equal(peopleContext.parseHostPeople("Niels Q. Hansen").length, 0, "unverified initials are rejected");
const signals = [];
for (const [seedKey, credit] of [
  ["seed-a", "Anna Jensen & Bente Sørensen"],
  ["seed-b", "Bente Sørensen & Carl Nielsen"],
  ["seed-c", "Carl Nielsen & Dina Holm"]
]) {
  for (const person of peopleContext.parseHostPeople(credit)) {
    peopleContext.addExploreHostSignal(signals, person, 1, seedKey, true);
  }
}
assert.equal(signals.length, 4, "overlapping groups create four separate individual signals");
assert.equal(signals.find((signal) => signal.value === "Anna Jensen").positiveSeedKeys.size, 1);
assert.equal(signals.find((signal) => signal.value === "Bente Sørensen").positiveSeedKeys.size, 2);
assert.equal(signals.find((signal) => signal.value === "Carl Nielsen").positiveSeedKeys.size, 2);

const hjerneRoRow = catalogue.find((row) => row["Podcast-ID"] === "hjernero");
const bakspejlRows = catalogue.filter((row) => row.Hovedserie === "Bakspejl" && row.Vært);
const bakspejlSeedRow = bakspejlRows.find((row) => row.Vært === "Martin Grønne & Henning Kristensen");
assert.ok(hjerneRoRow && bakspejlSeedRow, "exact HjerneRO and Bakspejl catalogue rows exist");
assert.equal(hjerneRoRow.Vært, "Mads Hyldig & Martin Riis Kastrup", "HjerneRO uses its approved full host credit");
for (const [podcastId, hostCredit] of approvedHostCredits) {
  assert.equal(catalogue.find((row) => row["Podcast-ID"] === podcastId)?.Vært, hostCredit,
    `${podcastId} uses the approved full host credit in its synthetic fixture`);
}
assert.equal(bakspejlSeedRow.Vært, "Martin Grønne & Henning Kristensen", "Bakspejl catalogue host credit remains unchanged");
assert.ok(bakspejlSeedRow["Podcast-ID"] && bakspejlSeedRow.catalogue_id,
  "Podcast-ID and catalogue_id remain present and untouched");
assert.ok(Object.keys(bakspejlSeedRow).some((key) => /^Vur/i.test(key)),
  "the original rating identity remains present");
assert.ok("manualEpisodes" in bakspejlSeedRow || "Antal afsnit" in bakspejlSeedRow,
  "episode metadata remains present");
const mapPodcastSource = app.slice(app.indexOf("function mapPodcast("), app.indexOf("function deduplicatePodcasts("));
assert.match(mapPodcastSource, /const hostPeople = parseHostPeople\(host\);/u,
  "mapPodcast derives runtime people while retaining the raw host credit");
assert.match(mapPodcastSource, /\r?\n\s+host,\r?\n\s+hostPeople,\r?\n\s+rawRating,/u,
  "mapPodcast retains the original host credit beside its runtime identities");

const toPodcast = (row) => ({
  key: row["Podcast-ID"], title: row.Titel, host: row.Vært, mainSeries: row.Hovedserie
});
const seedPodcast = toPodcast(bakspejlSeedRow);
const publicPodcasts = [hjerneRoRow, ...bakspejlRows]
  .filter((row, index, rows) => rows.findIndex((candidate) => candidate["Podcast-ID"] === row["Podcast-ID"]) === index)
  .map(toPodcast);
const seed = { key: seedPodcast.key, podcast: seedPodcast, rating: 9, source: "rating" };
const profile = {
  ratingSeeds: [seed], savedSeeds: [], ratedKeys: new Set([seed.key]), savedKeys: new Set(),
  seedKeys: new Set([seed.key]), hostSignals: people.map((person, firstSeen) => ({
    key: person.key, value: person.name, weight: 1, firstSeen, positiveSeedKeys: new Set([seed.key])
  })),
  mainSeriesSignals: new Map()
};
const sectionContext = vm.createContext({
  state: { podcastSimilarityProductStatus: "loading", exploreClustersStatus: "ready" },
  EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE: 3,
  isLoggedIn: () => true,
  getExplorePreferenceProfile: () => profile,
  getExploreDailySeedPool: () => ({ dayKey: "20261103", seeds: [seed], diagnostics: [{ key: seed.key }] }),
  getExploreClusterSections: () => [],
  getExploreRecommendationInputFingerprint: () => "host-identity-test",
  getExploreSeedSectionItems: () => [],
  getExploreSeedTitle: () => `Fordi du gav ${seedPodcast.title}`,
  getPodcastKey: (podcast) => podcast?.key,
  resolvePublicPodcastDisplayItem: (podcast) => podcast,
  getPublicDisplayPodcasts: () => publicPodcasts,
  matchesExploreFilters: () => true,
  getExploreCandidateFit: (podcast) => ({ podcast, reason: "host", score: 1 }),
  getExplorePersonalCandidateItems: () => [],
  markExplorePersonalSeedsShown: () => {}
});
vm.runInContext([
  extractFunction("normalizeText"), extractFunction("normalizeComparable"),
  extractFunction("normalizeHostPersonKey"), extractFunction("parseHostPeople"),
  extractFunction("getHostPeople"),
  extractFunction("getComparableHostParts"), extractFunction("hostsMatchComparable"),
  extractFunction("getExploreMatchingHostSignal"), extractFunction("getExploreMatchedHostName"),
  extractFunction("getExplorePersonalSections")
].join("\n"), sectionContext);
const sections = sectionContext.getExplorePersonalSections({ maxSections: 1, limit: 30 });
assert.equal(sections.length, 1, "a Bakspejl host section is produced from the exact catalogue values");
assert.equal(sections[0].eyebrow, "Mere med en favoritvært");
assert.equal(sections[0].title, "Mere med Martin Grønne");
assert.ok(sections[0].items.length >= 3, "legitimate Bakspejl host recommendations remain visible");
assert.ok(sections[0].items.every((item) => matches(item.podcast.host, "Martin Grønne")),
  "the Martin section contains only shows credited to Martin as an identified person");
assert.ok(!sections[0].items.some((item) => item.podcast.key === hjerneRoRow["Podcast-ID"]),
  "HjerneRO is excluded from the Bakspejl host-based Explore section");

const reasonContext = vm.createContext({
  getExplorePodcastStats: () => ({ communityRating: 0, madsRating: 0, ratingCount: 0 }),
  getExploreSignalWeight: (signals, value) => signals.get(value) || 0
});
vm.runInContext([
  extractFunction("normalizeText"), extractFunction("normalizeComparable"),
  extractFunction("normalizeHostPersonKey"), extractFunction("parseHostPeople"),
  extractFunction("getHostPeople"),
  extractFunction("getComparableHostParts"), extractFunction("hostsMatchComparable"),
  extractFunction("getExploreMatchedHostName"), extractFunction("getExploreMatchingHostSignal"),
  extractFunction("getExploreCandidateFit"), extractFunction("getExploreRecommendationReason"),
  extractFunction("getExploreSeedMatch")
].join("\n"), reasonContext);
const reasonSeed = { podcast: { host: "Martin Grønne & Henning Kristensen", mainSeries: "", genre: "", publisher: "" } };
const reasonCandidate = { host: "Henning Kristensen / Martin Grønne", mainSeries: "", genre: "", publisher: "" };
const reasonProfile = {
  hostSignals: [
    { key: "grønne martin", value: "Martin Grønne", weight: 2, firstSeen: 0 },
    { key: "henning kristensen", value: "Henning Kristensen", weight: 2, firstSeen: 1 }
  ],
  mainSeriesSignals: new Map(), publisherSignals: new Map(), genreSignals: new Map()
};
assert.equal(reasonContext.getExploreCandidateFit(reasonCandidate, reasonProfile).reason, "Mere med Martin Grønne");
assert.equal(reasonContext.getExploreRecommendationReason(reasonCandidate, [reasonSeed], {
  hasCommunityRating: false, communityRating: 0, madsRating: 0
}), "Mere med Martin Grønne");
assert.equal(reasonContext.getExploreSeedMatch(reasonCandidate, reasonSeed).reason, "Mere med Martin Grønne");

console.log("Explore host identity regression checks passed.");
