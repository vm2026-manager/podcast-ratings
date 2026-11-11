import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseRssEvidence } from "./audit-frihedsbrevet-sources.mjs";

export const FRI_MADS_PUBLIC_FEED_URL = "https://frihedsbrevet.dk/feed/";
export const FRI_MADS_PODCAST_ID = "fri mads";
export const FRI_MADS_CATALOGUE_ID = "catalogue-v1-d94fc39e";
export const FRI_MADS_ACCESS_TYPE = "paid";
export const FRI_MADS_HISTORICAL_SOURCE_URL = "https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/";
export const FRI_MADS_BASELINE_NUMBER = 172;
export const FRI_MADS_MAX_RESPONSE_BYTES = 262144;
export const FRI_MADS_REQUEST_TIMEOUT_MS = 8000;

const SERIES_TITLE = /^Fri Mads #([1-9]\d*):\s*(.+)$/u;
const SERIES_MARKER = /^Fri Mads(?:\s|$)/u;
const PERMALINK = /^\/fri-mads-(\d+)-[a-z0-9-]+\/$/u;
const TEASER = /(?:^|\b)(?:teaser|trailer|smagsprøve|uddrag)(?:\b|$)/iu;
const JWT_LIKE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u;
const SENSITIVE_QUERY = /(?:^|[?&])(?:token|access_token|auth_token|api_key|api-key|key|signature|sig)=/iu;

function baseReport(afterNumber) {
  return {
    schemaVersion: 1,
    dryRun: true,
    writesPerformed: false,
    supabaseCalls: 0,
    sheetWrites: 0,
    catalogueWrites: 0,
    episodeImports: 0,
    articleRequests: 0,
    sourceFeed: FRI_MADS_PUBLIC_FEED_URL,
    podcastId: FRI_MADS_PODCAST_ID,
    catalogueId: FRI_MADS_CATALOGUE_ID,
    accessType: FRI_MADS_ACCESS_TYPE,
    afterNumber,
    status: "unavailable",
    reasonCodes: [],
    feedItemCount: 0,
    candidateCount: 0,
    releases: []
  };
}

function exactCanonicalArticleUrl(value) {
  let url;
  try { url = new URL(String(value || "")); }
  catch { return null; }
  if (url.protocol !== "https:" || url.origin !== "https://frihedsbrevet.dk" ||
      url.username || url.password || url.search || url.hash || url.port) return null;
  const match = url.pathname.match(PERMALINK);
  if (!match || url.href !== url.origin + url.pathname) return null;
  return { url: url.href, number: Number(match[1]) };
}

function safeText(value, maxLength) {
  const text = String(value ?? "").normalize("NFC").trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/u.test(text) ||
      JWT_LIKE.test(text) || SENSITIVE_QUERY.test(text) || /\bBearer\s+/iu.test(text)) return null;
  return text;
}

function sourceGuidEvidence(item, canonicalUrl, guidCounts) {
  const guid = String(item.guid || "").trim();
  if (!guid) return { sourceGuid: null, sourceGuidStatus: "missing" };
  if ((guidCounts.get(guid) || 0) !== 1) return { sourceGuid: null, sourceGuidStatus: "not_unique_in_feed" };
  if (JWT_LIKE.test(guid) || SENSITIVE_QUERY.test(guid) || /\bBearer\s+/iu.test(guid)) {
    return { sourceGuid: null, sourceGuidStatus: "unsafe_withheld" };
  }
  try {
    const url = new URL(guid);
    if (url.protocol !== "https:" || url.origin !== "https://frihedsbrevet.dk" ||
        url.username || url.password || url.search || url.hash || url.href !== canonicalUrl) {
      return { sourceGuid: null, sourceGuidStatus: "noncanonical_withheld" };
    }
    return { sourceGuid: guid, sourceGuidStatus: "verified_unique" };
  } catch {
    if (!/^[A-Za-z0-9._:-]{1,200}$/u.test(guid)) return { sourceGuid: null, sourceGuidStatus: "unsafe_withheld" };
    return { sourceGuid: guid, sourceGuidStatus: "verified_unique" };
  }
}

function normalizePublicationDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return { value: null, invalid: false };
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp)
    ? { value: new Date(timestamp).toISOString(), invalid: false }
    : { value: null, invalid: true };
}

export function discoverFriMadsArticles(xml, { afterNumber = FRI_MADS_BASELINE_NUMBER } = {}) {
  const report = baseReport(afterNumber);
  if (!Number.isSafeInteger(afterNumber) || afterNumber < 0) {
    return { ...report, status: "invalid_cursor", reasonCodes: ["invalid_after_number"] };
  }

  let evidence;
  try { evidence = parseRssEvidence(xml, { expectedChannelTitle: "Frihedsbrevet" }); }
  catch { return { ...report, status: "source_invalid", reasonCodes: ["invalid_xml"] }; }
  report.feedItemCount = evidence.itemCount;
  if (!evidence.channelMatches) {
    return { ...report, status: "identity_conflict", reasonCodes: ["wrong_channel_identity"] };
  }
  if (!evidence.itemCount) return { ...report, status: "empty_feed", reasonCodes: ["empty_feed"] };

  const guidCounts = new Map();
  for (const item of evidence.items) {
    const guid = String(item.guid || "").trim();
    if (guid) guidCounts.set(guid, (guidCounts.get(guid) || 0) + 1);
  }

  const candidates = [];
  const conflicts = [];
  const rejected = [];
  for (const item of evidence.items) {
    const title = String(item.title || "").trim();
    const categories = Array.isArray(item.categories) ? item.categories : [];
    const hasSeriesCategory = categories.includes("Fri Mads");
    const titleHasSeriesMarker = SERIES_MARKER.test(title);
    if (!hasSeriesCategory && !titleHasSeriesMarker) continue;

    const titleMatch = title.match(SERIES_TITLE);
    if (!hasSeriesCategory || !titleMatch) {
      conflicts.push("series_marker_mismatch");
      continue;
    }
    const titleNumber = Number(titleMatch[1]);
    const canonical = exactCanonicalArticleUrl(item.link);
    if (!canonical) {
      conflicts.push("untrusted_or_invalid_permalink");
      continue;
    }
    if ((titleNumber === 140 && canonical.url !== FRI_MADS_HISTORICAL_SOURCE_URL) ||
        (canonical.url === FRI_MADS_HISTORICAL_SOURCE_URL && titleNumber !== 140)) {
      conflicts.push("historical_source_conflict");
      continue;
    }
    if (canonical.number !== titleNumber) {
      conflicts.push("number_permalink_conflict");
      continue;
    }

    const date = normalizePublicationDate(item.publishedAt);
    if (date.invalid) {
      conflicts.push("invalid_publication_date");
      continue;
    }
    if (title.length > 300 || !safeText(title, 300)) {
      conflicts.push("unsafe_title_withheld");
      continue;
    }

    if (item.classification === "trailer" || TEASER.test(title) || TEASER.test(String(item.episodeType || ""))) {
      rejected.push("teaser_or_trailer");
      continue;
    }
    if (item.hasAudioEnclosure) {
      rejected.push("audio_requires_separate_review");
      continue;
    }
    candidates.push({
      number: titleNumber,
      title,
      publishedAt: date.value,
      url: canonical.url,
      author: safeText(item.author, 120),
      ...sourceGuidEvidence(item, canonical.url, guidCounts)
    });
  }

  if (conflicts.length) {
    return {
      ...report,
      status: "identity_conflict",
      candidateCount: candidates.length,
      reasonCodes: [...new Set(conflicts)].sort()
    };
  }

  const seenNumbers = new Set();
  const seenUrls = new Set();
  for (const candidate of candidates) {
    if (seenNumbers.has(candidate.number)) conflicts.push("duplicate_release_number");
    if (seenUrls.has(candidate.url)) conflicts.push("duplicate_permalink");
    seenNumbers.add(candidate.number);
    seenUrls.add(candidate.url);
  }
  if (conflicts.length) {
    return {
      ...report,
      status: "identity_conflict",
      candidateCount: candidates.length,
      reasonCodes: [...new Set(conflicts)].sort()
    };
  }

  if (!candidates.length) {
    return rejected.length
      ? { ...report, status: "no_eligible_releases", reasonCodes: [...new Set(rejected)].sort() }
      : { ...report, status: "series_absent_from_feed_window", reasonCodes: ["no_exact_fri_mads_item"] };
  }

  const newCandidates = candidates.filter((candidate) => candidate.number > afterNumber)
    .sort((left, right) => left.number - right.number);
  if (newCandidates.length) {
    let expectedNumber = afterNumber + 1;
    for (const candidate of newCandidates) {
      if (candidate.number !== expectedNumber) {
        return { ...report, status: "identity_conflict", candidateCount: candidates.length, reasonCodes: ["release_number_gap"] };
      }
      expectedNumber += 1;
    }
  }

  const releases = newCandidates
    .map((candidate) => ({
      releaseId: "fri-mads:" + candidate.number + ":" + candidate.url,
      podcastId: FRI_MADS_PODCAST_ID,
      catalogueId: FRI_MADS_CATALOGUE_ID,
      releaseNumber: candidate.number,
      title: candidate.title,
      publishedAt: candidate.publishedAt,
      canonicalUrl: candidate.url,
      author: candidate.author,
      sourceGuid: candidate.sourceGuid,
      sourceGuidStatus: candidate.sourceGuidStatus,
      accessType: FRI_MADS_ACCESS_TYPE,
      contentKind: "article",
      metadataOnly: true,
      playable: false,
      rateable: false,
      audioUrl: null
    }));

  return {
    ...report,
    status: releases.length ? "new_metadata_discovered" : rejected.length ? "no_eligible_releases" : "no_new_releases",
    candidateCount: candidates.length,
    reasonCodes: [...new Set(rejected)].sort(),
    releases
  };
}

