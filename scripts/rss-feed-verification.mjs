import { lookup } from "node:dns/promises";
import https from "node:https";
import net from "node:net";

export const RSS_VERIFICATION_VERSION = 1;
export const RSS_VERIFICATION_BODY_LIMIT = 512 * 1024;
export const RSS_VERIFICATION_TIMEOUT_MS = 7000;
export const RSS_VERIFICATION_MAX_ITEMS = 500;

const normalize = value => String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("da-DK");
const tag = (block, name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = block.match(new RegExp(`<(?:[\\w.-]+:)?${escaped}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${escaped}\\s*>`, "iu"));
  return match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gu, "$1").replace(/<[^>]*>/gu, "").replace(/&amp;/gu, "&").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").trim() || "";
};
const attr = (block, name) => {
  const match = block.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "iu"));
  return match?.[2]?.replace(/&amp;/gu, "&").trim() || "";
};

function blockedAddress(address) {
  if (net.isIP(address) === 4) {
    const octets = address.split(".").map(Number);
    const [a, b] = octets;
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 0 || b === 168)) ||
      (a === 198 && (b === 18 || b === 19));
  }
  if (net.isIP(address) === 6) {
    const lower = address.toLowerCase();
    // Only globally routable unicast (2000::/3); also rejects mapped, local,
    // link-local, multicast, unspecified and transition/reserved ranges.
    const parts = lower.split(":");
    const first = parseInt(parts[0] || "0", 16);
    const second = parseInt(parts[1] || "0", 16);
    return !(first >= 0x2000 && first <= 0x3fff) || lower.startsWith("2001:db8:") ||
      (first === 0x2001 && second <= 0x01ff) || first === 0x2002;
  }
  return true;
}

export async function fetchPublicHttpsText(rawUrl, { timeoutMs = RSS_VERIFICATION_TIMEOUT_MS, maxBytes = RSS_VERIFICATION_BODY_LIMIT } = {}) {
  let url;
  try { url = new URL(rawUrl); } catch { throw new Error("invalid_url"); }
  const hostLiteral = url.hostname.replace(/^\[|\]$/gu, "");
  if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port && url.port !== "443" || net.isIP(hostLiteral)) {
    throw new Error("unsafe_url");
  }
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("private_network_url");
  let addresses;
  let dnsTimer;
  try {
    addresses = await Promise.race([
      lookup(host, { all: true, verbatim: true }),
      new Promise((_, reject) => { dnsTimer = setTimeout(() => reject(new Error("dns_lookup_failed")), 3000); })
    ]);
  } catch { throw new Error("dns_lookup_failed"); }
  finally { clearTimeout(dnsTimer); }
  if (!addresses.length || addresses.some(({ address }) => blockedAddress(address))) throw new Error("private_network_url");
  const address = addresses[0];
  return await new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: "GET", headers: { accept: "application/rss+xml, application/xml, text/xml, text/html;q=0.8", "user-agent": "Podcastlisten-RSS-identity-check/1" },
      timeout: timeoutMs, servername: host,
      lookup: (_hostname, options, callback) => {
        if (options && typeof options === "object" && options.all) callback(null, addresses);
        else callback(null, address.address, address.family);
      }
    }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400) { response.resume(); reject(new Error("redirect_not_allowed")); return; }
      if (response.statusCode !== 200) { response.resume(); reject(new Error(`http_status_${response.statusCode}`)); return; }
      const chunks = []; let bytes = 0;
      response.on("data", chunk => {
        bytes += chunk.length;
        if (bytes > maxBytes) { request.destroy(new Error("response_too_large")); return; }
        chunks.push(chunk);
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", reject);
    });
    request.on("timeout", () => request.destroy(new Error("request_timeout")));
    request.on("error", reject);
    request.end();
  });
}

