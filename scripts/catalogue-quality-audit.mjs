import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_GENRES } from "./catalogue-intake.mjs";
import { dedupeProposedGenres, suggestGenres, suggestSearchTopics } from "./catalogue-quality-rules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(root, "audit-catalogue-quality");
const normalize = (input) => String(input ?? "").trim().replace(/\s+/gu, " ");
const key = (input) => normalize(input).normalize("NFKC").toLocaleLowerCase("da-DK");
const canonicalByKey = new Map(CANONICAL_GENRES.map((genre) => [key(genre), genre]));
const completedEditorialDecisions = new Map([
  ["i selskab med q", { primary: "Underholdning", secondary: "Samfund", source: "issue #376 manual review and merged PR #378" }],
  ["shop21 dk bitcoin samfund frihed", { primary: "Finans", secondary: "Viden", source: "issue #376 pilot status and merged PR #378" }],
  ["darligt nyt fra østfronten", { primary: "Krig", secondary: "Dokumentar", source: "issue #376 pilot status and merged PR #378" }],
  ["bliv rigere", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["børsen investor", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["aktieuniverset", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["millionærklubben", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["store penge", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["børssnak", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["børsen brænder", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["børsen morgenbriefing", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["det der tæller", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["finansministeriet forklarer", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["makropuls howden", { primary: "Finans", secondary: "Samfund", source: "issue #383 and merged PR #388" }],
  ["boraghi og pengedoktoren", { primary: "Finans", secondary: "Samfund", source: "issue #383 and merged PR #388" }],
  ["morgennyheder", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["lyn analyse", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["den lyse side", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }],
  ["big picture", { primary: "Finans", secondary: "Samfund", source: "issue #383 and merged PR #388" }],
  ["sorte tal", { primary: "Finans", secondary: "Viden", source: "issue #383 and merged PR #388" }]
]);
const priorReviewHolds = new Map([
  ["se og hor lige her", { source: "audit-genre-expansion/genre-reclassification-candidates.csv", note: "Behold Sladder som historisk genre og søgbart indhold indtil særskilt redaktionel omklassificering er godkendt." }]
]);
const priorManualReviewNotes = new Map([
  ["lady diana", "Issue #376 manual review: True Crime is called a clear misclassification; Historie/Samfund were suggested. No metadata change is authorized."],
  ["kiggerpigen", "Issue #376 manual review: descriptions conflict with topics. Correct the authoritative source before genre review."],
  ["dræberurten", "Issue #376 manual review: topics are missing; genre evidence is insufficient."],
  ["ondskab i forklædning", "Issue #376 manual review: Apple category supports True Crime; source evidence should be rechecked before any change."],
  ["den korte podcast", "Issue #376 manual review: satire suggests Underholdning over Samfund; not authorized."],
  ["europa i krig", "Issue #376 manual review: Krig/Historie was preferred over a redundant third Samfund; not authorized."],
  ["apartheid", "Issue #376 manual review: identified as a True Crime outlier for editorial re-review; not a confirmed automatic change."],
  ["bomberne pa isen", "Issue #376 manual review: identified as a True Crime outlier for editorial re-review; not a confirmed automatic change."],
  ["sasha var heroin luder", "Issue #376 manual review: identified as a True Crime outlier for editorial re-review; not a confirmed automatic change."]
]);
const priorManualReviewCategories = new Map([
  ["lady diana", "Muligt genremismatch — kildeverifikation kræves"],
  ["kiggerpigen", "Kildekonflikt — afstem før klassifikation"],
  ["dræberurten", "Manglende evidens — emner/udgiverkilde mangler"],
  ["ondskab i forklædning", "Kildetjek — True Crime er understøttet af Apple, ikke genverificeret"],
  ["den korte podcast", "Muligt genremismatch — satire/underholdning skal afstemmes"],
  ["europa i krig", "Supplerende genre — vurder om tredje genre er nødvendig"],
  ["apartheid", "Muligt genremismatch — True Crime-outlier skal verificeres"],
  ["bomberne pa isen", "Muligt genremismatch — True Crime-outlier skal verificeres"],
  ["sasha var heroin luder", "Muligt genremismatch — True Crime-outlier skal verificeres"]
]);
const csvCell = (input) => "\"" + String(input ?? "").replace(/"/gu, "\"\"") + "\"";
const stableJson = (value) => Array.isArray(value)
  ? "[" + value.map(stableJson).join(",") + "]"
  : !value || typeof value !== "object"
    ? JSON.stringify(value)
    : "{" + Object.keys(value).sort().map((name) => JSON.stringify(name) + ":" + stableJson(value[name])).join(",") + "}";
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

function inspectUrl(input) {
  const text = normalize(input);
  if (!text) return "missing";
  try {
    const url = new URL(text);
    if (url.protocol === "https:" || url.protocol === "http:") return "valid";
  } catch {}
  if (/^data:image\/(?:png|jpe?g|webp|gif);base64,/iu.test(text)) return "embedded-image";
  if (/^(?:assets|data)\/[a-z0-9/_\-.]+$/iu.test(text)) return "local-path";
  return "invalid";
}
function owner(id, bakspejl, djaevlen) {
  if (bakspejl.has(id)) return ["DR-auto", "data/auto-discovered-bakspejl.json", false];
  if (djaevlen.has(id)) return ["DR-auto", "data/auto-discovered-djaevlen.json", false];
  if (id === "flashback politiken") return ["Historisk bevaret identitet", "preserveFlashbackParentIdentity", false];
  return ["Google Sheet (sync pipeline)", "Publiceret Ark1 via sync-sheet-data.mjs", false];
}
function extractSourceIdentifiers(row) {
  const urls = [normalize(row?.Link), normalize(row?.Feed)].filter(Boolean);
  const identifiers = [];
  for (const text of urls) {
    try {
      const url = new URL(text);
      const apple = url.pathname.match(/\/id(\d+)/iu);
      const drSeries = url.pathname.match(/-(\d{9,})\/?$/u);
      const drFeed = url.pathname.match(/\/feeds\/([^/?#]+)/iu);
      if (apple) identifiers.push("Apple Podcasts ID " + apple[1]);
      if (drSeries) identifiers.push("DR series ID " + drSeries[1]);
      if (drFeed) identifiers.push("DR feed key " + drFeed[1]);
    } catch {}
  }
  return [...new Set(identifiers)];
}
function inspect(row, archive, sourceInfo) {
  const id = normalize(row?.["Podcast-ID"]);
  const title = normalize(row?.Titel);
  const currentSlots = [row?.Genre, row?.secondaryGenre, row?.tertiaryGenre].map(normalize);
  const current = currentSlots.filter(Boolean);
  const canonical = current.map((value) => canonicalByKey.get(key(value)) || "");
  const genreIssues = [];
  if (!current.length) genreIssues.push("missing-primary-genre");
  if (current.length > 3) genreIssues.push("more-than-three-genres");
  if (new Set(current.map(key)).size !== current.length) genreIssues.push("duplicate-genre-values");
  current.forEach((value, index) => { if (!canonical[index]) genreIssues.push("noncanonical-genre:" + value); });
  const topics = Array.isArray(row?.topics) ? row.topics.map(normalize).filter(Boolean) : [];
  const topicKeys = topics.map(key);
  const topicIssues = topics.some((topic, index) => topicKeys.indexOf(key(topic)) !== index) ? ["duplicate-topics-case-insensitive"] : [];
  const linkStatus = inspectUrl(row?.Link);
  const feedStatus = inspectUrl(row?.Feed);
  const coverStatus = inspectUrl(row?.Billedlink);
  const metadataIssues = [];
  if (!id) metadataIssues.push("missing-podcast-id");
  if (!normalize(row?.catalogue_id)) metadataIssues.push("missing-catalogue-id");
  if (!title) metadataIssues.push("missing-title");
  if (!normalize(row?.Udgiver)) metadataIssues.push("missing-publisher");
  if (linkStatus === "missing" && feedStatus === "missing") metadataIssues.push("missing-source-link-and-feed");
  if (linkStatus === "invalid") metadataIssues.push("invalid-link");
  if (feedStatus === "invalid") metadataIssues.push("invalid-feed");
  if (coverStatus === "missing") metadataIssues.push("missing-cover");
  if (coverStatus === "invalid") metadataIssues.push("invalid-cover-reference");
  if (coverStatus === "local-path" && !existsSync(path.join(root, normalize(row?.Billedlink)))) metadataIssues.push("missing-local-cover-file");
  if (!normalize(row?.["Kort beskrivelse"])) metadataIssues.push("missing-short-description");
  if (!normalize(row?.["Lang beskrivelse"])) metadataIssues.push("missing-long-description");
  for (const field of ["Kort beskrivelse", "Lang beskrivelse"]) {
    const text = normalize(row?.[field]);
    if (text && /https?:\/\/\S+/iu.test(text)) metadataIssues.push("url-in-description:" + field);
    if (text.split(";").map(normalize).filter(Boolean).length >= 6) metadataIssues.push("episode-list-suspected:" + field);
  }
  if (!topics.length) metadataIssues.push("missing-topics");
  if (topicIssues.length) metadataIssues.push(...topicIssues);
  if (topics.some((topic) => /https?:\/\/\S+/iu.test(topic))) metadataIssues.push("url-in-topic");
  const contentSuggestions = suggestGenres(row, sourceInfo[2]);
  const topicSuggestions = suggestSearchTopics(row, topics);
  const existingPrimary = canonicalByKey.get(key(row?.Genre)) || "";
  const primaryCandidate = contentSuggestions.find((item) => item.genre !== existingPrimary);
  const priorDecision = completedEditorialDecisions.get(id);
  const priorDecisionMatches = priorDecision
    && canonicalByKey.get(key(row?.Genre)) === priorDecision.primary
    && canonicalByKey.get(key(row?.secondaryGenre)) === priorDecision.secondary;
  const priorDecisionConflict = priorDecision && !priorDecisionMatches;
  const priorHold = priorReviewHolds.get(id);
  let proposed = dedupeProposedGenres(currentSlots);
  let proposedPrimary = proposed[0] || existingPrimary || normalize(row?.Genre);
  let proposedTopics = topicSuggestions.map((item) => item.topic);
  let status = "Ingen ændring foreslået";
  let reason = "Bevar metadata; der er ikke nok uafhængige signaler til en sikker klassifikation.";
  let confidence = "Lav";
  let changeType = "Uændret";
  if (!existingPrimary && primaryCandidate) {
    proposed = dedupeProposedGenres([primaryCandidate.genre, ...currentSlots.slice(1)]);
    proposedPrimary = proposed[0];
    status = "Afventer redaktionel godkendelse";
    reason = "Mulig primærgenre " + primaryCandidate.genre + " understøttes af metadatafelterne " + primaryCandidate.evidence + ". Udgiverkilde er ikke genverificeret.";
    confidence = primaryCandidate.confidence;
    changeType = "Foreslået primærgenre";
  } else if (existingPrimary && primaryCandidate && proposed.length < 3 && !proposed.some((item) => key(item) === key(primaryCandidate.genre))) {
    proposed = dedupeProposedGenres([...currentSlots, primaryCandidate.genre]);
    status = "Afventer redaktionel godkendelse";
    reason = "Mulig supplerende genre " + primaryCandidate.genre + " understøttes af metadatafelterne " + primaryCandidate.evidence + ". Udgiverkilde er ikke genverificeret.";
    confidence = primaryCandidate.confidence;
    changeType = "Foreslået supplerende genre";
  } else if (!existingPrimary) {
    status = "Blokeret: historisk eller ikke-kanonisk label";
    reason = "Behold den eksisterende label søgbar. Ingen flersignal-klassifikation opfylder kravet.";
  }
  if (topicSuggestions.length && !primaryCandidate) {
    status = "Afventer redaktionel godkendelse";
    reason = "Genredata bevares. Mulige præcise emneord: " + topicSuggestions.map((item) => item.topic + " (" + item.evidence + ")").join("; ") + ".";
    confidence = "Middel";
    changeType = "Foreslåede emner";
  } else if (topicSuggestions.length && primaryCandidate) {
    reason += " Mulige emneord: " + topicSuggestions.map((item) => item.topic).join(", ") + ".";
    changeType += " og emner";
  }
  if (!existingPrimary && primaryCandidate) {
    const replacedLegacyLabel = normalize(currentSlots[0]);
    if (replacedLegacyLabel && !topics.some((topic) => key(topic) === key(replacedLegacyLabel))) {
      proposedTopics = [...proposedTopics, replacedLegacyLabel];
      reason += " Bevar det tidligere primærlabel som søgbart emne: " + replacedLegacyLabel + ".";
      changeType += " med historisk emne";
    }
  }
  proposedTopics = [...new Map(proposedTopics.map((topic) => [key(topic), topic])).values()];
  if (priorHold) {
    status = "Ingen ændring foreslået";
    reason = priorHold.note;
    confidence = "Lav";
    changeType = "Tidligere review: historisk label bevares";
    proposed = dedupeProposedGenres(currentSlots);
    proposedPrimary = proposed[0] || "";
    proposedTopics = [];
  }
  if (priorDecision) {
    proposed = dedupeProposedGenres(currentSlots);
    proposedPrimary = proposed[0] || "";
    proposedTopics = [];
    if (priorDecisionMatches) {
      status = "Ingen ændring foreslået";
      changeType = "Tidligere godkendt og gennemført";
      reason = "Bevar den allerede gennemførte beslutning fra " + priorDecision.source + ".";
      confidence = "Høj";
    } else {
      status = "Blokeret: konflikt med tidligere gennemført beslutning";
      changeType = "Tidligere beslutning kræver afstemning";
      reason = "Katalogets aktuelle genrer afviger fra den dokumenterede beslutning (" + priorDecision.primary + " / " + priorDecision.secondary + "); stop og afstem kilden før review.";
      confidence = "Lav";
    }
  }
  const declared = Number(String(row?.["Antal afsnit"] ?? "").replace(/[^\d]/gu, "")) || null;
  const manual = Array.isArray(row?.manualEpisodes) ? row.manualEpisodes.length : 0;
  const archived = archive?.episodes?.length || 0;
  const currentGenre = normalize(row?.Genre);
  return {
    podcastId: id, catalogueId: normalize(row?.catalogue_id), title,
    sourceClass: sourceInfo[0], sourceAuthority: sourceInfo[1], sourceUrl: normalize(row?.Link || row?.Feed),
    sourceIdentifiers: extractSourceIdentifiers(row), sourceVerified: sourceInfo[2],
    currentPrimary: currentGenre, currentSecondary: normalize(row?.secondaryGenre), currentTertiary: normalize(row?.tertiaryGenre), currentTopics: topics,
    proposedPrimary, proposedSecondary: proposed[1] || "", proposedTertiary: proposed[2] || "", proposedTopics,
    changeType,
    reason, evidence: primaryCandidate?.evidence || "Ingen flersignal-match; katalogmetadata alene.", confidence, status,
    priorAuditDisposition: priorDecisionMatches ? "Previously approved and completed" : priorDecisionConflict ? "Blocked: current values drifted from prior approved decision" : priorHold ? "Previously held: preserve historical label" : "No exact ID-level reconciliation available for the full 136-proposal report",
    priorDecisionSource: priorDecision?.source || null,
    priorManualReviewNote: priorManualReviewNotes.get(id) || "",
    priorManualReviewCategory: priorManualReviewCategories.get(id) || "",
    legacySearchPreservation: /^(sladder|snak|snakke)$/iu.test(currentGenre) ? currentGenre : "",
    genreIssues, metadataIssues, topicIssues, linkStatus, feedStatus, coverStatus, declaredEpisodeCount: declared,
    manualEpisodeCount: manual, structuredArchiveEpisodeCount: archived, rssLiveEpisodeCount: null,
    rssLiveCountStatus: feedStatus === "valid" ? "Ikke hentet read-only" : "Intet gyldigt feed angivet",
    manualVsDeclared: declared === null ? "Ukendt" : manual + " manuelle / " + declared + " oplyste",
    archiveVsDeclared: declared === null ? "Ukendt" : archived + " arkiv / " + declared + " oplyste"
  };
}
const csv = (rows, fields) => [fields.join(";"), ...rows.map((row) => fields.map((field) => csvCell(row[field])).join(";"))].join("\r\n") + "\r\n";
const countBy = (rows, getKey) => {
  const counts = new Map();
  for (const row of rows) counts.set(getKey(row), (counts.get(getKey(row)) || 0) + 1);
  return counts;
};

const catalogueBytes = await readFile(path.join(root, "data/podcasts.json"));
const episodeBytes = await readFile(path.join(root, "data/podcast-episodes.json"));
const payload = JSON.parse(catalogueBytes.toString("utf8"));
const episodePayload = JSON.parse(episodeBytes.toString("utf8"));
const bakspejl = JSON.parse(await readFile(path.join(root, "data/auto-discovered-bakspejl.json"), "utf8"));
const djaevlen = JSON.parse(await readFile(path.join(root, "data/auto-discovered-djaevlen.json"), "utf8"));
const rows = payload.rows;
if (!Array.isArray(rows)) throw new Error("Catalogue payload has no rows array.");
const bakspejlIds = new Set((bakspejl.records || []).map((record) => normalize(record.podcast_id)));
const djaevlenIds = new Set((djaevlen.records || []).map((record) => normalize(record.podcast_id)));
const archive = episodePayload.podcasts || {};
const reportRows = rows.map((row) => inspect(row, archive[normalize(row?.["Podcast-ID"])], owner(normalize(row?.["Podcast-ID"]), bakspejlIds, djaevlenIds)))
  .sort((a, b) => Number(b.status === "Afventer redaktionel godkendelse") - Number(a.status === "Afventer redaktionel godkendelse") || a.podcastId.localeCompare(b.podcastId, "da"));
const podcastIdCounts = countBy(reportRows, (row) => row.podcastId);
const catalogueIdCounts = countBy(reportRows, (row) => row.catalogueId);
const podcastIdSet = new Set(reportRows.map((row) => row.podcastId).filter(Boolean));
const catalogueIdSet = new Set(reportRows.map((row) => row.catalogueId).filter(Boolean));
const crossFieldIdentityConflicts = new Set([...podcastIdSet].filter((id) => catalogueIdSet.has(id)));
for (const row of reportRows) {
  if (podcastIdCounts.get(row.podcastId) > 1) row.metadataIssues.push("duplicate-podcast-id");
  if (catalogueIdCounts.get(row.catalogueId) > 1) row.metadataIssues.push("duplicate-catalogue-id");
  if (crossFieldIdentityConflicts.has(row.podcastId) || podcastIdSet.has(row.catalogueId)) row.metadataIssues.push("podcast-catalogue-id-cross-field-conflict");
  if (!row.sourceUrl) row.metadataIssues.push("missing-source-identification");
  row.metadataIssues = [...new Set(row.metadataIssues)];
}
const suggestions = reportRows.filter((row) => row.status === "Afventer redaktionel godkendelse");
const blockedRows = reportRows.filter((row) => row.status.startsWith("Blokeret"));
const technicalRows = reportRows.filter((row) => row.metadataIssues.length || row.topicIssues.length || row.genreIssues.some((issue) => !issue.startsWith("noncanonical-genre:")));
const oldCandidateLines = (await readFile(path.join(root, "audit-genre-expansion/genre-reclassification-candidates.csv"), "utf8")).replace(/^\uFEFF/u, "").split(/\r?\n/u);
const oldCandidateIds = new Set(oldCandidateLines.slice(1).map((line) => line.match(/^"((?:[^"]|"")*)";/u)?.[1]?.replaceAll('""', '"')).filter(Boolean));
const blockedGroupsMap = new Map();
for (const row of blockedRows) {
  const label = row.currentPrimary || "(tom primærgenre)";
  if (!blockedGroupsMap.has(label)) blockedGroupsMap.set(label, []);
  blockedGroupsMap.get(label).push(row);
}
const blockedReviewGroups = [...blockedGroupsMap.entries()].map(([label, items]) => ({
  currentPrimary: label,
  count: items.length,
  assessment: "Insufficient evidence: no different canonical genre meets the multi-field threshold; this is not proof of misclassification.",
  missingTopics: items.filter((row) => row.metadataIssues.includes("missing-topics")).length,
  priorManualReviewCount: items.filter((row) => row.priorManualReviewNote).length,
  possibleMismatchCount: items.filter((row) => row.priorManualReviewCategory.startsWith("Muligt genremismatch")).length,
  sourceConflictCount: items.filter((row) => row.priorManualReviewCategory.startsWith("Kildekonflikt")).length,
  missingEvidenceReviewCount: items.filter((row) => row.priorManualReviewCategory.startsWith("Manglende evidens")).length,
  otherManualReviewCount: items.filter((row) => row.priorManualReviewNote && !["Muligt genremismatch", "Kildekonflikt", "Manglende evidens"].some((prefix) => row.priorManualReviewCategory.startsWith(prefix))).length,
  podcastIds: items.map((row) => row.podcastId).sort((a, b) => a.localeCompare(b, "da"))
})).sort((a, b) => b.count - a.count || a.currentPrimary.localeCompare(b.currentPrimary, "da"));
const technicalIssueGroups = [...countBy(technicalRows.flatMap((row) => [...row.genreIssues.filter((issue) => !issue.startsWith("noncanonical-genre:")), ...row.metadataIssues, ...row.topicIssues]), (issue) => issue).entries()]
  .map(([issue, count]) => ({ issue, count }))
  .sort((a, b) => b.count - a.count || a.issue.localeCompare(b.issue, "da"));
const completedDecisionRows = reportRows.filter((row) => completedEditorialDecisions.has(row.podcastId));
const heldPriorReviewRows = reportRows.filter((row) => priorReviewHolds.has(row.podcastId));
const priorManualReviewCategoryCounts = Object.fromEntries(countBy(reportRows.filter((row) => row.priorManualReviewCategory), (row) => row.priorManualReviewCategory));
const currentProposalRows = suggestions.map((row) => ({
  podcastId: row.podcastId,
  title: row.title,
  currentPrimary: row.currentPrimary,
  currentSecondary: row.currentSecondary,
  currentTertiary: row.currentTertiary,
  proposedPrimary: row.proposedPrimary,
  proposedSecondary: row.proposedSecondary,
  proposedTertiary: row.proposedTertiary,
  proposedTopics: row.proposedTopics,
  previousCandidateFileMatch: oldCandidateIds.has(row.podcastId),
  prior136IdLevelMatch: "Unresolved: the issue records aggregate results, but the 136-row ID-level source is not versioned in this repository."
}));
const groups = new Map();
for (const row of suggestions) {
  const topicGroup = row.proposedTopics.length ? " | emner: " + row.proposedTopics.join(", ") : "";
  const group = (row.currentPrimary || "(tom)") + " → " + row.proposedPrimary + " | " + row.changeType + topicGroup + " | " + row.confidence;
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(row);
}
const approvalGroups = [...groups.entries()].map(([group, items]) => ({
  group, genre: items[0].proposedPrimary, changeType: items[0].changeType, confidence: items[0].confidence,
  priority: items[0].changeType.includes("primærgenre") ? "P1: primærgenre" : items[0].changeType.includes("supplerende") ? "P2: supplerende genre" : "P3: emneord",
  count: items.length, podcastIds: items.map((item) => item.podcastId), sourceClasses: [...new Set(items.map((item) => item.sourceClass))]
})).sort((a, b) => a.priority.localeCompare(b.priority, "da") || b.count - a.count || a.group.localeCompare(b.group, "da"));
const rawGenreCounts = countBy(rows, (row) => normalize(row?.Genre) || "(tom)");
const genreCoverage = CANONICAL_GENRES.map((genre) => ({
  genre, exactPrimary: rows.filter((row) => normalize(row?.Genre) === genre).length,
  normalizedPrimary: rows.filter((row) => canonicalByKey.get(key(row?.Genre)) === genre).length,
  anyPosition: rows.filter((row) => [row?.Genre, row?.secondaryGenre, row?.tertiaryGenre].some((value) => canonicalByKey.get(key(value)) === genre)).length
}));
const projectedGenreCoverage = CANONICAL_GENRES.map((genre) => {
  const projectedRows = reportRows.map((row) => row.status === "Afventer redaktionel godkendelse"
    ? [row.proposedPrimary, row.proposedSecondary, row.proposedTertiary]
    : [row.currentPrimary, row.currentSecondary, row.currentTertiary]);
  return {
    genre,
    beforePrimary: genreCoverage.find((item) => item.genre === genre)?.normalizedPrimary || 0,
    afterIfAllPendingProposalsApprovedPrimary: reportRows.filter((row) => canonicalByKey.get(key(row.status === "Afventer redaktionel godkendelse" ? row.proposedPrimary : row.currentPrimary)) === genre).length,
    beforeAnyPosition: genreCoverage.find((item) => item.genre === genre)?.anyPosition || 0,
    afterIfAllPendingProposalsApprovedAnyPosition: projectedRows.filter((slots) => slots.some((value) => canonicalByKey.get(key(value)) === genre)).length
  };
});
const sourceCounts = countBy(reportRows, (row) => row.sourceClass);
const ids = rows.map((row) => normalize(row?.["Podcast-ID"]));
const catalogueIds = rows.map((row) => normalize(row?.catalogue_id));
const identityPairs = rows.map((row) => ({ id: normalize(row?.["Podcast-ID"]), catalogueId: normalize(row?.catalogue_id) })).sort((a, b) => a.id.localeCompare(b.id, "da"));
const manualEpisodePairs = rows.map((row) => ({ id: normalize(row?.["Podcast-ID"]), episodes: row?.manualEpisodes || [] })).sort((a, b) => a.id.localeCompare(b.id, "da"));
const historicalAuditReconciliation = {
  earlierAuditProposalCount: 136,
  earlierAuditOutcomesFromIssue376: { reasonable: 98, adjust: 29, sourceCheck: 5, specialDrSource: 1, explicitlyCorrectedByOwner: 3 },
  pendingEarlierAuditAfterThreeCompleted: 133,
  completedDecisionsNamedInIssue376: completedDecisionRows.filter((row) => row.priorDecisionSource?.includes("issue #376")).map((row) => row.podcastId),
  separateApprovedFinanceBatchIssue383Pr388: completedDecisionRows.filter((row) => row.priorDecisionSource?.includes("issue #383")).map((row) => row.podcastId),
  overlapBetweenFinanceBatchAnd136RowList: "Unresolved: the 136-row ID list is unavailable, so do not subtract the separate Finance batch from the 136 aggregate.",
  completedOwnerDecisions: completedDecisionRows.map((row) => ({ podcastId: row.podcastId, title: row.title, currentPrimary: row.currentPrimary, currentSecondary: row.currentSecondary, disposition: row.priorAuditDisposition })),
  legacyCandidateReferenceRows: oldCandidateIds.size,
  previouslyHeldRecords: heldPriorReviewRows.map((row) => ({ podcastId: row.podcastId, title: row.title, disposition: row.priorAuditDisposition })),
  currentMachineProposalCountBeforeHistoricalHold: suggestions.length + heldPriorReviewRows.length,
  currentMachineProposalCountAfterHistoricalHold: suggestions.length,
  exactMatchesToAvailablePriorCandidateReference: currentProposalRows.filter((row) => row.previousCandidateFileMatch).length,
  activeProposalsWithUnresolved136IdCrosswalk: currentProposalRows.filter((row) => row.prior136IdLevelMatch.startsWith("Unresolved")).length,
  limitation: "Issue #376 comments provide aggregate outcomes and selected ID decisions, but the cited 136-row CSV/XLSX ID-level review file is not versioned or attached in the accessible issue thread. Do not label the remaining current proposals as new or as previously reviewed without that source."
};
const summary = {
  generatedAt: payload.generatedAt || null, catalogueGeneratedAt: payload.generatedAt || null, source: payload.source || null,
  rows: rows.length, uniquePodcastIds: new Set(ids).size, missingPodcastIds: ids.filter((id) => !id).length,
  duplicatePodcastIds: ids.length - new Set(ids).size, uniqueCatalogueIds: new Set(catalogueIds).size,
  missingCatalogueIds: catalogueIds.filter((id) => !id).length, duplicateCatalogueIds: catalogueIds.length - new Set(catalogueIds).size,
  crossFieldIdentityConflicts: crossFieldIdentityConflicts.size,
  canonicalGenres: CANONICAL_GENRES, genreCoverage, rawPrimaryGenreCounts: Object.fromEntries([...rawGenreCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"))),
  sourceOwnershipCounts: Object.fromEntries(sourceCounts),
  proposals: { total: suggestions.length, wellSupported: suggestions.filter((row) => row.confidence === "Høj" && row.sourceVerified).length, uncertain: suggestions.filter((row) => row.confidence !== "Høj" || !row.sourceVerified).length, blocked: blockedRows.length, unchanged: reportRows.filter((row) => row.status === "Ingen ændring foreslået").length },
  reviewCategories: {
    wellSupportedChanges: suggestions.filter((row) => row.confidence === "Høj" && row.sourceVerified).length,
    uncertainChanges: suggestions.filter((row) => row.confidence !== "Høj" || !row.sourceVerified).length,
    technicalMetadataFindings: technicalRows.length,
    blockedForInsufficientEvidence: blockedRows.length,
    unchangedOrHistoricallyHeldRows: reportRows.filter((row) => row.status === "Ingen ændring foreslået").length,
    priorApprovedAndCompletedRows: completedDecisionRows.length,
    priorReviewFlagsNeedingEditorialAttention: reportRows.filter((row) => row.priorManualReviewNote).length
  },
  historicalAuditReconciliation,
  priorManualReviewCategoryCounts,
  projectedGenreCoverage,
  blockedReviewGroups,
  technicalIssueGroups,
  quality: {
    genreIssueRows: reportRows.filter((row) => row.genreIssues.length).length,
    metadataIssueRows: reportRows.filter((row) => row.metadataIssues.length).length,
    topicIssueRows: reportRows.filter((row) => row.topicIssues.length).length,
    missingTopicRows: reportRows.filter((row) => row.metadataIssues.includes("missing-topics")).length,
    invalidLinkRows: reportRows.filter((row) => row.linkStatus === "invalid").length,
    invalidFeedRows: reportRows.filter((row) => row.feedStatus === "invalid").length,
    missingCoverRows: reportRows.filter((row) => row.coverStatus === "missing").length,
    invalidCoverReferenceRows: reportRows.filter((row) => row.coverStatus === "invalid" || row.metadataIssues.includes("missing-local-cover-file")).length,
    misplacedDescriptionUrlRows: reportRows.filter((row) => row.metadataIssues.some((issue) => issue.startsWith("url-in-description"))).length,
    episodeListInDescriptionRows: reportRows.filter((row) => row.metadataIssues.some((issue) => issue.startsWith("episode-list-suspected"))).length,
    feedRows: reportRows.filter((row) => row.feedStatus === "valid").length,
    manualEpisodeRows: reportRows.filter((row) => row.manualEpisodeCount > 0).length,
    archivedEpisodeRows: reportRows.filter((row) => row.structuredArchiveEpisodeCount > 0).length,
    liveRssCountsFetched: 0
  },
  positiveIntakeRegression: { title: "Krig", sheetRow: 1339, rule: "Separate candidate; no Podcast-ID or catalogue_id generated" },
  protectedBaseline: {
    identityPairsSha256: sha256(stableJson(identityPairs)), manualEpisodesSha256: sha256(stableJson(manualEpisodePairs)),
    episodeArchiveSha256: sha256(episodeBytes), publishedCatalogueSha256: sha256(catalogueBytes),
    note: "Read-only fingerprints; user accounts, bookmarks, ratings and history are outside this repository and were not queried."
  },
  limits: ["No external publisher sources were fetched.", "Live RSS episode totals were not fetched; declared, manual and structured local archive counts are separate.", "No editorial, Sheet, catalogue, episode, rating, bookmark, account, history or production data was changed."]
};
const flatRows = reportRows.map((row) => ({
  "Podcast-ID": row.podcastId, catalogue_id: row.catalogueId, Titel: row.title, Kildeklasse: row.sourceClass, Kildeejer: row.sourceAuthority,
  Kildelink: row.sourceUrl, Kildeidentifikatorer: row.sourceIdentifiers.join("; "), "Kilde genverificeret": row.sourceVerified ? "Ja" : "Nej",
  "Nuværende primærgenre": row.currentPrimary, "Nuværende 2. genre": row.currentSecondary, "Nuværende 3. genre": row.currentTertiary,
  "Nuværende emner": row.currentTopics.join("; "), "Foreslået primærgenre": row.proposedPrimary, "Foreslået 2. genre": row.proposedSecondary,
  "Foreslået 3. genre": row.proposedTertiary, "Foreslåede emner": row.proposedTopics.join("; "), "Ændringstype": row.changeType,
  Prioritet: row.status === "Afventer redaktionel godkendelse" ? (row.changeType.includes("primærgenre") ? "P1: primærgenre" : row.changeType.includes("supplerende") ? "P2: supplerende genre" : "P3: emneord") : "",
  Begrundelse: row.reason,
  Evidens: row.evidence, Sikkerhed: row.confidence, Status: row.status, "Søgbart historisk label": row.legacySearchPreservation,
  "Genreproblemer": row.genreIssues.join("; "), "Metadata-problemer": row.metadataIssues.join("; "), "Emneproblemer": row.topicIssues.join("; "),
  "Link status": row.linkStatus, "Feed status": row.feedStatus, "Cover status": row.coverStatus, "Oplyste episoder": row.declaredEpisodeCount ?? "",
  "Manuelle episoder": row.manualEpisodeCount, "Struktureret episodearkiv": row.structuredArchiveEpisodeCount, "RSS-episoder live": row.rssLiveCountStatus,
  "Manuel / oplyst": row.manualVsDeclared, "Arkiv / oplyst": row.archiveVsDeclared
}));
const fields = Object.keys(flatRows[0] || {});
const decisions = flatRows.filter((row) => row.Status === "Afventer redaktionel godkendelse");
const groupRows = approvalGroups.map((group) => ({
  Reviewgruppe: group.group, Prioritet: group.priority, Genre: group.genre, Ændringstype: group.changeType, Sikkerhed: group.confidence,
  Antal: group.count, PodcastIDs: group.podcastIds.join("; "), Kildeklasser: group.sourceClasses.join("; ")
}));
const groupFields = Object.keys(groupRows[0] || { Reviewgruppe: "", Prioritet: "", Genre: "", Ændringstype: "", Sikkerhed: "", Antal: "", PodcastIDs: "", Kildeklasser: "" });
const blockedGroupRows = blockedReviewGroups.map((group) => ({
  "Aktuel primærgenre": group.currentPrimary, Antal: group.count, Vurdering: group.assessment,
  "Uden emner": group.missingTopics, "Tidligere manuel review-note": group.priorManualReviewCount, "Podcast-ID'er": group.podcastIds.join("; ")
}));
const blockedGroupFields = Object.keys(blockedGroupRows[0] || { "Aktuel primærgenre": "", Antal: "", Vurdering: "", "Uden emner": "", "Tidligere manuel review-note": "", "Podcast-ID'er": "" });
const technicalFlatRows = flatRows.filter((row) => row["Genreproblemer"] || row["Metadata-problemer"] || row["Emneproblemer"]);
const reconciliationRows = [
  ...completedDecisionRows.map((row) => ({
    "Podcast-ID": row.podcastId, Titel: row.title, Kategori: "Tidligere godkendt og allerede gennemført",
    "Førværdi i aktuel main": [row.currentPrimary, row.currentSecondary, row.currentTertiary].filter(Boolean).join(" / "),
    "Aktuelt forslag": "Intet — udeladt fra forslagskøen", "Match til versioneret ældre kandidatfil": "Ikke relevant",
    "Match til 136-ID-listen": row.priorDecisionSource.includes("issue #376") ? "ID navngivet som gennemført i issue #376" : "Separat godkendt Finans-batch (#383 / PR #388); overlap med 136-ID-listen ukendt", Kilde: row.priorDecisionSource
  })),
  ...heldPriorReviewRows.map((row) => ({
    "Podcast-ID": row.podcastId, Titel: row.title, Kategori: "Tidligere review — historisk label bevares",
    "Førværdi i aktuel main": [row.currentPrimary, row.currentSecondary, row.currentTertiary].filter(Boolean).join(" / "),
    "Aktuelt forslag": "Intet — maskinforslag undertrykt", "Match til versioneret ældre kandidatfil": "Ja — konkret hold",
    "Match til 136-ID-listen": "Exact 136-ID crosswalk unavailable", Kilde: row.priorAuditDisposition
  })),
  ...currentProposalRows.map((row) => ({
    "Podcast-ID": row.podcastId, Titel: row.title, Kategori: "Nyt maskinforslag — afventer kilde-/redaktionel review",
    "Førværdi i aktuel main": [row.currentPrimary, row.currentSecondary, row.currentTertiary].filter(Boolean).join(" / "),
    "Aktuelt forslag": [row.proposedPrimary, row.proposedSecondary, row.proposedTertiary].filter(Boolean).join(" / ") + (row.proposedTopics.length ? " | emner: " + row.proposedTopics.join(", ") : ""),
    "Match til versioneret ældre kandidatfil": row.previousCandidateFileMatch ? "Ja — kræver hold-/beslutningsreview" : "Nej",
    "Match til 136-ID-listen": row.prior136IdLevelMatch, Kilde: "Aktuel katalogmetadata; ingen udgiverkilde genverificeret"
  }))
];
const reconciliationFields = Object.keys(reconciliationRows[0] || { "Podcast-ID": "", Titel: "", Kategori: "", "Førværdi i aktuel main": "", "Aktuelt forslag": "", "Match til versioneret ældre kandidatfil": "", "Match til 136-ID-listen": "", Kilde: "" });
const manualReviewRows = reportRows.filter((row) => row.priorManualReviewNote).map((row) => ({
  "Podcast-ID": row.podcastId, Titel: row.title, "Aktuelle genrer": [row.currentPrimary, row.currentSecondary, row.currentTertiary].filter(Boolean).join(" / "),
  "Reviewtype": row.priorManualReviewCategory, "Tidligere vurdering": row.priorManualReviewNote, "Aktuel disposition": row.priorAuditDisposition,
  "Kildeklasse": row.sourceClass, "Kildelink": row.sourceUrl
}));
const manualReviewFields = Object.keys(manualReviewRows[0] || { "Podcast-ID": "", Titel: "", "Aktuelle genrer": "", Reviewtype: "", "Tidligere vurdering": "", "Aktuel disposition": "", "Kildeklasse": "", "Kildelink": "" });
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "catalogue-quality-report.json"), JSON.stringify({ summary, approvalGroups, reconciliationRows, records: reportRows }) + "\n");
await writeFile(path.join(outputDirectory, "full-catalogue.csv"), "\uFEFF" + csv(flatRows, fields));
await writeFile(path.join(outputDirectory, "approval-decisions.csv"), "\uFEFF" + csv(decisions, fields));
await writeFile(path.join(outputDirectory, "approval-groups.csv"), "\uFEFF" + csv(groupRows, groupFields));
await writeFile(path.join(outputDirectory, "blocked-review-groups.csv"), "\uFEFF" + csv(blockedGroupRows, blockedGroupFields));
await writeFile(path.join(outputDirectory, "technical-metadata-review.csv"), "\uFEFF" + csv(technicalFlatRows, fields));
await writeFile(path.join(outputDirectory, "historical-audit-reconciliation.csv"), "\uFEFF" + csv(reconciliationRows, reconciliationFields));
await writeFile(path.join(outputDirectory, "manual-review-followups.csv"), "\uFEFF" + csv(manualReviewRows, manualReviewFields));
const genreLines = genreCoverage.map((item) => "| " + item.genre + " | " + item.exactPrimary + " | " + item.normalizedPrimary + " | " + item.anyPosition + " |");
const projectedGenreLines = projectedGenreCoverage.map((item) => "| " + item.genre + " | " + item.beforePrimary + " | " + item.afterIfAllPendingProposalsApprovedPrimary + " | " + item.beforeAnyPosition + " | " + item.afterIfAllPendingProposalsApprovedAnyPosition + " |");
const rawLines = [...rawGenreCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da")).map(([genre, count]) => "| " + genre + " | " + count + " |");
const groupLines = approvalGroups.map((group) => "| " + group.priority + " | " + group.group + " | " + group.count + " | " + group.podcastIds.join(", ") + " |");
const blockedLines = blockedReviewGroups.map((group) => "| " + group.currentPrimary + " | " + group.count + " | " + group.missingTopics + " | " + group.possibleMismatchCount + " | " + group.sourceConflictCount + " | " + group.missingEvidenceReviewCount + " | " + group.otherManualReviewCount + " | " + group.podcastIds.join(", ") + " |");
const technicalLines = technicalIssueGroups.map((item) => "| " + item.issue + " | " + item.count + " |");
const manualFlagLines = reportRows.filter((row) => row.priorManualReviewNote).map((row) => "| " + row.podcastId + " | " + row.title + " | " + row.priorManualReviewNote + " |");
const markdown = [
  "# Katalogkvalitet og genreforslag", "",
  "Katalog: " + summary.rows + " rækker, " + summary.uniquePodcastIds + " unikke Podcast-ID'er og " + summary.uniqueCatalogueIds + " unikke catalogue_id'er. Katalogets generatedAt: " + summary.catalogueGeneratedAt + ".", "",
  "## Identitet og dataproveniens", "",
  "Podcast-ID: " + summary.missingPodcastIds + " mangler, " + summary.duplicatePodcastIds + " dubletter. catalogue_id: " + summary.missingCatalogueIds + " mangler, " + summary.duplicateCatalogueIds + " dubletter. Krydsfelt-konflikter: " + summary.crossFieldIdentityConflicts + ".",
  "Kildeejerskab: " + [...sourceCounts].map(([name, count]) => name + " " + count).join("; ") + ".",
  "ID-par SHA-256: " + summary.protectedBaseline.identityPairsSha256,
  "Manuelle episoder SHA-256: " + summary.protectedBaseline.manualEpisodesSha256,
  "Episodearkiv SHA-256: " + summary.protectedBaseline.episodeArchiveSha256, "",
  "Fingerprints er read-only baselineværdier. Brugerprofiler, bogmærker, ratings og historik ligger uden for dette katalog og blev ikke forespurgt.", "",
  "## Dækning efter kanonisk genre", "", "| Genre | Eksakt primær | Case-normaliseret primær | På en vilkårlig position |", "|---|---:|---:|---:|", ...genreLines, "",
  "### Hvis alle aktuelle, usikre forslag senere godkendes", "", "| Genre | Før: primær | Efter: primær | Før: alle positioner | Efter: alle positioner |", "|---|---:|---:|---:|---:|", ...projectedGenreLines, "",
  "## Aktuelle primærgenrelabels", "", "| Label | Antal |", "|---|---:|", ...rawLines, "",
  "Ikke-kanoniske labels er fund, ikke automatisk redaktionelle fejl. Historiske labels, herunder Sladder, skal forblive søgbare.", "",
  "## Reviewforslag", "",
  "Aktive forslag " + summary.proposals.total + "; velunderbyggede " + summary.proposals.wellSupported + "; usikre " + summary.proposals.uncertain + "; blokerede pga. utilstrækkelig evidens " + summary.proposals.blocked + "; uændrede/bevarede " + summary.proposals.unchanged + ".",
  "Alle aktive forslag afventer godkendelse; ingen eksterne udgiverkilder er genverificeret. Tidligere godkendte valg: " + completedDecisionRows.length + "; tidligere holdte labels: " + heldPriorReviewRows.length + ".", "",
  "| Prioritet | Reviewgruppe | Antal | Podcast-ID'er |", "|---|---|---:|---|", ...groupLines, "",
  "approval-decisions.csv indeholder konkrete før/efter-forslag. full-catalogue.csv indeholder én række pr. katalog-ID, også uden forslag.", "",
  "## Afstemning mod issue #376's 136 tidligere forslag", "",
  "Issue-kommentaren registrerer 136 tidligere forslag fordelt på 98 rimelige, 29 der bør justeres, 5 med kildeforbehold, 1 DR-kildecase og 3 allerede rettet af ejeren. De 3 gennemførte Podcast-ID'er er udeladt fra forslagene. Derudover er 17 primærgenreændringer fra Finans-batchen i issue #383 allerede publiceret i PR #388; de listes særskilt, og overlap med de 136 kan ikke fastslås. 1 yderligere aktuelt maskinforslag (`se og hor lige her`) er undertrykt, fordi den versionerede ældre kandidatfil udtrykkeligt bevarer Sladder indtil særskilt godkendelse.",
  "Den versionerede referencefil indeholder " + oldCandidateIds.size + " ID'er, men ikke den fulde ID-liste for de 136. Af de " + suggestions.length + " tilbageværende forslag kan overlap med de 136 derfor ikke afgøres på ID-niveau. Rapporten markerer dem som uafklarede frem for at kalde dem nye eller genbehandlede. Se historical-audit-reconciliation.csv.", "",
  "| Podcast-ID | Titel | Tidligere disposition | Aktuel værdi |", "|---|---|---|---|",
  ...completedDecisionRows.map((row) => "| " + row.podcastId + " | " + row.title + " | Allerede godkendt og gennemført (" + row.priorDecisionSource + ") | " + row.currentPrimary + " / " + row.currentSecondary + " |"),
  ...heldPriorReviewRows.map((row) => "| " + row.podcastId + " | " + row.title + " | Bevar historisk Sladder; forslag undertrykt | " + row.currentPrimary + " / " + row.currentSecondary + " |"), "",
  "## Blokerede labels: evidensmangel vs. mulige fejl", "",
  "De blokerede poster opfylder ikke auditens krav om flere signalgrupper på tværs af felter. Det er evidensmangel, ikke i sig selv bevis på forkert genre. De konkrete poster, som tidligere manuel review i #376 markerede til yderligere undersøgelse, står separat nedenfor; de ændres ikke automatisk.", "",
  "| Aktuel primærlabel | Antal | Uden emner | Muligt mismatch* | Kildekonflikt | Manglende evidens | Andre noter | Podcast-ID'er |", "|---|---:|---:|---:|---:|---:|---:|---|", ...blockedLines, "",
  "* De 9 historiske manuelle noter gælder katalogposter på tværs af dispositioner: " + Object.entries(priorManualReviewCategoryCounts).map(([category, count]) => count + " " + category).join("; ") + ". Kun " + blockedReviewGroups.reduce((sum, group) => sum + group.priorManualReviewCount, 0) + " af noterne overlapper de 158 blokerede rækker. Mulige genremismatches er reviewflag, ikke bekræftede fejl; ingen af noterne dokumenterer alene en bekræftet fejl.", "",
  "### Tidligere manuelle reviewnoter fra #376", "", "| Podcast-ID | Titel | Reviewtype | Note (afventer kilde-/redaktionel afstemning) |", "|---|---|---|---|", ...reportRows.filter((row) => row.priorManualReviewNote).map((row) => "| " + row.podcastId + " | " + row.title + " | " + row.priorManualReviewCategory + " | " + row.priorManualReviewNote + " |"), "",
  "## Tekniske metadatafund", "", "| Fundtype | Forekomster |", "|---|---:|", ...technicalLines, "",
  "Se technical-metadata-review.csv for præcise Podcast-ID'er og tekniske metadatafund pr. post; ikke-kanoniske genrelabels er adskilt i blokkeringsgrupperne og er ikke talt som tekniske fejl.", "",
  "## Metadata og episoder", "",
  "Rækker med genrelabel-/slotproblemer " + summary.quality.genreIssueRows + "; tekniske metadatafund " + summary.reviewCategories.technicalMetadataFindings + " (metadata-problemer " + summary.quality.metadataIssueRows + "; emneproblemer " + summary.quality.topicIssueRows + "). Manglende emner " + summary.quality.missingTopicRows + "; ugyldige URL-formater " + summary.quality.invalidLinkRows + "; ugyldige feed-URL-formater " + summary.quality.invalidFeedRows + "; manglende covers " + summary.quality.missingCoverRows + "; fejlformaterede coverreferencer " + summary.quality.invalidCoverReferenceRows + ". Ikke-kanoniske/historiske labels er ikke automatisk fejl.",
  "Muligt link i beskrivelse " + summary.quality.misplacedDescriptionUrlRows + "; mulig episodeliste i beskrivelsesfelter " + summary.quality.episodeListInDescriptionRows + ".",
  "Rækker med gyldigt feed " + summary.quality.feedRows + "; manualEpisodes " + summary.quality.manualEpisodeRows + "; struktureret episodearkiv " + summary.quality.archivedEpisodeRows + ".",
  "Feed, oplyst episodeantal, manualEpisodes og lokalt struktureret episodearkiv vises særskilt. Live RSS-tal blev ikke hentet.", "",
  "## Intake-regression", "",
  "Ark1 række 1339, Krig, skal blive en separat Sheet-intake-kandidat. Den mangler Podcast-ID, har en feed-URL i Kort beskrivelse og en episodeoversigt i Undervurderet perle. Systemet må ikke slette rækken, oprette Podcast-ID krig, tildele catalogue_id eller flytte episoder automatisk.", "",
  "Ingen Sheet-, katalog-, genre-, emne-, episode-, rating-, bruger- eller produktionsdata blev ændret.", ""
].join("\n");
await writeFile(path.join(outputDirectory, "catalogue-quality-report.md"), markdown);
console.log("Read-only audit complete: " + rows.length + " catalogue rows; " + suggestions.length + " proposals; " + summary.proposals.blocked + " blocked legacy rows.");
