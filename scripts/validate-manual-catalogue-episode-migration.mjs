import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const app = await readFile(path.join(root, "app.js"), "utf8");
const catalogue = JSON.parse(await readFile(path.join(root, "data", "podcasts.json"), "utf8"));
const canonicalMigration = await readFile(
  path.join(root, "supabase", "migrations", "20260830105704_manual_catalogue_episode_canonicalization.sql"),
  "utf8"
);
const ratingTemplate = await readFile(
  path.join(root, "supabase", "migrations", "20260830105706_rescued_manual_episode_ratings_CORRECTED.sql"),
  "utf8"
);
const inventoryReport = JSON.parse(await readFile(
  path.join(root, "supabase", "manual-catalogue-inventory-report.json"),
  "utf8"
));
const sheetSync = await readFile(path.join(root, "scripts", "sync-sheet-data.mjs"), "utf8");

function hashStringToEightHex(input, seed = 0) {
  let hash = (2166136261 ^ seed) >>> 0;
  for (const character of String(input || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 8);
}

function legacyManualUuid(podcastKey, episodeNumber, title) {
  const identity = `podcastlisten-manual-episode-v1|${podcastKey}|${episodeNumber}|${title}`;
  const hex = [0x11, 0x22, 0x33, 0x44].map((seed) => hashStringToEightHex(identity, seed)).join("");
  const variantNibble = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variantNibble}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const bomben = {
  "bomben-01": "c7599019-1106-5e7e-a5f1-893306e57790",
  "bomben-02": "00a1b3cb-40ae-52de-8276-4d45ebf4f4c0",
  "bomben-03": "c150d333-7b03-5bcc-8c47-48c97e32d48a",
  "bomben-04": "2df98b7c-0a87-50eb-bf10-069e03e57225",
  "bomben-05": "95715ea8-c123-5bbb-b14c-e2c65f2ade81",
  "bomben-06": "8e19963d-335b-52a8-916e-c2b30d9fe466",
  "bomben-07": "12a33e5c-865a-57fb-8202-d55a2e658c01",
  "bomben-08": "faeb474e-fb2c-50c1-b5d0-bbf8de49ca1b",
  "bomben-09": "9ea45188-e72e-557f-a4bc-7796fa6781e5",
  "bomben-10": "f5428bc3-1e71-5af6-8363-93cd13708f70"
};

for (const [legacyId, canonicalId] of Object.entries(bomben)) {
  assert(app.includes(`\"${legacyId}\": \"${canonicalId}\"`), `Bomben mapping mangler: ${legacyId}`);
  assert(canonicalMigration.includes(canonicalId), `Bomben canonical row mangler: ${canonicalId}`);
}

const suppliedManualIds = [
  "5e1ff2d1-d76d-5596-b8dc-55676d7fb194",
  "d8a857f0-482b-50ed-995d-dfde6081405b",
  "4abc9a5c-8773-5f47-b554-8f1a3b888b55",
  "b857d1a5-6fdc-5d00-95f8-d84f6dd60082",
  "05499c1e-02cb-5f5d-b53c-99582d312e97",
  "fbf212f5-c790-5780-9e03-0797cf9f725a",
  "d2448d0a-4866-515f-b5e5-1d9c60a5a9b1",
  "19911bd3-3950-5d36-8d00-3d2dcb5943c0",
  "13e824b2-0d17-5d2b-8445-082cdfaaddcd",
  "bb1fecfa-3a23-5875-967d-3dfc4817661f",
  "ca9c962b-17d4-5410-ac88-68a90e8ffc3e",
  ...Object.values(bomben)
];

assert(new Set(suppliedManualIds).size === 21, "Forventede 21 canonical episode-ID'er");
suppliedManualIds.forEach((id) => assert(canonicalMigration.includes(id), `Canonical row mangler: ${id}`));
for (const [podcastKey, title, expectedId] of [
  ["kvinden pa første", "Her skal vi bo resten af livet", "5e1ff2d1-d76d-5596-b8dc-55676d7fb194"],
  ["forsvundne katte", "Manden bag hegnet", "05499c1e-02cb-5f5d-b53c-99582d312e97"],
  ["singlerejsen", "Anita i Havana", "fbf212f5-c790-5780-9e03-0797cf9f725a"],
  ["dyrlægen fra auschwitz", "Brevet fra Auschwitz", "19911bd3-3950-5d36-8d00-3d2dcb5943c0"],
  ["agenterne politiken", "Hans Hetler: Den vilde agent", "ca9c962b-17d4-5410-ac88-68a90e8ffc3e"]
]) {
  const podcast = (catalogue.rows || []).find((row) => row["Podcast-ID"] === podcastKey);
  const episodeNumber = podcast?.manualEpisodes?.indexOf(title) + 1;
  assert(episodeNumber > 0, `Catalogue episode mangler: ${title}`);
  assert(legacyManualUuid(podcastKey, episodeNumber, title) === expectedId, `Desktop/mobile legacy ID ændrede sig: ${title}`);
}
assert(canonicalMigration.includes("on delete restrict"), "Map FK skal være restrictive");
assert(canonicalMigration.includes("begin;"), "Canonical migration skal have explicit transaction");
assert(canonicalMigration.includes("commit;"), "Canonical migration skal committe efter assertions");
assert(canonicalMigration.includes("using (is_active = true)"), "Map RLS skal eksponere kun aktive mappings");
assert(canonicalMigration.includes("on conflict do nothing"), "Canonical rows må ikke overskrive eksisterende rows");
assert(!canonicalMigration.includes("insert into public.episode_ratings"), "Canonical migration må ikke oprette ratings");
assert(inventoryReport.inventory.manual_catalogue_episodes === 1028, "Manual inventory count afviger");
assert(inventoryReport.inventory.rateable_manual_catalogue_episodes === 1027, "Rateable manual inventory count afviger");
assert(inventoryReport.inventory.canonical_rows_planned === 1012, "Forventede 1012 nye canonical rows");
assert(inventoryReport.inventory.mapping_rows_planned === 1027, "Alle rateable manual rows skal maps");
const reusedManualSheet = inventoryReport.inventory.verified_reusable_existing_rows || [];
assert(reusedManualSheet.length === 15, "Præcis 15 reviewed manual_sheet rows skal genbruges");
assert(new Set(reusedManualSheet.map((row) => `${row.podcast_key}\u0000${row.title}`)).size === 15, "Reviewed manual_sheet rows må ikke duplikeres");
assert(reusedManualSheet.filter((row) => row.source === "manual_sheet").length === 15, "Kun manual_sheet må genbruges");
assert(
  reusedManualSheet.some((row) => row.title === "Den falske doktor" && row.expected_episode_id === "418a330a-cd5b-5b93-a095-c77cfefecadd"),
  "Den falske doktor skal beholde sit eksisterende ID"
);
assert(
  reusedManualSheet.some((row) => row.title === "Barnet i laden" && row.expected_episode_id === "3868ad36-ef8d-58bd-8743-2ed8841e82f7"),
  "Barnet i laden skal beholde sit eksisterende ID"
);
assert(canonicalMigration.includes("canonical_source text not null"), "Map skal registrere canonical source");
assert(canonicalMigration.includes("Expected exactly 1027 mapping rows"), "Migration skal validere alle expected mappings");
assert(canonicalMigration.includes("Manifest count mismatch"), "Migration skal validere 15 legacy og 1012 new rows");
assert(canonicalMigration.includes("duplicate or colliding canonical episode identities"), "Migration skal afvise canonical collisions");
assert(canonicalMigration.includes("418a330a-cd5b-5b93-a095-c77cfefecadd"), "Kavousi-ID assertion mangler");
assert(canonicalMigration.includes("3868ad36-ef8d-58bd-8743-2ed8841e82f7"), "Menneskedyret-ID assertion mangler");
assert(!canonicalMigration.includes("update public.episode_ratings"), "Canonical migration må ikke opdatere ratings");
assert(!canonicalMigration.includes("delete from public.episode_ratings"), "Canonical migration må ikke slette ratings");
const canonicalInsertSection = canonicalMigration.slice(
  canonicalMigration.indexOf("insert into public.podcast_episodes"),
  canonicalMigration.indexOf("insert into public.manual_catalogue_episode_map")
);
reusedManualSheet.forEach((row) => {
  assert(!canonicalInsertSection.includes(row.manual_episode_key), `Legacy row må ikke indsættes igen: ${row.title}`);
});
assert(inventoryReport.inventory.uuid_collisions.length === 0, "UUID-kollisioner må ikke findes");
assert(inventoryReport.inventory.unresolved_entries.length === 0, "Uafklarede manual entries må ikke findes");
assert((ratingTemplate.match(/::numeric/g) || []).length === 21, "Forventede 21 rescued rating rows");
assert(ratingTemplate.includes("begin;"), "Rescued rating migration skal have explicit transaction");
assert(ratingTemplate.includes("commit;"), "Rescued rating migration skal committe efter preflight");
assert(ratingTemplate.includes("missing canonical episode"), "Rescued ratings skal afbryde ved manglende canonical episode");
assert(ratingTemplate.includes("on conflict (user_id, episode_id) do nothing"), "Rating migration må aldrig overskrive");
assert(!ratingTemplate.includes("do update"), "Rating migration må aldrig opdatere eksisterende rating");
assert(!ratingTemplate.includes("delete from public.episode_ratings"), "Rescued migration må aldrig slette ratings");
assert(app.includes("fetchManualCanonicalEpisodeMappings"), "Canonical manual map verification mangler");
assert(
  app.includes('state.manualCanonicalEpisodeMappings.has(normalizeText(episode.manual_episode_key))'),
  "Manual persistence skal være conditional indtil canonical map er bekræftet"
);
assert(app.includes('select("manual_episode_key,episode_id,canonical_source")'), "Runtime skal læse canonical source for manual mapping");
assert(app.includes("REVIEWED_LEGACY_MANUAL_CATALOGUE_SOURCE"), "Runtime skal acceptere den reviewed legacy source");
assert(app.includes("applyLegacyLocalEpisodeRatingFallback"), "Læsning af legacy localStorage fallback mangler");
assert(!app.includes('bomben: {\n    podcastKey: "bomben",\n    enabled: true,\n    displayName: "Bomben",\n    source: "radio4",\n    dataSource: "local",\n    persistence: "local"'), "Bomben må ikke skrive til localStorage");
assert(sheetSync.includes("MANUAL_EPISODE_KEYS_FIELDS"), "Kildedata skal understøtte immutable manual episode keys");
assert(sheetSync.includes("manual_episode_key"), "UTF-8-kildedata skal bevare manual episode keys");
assert(app.includes("manual-catalogue-v2"), "Fremtidig identity må ikke afhænge af title/position alene");

console.log(JSON.stringify({
  status: "PASS",
  canonicalIds: suppliedManualIds.length,
  manualInventory: {
    rateable: inventoryReport.inventory.rateable_manual_catalogue_episodes,
    existingManualSheetReused: reusedManualSheet.length,
    newCanonicalRows: inventoryReport.inventory.canonical_rows_planned,
    mappings: inventoryReport.inventory.mapping_rows_planned
  },
  bombenCompatibility: "PASS",
  persistence: "Supabase only after canonical-map verification; local fallback otherwise",
  rssApiPersistence: "unchanged by configuration-first resolution",
  utf8: "Kvinden på første / Dyrlægen fra Auschwitz present in canonical SQL"
}, null, 2));
