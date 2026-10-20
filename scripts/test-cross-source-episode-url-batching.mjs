import assert from "node:assert/strict";
import { createSupabaseImportRepository } from "../supabase/functions/import-podcast-episodes/repository.ts";

// 112 for knuste hjerter: 316 Podimo URLs, 157 canonical Spreaker episodes.
// A PostgREST-like stub rejects any oversized URL filter; cross-source
// deduplication must remain complete and fail closed without touching IDs.
const podcastKey = "112 for knuste hjerter";
const newSource = "podimo_112_for_knuste_hjerter";
const oldSource = "spreaker_112_for_knuste_hjerter_rss";
const urls = Array.from({ length: 316 }, (_, i) =>
  "https://podimo.com/dk/shows/112-for-knuste-hjerter/episode/" + String(i).padStart(36, "0")
);
const guids = urls.map((_, i) => "podimo-guid-" + i);
const legacy = Array.from({ length: 157 }, (_, i) => ({
  id: "original-legacy-uuid-" + i,
  podcast_key: podcastKey,
  source: oldSource,
  external_guid: "spreaker-guid-" + i,
  episode_url: i === 15 ? urls[3] : i === 154 ? urls[310] : "https://spreaker.com/episode/" + i,
  title: "Historical episode " + i,
  published_at: "2026-01-01T00:00:00Z",
  is_active: true,
  metadata: {}
}));
const before = JSON.stringify(legacy);

function mockClient(failAt = -1) {
  const checked = [];
  const client = {
    from(table) {
      assert.ok(["podcast_episodes", "manual_catalogue_episode_map"].includes(table));
      const filters = {};
      return {
        select() { return this; },
        eq(field, value) {
          filters[field] = value;
          if (table === "manual_catalogue_episode_map") {
            assert.equal(field, "is_active");
            return Promise.resolve({ data: [], error: null });
          }
          return this;
        },
        in(field, values) {
          filters[field] = values;
          if (field === "source") return this;
          if (field === "external_guid") return Promise.resolve({ data: [], error: null });
          if (field === "episode_url") {
            checked.push({ urls: values, sources: filters.source });
            const failed = values.length > 20 || checked.length - 1 === failAt;
            return Promise.resolve({
              data: failed ? null : legacy.filter(row =>
                filters.source.includes(row.source) && values.includes(row.episode_url)),
              error: failed ? { message: "PostgREST request target too large" } : null
            });
          }
          if (field === "podcast_key" && table === "manual_catalogue_episode_map") return this;
          if (field === "podcast_key") {
            return Promise.resolve({
              data: legacy.filter(row =>
                filters.source.includes(row.source) && values.includes(row.podcast_key)),
              error: null
            });
          }
          throw new Error("Unexpected filter: " + field);
        }
      };
    }
  };
  return { client, checked };
}

const successful = mockClient();
const loaded = await createSupabaseImportRepository(successful.client).loadExistingEpisodes(
  newSource, guids, urls, [oldSource], [podcastKey]
);
assert.equal(successful.checked.length, 16, "316 URLs in 16 bounded queries");
assert.ok(successful.checked.every(batch => batch.urls.length <= 20));
assert.deepEqual(successful.checked.flatMap(batch => batch.urls), urls, "no missing or repeated URLs");
assert.ok(successful.checked.every(batch =>
  batch.sources.length === 1 && batch.sources[0] === oldSource), "only configured historical source");
assert.equal(loaded.length, 157, "all 157 immutable Spreaker IDs remain available");
assert.deepEqual(new Set(loaded.map(row => row.id)), new Set(legacy.map(row => row.id)));
assert.equal(JSON.stringify(legacy), before, "no historical episode mutation");
assert.ok(loaded.some(row => row.id === "original-legacy-uuid-15"));
assert.ok(loaded.some(row => row.id === "original-legacy-uuid-154"));

const failing = mockClient(15);
await assert.rejects(
  createSupabaseImportRepository(failing.client).loadExistingEpisodes(
    newSource, guids, urls, [oldSource], [podcastKey]
  ),
  /Cross-source episode select failed/,
  "a late PostgREST failure must stop importing instead of skipping dedupe"
);
assert.equal(failing.checked.length, 16);

const unrelated = mockClient();
await createSupabaseImportRepository(unrelated.client).loadExistingEpisodes(
  "unrelated-source", guids, urls, [], []
);
assert.equal(unrelated.checked.length, 0, "other feeds incur no cross-source overhead");
console.log("Bounded cross-source URL lookup and legacy episode identities: PASS");
