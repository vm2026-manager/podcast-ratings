import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { checkEpisodeFeedCoverage } from "./monitor-episode-feed-coverage.mjs";

export const MAX_EPISODES_PER_RUN = 10;
export const MAX_API_REQUESTS_PER_RUN = MAX_EPISODES_PER_RUN * 2;
export const MIN_RECHECK_AGE_MS = 18 * 60 * 60 * 1000;
export const ZERO_EPISODE_ALERT_AGE_MS = 36 * 60 * 60 * 1000;
export const POST_IMPORT_STATE_MARKER = "<!-- episode-feed-post-import-state -->";
const STATE_BEGIN = "<!-- episode-feed-post-import-state-begin -->";
const STATE_END = "<!-- episode-feed-post-import-state-end -->";

const normalizeKey = value => String(value ?? "").trim().toLowerCase()
  .normalize("NFD").replace(/[\u0300-\u036f]/gu, "").replace(/&/gu, " og ")
  .replace(/[^a-z0-9æøå ]/gu, " ").replace(/\s+/gu, " ").trim();
const exactId = row => String(row?.["Podcast-ID"] ?? row?.["Podcast ID"] ?? row?.PodcastID ?? "").trim();
const feedValue = row => String(row?.Feed ?? row?.feed ?? "").trim();
const asRows = payload => Array.isArray(payload) ? payload : Array.isArray(payload?.rows) ? payload.rows : [];

