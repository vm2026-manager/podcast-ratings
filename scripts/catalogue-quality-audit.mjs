import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CANONICAL_GENRES } from "./catalogue-intake.mjs";
import { suggestGenres, suggestSearchTopics } from "./catalogue-quality-rules.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "audit-catalogue-quality");
const normalize = (input) => String(input ?? "").trim().replace(/\s+/gu, " ");
const key = (input) => normalize(input).normalize("NFKC").toLocaleLowerCase("da-DK");
const canonicalByKey = new Map(CANONICAL_GENRES.map((genre) => [key(genre), genre]));
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
  const current = [row?.Genre, row?.secondaryGenre, row?.tertiaryGenre].map(normalize).filter(Boolean);
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
  const proposed = current.slice();
  let proposedPrimary = existingPrimary || normalize(row?.Genre);
  let status = "Ingen ændring foreslået";
  let reason = "Bevar metadata; der er ikke nok uafhængige signaler til en sikker klassifikation.";
  let confidence = "Lav";
  let changeType = "Uændret";
  if (!existingPrimary && primaryCandidate) {
    proposedPrimary = primaryCandidate.genre;
    proposed[0] = primaryCandidate.genre;
    status = "Afventer redaktionel godkendelse";
    reason = "Mulig primærgenre " + primaryCandidate.genre + " understøttes af metadatafelterne " + primaryCandidate.evidence + ". Udgiverkilde er ikke genverificeret.";
    confidence = primaryCandidate.confidence;
    changeType = "Foreslået primærgenre";
  } else if (existingPrimary && primaryCandidate && proposed.length < 3 && !proposed.some((item) => key(item) === key(primaryCandidate.genre))) {
    proposed.push(primaryCandidate.genre);
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
  const declared = Number(String(row?.["Antal afsnit"] ?? "").replace(/[^\d]/gu, "")) || null;
  const manual = Array.isArray(row?.manualEpisodes) ? row.manualEpisodes.length : 0;
  const archived = archive?.episodes?.length || 0;
  const currentGenre = normalize(row?.Genre);
  return {
    podcastId: id, catalogueId: normalize(row?.catalogue_id), title,
    sourceClass: sourceInfo[0], sourceAuthority: sourceInfo[1], sourceUrl: normalize(row?.Link || row?.Feed),
    sourceIdentifiers: extractSourceIdentifiers(row), sourceVerified: sourceInfo[2],
    currentPrimary: currentGenre, currentSecondary: normalize(row?.secondaryGenre), currentTertiary: normalize(row?.tertiaryGenre), currentTopics: topics,
    proposedPrimary, proposedSecondary: proposed[1] || "", proposedTertiary: proposed[2] || "", proposedTopics: topicSuggestions.map((item) => item.topic),
    changeType,
    reason, evidence: primaryCandidate?.evidence || "Ingen flersignal-match; katalogmetadata alene.", confidence, status,
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
const sourceCounts = countBy(reportRows, (row) => row.sourceClass);
const ids = rows.map((row) => normalize(row?.["Podcast-ID"]));
const catalogueIds = rows.map((row) => normalize(row?.catalogue_id));
const identityPairs = rows.map((row) => ({ id: normalize(row?.["Podcast-ID"]), catalogueId: normalize(row?.catalogue_id) })).sort((a, b) => a.id.localeCompare(b.id, "da"));
const manualEpisodePairs = rows.map((row) => ({ id: normalize(row?.["Podcast-ID"]), episodes: row?.manualEpisodes || [] })).sort((a, b) => a.id.localeCompare(b.id, "da"));
const summary = {
  generatedAt: payload.generatedAt || null, catalogueGeneratedAt: payload.generatedAt || null, source: payload.source || null,
  rows: rows.length, uniquePodcastIds: new Set(ids).size, missingPodcastIds: ids.filter((id) => !id).length,
  duplicatePodcastIds: ids.length - new Set(ids).size, uniqueCatalogueIds: new Set(catalogueIds).size,
  missingCatalogueIds: catalogueIds.filter((id) => !id).length, duplicateCatalogueIds: catalogueIds.length - new Set(catalogueIds).size,
  crossFieldIdentityConflicts: crossFieldIdentityConflicts.size,
  canonicalGenres: CANONICAL_GENRES, genreCoverage, rawPrimaryGenreCounts: Object.fromEntries([...rawGenreCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"))),
  sourceOwnershipCounts: Object.fromEntries(sourceCounts),
  proposals: { total: suggestions.length, secure: suggestions.filter((row) => row.confidence === "Høj").length, uncertain: suggestions.filter((row) => row.confidence !== "Høj").length, blocked: reportRows.filter((row) => row.status.startsWith("Blokeret")).length, unchanged: reportRows.filter((row) => row.status === "Ingen ændring foreslået").length },
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
await mkdir(outputDirectory, { recursive: true });
await writeFile(path.join(outputDirectory, "catalogue-quality-report.json"), JSON.stringify({ summary, approvalGroups, records: reportRows }) + "\n");
await writeFile(path.join(outputDirectory, "full-catalogue.csv"), "\uFEFF" + csv(flatRows, fields));
await writeFile(path.join(outputDirectory, "approval-decisions.csv"), "\uFEFF" + csv(decisions, fields));
await writeFile(path.join(outputDirectory, "approval-groups.csv"), "\uFEFF" + csv(groupRows, groupFields));
const genreLines = genreCoverage.map((item) => "| " + item.genre + " | " + item.exactPrimary + " | " + item.normalizedPrimary + " | " + item.anyPosition + " |");
const rawLines = [...rawGenreCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da")).map(([genre, count]) => "| " + genre + " | " + count + " |");
const groupLines = approvalGroups.map((group) => "| " + group.priority + " | " + group.group + " | " + group.count + " | " + group.podcastIds.join(", ") + " |");
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
  "## Aktuelle primærgenrelabels", "", "| Label | Antal |", "|---|---:|", ...rawLines, "",
  "Ikke-kanoniske labels er fund, ikke automatisk redaktionelle fejl. Historiske labels, herunder Sladder, skal forblive søgbare.", "",
  "## Reviewforslag", "",
  "Forslag " + summary.proposals.total + "; sikre " + summary.proposals.secure + "; usikre " + summary.proposals.uncertain + "; blokerede " + summary.proposals.blocked + "; uændrede " + summary.proposals.unchanged + ".",
  "Konkrete genreændringer kræver mindst to semantiske signalgrupper på tværs af mindst to metadatafelter. Eksterne udgiverkilder er ikke genverificeret i denne audit; alle forslag afventer redaktionel godkendelse.", "",
  "| Prioritet | Reviewgruppe | Antal | Podcast-ID'er |", "|---|---|---:|---|", ...groupLines, "",
  "approval-decisions.csv indeholder konkrete før/efter-forslag. full-catalogue.csv indeholder én række pr. katalog-ID, også uden forslag.", "",
  "## Metadata og episoder", "",
  "Rækker med genreproblemer " + summary.quality.genreIssueRows + "; metadata-problemer " + summary.quality.metadataIssueRows + "; emneproblemer " + summary.quality.topicIssueRows + ". Manglende emner " + summary.quality.missingTopicRows + "; ugyldige links " + summary.quality.invalidLinkRows + "; ugyldige feeds " + summary.quality.invalidFeedRows + "; manglende covers " + summary.quality.missingCoverRows + "; fejlformaterede coverreferencer " + summary.quality.invalidCoverReferenceRows + ".",
  "Muligt link i beskrivelse " + summary.quality.misplacedDescriptionUrlRows + "; mulig episodeliste i beskrivelsesfelter " + summary.quality.episodeListInDescriptionRows + ".",
  "Rækker med gyldigt feed " + summary.quality.feedRows + "; manualEpisodes " + summary.quality.manualEpisodeRows + "; struktureret episodearkiv " + summary.quality.archivedEpisodeRows + ".",
  "Feed, oplyst episodeantal, manualEpisodes og lokalt struktureret episodearkiv vises særskilt. Live RSS-tal blev ikke hentet.", "",
  "## Intake-regression", "",
  "Ark1 række 1339, Krig, skal blive en separat Sheet-intake-kandidat. Den mangler Podcast-ID, har en feed-URL i Kort beskrivelse og en episodeoversigt i Undervurderet perle. Systemet må ikke slette rækken, oprette Podcast-ID krig, tildele catalogue_id eller flytte episoder automatisk.", "",
  "Ingen Sheet-, katalog-, genre-, emne-, episode-, rating-, bruger- eller produktionsdata blev ændret.", ""
].join("\n");
await writeFile(path.join(outputDirectory, "catalogue-quality-report.md"), markdown);
console.log("Read-only audit complete: " + rows.length + " catalogue rows; " + suggestions.length + " proposals; " + summary.proposals.blocked + " blocked legacy rows.");
