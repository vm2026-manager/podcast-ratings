import { runEpisodeImport, type ImportRepository, type PodcastEpisodeRow } from "../supabase/functions/import-podcast-episodes/core.ts";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";

type ImportRun = { id: string; input: Record<string, unknown>; completion?: Record<string, unknown> };

function storageKey(row: Pick<PodcastEpisodeRow, "source" | "external_guid">) {
  return `${row.source}\u0000${row.external_guid}`;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export function createInMemoryImportRepository(initialRows: PodcastEpisodeRow[] = []) {
  const rows = new Map(initialRows.map((row) => [storageKey(row), clone(row)]));
  const runs: ImportRun[] = [];
  const upsertBatches: PodcastEpisodeRow[][] = [];

  const repository: ImportRepository = {
    async createImportRun(input) {
      const id = `local-run-${runs.length + 1}`;
      runs.push({ id, input: clone(input) });
      return { id };
    },
    async loadExistingEpisodes(source, externalGuids) {
      return externalGuids.flatMap((externalGuid) => {
        const row = rows.get(`${source}\u0000${externalGuid}`);
        return row ? [clone(row)] : [];
      });
    },
    async upsertEpisodes(batch) {
      upsertBatches.push(clone(batch));
      for (const row of batch) rows.set(storageKey(row), clone(row));
    },
    async updateImportRun(id, input) {
      const run = runs.find((entry) => entry.id === id);
      if (!run) throw new Error(`Unknown local import run: ${id}`);
      run.completion = clone(input);
    }
  };

  return {
    repository,
    rows: () => [...rows.values()].map(clone),
    runs: () => runs.map(clone),
    upsertBatches: () => upsertBatches.map(clone),
    mutate(externalGuid: string, mutateRow: (row: PodcastEpisodeRow) => PodcastEpisodeRow) {
      const key = [...rows.keys()].find((candidate) => candidate.endsWith(`\u0000${externalGuid}`));
      if (!key) throw new Error(`Cannot mutate missing local episode: ${externalGuid}`);
      rows.set(key, clone(mutateRow(clone(rows.get(key)!))));
    }
  };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Simulation assertion failed: ${message}`);
}

function routing(summary: Awaited<ReturnType<typeof runEpisodeImport>>) {
  return (summary.details?.routing || {}) as Record<string, unknown>;
}

async function main() {
  const outputPath = Deno.args[0] || "mediano-import-simulation-20260918.json";
  const config = FEED_CONFIGS.mediano_public;
  assert(config, "mediano_public must exist in FEED_CONFIGS");

  // This is the sole network operation: the public RSS feed. The exact XML is
  // reused for every scenario so an external feed change cannot affect results.
  const response = await fetch(config.feed_url);
  if (!response.ok) throw new Error(`Public Mediano feed fetch failed: ${response.status}`);
  const xml = await response.text();
  const fetchText = async (url: string) => {
    assert(url === config.feed_url, "simulation may fetch only the public Mediano URL");
    return xml;
  };
  const now = () => "2026-09-18T00:00:00.000Z";
  const catalogue = JSON.parse(await Deno.readTextFile("data/podcasts.json")).rows as Array<Record<string, unknown>>;
  const catalogueById = new Map(catalogue.map((row) => [String(row["Podcast-ID"]), row]));

  const local = createInMemoryImportRepository();
  const first = await runEpisodeImport({ feedKey: "mediano_public", repository: local.repository, fetchText, now });
  const firstRows = local.rows();
  const firstRouting = routing(first);
  const firstWriteRows = local.upsertBatches().flat();
  const firstKeys = new Set(firstRows.map(storageKey));
  const approvedKeys = new Set(config.routes!.filter((route) => route.podcast_key).map((route) => route.podcast_key!));
  const persistedFields: Array<keyof PodcastEpisodeRow> = [
    "source", "external_guid", "podcast_key", "title", "published_at", "audio_url", "episode_url", "image_url", "metadata"
  ];

  assert(firstWriteRows.length === first.inserted_count + first.updated_count, "first write rows equal import summary writes");
  assert(firstRows.length === firstWriteRows.length, "empty destination stores each first-run write once");
  assert(firstKeys.size === firstRows.length, "source + external_guid is unique");
  assert(firstRows.every((row) => row.source === config.source), "all writes use the Mediano public source");
  assert(firstRows.every((row) => persistedFields.every((field) => Object.hasOwn(row, field)), "every write has the expected persistent fields");
  assert(firstRows.every((row) => Object.hasOwn(row.metadata, "rateable") && Object.hasOwn(row.metadata, "exclusion_reason")), "every write carries rateability/exclusion metadata");
  assert(firstRows.every((row) => approvedKeys.has(row.podcast_key)), "only enabled canonical routes are persisted");
  assert(firstRows.every((row) => catalogueById.has(row.podcast_key)), "every persisted podcast_key is in the catalogue");
  assert(!firstRows.some((row) => row.podcast_key === "fodboldministeriet"), "Fodboldministeriet receives zero umbrella writes");
  assert(Number(firstRouting.ambiguous_count || 0) === 0, "no ambiguous routes");

  const second = await runEpisodeImport({ feedKey: "mediano_public", repository: local.repository, fetchText, now });
  const secondRows = local.rows();
  assert(second.inserted_count === 0 && second.updated_count === 0, "second run is idempotent");
  assert(second.skipped_count === firstRows.length, "second run skips every unchanged persisted row");
  assert(secondRows.length === firstRows.length, "second run creates no duplicates");

  const target = firstRows[0];
  assert(target, "first run must create at least one row");
  local.mutate(target.external_guid, (row) => ({ ...row, description: `${row.description || ""} [local update probe]` }));
  const controlledUpdate = await runEpisodeImport({ feedKey: "mediano_public", repository: local.repository, fetchText, now });
  const updatedTarget = local.rows().find((row) => row.external_guid === target.external_guid)!;
  assert(controlledUpdate.inserted_count === 0 && controlledUpdate.updated_count === 1, "controlled metadata change updates exactly one row");
  assert(updatedTarget.podcast_key === target.podcast_key && updatedTarget.source === target.source && updatedTarget.external_guid === target.external_guid, "controlled update preserves identity and destination");

  const conflictSeed = { ...target, podcast_key: "deliberately wrong destination" };
  const conflictLocal = createInMemoryImportRepository([conflictSeed]);
  const conflict = await runEpisodeImport({ feedKey: "mediano_public", repository: conflictLocal.repository, fetchText, now });
  const conflictRouting = routing(conflict);
  assert(Number(conflictRouting.routing_conflict_count || 0) === 1, "routing conflict is reported");
  assert(conflictLocal.upsertBatches().flat().every((row) => row.external_guid !== target.external_guid), "conflicted row is not upserted");
  assert(conflictLocal.rows().find((row) => row.external_guid === target.external_guid)?.podcast_key === conflictSeed.podcast_key, "conflicted identity remains untouched");

  const perDestination = Object.fromEntries([...new Set(firstRows.map((row) => row.podcast_key))].sort().map((podcastKey) => {
    const catalogueRow = catalogueById.get(podcastKey)!;
    return [podcastKey, {
      display_title: catalogueRow.Titel,
      publisher: catalogueRow.Udgiver,
      count: firstRows.filter((row) => row.podcast_key === podcastKey).length
    }];
  }));
  const report = {
    dry_run: true,
    feed: { key: "mediano_public", url: config.feed_url, source: config.source, fetched_once: true },
    first_run: { summary: first, write_row_count: firstWriteRows.length, routing: firstRouting },
    per_destination: perDestination,
    identity_checks: {
      source_external_guid_unique: firstKeys.size === firstRows.length,
      required_persistent_fields_present: true,
      rateability_exclusion_metadata_present: true,
      approved_canonical_destinations_only: true,
      catalogue_podcast_ids_valid: true,
      fodboldministeriet_write_count: 0,
      pending_unmatched_ambiguous_skipped_write_count: 0,
      would_be_rows: firstRows
    },
    idempotency: { summary: second, stored_row_count_before: firstRows.length, stored_row_count_after: secondRows.length },
    controlled_update: { target: { source: target.source, external_guid: target.external_guid, podcast_key: target.podcast_key }, summary: controlledUpdate },
    routing_conflict: { summary: conflict, preserved_wrong_podcast_key: conflictSeed.podcast_key },
    local_repository: { import_run_count: local.runs().length, no_supabase_client: true }
  };
  await Deno.writeTextFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    report: outputPath,
    first_run: { fetched: first.fetched_count, inserted: first.inserted_count, updated: first.updated_count, skipped: first.skipped_count, errors: first.error_count, status: first.status },
    idempotency: { inserted: second.inserted_count, updated: second.updated_count, skipped: second.skipped_count },
    controlled_update: { inserted: controlledUpdate.inserted_count, updated: controlledUpdate.updated_count, skipped: controlledUpdate.skipped_count },
    routing_conflict_count: conflictRouting.routing_conflict_count,
    stored_rows: firstRows.length
  }, null, 2));
}

if (import.meta.main) main();
