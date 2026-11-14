import assert from "node:assert/strict";
import { formatCatalogueHealthReport } from "./catalogue-health-report.mjs";

const healthy = formatCatalogueHealthReport({
  sheetSource: "success",
  pipelineWatch: "success",
  productionCatalogue: "success"
});
assert.match(healthy, /Katalogindhold og Google Sheets-afstemning: PASS/u);
assert.match(healthy, /Faktisk produktionskatalog og hjemmeside: PASS/u);
assert.match(healthy, /Planlagte syncs og ventende katalog-PR'er: PASS/u);

const pipelineOnlyFailure = formatCatalogueHealthReport({
  sheetSource: "success",
  pipelineWatch: "failure",
  productionCatalogue: "success"
});
assert.match(pipelineOnlyFailure, /Google Sheets-afstemning: PASS/u);
assert.match(pipelineOnlyFailure, /produktionskatalog og hjemmeside: PASS/u);
assert.match(pipelineOnlyFailure, /Planlagte syncs og ventende katalog-PR'er: FAIL/u);

const sourceOnlyFailure = formatCatalogueHealthReport({
  sheetSource: "failure",
  pipelineWatch: "success",
  productionCatalogue: "success"
});
assert.match(sourceOnlyFailure, /Google Sheets-afstemning: FAIL/u);
assert.match(sourceOnlyFailure, /produktionskatalog og hjemmeside: PASS/u);
assert.match(sourceOnlyFailure, /Planlagte syncs og ventende katalog-PR'er: PASS/u);

const productionOnlyFailure = formatCatalogueHealthReport({
  sheetSource: "success",
  pipelineWatch: "success",
  productionCatalogue: "failure"
});
assert.match(productionOnlyFailure, /Google Sheets-afstemning: PASS/u);
assert.match(productionOnlyFailure, /produktionskatalog og hjemmeside: FAIL/u);
assert.match(productionOnlyFailure, /Planlagte syncs og ventende katalog-PR'er: PASS/u);

const skippedDiagnostics = formatCatalogueHealthReport({
  sheetSource: "success",
  pipelineWatch: "skipped",
  productionCatalogue: "skipped"
});
assert.match(skippedDiagnostics, /Planlagte syncs og ventende katalog-PR'er: NOT RUN/u);
assert.match(skippedDiagnostics, /Faktisk produktionskatalog og hjemmeside: NOT RUN/u);

console.log("Catalogue health report keeps the three control areas independent.");
