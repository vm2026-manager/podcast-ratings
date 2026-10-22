import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS = 1000;
export const DEFAULT_PRODUCTION_URL = "https://podcastlisten.dk";

const normalizeText = (value) => String(value ?? "").trim();

export function validateProductionCataloguePayload(payload, { minimumRows = MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS } = {}) {
  const errors = [];
  const rows = Array.isArray(payload?.rows) ? payload.rows : Array.isArray(payload) ? payload : null;
  if (!rows) return { ok: false, errors: ["podcasts.json has no rows array"], rowCount: 0 };

  if (rows.length < minimumRows) {
    errors.push(`catalogue row count ${rows.length} is below safety minimum ${minimumRows}`);
  }

  const ids = new Set();
  for (const row of rows) {
    const id = normalizeText(row?.["Podcast-ID"]);
    if (!id) {
      errors.push(`blank Podcast-ID for ${JSON.stringify(normalizeText(row?.Titel))}`);
      if (errors.length >= 20) break;
      continue;
    }
    if (ids.has(id)) {
      errors.push(`duplicate Podcast-ID ${JSON.stringify(id)}`);
      if (errors.length >= 20) break;
      continue;
    }
    ids.add(id);
  }

  return { ok: errors.length === 0, errors, rowCount: rows.length };
}

export function validateProductionDisplayGroups(payload) {
  if (payload?.version !== 1 || !Array.isArray(payload?.groups)) {
    return { ok: false, errors: ["podcast-display-groups.json has invalid format"] };
  }
  return { ok: true, errors: [], groupCount: payload.groups.length };
}

async function fetchJson(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
}

async function fetchText(fetchImpl, url) {
  const response = await fetchImpl(url, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.text();
}

export async function checkProductionCatalogue({
  baseUrl = DEFAULT_PRODUCTION_URL,
  expectedRows = MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS,
  expectedGeneratedAt = "",
  expectedCatalogue = null,
  expectedDataAssets = {},
  expectedAppSource = "",
  fetchImpl = fetch,
  attempts = 5,
  retryDelays = [0, 10000, 20000, 40000, 60000],
  mainCommitAt = "",
  nowMs = Date.now(),
  deploymentGraceMs = 2 * 60 * 60 * 1000,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
} = {}) {
  const minimumRows = Math.max(MINIMUM_SAFE_PODCAST_CATALOGUE_ROWS, Math.floor(expectedRows * 0.9));
  let lastErrors = [];

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const delay = retryDelays[Math.min(attempt, retryDelays.length - 1)] || 0;
    if (delay) await sleep(delay);

    const stamp = Date.now();
    const errors = [];
    try {
      const [catalogue, displayGroups, appSource, ...dataAssets] = await Promise.all([
        fetchJson(fetchImpl, `${baseUrl}/data/podcasts.json?health=${stamp}`),
        fetchJson(fetchImpl, `${baseUrl}/data/podcast-display-groups.json?health=${stamp}`),
        fetchText(fetchImpl, `${baseUrl}/app.js?health=${stamp}`),
        ...Object.keys(expectedDataAssets).map((file) => fetchJson(fetchImpl, `${baseUrl}/${file}?health=${stamp}`))
      ]);

      const catalogueResult = validateProductionCataloguePayload(catalogue, { minimumRows });
      const displayGroupResult = validateProductionDisplayGroups(displayGroups);
      errors.push(...catalogueResult.errors, ...displayGroupResult.errors);

      if (expectedCatalogue && JSON.stringify(catalogue) !== JSON.stringify(expectedCatalogue)) {
        errors.push("production data/podcasts.json does not match main (catalogue or Supplerende ligheder are stale)");
      }
      Object.entries(expectedDataAssets).forEach(([file, expected], index) => {
        if (JSON.stringify(dataAssets[index]) !== JSON.stringify(expected)) {
          errors.push(`production ${file} does not match main`);
        }
      });

      if (!appSource.includes("initialPodcastStartup = loadPodcasts();")) {
        errors.push("production app.js is missing the catalogue startup marker");
      }
      if (expectedGeneratedAt && catalogue?.generatedAt !== expectedGeneratedAt) {
        errors.push(`production catalogue generatedAt ${JSON.stringify(catalogue?.generatedAt)} does not match main ${JSON.stringify(expectedGeneratedAt)}`);
      }
      if (expectedAppSource && appSource !== expectedAppSource) {
        errors.push("production app.js does not match current main");
      }

      if (!errors.length) {
        return {
          ok: true,
          attempts: attempt + 1,
          rowCount: catalogueResult.rowCount,
          minimumRows,
          groupCount: displayGroupResult.groupCount
        };
      }
    } catch (error) {
      errors.push(error?.message || String(error));
    }

    lastErrors = errors;
  }

  const mainAgeMs = mainCommitAt ? Math.max(0, nowMs - Date.parse(mainCommitAt)) : Number.POSITIVE_INFINITY;
  if (
    lastErrors.length > 0 &&
    lastErrors.every((message) => message.startsWith("production ")) &&
    mainAgeMs < deploymentGraceMs
  ) {
    return {
      ok: true,
      pendingDeployment: true,
      mainAgeMs,
      errors: lastErrors
    };
  }

  throw new Error(
    `CRITICAL PRODUCTION CATALOGUE HEALTH FAILURE\n- ${lastErrors.join("\n- ")}`
  );
}

async function main() {
  const repoCatalogue = JSON.parse(
    await readFile(new URL("../data/podcasts.json", import.meta.url), "utf8")
  );
  const expectedRows = Array.isArray(repoCatalogue?.rows) ? repoCatalogue.rows.length : 0;
  const expectedGeneratedAt = String(repoCatalogue?.generatedAt || "");
  const expectedDataAssets = Object.fromEntries(await Promise.all([
    "data/featured-reviews.json",
    "data/explore-clusters.json",
    "data/recommendation-metadata.json"
  ].map(async (file) => [file, JSON.parse(await readFile(new URL(`../${file}`, import.meta.url), "utf8"))])));
  const expectedAppSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
  const mainCommitAt = execFileSync("git", ["show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" }).trim();
  const result = await checkProductionCatalogue({ expectedRows, expectedGeneratedAt, expectedCatalogue: repoCatalogue, expectedDataAssets, expectedAppSource, mainCommitAt });
  console.log(JSON.stringify(result, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    const { appendFile } = await import("node:fs/promises");
    await appendFile(process.env.GITHUB_OUTPUT, `pendingDeployment=${result.pendingDeployment ? "true" : "false"}\n`);
  }
  if (result.pendingDeployment) {
    console.log(`GitHub Pages deployment is still within the two-hour grace period (${Math.ceil(result.mainAgeMs / 60000)} minutes).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
