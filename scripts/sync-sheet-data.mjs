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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function normalizeText(value) {
  return String(value ?? "").trim();
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
