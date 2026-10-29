import { readFile } from "node:fs/promises";
import { validateCatalogueIntake } from "./catalogue-intake.mjs";

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const beforePath = argument("--before");
const candidatePath = argument("--candidate");
const intakePath = argument("--intake");
if (!beforePath || !candidatePath || !intakePath) {
  throw new Error("Usage: node scripts/validate-catalogue-intake.mjs --before <published.json> --candidate <staged.json> --intake <candidates.json>");
}

const [beforePayload, candidatePayload, intakePayload] = await Promise.all([
  readFile(beforePath, "utf8").then(JSON.parse),
  readFile(candidatePath, "utf8").then(JSON.parse),
  readFile(intakePath, "utf8").then(JSON.parse)
]);
const result = validateCatalogueIntake({
  publishedRows: beforePayload.rows,
  candidateRows: candidatePayload.rows,
  intakeCandidates: intakePayload.candidates
});

if (!result.ok) {
  for (const error of result.errors) console.error("::error::" + error);
  process.exitCode = 1;
} else {
  console.log("Catalogue intake PASS: " + result.publishedCount + " published IDs retained; " + result.stagedCount + " staged IDs; " + result.candidateCount + " incomplete candidate(s) queued without identity creation.");
}
