const fs = require("fs");
const path = require("path");

const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

function normalizeText(value) {
  return String(value || "").trim();
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }

      currentRow.push(currentCell);

      if (currentRow.some((cell) => normalizeText(cell) !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
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

  return rows.slice(1).map((row) => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = normalizeText(row[index] || "");
    });

    return item;
  });
}

async function main() {
  const response = await fetch(DATA_URL);

  if (!response.ok) {
    throw new Error(`Could not fetch Google Sheets CSV. Status: ${response.status}`);
  }

  const csv = await response.text();
  const rows = parseCsv(csv);
  const objects = rowsToObjects(rows);

  const output = {
    generatedAt: new Date().toISOString(),
    source: DATA_URL,
    count: objects.length,
    rows: objects,
  };

  const outputDir = path.join(process.cwd(), "data");
  const outputPath = path.join(outputDir, "podcasts.json");

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(`Wrote ${objects.length} podcast rows to ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
