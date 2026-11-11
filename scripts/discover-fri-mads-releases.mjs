import path from "node:path";
import { pathToFileURL } from "node:url";

export const FRI_MADS_OVERVIEW_URL = "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/";
export const FRI_MADS_SECOND_PAGE_URL = "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/?paginate=2";
export const FRI_MADS_PUBLISHER_FEED_URL = "https://frihedsbrevet.dk/feed/";
export const FRI_MADS_PODCAST_ID = "fri mads";
export const FRI_MADS_CATALOGUE_ID = "catalogue-v1-d94fc39e";
export const FRI_MADS_ACCESS_TYPE = "paid";
export const FRI_MADS_HISTORICAL_SOURCE_URL = "https://frihedsbrevet.dk/fri-mads-140-verden-af-i-gaar/";
export const FRI_MADS_BASELINE_NUMBER = 172;
export const FRI_MADS_MAX_RESPONSE_BYTES = 524288;
export const FRI_MADS_REQUEST_TIMEOUT_MS = 8000;
export const FRI_MADS_MAX_NEW_RELEASES = 27;

const SERIES_TITLE = /^Fri Mads #([1-9]\d*):\s*(.+)$/u;
const PERMALINK = /^\/fri-mads-(\d+)-[a-z0-9-]+\/$/u;
const TEASER = /(?:^|\b)(?:teaser|trailer|smagsprøve|uddrag)(?:\b|$)/iu;
const JWT_LIKE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/u;
const SENSITIVE_QUERY = /(?:^|[?&])(?:token|access_token|auth_token|api_key|api-key|key|signature|sig)=/iu;
const DANISH_MONTHS = new Map([
  ["januar", 1], ["februar", 2], ["marts", 3], ["april", 4], ["maj", 5], ["juni", 6],
  ["juli", 7], ["august", 8], ["september", 9], ["oktober", 10], ["november", 11], ["december", 12]
]);

class OverviewParseError extends Error {
  constructor(code) { super(code); this.code = code; }
}

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
    sourceOverview: FRI_MADS_OVERVIEW_URL,
    supplementalFeed: "not_requested_overview_is_primary",
    podcastId: FRI_MADS_PODCAST_ID,
    catalogueId: FRI_MADS_CATALOGUE_ID,
    accessType: FRI_MADS_ACCESS_TYPE,
    afterNumber,
    status: "unavailable",
    reasonCodes: [],
    overviewItemCount: 0,
    candidateCount: 0,
    pagesRequested: [],
    releases: []
  };
}

function decodeHtmlEntities(value) {
  return String(value ?? "").replace(/&(#x[\da-f]{1,6}|#\d{1,7}|amp|lt|gt|quot|apos|nbsp|shy);/giu, (entity, name) => {
    const normalized = name.toLowerCase();
    if (normalized === "amp") return "&";
    if (normalized === "lt") return "<";
    if (normalized === "gt") return ">";
    if (normalized === "quot") return '"';
    if (normalized === "apos") return "'";
    if (normalized === "nbsp") return "\u00a0";
    if (normalized === "shy") return "\u00ad";
    const codePoint = normalized.startsWith("#x")
      ? Number.parseInt(normalized.slice(2), 16)
      : Number.parseInt(normalized.slice(1), 10);
    if (!Number.isInteger(codePoint) || codePoint < 1 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return "\ufffd";
    return String.fromCodePoint(codePoint);
  });
}

function textContent(markup) {
  return decodeHtmlEntities(String(markup ?? "")
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/giu, " ")
    .replace(/<[^>]*>/gu, " "))
    .replace(/[\u00ad\u200b\ufeff]/gu, "")
    .replace(/\s+/gu, " ")
    .normalize("NFC")
    .trim();
}

function attributes(tag) {
  const result = new Map();
  const source = String(tag || "").replace(/^<\w+/u, "").replace(/>$/u, "");
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gu;
  for (const match of source.matchAll(pattern)) result.set(match[1].toLowerCase(), decodeHtmlEntities(match[2] ?? match[3] ?? match[4] ?? ""));
  return result;
}

