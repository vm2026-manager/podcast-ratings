const fs = require("fs");
const path = require("path");
const https = require("https");

const FEATURED_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/gviz/tq?tqx=out:csv&sheet=Udvalgte%20vurderinger";

const OUTPUT_PATH = path.join(__dirname, "..", "data", "featured-reviews.json");

function fetchText(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 5) {
      reject(new Error("Too many redirects"));
      return;
    }

    https
      .get(url, (res) => {
        const statusCode = res.statusCode || 0;

        if (
          [301, 302, 303, 307, 308].includes(statusCode) &&
          res.headers.location
        ) {
          const redirectedUrl = new URL(res.headers.location, url).toString();
          resolve(fetchText(redirectedUrl, redirectCount + 1));
          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          reject(new Error(`HTTP ${statusCode}: ${url}`));
          return;
        }

        let data = "";

        res.on("data", (chunk) => {
          data += chunk;
        });

        res.on("end", () => {
          resolve(data);
        });
      })
      .on("error", reject);
  });
}

function cleanCell(value) {
  return String(value == null ? "" : value).trim();
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

      if (currentRow.some((cell) => cleanCell(cell) !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  if (currentRow.some((cell) => cleanCell(cell) !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];

  const headers = rows[0].map(cleanCell);

  return rows.slice(1).map((row) => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = cleanCell(row[index] || "");
    });

    return item;
  });
}

async function main() {
  const csv = await fetchText(FEATURED_CSV_URL);
  const rows = parseCsv(csv);
  const objects = rowsToObjects(rows);

  const usefulRows = objects.filter((row) => {
    return cleanCell(row["Aktiv"]) !== "" && cleanCell(row["Titel"]) !== "";
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    source: FEATURED_CSV_URL,
    count: usefulRows.length,
    rows: usefulRows,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Wrote ${usefulRows.length} featured reviews to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