async function readBoundedRss(response) {
  const declaredBytes = Number(response.headers?.get?.("content-length") || 0);
  if (declaredBytes > FRI_MADS_MAX_RESPONSE_BYTES) throw new Error("response_too_large");
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > FRI_MADS_MAX_RESPONSE_BYTES) throw new Error("response_too_large");
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > FRI_MADS_MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new Error("response_too_large");
    }
    chunks.push(part.value);
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(merged); }
  catch { throw new Error("invalid_encoding"); }
}

export async function runFriMadsDiscovery({ fetchImpl = fetch, afterNumber = FRI_MADS_BASELINE_NUMBER } = {}) {
  const report = baseReport(afterNumber);
  if (!Number.isSafeInteger(afterNumber) || afterNumber < 0) {
    return { ...report, status: "invalid_cursor", reasonCodes: ["invalid_after_number"] };
  }
  let response;
  try {
    response = await fetchImpl(FRI_MADS_PUBLIC_FEED_URL, {
      method: "GET",
      headers: { accept: "application/rss+xml, application/xml, text/xml" },
      redirect: "error",
      signal: AbortSignal.timeout(FRI_MADS_REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    return {
      ...report,
      status: "source_unavailable",
      reasonCodes: [error?.name === "TimeoutError" || error?.name === "AbortError" ? "source_timeout" : "source_request_failed"]
    };
  }
  if (!response.ok) {
    return { ...report, status: "source_unavailable", reasonCodes: ["source_http_" + response.status] };
  }
  let xml;
  try { xml = await readBoundedRss(response); }
  catch (error) {
    return {
      ...report,
      status: "source_unavailable",
      reasonCodes: [error?.message === "response_too_large" ? "response_too_large" : "invalid_or_unreadable_response"]
    };
  }
  return discoverFriMadsArticles(xml, { afterNumber });
}

async function main() {
  const args = process.argv.slice(2);
  let afterNumber = FRI_MADS_BASELINE_NUMBER;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--dry-run") continue;
    if (args[index] === "--after-number" && /^\d+$/u.test(args[index + 1] || "")) {
      afterNumber = Number(args[index + 1]);
      index += 1;
      continue;
    }
    throw new Error("Unsupported discovery argument");
  }
  const report = await runFriMadsDiscovery({ afterNumber });
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== "new_metadata_discovered" && report.status !== "no_new_releases") {
    console.log("::warning::Fri Mads discovery did not produce a verified result: " + report.reasonCodes.join(", "));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Fri Mads discovery failed closed: invalid invocation");
    process.exitCode = 1;
  });
}
