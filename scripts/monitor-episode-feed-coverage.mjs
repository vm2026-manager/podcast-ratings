import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { parsePodimoShowFeed } from "../supabase/functions/import-podcast-episodes/feed-syntax.mjs";
import { fetchPublicHttpsText, verifyRssEvidence } from "./rss-feed-verification.mjs";

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
    const podimo = parsePodimoShowFeed(feed);
    const resolution = audit.feed_warnings.find(entry =>
      normalizeKey(entry.podcast_key) === key && entry.sheet_feed === feed);
    const verification = row.episodeFeedVerification;
    const verificationReason = verification?.status === "review_required" && verification.feed_url === feed
      ? String(verification.reason || "identity_evidence_missing") : null;
    const blocking = resolution?.reason || (verificationReason ? `source_verification_${verificationReason}` : null);
    const transientVerification = ["dns_lookup_failed", "request_timeout", "network_unavailable"].includes(verificationReason || "") ||
      /^http_status_5\d\d$/u.test(verificationReason || "");
    const adapterSource = owners.find(config => config.format === "podimo_graphql")?.source ||
      owners.find(config => config.source)?.source ||
      (podimo ? "podimo_graphql (not approved)" : `sheet_${key.replace(/\s+/gu, "_")}_rss`);
    const approvalFields = {
      feed_url: feed,
      source: adapterSource,
      blocking,
      required_approval: transientVerification ? "automatic_retry_after_24_hours_no_manual_approval" :
        verificationReason ? "human_source_identity_review_required" :
          "automatic_source_verification_pending"
    };
    if (podimo) {
      const reviewedRssOverride = enabled.some(config => config.supersedes_sheet_feed === true &&
        config.format === "rss" && config.expected_rss_channel_title && config.expected_external_guid_prefix);
      const showId = podimo.showId;
      const podimoAdapters = enabled.filter(config => config.format === "podimo_graphql");
      if (podimoAdapters.length && !podimoAdapters.some(config => String(config.podcast_id || "").toLowerCase() === showId)) {
        findings.push({ podcast_key: podcastKey, title, cause: "podimo_show_id_mismatch", ...approvalFields,
          blocking: "podimo_show_id_mismatch", required_approval: "exact_podimo_show_uuid_review", podimo_show_id: showId });
        continue;
      }
      if (!podimoAdapters.length && !reviewedRssOverride) {
        findings.push({ podcast_key: podcastKey, title, cause: "podimo_adapter_review_required", ...approvalFields,
          blocking: resolution?.reason || "podimo_adapter_review_required", required_approval: "exact_podimo_show_uuid_and_adapter_review", podimo_show_id: showId });
        continue;
      }
    }
    if (!enabled.length) {
      findings.push({ podcast_key: podcastKey, title, cause: "missing_or_disabled_import_adapter", ...approvalFields,
        blocking: blocking || (owners.length ? "adapter_disabled" : "missing_or_disabled_import_adapter") });
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

export async function verifyActiveRssSources(payload, { fetchText = fetchPublicHttpsText, maxChecks = 20,
  dayIndex = Math.floor(Date.now() / 86400000) } = {}) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
  const { configs } = mergeSheetFeedConfigs(payload);
  const sources = Object.values(configs).filter(config => config.auto_verified_rss === true && config.enabled !== false)
    .sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da"));
  const checked = sources.length <= maxChecks ? sources :
    Array.from({ length: maxChecks }, (_, index) => sources[(dayIndex * maxChecks + index) % sources.length]);
  const findings = [];
  for (const config of checked) {
    const row = rows.find(item => String(item?.["Podcast-ID"] ?? item?.["Podcast ID"] ?? item?.PodcastID ?? "").trim() === config.podcast_key &&
      String(item?.Feed ?? "").trim() === config.feed_url);
    if (!row) {
      findings.push({ podcast_key: config.podcast_key, cause: "active_rss_catalogue_identity_missing",
        source: config.source, feed_url: config.feed_url, blocking: "active_rss_catalogue_identity_missing",
        required_approval: "human_source_identity_review_required" });
      continue;
    }
    let verification;
    try {
      const [feed, page] = await Promise.all([fetchText(config.feed_url), fetchText(String(row.Link ?? "").trim())]);
      verification = verifyRssEvidence(row, feed, page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "verification_failed";
      const reason = /timeout/iu.test(message) ? "request_timeout" :
        /ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN/iu.test(message) ? "network_unavailable" : message.slice(0, 120);
      verification = { status: "review_required", reason };
    }
    if (verification.status !== "verified") {
      const transient = ["dns_lookup_failed", "request_timeout", "network_unavailable"].includes(verification.reason) ||
        /^http_status_5\d\d$/u.test(verification.reason || "");
      findings.push({
        podcast_key: config.podcast_key, title: String(row.Titel ?? "").slice(0, 140),
        cause: "active_rss_source_verification_failed", source: config.source, feed_url: config.feed_url,
        blocking: "source_verification_" + String(verification.reason || "identity_evidence_missing").replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 100),
        required_approval: transient ? "automatic_retry_after_24_hours_no_manual_approval" :
          "human_source_identity_review_required"
      });
    }
  }
  return { active_source_count: sources.length, checked_source_count: checked.length,
    deferred_source_count: sources.length - checked.length, findings };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
  const report = checkEpisodeFeedCoverage(payload);
  if (process.argv.includes("--verify-active-sources")) {
    report.live_source_verification = await verifyActiveRssSources(payload);
    report.findings.push(...report.live_source_verification.findings);
    report.findings.sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da") || a.cause.localeCompare(b.cause));
  }
  const output = JSON.stringify(report, null, 2) + "\n";
  if (process.argv[2]) await writeFile(process.argv[2], output, "utf8");
  else process.stdout.write(output);
}
