import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { FEED_CONFIGS } from "../supabase/functions/import-podcast-episodes/feed-config.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { countActiveEpisodes, classifyCandidate } from "./episode-feed-post-import.mjs";

export const IMPORT_STATUS_BATCH_LIMIT = 10;
export const IMPORT_STATUS_GRACE_MS = 36 * 60 * 60 * 1000;
export const IMPORT_STATUS_STATE_KEY = "import_alarms";
export const IMPORT_RECOVERY_STATE_KEY = "import_recoveries";

function exactId(row) {
  return String(row?.["Podcast-ID"] ?? row?.["Podcast ID"] ?? row?.PodcastID ?? "").trim();
}

function feed(row) { return String(row?.Feed ?? row?.feed ?? "").trim(); }
function isoTime(value, fallback) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function isApprovedCandidate(candidate, payload, staticConfigs) {
  const classified = classifyCandidate(candidate, payload, { staticConfigs });
  return classified.adapter_status === "approved_active" && classified.status === "ready_for_production_count"
    ? classified : null;
}

function currentCandidates(report, payload, priorAlarms, staticConfigs, now) {
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];
  const byId = new Map();
  for (const entry of priorAlarms) {
    if (!entry?.podcast_key) continue;
    const row = rows.find(item => exactId(item) === entry.podcast_key);
    if (!row || !feed(row)) continue;
    const candidate = { podcast_key: entry.podcast_key, feed: feed(row), change_type: "adapter_config_changed",
      observed_at: entry.activated_at || entry.first_seen_at || now };
    const classified = isApprovedCandidate(candidate, payload, staticConfigs);
    if (classified) byId.set(entry.podcast_key, classified);
  }
  for (const entry of report?.candidates || []) {
    if (!entry?.podcast_key || entry.adapter_status !== "approved_active") continue;
    const classified = isApprovedCandidate(entry, payload, staticConfigs);
    if (classified) byId.set(entry.podcast_key, classified);
  }
  return byId;
}

export function applyImportStatusAlarms({
  observations = [],
  previousAlarms = [],
  previousRecoveries = [],
  now = new Date().toISOString(),
  workflowUrl = ""
} = {}) {
  const nowMs = Date.parse(now);
  const priorByKey = new Map(previousAlarms.map(alarm => [`${alarm.podcast_key}\u0000${alarm.problem_type}`, alarm]));
  const current = new Map();
  const recoveredNow = [];

  for (const observation of observations) {
    if (!observation?.import_status_received || !observation?.podcast_key) continue;
    const activationMs = Date.parse(observation.activated_at || "");
    const afterGrace = Number.isFinite(activationMs) && nowMs - activationMs >= IMPORT_STATUS_GRACE_MS;
    const activeCount = observation.active_episode_count;
    const lastSuccess = observation.last_success_at || null;
    const lastFailure = observation.last_failure_at || null;
    const problems = [];
    if (observation.consecutive_failure_count >= 2) problems.push("two_consecutive_import_failures");
    if (observation.run_count === 0 && afterGrace) problems.push("missing_first_import");
    if (activeCount === 0 && afterGrace) problems.push("zero_usable_episodes");

    for (const problemType of problems) {
      const key = `${observation.podcast_key}\u0000${problemType}`;
      const previous = priorByKey.get(key);
      const updated = {
        podcast_key: observation.podcast_key,
        problem_type: problemType,
        activated_at: isoTime(observation.activated_at, now),
        first_seen_at: previous?.first_seen_at || now,
        last_seen_at: now,
        last_success_at: lastSuccess,
        last_failure_at: lastFailure,
        latest_run_status: observation.latest_run_status || null,
        active_episode_count: activeCount,
        workflow_url: workflowUrl || previous?.workflow_url || ""
      };
      const unchanged = previous && previous.last_success_at === updated.last_success_at &&
        previous.last_failure_at === updated.last_failure_at && previous.latest_run_status === updated.latest_run_status &&
        previous.active_episode_count === updated.active_episode_count;
      current.set(key, unchanged ? previous : updated);
    }

    for (const [key, previous] of priorByKey) {
      if (previous.podcast_key !== observation.podcast_key || current.has(key)) continue;
      const successAfterFailure = lastSuccess && (!previous.last_failure_at || Date.parse(lastSuccess) > Date.parse(previous.last_failure_at));
      const hasUsableSuccess = activeCount > 0 && observation.latest_run_status === "success" && successAfterFailure !== false;
      if (hasUsableSuccess) {
        recoveredNow.push({
          podcast_key: previous.podcast_key,
          problem_type: previous.problem_type,
          recovered_at: now,
          last_success_at: lastSuccess,
          workflow_url: workflowUrl
        });
      } else {
        const updated = { ...previous,
          last_success_at: lastSuccess || previous.last_success_at || null,
          last_failure_at: lastFailure || previous.last_failure_at || null,
          latest_run_status: observation.latest_run_status || previous.latest_run_status || null,
          active_episode_count: activeCount,
          workflow_url: workflowUrl || previous.workflow_url || "" };
        const unchanged = previous.last_success_at === updated.last_success_at && previous.last_failure_at === updated.last_failure_at &&
          previous.latest_run_status === updated.latest_run_status && previous.active_episode_count === updated.active_episode_count;
        current.set(key, unchanged ? previous : { ...updated, last_seen_at: now });
      }
    }
  }

  // API errors, denied access, and unqueried IDs do not recover or delete old alarms.
  const observedIds = new Set(observations.filter(item => item?.status === "counted").map(item => item.podcast_key));
  for (const [key, previous] of priorByKey) {
    if (!observedIds.has(previous.podcast_key) && !current.has(key)) current.set(key, previous);
  }

  const recovered = [...recoveredNow, ...previousRecoveries].slice(-20);
  const alarms = [...current.values()].sort((a, b) => a.podcast_key.localeCompare(b.podcast_key, "da") || a.problem_type.localeCompare(b.problem_type));
  const changed = JSON.stringify(alarms) !== JSON.stringify(previousAlarms) || JSON.stringify(recovered) !== JSON.stringify(previousRecoveries);
  return { alarms, recoveries: recovered, recovered_now: recoveredNow, changed };
}

