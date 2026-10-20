import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";

// Read-only catalogue-to-adapter audit. No feed fetch, database, secrets, cron
// changes or production writes. Safe for Supabase Free.
const normalizeKey = value => String(value ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/gu, " og ")
  .replace(/[^a-z0-9æøå ]/gu, " ").replace(/\s+/gu, " ").trim();

function ownedKeys(config) {
  return [config.podcast_key, ...(config.owned_podcast_keys || []),
    ...(config.routes || []).map(route => route.podcast_key).filter(Boolean)];
}

export function checkEpisodeFeedCoverage(payload, staticConfigs = FEED_CONFIGS) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
  const { configs, audit } = mergeSheetFeedConfigs(payload, staticConfigs);
  const findings = [];
  let rowsWithFeeds = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const feed = String(row.Feed ?? row.feed ?? "").trim();
    if (!feed) continue;
    rowsWithFeeds++;
    const podcastKey = String(row["Podcast-ID"] ?? row["Podcast ID"] ?? row.PodcastID ?? "").trim();
    const title = String(row.Titel ?? "").trim().slice(0, 140);
    if (!podcastKey) {
      findings.push({ podcast_key: "(mangler)", title, cause: "missing_podcast_id" });
      continue;
    }
    const key = normalizeKey(podcastKey);
    const owners = Object.values(configs).filter(config => ownedKeys(config)
      .some(owned => normalizeKey(owned) === key));
    const enabled = owners.filter(config => config.enabled !== false && config.metadata_only !== true);
    const match = feed.match(/^https:\/\/open\.podimo\.com\/podcast\/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})(?:[/?#]|$)/iu);
    if (match) {
      const showId = match[1].toLowerCase();
      const podimo = enabled.filter(config => config.format === "podimo_graphql");
      if (podimo.length && !podimo.some(config => String(config.podcast_id || "").toLowerCase() === showId)) {
        findings.push({ podcast_key: podcastKey, title, cause: "podimo_show_id_mismatch" });
        continue;
      }
    }
    if (!enabled.length) {
      findings.push({ podcast_key: podcastKey, title, cause: "missing_or_disabled_import_adapter" });
    }
  }
  findings.sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da") || a.cause.localeCompare(b.cause));
  return {
    catalogue_rows: rows.length,
    catalogue_rows_with_feed: rowsWithFeeds,
    active_config_count: audit.total_enabled_feeds,
    review_warning_count: audit.feed_warnings.length,
    findings
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
  const report = checkEpisodeFeedCoverage(payload);
  const output = JSON.stringify(report, null, 2) + "\n";
  if (process.argv[2]) await writeFile(process.argv[2], output, "utf8");
  else process.stdout.write(output);
}
