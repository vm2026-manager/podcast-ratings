import { BATCH_SIZE, chunk, type ImportRepository, type PodcastEpisodeRow } from "./core.ts";

const SELECT_FIELDS = [
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

    async updateImportRun(id: string, input) {
      const { error } = await client.from("episode_import_runs").update(input).eq("id", id);
      if (error) throw new Error("Import log update failed");
    }
  };
}