function safeText(value, maxLength) {
  const text = String(value ?? "").normalize("NFC").trim();
  if (!text || text.length > maxLength || /[\u0000-\u001f\u007f]/u.test(text) ||
      JWT_LIKE.test(text) || SENSITIVE_QUERY.test(text) || /\bBearer\s+/iu.test(text)) return null;
  return text;
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

function publicationDate(value) {
  const match = String(value || "").trim().match(/^(\d{1,2})\.\s+([\p{L}]+)\s+(\d{4})\s+kl\.\s+(\d{2}):(\d{2})$/iu);
  if (!match) return null;
  const day = Number(match[1]);
  const month = DANISH_MONTHS.get(match[2].toLocaleLowerCase("da-DK"));
  const year = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (!month || hour > 23 || minute > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function matchingClass(elements, className) {
  return elements.filter((match) => (attributes(match[1]).get("class") || "").split(/\s+/u).includes(className));
}

function extractCard(anchorTag, anchorBody) {
  const attrs = attributes(anchorTag);
  const cardClass = (attrs.get("class") || "").split(/\s+/u);
  if (!cardClass.includes("post-card") && !cardClass.includes("post-card-link")) throw new OverviewParseError("overview_markup_changed");

  const titleTags = [...anchorBody.matchAll(/<h3\b([^>]*)>([\s\S]*?)<\/h3\s*>/giu)];
  const categoryTags = [...anchorBody.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p\s*>/giu)];
  const metadataBlocks = [];
  for (const match of anchorBody.matchAll(/<div\b([^>]*)>/giu)) {
    if (!/(?:article-meta|post-card-meta)/u.test(attributes(match[1]).get("class") || "")) continue;
    const bodyStart = match.index + match[0].length;
    const closeAt = anchorBody.slice(bodyStart).search(/<\/div\s*>/iu);
    if (closeAt < 0) throw new OverviewParseError("overview_markup_changed");
    metadataBlocks.push(anchorBody.slice(bodyStart, bodyStart + closeAt));
  }
  const recognizedTitles = titleTags.filter((match) => {
    const classes = (attributes(match[1]).get("class") || "").split(/\s+/u);
    return classes.includes("c-post-card__title") || classes.includes("post-card-headline");
  });
  const recognizedCategories = categoryTags.filter((match) => {
    const classes = (attributes(match[1]).get("class") || "").split(/\s+/u);
    return (classes.includes("c-post-card__category__title") || classes.includes("post-card-category--title")) && textContent(match[2]) === "Fri Mads";
  });
  if (recognizedTitles.length !== 1 || recognizedCategories.length !== 1 || metadataBlocks.length !== 1) {
    throw new OverviewParseError("overview_markup_changed");
  }
  const title = textContent(recognizedTitles[0][2]);
  const series = title.match(SERIES_TITLE);
  const spans = [...metadataBlocks[0].matchAll(/<span\b[^>]*>([\s\S]*?)<\/span\s*>/giu)].map((match) => textContent(match[1]));
  if (!series || spans.length !== 2 || !spans[0].startsWith("Af ")) throw new OverviewParseError("overview_metadata_changed");
  const author = safeText(spans[0].slice(3), 120);
  const date = publicationDate(spans[1]);
  if (!author || !date || !safeText(title, 300)) throw new OverviewParseError("overview_metadata_changed");

  const href = attrs.get("href");
  const canonical = exactCanonicalArticleUrl(href);
  if (!canonical) throw new OverviewParseError("untrusted_or_invalid_permalink");
  const titleNumber = Number(series[1]);
  if ((titleNumber === 140 && canonical.url !== FRI_MADS_HISTORICAL_SOURCE_URL) ||
      (canonical.url === FRI_MADS_HISTORICAL_SOURCE_URL && titleNumber !== 140)) {
    throw new OverviewParseError("historical_source_conflict");
  }
  if (titleNumber !== canonical.number) throw new OverviewParseError("number_permalink_conflict");
  if (TEASER.test(title)) throw new OverviewParseError("teaser_or_trailer");
  return { number: titleNumber, title, publishedDate: date, url: canonical.url, author };
}

export function parseFriMadsOverview(html) {
  if (typeof html !== "string" || !html.trim() || new TextEncoder().encode(html).byteLength > FRI_MADS_MAX_RESPONSE_BYTES) {
    throw new OverviewParseError("invalid_or_unreadable_overview");
  }
  if (!/<html\b[\s\S]*<\/html\s*>/iu.test(html)) throw new OverviewParseError("overview_markup_changed");

  const records = [];
  const anchorPattern = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/giu;
  for (const match of html.matchAll(anchorPattern)) {
    const attrs = attributes(`<a ${match[1]}>`);
    const href = attrs.get("href") || "";
    let pathname = "";
    try { pathname = new URL(href, FRI_MADS_OVERVIEW_URL).pathname; } catch { /* non-series links are ignored */ }
    if (!/fri-mads-/iu.test(pathname)) continue;
    records.push(extractCard(`<a ${match[1]}>`, match[2]));
  }
  if (records.length > 50) throw new OverviewParseError("overview_item_limit_exceeded");
  if (records.length === 0) throw new OverviewParseError("empty_source");

  const numbers = new Set();
  const urls = new Set();
  for (const record of records) {
    if (numbers.has(record.number)) throw new OverviewParseError("duplicate_release_number");
    if (urls.has(record.url)) throw new OverviewParseError("duplicate_permalink");
    numbers.add(record.number);
    urls.add(record.url);
  }
  const descending = [...records].sort((left, right) => right.number - left.number);
  for (let index = 1; index < descending.length; index += 1) {
    if (descending[index - 1].number - descending[index].number !== 1) throw new OverviewParseError("release_number_gap");
  }
  return descending;
}

function failure(afterNumber, status, code, extra = {}) {
  return { ...baseReport(afterNumber), ...extra, status, reasonCodes: [code], releases: [] };
}

function buildDiscovery(firstPageHtml, { afterNumber = FRI_MADS_BASELINE_NUMBER, secondPageHtml = null } = {}) {
  const report = baseReport(afterNumber);
  if (!Number.isSafeInteger(afterNumber) || afterNumber < 0) return { ...report, status: "invalid_cursor", reasonCodes: ["invalid_after_number"] };

  let firstPage;
  let secondPage = [];
  try {
    firstPage = parseFriMadsOverview(firstPageHtml);
    if (secondPageHtml !== null) secondPage = parseFriMadsOverview(secondPageHtml);
  } catch (error) {
    const code = error instanceof OverviewParseError ? error.code : "overview_markup_changed";
    return failure(afterNumber, code === "empty_source" ? "empty_source" : "source_invalid", code);
  }
  report.overviewItemCount = firstPage.length + secondPage.length;

  const firstMinimum = firstPage.at(-1).number;
  const hasNewer = firstPage[0].number > afterNumber;
  if (hasNewer && firstMinimum > afterNumber + 1 && secondPageHtml === null) {
    return { ...report, status: "pagination_required", reasonCodes: ["older_page_needed_for_incremental_boundary"], candidateCount: firstPage.length };
  }
  if (secondPageHtml !== null) {
    const secondMaximum = secondPage[0].number;
    if (firstMinimum - secondMaximum !== 1) {
      return { ...report, status: "identity_conflict", reasonCodes: ["pagination_boundary_gap"], candidateCount: firstPage.length + secondPage.length };
    }
    const combined = [...firstPage, ...secondPage].sort((left, right) => right.number - left.number);
    const numbers = new Set();
    const urls = new Set();
    for (const record of combined) {
      if (numbers.has(record.number)) return { ...report, status: "identity_conflict", reasonCodes: ["duplicate_release_number"], candidateCount: combined.length };
      if (urls.has(record.url)) return { ...report, status: "identity_conflict", reasonCodes: ["duplicate_permalink"], candidateCount: combined.length };
      numbers.add(record.number);
      urls.add(record.url);
    }
    for (let index = 1; index < combined.length; index += 1) {
      if (combined[index - 1].number - combined[index].number !== 1) {
        return { ...report, status: "identity_conflict", reasonCodes: ["release_number_gap"], candidateCount: combined.length };
      }
    }
    firstPage = combined;
  }

  const newRecords = firstPage.filter((record) => record.number > afterNumber).sort((left, right) => left.number - right.number);
  if (newRecords.length > FRI_MADS_MAX_NEW_RELEASES) {
    return { ...report, status: "identity_conflict", reasonCodes: ["incremental_window_exceeded"], candidateCount: firstPage.length };
  }
  for (let index = 0; index < newRecords.length; index += 1) {
    if (newRecords[index].number !== afterNumber + index + 1) {
      return { ...report, status: "identity_conflict", reasonCodes: ["release_number_gap"], candidateCount: firstPage.length };
    }
  }

  const releases = newRecords.map((record) => ({
    releaseId: `fri-mads:${record.number}:${record.url}`,
    podcastId: FRI_MADS_PODCAST_ID,
    catalogueId: FRI_MADS_CATALOGUE_ID,
    releaseNumber: record.number,
    title: record.title,
    publishedDate: record.publishedDate,
    canonicalUrl: record.url,
    author: record.author,
    sourceGuid: null,
    sourceGuidStatus: "official_overview_has_no_guid",
    accessType: FRI_MADS_ACCESS_TYPE,
    contentKind: "article",
    metadataOnly: true,
    playable: false,
    rateable: false,
    audioUrl: null
  }));

  return {
    ...report,
    status: releases.length ? "new_metadata_discovered" : "no_new_releases",
    candidateCount: firstPage.length,
    reasonCodes: [],
    releases
  };
}

export function discoverFriMadsArticles(firstPageHtml, options = {}) {
  return buildDiscovery(firstPageHtml, options);
}

async function readBoundedHtml(response) {
  const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase();
  if (!contentType.includes("text/html")) throw new OverviewParseError("unexpected_content_type");
  const declaredBytes = Number(response.headers?.get?.("content-length") || 0);
  if (declaredBytes > FRI_MADS_MAX_RESPONSE_BYTES) throw new OverviewParseError("response_too_large");
  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > FRI_MADS_MAX_RESPONSE_BYTES) throw new OverviewParseError("response_too_large");
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
      throw new OverviewParseError("response_too_large");
    }
    chunks.push(part.value);
  }
  const merged = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  try { return new TextDecoder("utf-8", { fatal: true }).decode(merged); }
  catch { throw new OverviewParseError("invalid_encoding"); }
}

