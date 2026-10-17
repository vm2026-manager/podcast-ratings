import assert from "node:assert/strict";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { routeEpisodes } from "../supabase/functions/import-podcast-episodes/core.ts";

const episode = (external_guid, title, description = "") => ({
  podcast_key: "tipsbladet lyd", source: "buzzsprout_tipsbladet_lyd_rss", external_guid,
  external_episode_id: null, title, description, published_at: null, duration_seconds: null,
  episode_url: null, audio_url: null, image_url: null, is_active: true, metadata: {}
});
const samples = [
  episode("Buzzsprout-19937866", "Hvem har haft det BEDSTE transfervindue i Superligaen? | Transferguru"),
  episode("Buzzsprout-19966521", "FCK TIL SALG: En kæmpe nyhed for dansk fodbold! | Transferguru"),
  episode("next-prefix", "Transferguru: En ny afsløring"),
  episode("old-1", "Episode 1: Transfer Talk - Superligaens varmeste salgsemner", "Transferguru omtales her"),
  episode("other-1", "Kan FCK stikke af fra FCM? | Superligaens Sandheder - Episode 18", "Transferguru i en teaser"),
  episode("other-2", "FCK snydt for straffe? | FEMTEDOMMER - Runde 10"),
  episode("unknown", "Tipsbladet fortæller om Transferguru uden serieetiket", "Transferguru omtales")
];
const { episodes, report } = routeEpisodes(samples, FEED_CONFIGS.tipsbladet_lyd);
assert.deepEqual(episodes.map(({ external_guid, podcast_key }) => [external_guid, podcast_key]), [
  ["Buzzsprout-19937866", "transferguru tipsbladet"],
  ["Buzzsprout-19966521", "transferguru tipsbladet"],
  ["next-prefix", "transferguru tipsbladet"],
  ["old-1", "transfer talk"],
  ["other-1", "superligaens sandheder"],
  ["other-2", "femtedommer"]
]);
assert.deepEqual(report.route_counts, {
  transferguru_tipsbladet: 3, transfer_talk: 1, superligaens_sandheder: 1, femtedommer: 1
});
assert.equal(report.unmatched.length, 1);
assert.equal(report.unmatched[0].external_guid, "unknown");
assert.equal(report.ambiguous.length, 0);
assert.equal(samples.some((item) => item.podcast_key === "transferguru"), false);
console.log("Tipsbladet Transferguru identity and routing: PASS");
