// Conservative full DR Lyd standalone discovery; additive registry only.
import { parseDrLydEpisodes, mapDrLydEpisodes, routeEpisodes } from "../supabase/functions/import-podcast-episodes/core.ts";
import { mergeSheetFeedConfigs } from "../supabase/functions/import-podcast-episodes/runtime-feed-config.ts";
import { normalizeDjaevlenIdentity, DJAEVLEN_COVER } from "./djaevlen-auto-discovery.mjs";
import { normalizeBakspejlIdentity, BAKSPEJL_COVER } from "./bakspejl-auto-discovery.mjs";

export const FULL_STANDALONE_DISCOVERY_BASELINE = "2026-10-15T00:00:00.000Z";

const SHOWS = {
  djaevlen: {
    feedKey: "djaevlen_lyd_full", parent: "Djævlen i detaljen",
    path: "/lyd/special-radio/djaevlen-i-detaljen/",
    idPrefix: "djaevlen-auto-v1", cover: DJAEVLEN_COVER,
    normalize: normalizeDjaevlenIdentity
  },
  bakspejl: {
    feedKey: "bakspejl_lyd_full", parent: "Bakspejl",
    path: "/lyd/special-radio/bakspejl/",
    idPrefix: "bakspejl-auto-v1", cover: BAKSPEJL_COVER,
    normalize: normalizeBakspejlIdentity
  }
};

function hash(value) {
  let h = 2166136261;
  for (const char of value) {
    h ^= char.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

function verifiedFullEpisode(episode, show, baselineMs, nowMs) {
  const title = String(episode.title || "").trim();
  const date = Date.parse(episode.published_at || "");
  if (!title || title.length < 4 || title.length > 135 ||
      !Number.isFinite(date) || date <= baselineMs || date > nowMs ||
      !episode.is_active || !Number.isInteger(episode.duration_seconds) ||
      episode.duration_seconds < 600 || episode.duration_seconds > 10800 ||
      !/^\d+$/.test(String(episode.metadata?.dr_lyd_production_number || ""))) return false;
  // Numbered series remain handled by the existing, stricter series discovery.
  if (/\b\d+\s*:\s*\d+\b/u.test(title)) return false;
  if (/^(?:teaser|trailer|bonus|arkiv|hør flere afsnit|repris)\b/iu.test(title)) return false;
  let url;
  try { url = new URL(episode.episode_url); } catch { return false; }
  return url.protocol === "https:" && url.hostname === "www.dr.dk" &&
    url.pathname.startsWith(show.path) && !url.search && !url.hash;
}

export function discoverVerifiedFullStandalone({
  showKey, html, catalogueRows, registry, aliases = {},
  now = new Date().toISOString()
}) {
  const show = SHOWS[showKey];
  if (!show) throw new Error("Unknown DR umbrella show");
  const nowMs = Date.parse(now);
  const baselineMs = Date.parse(FULL_STANDALONE_DISCOVERY_BASELINE);
  if (!Number.isFinite(nowMs) || nowMs < baselineMs) throw new Error("Invalid discovery time");
  if (!Array.isArray(catalogueRows) || !catalogueRows.length || !registry ||
      !Array.isArray(registry.records)) throw new Error("Missing authoritative catalogue or registry");

  const existingRows = [...catalogueRows, ...registry.records.map((record) => ({
    Titel: record.title, "Podcast-ID": record.podcast_id, Hovedserie: record.hovedserie
  }))];
  const feed = mergeSheetFeedConfigs({ rows: existingRows }).configs[show.feedKey];
  if (!feed?.enabled || !feed?.routes?.length) throw new Error("No active DR umbrella catalogue routes");
  const mapped = mapDrLydEpisodes(parseDrLydEpisodes(html), feed, now);
  if (!mapped.episodes.length || mapped.errors.length) throw new Error("Incomplete DR Lyd source; no auto-discovery");
  const routes = routeEpisodes(mapped.episodes, feed);
  if (routes.report?.routing_conflict_count || routes.report?.ambiguous?.length) {
    throw new Error("Ambiguous existing DR routes; no auto-discovery");
  }

  const unmatched = new Set((routes.report?.unmatched || []).map((item) => item.external_guid));
  const normalize = show.normalize;
  const titleCounts = new Map();
  const numberedParents = new Set();
  for (const episode of mapped.episodes) {
    const key = normalize(episode.title);
    titleCounts.set(key, (titleCounts.get(key) || 0) + 1);
    const numbered = episode.title.match(/^(.+?)\s+\d+\s*:\s*\d+\b/iu);
    if (numbered) numberedParents.add(normalize(numbered[1]));
  }
  const titles = new Map();
  const ids = new Set();
  for (const row of existingRows) {
    const key = normalize(row.Titel);
    if (key) titles.set(key, [...(titles.get(key) || []), row]);
    const id = String(row["Podcast-ID"] || "").trim();
    if (id) ids.add(id);
  }
  const protectedAliases = new Set(Object.entries(aliases).flatMap(([key, value]) =>
    [normalize(key), normalize(value)]).filter(Boolean));
  const processed = new Set(registry.processed_full_guids || []);
  const next = structuredClone(registry);
  const report = { created: [], collisions: [], unsafe: [], already_registered: [], eligible_checked: 0 };
  for (const episode of mapped.episodes) {
    if (!unmatched.has(episode.external_guid) ||
        !verifiedFullEpisode(episode, show, baselineMs, nowMs) ||
        processed.has(episode.external_guid)) continue;
    report.eligible_checked++;
    const key = normalize(episode.title);
    const matches = titles.get(key) || [];
    if (!key || titleCounts.get(key) !== 1 || numberedParents.has(key) || protectedAliases.has(key)) {
      report.unsafe.push({ title: episode.title, guid: episode.external_guid, reason: "non-unique, related numbered season or protected alias" });
      continue;
    }
    if (matches.length) {
      if (matches.some((row) => normalize(row.Hovedserie) !== normalize(show.parent)) ||
          new Set(matches.map((row) => row["Podcast-ID"])).size > 1) {
        report.collisions.push({ title: episode.title, guid: episode.external_guid, reason: "cross-catalogue title collision" });
      } else {
        report.already_registered.push({ title: episode.title, guid: episode.external_guid });
      }
      continue;
    }
    const podcastId = show.idPrefix + "-" + hash(key);
    if (ids.has(podcastId)) {
      report.collisions.push({ title: episode.title, guid: episode.external_guid, reason: "permanent Podcast-ID collision" });
      continue;
    }
    const record = {
      discovery_key: key, podcast_id: podcastId, title: episode.title,
      hovedserie: show.parent, publisher: "DR", cover: show.cover,
      description: episode.title + " er et afsnit af DR-podcasten " + show.parent + "."
    };
    next.records.push(record);
    next.processed_full_guids ||= [];
    next.processed_full_guids.push(episode.external_guid);
    ids.add(podcastId);
    titles.set(key, [{ Titel: record.title, "Podcast-ID": podcastId, Hovedserie: show.parent }]);
    processed.add(episode.external_guid);
    report.created.push({ ...record, episode_guid: episode.external_guid, episode_url: episode.episode_url });
  }
  return { registry: next, report, fetched: mapped.fetched_count };
}