function readGitJson(ref, path) {
  try { return JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8" })); }
  catch { return null; }
}

function candidateFromRow(row, kind, observedAt, detail = {}) {
  return {
    podcast_key: exactId(row),
    title: String(row?.Titel ?? "").trim().slice(0, 140),
    feed: feedValue(row),
    change_type: kind,
    observed_at: observedAt,
    ...detail
  };
}

export function diffFeedCandidates(beforePayload, afterPayload, observedAt = new Date().toISOString()) {
  const before = asRows(beforePayload);
  const after = asRows(afterPayload);
  const beforeById = new Map(before.filter(row => exactId(row)).map(row => [exactId(row), row]));
  const afterById = new Map(after.filter(row => exactId(row)).map(row => [exactId(row), row]));
  const candidates = [];

  for (const [id, next] of afterById) {
    const prior = beforeById.get(id);
    const nextFeed = feedValue(next);
    const priorFeed = feedValue(prior);
    if (!prior && nextFeed) candidates.push(candidateFromRow(next, "catalogue_feed_added", observedAt));
    else if (prior && nextFeed !== priorFeed) {
      candidates.push(candidateFromRow(next, nextFeed ? "catalogue_feed_changed" : "catalogue_feed_removed", observedAt,
        { previous_feed: priorFeed }));
    }
  }
  for (const [id, prior] of beforeById) {
    if (!afterById.has(id) && feedValue(prior)) {
      candidates.push(candidateFromRow(prior, "catalogue_podcast_id_removed", observedAt));
    }
  }

  return candidates.sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da"));
}

export function extractChangedConfigPodcastKeys(diffText) {
  const keys = new Set();
  for (const line of String(diffText ?? "").split(/\r?\n/u)) {
    if (!/^[+\-]/u.test(line) || /^\+\+\+|^---/u.test(line)) continue;
    const content = line.slice(1);
    for (const match of content.matchAll(/\bpodcast_key\s*:\s*["'`]([^"'`]+)["'`]/gu)) {
      const key = String(match[1]).trim();
      if (key) keys.add(key);
    }
  }
  return [...keys];
}

function findLookbackBase(headRef, hours) {
  const commits = execFileSync("git", ["log", `--since=${hours} hours ago`, "--format=%H", headRef, "--",
    "data/podcasts.json", "supabase/functions/import-podcast-episodes/feed-config.ts",
    "supabase/functions/import-podcast-episodes/runtime-feed-config.ts"], { encoding: "utf8" })
    .trim().split(/\r?\n/u).filter(Boolean);
  if (!commits.length) return null;
  const earliest = commits.at(-1);
  try {
    return execFileSync("git", ["rev-parse", `${earliest}^`], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

export function collectChanges({
  beforeRef = "",
  headRef = "HEAD",
  lookbackHours = 36,
  now = () => new Date().toISOString(),
  readJson = readGitJson,
  readDiff = (base, head, file) => execFileSync("git", ["diff", "--unified=30", base, head, "--", file], { encoding: "utf8" })
} = {}) {
  const head = String(headRef || "HEAD");
  let base = String(beforeRef || "");
  if (!base || /^0+$/u.test(base)) base = findLookbackBase(head, lookbackHours) || "";
  const after = readJson(head, "data/podcasts.json");
  const before = base ? readJson(base, "data/podcasts.json") : null;
  if (!after) return { candidates: [], scope_warning: "current_catalogue_unavailable" };

  const observedAt = now();
  const candidates = before ? diffFeedCandidates(before, after, observedAt) : [];
  const warnings = [];
  const configDiff = base ? readDiff(base, head, "supabase/functions/import-podcast-episodes/feed-config.ts") : "";
  const changedConfigKeys = extractChangedConfigPodcastKeys(configDiff);
  if (changedConfigKeys.length) {
    const rowsByNormalizedId = new Map(asRows(after).map(row => [normalizeKey(exactId(row)), row]));
    for (const key of changedConfigKeys) {
      const row = rowsByNormalizedId.get(normalizeKey(key));
      if (!row || !feedValue(row)) continue;
      candidates.push(candidateFromRow(row, "adapter_config_changed", observedAt, { config_key: key }));
    }
  } else if (configDiff) {
    warnings.push("feed_config_changed_without_exact_podcast_id_mapping");
  }

  const runtimeDiff = base ? readDiff(base, head, "supabase/functions/import-podcast-episodes/runtime-feed-config.ts") : "";
  if (runtimeDiff) warnings.push("runtime_feed_mapping_changed_review_scope_required");

  const unique = new Map();
  for (const candidate of candidates) {
    if (!candidate.podcast_key) continue;
    const prior = unique.get(candidate.podcast_key);
    if (!prior || candidate.change_type === "adapter_config_changed") unique.set(candidate.podcast_key, candidate);
  }
  return {
    base_ref: base || null,
    head_ref: head,
    candidates: [...unique.values()].sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da")),
    scope_warnings: warnings
  };
}

function ownerConfigsFor(id, configs) {
  return Object.values(configs).filter(config => [config.podcast_key, ...(config.owned_podcast_keys || []),
    ...(config.routes || []).map(route => route.podcast_key).filter(Boolean)]
    .some(key => normalizeKey(key) === normalizeKey(id)));
}

export function classifyCandidate(candidate, payload, { staticConfigs = FEED_CONFIGS } = {}) {
  const rows = asRows(payload);
  const id = String(candidate?.podcast_key ?? "").trim();
  if (!id) return { ...candidate, catalogue_status: "invalid_id", adapter_status: "not_checked", status: "review_required" };
  const exactRows = rows.filter(row => exactId(row) === id);
  if (candidate.change_type === "catalogue_podcast_id_removed" || !exactRows.length) {
    return { ...candidate, catalogue_status: "podcast_id_removed", adapter_status: "not_applicable", status: "catalogue_id_removed" };
  }
  if (exactRows.length !== 1 || rows.some(row => exactId(row) !== id && normalizeKey(exactId(row)) === normalizeKey(id))) {
    return { ...candidate, catalogue_status: "identity_collision", adapter_status: "not_checked", status: "identity_collision" };
  }
  const row = exactRows[0];
  const currentFeed = feedValue(row);
  if (!currentFeed) return { ...candidate, feed: "", catalogue_status: "feed_removed", adapter_status: "not_applicable", status: "catalogue_feed_removed" };
  const lifecycle = String(row.Status ?? row.status ?? row.Seriestatus ?? row["Serie status"] ?? row.Lifecycle ?? "")
    .trim().toLowerCase();
  if (/^(afsluttet|arkiveret|afsluttet\/arkiveret|completed|archived)$/u.test(lifecycle)) {
    return { ...candidate, feed: currentFeed, catalogue_status: "series_archived", adapter_status: "not_applicable", status: "archived_series" };
  }

  const { configs, audit } = mergeSheetFeedConfigs(payload, staticConfigs);
  const owners = ownerConfigsFor(id, configs);
  const enabled = owners.filter(config => config.enabled !== false && config.metadata_only !== true);
  const resolution = audit.feed_warnings.find(entry => normalizeKey(entry.podcast_key) === normalizeKey(id));
  const coverageFinding = checkEpisodeFeedCoverage(payload, staticConfigs).findings
    .find(finding => normalizeKey(finding.podcast_key) === normalizeKey(id));
  if (!enabled.length && Array.isArray(row.manualEpisodes) && row.manualEpisodes.length > 0) {
    return { ...candidate, feed: currentFeed, catalogue_status: "feed_present", adapter_status: "manual_episode_source",
      status: "manual_episode_source" };
  }
  if (coverageFinding || resolution) {
    return {
      ...candidate, feed: currentFeed, catalogue_status: "feed_present",
      adapter_status: "review_required", source: enabled.map(config => config.source),
      review_reason: coverageFinding?.cause || resolution?.reason || "feed_resolution_requires_review",
      status: "review_required"
    };
  }
  if (!enabled.length) {
    const manual = Array.isArray(row.manualEpisodes) && row.manualEpisodes.length > 0;
    return {
      ...candidate, feed: currentFeed, catalogue_status: "feed_present",
      adapter_status: manual ? "manual_episode_source" : owners.length ? "disabled" : "unrouted",
      source: owners.map(config => config.source),
      status: manual ? "manual_episode_source" : owners.length ? "adapter_disabled" : "review_required"
    };
  }
  return {
    ...candidate, feed: currentFeed, catalogue_status: "feed_present",
    adapter_status: "approved_active", source: enabled.map(config => config.source),
    status: "ready_for_production_count"
  };
}

function exactCountFromContentRange(value) {
  const match = String(value ?? "").trim().match(/^(?:\d+-\d+|\*)\/(\d+|\*)$/u);
  if (!match || match[1] === "*") return null;
  const count = Number(match[1]);
  return Number.isSafeInteger(count) && count >= 0 ? count : null;
}

export async function countActiveEpisodes({
  baseUrl,
  anonKey,
  podcastKey,
  importedSince = "",
  fetchImpl = globalThis.fetch,
  timeoutMs = 10000
} = {}) {
  if (!baseUrl || !anonKey) return { status: "authorization_missing", count: null, http_status: null, request_sent: false };
  if (typeof fetchImpl !== "function") return { status: "api_error", count: null, http_status: null, error: "fetch_unavailable", request_sent: false };
  const url = new URL("/rest/v1/podcast_episodes", baseUrl);
  url.searchParams.set("select", "podcast_key");
  url.searchParams.set("podcast_key", `eq.${podcastKey}`);
  url.searchParams.set("is_active", "eq.true");
  if (importedSince) url.searchParams.set("imported_at", `gte.${importedSince}`);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, {
      method: "HEAD",
      headers: {
        apikey: anonKey,
        authorization: `Bearer ${anonKey}`,
        prefer: "count=exact",
        range: "0-0"
      },
      signal: controller.signal
    });
  } catch (_error) {
    return { status: "api_error", count: null, http_status: null, error: "request_failed", request_sent: true };
  } finally {
    clearTimeout(timer);
  }
  if (response.status === 401 || response.status === 403) {
    return { status: "authorization_denied", count: null, http_status: response.status, request_sent: true };
  }
  if (!response.ok) return { status: "api_error", count: null, http_status: response.status, request_sent: true };
  const count = exactCountFromContentRange(response.headers?.get?.("content-range"));
  if (count === null) return { status: "api_error", count: null, http_status: response.status, error: "missing_exact_content_range", request_sent: true };
  return { status: "counted", count, http_status: response.status, request_sent: true };
}

function pendingEligible(entry, nowMs) {
  const checkedAt = Date.parse(entry.last_checked_at || entry.observed_at || "");
  return Number.isFinite(checkedAt) && ["awaiting_existing_import_window", "zero_active_episodes", "active_episodes_preexisting_import_unverified",
    "authorization_missing", "authorization_denied", "api_error", "deferred_by_daily_budget"].includes(entry.status) &&
    nowMs - checkedAt >= MIN_RECHECK_AGE_MS;
}

export async function monitorEpisodeFeedDelta({
  candidates = [],
  pending = [],
  payload,
  baseUrl = process.env.PODCAST_SUPABASE_URL,
  anonKey = process.env.PODCAST_SUPABASE_ANON_KEY,
  staticConfigs = FEED_CONFIGS,
  now = () => new Date(),
  fetchImpl = globalThis.fetch,
  maxPerRun = MAX_EPISODES_PER_RUN
} = {}) {
  const timestamp = now().toISOString();
  const nowMs = Date.parse(timestamp);
  const byId = new Map();
  for (const entry of pending) if (entry?.podcast_key) byId.set(entry.podcast_key, entry);
  for (const entry of candidates) if (entry?.podcast_key) {
    const prior = byId.get(entry.podcast_key);
    const sameObservedChange = prior && prior.change_type === entry.change_type && prior.feed === entry.feed &&
      prior.config_key === entry.config_key;
    byId.set(entry.podcast_key, { ...prior, ...entry,
      observed_at: sameObservedChange ? prior.observed_at : entry.observed_at || timestamp });
  }

  const scoped = [...byId.values()].map(entry => classifyCandidate(entry, payload, { staticConfigs }))
    .map(entry => ({ ...entry, production_status: "not_checked" }));
  const needsApi = scoped.filter(entry => entry.status === "ready_for_production_count");
  const priorById = new Map(pending.map(old => [old.podcast_key, old]));
  const runnable = needsApi.filter(entry => {
    const prior = priorById.get(entry.podcast_key);
    return !prior || pendingEligible(prior, nowMs);
  }).sort((a, b) => {
    const lastA = Date.parse(priorById.get(a.podcast_key)?.last_checked_at || a.observed_at || 0);
    const lastB = Date.parse(priorById.get(b.podcast_key)?.last_checked_at || b.observed_at || 0);
    return lastA - lastB || a.podcast_key.localeCompare(b.podcast_key, "da");
  });
  const runIds = new Set(runnable.slice(0, maxPerRun).map(entry => entry.podcast_key));
  const results = [];
  let apiRequestCount = 0;

  for (const entry of scoped) {
    if (entry.status !== "ready_for_production_count") {
      results.push({ ...entry, last_checked_at: timestamp });
      continue;
    }
    if (!runIds.has(entry.podcast_key)) {
      const prior = pending.find(old => old.podcast_key === entry.podcast_key);
      results.push(prior
        ? { ...entry, ...prior, catalogue_status: entry.catalogue_status, adapter_status: entry.adapter_status, source: entry.source }
        : { ...entry, last_checked_at: timestamp, status: "deferred_by_daily_budget" });
      continue;
    }

    const total = await countActiveEpisodes({ baseUrl, anonKey, podcastKey: entry.podcast_key, fetchImpl });
    if (total.request_sent) apiRequestCount++;
    if (total.status !== "counted") {
      results.push({ ...entry, status: total.status, production_status: "unknown",
        last_checked_at: timestamp, api_http_status: total.http_status, api_error: total.error || null });
      continue;
    }
    if (total.count === 0) {
      const observedAt = Date.parse(entry.observed_at || timestamp);
      const status = nowMs - observedAt >= ZERO_EPISODE_ALERT_AGE_MS
        ? "zero_active_episodes" : "awaiting_existing_import_window";
      results.push({ ...entry, status, production_status: "zero_active_episodes",
        last_checked_at: timestamp, active_episode_count: 0, inactive_or_teaser_status: "not_visible_under_anon_rls",
        post_change_active_episode_count: null, api_http_status: total.http_status });
      continue;
    }

    const postChange = entry.observed_at
      ? await countActiveEpisodes({ baseUrl, anonKey, podcastKey: entry.podcast_key,
        importedSince: entry.observed_at, fetchImpl })
      : { status: "api_error", count: null, http_status: null, error: "missing_observed_at" };
    if (postChange.request_sent) apiRequestCount++;
    if (postChange.status !== "counted") {
      results.push({ ...entry, status: postChange.status, production_status: "active_counted_import_time_unavailable",
        last_checked_at: timestamp,
        active_episode_count: total.count, post_change_active_episode_count: null,
        api_http_status: postChange.http_status, api_error: postChange.error || null });
      continue;
    }
    const postChangeCount = postChange.count;
    results.push({
      ...entry,
      status: postChangeCount > 0 ? "post_change_episodes_observed" : "active_episodes_preexisting_import_unverified",
      last_checked_at: timestamp,
      production_status: postChangeCount > 0 ? "active_episodes_and_post_change_import_observed" : "active_episodes_only_import_unverified",
      active_episode_count: total.count,
      post_change_active_episode_count: postChangeCount,
      api_http_status: total.http_status
    });
  }

  const carry = results.filter(entry => ["awaiting_existing_import_window", "zero_active_episodes",
    "active_episodes_preexisting_import_unverified", "authorization_missing", "authorization_denied", "api_error",
    "deferred_by_daily_budget", "post_change_episodes_observed"].includes(entry.status) &&
    nowMs - Date.parse(entry.last_checked_at || entry.observed_at || 0) <= 36 * 60 * 60 * 1000);
  return {
    generated_at: timestamp,
    production_access: baseUrl && anonKey ? "anon_active_episodes_only" : "authorization_missing",
    max_candidates_per_run: maxPerRun,
    max_api_requests_per_run: maxPerRun * 2,
    api_request_count: apiRequestCount,
    candidate_count: byId.size,
    scope_limit_exceeded: byId.size > maxPerRun,
    candidates: results.sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da")),
    pending: carry.map(({ podcast_key, title, feed, change_type, observed_at, previous_feed, config_key,
      status, last_checked_at, api_http_status, api_error, active_episode_count,
      post_change_active_episode_count }) => ({ podcast_key, title, feed, change_type, observed_at, previous_feed,
      config_key, status, last_checked_at, api_http_status, api_error, active_episode_count,
      post_change_active_episode_count }))
  };
}

export function renderProductionMonitorComment(report) {
  const esc = value => String(value ?? "").replace(/@/gu, "＠").replace(/[<>]/gu, "");
  const rows = report.candidates.map(entry => {
    const count = entry.active_episode_count === undefined ? "ukendt" : String(entry.active_episode_count);
    const since = entry.post_change_active_episode_count === null || entry.post_change_active_episode_count === undefined
      ? "ukendt" : String(entry.post_change_active_episode_count);
    const failure = entry.api_http_status ? `; HTTP=${entry.api_http_status}` : "";
    const error = entry.api_error ? `; fejl=${esc(entry.api_error)}` : "";
    const checked = entry.last_checked_at ? `; kontrolleret=${esc(entry.last_checked_at)}` : "";
    return `- \`${esc(entry.podcast_key)}\` — **${esc(entry.status)}**; katalog=${esc(entry.catalogue_status)}; adapter=${esc(entry.adapter_status)}; aktiv=${count}; aktiv efter ændring=${since}${failure}${error}${checked}; sidste importsucces/-fejl/deploy=ikke tilgængelig via anon API`;
  });
  const state = JSON.stringify({ pending: report.pending });
  return `${POST_IMPORT_STATE_MARKER}\n\n## Afgrænset post-import kontrol\n\nKontrollerede kun nye/ændrede Podcast-ID'er. ` +
    `API-adgang=${report.production_access}; forespørgsler=${report.api_request_count}; ` +
    `budget=${report.max_candidates_per_run} ID'er og højst ${report.max_api_requests_per_run} tælleforespørgsler pr. dag. \`episode_import_runs\` og Edge Function deploystatus er ikke synlige med anon-adgang.\n\n` +
    (report.scope_warnings?.length ? `Scope kræver ID-review før episodeforespørgsel: ${report.scope_warnings.join(", ")}.\n\n` : "") +
    (rows.length ? rows.join("\n") : "Ingen ventende eller nye ID'er krævede post-import kontrol.") +
    `\n\n${STATE_BEGIN}\n${state}\n${STATE_END}`;
}

async function main() {
  const args = process.argv.slice(2);
  const valueAfter = flag => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : "";
  };
  const outputPath = valueAfter("--output");
  const pendingPath = valueAfter("--pending-file");
  const beforeRef = process.env.EPISODE_FEED_BASE_SHA || "";
  const headRef = process.env.EPISODE_FEED_HEAD_SHA || "HEAD";
  const changes = collectChanges({ beforeRef, headRef });
  const candidates = changes.candidates;
  const prior = pendingPath ? JSON.parse(await readFile(pendingPath, "utf8")) : [];
  const payload = JSON.parse(await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8"));
  const report = await monitorEpisodeFeedDelta({ candidates, pending: prior, payload });
  report.scope_warnings = changes.scope_warnings || [];
  report.base_ref = changes.base_ref;
  report.head_ref = changes.head_ref;
  report.comment_body = renderProductionMonitorComment(report);
  const serialized = JSON.stringify(report, null, 2) + "\n";
  if (outputPath) await writeFile(outputPath, serialized, "utf8");
  else process.stdout.write(serialized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
