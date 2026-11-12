import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";
import { extractDrArtworkId, inspectOriginalCoverFile, reviewReadiness, sharedArtworkIdentity } from "./instagram-editorial-review.mjs";

export const PLAN_SIZE = 15;
export const OWNER_TAKE_MAX_LENGTH = 240;
export const INSTAGRAM_ACCOUNT = "podcastlisten.dk";
export const PROFILE_ORIGIN = "https://podcastlisten.dk";
export const PLAN_STATUSES = Object.freeze({
  editorial: "awaiting-owner-take-and-approval",
  rights: "blocked-no-documented-reuse-right",
  liveHistory: "read-only-buffer-scan-required",
});

const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const clean = (value) => typeof value === "string" ? value.trim() : "";
const isX = (value) => clean(value).toLocaleLowerCase("da-DK") === "x";

export function parseEditorialScore(value) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const raw = String(value).trim();
  if (!/^(?:\d|10)(?:[,.]\d{1,2})?$/.test(raw)) return null;
  const score = Number(raw.replace(",", "."));
  return Number.isFinite(score) && score >= 0 && score <= 10 ? score : null;
}

export function normalizePublisherHashtag(value) {
  const normalized = clean(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
  if (!normalized) return "";
  const ascii = normalized.replace(/[^A-Za-z0-9]/g, "");
  return ascii ? `#${ascii.toLocaleLowerCase("en-US")}` : "";
}

export function buildSuggestedHashtags(title, publisher) {
  // Publisher spelling is not a verified social hashtag. In particular, never normalize
  // the visually ambiguous catalogue labels Radio llll / Radio IIII into a guessed tag.
  void publisher;
  const candidates = ["#podcastlisten", "#podcast", normalizePublisherHashtag(title)];
  return [...new Set(candidates.filter(Boolean))];
}

function urlIsHttps(value) {
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function verifiedOriginal(podcast, coverRecords, root) {
  const matches = (coverRecords ?? []).filter((cover) => cover.appPodcastKey === podcast["Podcast-ID"]);
  if (matches.length !== 1) return null;
  const cover = matches[0];
  if (cover.title !== podcast.Titel || cover.status !== "success" || cover.needsPlaceholder || cover.sourceAuditStatus !== "valid" ||
      !/^[a-f0-9]{64}$/i.test(cover.sourceChecksum ?? "") || cover.sourceChecksum !== cover.successfulSourceChecksum ||
      cover.original?.checksum !== cover.sourceChecksum || !/^[a-f0-9]{64}$/i.test(cover.variants?.["800"]?.checksum ?? "") ||
      !/^data\/covers\/original\/[\w.-]+\.(?:png|jpe?g|webp)$/i.test(cover.original?.path ?? "") ||
      !Number.isInteger(cover.original?.width) || !Number.isInteger(cover.original?.height) ||
      cover.original.width !== cover.original.height || cover.original.width < 600 || cover.original.height < 600) return null;
  return {
    sourcePath: cover.original.path,
    sourceChecksum: cover.sourceChecksum.toLowerCase(),
    sourceBytes: cover.original.bytes,
    width: cover.original.width,
    height: cover.original.height,
    format: cover.original.format,
    qualityCategory: cover.qualityCategory,
    approvalCoverChecksum: cover.variants["800"].checksum.toLowerCase(),
    sourceUrl: cover.originalImageUrl,
    localPath: path.join(root, cover.original.path),
  };
}

function uniqueIdentityRows(rows) {
  const counts = new Map();
  for (const row of rows ?? []) {
    const id = clean(row?.["Podcast-ID"]);
    if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export function isEligibleCatalogueRow(row) {
  if (!row || typeof row !== "object") return false;
  const id = clean(row["Podcast-ID"]);
  if (!id || !clean(row.Titel) || !clean(row.Udgiver) || !clean(row.Genre) || !clean(row["Kort beskrivelse"])) return false;
  if (isX(row.Uaktuel) || row.needs_editorial_review === true || row.needs_editorial_review === "true") return false;
  const score = parseEditorialScore(row["Vuring (1-10)"]);
  const pearl = isX(row["Undervurderet perle"]);
  if (score === null || !(score >= 7 || pearl)) return false;
  if (!urlIsHttps(row.Link) || !["free", "paid"].includes(clean(row.accessType))) return false;
  if (!urlIsHttps(row.accessEvidenceUrl) || !/^\d{4}-\d{2}-\d{2}$/.test(clean(row.accessCheckedAt))) return false;
  return true;
}

export function extractPodcastIdsFromBufferPosts(posts, podcasts) {
  const rowsByCanonicalUrl = new Map();
  for (const row of podcasts ?? []) {
    const id = clean(row?.["Podcast-ID"]);
    if (!id) continue;
    const slug = slugFromPodcastId(id);
    if (!slug) continue;
    const url = `${PROFILE_ORIGIN}/podcast/${slug}/`;
    const list = rowsByCanonicalUrl.get(url) ?? [];
    list.push(id);
    rowsByCanonicalUrl.set(url, list);
  }
  const matchedIds = new Set();
  for (const post of posts ?? []) {
    if (typeof post?.text !== "string") continue;
    const urls = post.text.match(/https:\/\/podcastlisten\.dk\/podcast\/[^\s)<>"']+\/?/giu) ?? [];
    for (const rawUrl of urls) {
      let canonical;
      try {
        const parsed = new URL(rawUrl);
        if (parsed.hostname.toLowerCase() !== "podcastlisten.dk" || parsed.protocol !== "https:") continue;
        parsed.search = "";
        parsed.hash = "";
        parsed.pathname = `${parsed.pathname.replace(/\/+$/, "")}/`;
        canonical = parsed.href;
      } catch { continue; }
      const matches = rowsByCanonicalUrl.get(canonical) ?? [];
      if (matches.length > 1) throw new Error(`Buffer canonical URL maps to multiple Podcast-IDs: ${canonical}`);
      if (matches.length === 1) matchedIds.add(matches[0]);
    }
  }
  return matchedIds;
}

export function nextSuggestedDays(today = new Date(), count = PLAN_SIZE) {
  if (!(today instanceof Date) || !Number.isFinite(today.getTime())) throw new Error("A valid plan generation date is required");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(today).reduce((result, part) => ({ ...result, [part.type]: part.value }), {});
  const cursor = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  cursor.setUTCDate(cursor.getUTCDate() + 1);
  while (cursor.getUTCDay() !== 1) cursor.setUTCDate(cursor.getUTCDate() + 1);
  const dates = [];
  while (dates.length < count) {
    const day = cursor.getUTCDay();
    if (day === 1 || day === 3 || day === 5) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + (day === 5 ? 3 : 2));
  }
  return dates;
}

function makeCaptionFields(row, profileUrl, hashtags, research = {}, publisherProfile = null) {
  const factLines = clean(row["Kort beskrivelse"]);
  const verifiedTarget = String(research.linkStatus ?? "").startsWith("verified-") && urlIsHttps(research.finalUrl)
    ? research.finalUrl : clean(row.Link);
  return {
    factualLines: factLines,
    ownerTake: "",
    score: `${String(row["Vuring (1-10)"]).trim()}/10`,
    publisher: clean(row.Udgiver),
    publisherMentions: publisherProfile?.status === "verified-official-site-link" ? [publisherProfile.handle] : [],
    publisherMentionEvidence: publisherProfile?.status === "verified-official-site-link"
      ? [{ handle: publisherProfile.handle, evidenceUrl: publisherProfile.evidenceUrl, checkedAt: publisherProfile.checkedAt }] : [],
    publisherHandleStatus: publisherProfile?.status ?? "no-exact-official-handle-verified",
    publisherHashtagStatus: "not-verified-and-omitted",
    mainSeries: clean(row.Hovedserie),
    accessType: ["verified-free", "verified-paid"].includes(research.accessStatus)
      ? research.accessStatus.slice("verified-".length) : "",
    accessEvidenceUrl: row.accessEvidenceUrl,
    targetLinkCandidate: verifiedTarget,
    targetLinkEvidenceUrl: "",
    targetLinkVerifiedBy: "",
    targetLinkVerifiedAt: "",
    targetLinkStatus: "needs-owner-verification-as-first-full-episode-or-series",
    targetLinkResearchStatus: research.linkStatus ?? "no-current-link-review",
    targetLinkResearchEvidenceUrl: research.finalUrl || research.sourceUrl || "",
    targetLinkResearchCheckedAt: research.checkedAt ?? "",
    targetLinkHttpStatus: research.httpStatus ?? null,
    canonicalProfileUrl: profileUrl,
    hashtags,
  };
}

export function composeCaption(slot) {
  const caption = [
    clean(slot.caption?.factualLines),
    clean(slot.caption?.ownerTake) || "[PERSONLIGT TAKE SKAL INDSÆTTES AF EJEREN]",
    `Podcastlistens vurdering: ${clean(slot.caption?.score)}`,
    `Udgiver: ${clean(slot.caption?.publisher)}`,
    slot.caption?.mainSeries ? `Hovedserie: ${clean(slot.caption.mainSeries)}` : "",
    slot.caption?.accessType === "paid" ? "Adgang: Betalt" : slot.caption?.accessType === "free" ? "Adgang: Gratis" : "",
    ...(slot.caption?.publisherMentions ?? []),
    clean(slot.caption?.targetLinkCandidate) ? `Lyt/læs: ${clean(slot.caption.targetLinkCandidate)}` : "",
    clean(slot.caption?.canonicalProfileUrl) ? `Podcastlisten: ${clean(slot.caption.canonicalProfileUrl)}` : "",
    (slot.caption?.hashtags ?? []).join(" "),
  ].filter(Boolean);
  return caption.join("\n\n");
}

export function coverPlacementFingerprint(placement) {
  if (!placement || typeof placement !== "object") return null;
  const binding = {
    podcastId: placement.podcastId,
    sourceChecksum: placement.sourceChecksum,
    approved: placement.approved,
    approvedBy: placement.approvedBy,
    approvedAt: placement.approvedAt,
    contrastMode: placement.contrastMode,
    x: placement.x,
    y: placement.y,
    notes: placement.notes,
  };
  return sha256(JSON.stringify(binding));
}

function rightsStatus(podcastId, cover, approvals) {
  const matching = (approvals?.approvals ?? []).filter((entry) => entry?.podcastId === podcastId);
  if (matching.length !== 1) return PLAN_STATUSES.rights;
  const entry = matching[0];
  if (entry.status !== "approved" || !entry.approvedBy || !entry.approvedAt || !urlIsHttps(entry.evidenceUrl) ||
      entry.coverChecksum !== cover.approvalCoverChecksum) return PLAN_STATUSES.rights;
  return "documented-cover-right-present";
}

export async function verifyOriginalCoverFiles({ podcasts, coverManifest, root = process.cwd() } = {}) {
  const counts = uniqueIdentityRows(podcasts);
  const verifiedIds = new Set();
  for (const row of podcasts ?? []) {
    const id = clean(row?.["Podcast-ID"]);
    if (!id || counts.get(id) !== 1) continue;
    const cover = verifiedOriginal(row, coverManifest?.podcasts, root);
    if (!cover) continue;
    try {
      if (inspectOriginalCoverFile(root, cover).verified) verifiedIds.add(id);
    } catch { /* Missing originals remain ineligible; never substitute another image. */ }
  }
  return verifiedIds;
}

export function buildEditorialPlan({ podcasts, coverManifest, rights, research, verifiedCoverIds = new Set(), publishedPodcastIds = [], bufferScan, today = new Date(), root = process.cwd() } = {}) {
  if (!Array.isArray(podcasts) || !Array.isArray(coverManifest?.podcasts)) throw new Error("Catalogue and cover manifest are required");
  if (!bufferScan?.complete || bufferScan.account !== `@${INSTAGRAM_ACCOUNT}` || !bufferScan.scannedAt || !Number.isInteger(bufferScan.postCount)) {
    throw new Error("A completed read-only Buffer history scan for @podcastlisten.dk is required to prepare candidates");
  }
  const counts = uniqueIdentityRows(podcasts);
  const slugCounts = new Map();
  for (const row of podcasts) {
    const id = clean(row?.["Podcast-ID"]);
    if (!id || counts.get(id) !== 1) continue;
    const slug = slugFromPodcastId(id);
    if (slug) slugCounts.set(slug, (slugCounts.get(slug) ?? 0) + 1);
  }
  const seen = new Set(publishedPodcastIds);
  const posts = bufferScan.posts;
  if (!Array.isArray(posts) || bufferScan.postCount !== posts.length) throw new Error("A complete Buffer post history is required");
  for (const id of extractPodcastIdsFromBufferPosts(posts, podcasts)) seen.add(id);

  const options = [];
  const excluded = { duplicateIdentity: 0, alreadyInBufferOrHistory: 0, invalidCatalogue: 0, missingVerifiedOriginal: 0 };
  for (const row of podcasts) {
    const id = clean(row?.["Podcast-ID"]);
    if (!id || !isEligibleCatalogueRow(row)) { excluded.invalidCatalogue += 1; continue; }
    if (counts.get(id) !== 1) { excluded.duplicateIdentity += 1; continue; }
    if (seen.has(id)) { excluded.alreadyInBufferOrHistory += 1; continue; }
    const cover = verifiedOriginal(row, coverManifest.podcasts, root);
    if (!cover || !verifiedCoverIds.has(id)) { excluded.missingVerifiedOriginal += 1; continue; }
    const score = parseEditorialScore(row["Vuring (1-10)"]);
    const pearl = isX(row["Undervurderet perle"]);
    const slug = slugFromPodcastId(id);
    if (!slug || slugCounts.get(slug) !== 1) { excluded.duplicateIdentity += 1; continue; }
    const profileUrl = `${PROFILE_ORIGIN}/podcast/${slug}/`;
    const hashtags = buildSuggestedHashtags(row.Titel, row.Udgiver);
    const sourceChecksums = {
      cover: cover.sourceChecksum,
      catalogueIdentity: sha256(JSON.stringify({ id, title: row.Titel, publisher: row.Udgiver, genre: row.Genre })),
    };
    const postResearch = (research?.posts ?? []).filter((entry) => entry?.podcastId === id);
    if (postResearch.length > 1) throw new Error(`Instagram research evidence must be unique for exact Podcast-ID ${id}`);
    const publisherMatches = (research?.publisherProfiles ?? []).filter((entry) => entry?.publisher === row.Udgiver &&
      entry?.status === "verified-official-site-link" && /^@[A-Za-z0-9._]+$/.test(entry.handle ?? "") && urlIsHttps(entry.evidenceUrl));
    if (publisherMatches.length > 1) throw new Error(`Instagram publisher evidence is ambiguous for exact publisher ${row.Udgiver}`);
    const caption = makeCaptionFields(row, profileUrl, hashtags, postResearch[0] ?? {}, publisherMatches[0] ?? null);
    const fileVerification = inspectOriginalCoverFile(root, cover);
    const artworkIdentity = sharedArtworkIdentity(cover, coverManifest);
    const artworkResearchMatches = (research?.sharedArtworkReviews ?? []).filter((entry) =>
      String(entry?.sourceChecksum ?? "").toLowerCase() === cover.sourceChecksum);
    if (artworkResearchMatches.length > 1) throw new Error(`Shared artwork research must be unique for exact source checksum ${cover.sourceChecksum}`);
    const artworkEvidence = artworkResearchMatches[0] ?? null;
    const artworkEvidenceMatches = artworkEvidence?.sourceImageId === extractDrArtworkId(cover.sourceUrl) &&
      artworkEvidence?.sourceUrl === cover.sourceUrl && artworkEvidence?.manifestDistinctPodcastIdCount === artworkIdentity.podcastIds.length;
    const sharedArtworkReview = artworkIdentity.shared ? {
      required: true,
      status: "shared-source-checksum-needs-exact-artwork-review",
      sourceChecksum: cover.sourceChecksum,
      distinctPodcastIdCount: artworkIdentity.podcastIds.length,
      artworkId: extractDrArtworkId(cover.sourceUrl),
      evidence: artworkEvidence ? { ...artworkEvidence, verifiedAgainstCurrentManifest: artworkEvidenceMatches,
        status: artworkEvidenceMatches ? artworkEvidence.status : "stale-research-or-manifest-mismatch-review-required" } : null,
      identityReview: null,
      uniqueSubseriesArtworkVerified: false,
    } : { required: false, status: "no-shared-source-checksum-detected", sourceChecksum: cover.sourceChecksum,
      distinctPodcastIdCount: 1, artworkId: extractDrArtworkId(cover.sourceUrl), uniqueSubseriesArtworkVerified: false };
    const slot = {
      position: 0,
      suggestedDate: "",
      dateIsSuggestionOnly: true,
      podcastId: id,
      title: clean(row.Titel),
      score: { source: "Vuring (1-10)", value: score, display: String(row["Vuring (1-10)"]).trim() },
      underratedPearl: pearl,
      publisher: clean(row.Udgiver),
      genre: clean(row.Genre),
      mainSeries: clean(row.Hovedserie),
      sourceDescription: clean(row["Kort beskrivelse"]),
      catalogueLink: clean(row.Link),
      access: { type: row.accessType, evidenceUrl: row.accessEvidenceUrl, checkedAt: row.accessCheckedAt },
      currentAccessReview: postResearch[0] ? {
        status: postResearch[0].accessStatus,
        evidenceUrl: postResearch[0].accessEvidenceUrl,
        checkedAt: postResearch[0].checkedAt,
        sourceHttpStatus: postResearch[0].httpStatus,
      } : { status: "no-current-source-review", evidenceUrl: "", checkedAt: "", sourceHttpStatus: null },
      canonicalProfileUrl: profileUrl,
      factualSources: { source: "catalogue-master", fields: ["Titel", "Udgiver", "Genre", "Kort beskrivelse", "Hovedserie"] },
      cover: {
        sourcePath: cover.sourcePath,
        sourceUrl: cover.sourceUrl,
        sourceChecksum: cover.sourceChecksum,
        sharedArtwork: sharedArtworkReview,
        sourceBytes: cover.sourceBytes,
        width: cover.width,
        height: cover.height,
        format: cover.format,
        qualityCategory: cover.qualityCategory,
        qualityStatus: ["A", "B"].includes(cover.qualityCategory) ? "manifest-quality-checked" : "manual-quality-review-required",
        fileVerification,
        qualityReview: { podcastId: id, sourceChecksum: cover.sourceChecksum, approved: false, approvedBy: "", approvedAt: "", notes: "" },
        rightsStatus: rightsStatus(id, cover, rights),
        previewPath: null,
        outputChecksum: null,
        placement: null,
        approvedForPost: false,
      },
      caption,
      captionDraft: composeCaption({ caption }),
      approval: {
        approved: false,
        approvedBy: "",
        approvedAt: "",
        captionSha256: null,
        placementSha256: null,
        coverSourceChecksum: null,
        coverOutputChecksum: null,
      },
      publicationHistory: { scanId: bufferScan.scanId ?? null, checkedAt: bufferScan.scannedAt, verifiedAgainstBuffer: true },
      readiness: {
        status: PLAN_STATUSES.editorial,
        missing: [
          "ownerTake",
          ...(caption.publisherMentions.length ? [] : ["verifiedPublisherInstagramMentions-or-documented-none"]),
          "firstFullEpisodeOrSeriesLinkVerification",
          "coverRightsApproval",
          "manualOverlayPlacementAndContrastApproval",
          ...(cover.qualityCategory && !["A", "B"].includes(cover.qualityCategory) ? ["manualImageQualityApproval"] : []),
          "coverImageApproval",
          "captionApproval",
          "publicationPreflightBeforeAnyBufferMutation",
        ],
      },
    };
    slot.reviewStatus = reviewReadiness(slot, today);
    options.push(slot);
  }

  options.sort((a, b) => Number(b.underratedPearl && b.score.value < 7) - Number(a.underratedPearl && a.score.value < 7) ||
    b.score.value - a.score.value || a.podcastId.localeCompare(b.podcastId, "da"));
  const selected = options.slice(0, PLAN_SIZE);
  if (selected.length !== PLAN_SIZE) throw new Error(`Only ${selected.length} safe, unique, unpublished catalogue candidates have a verifiable original cover; 15 are required`);
  const dates = nextSuggestedDays(today, PLAN_SIZE);
  selected.forEach((slot, index) => { slot.position = index + 1; slot.suggestedDate = dates[index]; });
  const usedIds = new Set();
  for (const slot of selected) {
    if (usedIds.has(slot.podcastId)) throw new Error(`Duplicate Podcast-ID ${slot.podcastId} in prepared plan`);
    usedIds.add(slot.podcastId);
  }
  return {
    schemaVersion: 1,
    planId: `instagram-editorial-${today.toISOString().slice(0, 10)}-${bufferScan.scanId ?? "buffer-scan"}`,
    generatedAt: today.toISOString(),
    account: `@${INSTAGRAM_ACCOUNT}`,
    cadence: { weekdays: ["Monday", "Wednesday", "Friday"], weeks: 5, dateMeaning: "suggestion-only; no Buffer schedule is created" },
    selection: { sourceField: "Vuring (1-10)", minimumScore: 7, includeUnderratedPearlFlag: "x", featuredReviewsRequired: false },
    bufferHistory: { scanId: bufferScan.scanId ?? null, scannedAt: bufferScan.scannedAt, complete: true, postCount: posts.length,
      excludedPodcastIds: [...extractPodcastIdsFromBufferPosts(posts, podcasts)].sort((a, b) => a.localeCompare(b, "da")),
      historicalUsedIds: [...publishedPodcastIds].sort((a, b) => a.localeCompare(b, "da")) },
    rights: { approvalCount: rights?.approvals?.length ?? 0, missingRightsBlockPosting: true, automaticGenreFallback: false },
    sharedArtworkGroups: [...new Map(selected.filter((slot) => slot.cover.sharedArtwork.required)
      .map((slot) => [slot.cover.sourceChecksum, {
        ...slot.cover.sharedArtwork,
        podcastIds: sharedArtworkIdentity(slot.cover, coverManifest).podcastIds,
        selectedPodcastIds: selected.filter((candidate) => candidate.cover.sourceChecksum === slot.cover.sourceChecksum).map((candidate) => candidate.podcastId),
      }])).values()],
    excluded,
    posts: selected,
    safety: { bufferMutations: 0, workflowMode: "read-only-plan", queueEnabled: false, schedulingEnabled: false, publicationEnabled: false },
  };
}

export function validateOwnerApproval(slot, context = {}) {
  if (!slot || !clean(slot.podcastId)) return { approved: false, errors: ["Exact Podcast-ID is required"] };
  const errors = [];
  const take = clean(slot.caption?.ownerTake);
  if (take.length < 10 || take.length > OWNER_TAKE_MAX_LENGTH) errors.push("Owner personal take must be 10–240 characters");
  const captionText = composeCaption(slot);
  const captionHash = sha256(captionText);
  if (slot.captionDraft !== captionText) errors.push("Caption preview differs from the approved caption fields");
  if (slot.approval?.approved !== true || !clean(slot.approval.approvedBy) || !clean(slot.approval.approvedAt)) errors.push("Owner approval is missing");
  if (slot.approval?.captionSha256 !== captionHash) errors.push("Caption changed since its approval");
  if (slot.approval?.coverSourceChecksum !== slot.cover?.sourceChecksum) errors.push("Cover source checksum changed since approval");
  if (!slot.cover?.placement || slot.cover.placement.podcastId !== slot.podcastId || slot.cover.placement.sourceChecksum !== slot.cover.sourceChecksum ||
      slot.cover.placement.approved !== true || !clean(slot.cover.placement.approvedBy) || !clean(slot.cover.placement.contrastMode) || !clean(slot.cover.placement.notes)) {
    errors.push("Manual overlay placement is not approved for this exact Podcast-ID and source checksum");
  }
  const placementHash = coverPlacementFingerprint(slot.cover?.placement);
  if (slot.approval?.placementSha256 !== placementHash) errors.push("Manual overlay placement changed since owner approval");
  if (slot.cover?.rightsStatus !== "documented-cover-right-present") errors.push("Documented cover reuse rights are missing");
  if (!Array.isArray(context.coverManifest?.podcasts)) errors.push("Complete cover manifest context is required to validate shared artwork identity");
  else {
    const shared = sharedArtworkIdentity({ sourceChecksum: slot.cover?.sourceChecksum }, context.coverManifest).shared;
    const exactReview = slot.cover?.sharedArtwork?.identityReview;
    if (shared && (slot.cover?.sharedArtwork?.required !== true || slot.cover.sharedArtwork.uniqueSubseriesArtworkVerified !== true ||
        slot.cover.sharedArtwork.status !== "owner-verified-exact-artwork" || slot.cover.sharedArtwork.podcastId !== slot.podcastId ||
        slot.cover.sharedArtwork.sourceChecksum !== slot.cover.sourceChecksum || !urlIsHttps(slot.cover.sharedArtwork.evidenceUrl) ||
        !clean(slot.cover.sharedArtwork.reviewedBy) || !clean(slot.cover.sharedArtwork.reviewedAt) ||
        exactReview?.podcastId !== slot.podcastId || exactReview?.title !== slot.title || exactReview?.publisher !== slot.publisher ||
        exactReview?.mainSeries !== slot.mainSeries || exactReview?.sourceChecksum !== slot.cover.sourceChecksum ||
        exactReview?.artworkId !== slot.cover.sharedArtwork.artworkId || !urlIsHttps(exactReview?.episodeUrl) ||
        exactReview?.evidenceUrl !== slot.cover.sharedArtwork.evidenceUrl || exactReview?.reviewedBy !== slot.cover.sharedArtwork.reviewedBy ||
        exactReview?.reviewedAt !== slot.cover.sharedArtwork.reviewedAt)) {
      errors.push("Shared cover checksum needs exact Podcast-ID, artwork, and subseries review before approval");
    }
    if (!shared && slot.cover?.sharedArtwork?.required === true) errors.push("Shared-cover review marker does not match the complete exact-checksum manifest scan");
  }
  if (!Array.isArray(context.research?.publisherProfiles)) errors.push("Current exact-publisher research context is required to validate Instagram mentions");
  else {
    const publisherProfiles = context.research.publisherProfiles.filter((entry) => entry?.publisher === slot.caption?.publisher &&
      entry?.status === "verified-official-site-link" && /^@[A-Za-z0-9._]+$/.test(entry.handle ?? "") && urlIsHttps(entry.evidenceUrl));
    const mentions = Array.isArray(slot.caption?.publisherMentions) ? slot.caption.publisherMentions : [];
    const evidence = Array.isArray(slot.caption?.publisherMentionEvidence) ? slot.caption.publisherMentionEvidence : [];
    if (publisherProfiles.length > 1 || (publisherProfiles.length === 0 && mentions.length > 0) ||
        (publisherProfiles.length === 1 && (mentions.length !== 1 || mentions[0] !== publisherProfiles[0].handle || evidence.length !== 1 ||
          evidence[0]?.handle !== publisherProfiles[0].handle || evidence[0]?.evidenceUrl !== publisherProfiles[0].evidenceUrl))) {
      errors.push("Publisher Instagram mention is missing, ambiguous, or not tied to the exact official publisher source");
    }
  }
  if (!["A", "B"].includes(slot.cover?.qualityCategory) &&
      (slot.cover?.qualityReview?.approved !== true || slot.cover.qualityReview.podcastId !== slot.podcastId ||
        slot.cover.qualityReview.sourceChecksum !== slot.cover.sourceChecksum || !clean(slot.cover.qualityReview.approvedBy) ||
        !clean(slot.cover.qualityReview.approvedAt) || !clean(slot.cover.qualityReview.notes))) {
    errors.push("Manual image-quality approval is missing or does not match the exact source");
  }
  if (slot.cover?.approvedForPost !== true || !/^[a-f0-9]{64}$/i.test(slot.cover?.outputChecksum ?? "") ||
      slot.approval?.coverOutputChecksum !== slot.cover?.outputChecksum) errors.push("Cover image approval or output checksum is missing or stale");
  if (slot.caption?.targetLinkStatus !== "owner-verified-first-full-episode-or-series" || !urlIsHttps(slot.caption?.targetLinkCandidate) ||
      !urlIsHttps(slot.caption?.targetLinkEvidenceUrl) || !clean(slot.caption?.targetLinkVerifiedBy) || !clean(slot.caption?.targetLinkVerifiedAt)) {
    errors.push("First full episode or series link is not verified with owner evidence");
  }
  if (!slot.publicationHistory?.verifiedAgainstBuffer || !slot.publicationHistory?.checkedAt) errors.push("Buffer publication history has not been verified");
  return { approved: errors.length === 0, errors, captionSha256: captionHash, placementSha256: placementHash,
    coverSourceChecksum: slot.cover?.sourceChecksum ?? null, coverOutputChecksum: slot.cover?.outputChecksum ?? null };
}

export async function loadEditorialInputs(root) {
  const read = async (name) => JSON.parse(await readFile(path.join(root, name), "utf8"));
  const [catalog, covers, rights, episodes, groups, research] = await Promise.all([
    read("data/podcasts.json"), read("data/podcast-cover-manifest.json"), read("config/instagram-cover-rights.json"),
    read("data/podcast-episodes.json"), read("data/podcast-display-groups.json"), read("data/instagram-editorial-review-research.json"),
  ]);
  const podcasts = catalog.rows;
  const verifiedCoverIds = await verifyOriginalCoverFiles({ podcasts, coverManifest: covers, root });
  return { podcasts, coverManifest: covers, rights, episodes, groups, research, verifiedCoverIds };
}

export function serializeReviewCsv(plan) {
  const columns = [
    "position", "suggestedDate", "podcastId", "title", "score", "underratedPearl", "publisher", "genre", "mainSeries",
    "sourceDescription", "ownerTake", "publisherInstagramMentions", "publisherMentionEvidenceJson", "targetLinkCandidate",
    "targetLinkEvidenceUrl", "targetLinkVerifiedBy", "targetLinkVerifiedAt", "captionDraft (read-only preview)",
    "targetLinkStatus", "linkResearchStatus", "linkResearchEvidenceUrl", "linkResearchCheckedAt", "linkHttpStatus",
    "accessType", "accessEvidenceUrl", "accessCheckedAt", "currentAccessStatus", "currentAccessEvidenceUrl", "currentAccessCheckedAt", "accessFreshness", "canonicalProfileUrl", "hashtags",
    "verifiedPublisherMentions", "coverSourcePath", "coverSourceUrl", "coverArtworkId", "coverSourceChecksum",
    "sharedChecksumPodcastIds", "sharedCoverReview", "coverExpectedBytes", "coverExpectedDimensions", "coverExpectedFormat",
    "coverMeasuredSha256", "coverMeasuredBytes", "coverMeasuredFormat", "coverMeasuredDimensions", "imageQualityStatus",
    "coverRightsStatus", "ownerTakeStatus", "approvalStatus", "overlayPlacement (manual)", "captionSha256", "approvedBy", "approvedAt", "approved",
  ];
  const csvCell = (value) => {
    let text = String(value ?? "");
    if (/^\s*[=+@-]/u.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [columns.map(csvCell).join(",")];
  for (const slot of plan.posts) {
    const values = [slot.position, slot.suggestedDate, slot.podcastId, slot.title, slot.score.display, slot.underratedPearl ? "x" : "",
      slot.publisher, slot.genre, slot.mainSeries, slot.caption.factualLines, slot.caption.ownerTake, slot.caption.publisherMentions.join("; "),
      JSON.stringify(slot.caption.publisherMentionEvidence), slot.caption.targetLinkCandidate, slot.caption.targetLinkEvidenceUrl,
      slot.caption.targetLinkVerifiedBy, slot.caption.targetLinkVerifiedAt, slot.captionDraft, slot.caption.targetLinkStatus,
      slot.caption.targetLinkResearchStatus, slot.caption.targetLinkResearchEvidenceUrl, slot.caption.targetLinkResearchCheckedAt,
      slot.caption.targetLinkHttpStatus, slot.access.type, slot.access.evidenceUrl, slot.access.checkedAt,
      slot.currentAccessReview.status, slot.currentAccessReview.evidenceUrl, slot.currentAccessReview.checkedAt, slot.reviewStatus.access,
      slot.canonicalProfileUrl, slot.caption.hashtags.join(" "), slot.caption.publisherMentions.join("; "),
      slot.cover.sourcePath, slot.cover.sourceUrl, slot.cover.sharedArtwork?.artworkId ?? "", slot.cover.sourceChecksum,
      slot.cover.sharedArtwork?.required
        ? (plan.sharedArtworkGroups.find((group) => group.sourceChecksum === slot.cover.sourceChecksum)?.podcastIds ?? []).join("; ") : "",
      slot.cover.sharedArtwork?.required ? "manual-shared-artwork-review-required" : "no-shared-checksum-detected",
      slot.cover.sourceBytes, `${slot.cover.width}x${slot.cover.height}`, slot.cover.format,
      slot.cover.fileVerification?.sourceChecksum ?? "", slot.cover.fileVerification?.bytes ?? "",
      slot.cover.fileVerification?.format ?? "", `${slot.cover.fileVerification?.width ?? ""}x${slot.cover.fileVerification?.height ?? ""}`,
      slot.reviewStatus.imageQuality, slot.cover.rightsStatus, slot.reviewStatus.personalTake, slot.reviewStatus.approval,
      "", "", "", "", "false"];
    lines.push(values.map(csvCell).join(","));
  }
  return `${lines.join("\r\n")}\r\n`;
}

export function parseReviewCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted && character === '"' && csv[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (character === '"') { quoted = !quoted; continue; }
    if (!quoted && character === ",") { row.push(cell); cell = ""; continue; }
    if (!quoted && (character === "\n" || character === "\r")) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(cell); rows.push(row); row = []; cell = ""; continue;
    }
    cell += character;
  }
  if (quoted) throw new Error("Review CSV has an unterminated quoted cell");
  if (cell || row.length) { row.push(cell); rows.push(row); }
  if (rows.length < 2) throw new Error("Review CSV must contain a header and 15 review rows");
  const headers = rows[0];
  if (new Set(headers).size !== headers.length || !headers.includes("podcastId")) throw new Error("Review CSV header is missing podcastId or contains duplicates");
  if (rows.slice(1).some((values) => values.length !== headers.length)) throw new Error("Review CSV rows do not match the exact header width");
  return rows.slice(1).filter((values) => values.some((value) => value.trim())).map((values) =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function applyReviewCsv(plan, csv) {
  const rows = parseReviewCsv(csv);
  if (rows.length !== PLAN_SIZE || plan.posts.length !== PLAN_SIZE) throw new Error("Review CSV and plan must each contain exactly 15 slots");
  const csvById = new Map();
  for (const row of rows) {
    const id = clean(row.podcastId);
    if (!id || csvById.has(id)) throw new Error("Review CSV Podcast-IDs must be exact and unique");
    csvById.set(id, row);
  }
  const planIds = new Set(plan.posts.map((slot) => slot.podcastId));
  if (csvById.size !== planIds.size || [...planIds].some((id) => !csvById.has(id))) throw new Error("Review CSV Podcast-IDs do not exactly match the plan slots");
  const updated = structuredClone(plan);
  for (const slot of updated.posts) {
    const row = csvById.get(slot.podcastId);
    const decode = (value) => String(value ?? "").replace(/^'(?=\s*[=+@-])/u, "");
    const ownerTake = clean(decode(row.ownerTake));
    if (ownerTake.length > OWNER_TAKE_MAX_LENGTH) throw new Error(`Owner take exceeds ${OWNER_TAKE_MAX_LENGTH} characters for ${slot.podcastId}`);
    const mentions = clean(decode(row.publisherInstagramMentions)).split(/[;,\s]+/).filter(Boolean);
    let evidence = [];
    try { evidence = row.publisherMentionEvidenceJson ? JSON.parse(row.publisherMentionEvidenceJson) : []; }
    catch { throw new Error(`Invalid publisherMentionEvidenceJson for ${slot.podcastId}`); }
    if (!Array.isArray(evidence)) throw new Error(`Publisher mention evidence must be an array for ${slot.podcastId}`);
    slot.caption.ownerTake = ownerTake;
    slot.caption.publisherMentions = mentions;
    slot.caption.publisherMentionEvidence = evidence;
    slot.caption.targetLinkCandidate = clean(row.targetLinkCandidate);
    slot.caption.targetLinkEvidenceUrl = clean(row.targetLinkEvidenceUrl);
    slot.caption.targetLinkVerifiedBy = clean(row.targetLinkVerifiedBy);
    slot.caption.targetLinkVerifiedAt = clean(row.targetLinkVerifiedAt);
    slot.caption.targetLinkStatus = clean(row.targetLinkStatus) || "needs-owner-verification-as-first-full-episode-or-series";
    slot.captionDraft = composeCaption(slot);
    slot.reviewStatus = reviewReadiness(slot, new Date());
  }
  return updated;
}

export function validateEditorialPlan(plan, context = {}) {
  const errors = [];
  if (plan?.schemaVersion !== 1 || !Array.isArray(plan.posts) || plan.posts.length !== PLAN_SIZE) {
    return { ready: false, errors: ["Plan must contain exactly 15 version-1 post slots"], slots: [] };
  }
  if (plan.account !== `@${INSTAGRAM_ACCOUNT}` || plan.bufferHistory?.complete !== true ||
      !Number.isInteger(plan.bufferHistory?.postCount) || plan.bufferHistory.postCount < 0 ||
      !clean(plan.bufferHistory?.scanId)) {
    errors.push("Plan is not bound to a complete Buffer history scan for the exact Instagram account");
  }
  const ids = plan.posts.map((slot) => clean(slot?.podcastId));
  if (ids.some((id) => !id) || new Set(ids).size !== PLAN_SIZE) errors.push("All 15 slots need distinct exact Podcast-IDs");
  if (plan.safety?.bufferMutations !== 0 || plan.safety?.publicationEnabled !== false || plan.safety?.schedulingEnabled !== false) {
    errors.push("Editorial planning must remain read-only and unscheduled");
  }
  const slots = plan.posts.map((slot) => {
    const slotErrors = [];
    if (Array.isArray(context.podcasts)) {
      const matches = context.podcasts.filter((row) => clean(row?.["Podcast-ID"]) === slot.podcastId);
      if (matches.length !== 1) slotErrors.push("Podcast-ID no longer resolves to exactly one catalogue row");
      else {
        const row = matches[0];
        const canonical = `${PROFILE_ORIGIN}/podcast/${slugFromPodcastId(slot.podcastId)}/`;
        if (!isEligibleCatalogueRow(row) || slot.title !== row.Titel || slot.publisher !== row.Udgiver || slot.genre !== row.Genre ||
            slot.mainSeries !== clean(row.Hovedserie) || slot.sourceDescription !== clean(row["Kort beskrivelse"]) ||
            slot.score?.source !== "Vuring (1-10)" || slot.score?.value !== parseEditorialScore(row["Vuring (1-10)"]) ||
            slot.score?.display !== String(row["Vuring (1-10)"]).trim() || slot.underratedPearl !== isX(row["Undervurderet perle"]) ||
            slot.caption?.publisher !== row.Udgiver || slot.caption?.mainSeries !== clean(row.Hovedserie) ||
            slot.caption?.accessType !== "" || slot.caption?.accessEvidenceUrl !== row.accessEvidenceUrl ||
            slot.caption?.canonicalProfileUrl !== canonical || slot.canonicalProfileUrl !== canonical) {
          slotErrors.push("Catalogue identity, score, series, access metadata or canonical URL changed");
        }
        const requiredTags = buildSuggestedHashtags(row.Titel, row.Udgiver);
        if (requiredTags.some((tag) => !slot.caption?.hashtags?.includes(tag))) slotErrors.push("Required Podcastlisten and exact-title hashtags are missing");
        const researchMatches = (context.research?.posts ?? []).filter((entry) => entry?.podcastId === slot.podcastId);
        const expectedTargetLink = researchMatches.length === 1 && String(researchMatches[0].linkStatus ?? "").startsWith("verified-") &&
          urlIsHttps(researchMatches[0].finalUrl) ? researchMatches[0].finalUrl : clean(row.Link);
        if (slot.caption?.targetLinkCandidate !== expectedTargetLink) slotErrors.push("Candidate listening link differs from exact-ID current source review");
        const coverMatches = (context.coverManifest?.podcasts ?? []).filter((cover) => cover.appPodcastKey === slot.podcastId && cover.title === row.Titel);
        if (coverMatches.length !== 1 || coverMatches[0].sourceChecksum !== slot.cover?.sourceChecksum ||
            coverMatches[0].original?.checksum !== slot.cover?.sourceChecksum) slotErrors.push("Original cover identity or source checksum changed");
        if (context.verifiedCoverIds instanceof Set && !context.verifiedCoverIds.has(slot.podcastId)) slotErrors.push("Original cover file no longer matches its manifest checksum");
        const currentRights = coverMatches.length === 1 ? rightsStatus(slot.podcastId, {
          approvalCoverChecksum: coverMatches[0].variants?.["800"]?.checksum,
        }, context.rights) : PLAN_STATUSES.rights;
        if (currentRights !== slot.cover?.rightsStatus) slotErrors.push("Cover-rights status changed; review and reapprove");
      }
    }
    const checkedAt = Date.parse(plan.bufferHistory?.scannedAt ?? "");
    const now = context.now instanceof Date ? context.now.getTime() : Date.now();
    if (!Number.isFinite(checkedAt) || checkedAt > now || now - checkedAt > 24 * 60 * 60 * 1000 ||
        slot.publicationHistory?.scanId !== plan.bufferHistory?.scanId ||
        slot.publicationHistory?.checkedAt !== plan.bufferHistory?.scannedAt ||
        slot.publicationHistory?.verifiedAgainstBuffer !== true) {
      slotErrors.push("Read-only Buffer history scan is missing, inconsistent or older than 24 hours");
    }
    const approval = validateOwnerApproval(slot, { coverManifest: context.coverManifest, research: context.research });
    return { podcastId: slot.podcastId, ...approval, errors: [...slotErrors, ...approval.errors], approved: slotErrors.length === 0 && approval.approved };
  });
  return { ready: errors.length === 0 && slots.every((slot) => slot.approved), errors, slots };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [flag, planFile, reviewFile, outputFile] = process.argv.slice(2);
  if (flag === "--validate" && planFile) {
    const plan = JSON.parse(await readFile(path.resolve(planFile), "utf8"));
    const context = await loadEditorialInputs(path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."));
    const result = validateEditorialPlan(plan, { ...context, now: new Date() });
    console.log(JSON.stringify(result, null, 2));
    if (!result.ready) process.exitCode = 1;
  } else if (flag === "--apply-csv" && planFile && reviewFile && outputFile) {
    const plan = JSON.parse(await readFile(path.resolve(planFile), "utf8"));
    const csv = await readFile(path.resolve(reviewFile), "utf8");
    const updated = applyReviewCsv(plan, csv);
    await writeFile(path.resolve(outputFile), `${JSON.stringify(updated, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ outputFile: path.resolve(outputFile), slots: updated.posts.length, approved: false,
      note: "CSV edits were imported without granting approval. Revalidate each owner approval and checksum." }, null, 2));
  } else {
    throw new Error("Usage: node scripts/instagram-editorial-plan.mjs --validate <plan.json> | --apply-csv <plan.json> <review.csv> <output-plan.json>");
  }
}
