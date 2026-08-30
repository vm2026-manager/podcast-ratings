import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const migrationPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260830105704_manual_catalogue_episode_canonicalization.sql"
);
const reportPath = path.join(root, "supabase", "manual-catalogue-inventory-report.json");

const BOMBEN_CANONICAL_IDS = Object.freeze({
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
});

// Read-only production review identified these as the only legacy canonical
// manual rows. This is intentionally an explicit (podcast, source, title)
// allowlist: no RSS/API/Apple row is ever reused by a loose title match.
// Two IDs are asserted because the production inspection supplied them; the
// migration asserts that all 15 exact reviewed identities resolve one-to-one.
const REVIEWED_MANUAL_SHEET_EPISODES = Object.freeze([
  ["den forunderlige dr kavousi", "Den falske doktor", "418a330a-cd5b-5b93-a095-c77cfefecadd"],
  ["den forunderlige dr kavousi", "Tusindkunstneren", ""],
  ["den forunderlige dr kavousi", "Nedsmeltningen indefra", ""],
  ["den forunderlige dr kavousi", "The best is yet to come", ""],
  ["kvinden med den tunge kuffert", "En ny klostergæst", ""],
  ["kvinden med den tunge kuffert", "Fra vin til vand", ""],
  ["kvinden med den tunge kuffert", "Sporet", ""],
  ["kvinden med den tunge kuffert", "Sønnen-i-kisten-fidusen", ""],
  ["kvinden med den tunge kuffert", "En fremkaldt vildfarelse", ""],
  ["kvinden med den tunge kuffert", "Tre Tips", ""],
  ["kvinden med den tunge kuffert", "Præstnet", ""],
  ["kvinden med den tunge kuffert", "Mødet", ""],
  ["menneskedyret", "Barnet i laden", "3868ad36-ef8d-58bd-8743-2ed8841e82f7"],
  ["menneskedyret", "Den falske Harry Jensen", ""],
  ["menneskedyret", "En stædig mor", ""]
].map(([podcastKey, title, expectedEpisodeId]) => ({ podcastKey, title, expectedEpisodeId })));

const normalizeText = (value) => String(value ?? "").trim();
const quoteSql = (value) => `'${String(value).replaceAll("'", "''")}'`;