export function parseRssIdentity(xml, { allowTrailers = false } = {}) {
  const channel = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel\s*>/iu)?.[1];
  if (!channel) throw new Error("invalid_rss_channel");
  const textLinks = channel.replace(/<(?:[\w.-]+:)?link\b[^>]*\/>/giu, "");
  const selfTag = [...channel.matchAll(/<(?:[\w.-]+:)?link\b[^>]*>/giu)].map(match => match[0])
    .find(value => /\brel\s*=\s*(["'])self\1/iu.test(value));
  const items = [...channel.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item\s*>/giu)].map(match => match[1]);
  if (!items.length || items.length > RSS_VERIFICATION_MAX_ITEMS) throw new Error(items.length ? "too_many_items" : "no_episodes");
  const guids = items.map(item => tag(item, "guid"));
  if (guids.some(guid => !guid) || new Set(guids).size !== guids.length) throw new Error("missing_or_duplicate_guid");
  const episodes = items.map(item => {
    const enclosure = item.match(/<(?:[\w.-]+:)?enclosure\b[^>]*>/iu)?.[0] || "";
    const title = tag(item, "title");
    const description = tag(item, "description");
    const durationRaw = tag(item, "duration");
    const durationParts = durationRaw.split(":").map(Number);
    const duration = durationParts.every(Number.isFinite)
      ? durationParts.reduce((total, part) => total * 60 + part, 0) : Number.NaN;
    const episodeType = tag(item, "episodeType").toLowerCase();
    const trailer = episodeType === "trailer" || /\b(teaser|trailer|preview|trailer episode)\b/iu.test(`${title} ${description}`);
    const audioUrl = attr(enclosure, "url");
    const audioType = attr(enclosure, "type").toLowerCase();
    const publishedAt = Date.parse(tag(item, "pubDate"));
    if (!audioUrl || !(audioType.startsWith("audio/") || /\.(mp3|m4a|aac|ogg|opus|wav)(?:$|\?)/iu.test(audioUrl)) ||
        !Number.isFinite(duration) || duration <= 0 || (!trailer && duration < 60) || !Number.isFinite(publishedAt)) {
      throw new Error("incomplete_or_non_audio_item_present");
    }
    return { guid: tag(item, "guid"), title, episodeType, trailer, duration, publishedAt };
  });
  if (!allowTrailers && episodes.some(episode => episode.trailer)) throw new Error("teaser_or_trailer_present");
  if (!episodes.some(episode => !episode.trailer)) throw new Error("no_full_episodes_present");
  if (episodes.some(episode => episode.trailer) && episodes.some(episode => !episode.trailer && episode.duration < 60)) {
    throw new Error("incomplete_or_non_audio_item_present");
  }
  const ownerBlock = channel.match(/<(?:[\w.-]+:)?owner\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?owner\s*>/iu)?.[1] || "";
  const title = tag(channel, "title");
  const link = tag(textLinks, "link");
  const owner = tag(ownerBlock, "name") || tag(channel, "copyright") || tag(channel, "author");
  return { title, link, owner, selfUrl: selfTag ? attr(selfTag, "href") : "", guidCount: guids.length, episodes };
}

function decodeHtml(value) {
  return String(value ?? "").replace(/&amp;/giu, "&").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"').replace(/&#39;/giu, "'").trim();
}

function authorNames(value) {
  return String(value ?? "").split(/\s*(?:,|&|\band\b)\s*/iu).map(name => normalize(name))
    .filter(Boolean).sort();
}

function exactAuthorSet(left, right) {
  const a = authorNames(left); const b = authorNames(right);
  return a.length > 0 && a.length === b.length && a.every((name, index) => name === b[index]);
}

function podimoPageIdentity(html, row, showId) {
  const officialUrl = String(row?.Link ?? "").trim();
  const canonical = [...html.matchAll(/<link\b[^>]*>/giu)].map(match => match[0])
    .filter(value => /\brel\s*=\s*(["'])canonical\1/iu.test(value)).map(value => attr(value, "href")).find(Boolean);
  const pageTitle = decodeHtml(html.match(/<title>([\s\S]*?)<\/title>/iu)?.[1] ?? "");
  let idPosition = html.indexOf(`"id":"${showId}"`);
  if (idPosition < 0) idPosition = html.indexOf(`\\"id\\":\\"${showId}\\"`);
  if (idPosition < 0) throw new Error("podimo_show_id_not_on_canonical_page");
  const context = html.slice(idPosition, idPosition + 1800).replace(/\\"/gu, '"');
  const field = name => {
    const match = context.match(new RegExp(`"${name}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "u"));
    if (!match) return "";
    try { return JSON.parse(`"${match[1]}"`); } catch { return ""; }
  };
  const embeddedTitle = field("title");
  const embeddedAuthors = field("authorName");
  if (new URL(canonical || "https://invalid.example").href !== new URL(officialUrl).href ||
      normalize(pageTitle) !== normalize(row?.Titel) || normalize(embeddedTitle) !== normalize(row?.Titel) ||
      !exactAuthorSet(embeddedAuthors, row?.Vært)) throw new Error("podimo_canonical_show_identity_mismatch");
  return { canonicalUrl: canonical, title: embeddedTitle, authors: embeddedAuthors };
}

export function findExactApplePodcastMapping(payload, row) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const matches = results.filter(result => result?.wrapperType === "track" && result?.kind === "podcast" &&
    String(result.trackName ?? result.collectionName ?? "") === String(row?.Titel ?? "") &&
    String(result.collectionName ?? "") === String(row?.Titel ?? "") && exactAuthorSet(result.artistName, row?.Vært) &&
    Number.isSafeInteger(Number(result.collectionId)) && Number(result.collectionId) > 0 &&
    String(result.trackId ?? result.collectionId) === String(result.collectionId) &&
    typeof result.feedUrl === "string" && typeof result.collectionViewUrl === "string");
  if (matches.length !== 1) throw new Error(matches.length ? "apple_podcast_mapping_ambiguous" : "apple_exact_podcast_mapping_not_found");
  return matches[0];
}

export async function verifyPodimoPublicRssEvidence(row, feedXml, podimoHtml, appleSearchPayload, appleLookupPayload) {
  const catalogueFeed = String(row?.Feed ?? "").trim();
  const officialUrl = String(row?.Link ?? "").trim();
  const podcastId = String(row?.["Podcast-ID"] ?? row?.["Podcast ID"] ?? "").trim();
  const catalogueId = String(row?.catalogue_id ?? "").trim();
  const showMatch = catalogueFeed.match(/^https:\/\/open\.podimo\.com\/podcast\/([0-9a-f-]{36})$/iu);
  const result = { version: RSS_VERIFICATION_VERSION, status: "review_required", verification_kind: "apple_podimo_public_rss",
    podcast_id: podcastId, catalogue_id: catalogueId, catalogue_feed_url: catalogueFeed, official_url: officialUrl,
    publisher: String(row?.Udgiver ?? "").trim(), reason: "identity_evidence_missing" };
  try {
    if (!showMatch || !podcastId || !catalogueId || !String(row?.Titel ?? "").trim() || !String(row?.Vært ?? "").trim() ||
        normalize(row?.Udgiver) !== "podimo") throw new Error("canonical_podimo_catalogue_identity_missing");
    if (new URL(officialUrl).protocol !== "https:") throw new Error("https_required");
    const showId = showMatch[1].toLowerCase();
    const page = podimoPageIdentity(podimoHtml, row, showId);
    const apple = findExactApplePodcastMapping(appleSearchPayload, row);
    const lookup = Array.isArray(appleLookupPayload?.results) ? appleLookupPayload.results : [];
    const direct = lookup.filter(value => String(value.collectionId) === String(apple.collectionId) &&
      String(value.trackId ?? value.collectionId) === String(apple.collectionId));
    if (direct.length !== 1 || direct[0].feedUrl !== apple.feedUrl || direct[0].collectionName !== row.Titel ||
        direct[0].trackName !== row.Titel || !exactAuthorSet(direct[0].artistName, row.Vært)) {
      throw new Error("apple_lookup_mapping_mismatch");
    }
    const feedUrl = String(apple.feedUrl).trim();
    if (new URL(feedUrl).protocol !== "https:") throw new Error("https_required");
    const identity = parseRssIdentity(feedXml, { allowTrailers: true });
    if (normalize(identity.title) !== normalize(row.Titel)) throw new Error("rss_channel_title_mismatch");
    if (new URL(identity.selfUrl).href !== new URL(feedUrl).href) throw new Error("rss_self_link_mismatch");
    if (new URL(identity.link).protocol !== "https:") throw new Error("rss_channel_link_not_https");
    if (!/^podimo(?:\s+studios)?$/iu.test(identity.owner)) throw new Error("rss_publisher_not_podimo");
    const fullEpisodeCount = identity.episodes.filter(episode => !episode.trailer).length;
    const trailerGuids = identity.episodes.filter(episode => episode.trailer).map(episode => episode.guid);
    return { ...result, status: "verified", reason: null, feed_url: feedUrl, podimo_show_id: showId,
      apple_collection_id: String(apple.collectionId), apple_collection_url: apple.collectionViewUrl,
      apple_artist_name: apple.artistName, channel_title: identity.title, channel_link: identity.link,
      channel_owner: identity.owner, self_url: identity.selfUrl, unique_guid_count: identity.guidCount,
      full_episode_count: fullEpisodeCount, trailer_guids: trailerGuids, podimo_title: page.title,
      podimo_authors: page.authors };
  } catch (error) {
    return { ...result, reason: error instanceof Error ? error.message.slice(0, 120) : "verification_failed" };
  }
}

function pageProvesFeed(html, officialUrl, feedUrl, publisher) {
  const canonicalTags = [...html.matchAll(/<link\b[^>]*>/giu)].map(match => match[0])
    .filter(value => /\brel\s*=\s*(["'])canonical\1/iu.test(value));
  const canonical = canonicalTags.map(value => attr(value, "href")).find(Boolean);
  const alternateTags = [...html.matchAll(/<link\b[^>]*>/giu)].map(match => match[0])
    .filter(value => /\brel\s*=\s*(["'])[^"']*alternate[^"']*\1/iu.test(value) && /\btype\s*=\s*(["'])application\/(?:rss\+xml|atom\+xml)\1/iu.test(value));
  const alternate = alternateTags.map(value => attr(value, "href")).find(href => href && new URL(href, officialUrl).href === feedUrl);
  const publisherNames = [...html.matchAll(/"publisher"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/giu)].map(match => match[1]);
  const orgNames = [...html.matchAll(/<meta\b[^>]*(?:property|name)\s*=\s*(["'])og:site_name\1[^>]*>/giu)].map(match => attr(match[0], "content"));
  const pagePublishers = [...publisherNames, ...orgNames].filter(Boolean);
  return normalize(canonical || "") === normalize(officialUrl) && Boolean(alternate) && pagePublishers.some(name => normalize(name) === normalize(publisher));
}

export function verifyRssEvidence(row, feedXml, showHtml) {
  const podcastId = String(row?.["Podcast-ID"] ?? row?.["Podcast ID"] ?? "").trim();
  const catalogueId = String(row?.catalogue_id ?? "").trim();
  const feedUrl = String(row?.Feed ?? "").trim();
  const officialUrl = String(row?.Link ?? "").trim();
  const publisher = String(row?.Udgiver ?? "").trim();
  const title = String(row?.Titel ?? "").trim();
  const result = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: podcastId,
    catalogue_id: catalogueId, feed_url: feedUrl, official_url: officialUrl, publisher,
    reason: "identity_evidence_missing" };
  try {
    if (!podcastId || !catalogueId || !title || !publisher) throw new Error("canonical_catalogue_identity_missing");
    if (new URL(feedUrl).protocol !== "https:" || new URL(officialUrl).protocol !== "https:") throw new Error("https_required");
    if (/(^|\.)(podimo\.com|apple\.com|spotify\.com)$|(^|\.)dr\.dk$/iu.test(new URL(feedUrl).hostname)) throw new Error("special_source_requires_adapter");
    const identity = parseRssIdentity(feedXml);
    if (normalize(identity.title) !== normalize(title)) throw new Error("rss_channel_title_mismatch");
    if (new URL(identity.link).href !== new URL(officialUrl).href) throw new Error("rss_channel_link_mismatch");
    if (new URL(identity.selfUrl).href !== new URL(feedUrl).href) throw new Error("rss_self_link_mismatch");
    if (normalize(identity.owner) !== normalize(publisher)) throw new Error("rss_publisher_mismatch");
    if (!pageProvesFeed(showHtml, officialUrl, feedUrl, publisher)) throw new Error("official_page_feed_link_or_publisher_mismatch");
    return { ...result, status: "verified", reason: null, channel_title: identity.title, channel_link: identity.link,
      channel_owner: identity.owner, self_url: identity.selfUrl, unique_guid_count: identity.guidCount };
  } catch (error) {
    return { ...result, reason: error instanceof Error ? error.message.slice(0, 120) : "verification_failed" };
  }
}
