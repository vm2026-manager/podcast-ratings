import { fileURLToPath } from "node:url";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export function evaluateCataloguePipeline({ runs, pullRequests, now = Date.now(), staleAfterMs = TWO_HOURS_MS }) {
  const errors = [];
  const latestRun = [...(runs || [])].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  if (!latestRun) {
    errors.push("No Sync Podcastlisten catalogue run is recorded.");
  } else {
    const age = now - Date.parse(latestRun.created_at);
    if (age >= staleAfterMs && (latestRun.status !== "completed" || latestRun.conclusion !== "success")) {
      errors.push(`Latest catalogue sync run #${latestRun.run_number} is ${latestRun.status}/${latestRun.conclusion || "pending"} and is ${Math.floor(age / 60000)} minutes old: ${latestRun.html_url}`);
    }
    if (age >= staleAfterMs && latestRun.status === "completed" && latestRun.conclusion === "success") {
      errors.push(`No catalogue sync run has started for ${Math.floor(age / 60000)} minutes; the scheduled Sheet import may be stalled: ${latestRun.html_url}`);
    }
  }

  for (const pr of pullRequests || []) {
    const age = now - Date.parse(pr.created_at);
    if (age >= staleAfterMs) {
      errors.push(`Catalogue PR #${pr.number} has remained open for ${Math.floor(age / 60000)} minutes: ${pr.html_url} (head ${pr.head?.sha || "unknown"}).`);
    }
  }
  return { ok: errors.length === 0, errors };
}

async function githubJson(path) {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  if (!token || !repository) throw new Error("GITHUB_TOKEN and GITHUB_REPOSITORY are required for read-only pipeline monitoring.");
  const response = await fetch(`https://api.github.com/repos/${repository}/${path}`, {
    headers: { accept: "application/vnd.github+json", authorization: `Bearer ${token}`, "x-github-api-version": "2022-11-28" }
  });
  if (!response.ok) throw new Error(`GitHub API ${path} returned HTTP ${response.status}.`);
  return response.json();
}

async function main() {
  const [runData, pulls] = await Promise.all([
    githubJson("actions/workflows/sync-sheet-data.yml/runs?per_page=10"),
    githubJson(`pulls?state=open&base=main&head=${encodeURIComponent(`${process.env.GITHUB_REPOSITORY.split("/")[0]}:automation/catalogue-sync`)}&per_page=100`)
  ]);
  const result = evaluateCataloguePipeline({ runs: runData.workflow_runs, pullRequests: pulls });
  if (!result.ok) {
    console.error(`CRITICAL CATALOGUE PIPELINE FAILURE\n- ${result.errors.join("\n- ")}`);
    process.exitCode = 1;
    return;
  }
  console.log("Catalogue sync run and pending PR are within the two-hour health window.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`CRITICAL CATALOGUE PIPELINE FAILURE\n- ${error?.message || error}`);
    process.exitCode = 1;
  });
}
