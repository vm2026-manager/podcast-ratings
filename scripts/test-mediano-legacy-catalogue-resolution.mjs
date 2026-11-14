import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, payload, countDoc] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"),
  readFile(new URL("../docs/catalogue-runtime-count.md", import.meta.url), "utf8")
]);
const rows = (JSON.parse(payload).rows || []).map((row) => ({
  id: String(row["Podcast-ID"] || "").trim(),
  title: String(row.Titel || "").trim(),
  publisher: String(row.Udgiver || "").trim(),
  mainSeries: String(row.Hovedserie || "").trim(),
  rating: String(row["Vuring (1-10)"] || "").trim()
}));

const aliases = {
  "vi præsenterer erik skjærbæk": "klub mediano",
  "sadan blev han victor froholdt": "klub mediano",
  "sådan blev han victor froholdt": "klub mediano",
  "den store talentserie": "klub mediano"
  , "mediano special hvad siger data om superligaen": "mediano special"
  , "der var engang et mal af peter møller mod farum": "der var engang et mal"
  , "her er vores bud pa de ti spillere har været de største transfersucceser i superligaen": "transfer special"
  , "sagen om de 15 point forsvandt fra i lommen af den gamle dame": "mediano special"
  , "landsholdets analytiker mounir akhiat": "troels bech i en samtale"
  , "kristjaan speakmann": "bruchmann ringer til"
};
const jenningsLegacyIds = rows.filter((row) => row.publisher === "Mediano" && row.mainSeries === "Jennings").map((row) => row.id);
assert.equal(jenningsLegacyIds.length, 18, "all reviewed Jennings legacy rows are enumerated");
const jenningsAliases = Object.fromEntries(jenningsLegacyIds.map((id) => [id, "magasinet jennings"]));
Object.assign(aliases, jenningsAliases);
const localCanonicalIds = new Set([
  "magasinet jennings",
  "mediano special",
  "transfer special",
  "bruchmann ringer til",
  "der var engang et mal",
  "kampen om historien dr"
]);
const canonicalIds = new Set(rows.map((row) => row.id));
assert.ok(rows.every((row) => row.id), "every source row has an exact Podcast-ID");
assert.equal(canonicalIds.size, rows.length, "raw catalogue Podcast-IDs stay unique");
const allCurrentIds = new Set([...canonicalIds, ...localCanonicalIds]);
const suppressedRows = rows.filter((row) => aliases[row.id] && allCurrentIds.has(aliases[row.id]));
const suppressedIds = suppressedRows.map((row) => row.id).sort();
const expectedSuppressedIds = [
  "ciao gianni",
  "den store talentserie",
  "der var engang et mal af peter møller mod farum",
  "eksklusivt interview med jesper møller om fifa og infantino",
  "fodbold og samfund med wrexham st pauli athletic club vsk og aarhus fremad",
  "forudsigelsesmarkederne er kommet for at blive derfor skal det bekymre dig",
  "fra johnny til donny fredspris fifa og forspil til vm 2026",
  "her er scenariet alle frygter betting bag superliga og samtlige divisioner",
  "her er vores bud pa de ti spillere har været de største transfersucceser i superligaen",
  "infantino abner for russisk comeback dbu reagerer",
  "infantino foran genvalg iran overladt til sig selv og fifa i mystisk sponsorat",
  "infantinos mislykkede fredsforsøg dyrt vm og saudisk nedjustering",
  "jesper møller ved ikke om dbu vil stemme pa infantino det har vi ikke taget stilling til endnu",
  "kristjaan speakmann",
  "landsholdets analytiker mounir akhiat",
  "landskabet for dansk børnefodbold med politiken og fc københavn",
  "mediano special hvad siger data om superligaen",
  "sadan blev han victor froholdt",
  "sagen om de 15 point forsvandt fra i lommen af den gamle dame",
  "sprængfarlig rapport om datagigant det gra marked i england og tryktest af christiansborg",
  "trumps krig sætter fifa i kattepine og european super league er død",
  "vi præsenterer erik skjærbæk",
  "vm boykot handboldchef har faet nok og city sag trækker i langdrag",
  "vm optakt sadan lyder infantino bag facaden",
  "vm special om trump infantino indrejseproblemer og manden bag balogun breaking",
  "whistlebloweren der afslørede qatar sadan snød vi verdenspressen",
  "flere priser flere aftaler og flere penge op af fansenes lommer"
].sort();
assert.deepEqual(suppressedIds, expectedSuppressedIds, "only exact reviewed Mediano episode IDs with present canonical targets are suppressed");
assert.ok(rows.every((row) => row.title), "every source row survives the runtime's title-presence check");
const localAdditions = [...localCanonicalIds].filter((id) => !canonicalIds.has(id));
for (const id of localAdditions) {
  assert.match(app, new RegExp(`"Podcast-ID": "${id}"`, "u"), `${id} must be an exact local canonical Podcast-ID`);
}
for (const row of suppressedRows) {
  const escapedId = row.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  assert.match(
    app,
    new RegExp(`"${escapedId}": "${aliases[row.id]}"`, "u"),
    `${row.id} must use its reviewed exact-ID mapping to ${aliases[row.id]}`
  );
}
const visibleIds = new Set([
  ...localCanonicalIds,
  ...rows
    .filter((row) => !aliases[row.id] || !allCurrentIds.has(aliases[row.id]))
    .map((row) => row.id)
]);
const retainedRawIds = rows.map((row) => row.id).filter((id) => visibleIds.has(id)).sort();
assert.ok(suppressedIds.every((id) => !visibleIds.has(id)), "suppressed episode IDs are not also emitted as podcasts");
assert.deepEqual(
  [...retainedRawIds, ...suppressedIds].sort(),
  [...canonicalIds].sort(),
  "every raw Podcast-ID is either retained exactly or routed by its exact legacy mapping"
);
assert.equal(
  visibleIds.size,
  rows.length + localAdditions.length - suppressedRows.length,
  "runtime count is raw unique IDs + missing reviewed local canonicals - exact legacy episode IDs"
);
const formatCount = (value) => new Intl.NumberFormat("en-US").format(value);
const currentFormula = `${formatCount(rows.length)} raw rows + ${formatCount(localAdditions.length)} local canonical rows - ${formatCount(suppressedRows.length)} legacy episode rows = ${formatCount(visibleIds.size)}`;
assert.ok(
  countDoc.includes(`For the 14 November 2026 catalogue, the published JSON contains ${formatCount(rows.length)} unique`) &&
    countDoc.includes(currentFormula),
  "the dated runtime-count documentation matches the data-derived catalogue/runtime calculation"
);
assert.ok(visibleIds.has("balkans knuste hjerte"), "Balkans remains a direct current podcast ID");
assert.ok(visibleIds.has("hvem er saveus"), "Saveus remains a direct current podcast ID");

