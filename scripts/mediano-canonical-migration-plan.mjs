import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EXPLICIT_TARGET_BY_OLD_PODCAST_ID = Object.freeze([
  ["her er vores bud pa de ti spillere har været de største transfersucceser i superligaen", "transfer special"],
  ["der var engang et mal af peter møller mod farum", "der var engang et mal"],
  ["vi præsenterer erik skjærbæk", "klub mediano"],
  ["sadan blev han victor froholdt", "klub mediano"],
  ["sagen om de 15 point forsvandt fra i lommen af den gamle dame", "mediano special"],
  ["kristjaan speakmann", "bruchmann ringer til"]
]);

function text(value) { return String(value ?? "").trim(); }

export async function buildMedianoCanonicalMigrationPlan(cataloguePath = path.join(root, "data", "podcasts.json")) {
  const payload = JSON.parse(await readFile(cataloguePath, "utf8"));
  const rows = Array.isArray(payload) ? payload : payload.rows;
  const mediano = rows.filter((row) => /^(mediano|media o)$/iu.test(text(row.Udgiver)));
  const targetByOldPodcastId = new Map(EXPLICIT_TARGET_BY_OLD_PODCAST_ID);
  for (const row of mediano) {
    if (text(row.Hovedserie) === "Jennings") targetByOldPodcastId.set(text(row["Podcast-ID"]), "magasinet jennings");
  }
  const catalogueIds = new Set(rows.map((row) => text(row["Podcast-ID"])).filter(Boolean));
  const candidates = mediano.filter((row) => targetByOldPodcastId.has(text(row["Podcast-ID"]))).map((row) => {
    const oldPodcastId = text(row["Podcast-ID"]);
    const targetPodcastId = targetByOldPodcastId.get(oldPodcastId);
    return {
      oldPodcastId,
      targetPodcastId,
      title: text(row.Titel),
      editorialRatingPresent: Boolean(text(row["Vuring (1-10)"])),
      targetExistsInCatalogue: catalogueIds.has(targetPodcastId),
      databaseCounts: "not queried; requires an approved read-only Supabase audit",
      presentationAction: catalogueIds.has(targetPodcastId)
        ? "safe-local-alias-and-suppress"
        : "retain-until-canonical-catalogue-row-exists"
    };
  });
  const safeMappings = candidates.filter((candidate) => candidate.targetExistsInCatalogue);
  const unresolvedCandidates = candidates.filter((candidate) => !candidate.targetExistsInCatalogue);
  return {
    version: 2,
    destructiveActions: false,
    candidates,
    safeMappings,
    unresolvedCandidates,
    expectedCandidateCount: 24
  };
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  buildMedianoCanonicalMigrationPlan().then((plan) => console.log(JSON.stringify(plan, null, 2)));
}
