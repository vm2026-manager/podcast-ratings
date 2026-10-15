// Diagnostic only: read public DR LYD metadata; never touch Supabase.
import { parseDrLydEpisodes, mapDrLydEpisodes } from "../supabase/functions/import-podcast-episodes/core.ts";

const cases = [
  { name: "Djævlen i detaljen", url: "https://www.dr.dk/lyd/special-radio/djaevlen-i-detaljen-1865892085000" },
  { name: "Bakspejl", url: "https://www.dr.dk/lyd/special-radio/bakspejl" }
];
let errors = 0;
for (const target of cases) {
  try {
    const response = await fetch(target.url, {
      headers: { "user-agent": "Podcastlisten-metadata-probe/1.0", accept: "text/html" },
      signal: AbortSignal.timeout(18000)
    });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const html = await response.text();
    const records = parseDrLydEpisodes(html);
    const mapped = mapDrLydEpisodes(records, {
      source: "diagnostic_only",
      podcast_key: "diagnostic_only",
      feed_url: target.url
    }, new Date().toISOString());
    const latest = [...mapped.episodes].sort((a,b) => (b.published_at || "").localeCompare(a.published_at || "")).slice(0, 8);
    const draberurten = mapped.episodes.filter((item) => item.title.toLowerCase().includes("dræberurten"));
    console.log(JSON.stringify({
      name: target.name, final_url: response.url, html_size: html.length,
      episode_items: records.length, mapped_count: mapped.episodes.length,
      errors: mapped.errors.length, warnings: mapped.warnings.length,
      latest: latest.map(({external_guid,title,published_at,duration_seconds,is_active,episode_url}) => ({external_guid,title,published_at,duration_seconds,is_active,episode_url})),
      draberurten: draberurten.map(({external_guid,title,published_at,duration_seconds,is_active,episode_url}) => ({external_guid,title,published_at,duration_seconds,is_active,episode_url}))
    },null,2));
    if (!mapped.episodes.length) throw new Error("No episodes in parsed DR LYD show");
  } catch(error) {
    errors++;
    console.error(target.name + ": " + String(error));
  }
}
if (errors) process.exitCode = 1;