assert.equal(rows.find((row) => row.id === "vi præsenterer erik skjærbæk")?.mainSeries, "Klub Mediano");
assert.equal(rows.find((row) => row.id === "sadan blev han victor froholdt")?.mainSeries, "Klub Mediano");
assert.equal(rows.find((row) => row.id === "klub mediano")?.title, "Klub Mediano");
assert.equal(rows.find((row) => row.id === "klub mediano")?.publisher, "Mediano");
assert.equal(visibleIds.has("vi præsenterer erik skjærbæk"), false);
assert.equal(visibleIds.has("sadan blev han victor froholdt"), false);
assert.equal(visibleIds.has("den store talentserie"), false);
assert.equal(visibleIds.has("mediano special hvad siger data om superligaen"), false);
assert.equal(visibleIds.has("mediano special"), true);
assert.equal(visibleIds.has("klub mediano"), true);
assert.equal(visibleIds.has("kampen om historien dr"), true);
assert.equal(visibleIds.has("ciao gianni"), false);
assert.equal(visibleIds.has("infantino abner for russisk comeback dbu reagerer"), false);
assert.match(app, /"Podcast-ID": "magasinet jennings"/u);
assert.match(app, /Titel: "Magasinet Jennings"/u);
assert.match(app, /source: "mediano_public_rss"/u);

