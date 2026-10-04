import type { ImportRepository, PodcastEpisodeRow } from "./core.ts";
import type { FeedConfig } from "./feed-config.ts";

// Reviewed 2026-10-04 against the catalogue's immutable positions and Podimo's
// explicit S1-E1..4 titles. These legacy rows have no date or duration. Never
// derive this mapping from the current API order or apply it to another show.
export const KROP_MANUAL_LINKS = [
  { id: "92566dbb-4767-5566-818e-612932f25ddc", guid: "264f5717-330e-4606-bc1c-3d74c366061e", number: 1, title: 'Den lykkelige luder: "Nogle af os kan godt li\' det, vi laver" (1:2)', date: "2026-08-07", duration: 2510 },
  { id: "c4f21452-68c6-588f-8d5a-b4fcd558bea1", guid: "17f26c96-4b4b-4321-8ac2-0d666ffd8ce9", number: 2, title: 'Den lykkelige luder: "Du er da en nasty lille mand" (2:2)', date: "2026-08-07", duration: 2461 },
  { id: "0ad775dc-b1dd-52c9-819f-3b5a0c4d0a17", guid: "e61aa60f-f615-483d-82da-8802ff938e84", number: 3, title: 'Peter er sexkunde: "Købesex er en del af budgetkontoen"', date: "2026-08-14", duration: 3243 },
  { id: "2085daca-5d2c-5fd5-b705-c47ca0816d77", guid: "f5d187f2-ad31-4e2e-881a-2037ca0975a9", number: 4, title: "Fra overklasse til gadeluder (1:2)", date: "2026-08-21", duration: 1949 }
];