function hashStringToEightHex(input, seed = 0) {
  let hash = (2166136261 ^ seed) >>> 0;
  for (const character of String(input || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0").slice(0, 8);
}

function createStableManualEpisodeUuid(podcastKey, episodeNumber, title) {
  const identity = `podcastlisten-manual-episode-v1|${podcastKey}|${episodeNumber}|${title}`;
  const hex = [0x11, 0x22, 0x33, 0x44].map((seed) => hashStringToEightHex(identity, seed)).join("");
  const variantNibble = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variantNibble}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function createStableManualCatalogueEpisodeUuid(podcastKey, manualEpisodeKey) {
  const identity = `podcastlisten-manual-catalogue-v2|${podcastKey}|${manualEpisodeKey}`;
  const hex = [0x51, 0x52, 0x53, 0x54].map((seed) => hashStringToEightHex(identity, seed)).join("");
  const variantNibble = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variantNibble}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function rateableManualEntries(podcast) {
  const sourceEntries = Array.isArray(podcast.manualEpisodes) ? podcast.manualEpisodes : [];
  if (sourceEntries.length < 2) return [];
  const seen = new Set();
  return sourceEntries.map((entry) => ({
    title: normalizeText(typeof entry === "object" ? entry?.title : entry),
    manualEpisodeKey: normalizeText(
      typeof entry === "object" ? entry?.manual_episode_key || entry?.manualEpisodeKey : ""
    )
  })).filter(({ title }) => {
    if (!title || seen.has(title) || /\b(?:teaser|trailer)\b/i.test(title)) return false;
    seen.add(title);
    return true;
  });
}

const payload = JSON.parse(await readFile(path.join(root, "data", "podcasts.json"), "utf8"));
const podcasts = Array.isArray(payload) ? payload : payload.rows || [];
const rows = [];
const unresolved = [];
let sourceManualEpisodeCount = 0;
let excludedSingleEpisodeCount = 0;
let excludedTeaserTrailerCount = 0;

for (const podcast of podcasts) {
  const podcastKey = normalizeText(podcast["Podcast-ID"]);
  const rawManualEpisodes = Array.isArray(podcast.manualEpisodes) ? podcast.manualEpisodes : [];
  sourceManualEpisodeCount += rawManualEpisodes.length;
  if (rawManualEpisodes.length === 1) excludedSingleEpisodeCount += 1;
  excludedTeaserTrailerCount += rawManualEpisodes
    .map(normalizeText)
    .filter((title) => /\b(?:teaser|trailer)\b/i.test(title)).length;
  const entries = rateableManualEntries(podcast);
  if (!entries.length) continue;
  if (!podcastKey) {
    unresolved.push({ title: normalizeText(podcast.Titel), reason: "missing_podcast_key" });
    continue;
  }

  entries.forEach(({ title, manualEpisodeKey: explicitManualEpisodeKey }, index) => {
    const legacyId = podcastKey === "bomben" ? `bomben-${String(index + 1).padStart(2, "0")}` : "";
    const legacyCanonicalId = createStableManualEpisodeUuid(podcastKey, index + 1, title);
    const id = BOMBEN_CANONICAL_IDS[legacyId] || (
      explicitManualEpisodeKey
        ? createStableManualCatalogueEpisodeUuid(podcastKey, explicitManualEpisodeKey)
        : legacyCanonicalId
    );
    const manualEpisodeKey = explicitManualEpisodeKey
      ? `manual-catalogue-v2:${podcastKey}:${explicitManualEpisodeKey}`
      : `manual-catalogue-v1:${id}`;
    rows.push({
      id,
      podcastKey,
      title,
      episodeNumber: index + 1,
      manualEpisodeKey,
      externalGuid: `manual_catalogue_v1:${id}`,
      legacyEpisodeIds: legacyId ? [legacyId] : explicitManualEpisodeKey ? [legacyCanonicalId] : []
    });
  });
}

const ids = new Map();
const titles = new Map();
for (const row of rows) {
  ids.set(row.id, [...(ids.get(row.id) || []), row]);
  const titleKey = row.title.toLocaleLowerCase("da-DK");
  titles.set(titleKey, [...(titles.get(titleKey) || []), row]);
}
const uuidCollisions = [...ids.values()].filter((matches) => matches.length > 1);
const titlePodcastAmbiguities = [...titles.values()]
  .filter((matches) => new Set(matches.map((row) => row.podcastKey)).size > 1)
  .map((matches) => ({ title: matches[0].title, podcast_keys: [...new Set(matches.map((row) => row.podcastKey))].sort() }))
  .sort((left, right) => left.title.localeCompare(right.title, "da"));

const reviewedManualSheetByIdentity = new Map(
  REVIEWED_MANUAL_SHEET_EPISODES.map((entry) => [`${entry.podcastKey}\u0000${entry.title}`, entry])
);
const reusedLegacyRows = rows.filter((row) => reviewedManualSheetByIdentity.has(`${row.podcastKey}\u0000${row.title}`));
const newRows = rows.filter((row) => !reviewedManualSheetByIdentity.has(`${row.podcastKey}\u0000${row.title}`));
const reviewedRowsMissingFromInventory = REVIEWED_MANUAL_SHEET_EPISODES.filter(
  (entry) => !rows.some((row) => row.podcastKey === entry.podcastKey && row.title === entry.title)
);

if (reusedLegacyRows.length !== REVIEWED_MANUAL_SHEET_EPISODES.length || reviewedRowsMissingFromInventory.length) {
  throw new Error("Refusing to generate migration: reviewed manual_sheet inventory no longer matches current manual catalogue.");
}

if (uuidCollisions.length || unresolved.length) {
  throw new Error(`Refusing to generate migration: ${uuidCollisions.length} UUID collisions, ${unresolved.length} unresolved entries.`);
}

const manifestValues = rows.map((row) => {
  const reviewed = reviewedManualSheetByIdentity.get(`${row.podcastKey}\u0000${row.title}`);
  const legacySource = Boolean(reviewed);
  return `    (${quoteSql(row.manualEpisodeKey)}, ${quoteSql(row.podcastKey)}, ${legacySource && reviewed.expectedEpisodeId ? `${quoteSql(reviewed.expectedEpisodeId)}::uuid` : legacySource ? "null::uuid" : `${quoteSql(row.id)}::uuid`}, ${quoteSql(legacySource ? "manual_sheet" : "manual_catalogue_v1")}, ${legacySource ? "null::text" : quoteSql(row.externalGuid)}, ${quoteSql(row.title)}, ${row.legacyEpisodeIds.length ? `array[${row.legacyEpisodeIds.map(quoteSql).join(", ")}]` : "'{}'::text[]"}, ${row.episodeNumber})`;
}).join(",\n");
const sql = `-- Generated by scripts/generate-manual-catalogue-canonical-migration.mjs from current data/podcasts.json.
-- Review-only: this file has not been executed against Supabase.
-- All operations and assertions are one transaction; any failure rolls back.

begin;

create table if not exists public.manual_catalogue_episode_map (
  manual_episode_key text primary key,
  podcast_key text not null,
  episode_id uuid not null references public.podcast_episodes(id) on delete restrict,
  canonical_source text not null check (canonical_source in ('manual_catalogue_v1', 'manual_sheet')),
  legacy_episode_ids text[] not null default '{}',
  title text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (episode_id)
);

alter table public.manual_catalogue_episode_map enable row level security;
grant select on public.manual_catalogue_episode_map to anon, authenticated;
drop policy if exists "Manual catalogue episode map is publicly readable" on public.manual_catalogue_episode_map;
create policy "Manual catalogue episode map is publicly readable"
on public.manual_catalogue_episode_map for select to anon, authenticated using (is_active = true);

create temporary table manual_catalogue_expected_manifest (
  manual_episode_key text primary key,
  podcast_key text not null,
  expected_episode_id uuid,
  expected_source text not null check (expected_source in ('manual_catalogue_v1', 'manual_sheet')),
  expected_external_guid text,
  title text not null,
  legacy_episode_ids text[] not null,
  episode_number integer not null
) on commit drop;

insert into manual_catalogue_expected_manifest (
  manual_episode_key, podcast_key, expected_episode_id, expected_source,
  expected_external_guid, title, legacy_episode_ids, episode_number
) values
${manifestValues};

-- Resolve the 13 reviewed legacy IDs from their exact reviewed identity. The
-- two supplied IDs are already present in the manifest and remain asserted.
-- A missing row leaves NULL; an ambiguous identity raises a scalar-subquery
-- error. Either condition aborts this transaction before any permanent write.
update manual_catalogue_expected_manifest expected
set expected_episode_id = (
  select episode.id
  from public.podcast_episodes episode
  where episode.podcast_key = expected.podcast_key
    and episode.source = expected.expected_source
    and episode.title = expected.title
)
where expected.expected_source = 'manual_sheet'
  and expected.expected_episode_id is null;

insert into public.podcast_episodes (
  id, podcast_key, source, external_guid, external_episode_id, title, is_active, metadata
)
select
  expected_episode_id, podcast_key, 'manual_catalogue_v1', expected_external_guid, manual_episode_key, title, true,
  jsonb_build_object(
    'manual_catalogue', true,
    'manual_episode_key', manual_episode_key,
    'legacy_episode_ids', legacy_episode_ids,
    'catalogue_episode_number', episode_number,
    'identity_version', 'manual_catalogue_v1',
    'rateable', true
  )
from manual_catalogue_expected_manifest
where expected_source = 'manual_catalogue_v1'
on conflict do nothing;

insert into public.manual_catalogue_episode_map (
  manual_episode_key, podcast_key, episode_id, canonical_source, legacy_episode_ids, title, is_active
)
select
  manual_episode_key, podcast_key, expected_episode_id, expected_source, legacy_episode_ids, title, true
from manual_catalogue_expected_manifest
where expected_source = 'manual_catalogue_v1'
on conflict do nothing;

-- The 15 reviewed manual_sheet rows are only referenced, never modified.
insert into public.manual_catalogue_episode_map (
  manual_episode_key, podcast_key, episode_id, canonical_source, legacy_episode_ids, title, is_active
)
select
  expected.manual_episode_key, expected.podcast_key, episode.id, expected.expected_source,
  expected.legacy_episode_ids, expected.title, true
from manual_catalogue_expected_manifest expected
join public.podcast_episodes episode
  on episode.podcast_key = expected.podcast_key
 and episode.source = expected.expected_source
 and episode.title = expected.title
 and (expected.expected_episode_id is null or episode.id = expected.expected_episode_id)
where expected.expected_source = 'manual_sheet'
on conflict do nothing;

do $$
declare
  expected_count integer;
  expected_legacy_count integer;
  expected_new_count integer;
  map_count integer;
begin
  select count(*),
         count(*) filter (where expected_source = 'manual_sheet'),
         count(*) filter (where expected_source = 'manual_catalogue_v1')
    into expected_count, expected_legacy_count, expected_new_count
  from manual_catalogue_expected_manifest;
  if expected_count <> ${rows.length} or expected_legacy_count <> ${reusedLegacyRows.length} or expected_new_count <> ${newRows.length} then
    raise exception 'Manifest count mismatch: total %, legacy %, new %', expected_count, expected_legacy_count, expected_new_count;
  end if;
  if exists (
    select 1 from manual_catalogue_expected_manifest where expected_episode_id is null
  ) then
    raise exception 'Manual catalogue manifest has an unresolved canonical episode ID';
  end if;

  select count(*) into map_count from public.manual_catalogue_episode_map;
  if map_count <> ${rows.length} then
    raise exception 'Expected exactly ${rows.length} mapping rows, found %', map_count;
  end if;

  if exists (
    select 1
    from manual_catalogue_expected_manifest expected
    left join public.manual_catalogue_episode_map mapping
      on mapping.manual_episode_key = expected.manual_episode_key
    left join public.podcast_episodes episode
      on episode.id = mapping.episode_id
    where mapping.manual_episode_key is null
       or mapping.is_active is not true
       or mapping.podcast_key is distinct from expected.podcast_key
       or mapping.title is distinct from expected.title
       or mapping.canonical_source is distinct from expected.expected_source
       or episode.id is null
       or episode.podcast_key is distinct from expected.podcast_key
       or episode.title is distinct from expected.title
       or episode.source is distinct from expected.expected_source
       or (expected.expected_episode_id is not null and mapping.episode_id is distinct from expected.expected_episode_id)
       or (expected.expected_source = 'manual_catalogue_v1' and episode.external_guid is distinct from expected.expected_external_guid)
  ) then
    raise exception 'Manual catalogue manifest contains a missing, conflicting, inactive, or mismatched canonical identity';
  end if;

  if (select count(distinct mapping.episode_id)
      from public.manual_catalogue_episode_map mapping
      join manual_catalogue_expected_manifest expected using (manual_episode_key)) <> ${rows.length} then
    raise exception 'Manual catalogue manifest has duplicate or colliding canonical episode identities';
  end if;
end $$;

commit;
`;

const report = {
  generated_at: new Date().toISOString(),
  source: "data/podcasts.json",
  inventory: {
    manual_catalogue_episodes: sourceManualEpisodeCount,
    rateable_manual_catalogue_episodes: rows.length,
    excluded_single_episode_entries: excludedSingleEpisodeCount,
    excluded_teaser_or_trailer_entries: excludedTeaserTrailerCount,
    canonical_rows_planned: newRows.length,
    mapping_rows_planned: rows.length,
    verified_reusable_existing_rows: reusedLegacyRows.map((row) => {
      const reviewed = reviewedManualSheetByIdentity.get(`${row.podcastKey}\u0000${row.title}`);
      return {
        podcast_key: row.podcastKey,
        title: row.title,
        manual_episode_key: row.manualEpisodeKey,
        source: "manual_sheet",
        expected_episode_id: reviewed.expectedEpisodeId || null
      };
    }),
    uuid_collisions: uuidCollisions,
    title_podcast_ambiguities: titlePodcastAmbiguities,
    unresolved_entries: unresolved
  },
  limitations: [
    "The 15 manual_sheet rows are a read-only production-reviewed allowlist. The migration maps only exact podcast_key + source + title identities and asserts the two supplied IDs.",
    "The migration never reuses an RSS/API/Apple row and never updates or deletes an existing episode or rating."
  ]
};

await writeFile(migrationPath, sql, "utf8");
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
console.log(JSON.stringify(report, null, 2));