async function fetchOverview(url, fetchImpl) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      headers: { accept: "text/html" },
      redirect: "error",
      signal: AbortSignal.timeout(FRI_MADS_REQUEST_TIMEOUT_MS)
    });
  } catch (error) {
    return { error: error?.name === "TimeoutError" || error?.name === "AbortError" ? "source_timeout" : "source_request_failed" };
  }
  if (!response.ok) return { error: `source_http_${response.status}` };
  try { return { html: await readBoundedHtml(response) }; }
  catch (error) { return { error: error instanceof OverviewParseError ? error.code : "invalid_or_unreadable_response" }; }
}

export async function runFriMadsDiscovery({ fetchImpl = fetch, afterNumber = FRI_MADS_BASELINE_NUMBER } = {}) {
  const report = baseReport(afterNumber);
  if (!Number.isSafeInteger(afterNumber) || afterNumber < 0) return { ...report, status: "invalid_cursor", reasonCodes: ["invalid_after_number"] };
  const first = await fetchOverview(FRI_MADS_OVERVIEW_URL, fetchImpl);
  if (first.error) {
    const status = first.error.startsWith("source_http_") ? "source_unavailable" : "source_unavailable";
    return { ...report, status, reasonCodes: [first.error], pagesRequested: [FRI_MADS_OVERVIEW_URL] };
  }
  let result = buildDiscovery(first.html, { afterNumber });
  result.pagesRequested = [FRI_MADS_OVERVIEW_URL];
  if (result.status !== "pagination_required") return result;

  const second = await fetchOverview(FRI_MADS_SECOND_PAGE_URL, fetchImpl);
  if (second.error) return { ...report, status: "source_unavailable", reasonCodes: [second.error], pagesRequested: [FRI_MADS_OVERVIEW_URL, FRI_MADS_SECOND_PAGE_URL] };
  result = buildDiscovery(first.html, { afterNumber, secondPageHtml: second.html });
  result.pagesRequested = [FRI_MADS_OVERVIEW_URL, FRI_MADS_SECOND_PAGE_URL];
  return result;
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
