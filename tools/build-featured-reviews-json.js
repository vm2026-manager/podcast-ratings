const fs = require("fs");
const path = require("path");
const https = require("https");
const zlib = require("zlib");

const FEATURED_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/gviz/tq?tqx=out:csv&sheet=Udvalgte%20vurderinger";

const OUTPUT_PATH = path.join(__dirname, "..", "data", "featured-reviews.json");

function fetchBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 8) {
      reject(new Error("Too many redirects while fetching featured reviews CSV."));
      return;
    }

    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 GitHubActionsPodcastRatings",
          "Accept": "text/csv,text/plain,*/*",
          "Accept-Encoding": "gzip, deflate, br",
        },
      },
      (res) => {
        const statusCode = res.statusCode || 0;

        if (
          [301, 302, 303, 307, 308].includes(statusCode) &&
          res.headers.location
        ) {
          const redirectedUrl = new URL(res.headers.location, url).toString();
          resolve(fetchBuffer(redirectedUrl, redirectCount + 1));
          return;
        }

        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const rawBuffer = Buffer.concat(chunks);

          if (statusCode < 200 || statusCode >= 300) {
            const bodyPreview = rawBuffer.toString("utf8").slice(0, 1000);
            reject(
              new Error(
                [
                  `Could not fetch featured reviews CSV.`,
                  `HTTP status: ${statusCode}`,
                  `URL: ${url}`,
                  `Response preview: ${bodyPreview}`,
                ].join("\n")
              )
            );
            return;
          }

          const encoding = String(res.headers["content-encoding"] || "").toLowerCase();

          if (encoding === "gzip") {
            zlib.gunzip(rawBuffer, (error, decoded) => {
              if (error) {
                reject(error);
                return;
              }

              resolve(decoded);
            });
            return;
          }

          if (encoding === "deflate") {
            zlib.inflate(rawBuffer, (error, decoded) => {
              if (error) {
                reject(error);
                return;
              }

              resolve(decoded);
            });
            return;
          }

          if (encoding === "br") {
            zlib.brotliDecompress(rawBuffer, (error, decoded) => {
              if (error) {
                reject(error);
                return;
              }

              resolve(decoded);
            });
            return;
          }

          resolve(rawBuffer);
        });
      }
    );

    request.on("error", reject);
    request.setTimeout(30000, () => {
      request.destroy(new Error("Timeout while fetching featured reviews CSV."));
    });
  });
}

async function fetchText(url) {
  const buffer = await fetchBuffer(url);
  return buffer.toString("utf8");
}

function cleanCell(value) {
  return String(value == null ? "" : value).trim();
}

function normalizeHeader(value) {
  return cleanCell(value)
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ");
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

  const headers = rows[0].map(normalizeHeader);

  return rows.slice(1).map((row) => {
    const item = {};

    headers.forEach((header, index) => {
      if (!header) return;
      item[header] = cleanCell(row[index] || "");
    });

    return item;
  });
}

function rowIsUseful(row) {
  return cleanCell(row["Aktiv"]) !== "" && cleanCell(row["Titel"]) !== "";
}

async function main() {
  console.log("Fetching featured reviews CSV...");
  console.log(FEATURED_CSV_URL);

  const csv = await fetchText(FEATURED_CSV_URL);

  if (!csv || !csv.trim()) {
    throw new Error("Featured reviews CSV was empty.");
  }

  console.log("CSV preview:");
  console.log(csv.slice(0, 500));

  const rows = parseCsv(csv);

  if (rows.length < 2) {
    throw new Error(
      "Featured reviews CSV did not contain data rows. Check that the sheet is published and the sheet name is exactly 'Udvalgte vurderinger'."
    );
  }

  const objects = rowsToObjects(rows);
  const usefulRows = objects.filter(rowIsUseful);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: FEATURED_CSV_URL,
    count: usefulRows.length,
    rows: usefulRows,
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Wrote ${usefulRows.length} featured reviews to ${OUTPUT_PATH}`);

  if (usefulRows.length === 0) {
    console.log(
      "Warning: 0 featured reviews were written. The file is valid, but no active review rows were found."
    );
  }
}

main().catch((error) => {
  console.error("Failed to build featured reviews JSON:");
  console.error(error);
  process.exit(1);
});
