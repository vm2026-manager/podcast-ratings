import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

const normalize = (value) => String(value ?? "").trim().replace(/\s+/gu, " ");
const BOSNIA_PODCAST_ID = "krigen i bosnien";
const BOSNIA_SOURCE_PATH = "assets/podcast-covers/manual-inbox/krigen_i_bosnien_editorial.png";
const BOSNIA_SOURCE_SHA256 = "eabde7a7ab0a05313516fda1d9c863c6f59968f60ba8fc4124534922d65bf1da";

function safeRepositoryPath(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath || path.isAbsolute(relativePath)) {
    throw new Error("Manual catalogue metadata requires a repository-relative source path.");
  }
  const normalized = relativePath.replace(/\\/gu, "/");
  if (normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`Unsafe manual catalogue metadata source path: ${relativePath}`);
  }
  const absolute = path.resolve(root, ...normalized.split("/"));
  const relative = path.relative(root, absolute);
  if (!relative || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Manual catalogue metadata source escapes the repository: ${relativePath}`);
  }
  return absolute;
}

function verifyEditorialImage(root, entry) {
  const absolute = safeRepositoryPath(root, entry.sourcePath);
  const bytes = readFileSync(absolute);
  const checksum = createHash("sha256").update(bytes).digest("hex");
  if (checksum !== entry.sourceSha256) {
    throw new Error(`Manual catalogue metadata source checksum mismatch for ${entry.podcastId}.`);
  }
  if (
    bytes.toString("hex", 0, 8) !== "89504e470d0a1a0a" ||
    bytes.readUInt32BE(16) !== 1400 ||
    bytes.readUInt32BE(20) !== 1400
  ) {
    throw new Error(`Manual catalogue metadata source is not the registered 1400x1400 PNG for ${entry.podcastId}.`);
  }
  return checksum;
}

function verifyFlashbackLink(publishedRows, entry) {
  const matches = publishedRows.filter((row) => row?.["Podcast-ID"] === entry.linkSourcePodcastId);
  if (matches.length !== 1) {
    throw new Error(`Manual metadata link evidence requires exactly one ${entry.linkSourcePodcastId} catalogue row.`);
  }
  const source = matches[0];
  if (
    source.Titel !== entry.linkSourceTitle ||
    source.Udgiver !== entry.linkSourcePublisher ||
    source.Link !== entry.metadata.Link
  ) {
    throw new Error(`Manual metadata link evidence for ${entry.podcastId} no longer matches the verified Flashback parent.`);
  }
}

export function applyManualCatalogueMetadataOverrides({ sheetRows, publishedRows, registry, root }) {
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.overrides)) {
    throw new Error("Invalid manual catalogue metadata override registry.");
  }

  const seenIds = new Set();
  const verified = registry.overrides.map((entry) => {
    const id = entry?.podcastId;
    if (typeof id !== "string" || !id || seenIds.has(id)) {
      throw new Error("Manual catalogue metadata contains a missing or duplicate exact Podcast-ID.");
    }
    seenIds.add(id);
    if (id !== BOSNIA_PODCAST_ID || entry.sourcePath !== BOSNIA_SOURCE_PATH || entry.sourceSha256 !== BOSNIA_SOURCE_SHA256) {
      throw new Error("Manual catalogue metadata is outside the explicitly approved Bosnien identity and source.");
    }
    if (entry.artworkKind !== "OWNER_APPROVED_EDITORIAL") {
      throw new Error(`Manual catalogue metadata for ${id} is missing its editorial artwork classification.`);
    }
    if (
      !entry.expectedIdentity ||
      !entry.metadata ||
      Object.keys(entry.expectedIdentity).sort().join("|") !== ["Hovedserie", "Titel", "Udgiver", "Vært"].sort().join("|") ||
      Object.keys(entry.metadata).sort().join("|") !== ["Billedlink", "Link"].sort().join("|") ||
      entry.metadata.Billedlink !== entry.sourcePath ||
      !entry.metadata.Link ||
      !entry.linkSourcePodcastId ||
      !entry.linkSourceTitle ||
      !entry.linkSourcePublisher ||
      !entry.sourceEvidence
    ) {
      throw new Error(`Manual catalogue metadata is incomplete for ${id}.`);
    }
    verifyEditorialImage(root, entry);
    return entry;
  });

  const output = Array.isArray(sheetRows) ? sheetRows.map((row) => ({ ...row })) : [];
  for (const entry of verified) {
    const matchingRows = output.filter((row) => normalize(row?.["Podcast-ID"]) === entry.podcastId);
    if (matchingRows.length > 1) {
      throw new Error(`Duplicate exact Podcast-ID ${JSON.stringify(entry.podcastId)} in Sheet rows.`);
    }
    if (!matchingRows.length) continue;

    const row = matchingRows[0];
    const publishedMatches = (publishedRows || []).filter((item) => normalize(item?.["Podcast-ID"]) === entry.podcastId);
    if (publishedMatches.length > 1) {
      throw new Error(`Duplicate exact Podcast-ID ${JSON.stringify(entry.podcastId)} in published catalogue.`);
    }
    for (const [field, expected] of Object.entries(entry.expectedIdentity)) {
      if (normalize(row?.[field]) !== expected) {
        throw new Error(`Manual catalogue metadata identity conflict for ${entry.podcastId}: ${field}.`);
      }
      if (publishedMatches.length && normalize(publishedMatches[0]?.[field]) !== expected) {
        throw new Error(`Manual catalogue metadata collides with a published identity for ${entry.podcastId}: ${field}.`);
      }
    }

    if (!normalize(row.Link)) {
      verifyFlashbackLink(publishedRows || [], entry);
      row.Link = entry.metadata.Link;
    }
    if (!normalize(row.Billedlink)) {
      row.Billedlink = entry.metadata.Billedlink;
    }
  }

  return output;
}

export function loadManualCatalogueMetadataRegistry(root) {
  const file = safeRepositoryPath(root, "data/manual-catalogue-metadata-overrides.json");
  return JSON.parse(readFileSync(file, "utf8"));
}
