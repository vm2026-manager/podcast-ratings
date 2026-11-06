import { fileURLToPath } from "node:url";
import { inspectSheetSourceDrift } from "./check-sheet-source-drift.mjs";

export const CATALOGUE_SYNC_RECOVERY_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const ACTIVE_RUN_STATUSES = new Set(["requested", "queued", "pending", "waiting", "in_progress"]);

export function decideCatalogueSyncRecovery({
  driftedPodcastIds = [],
  runs = [],
  pullRequests = [],
  now = Date.now(),
  cooldownMs = CATALOGUE_SYNC_RECOVERY_COOLDOWN_MS
} = {}) {
  const ids = [...new Set(driftedPodcastIds.map((id) => String(id || "").trim()).filter(Boolean))].sort();
  if (!ids.length) return { dispatch: false, reason: "no-verified-catalogue-drift", podcastIds: [] };

  const activeRun = runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status));
  if (activeRun) return { dispatch: false, reason: "sync-run-active", runId: activeRun.id, podcastIds: ids };

  if (pullRequests.length) {
    return { dispatch: false, reason: "catalogue-sync-pr-open", prNumber: pullRequests[0].number, podcastIds: ids };
  }

  const recentDispatch = runs
    .filter((run) => run.event === "workflow_dispatch" && Number.isFinite(Date.parse(run.created_at)))
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .find((run) => now - Date.parse(run.created_at) < cooldownMs);
  if (recentDispatch) {
    return { dispatch: false, reason: "recovery-cooldown", runId: recentDispatch.id, podcastIds: ids };
  }

  return { dispatch: true, reason: "verified-catalogue-drift", podcastIds: ids };
}

async function githubJson(fetchImpl, repository, token, path, init = {}) {
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/${path}`, {
    ...init,
    headers: {
      accept: "application/vnd.github+json",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "x-github-api-version": "2022-11-28",
      ...(init.headers || {})
    }
  });
  if (!response.ok) throw new Error(`GitHub API ${path} returned HTTP ${response.status}.`);
  if (response.status === 204) return null;
  return response.json();
}

export async function recoverCatalogueSyncIfNeeded({
  driftedPodcastIds,
  repository,
  token,
  now = Date.now(),
  cooldownMs = CATALOGUE_SYNC_RECOVERY_COOLDOWN_MS,
  fetchImpl = fetch
} = {}) {
  if (!driftedPodcastIds?.some((id) => String(id || "").trim())) {
    return { dispatch: false, reason: "no-verified-catalogue-drift", podcastIds: [] };
  }
  if (!/^[\w.-]+\/[\w.-]+$/u.test(String(repository || "")) || !token) {
    throw new Error("GITHUB_REPOSITORY and GITHUB_TOKEN are required to recover verified catalogue drift.");
  }

  const owner = repository.split("/")[0];
  const head = encodeURIComponent(`${owner}:automation/catalogue-sync`);
  const [runData, pullRequests] = await Promise.all([
    githubJson(fetchImpl, repository, token, "actions/workflows/sync-sheet-data.yml/runs?per_page=100"),
    githubJson(fetchImpl, repository, token, `pulls?state=open&base=main&head=${head}&per_page=100`)
  ]);
  const decision = decideCatalogueSyncRecovery({
    driftedPodcastIds,
    runs: runData?.workflow_runs || [],
    pullRequests: pullRequests || [],
    now,
    cooldownMs
  });
  if (!decision.dispatch) return decision;

  await githubJson(fetchImpl, repository, token, "actions/workflows/sync-sheet-data.yml/dispatches", {
    method: "POST",
    body: JSON.stringify({ ref: "main" })
  });
  return decision;
}

async function main() {
  const args = process.argv.slice(2);
  const directoryIndex = args.indexOf("--candidate-dir");
  const candidateDirectory = directoryIndex < 0 ? "" : args[directoryIndex + 1];
  if (!candidateDirectory) throw new Error("--candidate-dir requires a staged sync directory.");

  let sourceDrift;
  try {
    const root = new URL("../", import.meta.url);
    sourceDrift = await inspectSheetSourceDrift({
      root: fileURLToPath(root),
      candidateDirectory
    });
  } catch (error) {
    console.log(`No sync dispatch: staged Sheet output could not be verified (${error?.message || error}).`);
    return;
  }

  const driftedPodcastIds = sourceDrift.changedPodcastIds || [];
  if (!driftedPodcastIds.length) {
    console.log("No sync dispatch: no verified Podcast-ID drift in staged Sheet output.");
    return;
  }

  const decision = await recoverCatalogueSyncIfNeeded({
    driftedPodcastIds,
    repository: process.env.GITHUB_REPOSITORY,
    token: process.env.GITHUB_TOKEN
  });
  if (decision.dispatch) {
    console.log(`Dispatched the existing sync workflow once for verified Podcast-ID drift: ${decision.podcastIds.join(", ")}.`);
  } else {
    console.log(`No sync dispatch (${decision.reason}) for verified Podcast-ID drift: ${decision.podcastIds.join(", ")}.`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error(`Catalogue sync recovery failed closed: ${error?.message || error}`);
    process.exitCode = 1;
  });
}
