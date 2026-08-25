import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultPath = path.resolve(__dirname, "..", "data", "podcasts.json");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeMatchKey(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9\u00e6\u00f8\u00e5 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rowDetails(row, index) {
  return {
    row: index + 1,
    podcastId: String(row["Podcast-ID"] ?? ""),
    title: normalizeText(row.Titel || row.Title),
    host: normalizeText(row["Vært"] || row.Vaert || row.Host),
    publisher: normalizeText(row.Udgiver || row.Publisher)
  };
}

function groupRows(rows, keyForRow) {
  const groups = new Map();
  rows.forEach((row, index) => {
    const key = keyForRow(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(rowDetails(row, index));
  });
  return groups;
}

function groupsWithMoreThanOneDistinctValue(groups, valueForDetail) {
  return [...groups.entries()]
    .filter(([, details]) => new Set(details.map(valueForDetail).filter(Boolean)).size > 1)
    .map(([key, rows]) => ({ key, rows }));
}

async function main() {
  const inputPath = path.resolve(process.argv[2] || defaultPath);
  const parsed = JSON.parse(await readFile(inputPath, "utf8"));
  const rows = Array.isArray(parsed) ? parsed : parsed.rows;

  if (!Array.isArray(rows)) {
    throw new Error("Forventede en podcasts.json payload med en rows-array.");
  }

  const idGroups = groupRows(rows, (row) => String(row["Podcast-ID"] ?? ""));
  const titleGroups = groupRows(rows, (row) => normalizeMatchKey(row.Titel || row.Title));
  const idDetails = [...idGroups.entries()];
  const missingPodcastIds = idGroups.get("") || [];
  const blankPodcastIds = idDetails
    .filter(([id]) => !String(id).trim())
    .flatMap(([, details]) => details);
  const whitespacePodcastIds = rows
    .map((row, index) => ({ raw: String(row["Podcast-ID"] ?? ""), detail: rowDetails(row, index) }))
    .filter(({ raw }) => raw && raw !== raw.trim())
    .map(({ detail }) => detail);
  const safeDuplicateIdGroups = idDetails
    .filter(([id, details]) => id && details.length > 1 && new Set(details.map((detail) => normalizeMatchKey(detail.title))).size === 1)
    .map(([podcastId, rowsInGroup]) => ({ podcastId, rows: rowsInGroup }));
  const suspiciousDuplicateIdGroups = idDetails
    .filter(([id, details]) => id && details.length > 1 && new Set(details.map((detail) => normalizeMatchKey(detail.title))).size > 1)
    .map(([podcastId, rowsInGroup]) => ({ podcastId, rows: rowsInGroup }));
  const duplicateTitleGroupsWithDistinctIds = groupsWithMoreThanOneDistinctValue(
    titleGroups,
    (detail) => normalizeText(detail.podcastId)
  );
  const duplicateTitleGroups = [...titleGroups.entries()]
    .filter(([title, details]) => title && details.length > 1)
    .map(([title, rowsInGroup]) => ({ title, rows: rowsInGroup }));
  const podcastIdLegacyKeyMismatches = rows
    .map((row, index) => {
      const detail = rowDetails(row, index);
      return {
        ...detail,
        legacyKey: normalizeMatchKey(detail.title)
      };
    })
    .filter(({ podcastId, legacyKey }) => normalizeText(podcastId) !== legacyKey);

  const report = {
    inputFile: path.basename(inputPath),
    totalPodcastRows: rows.length,
    rowsWithPodcastId: rows.length - missingPodcastIds.length,
    rowsMissingPodcastId: missingPodcastIds.length,
    distinctPodcastIds: idDetails.filter(([id]) => id).length,
    safeDuplicateIdGroups,
    suspiciousDuplicateIdGroups,
    duplicateTitleGroups,
    duplicateTitleGroupsWithDistinctIds,
    podcastIdLegacyKeyMismatches,
    podcastIdsWithLeadingOrTrailingWhitespace: whitespacePodcastIds,
    blankPodcastIds,
    missingPodcastIds
  };

  console.log(JSON.stringify(report, null, 2));

  if (missingPodcastIds.length || suspiciousDuplicateIdGroups.length) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
