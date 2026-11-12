import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function jpegDimensions(bytes) {
  let offset = 2;
  while (offset + 4 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > bytes.length) return null;
    const length = bytes.readUInt16BE(offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { format: "JPEG", width: bytes.readUInt16BE(offset + 5), height: bytes.readUInt16BE(offset + 3) };
    }
    offset += length;
  }
  return null;
}

export function inspectImageBytes(bytes) {
  if (!Buffer.isBuffer(bytes)) return null;
  if (bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { format: "PNG", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") {
    let offset = 12;
    while (offset + 8 <= bytes.length) {
      const chunk = bytes.toString("ascii", offset, offset + 4);
      const size = bytes.readUInt32LE(offset + 4);
      const data = offset + 8;
      if (data + size > bytes.length) return null;
      if (chunk === "VP8X" && size >= 10) return { format: "WEBP", width: 1 + bytes.readUIntLE(data + 4, 3), height: 1 + bytes.readUIntLE(data + 7, 3) };
      if (chunk === "VP8 " && size >= 10 && bytes[data + 3] === 0x9d && bytes[data + 4] === 0x01 && bytes[data + 5] === 0x2a) {
        return { format: "WEBP", width: bytes.readUInt16LE(data + 6) & 0x3fff, height: bytes.readUInt16LE(data + 8) & 0x3fff };
      }
      if (chunk === "VP8L" && size >= 5 && bytes[data] === 0x2f) {
        const b1 = bytes[data + 1]; const b2 = bytes[data + 2]; const b3 = bytes[data + 3]; const b4 = bytes[data + 4];
        return { format: "WEBP", width: 1 + (b1 | ((b2 & 0x3f) << 8)), height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)) };
      }
      offset = data + size + (size % 2);
    }
    return null;
  }
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegDimensions(bytes);
  return null;
}

export function inspectOriginalCoverFile(root, cover) {
  if (!cover?.sourcePath || !/^[a-f0-9]{64}$/i.test(cover.sourceChecksum ?? "")) return { verified: false, reason: "missing-source-identity" };
  try {
    const bytes = readFileSync(path.join(root, cover.sourcePath));
    const image = inspectImageBytes(bytes);
    const checksum = sha256(bytes);
    const expectedFormat = String(cover.format ?? "").toUpperCase();
    const verified = checksum === cover.sourceChecksum && bytes.length === cover.sourceBytes && image?.format === expectedFormat &&
      image?.width === cover.width && image?.height === cover.height && image.width === image.height && image.width >= 600;
    return { verified, sourceChecksum: checksum, bytes: bytes.length, format: image?.format ?? "unknown",
      width: image?.width ?? null, height: image?.height ?? null,
      reason: verified ? "exact-source-bytes-format-and-dimensions" : "source-bytes-format-or-dimensions-mismatch" };
  } catch {
    return { verified: false, reason: "source-file-unavailable" };
  }
}

export function sharedArtworkIdentity(cover, manifest) {
  const checksum = String(cover?.sourceChecksum ?? "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(checksum)) return { shared: false, podcastIds: [] };
  const ids = [...new Set((manifest?.podcasts ?? [])
    .filter((entry) => String(entry?.sourceChecksum ?? "").toLowerCase() === checksum)
    .map((entry) => entry?.appPodcastKey)
    .filter((id) => typeof id === "string" && id.length > 0))].sort((a, b) => a.localeCompare(b, "da"));
  return { shared: ids.length > 1, podcastIds: ids };
}

export function extractDrArtworkId(sourceUrl) {
  try {
    const url = new URL(sourceUrl);
    const match = url.pathname.match(/urn:dr:(podcast|radio):image:([a-f0-9-]+)/i);
    return match ? `urn:dr:${match[1].toLowerCase()}:image:${match[2]}` : "";
  } catch { return ""; }
}

export function reviewReadiness(slot, now = new Date()) {
  const accessDate = /^\d{4}-\d{2}-\d{2}$/.test(slot?.access?.checkedAt ?? "") ? new Date(`${slot.access.checkedAt}T00:00:00Z`) : null;
  const daysSinceAccessCheck = accessDate && Number.isFinite(accessDate.getTime())
    ? Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - accessDate.getTime()) / 86400000) : null;
  const currentCheck = slot?.currentAccessReview?.checkedAt && /^\d{4}-\d{2}-\d{2}$/.test(slot.currentAccessReview.checkedAt)
    ? new Date(`${slot.currentAccessReview.checkedAt}T00:00:00Z`) : null;
  const currentAge = currentCheck && Number.isFinite(currentCheck.getTime())
    ? Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - currentCheck.getTime()) / 86400000) : null;
  const linkResearch = slot?.caption?.targetLinkResearchStatus ?? "no-current-link-review";
  return {
    coverIdentity: slot?.cover?.sharedArtwork?.shared ? "manual-review-shared-source-checksum" : "exact-source-identity-matched",
    imageQuality: slot?.cover?.fileVerification?.verified
      ? (slot.cover.qualityStatus === "manual-quality-review-required" ? "manual-visual-review-required" : "manifest-quality-checked")
      : "blocked-source-file-integrity",
    coverRights: slot?.cover?.rightsStatus ?? "blocked-no-documented-reuse-right",
    access: currentAge !== null && currentAge <= 30
      ? `rechecked-${slot.currentAccessReview.status}`
      : daysSinceAccessCheck !== null && daysSinceAccessCheck > 30 ? "stale-recheck-required" : "current-source-review-required",
    listeningLink: linkResearch,
    personalTake: slot?.caption?.ownerTake?.trim() ? "present-owner-entered" : "missing-owner-take",
    publisherMentions: slot?.caption?.publisherMentions?.length ? "verified-source-present" : "no-verified-official-handle",
    approval: "not-approved",
  };
}
