import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { FRIHEDSBREVET_EDITORIAL_MASTER_SNAPSHOT } from "./fixtures/frihedsbrevet-editorial-master-snapshot.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const APPLE_LOOKUP_URL = "https://itunes.apple.com/lookup";
const APPLE_HOST = "itunes.apple.com";
const OMNY_HOST = "www.omnycontent.com";
const MAX_RESPONSE_BYTES = 2_000_000;
const REQUEST_TIMEOUT_MS = 10_000;
const LIVE_CONCURRENCY = 3;
const JWT_LIKE_VALUE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u;

// This registry is a read-only snapshot of the live editorial master and exact
// Apple/Omny identities. IDs are the only catalogue join key; titles are checked
// only after an exact ID match and are never used to infer identity.
export const FRIHEDSBREVET_SOURCE_REGISTRY = Object.freeze([
  { podcastId: "den forunderlige dr kavousi", title: "Den forunderlige Dr. Kavousi", catalogueId: "catalogue-v1-b64ed657", access: "partial", appleId: "1698924021", appleTitle: "Den forunderlige Dr. Kavousi", artist: "Frihedsbrevet", expectedEpisodes: 4, expectedFeedItems: 1 },
  { podcastId: "marathonmanden", title: "Marathonmanden", catalogueId: "catalogue-v1-ad874d00", access: "partial", appleId: "1631985895", appleTitle: "Marathonmanden", artist: "Frihedsbrevet", expectedEpisodes: 5, expectedFeedItems: 3 },
  { podcastId: "huset færch sæson 1", title: "Huset færch (sæson 1)", catalogueId: "catalogue-v1-c941be17", access: "partial", appleId: "1700144386", appleTitle: "Huset Færch", artist: "Frihedsbrevet", expectedEpisodes: 8, expectedFeedItems: 13, sharedIdentity: "huset-faerch-seasons" },
  { podcastId: "doctor no", title: "Doctor No", catalogueId: "catalogue-v1-f9661a9a", access: "partial", appleId: "1677373013", appleTitle: "Doctor No", artist: "Frihedsbrevet", expectedEpisodes: 5, expectedFeedItems: 2 },
  { podcastId: "den talentfulde fru hjorth", title: "Den talentfulde Fru Hjorth", catalogueId: "catalogue-v1-607984c7", access: "paid", appleId: "1640261535", appleTitle: "Den talentfulde fru Hjorth", artist: "Frihedsbrevet", expectedEpisodes: 6, expectedFeedItems: 3 },
  { podcastId: "fri mads", title: "Fri Mads", catalogueId: "catalogue-v1-d94fc39e", access: "partial", kind: "article", approvedLink: "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/", previousSource: "https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/" },
  { podcastId: "det falske match", title: "Det falske match", catalogueId: "catalogue-v1-d8fb8620", access: "partial", appleId: "1631357575", appleTitle: "Det falske match", artist: "Frihedsbrevet", expectedEpisodes: 3, expectedFeedItems: 2 },
  { podcastId: "kvindefængslet", title: "Kvindefængslet", catalogueId: "catalogue-v1-6a814826", access: "partial", appleId: "1661006786", appleTitle: "Kvindefængslet", artist: "Frihedsbrevet", expectedEpisodes: 3, expectedFeedItems: 1 },
  { podcastId: "i krig med pet", title: "I krig med PET", catalogueId: "catalogue-v1-afc45bd0", access: "partial", appleId: "1893643527", appleTitle: "I krig med PET", artist: "Frihedsbrevet", expectedEpisodes: 3, expectedFeedItems: 0, sourceStatus: "candidate", candidateFeedUrl: "https://www.omnycontent.com/d/playlist/88c335ba-6520-4de0-97b0-ad3a00d192cf/f693fdef-2156-4716-a8ed-b42b0144e3d2/5561dae3-bd50-47cd-9cdc-b42b0149f525/podcast.rss", note: "Apple lists three trailers; the Omny candidate returned an empty RSS channel." },
  { podcastId: "ulven fra aalborg", title: "Ulven fra Aalborg", catalogueId: "catalogue-v1-3a5840ac", access: "partial", appleId: "1633949019", appleTitle: "Ulven fra Aalborg", artist: "Frihedsbrevet", expectedEpisodes: 4, expectedFeedItems: 1 },
  { podcastId: "en jihadist bliver til", title: "En jihadist bliver til", catalogueId: "catalogue-v1-ce184702", access: "partial", appleId: "1654145867", appleTitle: "En jihadist bliver til", artist: "Frihedsbrevet", expectedEpisodes: 4, expectedFeedItems: 2 },
  { podcastId: "kvinden som ikke ville kaldes bedrager", title: "Kvinden som ikke ville kaldes bedrager", catalogueId: "catalogue-v1-d7880428", access: "partial", appleId: "1697762256", appleTitle: "Kvinden som ikke ville kaldes bedrager", artist: "Frihedsbrevet", expectedEpisodes: 4, expectedFeedItems: 1 },
  { podcastId: "broder salsa", title: "Broder Salsa", catalogueId: "catalogue-v1-289b7a81", access: "partial", appleId: "1755573170", appleTitle: "Broder Salsa", artist: "Frihedsbrevet", expectedEpisodes: 2, expectedFeedItems: 2 },
  { podcastId: "huset færch sæson 2", title: "Huset færch (sæson 2)", catalogueId: "catalogue-v1-980e0f5a", access: "partial", appleId: "1700144386", appleTitle: "Huset Færch", artist: "Frihedsbrevet", expectedEpisodes: 12, expectedFeedItems: 13, sharedIdentity: "huset-faerch-seasons" },
  { podcastId: "i krig med ha", title: "I krig med HA", catalogueId: "catalogue-v1-8ab0fd8c", access: "partial", appleId: "1858502218", appleTitle: "I krig med HA", artist: "Frihedsbrevet", expectedEpisodes: 4, expectedFeedItems: 4 },
  { podcastId: "frihedsbrevets intranet", title: "Frihedsbrevets Intranet", catalogueId: "catalogue-v1-48f9ea9f", access: "partial", kind: "unresolved", note: "The general Frihedsbrevet Apple show is not an exact series identity." },
  { podcastId: "vi ejer byen", title: "Vi ejer byen", catalogueId: "catalogue-v1-6126147d", access: "partial", appleId: "6795461563", appleTitle: "Vi ejer byen", artist: "Frihedsbrevet", expectedEpisodes: 1, expectedFeedItems: 1 },
  { podcastId: "sofies valg", title: "Sofies valg", catalogueId: "catalogue-v1-234f6f2f", access: "partial", appleId: "1734993515", appleTitle: "Sofies Valg", artist: "Frihedsbrevet", expectedEpisodes: "weekly", expectedFeedItems: 10 },
  { podcastId: "du ma hellere ringe til bagge", title: "Du må hellere ringe til Bagge", catalogueId: "catalogue-v1-6fcaa0c9", access: "partial", appleId: "6795463727", appleTitle: "Du må hellere ringe til Bagge", artist: "Frihedsbrevet", expectedEpisodes: 3, expectedFeedItems: 1, note: "Sheet Link is an episode in the general Frihedsbrevet show; this exact series has a separate Apple identity." },
  { podcastId: "gribbene i skoven", title: "Gribbene i Skoven", catalogueId: "catalogue-v1-02d333de", access: "partial", kind: "unresolved", note: "Publisher identifies it as a podcast, but no exact Apple/Omny/RSS identity was verified." },
  { podcastId: "eksterne affaerer r8dio frihedsbrevet", title: "Eksterne affærer", catalogueId: "catalogue-v1-6ede539f", access: "paid", appleId: "6818511364", appleTitle: "Eksterne Affærer", artist: "r8Dio", expectedEpisodes: null, expectedFeedItems: 1, note: "Sheet Feed contains Apple:6818511364; lookup resolves the exact Omny feed. Apple reports six items, RSS exposes one Pilot." },
  { podcastId: "friis diplomatpost", title: "Friis’ diplomatpost", catalogueId: "catalogue-v1-08361157", access: "partial", appleId: "1706073378", appleTitle: "Friis' diplomatpost", artist: "Frihedsbrevet", expectedEpisodes: "weekly", expectedFeedItems: 100, note: "The Sheet Omny URL is the general Frihedsbrevet feed; Apple resolves a separate exact Friis feed." },
  { podcastId: "prins henriks krig", title: "Prins Henriks Krig", catalogueId: "catalogue-v1-49be7dd1", access: "partial", appleId: "1786337788", appleTitle: "Prins Henriks Krig", artist: "Frihedsbrevet", expectedEpisodes: null, expectedFeedItems: 2 },
  { podcastId: "taskforce nord stream", title: "Taskforce Nord Stream", catalogueId: "catalogue-v1-0281b0b6", access: "partial", appleId: "1836717693", appleTitle: "Taskforce Nord Stream", artist: "Frihedsbrevet", expectedEpisodes: null, expectedFeedItems: 3 },
  { podcastId: "velfærdsbanderne", title: "Velfærdsbanderne", catalogueId: "catalogue-v1-ab05674a", access: "partial", appleId: "1891306405", appleTitle: "Velfærdsbanderne", artist: "Frihedsbrevet", expectedEpisodes: 6, expectedFeedItems: 1 },
  { podcastId: "noter fra bruxelles", title: "Noter fra Bruxelles", catalogueId: "catalogue-v1-3ee3aa1d", access: "partial", kind: "article", note: "Sheet Link points to article #1; publisher material treats the series as article/reportage content." },
  { podcastId: "jeppe bentzen oplevelsen", title: "Jeppe Bentzen Oplevelsen", catalogueId: "catalogue-v1-699dbefd", access: "partial", appleId: "1787396779", appleTitle: "Jeppe Bentzen Oplevelsen", artist: "Frihedsbrevet", expectedEpisodes: null, expectedFeedItems: 8 },
  { podcastId: "vloggen", title: "VLoggen", catalogueId: "catalogue-v1-54bc1cdd", access: "partial", kind: "unresolved", note: "No exact audio feed identity was verified; the catalogue link is a generic podcast index." },
  { podcastId: "fri ukraine", title: "Fri Ukraine", catalogueId: "catalogue-v1-8692061e", access: "partial", appleId: "1706330856", appleTitle: "Fri Ukraine", artist: "Frihedsbrevet", expectedEpisodes: "weekly", expectedFeedItems: 28 },
  { podcastId: "amira smajic bandene", title: "Amira Smajic Båndene", catalogueId: "catalogue-v1-215ccff8", access: "partial", appleId: "1819878121", appleTitle: "Amira Smajic Båndene", artist: "Frihedsbrevet", expectedEpisodes: 7, expectedFeedItems: 1 },
  { podcastId: "novoland", title: "NovoLand", catalogueId: "catalogue-v1-2784dfac", access: "partial", appleId: "1739448508", appleTitle: "NovoLand", artist: "Frihedsbrevet", expectedEpisodes: 6, expectedFeedItems: 6 },
  { podcastId: "korea papirerne", title: "Korea-papirerne", catalogueId: "catalogue-v1-88569338", access: "partial", appleId: "1719469003", appleTitle: "Korea-papirerne", artist: "Frihedsbrevet", expectedEpisodes: 5, expectedFeedItems: 1 },
  { podcastId: "fields 3 juli", title: "Fields 3. Juli", catalogueId: "catalogue-v1-572cdef1", access: "partial", appleId: "1651179573", appleTitle: "Fields 3. Juli", artist: "Frihedsbrevet", expectedEpisodes: 3, expectedFeedItems: 1 },
  { podcastId: "mærsks mørke hemmelighed", title: "Mærsks mørke hemmelighed", catalogueId: "catalogue-v1-0c78ba0f", access: "partial", appleId: "1642522245", appleTitle: "Mærsks mørke hemmelighed", artist: "Frihedsbrevet", expectedEpisodes: 6, expectedFeedItems: 2 },
  { podcastId: "dyrlægen fra auschwitz", title: "Dyrlægen fra Auschwitz", catalogueId: "catalogue-v1-099ed6f7", access: "partial", appleId: "6800488677", appleTitle: "Dyrlægen fra Auschwitz", artist: "Frihedsbrevet", expectedEpisodes: null, expectedFeedItems: 1 },
  { podcastId: "hashpladeforbandelsen", title: "Hashpladeforbandelsen", catalogueId: "catalogue-v1-3708cac4", access: "paid", kind: "unresolved", note: "No exact public Apple/Omny/RSS identity was verified; access is listed as paid." }
]);

