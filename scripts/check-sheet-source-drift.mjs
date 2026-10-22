import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const files = [
  "data/podcasts.json",
  "data/featured-reviews.json",
  "data/explore-clusters.json"
];

function comparable(value) {
  if (Array.isArray(value)) return value.map(comparable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => key !== "generatedAt")
    .map(([key, entry]) => [key, comparable(entry)]));
}

function catalogueChanges(published, candidate) {
  const existing = new Map((published?.rows || []).map((row) => [row["Podcast-ID"], row]));
  const current = new Map((candidate?.rows || []).map((row) => [row["Podcast-ID"], row]));
  return [...new Set([...existing.keys(), ...current.keys()])]
    .filter((id) => JSON.stringify(existing.get(id)) !== JSON.stringify(current.get(id)))
    .filter(Boolean)
    .sort();
}

export async function inspectSheetSourceDrift({ root, candidateDirectory }) {
  const changedFiles = [];
  const changedPodcastIds = [];
  for (const file of files) {
    const [publishedText, candidateText] = await Promise.all([
      readFile(path.join(root, file), "utf8"),
      readFile(path.join(root, candidateDirectory, file), "utf8")
    ]);
    const published = JSON.parse(publishedText);
    const candidate = JSON.parse(candidateText);
    if (JSON.stringify(comparable(published)) !== JSON.stringify(comparable(candidate))) {
      changedFiles.push(file);
      if (file === "data/podcasts.json") changedPodcastIds.push(...catalogueChanges(published, candidate));
    }
  }
  return { ok: changedFiles.length === 0, changedFiles, changedPodcastIds: [...new Set(changedPodcastIds)] };
}

async function main() {
  const args = process.argv.slice(2);
  const directoryIndex = args.indexOf("--candidate-dir");
  const candidateDirectory = directoryIndex < 0 ? "" : args[directoryIndex + 1];
  if (!candidateDirectory) throw new Error("--candidate-dir requires a staged sync directory.");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const result = await inspectSheetSourceDrift({ root, candidateDirectory });
  if (!result.ok) {
    const details = [
      `Google Sheet changes are not present in main: ${result.changedFiles.join(", ")}`,
      result.changedPodcastIds.length ? `Changed Podcast-ID(s): ${result.changedPodcastIds.join(", ")}` : "",
      "The scheduled catalogue sync, validation, PR checks, merge, or Pages deployment has not completed."
    ].filter(Boolean);
    console.error(`CRITICAL CATALOGUE PIPELINE FAILURE\n- ${details.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Published Google Sheet outputs match the current main catalogue.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
