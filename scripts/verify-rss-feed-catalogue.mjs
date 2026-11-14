import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fetchPublicHttpsText, verifyRssEvidence, verifyPodimoPublicRssEvidence,
  findExactApplePodcastMapping, RSS_VERIFICATION_VERSION } from "./rss-feed-verification.mjs";

const normalize = value => String(value ?? "").trim().normalize("NFKC").toLocaleLowerCase("da-DK");
const getId = row => String(row?.["Podcast-ID"] ?? row?.["Podcast ID"] ?? "").trim();
const getFeed = row => String(row?.Feed ?? "").trim();
const getPrior = (rows, row) => rows.find(candidate => getId(candidate) === getId(row) &&
  candidate?.catalogue_id === row?.catalogue_id && candidate?.episodeFeedVerification?.version === RSS_VERIFICATION_VERSION &&
  (candidate.episodeFeedVerification.feed_url === getFeed(row) || candidate.episodeFeedVerification.catalogue_feed_url === getFeed(row)) &&
  candidate.episodeFeedVerification.official_url === String(row?.Link ?? "").trim() &&
  candidate.episodeFeedVerification.publisher === String(row?.Udgiver ?? "").trim() &&
  (candidate.episodeFeedVerification.status !== "verified" ||
    candidate.episodeFeedVerification.channel_title === String(row?.Titel ?? "").trim()));