function exactText(value) {
  return String(value ?? "").normalize("NFC").trim().toLocaleLowerCase("da-DK");
}

function safeObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}

function hasPotentialCredentialUrl(value) {
  const text = String(value ?? "");
  if (!text) return false;
  if (
    JWT_LIKE_VALUE.test(text) ||
    /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/iu.test(text) ||
    /(?:^|[?&\s])(?:token|access_token|auth_token|api_key|api-key|key|signature|sig)=([^&#\s]{1,})/iu.test(text)
  ) return true;
  let url;
  try { url = new URL(text); } catch { return false; }
  if (url.username || url.password) return true;
  for (const [key, parameter] of url.searchParams) {
    if (/(?:token|secret|signature|credential|api.?key|auth|^sig$)/iu.test(key) && parameter) return true;
  }
  return url.pathname.split("/").some((segment) => segment.length >= 96 && /^[A-Za-z0-9_-]+$/u.test(segment));
}

function safeReportUrl(value) {
  const url = String(value ?? "");
  return hasPotentialCredentialUrl(url) ? null : (url || null);
}

function safeErrorMessage(error) {
  return String(error?.message || error || "source request failed")
    .replace(JWT_LIKE_VALUE, "[credential withheld]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/giu, "Bearer [credential withheld]")
    .replace(/\b(token|access_token|auth_token|api_key|api-key|key|signature|sig)=([^\s&#]+)/giu, "$1=[credential withheld]")
    .replace(/https?:\/\/[^\s"'<>]+/giu, "[source URL withheld]")
    .slice(0, 240);
}

export function validateSourceRegistry(registry = FRIHEDSBREVET_SOURCE_REGISTRY) {
  if (!Array.isArray(registry) || registry.length === 0) throw new TypeError("Source registry must be a non-empty array");
  const ids = new Set();
  const catalogueIds = new Set();
  const appleGroups = new Map();
  for (const entry of registry) {
    safeObject(entry, "Source registry entry");
    if (!entry.podcastId || !entry.title || !entry.catalogueId) throw new Error("Every source entry requires exact podcastId, title, and catalogueId");
    if (ids.has(entry.podcastId)) throw new Error(`Duplicate Podcast-ID in source registry: ${entry.podcastId}`);
    if (catalogueIds.has(entry.catalogueId)) throw new Error(`Duplicate catalogue_id in source registry: ${entry.catalogueId}`);
    ids.add(entry.podcastId);
    catalogueIds.add(entry.catalogueId);
    if (entry.appleId) appleGroups.set(entry.appleId, [...(appleGroups.get(entry.appleId) || []), entry]);
    if (entry.candidateFeedUrl) assertAllowedOmnyUrl(entry.candidateFeedUrl);
  }
  for (const [appleId, entries] of appleGroups) {
    if (entries.length > 1 && (!entries.every((entry) => entry.sharedIdentity) || new Set(entries.map((entry) => entry.sharedIdentity)).size !== 1)) {
      throw new Error(`Apple identity ${appleId} is assigned to unrelated catalogue IDs`);
    }
  }
  return { entryCount: registry.length, podcastIds: ids, catalogueIds };
}

export function validateFeedAssignments(assignments = []) {
  if (!Array.isArray(assignments)) throw new TypeError("Feed assignments must be an array");
  const groups = new Map();
  for (const assignment of assignments) {
    safeObject(assignment, "Feed assignment");
    if (!assignment.feedUrl) continue;
    assertAllowedOmnyUrl(assignment.feedUrl);
    groups.set(assignment.feedUrl, [...(groups.get(assignment.feedUrl) || []), assignment]);
  }
  const duplicateFeeds = [];
  for (const [feedUrl, entries] of groups) {
    if (entries.length < 2) continue;
    const sameAppleIdentity = entries.every((entry) => entry.appleId && entry.appleId === entries[0].appleId);
    const sameSharedIdentity = entries.every((entry) => entry.sharedIdentity && entry.sharedIdentity === entries[0].sharedIdentity);
    if (!sameAppleIdentity && !sameSharedIdentity) duplicateFeeds.push({
      feedUrl: safeReportUrl(feedUrl),
      feedUrlWithheld: hasPotentialCredentialUrl(feedUrl),
      podcastIds: entries.map((entry) => entry.podcastId || null)
    });
  }
  return { valid: duplicateFeeds.length === 0, duplicateFeeds };
}

export function auditFrihedsbrevetCatalogue(payload, {
  registry = FRIHEDSBREVET_SOURCE_REGISTRY,
  editorialSnapshot = FRIHEDSBREVET_EDITORIAL_MASTER_SNAPSHOT
} = {}) {
  safeObject(payload, "Catalogue JSON");
  if (!Array.isArray(payload.rows)) throw new TypeError("Catalogue JSON must use the actual { rows: [...] } structure");
  validateSourceRegistry(registry);
  if (!Array.isArray(editorialSnapshot) || editorialSnapshot.length !== registry.length) throw new Error("Editorial master snapshot does not cover the source registry");
  const sheetById = new Map();
  for (const sheetRow of editorialSnapshot) {
    safeObject(sheetRow, "Editorial master row");
    if (!sheetRow.podcastId || sheetById.has(sheetRow.podcastId)) throw new Error("Editorial master Podcast-ID is missing or duplicated");
    for (const field of ["title", "publisher", "series", "link", "feed", "access", "source"]) {
      if (typeof sheetRow[field] !== "string") throw new Error(`Editorial master field ${field} must be a string`);
    }
    sheetById.set(sheetRow.podcastId, sheetRow);
  }

  const candidates = payload.rows.filter((row) => exactText(row?.Udgiver).includes("frihedsbrevet"));
  const byPodcastId = new Map();
  for (const row of candidates) {
    const id = String(row?.["Podcast-ID"] ?? "").trim();
    if (!id) continue;
    byPodcastId.set(id, [...(byPodcastId.get(id) || []), row]);
  }

  const records = registry.map((expected) => {
    const editorial = sheetById.get(expected.podcastId);
    if (!editorial) throw new Error(`Editorial master row missing exact Podcast-ID: ${expected.podcastId}`);
    const matches = byPodcastId.get(expected.podcastId) || [];
    const row = matches.length === 1 ? matches[0] : null;
    const duplicateIdentity = matches.length > 1;
    const titleMatches = Boolean(row && exactText(row.Titel) === exactText(expected.title));
    const catalogueIdMatches = Boolean(row && String(row.catalogue_id ?? "").trim() === expected.catalogueId);
    const publisherMatches = Boolean(row && exactText(row.Udgiver).includes("frihedsbrevet"));
    const identityStatus = duplicateIdentity ? "duplicate_catalogue_id" : !row ? "missing_catalogue_id" : titleMatches && catalogueIdMatches && publisherMatches ? "verified" : "identity_mismatch";
    const catalogFieldMismatches = [];
    if (!row || String(row.Titel ?? "") !== editorial.title) catalogFieldMismatches.push("Titel");
    if (!row || String(row.Udgiver ?? "") !== editorial.publisher) catalogFieldMismatches.push("Udgiver");
    if (!row || String(row.Link ?? "") !== editorial.link) catalogFieldMismatches.push("Link");
    if (!row || String(row.Feed ?? "") !== editorial.feed) catalogFieldMismatches.push("Feed");
    const sourceKind = expected.kind || "audio";
    const sourceStatus = identityStatus !== "verified" ? "fail_closed" : (expected.sourceStatus || (sourceKind === "article" ? "article" : expected.appleId ? "exact_source_recorded" : "unresolved"));
    const access = expected.access || "unknown";
    const sensitiveUrlsWithheld = [row?.Link, expected.approvedLink, editorial.source, editorial.link, editorial.feed, row?.Feed].some(hasPotentialCredentialUrl);
    return {
      podcastId: expected.podcastId,
      title: expected.title,
      catalogueId: expected.catalogueId,
      identityStatus,
      sourceKind,
      sourceStatus,
      appleId: expected.appleId || null,
      expectedFeedItems: Number.isInteger(expected.expectedFeedItems) ? expected.expectedFeedItems : null,
      expectedEpisodes: expected.expectedEpisodes ?? null,
      access,
      importAllowed: false,
      catalogueLink: safeReportUrl(row?.Link) || "",
      approvedLink: safeReportUrl(expected.approvedLink),
      sensitiveUrlsWithheld,
      linkMismatch: Boolean(row && expected.approvedLink && row.Link !== expected.approvedLink),
      catalogFieldMismatches,
      editorialMaster: { row: editorial.row, source: safeReportUrl(editorial.source), series: editorial.series, access: editorial.access, link: safeReportUrl(editorial.link), feed: safeReportUrl(editorial.feed), publisher: editorial.publisher },
      feed: safeReportUrl(row?.Feed) || "",
      sharedIdentity: expected.sharedIdentity || null,
      note: expected.note || null
    };
  });

  const unexpected = candidates
    .filter((row) => !registry.some((entry) => entry.podcastId === String(row?.["Podcast-ID"] ?? "").trim()))
    .map((row) => ({ podcastId: row?.["Podcast-ID"] || null, title: row?.Titel || null }));
  const idCounts = new Map(records.map((record) => [record.identityStatus, records.filter((item) => item.identityStatus === record.identityStatus).length]));
  return {
    dryRun: true,
    writesPerformed: false,
    supabaseCalls: 0,
    source: "data/podcasts.json rows + pinned read-only editorial/source snapshot",
    expectedRows: registry.length,
    editorialSnapshotRows: editorialSnapshot.length,
    catalogFieldMismatchCount: records.reduce((sum, record) => sum + record.catalogFieldMismatches.length, 0),
    matchedRows: records.filter((record) => record.identityStatus === "verified").length,
    identityStatusCounts: Object.fromEntries(idCounts),
    unexpectedRows: unexpected,
    records
  };
}

function decodeXml(value) {
  return String(value ?? "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>|&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos);/giu, (match, cdata, entity) => {
    if (cdata !== undefined) return cdata;
    if (entity[0] === "#") {
      const codePoint = entity[1].toLowerCase() === "x" ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return match;
      return String.fromCodePoint(codePoint);
    }
    return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[entity.toLowerCase()];
  }).trim();
}

function xmlTag(block, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = String(block).match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}\\s*>`, "i"));
  return decodeXml(match?.[1] || "");
}

export function classifyRssItem(item, { access = "unknown" } = {}) {
  const title = String(item?.title ?? "").trim();
  const type = String(item?.episodeType ?? "").trim().toLowerCase();
  const titleIsTeaser = /^(?:trailer|teaser)\b|\bteaser\s*$/iu.test(title);
  if (type === "trailer" || titleIsTeaser) return "trailer";
  if (access === "paid") return "paywalled";
  if (type === "full" && item?.hasAudioEnclosure && String(item?.guid ?? "").trim()) return "full_public_episode";
  return "unresolved";
}

function assertWellFormedXml(xml) {
  if (/<!DOCTYPE\b/i.test(xml) || /<!ENTITY\b/i.test(xml)) throw new Error("RSS XML declarations are not allowed");
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[A-Za-z_][\w:.-]*(?:\s+(?:[^<>"']|"[^"]*"|'[^']*')*)?\s*\/?>|[^<]+/g;
  const stack = [];
  let cursor = 0;
  let roots = 0;
  for (const match of xml.matchAll(tokens)) {
    if (match.index !== cursor) throw new Error("RSS XML contains invalid markup");
    cursor += match[0].length;
    const token = match[0];
    if (token.startsWith("<!--") || token.startsWith("<?")) continue;
    if (token.startsWith("<![CDATA[")) {
      if (!stack.length) throw new Error("RSS XML CDATA is outside the document root");
      continue;
    }
    if (!token.startsWith("<")) continue;
    const closing = /^<\//.test(token);
    const selfClosing = /\/\s*>$/.test(token);
    const name = token.match(/^<\/?([A-Za-z_][\w:.-]*)/)?.[1];
    if (!name) throw new Error("RSS XML contains an invalid tag");
    if (closing) {
      if (stack.pop() !== name) throw new Error("RSS XML tags are mismatched");
    } else {
      if (!stack.length) roots += 1;
      if (!selfClosing) stack.push(name);
    }
  }
  if (cursor !== xml.length || stack.length || roots !== 1) throw new Error("RSS XML is incomplete or malformed");
}

export function parseRssEvidence(xmlText, { expectedChannelTitle } = {}) {
  const xml = String(xmlText ?? "");
  if (!/^\s*<\?xml\b/i.test(xml) || !/<rss\b[^>]*>/i.test(xml) || !/<\/rss\s*>\s*$/i.test(xml)) {
    throw new Error("Feed is not a complete RSS XML document");
  }
  assertWellFormedXml(xml);
  const channelBlock = xml.match(/<channel(?:\s[^>]*)?>([\s\S]*?)<\/channel\s*>/i)?.[1];
  if (!channelBlock) throw new Error("RSS channel is missing or malformed");
  const channelTitle = xmlTag(channelBlock, "title");
  if (!channelTitle) throw new Error("RSS channel title is missing");
  const items = [];
  const openItems = [...channelBlock.matchAll(/<item(?:\s[^>]*)?>/gi)].length;
  const closeItems = [...channelBlock.matchAll(/<\/item\s*>/gi)].length;
  if (openItems !== closeItems) throw new Error("RSS item markup is malformed");
  for (const match of channelBlock.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item\s*>/gi)) {
    const block = match[1];
    const enclosures = [...block.matchAll(/<enclosure\b[^>]*>/gi)].map((match) => match[0]);
    const hasAudioEnclosure = enclosures.some((tag) => {
      const attributes = Object.fromEntries([...tag.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)]
        .map((attribute) => [attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? ""]));
      if (!/^audio\/[A-Za-z0-9.+-]+(?:\s*;|$)/iu.test(attributes.type || "")) return false;
      try {
        const enclosureUrl = new URL(attributes.url);
        return (enclosureUrl.protocol === "https:" || enclosureUrl.protocol === "http:") && !enclosureUrl.username && !enclosureUrl.password;
      } catch {
        return false;
      }
    });
    const item = {
      title: xmlTag(block, "title"),
      guid: xmlTag(block, "guid"),
      link: xmlTag(block, "link"),
      author: xmlTag(block, "dc:creator") || xmlTag(block, "author"),
      categories: [...block.matchAll(/<(?:[\w.-]+:)?category(?:\s[^>]*)?>([\s\S]*?)<\/(?:[\w.-]+:)?category\s*>/giu)]
        .map((category) => decodeXml(category[1]))
        .filter(Boolean),
      publishedAt: xmlTag(block, "pubDate"),
      episodeType: xmlTag(block, "itunes:episodeType"),
      hasEnclosure: enclosures.length > 0,
      hasAudioEnclosure
    };
    item.classification = classifyRssItem(item);
    items.push(item);
  }
  const channelMatches = !expectedChannelTitle || exactText(channelTitle) === exactText(expectedChannelTitle);
  return {
    channelTitle,
    expectedChannelTitle: expectedChannelTitle || null,
    channelMatches,
    itemCount: items.length,
    items,
    sampleGuid: items.find((item) => item.guid)?.guid || null
  };
}

export function summarizeFeedEvidence(evidence, { access = "unknown" } = {}) {
  const counts = { full_public_episode: 0, trailer: 0, paywalled: 0, unresolved: 0 };
  for (const item of evidence.items) counts[classifyRssItem(item, { access })] += 1;
  const guids = evidence.items.map((item) => item.guid).filter(Boolean);
  return {
    channelTitle: evidence.channelTitle,
    channelMatches: evidence.channelMatches,
    itemCount: evidence.itemCount,
    sampleGuid: evidence.sampleGuid,
    verifiedGuids: [...new Set(guids)],
    classifications: counts
  };
}

export function classifyFeedEvidence(evidence, { expectedChannelTitle } = {}) {
  if (!evidence) return "unavailable";
  if (expectedChannelTitle && exactText(evidence.channelTitle) !== exactText(expectedChannelTitle)) return "wrong_feed";
  if (evidence.error) return "unavailable";
  if (!evidence.itemCount) return "empty_feed";
  return "verified_feed";
}

function assertAllowedOmnyUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("Untrusted RSS source URL"); }
  if (url.protocol !== "https:" || url.hostname !== OMNY_HOST || !url.pathname.endsWith("/podcast.rss")) {
    throw new Error("Untrusted RSS source URL");
  }
  return url;
}

async function readLimitedBody(response, maxBytes = MAX_RESPONSE_BYTES) {
  const declared = Number(response.headers?.get?.("content-length") || 0);
  if (declared > maxBytes) throw new Error(`Source response exceeds ${maxBytes} bytes`);
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new Error(`Source response exceeds ${maxBytes} bytes`);
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Source response exceeds ${maxBytes} bytes`);
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

async function requestText(fetchImpl, url, { accept, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: { accept: accept || "application/rss+xml, application/xml, text/xml, application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: "error"
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return { response, text: await readLimitedBody(response) };
}

async function mapLimit(values, limit, callback) {
  const output = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      try { output[index] = await callback(values[index], index); }
      catch (error) { output[index] = { error: safeErrorMessage(error) }; }
    }
  }));
  return output;
}

export async function verifyFrihedsbrevetSources({ fetchImpl = fetch, registry = FRIHEDSBREVET_SOURCE_REGISTRY } = {}) {
  validateSourceRegistry(registry);
  const appleIds = [...new Set(registry.map((entry) => entry.appleId).filter(Boolean))];
  const lookup = new Map();
  let lookupStatus = "unavailable";
  if (appleIds.length) {
    try {
      const url = new URL(APPLE_LOOKUP_URL);
      url.hostname = APPLE_HOST;
      url.searchParams.set("id", appleIds.join(","));
      url.searchParams.set("country", "dk");
      const { text } = await requestText(fetchImpl, url.href, { accept: "application/json" });
      const payload = JSON.parse(text);
      if (!Array.isArray(payload.results)) throw new Error("Apple lookup response has no results array");
      for (const record of payload.results) lookup.set(String(record.collectionId), record);
      lookupStatus = "verified";
    } catch (error) {
      lookupStatus = `unavailable: ${safeErrorMessage(error)}`;
    }
  }

  const feedEntries = [];
  for (const entry of registry) {
    if (!entry.appleId) continue;
    const apple = lookup.get(entry.appleId);
    if (apple && (exactText(apple.collectionName) !== exactText(entry.appleTitle) || exactText(apple.artistName) !== exactText(entry.artist))) {
      feedEntries.push({ entry, apple, error: "exact_apple_identity_mismatch" });
      continue;
    }
    const feedUrl = apple?.feedUrl || entry.candidateFeedUrl || "";
    if (!feedUrl) {
      feedEntries.push({ entry, apple, error: lookup.has(entry.appleId) ? "apple_feed_missing" : "apple_identity_unavailable" });
      continue;
    }
    try { assertAllowedOmnyUrl(feedUrl); }
    catch (error) { feedEntries.push({ entry, apple, error: String(error.message) }); continue; }
    feedEntries.push({ entry, apple, feedUrl });
  }

  const uniqueFeeds = new Map();
  for (const item of feedEntries) {
    if (item.feedUrl) uniqueFeeds.set(item.feedUrl, item);
  }
  const fetched = await mapLimit([...uniqueFeeds.values()], LIVE_CONCURRENCY, async (item) => {
    const { text, response } = await requestText(fetchImpl, item.feedUrl);
    const evidence = parseRssEvidence(text, { expectedChannelTitle: item.entry.appleTitle });
    return { httpStatus: response.status, evidence };
  });
  const byFeed = new Map([...uniqueFeeds.keys()].map((url, index) => [url, fetched[index]]));

  return {
    dryRun: true,
    writesPerformed: false,
    supabaseCalls: 0,
    htmlRequests: 0,
    appleLookup: { status: lookupStatus, exactIdsRequested: appleIds.length, exactResults: lookup.size },
    maxConcurrentFeedRequests: LIVE_CONCURRENCY,
    maxResponseBytes: MAX_RESPONSE_BYTES,
    records: registry.map((entry) => {
      const apple = lookup.get(entry.appleId);
      const feedUrl = apple?.feedUrl || entry.candidateFeedUrl || "";
    const result = feedUrl ? byFeed.get(feedUrl) : null;
      const isAppleExact = Boolean(apple && exactText(apple.collectionName) === exactText(entry.appleTitle) && exactText(apple.artistName) === exactText(entry.artist));
      const liveError = feedEntries.find((item) => item.entry.podcastId === entry.podcastId)?.error || result?.error || null;
      const evidence = result?.evidence;
      const access = entry.access || "unknown";
      let status = entry.kind === "article" ? "article" : entry.kind === "unresolved" ? "unresolved" : "unavailable";
      if (entry.appleId && isAppleExact && evidence?.channelMatches && evidence.itemCount > 0) status = entry.sourceStatus === "candidate" ? "candidate_trailers" : "verified_feed";
      else if (entry.appleId && isAppleExact && evidence?.channelMatches && evidence.itemCount === 0) status = "empty_feed";
      else if (entry.appleId && !apple && entry.sourceStatus === "candidate" && evidence?.channelMatches) status = evidence.itemCount ? "candidate_feed" : "empty_candidate_feed";
      else if (entry.appleId && apple && !isAppleExact) status = "wrong_apple_identity";
      else if (evidence && !evidence.channelMatches) status = "wrong_feed";
      else if (liveError) status = "unavailable";
      return {
        podcastId: entry.podcastId,
        title: entry.title,
        appleId: entry.appleId || null,
        appleTitle: apple?.collectionName || entry.appleTitle || null,
        appleTrackCount: apple?.trackCount ?? null,
        appleIdentityVerified: isAppleExact,
        feedUrl: safeReportUrl(feedUrl),
        feedUrlWithheld: hasPotentialCredentialUrl(feedUrl),
        status,
        importAllowed: false,
        liveError,
        feed: evidence ? summarizeFeedEvidence(evidence, { access }) : null,
        expectedEpisodes: entry.expectedEpisodes ?? null,
        note: entry.note || null
      };
    })
  };
}

async function main() {
  const args = process.argv.slice(2);
  const live = args.includes("--live");
  const input = args.find((arg) => arg !== "--live");
  const catalogPath = input ? path.resolve(input) : path.join(ROOT, "data", "podcasts.json");
  const catalogue = JSON.parse(await readFile(catalogPath, "utf8"));
  const snapshot = auditFrihedsbrevetCatalogue(catalogue);
  const report = live ? { ...snapshot, liveSources: await verifyFrihedsbrevetSources() } : snapshot;
  console.log(JSON.stringify(report, null, 2));
  if (snapshot.matchedRows !== snapshot.expectedRows || snapshot.records.some((record) => record.identityStatus !== "verified")) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
