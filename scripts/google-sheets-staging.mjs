// This client can write only to the separate DR staging spreadsheet.
// Production Ark1 is intentionally inaccessible from GitHub Actions.
import { VERIFIED_DR_SERIES_METADATA } from "./verified-dr-series-metadata.mjs";

export const STAGING_TAB = "DR staging";
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
  const curated = VERIFIED_DR_SERIES_METADATA[id];
  const description = plainSourceText(record?.source_description || curated?.longDescription);
  const episodeGuid = normal(record?.source_episode_guid || curated?.sourceEpisodeGuid);
  const sourceUrl = normal(record?.source_url || curated?.sourceUrl);
  if (!id || !title || !["Bakspejl", "Djævlen i detaljen"].includes(mainSeries)) {
    throw new Error("DR staging candidate identity is incomplete or outside the approved umbrella series");
  }
  const expectedPath = mainSeries === "Bakspejl" ? "/lyd/special-radio/bakspejl/" : "/lyd/special-radio/djaevlen-i-detaljen/";
  const expectedPrefix = mainSeries === "Bakspejl" ? "bakspejl-auto-v1-" : "djaevlen-auto-v1-";
  if (!sourceUrl.startsWith(`https://www.dr.dk${expectedPath}`) || /[?#]/u.test(sourceUrl) ||
      !id.startsWith(expectedPrefix) || !/^[a-f0-9]{8}$/u.test(id.slice(expectedPrefix.length)) ||
      !/^\d{6,}$/u.test(episodeGuid) || !sourceUrl.endsWith(episodeGuid)) {
    throw new Error("DR staging candidate lacks a verifiable official full-episode source");
  }

  if (curated && (curated.title !== title || curated.mainSeries !== mainSeries ||
      curated.sourceEpisodeGuid !== episodeGuid || curated.sourceUrl !== sourceUrl)) {
    throw new Error(`Verified DR metadata identity/source mismatch for ${id}`);
  }
  const values = Array(STAGING_HEADERS.length).fill("");
  const set = (header, value) => { values[STAGING_HEADERS.indexOf(header)] = String(value ?? ""); };
  const generatedShort = boundedSourceExcerpt(description, 240);
  const generatedLong = description.slice(0, 1800);
  for (const [header, value] of Object.entries({
    Titel: title,
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
    "DR source description": description,
    "Review status": curated ? "SOURCE_VERIFIED_REQUIRES_OWNER_APPROVAL" : "NEEDS_EDITORIAL_REVIEW"
  })) set(header, value);
  // Rating, host, episode, listening history and year-played columns remain blank.
  return values;
}

export function buildStagingPlan({ headers, existingRows, candidates }) {
  if (!Array.isArray(headers) || STAGING_HEADERS.some((header, index) => normal(headers[index]) !== header) ||
      headers.length !== STAGING_HEADERS.length) {
    throw new Error("DR staging header schema drift; staging append refused");
  }
  const idIndex = STAGING_HEADERS.indexOf("Podcast-ID");
  const existing = new Map();
  for (const row of existingRows || []) {
    const id = normal(row[idIndex]);
    if (!id) {
      if ((row || []).some((cell) => normal(cell))) throw new Error("DR staging contains populated row without Podcast-ID");
      continue;
    }
    if (existing.has(id)) throw new Error(`DR staging contains duplicate Podcast-ID: ${id}`);
    existing.set(id, row);
  }
  const seen = new Set();
  const append = [];
  for (const record of candidates || []) {
    const row = buildStagingRow(record);
    const id = normal(row[idIndex]);
    if (seen.has(id)) throw new Error(`Duplicate DR staging candidate Podcast-ID: ${id}`);
    seen.add(id);
    if (existing.has(id)) {
      const stored = existing.get(id);
      if (normal(stored[STAGING_HEADERS.indexOf("Titel")]) !== normal(row[STAGING_HEADERS.indexOf("Titel")]) ||
          normal(stored[STAGING_HEADERS.indexOf("Hovedserie")]) !== normal(row[STAGING_HEADERS.indexOf("Hovedserie")]) ||
          normal(stored[STAGING_HEADERS.indexOf("DR source GUID")]) !== normal(row[STAGING_HEADERS.indexOf("DR source GUID")]) ||
          normal(stored[STAGING_HEADERS.indexOf("DR source URL")]) !== normal(row[STAGING_HEADERS.indexOf("DR source URL")])) {
        throw new Error(`Existing DR staging identity/source conflict for ${id}`);
      }
      continue;
    }
    append.push(row);
  }
  return { append, alreadyPresent: seen.size - append.length };
}

export class StagingSheetsApiClient {
  constructor({ accessToken, spreadsheetId, fetchImpl = fetch, timeoutMs = 15000 }) {
    if (!accessToken) throw new Error("Google Sheets staging credentials are missing; fail closed");
    if (!spreadsheetId || spreadsheetId === ORIGINAL_SHEET_ID) {
      throw new Error("A separate DR staging spreadsheet ID is required; original-sheet writes are forbidden");
    }
    this.accessToken = accessToken;
    this.spreadsheetId = spreadsheetId;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
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
    const range = encodeURIComponent(`${STAGING_TAB}!A1:AI`);
    const response = await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}`);
    const payload = await response.json();
    if (!Array.isArray(payload.values) || !payload.values.length) throw new Error("DR staging tab is empty or unreadable");
    const [headers, ...rows] = payload.values;
    return { headers, rows };
  }

  async appendRows(rows) {
    const range = encodeURIComponent(`${STAGING_TAB}!A:AI`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true`;
    return this.request(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: rows })
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

export async function appendDrCandidatesToStaging({ client, candidates, dryRun = true }) {
  if (!client) throw new Error("DR staging client is required");
  const initial = await client.readSheet();
  const plan = buildStagingPlan({ headers: initial.headers, existingRows: initial.rows, candidates });
  if (dryRun || !plan.append.length) return { dryRun, appended: 0, alreadyPresent: plan.alreadyPresent };
  try {
    await client.appendRows(plan.append);
  } catch (appendError) {
    const reread = await client.readSheet();
    buildStagingPlan({ headers: reread.headers, existingRows: reread.rows, candidates: [] });
    assertExistingRowsUnchanged(initial.rows, reread.rows);
    assertStagingAppendRowsMatch(plan.append, reread.rows);
    return { dryRun: false, appended: plan.append.length, alreadyPresent: plan.alreadyPresent, recoveredAfterAmbiguousFailure: true };
  }
  const readback = await client.readSheet();
  buildStagingPlan({ headers: readback.headers, existingRows: readback.rows, candidates: [] });
  assertExistingRowsUnchanged(initial.rows, readback.rows);
  assertStagingAppendRowsMatch(plan.append, readback.rows);
  return { dryRun: false, appended: plan.append.length, alreadyPresent: plan.alreadyPresent };
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