// No title-prefix or colon-based suppression: reviewed-but-unresolved parents
// remain current catalogue identities until a canonical catalogue row exists.
for (const id of [
  "mediano em speciel 2021",
  "super",
  "troels bech i en samtale",
  "vm manager special"
]) assert.equal(visibleIds.has(id), true, `${id} must remain visible without a present canonical target`);

assert.match(app, /MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS/u);
assert.match(app, /const canonicalId = MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS\[storedKey\]/u);
assert.match(app, /cataloguePodcastIds\.has\(canonicalId\)/u);
assert.match(app, /state\.podcastByKey\[legacyKey\] = canonicalPodcast/u);
assert.match(app, /"sadan blev han victor froholdt": "klub mediano"/u);
assert.match(app, /"sådan blev han victor froholdt": "klub mediano"/u);
assert.match(app, /"den store talentserie": "klub mediano"/u);
assert.match(app, /"mediano special hvad siger data om superligaen": "mediano special"/u);
assert.match(app, /LOCAL_CANONICAL_CATALOGUE_ROW_PATCHES/u);
assert.match(app, /title: "Den store talentserie"/u);
assert.match(app, /manualEpisodeKey: "den-store-talentserie"/u);
assert.match(app, /manualEpisodeKey: "mediano-special-hvad-siger-data-om-superligaen"/u);
assert.match(app, /"klub mediano"[\s\S]*?includeManualEpisodes/u);

// Existing ratings and saved-podcast resolvers operate through
// resolvePodcastByStoredKey(), so these explicit old keys are canonicalized
// before their raw persisted key is retained for writes.
assert.match(app, /function resolveCanonicalPodcastId[\s\S]*?resolvePodcastByStoredKey\(storedKey\)/u);
assert.match(app, /function resolveSavedPodcastKey[\s\S]*?resolveCanonicalPodcastId/u);
assert.match(app, /function getPersistedUserRatingKey[\s\S]*?userRatingPersistedKeyByCanonical/u);
assert.equal(rows.find((row) => row.id === "sadan blev han victor froholdt")?.title, "Sådan blev han Victor Froholdt");

// Display groups do not remove their exact catalogue members from state.podcasts.
// Ranking presentation replaces these 13 source rows with two synthetic groups
// (net -11 ranking cards); this is separate from the 27 Mediano legacy episodes.
const displayGroups = JSON.parse(await readFile(new URL("../data/podcast-display-groups.json", import.meta.url), "utf8")).groups
  .filter((group) => group.rankingEnabled);
const groupedMemberIds = displayGroups.flatMap((group) => group.memberLegacyKeys);
assert.equal(groupedMemberIds.length, 13, "active display groups contain 13 exact catalogue members");
assert.ok(groupedMemberIds.every((id) => visibleIds.has(id)), "group members remain in the canonical podcast lookup");
assert.equal(displayGroups.length, 2, "the ranking representation has two synthetic display groups");

console.log(JSON.stringify({
  rawPodcastIds: rows.length,
  localCanonicalAdditions: localAdditions.length,
  exactLegacyEpisodesRouted: suppressedRows.length,
  internalPodcastCount: visibleIds.size,
  rankingGroupMembers: groupedMemberIds.length,
  rankingDisplayGroups: displayGroups.length,
  rankingDeltaFromGrouping: groupedMemberIds.length - displayGroups.length,
  "balkans knuste hjerte": visibleIds.has("balkans knuste hjerte"),
  "hvem er saveus": visibleIds.has("hvem er saveus")
}, null, 2));

console.log("Mediano legacy catalogue resolution regression checks passed.");
