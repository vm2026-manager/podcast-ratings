import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { dryRunConfigError, runAppleDryRun, runPodimoDryRun } from "./dry-run.ts";
import { validateImportRequest } from "./core.ts";
import { FEED_CONFIGS, type FeedConfig } from "./feed-config.ts";

const now = "2026-09-30T00:00:00.000Z";
const episode = (id: string, title = `Episode ${id}`) => ({
  id, title, description: "Beskrivelse med æ, ø og å", duration: 42,
  publishedOn: "2026-01-02T03:04:05.000Z", coverImage: "https://example.test/image.jpg"
});
const payload = (episodes: unknown[], page_count?: number) => ({ data: { episodes, ...(page_count ? { page_count } : {}) } });

Deno.test("Apple dry run remains read-only and returns its established diagnostics", async () => {
  const config: FeedConfig = { podcast_key: "apple", source: "apple", feed_url: "https://example.test/show", format: "apple_podcasts_html", apple_show_id: "1" };
  const result = await runAppleDryRun(config, async () => `<!doctype html><meta name="description" content="Apple">`);
  assertEquals(result.status, "success");
  assertEquals(result.fetched_count, 0);
  assertEquals(result.valid_count, 0);
});

Deno.test("dry runs remain single-feed and retain bearer authentication", async () => {
  assertEquals(dryRunConfigError("all", FEED_CONFIGS.podimo_grebet_af_gvfb), "Dry run requires a single feed");
  assertEquals(dryRunConfigError("missing", undefined), "Dry run is available only for Apple Podcasts HTML and Podimo feeds");
  const response = await validateImportRequest(new Request("https://example.test", {
    method: "POST", headers: { authorization: "Bearer test-secret" }, body: JSON.stringify({ feed: "podimo_livet_ifolge_emil_og_thomas", dry_run: true })
  }), "test-secret");
  assertEquals(response.ok, true);
  const rejected = await validateImportRequest(new Request("https://example.test", { method: "POST", body: JSON.stringify({ feed: "podimo_livet_ifolge_emil_og_thomas", dry_run: true }) }), "test-secret");
  assertEquals(rejected.ok, false);
});

Deno.test("Podimo one-to-one dry run maps without repository writes", async () => {
  const result = await runPodimoDryRun({ config: FEED_CONFIGS.podimo_livet_ifolge_emil_og_thomas, now,
    fetchPodimo: async () => payload([episode("one", "Ægte episode"), episode("teaser", "Teaser: Kommer snart")]) });
  assertEquals(result.status, "success");
  assertEquals(result.source, "podimo_livet_ifolge_emil_og_thomas");
  assertEquals(result.valid_count, 2);
  assertEquals(result.teaser_trailer_excluded_count, 1);
  assertEquals(result.audio_url_values_are_null, true);
  assertEquals(result.episodes[0].title, "Ægte episode");
  assertEquals(result.episodes[0].audio_url, null);
});

Deno.test("Podimo shared-feed dry run routes and reports unknown and ambiguous programmes", async () => {
  const config = FEED_CONFIGS.podimo_grebet_af_gvfb;
  const routed = await runPodimoDryRun({ config, now, fetchPodimo: async () => payload([
    { ...episode("hotel", "Hotel Romantik"), description: "Hotel Romantik" },
    { ...episode("beaa8a13-edc9-4670-85f9-dd4948f543b3", "S4-E1"), description: "Ingen titelidentitet nødvendig" },
    episode("unknown", "Uklassificeret")
  ]) });
  assertEquals(routed.valid_count, 2);
  assertEquals(routed.routing?.routed_count, 2);
  assertEquals(routed.routing?.unmatched_count, 1);
  const ambiguous = await runPodimoDryRun({ config, now, fetchPodimo: async () => payload([
    { ...episode("ambiguous", "Hotel Romantik"), description: "Gift ved første blik" }
  ]) });
  assertEquals(ambiguous.valid_count, 0);
  assertEquals(ambiguous.routing?.ambiguous_count, 1);
});

Deno.test("Podimo dry run retains all paginated large inputs and reports malformed and duplicate items", async () => {
  const episodes = Array.from({ length: 514 }, (_, index) => episode(`id-${index}`));
  const large = await runPodimoDryRun({ config: FEED_CONFIGS.podimo_livet_ifolge_emil_og_thomas, now, fetchPodimo: async () => payload(episodes, 6) });
  assertEquals(large.fetched_count, 514);
  assertEquals(large.valid_count, 514);
  assertEquals(large.page_count, 6);
  const malformed = await runPodimoDryRun({ config: FEED_CONFIGS.podimo_livet_ifolge_emil_og_thomas, now,
    fetchPodimo: async () => payload([episode("duplicate"), episode("duplicate"), null]) });
  assertEquals(malformed.valid_count, 1);
  assertEquals(malformed.error_count, 2);
  assertEquals(malformed.duplicate_guid_count, 1);
});
