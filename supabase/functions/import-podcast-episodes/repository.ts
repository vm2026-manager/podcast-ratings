import { BATCH_SIZE, chunk, type ImportRepository, type PodcastEpisodeRow } from "./core.ts";

const SELECT_FIELDS = [
  "id",
  "podcast_key",
  "source",
  "external_guid",
  "external_episode_id",
  "title",
  "description",
  "published_at",
  "duration_seconds",
  "episode_url",
  "audio_url",
  "image_url",
  "is_active",
  "metadata"
].join(",");

export function createSupabaseImportRepository(client: any): ImportRepository {
  return {
    async createImportRun(input) {
      const { data, error } = await client
        .from("episode_import_runs")
        .insert(input)
        .select("id")
        .single();
      if (error) throw new Error("Import log insert failed");
      return { id: data.id };
    },

    async loadExistingEpisodes(source: string, externalGuids: string[], episodeUrls: string[] = [], additionalSources: string[] = [], podcastKeys: string[] = []) {
      const rows: PodcastEpisodeRow[] = [];
      for (const guidBatch of chunk(externalGuids, BATCH_SIZE)) {
        const { data, error } = await client
          .from("podcast_episodes")
          .select(SELECT_FIELDS)
          .eq("source", source)
          .in("external_guid", guidBatch);
        if (error) throw new Error("Existing episode select failed");
        rows.push(...(data || []));
      }
      // Supplemental sources are deduplicated only against their explicitly
      // configured primary sources, through exact canonical URL equality.
      if (episodeUrls.length && additionalSources.length) {
        for (const urlBatch of chunk(episodeUrls, BATCH_SIZE)) {
          const { data, error } = await client
            .from("podcast_episodes")
            .select(SELECT_FIELDS)
            .in("source", additionalSources)
            .in("episode_url", urlBatch);
          if (error) throw new Error("Cross-source episode select failed");
          rows.push(...(data || []));
        }
      }
      // The source URLs intentionally differ between Spreaker and Mediano's
      // site feed. Load only the routed parent keys so core can apply its
      // exact title + publication-date identity check without fuzzy matching.
      if (podcastKeys.length && additionalSources.length) {
        const { data, error } = await client
          .from("podcast_episodes")
          .select(SELECT_FIELDS)
          .in("source", additionalSources)
          .in("podcast_key", podcastKeys);
        if (error) throw new Error("Cross-source episode identity select failed");
        rows.push(...(data || []));
      }

      // Manual catalogue episodes are permanent identities. Always load them
      // for routed podcast keys so an RSS/DR episode can enrich the existing
      // canonical row instead of creating a competing UUID.
      if (podcastKeys.length) {
        for (const keyBatch of chunk([...new Set(podcastKeys)], BATCH_SIZE)) {
          const { data, error } = await client
            .from("podcast_episodes")
            .select(SELECT_FIELDS)
            .in("source", ["manual_catalogue_v1", "manual_catalogue_reviewed_legacy"])
            .in("podcast_key", keyBatch)
            .eq("is_active", true);
          if (error) throw new Error("Manual catalogue episode select failed");
          rows.push(...(data || []));
        }
      }

      return [...new Map(
        rows.map((row) => [`${row.source}\u0000${row.external_guid}`, row]),
      ).values()];
    },

    async upsertEpisodes(rows: PodcastEpisodeRow[]) {
      if (!rows.length) return;
      const { error } = await client
        .from("podcast_episodes")
        .upsert(rows, { onConflict: "source,external_guid" });
      if (error) throw new Error("Episode batch upsert failed");
    },

    async loadPodcastEpisodes(podcastKey: string) {
      const rows: PodcastEpisodeRow[] = [];
      for (let offset = 0; ; offset += BATCH_SIZE) {
        const { data, error } = await client.from("podcast_episodes").select(SELECT_FIELDS)
          .eq("podcast_key", podcastKey).order("id").range(offset, offset + BATCH_SIZE - 1);
        if (error || !Array.isArray(data)) throw new Error("Podcast identity inventory failed");
        rows.push(...data);
        if (data.length < BATCH_SIZE) return rows;
      }
    },

    async updateEpisodeMetadata(current, next) {
      if (!current.id) throw new Error("Missing existing episode identity");
      // Update only metadata by exact UUID. Never write identity namespaces,
      // active state, ratings, or the manual catalogue mapping.
      const { id: _id, source: _source, external_guid: _guid, podcast_key: _key, is_active: _active, ...patch } = next;
      let query = client.from("podcast_episodes").update(patch).eq("id", current.id)
        .eq("source", current.source).eq("external_guid", current.external_guid).eq("podcast_key", current.podcast_key);
      query = current.external_episode_id === null ? query.is("external_episode_id", null) : query.eq("external_episode_id", current.external_episode_id);
      const { data, error } = await query.select("id");
      if (error || data?.length !== 1 || data[0].id !== current.id) throw new Error("Episode identity changed; skipped update");
    },

    async updateImportRun(id: string, input) {
      const { error } = await client.from("episode_import_runs").update(input).eq("id", id);
      if (error) throw new Error("Import log update failed");
    }
  };
}
