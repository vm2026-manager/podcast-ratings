import { slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";

const canonicalBase = "https://podcastlisten.dk";
const text = (value) => typeof value === "string" ? value.trim() : "";

export function resolveInstagramChannel(organizations, channelsByOrganization) {
  const matches = [];
  for (const org of organizations ?? []) {
    for (const channel of channelsByOrganization.get(org.id) ?? []) {
      if (channel.service !== "instagram") continue;
      const name = text(channel.name).replace(/^@/, "").toLowerCase();
      let externalHandle = "";
      try { externalHandle = new URL(channel.externalLink).pathname.replace(/^\/+|\/+$/g, "").toLowerCase(); } catch {}
      if (name === "podcastlisten.dk" && (!externalHandle || externalHandle === "podcastlisten.dk")) matches.push({ ...channel, organizationName: org.name });
    }
  }
  if (matches.length !== 1) throw new Error(`Expected exactly one Instagram channel for podcastlisten.dk; found ${matches.length}`);
  const channel = matches[0];
  if (channel.isDisconnected || channel.isLocked) throw new Error("Instagram channel is disconnected or locked");
  if (!Array.isArray(channel.allowedActions) || !channel.allowedActions.some((action) => /create|publish|post/i.test(action))) {
    throw new Error("Buffer token lacks verified post creation permissions for the Instagram channel");
  }
  return channel;
}

function uniqueByExactId(rows) {
  const map = new Map();
  for (const row of rows ?? []) {
    const id = text(row?.["Podcast-ID"]);
    if (!id) continue;
    const bucket = map.get(id) ?? [];
    bucket.push(row);
    map.set(id, bucket);
  }
  return map;
}

function coverForPodcast(podcast, manifest, approvals, siteOrigin = canonicalBase) {
  const id = text(podcast["Podcast-ID"]);
  const candidates = (manifest?.podcasts ?? []).filter((cover) => cover.appPodcastKey === id);
  if (candidates.length !== 1) return null;
  const cover = candidates[0];
  if (cover.title !== podcast.Titel || cover.publisher !== podcast.Udgiver || cover.genre !== podcast.Genre) return null;
  if (cover.status !== "success" || cover.needsPlaceholder || cover.sourceAuditStatus !== "valid") return null;
  if (!/^https:\/\//.test(cover.originalImageUrl ?? "") || !/^[a-f0-9]{64}$/i.test(cover.sourceChecksum ?? "") || cover.successfulSourceChecksum !== cover.sourceChecksum) return null;
  if (!/^[AB]$/.test(cover.qualityCategory ?? "") || !cover.variants?.["800"]?.path || cover.variants["800"].actualWidth < 800) return null;
  const assetPath = cover.variants["800"].path;
  if (!/^data\/covers\/800\/[\w.-]+\.webp$/.test(assetPath)) return null;
  const approvalMatches = (approvals?.approvals ?? []).filter((approval) => approval.podcastId === id);
  if (approvalMatches.length !== 1) return null;
  const approval = approvalMatches[0];
  const checksum = cover.variants["800"].checksum;
  if (!/^[a-f0-9]{64}$/i.test(checksum ?? "")) return null;
  if (approval.status !== "approved" || !approval.approvedBy || !approval.approvedAt ||
      !/^https:\/\//.test(approval.evidenceUrl ?? "") || approval.coverChecksum !== checksum) return null;
  const url = new URL(`/${assetPath}`, siteOrigin);
  if (url.protocol !== "https:" || url.hostname !== "podcastlisten.dk") return null;
  return { url: url.href, checksum, source: cover.originalImageUrl, qualityCategory: cover.qualityCategory };
}

export function validateReviewLinkage(podcastId, { podcasts, reviews, manifest, approvals, siteOrigin } = {}) {
  const byId = uniqueByExactId(podcasts);
  const rows = byId.get(podcastId) ?? [];
  if (rows.length !== 1) throw new Error(`Podcast-ID ${podcastId} must resolve to exactly one catalogue row`);
  const podcast = rows[0];
  for (const field of ["Titel", "Udgiver", "Kort beskrivelse", "Genre"]) {
    if (!text(podcast[field])) throw new Error(`Podcast-ID ${podcastId} is missing ${field}`);
  }
  const reviewMatches = (reviews ?? []).filter((review) => review.Aktiv === "JA" && review.Titel === podcast.Titel &&
    review["Auto-udgiver"] === podcast.Udgiver && review["Auto-genre"] === podcast.Genre && text(review["Kort vurdering"]));
  if (reviewMatches.length !== 1) throw new Error(`Podcast-ID ${podcastId} must have exactly one active exact editorial review match`);
  const reviewRecord = reviewMatches[0];
  const reviewDate = text(reviewRecord["Anmeldelsesdato"]);
  if (!/^\d{2}-\d{2}-\d{4}$/.test(reviewDate)) throw new Error(`Podcast-ID ${podcastId} review date is not verified`);
  const cover = coverForPodcast(podcast, manifest, approvals, siteOrigin);
  if (!cover) throw new Error(`Podcast-ID ${podcastId} has no uniquely linked, quality-checked cover with explicit rights approval`);
  const slug = slugFromPodcastId(podcastId);
  if (!slug) throw new Error(`Podcast-ID ${podcastId} has no canonical profile slug`);
  return { id: podcastId, title: podcast.Titel, publisher: podcast.Udgiver, description: podcast["Kort beskrivelse"], genre: podcast.Genre,
    review: reviewRecord["Kort vurdering"], reviewDate,
    reviewScore: Number(String(reviewRecord["Samlet score"] ?? "").replace(",", ".")), canonicalUrl: `${canonicalBase}/podcast/${slug}/`, cover };
}

export function selectPodcast({ podcasts, reviews, manifest, approvals, usedPodcastIds = [], siteOrigin } = {}) {
  const used = new Set(usedPodcastIds);
  const candidates = [];
  for (const row of podcasts ?? []) {
    const id = text(row?.["Podcast-ID"]);
    if (!id || used.has(id)) continue;
    try {
      const item = validateReviewLinkage(id, { podcasts, reviews, manifest, approvals, siteOrigin });
      if (!Number.isFinite(item.reviewScore) || item.reviewScore < 7) continue;
      candidates.push(item);
    } catch { /* Unsafe or unverified catalogue entries are not eligible. */ }
  }
  const dateKey = (value) => {
    const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
    return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
  };
  candidates.sort((a, b) => dateKey(a.reviewDate).localeCompare(dateKey(b.reviewDate)) || a.id.localeCompare(b.id, "da"));
  if (!candidates.length) throw new Error("No podcast has a complete exact editorial, identity, cover-quality and cover-rights verification");
  const { reviewScore, ...selected } = candidates[0];
  return selected;
}

export function buildCaption(podcast) {
  return `Podcastlisten anbefaler ${podcast.title} fra ${podcast.publisher}. ${podcast.review}\n\nLæs mere: ${podcast.canonicalUrl}`;
}

export function validateCoverApprovalEntry(entry) {
  return Boolean(entry && entry.status === "approved" && entry.podcastId && entry.coverChecksum &&
    entry.approvedBy && entry.approvedAt && /^https:\/\//.test(entry.evidenceUrl ?? ""));
}