function title(value: string): string {
  return value.normalize("NFC").toLocaleLowerCase("da-DK")
    .replace(/^s\d+-e\d+:\s*/i, "").replace(/\\/g, "")
    .replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();
}
function day(value: string | null): string | null {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}
function manual(row: PodcastEpisodeRow): boolean {
  return row.source === "manual_catalogue_v1" || row.source === "manual_sheet";
}
function sameMetadata(a: unknown, b: unknown): boolean {
  const stable = (v: any): any => Array.isArray(v) ? v.map(stable) : v && typeof v === "object"
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

export function planManualPodimoSync(incoming: PodcastEpisodeRow[], existing: PodcastEpisodeRow[], config: FeedConfig) {
  const rows = existing.filter((row) => row.podcast_key === config.podcast_key);
  const writes: Array<{ row: PodcastEpisodeRow; current?: PodcastEpisodeRow }> = [];
  const issues: Array<{ external_guid: string; reason: string; existing_ids: Array<string | undefined> }> = [];
  const matchedIds = new Set<string>();
  let unchanged = 0;
  const candidates = incoming.map((episode) => {
    const explicit = config.manual_identity_links?.find((link) => link.guid === episode.external_guid);
    const exact = rows.filter((row) => row.external_guid === episode.external_guid || row.external_episode_id === episode.external_guid);
    const similar = rows.filter((row) => manual(row) && title(row.title) === title(episode.title));
    const reviewed = explicit ? rows.filter((row) => row.id === explicit.id) : [];
    const pool = [...new Set([...exact, ...similar, ...reviewed])];
    const current = pool.length === 1 ? pool[0] : undefined;
    let reason = pool.length > 1 ? "ambiguous match; preserved existing records and attached ratings" : "";
    if (!reason && current) {
      const known = exact.includes(current);
      const verified = explicit && current.id === explicit.id && current.source === "manual_catalogue_v1" &&
        current.external_guid === `manual_catalogue_v1:${explicit.id}` &&
        current.metadata?.catalogue_episode_number === explicit.number &&
        title(current.title) === title(explicit.title) && title(episode.title) === title(explicit.title) &&
        episode.title.startsWith(`S1-E${explicit.number}:`) && day(episode.published_at) === explicit.date &&
        episode.duration_seconds === explicit.duration;
      const dated = similar.includes(current) && day(current.published_at) !== null &&
        day(current.published_at) === day(episode.published_at) &&
        (current.duration_seconds === null || episode.duration_seconds === null || current.duration_seconds === episode.duration_seconds);
      const otherLink = current.metadata?.sync_source &&
        (current.metadata.sync_source !== config.source || current.external_episode_id !== episode.external_guid);
      const unexpectedSource = !manual(current) && current.source !== config.source;
      if (!current.id || otherLink || unexpectedSource || (explicit && current.id !== explicit.id) || (!known && !verified && !dated)) reason = "unmatched; insufficient or conflicting identity evidence";
    }
    if (!current && explicit && !reason) reason = "unmatched; expected manual record is missing";
    return { episode, current, pool, reason };
  });
  // A title change must not make an unknown legacy record look like a new
  // episode. Unknown/unresolved manual records block new inserts, not safe links.
  const unaccounted = rows.filter((row) => manual(row) && !row.metadata?.sync_source &&
    !config.manual_identity_links?.some((link) => link.id === row.id) &&
    !candidates.some((candidate) => candidate.current === row && !candidate.reason));
  for (const candidate of candidates) {
    const { episode, current, pool } = candidate;
    let reason = candidate.reason;
    if (!reason && current && candidates.filter((c) => c.current === current && !c.reason).length > 1) reason = "ambiguous match; multiple incoming episodes claim one record";
    if (!reason && !current && unaccounted.length) reason = "unmatched manual records; new episode requires review";
    if (!reason && !current && incoming.filter((row) => title(row.title) === title(episode.title) && day(row.published_at) === day(episode.published_at)).length > 1) {
      reason = "ambiguous match; incoming episodes share title and date";
    }
    const legacyCutoff = config.manual_identity_links?.map((link) => link.date).sort().at(-1);
    if (!reason && !current && legacyCutoff && (!day(episode.published_at) || day(episode.published_at)! <= legacyCutoff)) {
      reason = "unmatched historical episode; cannot prove it is new";
    }
    if (reason) { issues.push({ external_guid: episode.external_guid, reason, existing_ids: pool.map((row) => row.id) }); continue; }
    if (!current) { writes.push({ row: episode }); continue; }
    matchedIds.add(current.id!);
    const linked = manual(current) ? {
      ...current,
      external_episode_id: episode.external_guid,
      description: episode.description ?? current.description,
      published_at: episode.published_at ?? current.published_at,
      duration_seconds: episode.duration_seconds ?? current.duration_seconds,
      episode_url: episode.episode_url ?? current.episode_url,
      image_url: episode.image_url ?? current.image_url,
      metadata: { ...current.metadata, sync_source: config.source, podimo_podcast_id: config.podcast_id,
        original_external_episode_id: Object.hasOwn(current.metadata, "original_external_episode_id")
          ? current.metadata.original_external_episode_id : current.external_episode_id }
    } : { ...episode, id: current.id, metadata: { ...current.metadata, ...episode.metadata } };
    if (sameMetadata({ ...current, published_at: current.published_at ? new Date(current.published_at).toISOString() : null }, linked)) unchanged++;
    else writes.push({ row: linked, current });
  }
  return { writes, issues, unchanged, unmatched_manual_ids: rows.filter((row) => manual(row) && !matchedIds.has(row.id!)).map((row) => row.id) };
}

export async function syncManualPodimoEpisodes(incoming: PodcastEpisodeRow[], config: FeedConfig, repository: ImportRepository) {
  if (!repository.loadPodcastEpisodes || !repository.updateEpisodeMetadata) throw new Error("Manual reconciliation repository is unavailable");
  const plan = planManualPodimoSync(incoming, await repository.loadPodcastEpisodes(config.podcast_key), config);
  let inserted_count = 0, updated_count = 0, writeErrors = 0;
  const failures: string[] = [];
  for (const { row, current } of plan.writes) {
    try {
      if (current) {
        await repository.updateEpisodeMetadata(current, row);
        updated_count++;
      } else {
        await repository.upsertEpisodes([row]);
        inserted_count++;
      }
    } catch {
      writeErrors++;
      failures.push(row.external_guid);
    }
  }
  const details = { matched_existing_episode: updated_count, created_new_episode: inserted_count,
    unchanged_episode: plan.unchanged, identity_issues: plan.issues, unmatched_manual_ids: plan.unmatched_manual_ids,
    failed_episode_guids: failures, preserved_existing_ids: plan.writes.filter((write) => write.current).map((write) => write.current!.id) };
  console.log("[episode-import] manual Podimo reconciliation", JSON.stringify(details));
  return { inserted_count, updated_count, skipped_count: plan.unchanged + plan.issues.length,
    error_count: plan.issues.length + writeErrors, details };
}
