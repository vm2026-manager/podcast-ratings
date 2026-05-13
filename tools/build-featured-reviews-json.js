const fs = require("fs");
const path = require("path");
const https = require("https");
const zlib = require("zlib");

const PUBLISHED_SHEET_BASE_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq";

const FEATURED_SHEET_NAME = "Udvalgte vurderinger";
const FEATURED_SHEET_GID = "1418051000";

const OUTPUT_PATH = path.join(__dirname, "..", "data", "featured-reviews.json");

function decodeBuffer(buffer, encoding) {
  return new Promise((resolve, reject) => {
    const normalizedEncoding = String(encoding || "").toLowerCase();

    if (normalizedEncoding === "gzip") {
      zlib.gunzip(buffer, (error, decoded) => {
        if (error) reject(error);
        else resolve(decoded);
      });
      return;
    }

    if (normalizedEncoding === "deflate") {
      zlib.inflate(buffer, (error, decoded) => {
        if (error) reject(error);
        else resolve(decoded);
      });
      return;
    }

    if (normalizedEncoding === "br") {
      zlib.brotliDecompress(buffer, (error, decoded) => {
        if (error) reject(error);
        else resolve(decoded);
      });
      return;
    }

    resolve(buffer);
  });
}

function fetchBuffer(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 8) {
      reject(new Error("Too many redirects while fetching Google Sheets data."));
      return;
    }

    const request = https.get(
      url,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 GitHubActionsPodcastRatings",
          Accept: "text/csv,text/html,text/plain,*/*",
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

        res.on("end", async () => {
          try {
            const rawBuffer = Buffer.concat(chunks);
            const decodedBuffer = await decodeBuffer(
              rawBuffer,
              res.headers["content-encoding"]
            );

            if (statusCode < 200 || statusCode >= 300) {
              const bodyPreview = decodedBuffer.toString("utf8").slice(0, 1200);
              reject(
                new Error(
                  [
                    "Could not fetch Google Sheets data.",
                    `HTTP status: ${statusCode}`,
                    `URL: ${url}`,
                    `Response preview: ${bodyPreview}`,
                  ].join("\n")
                )
              );
              return;
            }

            resolve(decodedBuffer);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);

    request.setTimeout(30000, () => {
      request.destroy(new Error("Timeout while fetching Google Sheets data."));
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

function buildCsvUrlFromGid(gid) {
  return `${PUBLISHED_SHEET_BASE_URL}/pub?gid=${encodeURIComponent(
    gid
  )}&single=true&output=csv`;
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
  const csvUrl = buildCsvUrlFromGid(FEATURED_SHEET_GID);

  console.log(`Using gid for '${FEATURED_SHEET_NAME}': ${FEATURED_SHEET_GID}`);
  console.log("Fetching featured reviews CSV...");
  console.log(csvUrl);

  const csv = await fetchText(csvUrl);

  if (!csv || !csv.trim()) {
    throw new Error("Featured reviews CSV was empty.");
  }

  console.log("CSV preview:");
  console.log(csv.slice(0, 500));

  const rows = parseCsv(csv);

  if (rows.length < 2) {
    throw new Error(
      [
        "Featured reviews CSV did not contain data rows.",
        "Check that the tab 'Udvalgte vurderinger' is included in the published spreadsheet.",
        "Also check that the first row contains headers and that at least one row has Aktiv and Titel.",
      ].join("\n")
    );
  }

  const objects = rowsToObjects(rows);
  const usefulRows = objects.filter(rowIsUseful);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: csvUrl,
    sheetName: FEATURED_SHEET_NAME,
    gid: FEATURED_SHEET_GID,
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
