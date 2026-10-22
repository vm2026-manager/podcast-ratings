import { assert, assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { mapApplePodcastHtmlEpisodes, parseApplePodcastEpisodePage, parseApplePodcastShowLinks } from "./apple-podcasts.ts";

const showHtml = `
  <a href="/dk/podcast/one/id1575533784?i=1000785662463&amp;l=da">one</a>
  <a href="/dk/podcast/one/id1575533784?i=1000785662463&amp;l=da">duplicate</a>
  <a href="/dk/podcast/two/id1575533784?i=1000784702351">two</a>
  <a href="/dk/podcast/unrelated/id999?i=1000783971076">unrelated</a>`;

const episodeHtml = `
  <link rel="canonical" href="https://podcasts.apple.com/dk/podcast/one/id1575533784?i=1000785662463">
  <meta property="og:description" content="Podcast Episode · Podimo Channel Only">
  <meta property="og:image" content="https://image.example/cover.jpg">
  <script type="application/ld+json">{"@type":"PodcastEpisode","name":"Teaser: Titel","description":"Full public description","datePublished":"2026-08-25","url":"https://podcasts.apple.com/dk/podcast/one/id1575533784?i=1000785662463","thumbnailUrl":"https://image.example/thumb.jpg"}</script>
  <script id="serialized-server-data">{"data":{"adamId":"1000785662463","storeUrl":"https://podcasts.apple.com/dk/podcast/one/id1575533784?i=1000785662463","releaseDate":"2026-08-25T02:10:12Z","duration":950.904,"episodeArtwork":{"template":"https://image.example/{w}x{h}.{f}"},"streamUrl":"https://protected.example/private.m3u8"}}</script>`;

Deno.test("Apple show parser accepts only unique matching show episode links", () => {
  assertEquals(parseApplePodcastShowLinks(showHtml, "1575533784"), [
    { episodeId: "1000785662463", url: "https://podcasts.apple.com/dk/podcast/one/id1575533784?i=1000785662463&l=da" },
    { episodeId: "1000784702351", url: "https://podcasts.apple.com/dk/podcast/two/id1575533784?i=1000784702351" }
  ]);
  assertThrows(() => parseApplePodcastShowLinks("<html></html>", "1575533784"));
});

Deno.test("Apple episode parser matches the requested ID and never exposes playback", async () => {
  const parsed = parseApplePodcastEpisodePage(episodeHtml, "1000785662463");
  assertEquals(parsed.title, "Teaser: Titel");
  assertEquals(parsed.description, "Full public description");
  assertEquals(parsed.publishedAt, "2026-08-25T02:10:12Z");
  assertEquals(parsed.durationSeconds, 951);
  assertEquals(parsed.imageUrl, "https://image.example/1200x1200.jpg");
  assert(parsed.preciseReleaseDateMatched);

  const mapped = await mapApplePodcastHtmlEpisodes({
    showHtml,
    config: { podcast_key: "mads og a holdet", source: "apple_podcasts_1575533784", feed_url: "https://example.test", apple_show_id: "1575533784", format: "apple_podcasts_html" },
    fetchText: async () => episodeHtml,
    now: "2026-08-26T00:00:00Z"
  });
  assertEquals(mapped.episodes[0].audio_url, null);
  assert(!JSON.stringify(mapped.episodes).includes("protected.example"));
  assertEquals(mapped.episodes[0].is_active, false);
});

Deno.test("Kirsten numbering uses season-local descriptions and matched Apple Season only", () => {
  const page = (id: string, description: string, appleFields = "") => `
    <link rel="canonical" href="https://podcasts.apple.com/dk/podcast/kirsten/id1715936714?i=${id}">
    <script type="application/ld+json">{"@type":"PodcastEpisode","name":"Titel","description":${JSON.stringify(description)},"url":"https://podcasts.apple.com/dk/podcast/kirsten/id1715936714?i=${id}"}</script>
    <script id="serialized-server-data">{"episode":{"adamId":"${id}","storeUrl":"https://podcasts.apple.com/dk/podcast/kirsten/id1715936714?i=${id}",${appleFields}}}</script>`;
  const s1 = parseApplePodcastEpisodePage(page("1000000000001", "Afsnit 1.", '"seasonNumber":1,"episodeNumber":1'), "1000000000001");
  assertEquals([s1.seasonNumber, s1.seasonEpisodeNumber, s1.seasonNumberSource], [1, 1, "apple_season_and_description"]);
  const s2 = parseApplePodcastEpisodePage(page("1000000000002", "Sæson 2 - afsnit 1.", '"seasonNumber":2,"episodeNumber":26'), "1000000000002");
  assertEquals([s2.seasonNumber, s2.seasonEpisodeNumber], [2, 1], "Global Apple Episode 26 must not replace local episode 1");
  const s3 = parseApplePodcastEpisodePage(page("1000000000003", "Sæson 3, afsnit 8."), "1000000000003");
  assertEquals([s3.seasonNumber, s3.seasonEpisodeNumber], [3, 8]);
  const ambiguous = parseApplePodcastEpisodePage(page("1000000000004", "Afsnit 2.", '"episodeNumber":2'), "1000000000004");
  assertEquals([ambiguous.seasonNumber, ambiguous.seasonEpisodeNumber], [null, null], "A local number alone cannot establish its season");
});
