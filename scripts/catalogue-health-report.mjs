import { appendFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const STATUS_LABELS = {
  success: "PASS",
  failure: "FAIL",
  skipped: "NOT RUN",
  cancelled: "CANCELLED"
};

function formatCheck(label, outcome, detail) {
  const status = STATUS_LABELS[outcome] || "UNKNOWN";
  const explanation = detail || (outcome === "success" ? "Kontrollen bestod." : "Se workflowets trin og diagnostik.");
  return `- **${label}: ${status}.** ${explanation}`;
}

export function formatCatalogueHealthReport({ sheetSource, pipelineWatch, productionCatalogue }) {
  return [
    "## Catalogue health report",
    "",
    formatCheck("Katalogindhold og Google Sheets-afstemning", sheetSource),
    formatCheck("Faktisk produktionskatalog og hjemmeside", productionCatalogue),
    formatCheck("Planlagte syncs og ventende katalog-PR'er", pipelineWatch),
    "",
    "En fejl i ét kontrolområde ændrer ikke resultatet for de andre områder."
  ].join("\n");
}

async function main() {
  if (!process.env.GITHUB_STEP_SUMMARY) throw new Error("GITHUB_STEP_SUMMARY is required.");
  const report = formatCatalogueHealthReport({
    sheetSource: process.env.SHEET_SOURCE_OUTCOME,
    pipelineWatch: process.env.PIPELINE_WATCH_OUTCOME,
    productionCatalogue: process.env.PRODUCTION_CATALOGUE_OUTCOME
  });
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
  console.log("Catalogue health areas written to the workflow summary.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  });
}
