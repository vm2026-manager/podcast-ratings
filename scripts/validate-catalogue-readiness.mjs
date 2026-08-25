import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_PODCAST_IDS = [
  "hva sa",
  "jagten pa det evige liv",
  "sagen genabnet",
  "vi ser pa det",
  "vagn lidt op"
];

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function inspectCatalogueReadiness(snapshot, requiredPodcastIds = REQUIRED_PODCAST_IDS) {
  const podcasts = Array.isArray(snapshot?.podcasts) ? snapshot.podcasts : [];
  const podcastById = snapshot?.podcastById && typeof snapshot.podcastById === "object"
    ? snapshot.podcastById
    : {};
  const missingPodcastIds = requiredPodcastIds.filter((podcastId) => !podcastById[podcastId]);

  return {
    ready:
      snapshot?.podcastDataStatus === "ready" &&
      podcasts.length > 0 &&
      missingPodcastIds.length === 0,
    podcastDataStatus: snapshot?.podcastDataStatus || "unknown",
    podcastCount: podcasts.length,
    missingPodcastIds
  };
}

export async function waitForCatalogueReadiness(
  readSnapshot,
  { requiredPodcastIds = REQUIRED_PODCAST_IDS, timeoutMs = 10000, pollIntervalMs = 50 } = {}
) {
  const deadline = Date.now() + timeoutMs;
  let lastResult = inspectCatalogueReadiness(await readSnapshot(), requiredPodcastIds);

  while (!lastResult.ready && Date.now() < deadline) {
    await sleep(pollIntervalMs);
    lastResult = inspectCatalogueReadiness(await readSnapshot(), requiredPodcastIds);
  }

  if (!lastResult.ready) {
    throw new Error(
      `Kataloget blev ikke klar: status=${lastResult.podcastDataStatus}, ` +
        `podcasts=${lastResult.podcastCount}, mangler=${lastResult.missingPodcastIds.join(", ")}`
    );
  }

  return lastResult;
}

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const preRefresh = {
    podcastDataStatus: "loading",
    podcasts: [{ podcastId: "hva sa" }],
    podcastById: { "hva sa": { podcastId: "hva sa" } }
  };
  const postRefresh = {
    podcastDataStatus: "ready",
    podcasts: REQUIRED_PODCAST_IDS.map((podcastId) => ({ podcastId })),
    podcastById: Object.fromEntries(
      REQUIRED_PODCAST_IDS.map((podcastId) => [podcastId, { podcastId }])
    )
  };

  const before = inspectCatalogueReadiness(preRefresh);
  assert(!before.ready, "Pre-refresh state må ikke betragtes som katalogklar");

  let reads = 0;
  const after = await waitForCatalogueReadiness(async () => {
    reads += 1;
    return reads < 2 ? preRefresh : postRefresh;
  }, { pollIntervalMs: 0 });

  assert(after.ready, "Post-refresh state skal betragtes som katalogklar");
  assert(reads === 2, "Readiness skal kontrollere igen i stedet for at bruge en fast forsinkelse");

  console.log(JSON.stringify({
    status: "PASS",
    readinessCondition: "podcastDataStatus=ready + non-empty catalogue + five canonical podcastById entries",
    preRefreshRejected: true,
    postRefreshAccepted: true,
    requiredPodcastIds: REQUIRED_PODCAST_IDS
  }, null, 2));
}
