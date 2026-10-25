import { VERIFIED_DR_SERIES_METADATA } from "./verified-dr-series-metadata.mjs";

export const ORIGINAL_SHEET_ID = "1V21y9uMx_fGethrT47hILWczgK_ZSNRfksSKWuR69ss";
export const SHEET_NAME = "Ark1";
export const REQUIRED_HEADERS = Object.freeze([
  "Placering", "Titel", "Vært", "Vuring (1-10)", "Genre", "Udgiver", "Hovedserie",
  "Antal afsnit", "Årstal afspillet", "Link", "Afgivet vurdering", "Billedlink",
  "Kort beskrivelse", "Undervurderet perle", "Lang beskrivelse", "2. genre", "Emner",
  "Episoder", "Feed", "Supplerende ligheder", "Uaktuel", "Podcast-ID", "Adgang",
  "Kilde", "Tjekket dato", "Engelsk", "", "", "", "", "Nævneværdige episo:"
]);

const normal = (value) => String(value ?? "").normalize("NFC").trim();

export function buildAppendPlan({ headers, existingRows, candidates }) {
  if (!Array.isArray(headers) || headers.length < REQUIRED_HEADERS.length ||
      REQUIRED_HEADERS.some((header, index) => normal(headers[index]) !== header)) {
    throw new Error("Ark1 header schema drift; append refused");
  }
  if (headers.slice(REQUIRED_HEADERS.length).some((header) => normal(header))) {
    throw new Error("Ark1 contains unexpected columns; append refused");
  }

  const idIndex = REQUIRED_HEADERS.indexOf("Podcast-ID");
  const titleIndex = REQUIRED_HEADERS.indexOf("Titel");
  const seriesIndex = REQUIRED_HEADERS.indexOf("Hovedserie");
  const counts = new Map();
  for (const row of existingRows || []) {
    const id = normal(row[idIndex]);
    if (!id) {
      if ((row || []).some((cell) => normal(cell))) throw new Error("Ark1 contains a populated row without Podcast-ID; append refused");
      continue;
    }
    counts.set(id, (counts.get(id) || 0) + 1);
  }
  const duplicateIds = [...counts].filter(([, count]) => count !== 1).map(([id]) => id);
  if (duplicateIds.length) throw new Error("Ark1 contains duplicate Podcast-ID values; append refused");

  const seen = new Set();
  const append = [];
  for (const candidate of candidates || []) {
    const id = normal(candidate?.["Podcast-ID"]);
    const metadata = VERIFIED_DR_SERIES_METADATA[id];
    if (!metadata || metadata.needsEditorialReview || candidate?.needs_editorial_review !== false ||
        normal(candidate.Titel) !== metadata.title || normal(candidate.Hovedserie) !== metadata.mainSeries ||
        normal(candidate.Kilde) !== metadata.sourceUrl || normal(candidate.Link) !== metadata.sourceUrl) {
      throw new Error("Unverified DR metadata; append refused");
    }
    if (seen.has(id)) throw new Error("Duplicate candidate Podcast-ID; append refused");
    seen.add(id);
    const existing = (existingRows || []).filter((row) => normal(row[idIndex]) === id);
    if (existing.length > 1) throw new Error("Duplicate Podcast-ID in Ark1; append refused");
    if (existing.length === 1) {
      const row = existing[0];
      if (normal(row[titleIndex]) !== metadata.title || normal(row[seriesIndex]) !== metadata.mainSeries) {
        throw new Error("Existing Podcast-ID identity conflict; append refused");
      }
      continue;
    }
    const values = Array(REQUIRED_HEADERS.length).fill("");
    for (const [header, value] of Object.entries({
      Titel: metadata.title,
      Genre: metadata.genre,
      Udgiver: "DR",
      Hovedserie: metadata.mainSeries,
      Link: metadata.sourceUrl,
      Billedlink: candidate.Billedlink,
      "Kort beskrivelse": metadata.shortDescription,
      "Lang beskrivelse": metadata.longDescription,
      Emner: metadata.topics.join("; "),
      "Supplerende ligheder": metadata.supplementarySimilarities.join("; "),
      "Podcast-ID": id,
      Kilde: metadata.sourceUrl,
      "Tjekket dato": new Date().toISOString().slice(0, 10)
    })) values[REQUIRED_HEADERS.indexOf(header)] = String(value ?? "");
    append.push({ id, title: metadata.title, mainSeries: metadata.mainSeries, values });
  }
  return append;
}

