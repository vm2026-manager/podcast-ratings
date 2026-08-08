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

    async loadExistingEpisodes(source: string, externalGuids: string[]) {
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
      return rows;
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
