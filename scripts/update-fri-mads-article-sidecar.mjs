import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  FRI_MADS_ACCESS_TYPE,
  FRI_MADS_CATALOGUE_ID,
  FRI_MADS_HISTORICAL_SOURCE_URL,
  FRI_MADS_OVERVIEW_URL,
  FRI_MADS_PODCAST_ID,
  FRI_MADS_SIDECAR_ITEM_LIMIT
} from "./discover-fri-mads-releases.mjs";

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const TITLE = /^Fri Mads #([1-9]\d*):\s+\S/u;
const PERMALINK = /^\/fri-mads-(\d+)-[a-z0-9-]+\/$/u;
const ARTICLE_FIELDS = ["releaseId", "releaseNumber", "title", "publishedDate", "canonicalUrl"];
const DISCOVERY_FIELDS = ["releaseId", "podcastId", "catalogueId", "releaseNumber", "title", "publishedDate", "canonicalUrl", "author", "sourceGuid", "sourceGuidStatus", "accessType", "contentKind", "metadataOnly", "playable", "rateable", "audioUrl"];

function fail(message) { throw new Error(message); }

function validateArticle(article) {
  if (!article || typeof article !== "object" || Array.isArray(article)) fail("invalid_article_record");
  if (Object.keys(article).sort().join("|") !== ARTICLE_FIELDS.slice().sort().join("|")) fail("unexpected_article_metadata");
  const number = Number(article.releaseNumber);
  const titleMatch = typeof article.title === "string" ? article.title.match(TITLE) : null;
  const date = typeof article.publishedDate === "string" && DATE.test(article.publishedDate)
    ? new Date(`${article.publishedDate}T00:00:00Z`)
    : null;
  let url;
  try { url = new URL(String(article.canonicalUrl || "")); } catch { fail("invalid_article_permalink"); }
  const permalinkMatch = url.pathname.match(PERMALINK);
  if (!Number.isSafeInteger(number) || number < 1 || !titleMatch || Number(titleMatch[1]) !== number ||
      !date || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== article.publishedDate ||
      url.protocol !== "https:" || url.origin !== "https://frihedsbrevet.dk" || url.port || url.username || url.password ||
      url.search || url.hash || url.href !== article.canonicalUrl || !permalinkMatch || Number(permalinkMatch[1]) !== number ||
      article.releaseId !== `fri-mads:${number}:${article.canonicalUrl}` ||
      (number === 140 && article.canonicalUrl !== FRI_MADS_HISTORICAL_SOURCE_URL)) {
    fail("article_identity_or_metadata_conflict");
  }
  return { releaseId: article.releaseId, releaseNumber: number, title: article.title,
    publishedDate: article.publishedDate, canonicalUrl: article.canonicalUrl };
}

function validateItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > FRI_MADS_SIDECAR_ITEM_LIMIT) fail("invalid_sidecar_item_count");
  const seenNumbers = new Set();
  const seenUrls = new Set();
  const normalized = items.map(validateArticle);
  for (let index = 0; index < normalized.length; index += 1) {
    const item = normalized[index];
    if (seenNumbers.has(item.releaseNumber) || seenUrls.has(item.canonicalUrl)) fail("duplicate_article_identity");
    seenNumbers.add(item.releaseNumber);
    seenUrls.add(item.canonicalUrl);
    if (index > 0 && normalized[index - 1].releaseNumber - item.releaseNumber !== 1) fail("article_number_gap");
  }
  return normalized;
}

function projectVerifiedDiscoveryArticle(article) {
  if (!article || typeof article !== "object" || Array.isArray(article) ||
      Object.keys(article).sort().join("|") !== DISCOVERY_FIELDS.slice().sort().join("|") ||
      article.podcastId !== FRI_MADS_PODCAST_ID || article.catalogueId !== FRI_MADS_CATALOGUE_ID ||
      typeof article.author !== "string" || !article.author.trim() || article.author.length > 120 ||
      article.sourceGuid !== null || article.sourceGuidStatus !== "official_overview_has_no_guid" ||
      article.accessType !== FRI_MADS_ACCESS_TYPE || article.contentKind !== "article" ||
      article.metadataOnly !== true || article.playable !== false || article.rateable !== false || article.audioUrl !== null) {
    fail("discovery_article_classification_invalid");
  }
  return validateArticle({
    releaseId: article.releaseId,
    releaseNumber: article.releaseNumber,
    title: article.title,
    publishedDate: article.publishedDate,
    canonicalUrl: article.canonicalUrl
  });
}

