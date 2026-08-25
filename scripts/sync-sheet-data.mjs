import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseSupplementarySimilarities } from "./manual-similarity-supplements.mjs";

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
    output: "Vuring (1-10)",
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
  {
    output: "Hovedserie",
    candidates: ["Hovedserie", "Hoved serie", "Main series", "MainSeries", "mainSeries"]
  },
  { output: "Antal afsnit", candidates: ["Antal afsnit", "Afsnit", "Episodes"] },
  { output: "Årstal afspillet", candidates: ["Årstal afspillet", "Aarstal afspillet", "År", "Aar"] },
  { output: "Link", candidates: ["Link", "URL"] },
  { output: "Feed", candidates: ["Feed", "RSS", "RSS feed", "Episode feed"] },
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
  {
    output: "Lang beskrivelse",
    candidates: ["Lang beskrivelse", "Langbeskrivelse"]
  },
  {
    output: "Undervurderet perle",
    candidates: ["Undervurderet perle", "Undervurderede perler", "Underrated pearl", "Underrated"]
  },
  { output: "Placering", candidates: ["Placering", "Rank", "Rangering"] },
  { output: "Podcast-ID", candidates: ["Podcast-ID", "Podcast ID", "PodcastID"] }
];

const SECONDARY_GENRE_FIELDS = ["2. genre"];
const TOPIC_FIELDS = ["Emner"];
const MANUAL_EPISODES_FIELDS = ["Episoder", "Manual episodes", "ManualEpisodes"];
const SUPPLEMENTARY_SIMILARITIES_HEADER = "Supplerende ligheder";
const SUPPLEMENTARY_SIMILARITIES_COLUMN_INDEX = 19;

const FEATURED_FIELDS = [
  { output: "Aktiv", candidates: ["Aktiv"] },
  { output: "Titel", candidates: ["Titel"] },
  { output: "Podcast-ID", candidates: ["Podcast-ID", "Podcast ID", "PodcastID"] },
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

function getColumnTHeader(rows) {
  return normalizeText(rows?.[0]?.[SUPPLEMENTARY_SIMILARITIES_COLUMN_INDEX] || "");
}

function validateSupplementarySimilaritiesColumn(rows) {
  const header = getColumnTHeader(rows);
  if (!header) {
    throw new Error(
      `Could not identify Column T for ${JSON.stringify(SUPPLEMENTARY_SIMILARITIES_HEADER)}.`
    );
  }
  if (normalizeHeader(header) !== normalizeHeader(SUPPLEMENTARY_SIMILARITIES_HEADER)) {
    throw new Error(
      `Column T must be ${JSON.stringify(SUPPLEMENTARY_SIMILARITIES_HEADER)}; found ${JSON.stringify(header)}.`
    );
  }
  return header;
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

function parseTopics(value) {
  const topics = [];
  const seen = new Set();

  String(value ?? "")
    .split(";")
    .forEach((part) => {
      const topic = normalizeText(part);
      if (!topic) return;

      const key = topic.normalize("NFC").toLocaleLowerCase("da-DK");
      if (seen.has(key)) return;

      seen.add(key);
      topics.push(topic);
    });

  return topics;
}

function parseManualEpisodes(value) {
  const episodes = [];
  const seen = new Set();

  String(value ?? "")
    .split(";")
    .forEach((part) => {
      const title = normalizeText(part);
      if (!title || seen.has(title)) return;

      seen.add(title);
      episodes.push(title);
    });

  return episodes;
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

function normalizeCatalogueIdentityPart(value) {
  return normalizeText(value)
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function catalogueHash(value) {
  let hash = 2166136261;
  for (const character of String(value || "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function createCatalogueId({ title, host, publisher, link, feed }) {
  const identity = [title, host, publisher, link, feed]
    .map(normalizeCatalogueIdentityPart)
    .join("|");
  return `catalogue-v1-${catalogueHash(identity)}`;
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
    const podcast = await pickFields(row, PODCAST_FIELDS, assetBaseName);
    podcast.catalogue_id = createCatalogueId({
      title,
      host: getField(row, ["Vært", "Vaert", "Host", "Værter"]),
      publisher: getField(row, ["Udgiver", "Publisher"]),
      link: getField(row, ["Link", "URL"]),
      feed: getField(row, ["Feed", "RSS", "RSS feed", "Episode feed"])
    });
    podcast.secondaryGenre = getField(row, SECONDARY_GENRE_FIELDS);
    podcast.topics = parseTopics(getField(row, TOPIC_FIELDS));
    const manualEpisodes = parseManualEpisodes(getField(row, MANUAL_EPISODES_FIELDS));
    if (manualEpisodes.length) {
      podcast.manualEpisodes = manualEpisodes;
    }
    const supplementarySimilaritiesRaw = getField(row, [
      SUPPLEMENTARY_SIMILARITIES_HEADER
    ]);
    if (supplementarySimilaritiesRaw) {
      podcast.supplementarySimilaritiesRaw = supplementarySimilaritiesRaw;
      const supplementarySimilarities = parseSupplementarySimilarities(
        supplementarySimilaritiesRaw
      );
      if (supplementarySimilarities.length) {
        podcast.supplementarySimilarities = supplementarySimilarities;
      }
    }
    slimRows.push(podcast);
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

function buildPodcastPayload(rows, source, generatedAt = new Date().toISOString()) {
  return {
    generatedAt,
    source,
    count: rows.length,
    rows
  };
}

async function syncSheet(sheet) {
  const csv = await fetchSheetCsv(sheet);
  const parsedRows = parseCsv(csv);
  if (sheet.sheetName === "Ark1") {
    validateSupplementarySimilaritiesColumn(parsedRows);
  }
  const objects = rowsToObjects(parsedRows);

  const filteredRows =
    sheet.sheetName === "Udvalgte vurderinger"
      ? filterFeaturedRows(objects)
      : filterPodcastRows(objects);

  const slimRows =
    sheet.sheetName === "Udvalgte vurderinger"
      ? await slimFeaturedRows(filteredRows)
      : await slimPodcastRows(filteredRows);

  const payload =
    sheet.sheetName === "Udvalgte vurderinger"
      ? slimRows
      : buildPodcastPayload(slimRows, buildSheetUrl(sheet.gid));

  await writeJsonFile(sheet.outputPath, payload);

  console.log(`Skrev ${slimRows.length} rækker til ${sheet.outputPath}`);
}

async function main() {
  for (const sheet of SHEETS) {
    await syncSheet(sheet);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

export {
  buildPodcastPayload,
  createCatalogueId,
  getField,
  normalizeHeader,
  parseCsv,
  parseSupplementarySimilarities,
  parseManualEpisodes,
  parseTopics,
  rowsToObjects,
  slimPodcastRows,
  validateSupplementarySimilaritiesColumn
};
