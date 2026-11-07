// This client can write only to a separate editorial staging spreadsheet.
// Production Ark1 is intentionally inaccessible from GitHub Actions.
import { VERIFIED_DR_SERIES_METADATA } from "./verified-dr-series-metadata.mjs";
import { extractExplicitDrHostCredit } from "./dr-host-credit.mjs";
import { RADIO_IIII_MAIN_SERIES, RADIO_IIII_HOST } from "./radio-iiii-auto-discovery.mjs";
import { createHash } from "node:crypto";
import { TYRAN_PROTECTED_IDS, normalizeTyranIdentity } from "./tyran-auto-discovery.mjs";

export const STAGING_TAB = "DR staging";
export const RADIO_IIII_STAGING_TAB = "Radio IIII staging";
export const ORIGINAL_SHEET_ID = "1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss";
export const CATALOGUE_HEADERS = Object.freeze([
  "Placering", "Titel", "Vært", "Vuring (1-10)", "Genre", "Udgiver", "Hovedserie",
  "Antal afsnit", "Årstal afspillet", "Link", "Afgivet vurdering", "Billedlink",
  "Kort beskrivelse", "Undervurderet perle", "Lang beskrivelse", "2. genre", "Emner",
  "Episoder", "Feed", "Supplerende ligheder", "Uaktuel", "Podcast-ID", "Adgang",
  "Kilde", "Tjekket dato", "Engelsk", "", "", "", "", "Nævneværdige episo:"
]);
export const STAGING_HEADERS = Object.freeze([
  ...CATALOGUE_HEADERS,
  "DR source GUID", "DR source URL", "DR source description", "Review status"
]);
export const RADIO_IIII_STAGING_HEADERS = Object.freeze([
  ...CATALOGUE_HEADERS, "Radio IIII source GUIDs", "Radio IIII source URL",
  "Radio IIII season URL", "Radio IIII source description", "Review status"
]);

// The sheet does not gain columns for Tyran: its existing DR provenance cells
// carry the separately verified child-series and full-episode identities.
// Marcos is already a historical Ark1 identity and is intentionally not staged.
export const TYRAN_EXISTING_ARK1_IDENTITIES = Object.freeze({
  marcos: Object.freeze({ podcastId: "marcos", title: "Marcos", mainSeries: "Tyran",
    seriesUrl: "https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949" })
});
export const VERIFIED_TYRAN_STAGING_IDENTITIES = Object.freeze({
  macias: Object.freeze({
    podcastId: "tyran-auto-v1-08d0021f", title: "Macias", mainSeries: "Tyran",
    seriesProductionNumber: "6641072699897", seriesId: "urn:dr:radio:series:6a3e55fa1645505efca628b6",
    seriesUrl: "https://www.dr.dk/lyd/p3/tyran-macias-6641072699897",
    coverImageId: "6a4e30ea60319a54701828b9",
    coverUrl: "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6a4e30ea60319a54701828b9?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29",
    coverSha256: "5f8fa9bba69c3a5718623ea846d2608affd0074c8437411159c3240b429e4425", coverByteLength: 195791,
    episodeTitle: "1:4 - Macias", episodeGuid: "16122693681", episodeUrl: "https://www.dr.dk/lyd/p3/tyran-macias/tyran-macias-22/1-4-macias-16122693681",
    episodePublishedAt: "2026-08-06T03:00:00.000Z", episodeDurationSeconds: 2234,
    descriptionSha256: "25f065f9ab606d61e9f32b497d6f50297e45c705917f8297f3892b28712f4897"
  }),
  marcos: Object.freeze({
    podcastId: "marcos", title: "Marcos", mainSeries: "Tyran",
    seriesProductionNumber: "6641325831949", seriesId: "urn:dr:radio:series:6ad1ecb299797788ba19118f",
    seriesUrl: "https://www.dr.dk/lyd/p3/tyran-marcos-6641325831949",
    coverImageId: "6ad8a63dd1248e67782813bf",
    coverUrl: "https://asset.dr.dk/drlyd/images/urn:dr:radio:image:6ad8a63dd1248e67782813bf?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29",
    coverSha256: "3168d4eeb2db7a75e5b4644931fc37b0ba2cb7bd175b450c775c0101c58f3173", coverByteLength: 229851,
    episodeTitle: "1:6 - Marcos", episodeGuid: "16122693711", episodeUrl: "https://www.dr.dk/lyd/p3/tyran-marcos/tyran-marcos-24/1-6-marcos-16122693711",
    episodePublishedAt: "2026-10-22T03:00:00.000Z", episodeDurationSeconds: 1878,
    descriptionSha256: "fd74bab19d25eced774d75634ffa3ef5cc9f2f8210700165a00ad24c6c801edd"
  })
});

const normal = (value) => String(value ?? "").normalize("NFC").trim();

function plainSourceText(value) {
  return String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ").replace(/&amp;/giu, "&").replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
    .replace(/\s+/gu, " ").trim();
}