export function createFriMadsArticleSidecar(report, previous = null) {
  if (!report || typeof report !== "object" || Array.isArray(report) ||
      report.schemaVersion !== 1 || report.dryRun !== true || report.writesPerformed !== false ||
      report.supabaseCalls !== 0 || report.sheetWrites !== 0 || report.catalogueWrites !== 0 ||
      report.episodeImports !== 0 || report.articleRequests !== 0 ||
      report.sourceOverview !== FRI_MADS_OVERVIEW_URL ||
      !["new_metadata_discovered", "no_new_releases"].includes(report.status) ||
      !Array.isArray(report.pagesRequested) || report.pagesRequested.length < 1 || report.pagesRequested.length > 2 ||
      report.pagesRequested[0] !== FRI_MADS_OVERVIEW_URL ||
      report.pagesRequested.some((url) => ![FRI_MADS_OVERVIEW_URL, "https://frihedsbrevet.dk/nyhedsbrev/fri-mads/?paginate=2"].includes(url))) {
    fail("unverified_or_unsafe_discovery_report");
  }

  if (!Array.isArray(report.latestOverviewReleases) || report.latestOverviewReleases.length < 1 || report.latestOverviewReleases.length > FRI_MADS_SIDECAR_ITEM_LIMIT) fail("sidecar_item_limit_exceeded");
  const items = validateItems(report.latestOverviewReleases.map(projectVerifiedDiscoveryArticle));
  if (previous !== null) {
    if (!isValidFriMadsArticleSidecar(previous)) fail("existing_sidecar_invalid");
    const previousByNumber = new Map(previous.items.map((item) => [item.releaseNumber, item]));
    for (const item of items) {
      const old = previousByNumber.get(item.releaseNumber);
      if (old && old.canonicalUrl !== item.canonicalUrl) fail("existing_article_permalink_changed");
    }
  }

  return {
    schemaVersion: 1,
    podcastId: FRI_MADS_PODCAST_ID,
    catalogueId: FRI_MADS_CATALOGUE_ID,
    sourceOverview: FRI_MADS_OVERVIEW_URL,
    accessType: FRI_MADS_ACCESS_TYPE,
    contentKind: "article",
    metadataOnly: true,
    playable: false,
    rateable: false,
    audioUrl: null,
    items
  };
}

export function isValidFriMadsArticleSidecar(sidecar) {
  try {
    if (!sidecar || typeof sidecar !== "object" || Array.isArray(sidecar)) return false;
    const allowed = ["schemaVersion", "podcastId", "catalogueId", "sourceOverview", "accessType", "contentKind", "metadataOnly", "playable", "rateable", "audioUrl", "items"];
    if (Object.keys(sidecar).sort().join("|") !== allowed.slice().sort().join("|")) return false;
    if (sidecar.schemaVersion !== 1 || sidecar.podcastId !== FRI_MADS_PODCAST_ID ||
        sidecar.catalogueId !== FRI_MADS_CATALOGUE_ID || sidecar.sourceOverview !== FRI_MADS_OVERVIEW_URL ||
        sidecar.accessType !== FRI_MADS_ACCESS_TYPE || sidecar.contentKind !== "article" ||
        sidecar.metadataOnly !== true || sidecar.playable !== false || sidecar.rateable !== false || sidecar.audioUrl !== null) return false;
    validateItems(sidecar.items);
    return true;
  } catch { return false; }
}

function ensureReportPathIsTemporary(reportPath) {
  const runnerTemp = process.env.RUNNER_TEMP;
  if (!runnerTemp || !path.isAbsolute(reportPath)) fail("report_file_must_be_in_runner_temp");
  const relative = path.relative(path.resolve(runnerTemp), path.resolve(reportPath));
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) fail("report_file_must_be_in_runner_temp");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--report-file") fail("unsupported_invocation");
  const reportPath = args[1];
  ensureReportPathIsTemporary(reportPath);
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const target = path.join(root, "data", "fri-mads-articles.json");
  let previous = null;
  try { previous = JSON.parse(await readFile(target, "utf8")); }
  catch (error) { if (error?.code !== "ENOENT") fail("existing_sidecar_unreadable"); }
  const sidecar = createFriMadsArticleSidecar(report, previous);
  const contents = `${JSON.stringify(sidecar, null, 2)}\n`;
  if (previous && `${JSON.stringify(previous, null, 2)}\n` === contents) {
    console.log(JSON.stringify({ status: "unchanged", itemCount: sidecar.items.length, writesPerformed: false }));
    return;
  }
  const temporaryPath = `${target}.${process.pid}.tmp`;
  await writeFile(temporaryPath, contents, { encoding: "utf8", flag: "wx" });
  await rename(temporaryPath, target);
  console.log(JSON.stringify({ status: "updated", itemCount: sidecar.items.length, writesPerformed: true }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Fri Mads sidecar update failed closed.");
    process.exitCode = 1;
  });
}
