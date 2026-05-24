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
  {
    output: "Afgivet vurdering",
    candidates: ["Afgivet vurdering", "Dato", "Vurderingsdato", "Bedømt"]
  },
  {
    output: "Billedlink",
    candidates: ["Billedlink", "Billedefil", "Billede", "Cover", "Image"]
  },
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
  {
    output: "Anmeldelsesdato",
    candidates: ["Anmeldelsesdato", "Anmeldelsesdat", "Anmeldt"]
  },
  { output: "Visningsrækkefølge", candidates: ["Visningsrækkefølge"] },
  { output: "Auto-udgiver", candidates: ["Auto-udgiver"] },
  { output: "Auto-link", candidates: ["Auto-link"] },
  { output: "Auto-billedlink", candidates: ["Auto-billedlink"] },
  { output: "Auto-genre", candidates: ["Auto-genre"] },
  { output: "Auto-vært", candidates: ["Auto-vært", "Auto-vaert"] }
];

const IMAGE_EXTENSION_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg"
};

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

function slugify(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function parseInlineImage(value) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue.startsWith("data:image")) {
    return null;
  }

  const separatorIndex = normalizedValue.indexOf(",");

  if (separatorIndex === -1) {
    return null;
  }

  const header = normalizedValue.slice(0, separatorIndex);
  const payload = normalizedValue.slice(separatorIndex + 1);
  const mimeMatch = header.match(/^data:(image\/[a-z0-9.+-]+);base64$/i);

  if (!mimeMatch || !payload) {
    return null;
  }

  return {
    mimeType: mimeMatch[1].toLowerCase(),
    base64: payload
  };
}

async function writeInlineImageFile(assetBaseName, inlineImage) {
  const extension = IMAGE_EXTENSION_BY_MIME[inlineImage.mimeType] || "png";
  const relativePath = `data/covers/${assetBaseName}.${extension}`;
  const absolutePath = path.join(repoRoot, relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, Buffer.from(inlineImage.base64, "base64"));

  return relativePath.replace(/\\/g, "/");
}

async function sanitizeExportValue(outputKey, value, assetBaseName) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "";
  }

  if (outputKey === "Billedlink" || outputKey === "Auto-billedlink") {
    const inlineImage = parseInlineImage(normalizedValue);

    if (inlineImage) {
      return writeInlineImageFile(assetBaseName, inlineImage);
    }
  }

  return normalizedValue;
}

async function pickFields(row, fieldMap, assetBaseName) {
  const output = {};

  for (const { output: outputKey, candidates } of fieldMap) {
    const value = await sanitizeExportValue(
      outputKey,
      getField(row, candidates),
      assetBaseName
    );

    if (value) {
      output[outputKey] = value;
    }
  }

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

async function slimPodcastRows(rows) {
  const slimRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const title = getField(row, ["Titel", "Title"]);
    const placement = getField(row, ["Placering", "Rank", "Rangering"]) || String(index + 1);
    const assetBaseName = `${String(placement).padStart(3, "0")}-${slugify(title) || `podcast-${index + 1}`}`;
    slimRows.push(await pickFields(row, PODCAST_FIELDS, assetBaseName));
  }

  return slimRows;
}

async function slimFeaturedRows(rows) {
  const slimRows = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const title = getField(row, ["Titel"]) || getField(row, ["Matchtitel"]);
    const order = getField(row, ["Visningsrækkefølge"]) || String(index + 1);
    const assetBaseName = `featured-${String(order).padStart(3, "0")}-${slugify(title) || `review-${index + 1}`}`;
    slimRows.push(await pickFields(row, FEATURED_FIELDS, assetBaseName));
  }

  return slimRows;
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
      ? await slimFeaturedRows(filteredRows)
      : await slimPodcastRows(filteredRows);

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