export async function verifyCatalogueFeeds(candidate, previous = candidate, { fetchText = fetchPublicHttpsText, maxNewCandidates = 20 } = {}) {
  const rows = Array.isArray(candidate) ? candidate : candidate?.rows;
  const previousRows = Array.isArray(previous) ? previous : previous?.rows;
  if (!Array.isArray(rows) || !Array.isArray(previousRows)) throw new Error("Catalogue rows are required");
  const previousById = new Map(previousRows.filter(row => getId(row)).map(row => [getId(row), row]));
  const previousByNormalizedId = new Map(previousRows.filter(row => getId(row)).map(row => [normalize(getId(row)), row]));
  const ids = new Map(); const feeds = new Map();
  const catalogueIds = new Map();
  for (const row of rows) {
    const id = getId(row); const feed = getFeed(row);
    if (id) ids.set(normalize(id), [...(ids.get(normalize(id)) || []), id]);
    if (feed) feeds.set(feed.toLowerCase(), [...(feeds.get(feed.toLowerCase()) || []), id]);
    const catalogueId = String(row?.catalogue_id ?? "").trim();
    if (catalogueId) catalogueIds.set(catalogueId, [...(catalogueIds.get(catalogueId) || []), id]);
  }
  const ambiguousIds = new Set([...ids].filter(([, values]) => values.length !== 1).map(([key]) => key));
  const ambiguousFeeds = new Set([...feeds].filter(([, values]) => new Set(values).size > 1).map(([key]) => key));
  const ambiguousCatalogueIds = new Set([...catalogueIds].filter(([, values]) => values.length !== 1).map(([key]) => key));
  const eligible = rows.filter(row => getFeed(row) &&
    (!previousById.has(getId(row)) || getPrior(previousRows, row)?.episodeFeedVerification?.status === "review_required") &&
    !ambiguousIds.has(normalize(getId(row))) && !ambiguousFeeds.has(getFeed(row).toLowerCase()));
  let checked = 0;
  for (const row of rows) {
    const id = getId(row); const feed = getFeed(row);
    if (!feed) continue;
    const raw = feed;
    const podimoMatch = raw.match(/^https:\/\/open\.podimo\.com\/podcast\/([0-9a-f-]{36})$/iu);
    const isPodimoPublicCandidate = Boolean(podimoMatch);
    const previousIdentity = previousById.get(id);
    if (previousIdentity) {
      const prior = getPrior(previousRows, row)?.episodeFeedVerification;
      if (prior?.status === "verified" || prior?.reason === "feed_change_requires_code_approval") {
        row.episodeFeedVerification = prior;
        continue;
      }
      if (prior?.status === "review_required") {
        if (prior.retry_after && Date.now() < Date.parse(prior.retry_after)) {
          row.episodeFeedVerification = prior;
          continue;
        }
        if (!prior.retry_after && prior.reason !== "verification_budget_exceeded" &&
            !(isPodimoPublicCandidate && prior.reason === "special_source_requires_adapter")) {
          row.episodeFeedVerification = prior;
          continue;
        }
      } else if (getFeed(previousIdentity) !== feed) {
        row.episodeFeedVerification = {
        version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: "feed_change_requires_code_approval"
        };
        continue;
      } else {
        delete row.episodeFeedVerification;
        continue;
      }
    }
    const normalizedPreviousOwner = previousByNormalizedId.get(normalize(id));
    if (normalizedPreviousOwner && getId(normalizedPreviousOwner) !== id) {
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: "normalized_podcast_id_collision" };
      continue;
    }
    if (previousRows.some(old => getFeed(old).toLowerCase() === feed.toLowerCase() && getId(old) !== id)) {
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: "historically_owned_feed_url" };
      continue;
    }
    if (!id || ambiguousIds.has(normalize(id))) {
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: "catalogue_podcast_id_ambiguous" };
      continue;
    }
    if (ambiguousFeeds.has(feed.toLowerCase())) {
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: "feed_owned_by_multiple_catalogue_ids" };
      continue;
    }
    const catalogueId = String(row.catalogue_id ?? "").trim();
    if (!catalogueId || ambiguousCatalogueIds.has(catalogueId)) {
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: catalogueId, feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: "catalogue_id_missing_or_ambiguous" };
      continue;
    }
    const prior = getPrior(previousRows, row)?.episodeFeedVerification;
    if (prior?.status === "verified") { row.episodeFeedVerification = prior; continue; }
    if (prior?.retry_after && Date.now() < Date.parse(prior.retry_after)) { row.episodeFeedVerification = prior; continue; }
    let host = "";
    try { host = new URL(raw).hostname; } catch {}
    const specialHost = /(^|\.)(podimo\.com|apple\.com|spotify\.com)$|(^|\.)dr\.dk$/iu.test(host);
    if (!/^https:\/\//iu.test(raw) || !host || (specialHost && !isPodimoPublicCandidate)) {
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: specialHost
          ? "special_source_requires_adapter" : "https_required" };
      continue;
    }
    if (checked >= maxNewCandidates) {
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason: "verification_budget_exceeded" };
      continue;
    }
    checked += 1;
    try {
      if (isPodimoPublicCandidate) {
        const searchUrl = new URL("https://itunes.apple.com/search");
        searchUrl.searchParams.set("term", `${String(row.Titel ?? "")} ${String(row.Vært ?? "")}`);
        searchUrl.searchParams.set("media", "podcast"); searchUrl.searchParams.set("entity", "podcast");
        searchUrl.searchParams.set("country", "dk"); searchUrl.searchParams.set("limit", "20");
        const [pageHtml, searchText] = await Promise.all([fetchText(String(row.Link ?? "").trim()), fetchText(searchUrl.href)]);
        const searchPayload = JSON.parse(searchText);
        const apple = findExactApplePodcastMapping(searchPayload, row);
        const lookupUrl = new URL("https://itunes.apple.com/lookup");
        lookupUrl.searchParams.set("id", String(apple.collectionId)); lookupUrl.searchParams.set("entity", "podcast");
        const [lookupText, rssXml] = await Promise.all([fetchText(lookupUrl.href), fetchText(String(apple.feedUrl).trim())]);
        row.episodeFeedVerification = await verifyPodimoPublicRssEvidence(row, rssXml, pageHtml, searchPayload, JSON.parse(lookupText));
        const discoveredFeed = String(row.episodeFeedVerification.feed_url ?? "").toLowerCase();
        if (row.episodeFeedVerification.status === "verified" && previousRows.some(old =>
          getId(old) !== id && String(old?.episodeFeedVerification?.feed_url ?? "").toLowerCase() === discoveredFeed)) {
          row.episodeFeedVerification.status = "review_required";
          row.episodeFeedVerification.reason = "historically_owned_rss_feed_url";
        }
      } else {
        const [xml, html] = await Promise.all([fetchText(feed), fetchText(String(row.Link ?? "").trim())]);
        row.episodeFeedVerification = verifyRssEvidence(row, xml, html);
      }
      if (["dns_lookup_failed", "request_timeout", "network_unavailable"].includes(row.episodeFeedVerification.reason) ||
          /^http_status_5\d\d$/u.test(row.episodeFeedVerification.reason || "")) {
        row.episodeFeedVerification.retry_after = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      }
    } catch (error) {
      const rawReason = error instanceof Error ? error.message : "verification_failed";
      const reason = /timeout/iu.test(rawReason) ? "request_timeout" :
        /ECONNRESET|ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|EAI_AGAIN/iu.test(rawReason) ? "network_unavailable" :
          rawReason.slice(0, 120);
      row.episodeFeedVerification = { version: RSS_VERIFICATION_VERSION, status: "review_required", podcast_id: id,
        catalogue_id: String(row.catalogue_id ?? ""), feed_url: feed, official_url: String(row.Link ?? "").trim(),
        publisher: String(row.Udgiver ?? "").trim(), reason,
        ...(["dns_lookup_failed", "request_timeout", "network_unavailable"].includes(reason) || /^http_status_5\d\d$/u.test(reason)
          ? { retry_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() } : {}) };
    }
  }
  return { candidate, checked, candidate_count: eligible.length };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const candidatePath = process.argv[2];
  if (!candidatePath) throw new Error("Usage: node scripts/verify-rss-feed-catalogue.mjs <candidate.json> [previous.json]");
  const previousPath = process.argv[3] || "data/podcasts.json";
  const [candidateText, previousText] = await Promise.all([readFile(candidatePath, "utf8"), readFile(previousPath, "utf8")]);
  const candidate = JSON.parse(candidateText); const previous = JSON.parse(previousText);
  const result = await verifyCatalogueFeeds(candidate, previous);
  await writeFile(candidatePath, JSON.stringify(result.candidate), "utf8");
  const verified = (Array.isArray(candidate) ? candidate : candidate.rows).filter(row => row.episodeFeedVerification?.status === "verified").length;
  console.log(JSON.stringify({ checked: result.checked, verified, candidates: result.candidate_count }));
}
