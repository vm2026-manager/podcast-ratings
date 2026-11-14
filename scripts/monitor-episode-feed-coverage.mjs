import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { parsePodimoShowFeed } from "../supabase/functions/import-podcast-episodes/feed-syntax.mjs";
import { fetchPublicHttpsText, verifyRssEvidence, verifyPodimoPublicRssEvidence } from "./rss-feed-verification.mjs";

// Read-only catalogue-to-adapter audit. No feed fetch, database, secrets, cron
// changes or production writes. Safe for Supabase Free.
const normalizeKey = value => String(value ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/&/gu, " og ")
  .replace(/[^a-z0-9æøå ]/gu, " ").replace(/\s+/gu, " ").trim();

function ownedKeys(config) {
  return [config.podcast_key, ...(config.owned_podcast_keys || []),
    ...(config.routes || []).map(route => route.podcast_key).filter(Boolean)];
}

function configOwnersForPodcastId(podcastId, configs) {
  return Object.entries(configs).filter(([, config]) => ownedKeys(config)
    .some(owned => normalizeKey(owned) === normalizeKey(podcastId)));
}

/**
 * Read-only per-exact-Podcast-ID view of the importer lifecycle.
 * This process can see catalogue evidence and code-owned adapters, but it has
 * no Management API credential and deliberately does not infer deployment,
 * cron execution, database writes, or frontend visibility from those stages.
 */
