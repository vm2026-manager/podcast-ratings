// Read-only DR umbrella-feed monitor. Never creates or rewrites podcast/episode rows.
import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseFeed, mapEpisodes, routeEpisodes } from "../supabase/functions/import-podcast-episodes/core.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { DJAEVLEN_FEED_KEY } from "../supabase/functions/import-podcast-episodes/djaevlen-routing.mjs";
import { BAKSPEJL_FEED_KEY } from "../supabase/functions/import-podcast-episodes/bakspejl-routing.mjs";

const FEED_NAMES = {
  [DJAEVLEN_FEED_KEY]: "Djævlen i detaljen",
  [BAKSPEJL_FEED_KEY]: "Bakspejl"
};
const ISSUE_MARKER = "<!-- dr-umbrella-series-monitor-v1 -->";
const DEFAULT_CATALOGUE_URL = "https://podcastlisten.dk/podcasts.json";
const MAX_ISSUE_CANDIDATES = 30;

function isoDate(value) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

export function detectRecentUmbrellaRoutingGaps({ feedKey, feedXml, config, now, windowDays = 30 }) {
  if (!config || !Array.isArray(config.routes)) {
    throw new Error("Missing umbrella feed configuration: " + feedKey);
  }
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs) || !Number.isFinite(windowDays) || windowDays <= 0) {
    throw new Error("Invalid monitor timestamp or window");
  }
  const mapped = mapEpisodes(parseFeed(feedXml), config, now);
  const routed = routeEpisodes(mapped.episodes, config);
  const byGuid = new Map(mapped.episodes.map((episode) => [episode.external_guid, episode]));
  const thresholdMs = nowMs - windowDays * 86400000;
  const issues = [...(routed.report?.unmatched || []), ...(routed.report?.ambiguous || [])];
  const candidates = issues.flatMap((issue) => {
    const episode = byGuid.get(issue.external_guid);
    const publishedMs = Date.parse(episode?.published_at || "");
    if (!episode || !Number.isFinite(publishedMs) || publishedMs < thresholdMs || publishedMs > nowMs + 86400000) return [];
    const isTeaser = episode.is_active === false || episode.metadata?.exclusion_reason === "teaser_or_trailer";
    return [{
      title: episode.title,
      guid: episode.external_guid,
      published_at: isoDate(episode.published_at),
      teaser_only: Boolean(isTeaser),
      reason: (routed.report?.ambiguous || []).some((item) => item.external_guid === issue.external_guid) ? "ambiguous" : "unmatched",
      route_candidates: issue.route_keys || []
    }];
  });
  return {
    feed_key: feedKey,
    feed_name: FEED_NAMES[feedKey] || feedKey,
    enabled: config.enabled !== false,
    configured_routes: config.routes.length,
    fetched: mapped.fetched_count,
    unmatched_total: routed.report?.unmatched.length || 0,
    ambiguous_total: routed.report?.ambiguous.length || 0,
    candidates,
    configuration_problem: config.enabled === false || config.routes.length === 0
  };
}