function boundedSourceExcerpt(text, maxLength) {
  if (text.length <= maxLength) return text;
  const sentence = text.slice(0, maxLength + 1).match(/^.{100,}[.!?](?=\s|$)/u)?.[0];
  return sentence || "";
}

export function buildStagingRow(record, checkedDate = new Date().toISOString().slice(0, 10)) {
  const id = normal(record?.podcast_id ?? record?.["Podcast-ID"]);
  const title = normal(record?.title ?? record?.Titel);
  const mainSeries = normal(record?.hovedserie ?? record?.Hovedserie);
  if (mainSeries === "Tyran") return buildTyranStagingRow(record, checkedDate);
  const curated = VERIFIED_DR_SERIES_METADATA[id];
  const description = plainSourceText(record?.source_description || curated?.sourceDescription || curated?.longDescription);
  const parsedHost = extractExplicitDrHostCredit(record?.source_description || "");
  const curatedCredit = extractExplicitDrHostCredit(curated?.sourceHostCredit || "");
  const hostConflict = parsedHost.conflict || Boolean(parsedHost.host && curated?.host && parsedHost.host !== curated.host) ||
    Boolean(curated?.host && curatedCredit.host && curatedCredit.host !== curated.host);
  const host = hostConflict ? "" : parsedHost.host || (curated?.sourceHostCredit ? curatedCredit.host : "");
  const sourceDescription = [description, curated?.sourceHostCredit]
    .filter((value, index, all) => value && (index === 0 || !all[0].includes(value)))
    .join(" ");
  const episodeGuid = normal(record?.source_episode_guid || curated?.sourceEpisodeGuid);
  const sourceUrl = normal(record?.source_url || curated?.sourceUrl);
  if (!id || !title || !["Bakspejl", "Djævlen i detaljen"].includes(mainSeries)) {
    throw new Error("DR staging candidate identity is incomplete or outside the approved umbrella series");
  }
  if (curated && (curated.title !== title || curated.mainSeries !== mainSeries)) {
    throw new Error(`Verified DR metadata identity/source mismatch for ${id}`);
  }
  const expectedPath = mainSeries === "Bakspejl" ? "/lyd/special-radio/bakspejl/" : "/lyd/special-radio/djaevlen-i-detaljen/";
  const expectedPrefix = mainSeries === "Bakspejl" ? "bakspejl-auto-v1-" : "djaevlen-auto-v1-";
  const isGeneratedId = id.startsWith(expectedPrefix) && /^[a-f0-9]{8}$/u.test(id.slice(expectedPrefix.length));
  const isVerifiedLegacyId = Boolean(curated && curated.title === title && curated.mainSeries === mainSeries);
  if (!sourceUrl.startsWith(`https://www.dr.dk${expectedPath}`) || /[?#]/u.test(sourceUrl) ||
      (!isGeneratedId && !isVerifiedLegacyId) ||
      !/^\d{6,}$/u.test(episodeGuid) || !sourceUrl.endsWith(episodeGuid)) {
    throw new Error("DR staging candidate lacks a verifiable official full-episode source");
  }

  if (curated && (curated.sourceEpisodeGuid !== episodeGuid || curated.sourceUrl !== sourceUrl ||
      (curated.sourceDescription && record?.source_description && normal(curated.sourceDescription) !== normal(record.source_description)))) {
    throw new Error(`Verified DR metadata identity/source mismatch for ${id}`);
  }
  const values = Array(STAGING_HEADERS.length).fill("");
  const set = (header, value) => { values[STAGING_HEADERS.indexOf(header)] = String(value ?? ""); };
  const generatedShort = boundedSourceExcerpt(description, 240);
  const generatedLong = description.slice(0, 1800);
  for (const [header, value] of Object.entries({
    Titel: title,
    "Vært": host,
    Genre: curated?.genre || "",
    Udgiver: "DR",
    Hovedserie: mainSeries,
    Link: sourceUrl,
    Billedlink: record?.cover || "",
    "Kort beskrivelse": curated?.shortDescription || generatedShort,
    "Lang beskrivelse": curated?.longDescription || generatedLong,
    Emner: curated?.topics.join("; ") || "",
    "Supplerende ligheder": curated?.supplementarySimilarities.join("; ") || "",
    "Podcast-ID": id,
    Kilde: sourceUrl,
    "Tjekket dato": checkedDate,
    "DR source GUID": episodeGuid,
    "DR source URL": sourceUrl,
    "DR source description": sourceDescription,
    "Review status": hostConflict || (!host && /\bvært\b/iu.test(record?.source_description || ""))
      ? "NEEDS_EDITORIAL_REVIEW"
      : curated ? "SOURCE_VERIFIED_REQUIRES_OWNER_APPROVAL" : "NEEDS_EDITORIAL_REVIEW"
  })) set(header, value);
  // Only an explicit host-role credit may populate Vært; ratings and history remain blank.
  return values;
}

function buildTyranStagingRow(record, checkedDate) {
  const id = normal(record?.podcast_id ?? record?.["Podcast-ID"]);
  const title = normal(record?.title ?? record?.Titel);
  const expected = Object.values(VERIFIED_TYRAN_STAGING_IDENTITIES).find((identity) => identity.podcastId === id);
  const episode = record?.first_full_episode;
  const description = String(record?.description ?? "").trim();
  const descriptionUrl = normal(record?.description_source_url);
  const digest = (value) => createHash("sha256").update(String(value), "utf8").digest("hex");
  if (!expected || title !== expected.title || normal(record?.hovedserie ?? record?.Hovedserie) !== expected.mainSeries ||
      normal(record?.discovery_key) !== title.toLowerCase() || normal(record?.publisher) !== "DR" ||
      normal(record?.source_url) !== expected.seriesUrl || normal(record?.source_series_production_number) !== expected.seriesProductionNumber ||
      normal(record?.dr_series_id) !== expected.seriesId || normal(record?.cover_image_id) !== expected.coverImageId ||
      normal(record?.cover_source_url) !== expected.coverUrl || normal(record?.cover_sha256) !== expected.coverSha256 ||
      record?.cover_mime_type !== "image/jpeg" || record?.cover_width !== 720 || record?.cover_height !== 720 ||
      record?.cover_byte_length !== expected.coverByteLength || record?.needs_editorial_review !== true || record?.feed_activation_approved !== false ||
      !episode || normal(episode.title) !== expected.episodeTitle || normal(episode.production_number) !== expected.episodeGuid ||
      normal(episode.source_url) !== expected.episodeUrl || !episode.source_url.endsWith(expected.episodeGuid) ||
      new Date(episode.published_at).toISOString() !== expected.episodePublishedAt || episode.duration_seconds !== expected.episodeDurationSeconds ||
      !Array.isArray(episode.square_image_ids) || episode.square_image_ids.length !== 2 || episode.square_image_ids.some((imageId) => imageId !== expected.coverImageId) ||
      !description || descriptionUrl !== expected.seriesUrl || digest(description) !== expected.descriptionSha256 ||
      !/^https:\/\/www\.dr\.dk\/lyd\/p3\/tyran-[a-z0-9-]+-\d{13}$/u.test(expected.seriesUrl) ||
      !/^https:\/\/www\.dr\.dk\/lyd\/p3\/tyran-[a-z0-9-]+\/.+\d{8,20}$/u.test(expected.episodeUrl)) {
    throw new Error(`Tyran staging source, identity, episode, cover, or description mismatch for ${id || "(missing ID)"}`);
  }
  const provenance = {
    version: 1, discoveryKey: record.discovery_key, podcastId: id, title,
    seriesId: expected.seriesId, seriesProductionNumber: expected.seriesProductionNumber,
    seriesUrl: expected.seriesUrl, episodeTitle: expected.episodeTitle, episodeGuid: expected.episodeGuid,
    episodeUrl: expected.episodeUrl, coverImageId: expected.coverImageId,
    coverUrl: expected.coverUrl, coverSha256: expected.coverSha256,
    descriptionUrl, descriptionSha256: expected.descriptionSha256
  };
  const provenanceText = `TYRAN_DR_PROVENANCE_V1 ${JSON.stringify(provenance)}\n\n${description}`;
  const values = Array(STAGING_HEADERS.length).fill("");
  const set = (header, value) => { values[STAGING_HEADERS.indexOf(header)] = String(value ?? ""); };
  const shortDescription = boundedSourceExcerpt(plainSourceText(description), 240);
  if (!shortDescription) throw new Error(`Tyran source description has no safe short excerpt for ${id}`);
  for (const [header, value] of Object.entries({
    Titel: title, Udgiver: "DR", Hovedserie: "Tyran", Link: expected.episodeUrl,
    "Billedlink": expected.coverUrl, "Kort beskrivelse": shortDescription,
    "Lang beskrivelse": description, "Podcast-ID": id, Kilde: expected.episodeUrl,
    "Tjekket dato": checkedDate, "DR source GUID": expected.episodeGuid,
    "DR source URL": expected.episodeUrl, "DR source description": provenanceText,
    "Review status": "NEEDS_EDITORIAL_REVIEW"
  })) set(header, value);
  return values;
}

export function buildStagingPlan({ headers, existingRows, candidates }) {
  if (!Array.isArray(headers) || STAGING_HEADERS.some((header, index) => normal(headers[index]) !== header) ||
      headers.length !== STAGING_HEADERS.length) {
    throw new Error("DR staging header schema drift; staging append refused");
  }
  const idIndex = STAGING_HEADERS.indexOf("Podcast-ID");
  const existing = new Map();
  const titleIndex = STAGING_HEADERS.indexOf("Titel");
  const seriesIndex = STAGING_HEADERS.indexOf("Hovedserie");
  const sourceGuidIndex = STAGING_HEADERS.indexOf("DR source GUID");
  const unidentifiedRows = [];
  for (const [rowOffset, row] of (existingRows || []).entries()) {
    const id = normal(row[idIndex]);
    if (!id) {
      const populated = (row || []).map((cell, index) => ({ index, value: normal(cell) })).filter((cell) => cell.value);
      if (populated.length) {
        // Preserve a single non-GUID note left in the DR GUID column. It is
        // not a row identity; rows with any identity, URL, or valid GUID data
        // still stop the append so they can be reviewed manually.
        if (populated.length === 1 && populated[0].index === sourceGuidIndex && !/^\d{6,}$/u.test(populated[0].value)) {
          unidentifiedRows.push(rowOffset + 2);
          continue;
        }
        throw new Error(`DR staging contains populated row without Podcast-ID at row ${rowOffset + 2}`);
      }
      continue;
    }
    if (existing.has(id)) throw new Error(`DR staging contains duplicate Podcast-ID: ${id}`);
    existing.set(id, row);
  }
  const seen = new Set();
  const append = [];
  const hostUpdates = [];
  for (const record of candidates || []) {
    const row = buildStagingRow(record);
    const id = normal(row[idIndex]);
    if (seen.has(id)) throw new Error(`Duplicate DR staging candidate Podcast-ID: ${id}`);
    seen.add(id);
    if (!existing.has(id) && normal(row[seriesIndex]) === "Tyran" && TYRAN_EXISTING_ARK1_IDENTITIES[id]) {
      const known = TYRAN_EXISTING_ARK1_IDENTITIES[id];
      let provenance;
      try { provenance = JSON.parse(normal(row[STAGING_HEADERS.indexOf("DR source description")]).replace(/^TYRAN_DR_PROVENANCE_V1\s+/u, "").split("\n", 1)[0]); }
      catch { throw new Error(`Tyran historical identity provenance is invalid for ${id}`); }
      if (normal(row[titleIndex]) !== known.title || normal(row[seriesIndex]) !== known.mainSeries ||
          provenance.podcastId !== known.podcastId || provenance.title !== known.title || provenance.seriesUrl !== known.seriesUrl) {
        throw new Error(`Tyran historical identity/source conflict for ${id}`);
      }
      continue;
    }
    if (existing.has(id)) {
      const stored = existing.get(id);
      if (normal(stored[titleIndex]) !== normal(row[titleIndex]) ||
          normal(stored[seriesIndex]) !== normal(row[seriesIndex]) ||
          normal(stored[STAGING_HEADERS.indexOf("DR source GUID")]) !== normal(row[STAGING_HEADERS.indexOf("DR source GUID")]) ||
          normal(stored[STAGING_HEADERS.indexOf("DR source URL")]) !== normal(row[STAGING_HEADERS.indexOf("DR source URL")]) ||
          normal(stored[STAGING_HEADERS.indexOf("Billedlink")]) !== normal(row[STAGING_HEADERS.indexOf("Billedlink")])) {
        throw new Error(`Existing DR staging identity/source conflict for ${id}`);
      }
      const hostIndex = STAGING_HEADERS.indexOf("Vært");
      const candidateHost = normal(row[hostIndex]);
      if (!normal(stored[hostIndex]) && candidateHost) {
        hostUpdates.push({ rowNumber: existingRows.indexOf(stored) + 2, podcastId: id, host: candidateHost });
      }
      continue;
    }
    if (normal(row[seriesIndex]) === "Tyran") {
      const titleKey = normalizeTyranIdentity(row[titleIndex]);
      if (Object.keys(TYRAN_PROTECTED_IDS).includes(titleKey)) throw new Error(`Tyran historical identity collision for ${id}: ${normal(row[titleIndex])}`);
      const candidateSources = [row[STAGING_HEADERS.indexOf("DR source GUID")], row[STAGING_HEADERS.indexOf("DR source URL")], row[STAGING_HEADERS.indexOf("Billedlink")]].map(normal).filter(Boolean);
      if ((existingRows || []).some((stored) => {
        if (normalizeTyranIdentity(stored?.[titleIndex]) === titleKey && titleKey) return true;
        const storedSeries = normal(stored?.[seriesIndex]);
        const storedId = normal(stored?.[STAGING_HEADERS.indexOf("Podcast-ID")]);
        if (storedId === id || (storedSeries === "Tyran" && titleKey && normalizeTyranIdentity(stored?.[titleIndex]) === titleKey)) return true;
        const storedSources = [stored?.[STAGING_HEADERS.indexOf("DR source GUID")], stored?.[STAGING_HEADERS.indexOf("DR source URL")], stored?.[STAGING_HEADERS.indexOf("Billedlink")]].map(normal);
        return candidateSources.some((source) => storedSources.includes(source));
      })) throw new Error(`DR staging Tyran identity/title/source collision for ${id}`);
    }
    append.push(row);
  }
  return { append, hostUpdates, alreadyPresent: seen.size - append.length, unidentifiedRows };
}

export function buildRadioIIIIStagingRow(record, checkedDate = new Date().toISOString().slice(0, 10)) {
  const id = normal(record?.podcast_id ?? record?.["Podcast-ID"]);
  const title = normal(record?.title ?? record?.Titel);
  const mainSeries = normal(record?.hovedserie ?? record?.Hovedserie);
  const episodes = Array.isArray(record?.episodes) ? record.episodes : [];
  const sourceDescription = plainSourceText(record?.source_description || "");
  const sourceUrl = normal(record?.source_url ?? record?.Link);
  const seasonUrl = normal(record?.season_url);
  const guids = episodes.map((episode) => normal(episode.guid));
  const chapterCount = episodes.filter((episode) => episode.role === "chapter").length;
  if (!id || !title || mainSeries !== RADIO_IIII_MAIN_SERIES || normal(record?.publisher ?? record?.Udgiver) !== "RADIO IIII" ||
      normal(record?.host ?? record?.["Vært"]) !== RADIO_IIII_HOST || episodes.length < 2 || !chapterCount ||
      new Set(guids).size !== guids.length || guids.some((guid) => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(guid)) ||
      !/^https:\/\/radio4\.dk\/podcasts\/et-kapitel-for-sig\//u.test(sourceUrl) ||
      !/^https:\/\/radio4\.dk\/podcasts\/et-kapitel-for-sig\?season=\d+$/u.test(seasonUrl) || !sourceDescription) {
    throw new Error("RADIO IIII staging identity or official season/episode source is incomplete");
  }
  const values = Array(RADIO_IIII_STAGING_HEADERS.length).fill("");
  const set = (header, value) => { values[RADIO_IIII_STAGING_HEADERS.indexOf(header)] = String(value ?? ""); };
  for (const [header, value] of Object.entries({
    Titel: title, "Vært": RADIO_IIII_HOST, Genre: record?.genre || "", Udgiver: "RADIO IIII",
    Hovedserie: RADIO_IIII_MAIN_SERIES, "Antal afsnit": episodes.length, Link: sourceUrl,
    Billedlink: record?.image_url || "", "Kort beskrivelse": record?.short_description || "",
    "Lang beskrivelse": record?.long_description || sourceDescription.slice(0, 1800),
    Emner: Array.isArray(record?.topics) ? record.topics.join("; ") : "",
    Episoder: Array.isArray(record?.manual_episodes) ? record.manual_episodes.join("; ") : "",
    "Podcast-ID": id, Kilde: sourceUrl, "Tjekket dato": checkedDate,
    "Radio IIII source GUIDs": guids.join("; "), "Radio IIII source URL": sourceUrl,
    "Radio IIII season URL": seasonUrl, "Radio IIII source description": sourceDescription,
    "Review status": record?.review_status || "SOURCE_VERIFIED_REQUIRES_OWNER_APPROVAL"
  })) set(header, value);
  return values;
}

export function buildRadioIIIIStagingPlan({ headers, existingRows, candidates }) {
  if (!Array.isArray(headers) || headers.length !== RADIO_IIII_STAGING_HEADERS.length ||
      RADIO_IIII_STAGING_HEADERS.some((header, index) => normal(headers[index]) !== header)) {
    throw new Error("RADIO IIII staging header schema drift; append refused");
  }
  const idIndex = RADIO_IIII_STAGING_HEADERS.indexOf("Podcast-ID");
  const titleIndex = RADIO_IIII_STAGING_HEADERS.indexOf("Titel");
  const seriesIndex = RADIO_IIII_STAGING_HEADERS.indexOf("Hovedserie");
  const guidsIndex = RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source GUIDs");
  const sourceIndex = RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII source URL");
  const seasonIndex = RADIO_IIII_STAGING_HEADERS.indexOf("Radio IIII season URL");
  const existing = new Map();
  for (const row of existingRows || []) {
    const id = normal(row?.[idIndex]);
    if (!id) {
      if ((row || []).some((cell) => normal(cell))) throw new Error("RADIO IIII staging has a populated row without Podcast-ID");
      continue;
    }
    if (existing.has(id)) throw new Error(`RADIO IIII staging has duplicate Podcast-ID: ${id}`);
    existing.set(id, row);
  }
  const seen = new Set();
  const append = [];
  for (const record of candidates || []) {
    const row = buildRadioIIIIStagingRow(record);
    const id = normal(row[idIndex]);
    if (seen.has(id)) throw new Error(`Duplicate RADIO IIII staging candidate Podcast-ID: ${id}`);
    seen.add(id);
    if (existing.has(id)) {
      const old = existing.get(id);
      if (normal(old[titleIndex]) !== normal(row[titleIndex]) || normal(old[seriesIndex]) !== normal(row[seriesIndex]) ||
          normal(old[guidsIndex]) !== normal(row[guidsIndex]) || normal(old[sourceIndex]) !== normal(row[sourceIndex]) ||
          normal(old[seasonIndex]) !== normal(row[seasonIndex])) {
        throw new Error(`RADIO IIII staging identity/source conflict for ${id}`);
      }
      continue;
    }
    if ([...existing.values(), ...append].some((old) => normal(old[titleIndex]) === normal(row[titleIndex]) ||
      (normal(old[guidsIndex]) && normal(old[guidsIndex]) === normal(row[guidsIndex])))) {
      throw new Error(`RADIO IIII staging title or source GUID collision for ${id}`);
    }
    append.push(row);
  }
  return { append, alreadyPresent: seen.size - append.length };
}

export class StagingSheetsApiClient {
  constructor({ accessToken, spreadsheetId, fetchImpl = fetch, timeoutMs = 15000, tab = STAGING_TAB, headers = STAGING_HEADERS }) {
    if (!accessToken) throw new Error("Google Sheets staging credentials are missing; fail closed");
    if (!spreadsheetId || spreadsheetId === ORIGINAL_SHEET_ID) {
      throw new Error("A separate DR staging spreadsheet ID is required; original-sheet writes are forbidden");
    }
    this.accessToken = accessToken;
    this.spreadsheetId = spreadsheetId;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.tab = tab;
    this.headers = headers;
  }

  async request(url, options = {}) {
    const readOnly = !options.method || options.method === "GET";
    const attempts = readOnly ? 3 : 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          ...options, signal: controller.signal,
          headers: { authorization: `Bearer ${this.accessToken}`, ...(options.headers || {}) }
        });
        if (response.ok) return response;
        lastError = new Error(`Google Sheets staging API returned HTTP ${response.status}`);
        if (!readOnly || attempt + 1 >= attempts || ![429, 500, 502, 503, 504].includes(response.status)) throw lastError;
      } catch (error) {
        lastError = error;
        if (!readOnly || attempt + 1 >= attempts) throw error;
      } finally {
        clearTimeout(timer);
      }
      await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** attempt)));
    }
    throw lastError;
  }

  async readSheet() {
    const lastColumn = this.headers.length <= 26 ? String.fromCharCode(64 + this.headers.length) :
      `${String.fromCharCode(64 + Math.floor((this.headers.length - 1) / 26))}${String.fromCharCode(65 + ((this.headers.length - 1) % 26))}`;
    const range = encodeURIComponent(`${this.tab}!A1:${lastColumn}`);
    const response = await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}?valueRenderOption=FORMULA`);
    const payload = await response.json();
    if (!Array.isArray(payload.values) || !payload.values.length) throw new Error("DR staging tab is empty or unreadable");
    const [headers, ...rows] = payload.values;
    return { headers, rows };
  }

  async appendRows(rows) {
    const lastColumn = this.headers.length <= 26 ? String.fromCharCode(64 + this.headers.length) :
      `${String.fromCharCode(64 + Math.floor((this.headers.length - 1) / 26))}${String.fromCharCode(65 + ((this.headers.length - 1) % 26))}`;
    const range = encodeURIComponent(`${this.tab}!A:${lastColumn}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true`;
    return this.request(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: rows })
    });
  }

  async writeRowsAt(startRow, rows) {
    if (!Number.isInteger(startRow) || startRow < 2 || !Array.isArray(rows) || !rows.length ||
        rows.some((row) => !Array.isArray(row) || row.length !== this.headers.length)) {
      throw new Error("Invalid explicit staging write range");
    }
    const lastRow = startRow + rows.length - 1;
    const lastColumn = this.headers.length <= 26 ? String.fromCharCode(64 + this.headers.length) :
      `${String.fromCharCode(64 + Math.floor((this.headers.length - 1) / 26))}${String.fromCharCode(65 + ((this.headers.length - 1) % 26))}`;
    const range = encodeURIComponent(`'${this.tab.replace(/'/gu, "''")}'!A${startRow}:${lastColumn}${lastRow}`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}?valueInputOption=RAW`;
    return this.request(url, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: rows })
    });
  }

  async updateHostCells(updates) {
    if (!Array.isArray(updates) || updates.some(({ rowNumber, host }) => !Number.isInteger(rowNumber) || rowNumber < 2 || !normal(host))) {
      throw new Error("Invalid DR staging host-cell update plan");
    }
    const data = updates.map(({ rowNumber, host }) => ({ range: `'${STAGING_TAB}'!C${rowNumber}`, values: [[host]] }));
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values:batchUpdate`;
    return this.request(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ valueInputOption: "RAW", data })
    });
  }
}

export function assertStagingWriteGate(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/main" ||
      env.GOOGLE_DR_STAGING_WRITE_ENABLED !== "true" || !env.GOOGLE_DR_STAGING_SHEET_ID ||
      env.GOOGLE_DR_STAGING_SHEET_ID === ORIGINAL_SHEET_ID || !env.GOOGLE_ACCESS_TOKEN) {
    throw new Error("DR staging write gate is closed; original-sheet API access is never allowed");
  }
}

export async function appendDrCandidatesToStaging({ client, candidates, dryRun = true, allowHostUpdates = true }) {
  if (!client) throw new Error("DR staging client is required");
  let initial = await client.readSheet();
  let plan = buildStagingPlan({ headers: initial.headers, existingRows: initial.rows, candidates });
  const orphanSummary = plan.unidentifiedRows.length ? { preservedUnidentifiedRows: plan.unidentifiedRows.length } : {};
  if (!allowHostUpdates) plan = { ...plan, hostUpdates: [] };
  if (dryRun) return { dryRun, appended: 0, alreadyPresent: plan.alreadyPresent, ...(plan.hostUpdates.length ? { hostUpdates: plan.hostUpdates.length } : {}), ...orphanSummary };
  let hostFilled = 0;
  if (plan.hostUpdates.length) {
    // Refresh the exact row and source identity immediately before the narrow host-only update.
    initial = await client.readSheet();
    plan = buildStagingPlan({ headers: initial.headers, existingRows: initial.rows, candidates });
    if (!allowHostUpdates) plan = { ...plan, hostUpdates: [] };
    if (plan.hostUpdates.length) {
      try {
        await client.updateHostCells(plan.hostUpdates);
      } catch (updateError) {
        const reread = await client.readSheet();
        const expectedRows = rowsAfterHostUpdates(initial.rows, plan.hostUpdates);
        assertRowsMatch(expectedRows, reread.rows, "Existing DR staging rows changed during host-only update; stop and inspect before retry");
        hostFilled = plan.hostUpdates.length;
      }
      const readback = await client.readSheet();
      const expectedRows = rowsAfterHostUpdates(initial.rows, plan.hostUpdates);
      assertRowsMatch(expectedRows, readback.rows, "DR staging host-cell update read-back mismatch");
      hostFilled = plan.hostUpdates.length;
      initial = readback;
      plan = buildStagingPlan({ headers: readback.headers, existingRows: readback.rows, candidates });
    }
  }
  if (!plan.append.length) return { dryRun: false, appended: 0, alreadyPresent: plan.alreadyPresent, ...(hostFilled ? { hostFilled } : {}), ...orphanSummary };
  // The Values API append endpoint guesses where a table ends. A one-cell
  // editor note in a provenance column can make that guess target the note
  // instead of the staging table. Re-read and write to an explicit row after
  // the last populated row so every candidate field lands in the same row.
  const beforeAppend = initial;
  initial = await client.readSheet();
  assertRowsMatch(beforeAppend.rows, initial.rows, "DR staging changed during append preflight; stop and inspect before retry");
  plan = buildStagingPlan({ headers: initial.headers, existingRows: initial.rows, candidates });
  if (!allowHostUpdates) plan = { ...plan, hostUpdates: [] };
  if (!plan.append.length) return { dryRun: false, appended: 0, alreadyPresent: plan.alreadyPresent, ...(hostFilled ? { hostFilled } : {}), ...orphanSummary };
  if (typeof client.writeRowsAt !== "function") throw new Error("DR staging requires explicit-coordinate writes");
  const lastPopulatedIndex = (initial.rows || []).findLastIndex((row) => (row || []).some((cell) => normal(cell)));
  const startRow = lastPopulatedIndex + 3;
  try {
    await client.writeRowsAt(startRow, plan.append);
  } catch (appendError) {
    const reread = await client.readSheet();
    buildStagingPlan({ headers: reread.headers, existingRows: reread.rows, candidates: [] });
    assertExistingRowsUnchanged(initial.rows, reread.rows);
    assertStagingAppendRowsMatch(plan.append, reread.rows);
    return { dryRun: false, appended: plan.append.length, alreadyPresent: plan.alreadyPresent, ...(hostFilled ? { hostFilled } : {}), recoveredAfterAmbiguousFailure: true, ...orphanSummary };
  }
  const readback = await client.readSheet();
  buildStagingPlan({ headers: readback.headers, existingRows: readback.rows, candidates: [] });
  assertExistingRowsUnchanged(initial.rows, readback.rows);
  assertStagingAppendRowsMatch(plan.append, readback.rows);
  return { dryRun: false, appended: plan.append.length, alreadyPresent: plan.alreadyPresent, ...(hostFilled ? { hostFilled } : {}), ...orphanSummary };
}

export async function appendRadioIIIIToStaging({ client, candidates, dryRun = true }) {
  if (!client || client.tab !== RADIO_IIII_STAGING_TAB || client.headers !== RADIO_IIII_STAGING_HEADERS) {
    throw new Error("A dedicated RADIO IIII staging tab/client is required");
  }
  const initial = await client.readSheet();
  const plan = buildRadioIIIIStagingPlan({ headers: initial.headers, existingRows: initial.rows, candidates });
  if (dryRun || !plan.append.length) return { dryRun, appended: 0, alreadyPresent: plan.alreadyPresent };
  if (typeof client.writeRowsAt !== "function") throw new Error("RADIO IIII staging requires explicit-coordinate writes");
  const lastPopulatedIndex = (initial.rows || []).findLastIndex((row) => (row || []).some((cell) => normal(cell)));
  const startRow = lastPopulatedIndex + 3;
  const normalizeRows = (rows) => (rows || []).map((row) =>
    Array.from({ length: RADIO_IIII_STAGING_HEADERS.length }, (_, index) => normal(row?.[index])));
  try {
    await client.writeRowsAt(startRow, plan.append);
  } catch (appendError) {
    const reread = await client.readSheet();
    buildRadioIIIIStagingPlan({ headers: reread.headers, existingRows: reread.rows, candidates: [] });
    const before = normalizeRows(initial.rows);
    const after = normalizeRows(reread.rows);
    if (after.length < before.length || JSON.stringify(before) !== JSON.stringify(after.slice(0, before.length))) {
      throw new Error("RADIO IIII staging changed during an ambiguous append; stop and inspect before retry", { cause: appendError });
    }
    for (const expected of plan.append) {
      const id = normal(expected[RADIO_IIII_STAGING_HEADERS.indexOf("Podcast-ID")]);
      const matches = (reread.rows || []).filter((row) => normal(row[RADIO_IIII_STAGING_HEADERS.indexOf("Podcast-ID")]) === id);
      if (matches.length !== 1 || JSON.stringify(normalizeRows([matches[0]])[0]) !== JSON.stringify(normalizeRows([expected])[0])) {
        throw new Error("RADIO IIII staging append recovery did not match the verified candidate rows", { cause: appendError });
      }
    }
    return { dryRun: false, appended: plan.append.length, alreadyPresent: plan.alreadyPresent, recoveredAfterAmbiguousFailure: true };
  }
  const readback = await client.readSheet();
  buildRadioIIIIStagingPlan({ headers: readback.headers, existingRows: readback.rows, candidates: [] });
  const before = normalizeRows(initial.rows);
  const after = normalizeRows(readback.rows);
  if (after.length < before.length || JSON.stringify(before) !== JSON.stringify(after.slice(0, before.length))) {
    throw new Error("Existing RADIO IIII staging rows changed during append; stop and inspect");
  }
  for (const expected of plan.append) {
    const id = normal(expected[RADIO_IIII_STAGING_HEADERS.indexOf("Podcast-ID")]);
    const matches = (readback.rows || []).filter((row) => normal(row[RADIO_IIII_STAGING_HEADERS.indexOf("Podcast-ID")]) === id);
    if (matches.length !== 1 || JSON.stringify(normalizeRows([matches[0]])[0]) !== JSON.stringify(normalizeRows([expected])[0])) {
      throw new Error("RADIO IIII staging append read-back mismatch; stop and inspect");
    }
  }
  return { dryRun: false, appended: plan.append.length, alreadyPresent: plan.alreadyPresent };
}

function rowsAfterHostUpdates(rows, updates) {
  const result = structuredClone(rows || []);
  const hostIndex = STAGING_HEADERS.indexOf("Vært");
  for (const update of updates) {
    const row = result[update.rowNumber - 2];
    if (!row || normal(row[STAGING_HEADERS.indexOf("Podcast-ID")]) !== update.podcastId || normal(row[hostIndex])) {
      throw new Error(`DR staging host cell is no longer blank for ${update.podcastId}`);
    }
    row[hostIndex] = update.host;
  }
  return result;
}

function assertRowsMatch(expectedRows, actualRows, message) {
  const normalizeRow = (row) => Array.from({ length: STAGING_HEADERS.length }, (_, index) => normal(row?.[index]));
  if (JSON.stringify((expectedRows || []).map(normalizeRow)) !== JSON.stringify((actualRows || []).map(normalizeRow))) {
    throw new Error(message);
  }
}

function assertExistingRowsUnchanged(beforeRows, afterRows) {
  const normalizeRow = (row) => Array.from({ length: STAGING_HEADERS.length }, (_, index) => normal(row?.[index]));
  const before = (beforeRows || []).map(normalizeRow);
  const after = (afterRows || []).slice(0, before.length).map(normalizeRow);
  if (after.length !== before.length || JSON.stringify(before) !== JSON.stringify(after)) {
    throw new Error("Existing DR staging rows changed during append; stop and inspect before retry");
  }
}

function assertStagingAppendRowsMatch(expectedRows, actualRows) {
  const idIndex = STAGING_HEADERS.indexOf("Podcast-ID");
  const normalizeRow = (row) => Array.from({ length: STAGING_HEADERS.length }, (_, index) => normal(row?.[index]));
  for (const expected of expectedRows || []) {
    const id = normal(expected[idIndex]);
    const matches = (actualRows || []).filter((row) => normal(row[idIndex]) === id);
    if (matches.length !== 1 || JSON.stringify(normalizeRow(matches[0])) !== JSON.stringify(normalizeRow(expected))) {
      throw new Error("DR staging append read-back mismatch; stop and inspect before retry");
    }
  }
}
