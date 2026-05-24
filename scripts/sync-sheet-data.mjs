import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SPREADSHEET_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub";

const SHEETS = [
  {
    outputPath: "data/podcasts.json",
    sheetName: "Ark1",
    gid: "0"
  },
  {
    outputPath: "data/featured-reviews.json",
    sheetName: "Udvalgte vurderinger",
    gid: "1418051000"
  }
];

const PODCAST_FIELDS = [
  { output: "Titel", candidates: ["Titel", "Title"] },
  { output: "Vært", candidates: ["Vært", "Vaert", "Host", "Værter"] },
  {
    output: "Vuring",
    candidates: [
      "Vuring",
      "Vuring (1-10)",
      "Vurdering",
      "Vurdering (1-10)",
      "Vuring/Vurdering",
      "Vuring/Vurdering (1-10)",
      "Rating",
      "Score"
    ]
  },
  { output: "Genre", candidates: ["Genre"] },
  { output: "Udgiver", candidates: ["Udgiver", "Publisher"] },
  { output: "Antal afsnit", candidates: ["Antal afsnit", "Afsnit", "Episodes"] },
  { output: "Årstal afspillet", candidates: ["Årstal afspillet", "Aarstal afspillet", "År", "Aar"] },
  { output: "Link", candidates: ["Link", "URL"] },
  { output: "Afgivet vurdering", candidates: ["Afgivet vurdering", "Dato", "Vurderingsdato", "Bedømt"] },
  { output: "Billedlink", candidates: ["Billedlink", "Billedefil", "Billede", "Cover", "Image"] },
  {
    output: "Kort beskrivelse",
    candidates: ["Kort beskrivelse", "Kortbeskrivelse", "Beskrivelse", "Description"]
  },
  { output: "Placering", candidates: ["Placering", "Rank", "Rangering"] }
];

const FEATURED_FIELDS = [
  { output: "Aktiv", candidates: ["Aktiv"] },
  { output: "Titel", candidates: ["Titel"] },
  { output: "Matchtitel", candidates: ["Matchtitel"] },
  { output: "Kort vurdering", candidates: ["Kort vurdering"] },
  { output: "Historie", candidates: ["Historie", "Historie/sag"] },
  {
    output: "Fortæller",
    candidates: [
      "Fortæller",
      "Fortaeller",
      "Vært",
      "Vaert",
      "Vært/formidling",
      "Vaert/formidling",
      "Fortælling"
    ]
  },
  { output: "Lydside", candidates: ["Lydside", "Produktion"] },
  { output: "Aktualitet", candidates: ["Aktualitet", "Aktualitet/relevans", "Relevans"] },
  { output: "Samlet score", candidates: ["Samlet score"] },
  { output: "Anmeldelsesdato", candidates: ["Anmeldelsesdato", "Anmeldelsesdat", "Anmeldt"] },
  { output: "Visningsrækkefølge", candidates: ["Visningsrækkefølge"] },
  { output: "Auto-udgiver", candidates: ["Auto-udgiver"] },
  { output: "Auto-link", candidates: ["Auto-link"] },
  { output: "Auto-billedlink", candidates: ["Auto-billedlink"] },
  { output: "Auto-genre", candidates: ["Auto-genre"] },
  { output: "Auto-vært", candidates: ["Auto-vært", "Auto-vaert"] }
];

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeHeader(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\uFEFF/, "")
    .replace(/\s+/g, " ");
}

function buildSheetUrl(gid) {
  return `${SPREADSHEET_BASE_URL}?gid=${gid}&single=true&output=csv`;
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  const normalizedText = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  for (let index = 0; index < normalizedText.length; index += 1) {
    const character = normalizedText[index];
    const nextCharacter = normalizedText[index + 1];

    if (character === '"' && insideQuotes && nextCharacter === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (character === "\n" && !insideQuotes) {
      currentRow.push(currentCell);

      if (currentRow.some((cell) => normalizeText(cell) !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += character;
  }

  currentRow.push(currentCell);

  if (currentRow.some((cell) => normalizeText(cell) !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) {
    return [];
  }

  const headers = rows[0].map((header) => normalizeText(header));

  return rows
    .slice(1)
    .map((row) => {
      const item = {};

      headers.forEach((header, index) => {
        item[header] = normalizeText(row[index] || "");
      });

      return item;
    })
    .filter((row) => Object.values(row).some((value) => normalizeText(value) !== ""));
}

function getField(row, candidates) {
  const normalizedCandidates = candidates.map(normalizeHeader);

  for (const [key, value] of Object.entries(row)) {
    if (normalizedCandidates.includes(normalizeHeader(key))) {
      return normalizeText(value);
    }
  }

  return "";
}

function compactObject(entries) {
  return Object.fromEntries(
    Object.entries(entries).filter(([, value]) => normalizeText(value) !== "")
  );
}

function pickFields(row, fieldMap) {
  const output = {};

  fieldMap.forEach(({ output, candidates }) => {
    const value = getField(row, candidates);

    if (value) {
      output[output] = value;
    }
  });

  return compactObject(output);
}

function filterPodcastRows(rows) {
  return rows.filter((row) => normalizeText(row.Titel || row.Title));
}

function filterFeaturedRows(rows) {
  return rows.filter((row) =>
    normalizeText(row.Titel || row.Matchtitel || row["Kort vurdering"])
  );
}

function slimPodcastRows(rows) {
  return rows.map((row) => pickFields(row, PODCAST_FIELDS));
}

function slimFeaturedRows(rows) {
  return rows.map((row) => pickFields(row, FEATURED_FIELDS));
}

async function fetchSheetCsv(sheet) {
  const response = await fetch(buildSheetUrl(sheet.gid), {
    headers: {
      "cache-control": "no-cache"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Kunne ikke hente CSV for ${sheet.sheetName} (${response.status}).`
    );
  }

  return response.text();
}

async function writeJsonFile(outputPath, payload) {
  const absolutePath = path.join(repoRoot, outputPath);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, `${JSON.stringify(payload)}\n`, "utf8");
}

async function syncSheet(sheet) {
  const csv = await fetchSheetCsv(sheet);
  const objects = rowsToObjects(parseCsv(csv));

  const filteredRows =
    sheet.sheetName === "Udvalgte vurderinger"
      ? filterFeaturedRows(objects)
      : filterPodcastRows(objects);

  const slimRows =
    sheet.sheetName === "Udvalgte vurderinger"
      ? slimFeaturedRows(filteredRows)
      : slimPodcastRows(filteredRows);

  await writeJsonFile(sheet.outputPath, slimRows);

  console.log(`Skrev ${slimRows.length} rækker til ${sheet.outputPath}`);
}

async function main() {
  for (const sheet of SHEETS) {
    await syncSheet(sheet);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