export function buildEpisodeImportLifecycle(payload, staticConfigs = FEED_CONFIGS) {
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];
  const { configs, audit } = mergeSheetFeedConfigs(payload, staticConfigs);
  const byId = new Map();
  for (const row of rows) {
    const id = String(row?.["Podcast-ID"] ?? row?.["Podcast ID"] ?? row?.PodcastID ?? "").trim();
    if (!id) continue;
    const exact = byId.get(id) || [];
    exact.push(row);
    byId.set(id, exact);
  }
  const normalizedIds = new Map();
  for (const id of byId.keys()) {
    const key = normalizeKey(id);
    normalizedIds.set(key, [...(normalizedIds.get(key) || []), id]);
  }

  const lifecycle = [];
  for (const [podcastId, exactRows] of byId) {
    const row = exactRows[0];
    const feed = String(row?.Feed ?? row?.feed ?? "").trim();
    const owners = configOwnersForPodcastId(podcastId, configs);
    const activeOwners = owners.filter(([, config]) => config.enabled !== false && config.metadata_only !== true);
    const verification = row?.episodeFeedVerification;
    const verificationMatchesRow = verification?.version === 1 && verification?.podcast_id === podcastId &&
      verification?.catalogue_id === String(row?.catalogue_id ?? "").trim() &&
      (verification.feed_url === feed || verification.catalogue_feed_url === feed) &&
      verification.official_url === String(row?.Link ?? "").trim() &&
      verification.publisher === String(row?.Udgiver ?? "").trim();
    const verificationStatus = verification?.status === "verified" && verificationMatchesRow
      ? "verified" : verification?.status === "review_required" ? "review_required" : "not_recorded";
    const resolution = audit.feed_warnings.find(entry => normalizeKey(entry.podcast_key) === normalizeKey(podcastId));
    const manualEpisodes = Array.isArray(row?.manualEpisodes) ? row.manualEpisodes.length > 0 :
      String(row?.manualEpisodes ?? "").split(";").some(value => value.trim());
    const formatOf = config => config.format || "rss";
    const adapterOwners = owners.map(([feedKey, config]) => ({
      feed_key: feedKey,
      source: config.source || null,
      format: formatOf(config),
      enabled: config.enabled !== false && config.metadata_only !== true,
      metadata_only: config.metadata_only === true,
      feed_url: config.feed_url || null,
      identity: config.format === "podimo_graphql" ? { podimo_show_uuid: config.podcast_id || null } :
        config.podimo_public_rss_identity_required === true ? {
          podimo_show_uuid: config.podimo_show_id || null,
          apple_collection_id: config.apple_collection_id || null,
          public_rss_url: config.feed_url || null
        } : config.apple_show_id ? { apple_show_id: config.apple_show_id } : null
    }));
    const normalizedCollision = (normalizedIds.get(normalizeKey(podcastId)) || []).length > 1;
    const blockers = [];
    const evidenceGaps = [];
    if (exactRows.length !== 1) blockers.push({ stage: "catalogue", code: "duplicate_exact_podcast_id",
      reason: `Expected one exact Podcast-ID row; found ${exactRows.length}.` });
    if (normalizedCollision) blockers.push({ stage: "catalogue", code: "normalized_podcast_id_collision",
      reason: "Another Podcast-ID collides after catalogue identity normalization." });
    if (resolution) blockers.push({ stage: "adapter", code: resolution.reason,
      reason: `Sheet feed resolution requires review: ${resolution.reason}.` });
    if (verification?.status === "review_required") blockers.push({ stage: "source_verification",
      code: String(verification.reason || "source_identity_review_required"),
      reason: `Source verification is review_required: ${String(verification.reason || "identity evidence missing")}.` });
    if (verification?.status === "verified" && !verificationMatchesRow) blockers.push({ stage: "source_verification",
      code: "source_verification_evidence_mismatch",
      reason: "Published verified evidence does not exactly match the current Podcast-ID, catalogue ID, feed URL, official link and publisher." });
    if (owners.length > 1) blockers.push({ stage: "adapter", code: "multiple_adapter_owners",
      reason: `Found ${owners.length} code-owned adapter configurations for this Podcast-ID.` });
    if (owners.length === 1 && !activeOwners.length) blockers.push({ stage: "adapter", code: "adapter_disabled",
      reason: `Adapter ${owners[0][0]} (${owners[0][1].source || "source unset"}) is disabled or metadata-only.` });
    if (!owners.length && !manualEpisodes) blockers.push({ stage: "adapter", code: "adapter_not_configured",
      reason: "No enabled code-owned import adapter or manual episode list matches this exact Podcast-ID." });
    if (owners.length && !verificationMatchesRow && !verification &&
        activeOwners.every(([, config]) => config.format === "rss" && config.auto_verified_rss === true)) {
      evidenceGaps.push({ stage: "source_verification", code: "source_verification_not_recorded",
        reason: "This RSS adapter requires published exact source-verification evidence." });
    }
    evidenceGaps.push({ stage: "deployed_edge", code: "deployment_status_unavailable_to_coverage_job",
      reason: "Coverage has no Supabase Management API credential; main code cannot prove the deployed Edge Function version." });
    evidenceGaps.push({ stage: "scheduled_import", code: "per_podcast_scheduled_run_not_observable",
      reason: "Coverage runs as an audit and cannot attribute an external Supabase cron invocation to this Podcast-ID." });
    evidenceGaps.push({ stage: "database", code: "production_episode_state_not_checked_by_coverage",
      reason: "The coverage pass does not query Supabase episode/import tables; the bounded post-import monitor checks only changed IDs." });
    evidenceGaps.push({ stage: "frontend", code: "live_episode_visibility_not_observed",
      reason: "Catalogue and adapter checks do not prove an active rateable episode was fetched and rendered by the live frontend." });

    const adapterStatus = blockers.some(item => item.stage === "adapter") ? "blocked" :
      activeOwners.length ? "enabled_in_main_code" : manualEpisodes ? "manual_catalogue" : "missing";
    lifecycle.push({
      podcast_id: podcastId,
      catalogue: { status: exactRows.length === 1 && !normalizedCollision ? "unique" : "identity_conflict",
        exact_row_count: exactRows.length, catalogue_id: row?.catalogue_id || null, feed_url: feed || null },
      source_verification: { status: verificationStatus,
        reason: verificationStatus === "review_required" ? verification?.reason || "identity_evidence_missing" : null,
        evidence_matches_current_row: verificationStatus === "verified" },
      adapter: { status: adapterStatus, owners: adapterOwners },
      deployment: { status: "unknown" },
      scheduled_import: { status: "not_observed_by_coverage" },
      database: { status: "not_checked_by_coverage" },
      frontend: { status: "not_live_verified" },
      lifecycle_status: blockers.length ? "blocked" : "awaiting_production_evidence",
      blocking_reason: blockers[0]?.reason || null,
      next_unverified_stage: evidenceGaps[0]?.reason || null,
      blockers,
      evidence_gaps: evidenceGaps
    });
  }
  return lifecycle.sort((a, b) => a.podcast_id.localeCompare(b.podcast_id, "da"));
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
    const verificationReason = verification?.status === "review_required" &&
      (verification.feed_url === feed || verification.catalogue_feed_url === feed)
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
      const verifiedPodimoRss = enabled.some(config => config.format === "rss" &&
        config.podimo_public_rss_identity_required === true && config.podcast_key === podcastKey &&
        config.podimo_show_id === showId && config.podimo_show_url === String(row.Link ?? "").trim() &&
        config.podimo_catalogue_id === String(row.catalogue_id ?? "").trim());
      if (podimoAdapters.length && !podimoAdapters.some(config => String(config.podcast_id || "").toLowerCase() === showId)) {
        findings.push({ podcast_key: podcastKey, title, cause: "podimo_show_id_mismatch", ...approvalFields,
          blocking: "podimo_show_id_mismatch", required_approval: "exact_podimo_show_uuid_review", podimo_show_id: showId });
        continue;
      }
      if (!podimoAdapters.length && !reviewedRssOverride && !verifiedPodimoRss) {
        const blockingReason = verificationReason
          ? `source_verification_${String(verificationReason).replace(/[^a-zA-Z0-9_-]/gu, "_").slice(0, 100)}`
          : blocking || resolution?.reason || "podimo_adapter_review_required";
        findings.push({ podcast_key: podcastKey, title,
          cause: verificationReason ? `podimo_public_rss_${verificationReason}` : "podimo_adapter_review_required",
          ...approvalFields, blocking: blockingReason,
          required_approval: verificationReason ? approvalFields.required_approval : "exact_podimo_show_uuid_and_adapter_review",
          podimo_show_id: showId });
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
    findings,
    lifecycle_by_podcast_id: buildEpisodeImportLifecycle(payload, staticConfigs)
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
      (String(item?.Feed ?? "").trim() === config.feed_url ||
        config.podimo_public_rss_identity_required === true &&
          parsePodimoShowFeed(item?.Feed)?.showId === config.podimo_show_id));
    if (!row) {
      findings.push({ podcast_key: config.podcast_key, cause: "active_rss_catalogue_identity_missing",
        source: config.source, feed_url: config.feed_url, blocking: "active_rss_catalogue_identity_missing",
        required_approval: "human_source_identity_review_required" });
      continue;
    }
    let verification;
    try {
      if (config.podimo_public_rss_identity_required === true) {
        const lookupUrl = new URL("https://itunes.apple.com/lookup");
        lookupUrl.searchParams.set("id", String(config.apple_collection_id)); lookupUrl.searchParams.set("entity", "podcast");
        const [feed, page, lookupText] = await Promise.all([
          fetchText(config.feed_url), fetchText(String(row.Link ?? "").trim()), fetchText(lookupUrl.href)
        ]);
        const lookup = JSON.parse(lookupText);
        verification = await verifyPodimoPublicRssEvidence(row, feed, page, lookup, lookup);
        if (verification.status === "verified" && verification.apple_collection_id !== config.apple_collection_id) {
          verification = { status: "review_required", reason: "apple_collection_id_mismatch" };
        }
      } else {
        const [feed, page] = await Promise.all([fetchText(config.feed_url), fetchText(String(row.Link ?? "").trim())]);
        verification = verifyRssEvidence(row, feed, page);
      }
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