async function readJson(file, fallback) {
  if (!file) return fallback;
  return JSON.parse(await readFile(file, "utf8"));
}

export async function monitorEpisodeImportStatus({
  feedReport = {},
  feedPayload,
  monitorState = {},
  baseUrl = process.env.PODCAST_SUPABASE_URL,
  anonKey = process.env.PODCAST_SUPABASE_ANON_KEY,
  projectRef = process.env.PODCAST_EPISODE_MONITOR_PROJECT_REF,
  email = process.env.PODCAST_EPISODE_MONITOR_EMAIL,
  password = process.env.PODCAST_EPISODE_MONITOR_PASSWORD,
  now = () => new Date(),
  workflowUrl = process.env.GITHUB_RUN_URL || "",
  fetchImpl = globalThis.fetch,
  staticConfigs = FEED_CONFIGS,
  maxPerRun = IMPORT_STATUS_BATCH_LIMIT
} = {}) {
  const timestamp = now().toISOString();
  const priorAlarms = Array.isArray(monitorState[IMPORT_STATUS_STATE_KEY]) ? monitorState[IMPORT_STATUS_STATE_KEY] : [];
  const priorRecoveries = Array.isArray(monitorState[IMPORT_RECOVERY_STATE_KEY]) ? monitorState[IMPORT_RECOVERY_STATE_KEY] : [];
  const payload = feedPayload || await readJson(new URL("../data/podcasts.json", import.meta.url), { rows: [] });
  const candidates = currentCandidates(feedReport, payload, priorAlarms, staticConfigs, timestamp);
  const previousById = new Map(priorAlarms.map(alarm => [alarm.podcast_key, alarm]));
  const ordered = [...candidates.values()].sort((a, b) => {
    const aOpen = previousById.has(a.podcast_key) ? 0 : 1;
    const bOpen = previousById.has(b.podcast_key) ? 0 : 1;
    const aFirst = Date.parse(previousById.get(a.podcast_key)?.first_seen_at || a.observed_at || timestamp);
    const bFirst = Date.parse(previousById.get(b.podcast_key)?.first_seen_at || b.observed_at || timestamp);
    return aOpen - bOpen || aFirst - bFirst || a.podcast_key.localeCompare(b.podcast_key, "da");
  });
  const selected = ordered.slice(0, Math.min(IMPORT_STATUS_BATCH_LIMIT, Math.max(0, maxPerRun)));
  const omitted = ordered.slice(selected.length).map(item => item.podcast_key);
  const scope = selected.map(candidate => ({
    candidate,
    activated_at: isoTime(previousById.get(candidate.podcast_key)?.activated_at || candidate.observed_at, timestamp)
  }));

  const apiRequestCount = { auth: 0, rpc: 0, episode_count: 0 };
  let accessStatus = scope.length ? "authorization_missing" : "not_needed";
  let checkedRows = [];

  const parsedUrl = (() => { try { return new URL(baseUrl || ""); } catch { return null; } })();
  const allowedUrl = parsedUrl?.protocol === "https:" && parsedUrl.hostname === `${projectRef}.supabase.co`;
  if (scope.length && baseUrl && anonKey && projectRef && allowedUrl && email && password && typeof fetchImpl === "function") {
    const authUrl = new URL("/auth/v1/token?grant_type=password", baseUrl);
    let authResponse;
    try {
      apiRequestCount.auth++;
      authResponse = await fetchImpl(authUrl, { method: "POST", headers: { apikey: anonKey, "content-type": "application/json" },
        body: JSON.stringify({ email, password }), signal: AbortSignal.timeout(10000) });
    } catch {
      accessStatus = "api_error";
    }
    if (authResponse) {
      if (authResponse.status === 401 || authResponse.status === 403) accessStatus = "authorization_denied";
      else if (!authResponse.ok) accessStatus = "api_error";
      else {
        let session;
        try { session = await authResponse.json(); } catch { session = null; }
        if (!session?.access_token) accessStatus = "api_error";
        else {
          const activatedAfter = new Date(Math.max(Date.parse(timestamp) - 14 * 24 * 60 * 60 * 1000,
            ...scope.map(item => Date.parse(item.activated_at)))).toISOString();
          let rpcResponse;
          try {
            apiRequestCount.rpc++;
            rpcResponse = await fetchImpl(new URL("/rest/v1/rpc/episode_import_monitor_status", baseUrl), {
              method: "POST", headers: { apikey: anonKey, authorization: `Bearer ${session.access_token}`, "content-type": "application/json" },
              body: JSON.stringify({ p_podcast_ids: scope.map(item => item.candidate.podcast_key), p_activated_after: activatedAfter }),
              signal: AbortSignal.timeout(10000)
            });
          } catch {
            accessStatus = "api_error";
          }
          if (rpcResponse) {
            if (rpcResponse.status === 401 || rpcResponse.status === 403) accessStatus = "authorization_denied";
            else if (!rpcResponse.ok) accessStatus = "api_error";
            else {
              let statuses;
              try { statuses = await rpcResponse.json(); } catch { statuses = null; }
              const ids = new Set(scope.map(item => item.candidate.podcast_key));
              if (!Array.isArray(statuses) || statuses.length !== scope.length || statuses.some(row => !ids.has(row.podcast_key)) ||
                new Set(statuses.map(row => row.podcast_key)).size !== statuses.length) accessStatus = "api_error";
              else {
                accessStatus = "authorized";
                const statusesById = new Map(statuses.map(row => [row.podcast_key, row]));
                for (const item of scope) {
                  const episodeCount = await countActiveEpisodes({ baseUrl, anonKey, podcastKey: item.candidate.podcast_key, fetchImpl });
                  if (episodeCount.request_sent) apiRequestCount.episode_count++;
                  const status = statusesById.get(item.candidate.podcast_key);
                  const afterActivation = status.latest_run_started_at && Date.parse(status.latest_run_started_at) >= Date.parse(item.activated_at);
                  checkedRows.push({ ...status,
                    podcast_key: item.candidate.podcast_key,
                    activated_at: item.activated_at,
                    imported_after_activation: Boolean(afterActivation),
                    run_count: afterActivation ? status.run_count : 0,
                    active_episode_count: episodeCount.status === "counted" ? episodeCount.count : null,
                    status: episodeCount.status === "counted" ? "counted" : episodeCount.status,
                    import_status_received: true
                  });
                }
              }
            }
          }
        }
      }
    }
  } else if (scope.length && (!baseUrl || !anonKey || !projectRef || !email || !password)) {
    accessStatus = "authorization_missing";
  } else if (scope.length && !allowedUrl) {
    accessStatus = "project_identity_mismatch";
  } else if (scope.length) {
    accessStatus = "api_error";
  }

  const alarmResult = applyImportStatusAlarms({ observations: checkedRows, previousAlarms: priorAlarms,
    previousRecoveries: priorRecoveries, now: timestamp, workflowUrl });
  const priorAccessStatus = monitorState.import_access_status || null;
  const effectiveAccessStatus = accessStatus === "not_needed" ? (priorAccessStatus || "not_needed") : accessStatus;
  const statusChanged = scope.length > 0 && priorAccessStatus !== effectiveAccessStatus;
  return {
    generated_at: timestamp,
    access_status: effectiveAccessStatus,
    candidate_count: candidates.size,
    checked_count: checkedRows.length,
    omitted_ids: omitted,
    max_ids_per_query: IMPORT_STATUS_BATCH_LIMIT,
    max_supabase_requests: scope.length ? 2 + scope.length : 0,
    supabase_request_count: apiRequestCount.auth + apiRequestCount.rpc + apiRequestCount.episode_count,
    request_breakdown: apiRequestCount,
    observations: checkedRows,
    alarms: alarmResult.alarms,
    recoveries: alarmResult.recoveries,
    recovered_now: alarmResult.recovered_now,
    state_changed: alarmResult.changed || statusChanged,
    unchanged: !alarmResult.changed && !statusChanged,
    workflow_url: workflowUrl
  };
}