export function formatReviewIssue(results, checkedAt) {
  const candidateCount = results.reduce((n, group) => n + group.candidates.length, 0);
  const failures = results.filter((group) => group.configuration_problem);
  const sections = results.filter((group) => group.candidates.length || group.configuration_problem).map((group) => {
    const list = group.candidates.slice(0, MAX_ISSUE_CANDIDATES).map((entry) => {
      const safeTitle = entry.title.replace(/[\r\n|]/g, " ").slice(0, 160);
      return `- **${safeTitle}** — ${entry.published_at.slice(0, 10)} (GUID \`${entry.guid}\`, ${entry.teaser_only ? "kun teaser i RSS" : "episode i RSS"}, ${entry.reason})`;
    });
    if (group.configuration_problem) list.unshift("- **Ingen aktiv sikker serierouting**: tjek podcastkatalogets Hovedserie og Podcast-ID.");
    return `### ${group.feed_name}\n${list.join("\n")}`;
  });
  return `${ISSUE_MARKER}
## Nye DR-afsnit, der ikke kan placeres sikkert

Automatisk kontrol to gange i døgnet. **${candidateCount}** nye uafklarede episoder; **${failures.length}** manglende/disabled route-konfigurationer.

${sections.join("\n\n")}

**Handling:** Undersøg hver titel i DR Lyd. Registrér den korrekte podcast/underserie i kataloget (Titel, Hovedserie og Podcast-ID), hvis den skal indgå på Podcastlisten, og verificér fuld episode frem for RSS-teaseren. Næste import matcher automatisk, når der findes en entydig katalogrute.

**Sikkerhed:** Opret aldrig en podcast automatisk ud fra et gættet titelfragment. Indlæs ikke teasere som vurderbare episoder. Eksisterende episode-ID'er, vurderinger og podcasttilknytninger må ikke overskrives.

Denne sag vedligeholdes automatisk; eksisterende åbne issues genbruges uden dubletter. Monitoren foretager ingen skrivninger til Supabase.
`;
}

async function fetchJson(url, fetchFn) {
  const response = await fetchFn(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Catalogue fetch failed: ${response.status}`);
  return response.json();
}

async function fetchXml(url, fetchFn) {
  const response = await fetchFn(url, { headers: { accept: "application/rss+xml, application/xml" } });
  if (!response.ok) throw new Error(`DR feed fetch failed: ${response.status}`);
  return response.text();
}

export async function checkUmbrellaFeeds({ fetchFn = fetch, catalogueUrl = DEFAULT_CATALOGUE_URL, now = new Date().toISOString() } = {}) {
  const payload = await fetchJson(catalogueUrl, fetchFn);
  const rows = Array.isArray(payload) ? payload : payload?.rows;
  if (!Array.isArray(rows) || rows.length === 0) throw new Error("Empty or invalid podcast catalogue; refusing to declare success");
  const configs = mergeSheetFeedConfigs({ rows }).configs;
  const results = [];
  for (const feedKey of [DJAEVLEN_FEED_KEY, BAKSPEJL_FEED_KEY]) {
    const config = configs[feedKey];
    const xml = await fetchXml(config.feed_url, fetchFn);
    results.push(detectRecentUmbrellaRoutingGaps({ feedKey, feedXml: xml, config, now }));
  }
  return results;
}

async function githubRequest(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN for issue publication");
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      ...options.headers
    }
  });
  if (!response.ok) throw new Error(`GitHub issue request failed: ${response.status}`);
  return response.json();
}

export async function publishReviewIssue(results, checkedAt) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo || !/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error("Missing valid GITHUB_REPOSITORY");
  const issues = await githubRequest(`/repos/${repo}/issues?state=open&per_page=100`);
  const existing = issues.find((issue) => !issue.pull_request && issue.body?.includes(ISSUE_MARKER));
  const needsAttention = results.some((group) => group.candidates.length || group.configuration_problem);
  if (!needsAttention) {
    console.log("No new DR umbrella routing gaps; existing issues are not auto-closed.");
    return;
  }
  const body = formatReviewIssue(results, checkedAt);
  if (existing) {
    if (existing.body !== body) await githubRequest(`/repos/${repo}/issues/${existing.number}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ body })
    });
    console.log(`Updated existing review issue #${existing.number}`);
  } else {
    const created = await githubRequest(`/repos/${repo}/issues`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Nye DR-episoder mangler serietilknytning", body })
    });
    console.log(`Created DR routing issue #${created.number}`);
  }
}

async function main() {
  const checkedAt = new Date().toISOString();
  const results = await checkUmbrellaFeeds({ now: checkedAt });
  console.log(JSON.stringify({ checked_at: checkedAt, results }, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `DR-seriekontrol: ${results.reduce((n, x) => n + x.candidates.length, 0)} nye uafklarede afsnit.\n`);
  }
  if (process.argv.includes("--github-issue")) await publishReviewIssue(results, checkedAt);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
