import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = path.join(
  root,
  "supabase",
  "migrations",
  "20260830105704_manual_catalogue_episode_canonicalization.sql"
);
const outputPath = path.join(
  root,
  "supabase",
  "migrations",
  "20260906202235_backfill_rateable_manual_catalogue_episode_mappings.sql"
);

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

function createUuid(identity, seeds) {
  const hex = seeds.map((seed) => hashStringToEightHex(identity, seed)).join("");
  const variant = ((Number.parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

function getRateableManualEntries(podcast) {
  const entries = Array.isArray(podcast.manualEpisodes) ? podcast.manualEpisodes : [];
  if (entries.length < 2) return [];

  const seen = new Set();
  return entries.flatMap((entry, index) => {
    const title = normalizeText(typeof entry === "object" ? entry.title : entry);
    const immutableKey = normalizeText(
      typeof entry === "object" ? entry.manual_episode_key || entry.manualEpisodeKey : ""
    );
    if (!title || seen.has(title) || /\b(?:teaser|trailer)\b/i.test(title)) return [];
    seen.add(title);
    return [{ title, immutableKey, episodeNumber: index + 1 }];
  });
}

const [cataloguePayload, baseline] = await Promise.all([
  readFile(path.join(root, "data", "podcasts.json"), "utf8").then(JSON.parse),
  readFile(baselinePath, "utf8")
]);
const baselineKeys = new Set(
  [...baseline.matchAll(/'((?:manual-catalogue-v1|manual-catalogue-v2):[^']+)'/g)].map((match) => match[1])
);
const rows = (cataloguePayload.rows || cataloguePayload).flatMap((podcast) => {
  const podcastKey = normalizeText(podcast["Podcast-ID"]);
  if (!podcastKey) return [];

  return getRateableManualEntries(podcast).map(({ title, immutableKey, episodeNumber }) => {
    const legacyId = createUuid(
      `podcastlisten-manual-episode-v1|${podcastKey}|${episodeNumber}|${title}`,
      [0x11, 0x22, 0x33, 0x44]
    );
    const episodeId = immutableKey
      ? createUuid(`podcastlisten-manual-catalogue-v2|${podcastKey}|${immutableKey}`, [0x51, 0x52, 0x53, 0x54])
      : legacyId;
    const manualEpisodeKey = immutableKey
      ? `manual-catalogue-v2:${podcastKey}:${immutableKey}`
      : `manual-catalogue-v1:${episodeId}`;

    return { podcastKey, title, episodeId, manualEpisodeKey, legacyId };
  });
}).filter((row) => !baselineKeys.has(row.manualEpisodeKey));

if (!rows.length) throw new Error("No new manual catalogue mappings to backfill.");
if (new Set(rows.map((row) => row.episodeId)).size !== rows.length) {
  throw new Error("Refusing to generate migration with duplicate canonical episode IDs.");
}

const values = rows.map((row) =>
  `  (${quoteSql(row.manualEpisodeKey)}, ${quoteSql(row.podcastKey)}, ${quoteSql(row.episodeId)}::uuid, ${quoteSql(row.title)}, ${quoteSql(`manual_catalogue_v1:${row.episodeId}`)})`
).join(",\n");

const sql = `-- Generated from the current catalogue. Backfills manual episodes added after the
-- initial canonical migration without changing any existing episode or rating.
begin;

create temporary table manual_catalogue_mapping_delta (
  manual_episode_key text primary key,
  podcast_key text not null,
  episode_id uuid not null,
  title text not null,
  external_guid text not null
) on commit drop;

insert into manual_catalogue_mapping_delta (
  manual_episode_key, podcast_key, episode_id, title, external_guid
) values
${values};

insert into public.podcast_episodes (
  id, podcast_key, source, external_guid, external_episode_id, title, is_active, metadata
)
select
  episode_id, podcast_key, 'manual_catalogue_v1', external_guid, manual_episode_key, title, true,
  jsonb_build_object('manual_catalogue', true, 'manual_episode_key', manual_episode_key, 'identity_version', 'manual_catalogue_v1', 'rateable', true)
from manual_catalogue_mapping_delta
on conflict (source, external_guid) do nothing;

insert into public.manual_catalogue_episode_map (
  manual_episode_key, podcast_key, episode_id, canonical_source, legacy_episode_ids, title, is_active
)
select
  manual_episode_key, podcast_key, episode_id, 'manual_catalogue_v1', '{}'::text[], title, true
from manual_catalogue_mapping_delta
on conflict (manual_episode_key) do nothing;

do $$
begin
  if exists (
    select 1
    from manual_catalogue_mapping_delta expected
    left join public.manual_catalogue_episode_map mapping
      on mapping.manual_episode_key = expected.manual_episode_key
    left join public.podcast_episodes episode
      on episode.id = mapping.episode_id
    where mapping.episode_id is distinct from expected.episode_id
       or mapping.podcast_key is distinct from expected.podcast_key
       or mapping.canonical_source <> 'manual_catalogue_v1'
       or mapping.is_active is not true
       or episode.id is null
       or episode.podcast_key is distinct from expected.podcast_key
       or episode.source <> 'manual_catalogue_v1'
       or episode.external_guid is distinct from expected.external_guid
       or episode.is_active is not true
  ) then
    raise exception 'Manual catalogue mapping delta contains a missing or conflicting canonical identity';
  end if;
end $$;

commit;
`;

await writeFile(outputPath, sql, "utf8");
console.log(JSON.stringify({ outputPath, mappings: rows.length, podcasts: new Set(rows.map((row) => row.podcastKey)).size }, null, 2));