export function renderImportStatusSection(report) {
  const esc = value => String(value || "").replace(/@/gu, "＠").replace(/[<>]/gu, "");
  const alarms = (report.alarms || []).map(alarm =>
    `- \`${esc(alarm.podcast_key)}\` — **${esc(alarm.problem_type)}**; sidste succes=${esc(alarm.last_success_at || "ukendt")}; sidste fejl=${esc(alarm.last_failure_at || "ukendt")}; seneste status=${esc(alarm.latest_run_status || "ingen kørsel")}; [workflow](${esc(alarm.workflow_url || report.workflow_url || "")})`);
  const recoveries = (report.recovered_now || []).map(entry =>
    `- \`${esc(entry.podcast_key)}\` — **recovery: ${esc(entry.problem_type)}**; succes=${esc(entry.last_success_at || "ukendt")}; [workflow](${esc(entry.workflow_url || report.workflow_url || "")})`);
  const omitted = report.omitted_ids?.length ? `\n\nKøbegrænsning: ${report.omitted_ids.length} ID'er afventer næste daglige kontrol (maks. ${report.max_ids_per_query}).` : "";
  return `<!-- episode-import-status-begin -->\n## Beskyttet importstatus\n\nAdgang=${esc(report.access_status)}; kontrollerede ID'er=${report.checked_count}/${report.candidate_count}; forespørgsler=${report.supabase_request_count}/${report.max_supabase_requests}; fejlede importer kræver 2 på hinanden følgende fejl. Teaser-only og Edge-deploystatus=ukendt.\n\n${alarms.length ? alarms.join("\n") : "Ingen åbne importstatusalarmer."}${recoveries.length ? `\n\n### Recovery\n${recoveries.join("\n")}` : ""}${omitted}\n<!-- episode-import-status-end -->`;
}

async function main() {
  const args = process.argv.slice(2);
  const valueAfter = flag => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : ""; };
  const report = await readJson(valueAfter("--feed-report"), {});
  const state = await readJson(valueAfter("--state-file"), {});
  const outputPath = valueAfter("--output");
  const result = await monitorEpisodeImportStatus({ feedReport: report, monitorState: state,
    workflowUrl: process.env.GITHUB_RUN_URL || "" });
  result.issue_section = renderImportStatusSection(result);
  if (outputPath) await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", "utf8");
  else process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
}
