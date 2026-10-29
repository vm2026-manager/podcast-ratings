import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
export const CANONICAL_GENRES = Object.freeze(require("../canonical-genres.js"));

const REQUIRED_NEW_PODCAST_FIELDS = Object.freeze([
  ["Podcast-ID", (row) => value(row?.["Podcast-ID"])],
  ["Genre", (row) => value(row?.Genre)],
  ["Udgiver", (row) => value(row?.Udgiver)],
  ["Link eller Feed", (row) => validHttpUrl(value(row?.Link)) || validHttpUrl(value(row?.Feed))],
  ["Kort beskrivelse", (row) => value(row?.["Kort beskrivelse"])],
  ["Billedlink", (row) => value(row?.Billedlink)]
]);

const normalizeKey = (input) => value(input).normalize("NFKC").toLocaleLowerCase("da-DK");
const value = (input) => String(input ?? "").trim().replace(/\s+/gu, " ");

function validHttpUrl(input) {
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isEpisodeList(input) {
  const parts = String(input ?? "").split(";").map(value).filter(Boolean);
  return parts.length >= 6 && parts.every((part) => part.length <= 180);
}

function inspectIntakeRow(row, publishedRows, titledIntakeRows) {
  const issues = [];
  const title = value(row?.Titel || row?.Title);
  const podcastId = value(row?.["Podcast-ID"]);
  const normalizedTitle = normalizeKey(title);
  const publishedTitleMatches = publishedRows.filter((item) => normalizeKey(item?.Titel) === normalizedTitle);

  if (!podcastId) issues.push({ code: "missing-podcast-id", field: "Podcast-ID", severity: "blocker" });
  for (const [field, getValue] of REQUIRED_NEW_PODCAST_FIELDS) {
    if (!getValue(row)) issues.push({ code: "missing-required-metadata", field, severity: "blocker" });
  }

  const primaryGenre = value(row?.Genre);
  if (primaryGenre && !CANONICAL_GENRES.some((genre) => normalizeKey(genre) === normalizeKey(primaryGenre))) {
    issues.push({ code: "noncanonical-primary-genre", field: "Genre", severity: "blocker" });
  }

  const shortDescription = value(row?.["Kort beskrivelse"]);
  if (shortDescription && /https?:\/\//iu.test(shortDescription)) {
    issues.push({ code: "url-in-description", field: "Kort beskrivelse", expectedField: "Link eller Feed", severity: "blocker" });
  }
  for (const field of ["Kort beskrivelse", "Lang beskrivelse", "Undervurderet perle"]) {
    if (isEpisodeList(row?.[field])) {
      issues.push({ code: "episode-list-in-editorial-field", field, expectedField: "Episoder efter særskilt kontrol", severity: "blocker" });
    }
  }
  if (value(row?.Feed) && !validHttpUrl(value(row?.Feed))) {
    issues.push({ code: "invalid-feed-url", field: "Feed", severity: "blocker" });
  }
  if (value(row?.Link) && !validHttpUrl(value(row?.Link))) {
    issues.push({ code: "invalid-source-url", field: "Link", severity: "blocker" });
  }
  if (publishedTitleMatches.length) {
    issues.push({ code: "exact-title-matches-published-record", field: "Titel", severity: "blocker" });
  }
  if (titledIntakeRows.filter((item) => normalizeKey(item?.Titel || item?.Title) === normalizedTitle).length > 1) {
    issues.push({ code: "duplicate-intake-title", field: "Titel", severity: "blocker" });
  }

  return {
    source: "Sheet",
    sourceRowNumber: Number.isInteger(row?.__sourceRowNumber) ? row.__sourceRowNumber : null,
    title,
    declaredPodcastId: podcastId || null,
    identityStatus: podcastId ? "editorial-id-present-awaiting-review" : "awaiting-approved-podcast-id",
    identityCreated: false,
    status: issues.some((issue) => issue.severity === "blocker") ? "blocked-intake-candidate" : "intake-candidate",
    issues,
    metadata: {
      host: value(row?.Vært || row?.Vaert || row?.Host || row?.Værter),
      publisher: value(row?.Udgiver || row?.Publisher),
      primaryGenre,
      secondaryGenre: value(row?.["2. genre"]),
      tertiaryGenre: value(row?.["3. genre"]),
      topics: value(row?.Emner),
      link: value(row?.Link || row?.URL),
      feed: value(row?.Feed || row?.RSS || row?.["RSS feed"] || row?.["Episode feed"]),
      sourceEvidenceUrl: value(row?.Kilde || row?.["Kilde-URL"] || row?.["Source URL"]),
      cover: value(row?.Billedlink || row?.Billedefil || row?.Billede || row?.Cover || row?.Image),
      shortDescription,
      longDescription: value(row?.["Lang beskrivelse"] || row?.Langbeskrivelse),
      misplacedEpisodeListField: ["Kort beskrivelse", "Lang beskrivelse", "Undervurderet perle"].find((field) =>
        isEpisodeList(row?.[field])
      ) || null
    }
  };
}

export function partitionSheetPodcastRows(rows, publishedRows) {
  const titledRows = (Array.isArray(rows) ? rows : []).filter((row) => value(row?.Titel || row?.Title));
  const publishedIds = new Set((Array.isArray(publishedRows) ? publishedRows : []).map((row) => value(row?.["Podcast-ID"])));
  const publishableRows = [];
  const intakeRows = [];

  for (const row of titledRows) {
    const podcastId = value(row?.["Podcast-ID"]);
    const isNewIdentity = !podcastId || !publishedIds.has(podcastId);
    if (!isNewIdentity) {
      publishableRows.push(row);
      continue;
    }

    const candidate = inspectIntakeRow(row, publishedRows || [], titledRows);
    if (candidate.issues.length) {
      intakeRows.push(candidate);
    } else {
      publishableRows.push(row);
    }
  }

  return { publishableRows, intakeRows };
}

export function validateCatalogueIntake({ publishedRows, candidateRows, intakeCandidates }) {
  const errors = [];
  const published = Array.isArray(publishedRows) ? publishedRows : [];
  const candidates = Array.isArray(candidateRows) ? candidateRows : [];
  const intake = Array.isArray(intakeCandidates) ? intakeCandidates : [];
  const publishedIds = new Set(published.map((row) => value(row?.["Podcast-ID"])));
  const candidateIds = new Set(candidates.map((row) => value(row?.["Podcast-ID"])));

  if (candidateIds.size !== candidates.length || candidateIds.has("")) {
    errors.push("Candidate catalogue has missing or duplicate Podcast-ID values.");
  }
  if (publishedIds.size !== published.length || publishedIds.has("")) {
    errors.push("Published catalogue has missing or duplicate Podcast-ID values.");
  }
  const missingPublishedIds = [...publishedIds].filter((id) => !candidateIds.has(id));
  if (missingPublishedIds.length) errors.push(`Existing published Podcast-ID values are missing from candidate catalogue: ${missingPublishedIds.length}.`);

  const safeKeys = new Set([
    "source", "sourceRowNumber", "title", "declaredPodcastId", "identityStatus", "identityCreated", "status", "issues", "metadata"
  ]);
  const safeMetadataKeys = new Set([
    "host", "publisher", "primaryGenre", "secondaryGenre", "tertiaryGenre", "topics", "link", "feed", "cover",
    "sourceEvidenceUrl", "shortDescription", "longDescription", "misplacedEpisodeListField"
  ]);
  const intakeTitles = new Set();
  for (const item of intake) {
    if (Object.hasOwn(item, "catalogue_id")) errors.push(`Intake candidate ${JSON.stringify(item?.title || "(untitled)")} has a catalogue_id.`);
    if (item?.identityCreated !== false) errors.push(`Intake candidate ${JSON.stringify(item?.title || "(untitled)")} is marked as having a created identity.`);
    if (Object.keys(item || {}).some((key) => !safeKeys.has(key))) errors.push("Intake candidate contains a field outside the editorial metadata allowlist.");
    if (Object.keys(item?.metadata || {}).some((key) => !safeMetadataKeys.has(key))) errors.push("Intake candidate metadata contains a field outside the allowlist.");
    const id = value(item?.declaredPodcastId);
    if (id && candidateIds.has(id)) errors.push("Intake candidate Podcast-ID " + JSON.stringify(id) + " is present in staged catalogue output.");
    if (id && publishedIds.has(id)) errors.push(`Intake candidate Podcast-ID ${JSON.stringify(id)} conflicts with a published identity.`);
    const title = normalizeKey(item?.title);
    if (title && intakeTitles.has(title)) errors.push("Intake candidate title " + JSON.stringify(item.title) + " is duplicated.");
    if (title) intakeTitles.add(title);
    if (!Number.isInteger(item?.sourceRowNumber) || item.sourceRowNumber < 2) errors.push("Intake candidate " + JSON.stringify(item?.title || "(untitled)") + " has no valid source row.");
    if (title && published.some((row) => normalizeKey(row?.Titel) === title)) {
      errors.push(`Intake candidate title ${JSON.stringify(item.title)} exactly matches a published title.`);
    }
  }

  return { ok: errors.length === 0, errors, candidateCount: intake.length, publishedCount: published.length, stagedCount: candidates.length };
}

export { validHttpUrl };