export class SheetsApiClient {
  constructor({ accessToken, fetchImpl = fetch, timeoutMs = 15000 }) {
    if (!accessToken) throw new Error("Google Sheets write credentials are missing; fail closed");
    this.accessToken = accessToken;
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
  }

  async request(url, options = {}, retryReads = true) {
    const attempts = retryReads && (!options.method || options.method === "GET") ? 3 : 1;
    let lastError;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetchImpl(url, {
          ...options,
          signal: controller.signal,
          headers: { authorization: `Bearer ${this.accessToken}`, ...(options.headers || {}) }
        });
        if (response.ok) return response;
        const error = new Error(`Google Sheets API returned HTTP ${response.status}`);
        if (attempt + 1 >= attempts || ![429, 500, 502, 503, 504].includes(response.status)) throw error;
        lastError = error;
      } catch (error) {
        lastError = error;
        if (attempt + 1 >= attempts) throw error;
      } finally {
        clearTimeout(timer);
      }
      await new Promise((resolve) => setTimeout(resolve, 250 * (2 ** attempt)));
    }
    throw lastError;
  }

  async readSheet() {
    const range = encodeURIComponent(`${SHEET_NAME}!A1:AE`);
    const response = await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${ORIGINAL_SHEET_ID}/values/${range}`);
    const payload = await response.json();
    if (!Array.isArray(payload.values) || !payload.values.length) throw new Error("Ark1 is empty or unreadable");
    const [headers, ...rows] = payload.values;
    return { headers, rows };
  }

  async appendRows(rows) {
    const range = encodeURIComponent(`${SHEET_NAME}!A:AE`);
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${ORIGINAL_SHEET_ID}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&includeValuesInResponse=true`;
    return this.request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ majorDimension: "ROWS", values: rows })
    }, false);
  }
}

export async function appendVerifiedDrRows({ client, candidates, dryRun = true }) {
  if (!client) throw new Error("Google Sheets client is required");
  const initial = await client.readSheet();
  const plan = buildAppendPlan({ headers: initial.headers, existingRows: initial.rows, candidates });
  if (!plan.length || dryRun) return { dryRun, appended: 0, alreadyPresent: (candidates || []).length - plan.length };

  try {
    await client.appendRows(plan.map((item) => item.values));
  } catch (appendError) {
    // The request may have committed before a timeout. Re-read before deciding
    // whether the run failed; a later retry remains idempotent by exact ID.
    const afterFailure = await client.readSheet();
    const readbackPlan = buildAppendPlan({ headers: afterFailure.headers, existingRows: afterFailure.rows, candidates: plan.map((x) => ({
      Titel: x.title, "Podcast-ID": x.id, Hovedserie: x.mainSeries,
      Kilde: VERIFIED_DR_SERIES_METADATA[x.id].sourceUrl,
      Link: VERIFIED_DR_SERIES_METADATA[x.id].sourceUrl,
      needs_editorial_review: false
    })) });
    if (!readbackPlan.length) return { dryRun: false, appended: plan.length, recoveredAfterAmbiguousFailure: true };
    throw appendError;
  }

  const readback = await client.readSheet();
  const idIndex = REQUIRED_HEADERS.indexOf("Podcast-ID");
  const titleIndex = REQUIRED_HEADERS.indexOf("Titel");
  const seriesIndex = REQUIRED_HEADERS.indexOf("Hovedserie");
  for (const item of plan) {
    const matches = readback.rows.filter((row) => normal(row[idIndex]) === item.id);
    if (matches.length !== 1 || normal(matches[0][titleIndex]) !== item.title ||
        normal(matches[0][seriesIndex]) !== item.mainSeries) {
      throw new Error("Ark1 append read-back mismatch; stop and inspect before retry");
    }
  }
  return { dryRun: false, appended: plan.length, alreadyPresent: (candidates || []).length - plan.length };
}

export function assertProductionWriteGate(env = process.env) {
  if (env.GITHUB_ACTIONS !== "true" || env.GITHUB_REF !== "refs/heads/main" ||
      !env.GOOGLE_SHEETS_WRITE_ENABLED || !env.GOOGLE_SHEETS_BACKUP_VERIFIED ||
      env.GOOGLE_SHEETS_SPREADSHEET_ID !== ORIGINAL_SHEET_ID || !env.GOOGLE_ACCESS_TOKEN) {
    throw new Error("Production Sheets write gate is closed; require approved main workflow, backup, exact sheet ID, and short-lived credentials");
  }
}
