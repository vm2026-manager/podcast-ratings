import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  buildSimilarityCatalog,
  buildSimilarityResultsForCatalog,
  validateSimilarityConfig
} from "./podcast-similarity-engine-v1.1.mjs";
import {
  buildProductOutput,
  validateProductConfig
} from "./build-podcast-similarity-product-v1.3.mjs";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, ""));
}

function buildCurrentProduct(rootDir = PROJECT_ROOT) {
  const podcasts = readJson(path.join(rootDir, "data", "podcasts.json"));
  const metadata = readJson(path.join(rootDir, "data", "recommendation-metadata.json"));
  const v11Config = validateSimilarityConfig(
    readJson(path.join(rootDir, "config", "podcast-similarity-engine-v1.1.json"))
  );
  const productConfig = validateProductConfig(
    readJson(path.join(rootDir, "config", "podcast-similarity-product-v1.3.json"))
  );
  const catalog = buildSimilarityCatalog(metadata, podcasts);
  const v11Output = buildSimilarityResultsForCatalog(catalog, v11Config);
  return buildProductOutput(podcasts, metadata, v11Output, v11Config, productConfig);
}

function runBuild({ rootDir = PROJECT_ROOT, outputPath, stdout = false } = {}) {
  const output = buildCurrentProduct(rootDir);
  const serialized = stdout
    ? JSON.stringify(output)
    : `${JSON.stringify(output, null, 2)}\n`;
  if (stdout) {
    process.stdout.write(serialized);
  } else {
    const destination = outputPath || path.join(rootDir, "data", "podcast-similarity-product-v1.3.json");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, serialized, "utf8");
  }
  return output;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  runBuild({ stdout: process.argv.includes("--stdout") });
}

export { PROJECT_ROOT, buildCurrentProduct, runBuild };
