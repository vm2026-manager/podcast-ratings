import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBufferClient } from "./buffer-graphql.mjs";
import { INSTAGRAM_ACCOUNT, buildEditorialPlan, loadEditorialInputs, serializeReviewCsv } from "./instagram-editorial-plan.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDir = path.resolve(process.env.INSTAGRAM_PLAN_OUTPUT_DIR || path.join(root, "output", "instagram-editorial-plan"));
const queries = Object.freeze({
  organizations: `query InstagramEditorialOrganizations { account { organizations { id name } } }`,
  channels: `query InstagramEditorialChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName externalLink service organizationId isDisconnected isLocked } }`,
  posts: `query InstagramEditorialPosts($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) { posts(first: 100, after: $after, input: { organizationId: $organizationId, filter: { channelIds: [$channelId], status: [draft, scheduled, sent, sending, error, needs_approval] } }) { edges { node { id text status channelId dueAt } } pageInfo { hasNextPage endCursor } } }`,
});

export function createReadOnlyInstagramGraphql(client) {
  const allowed = new Set(Object.values(queries));
  return async (query, variables = {}) => {
    if (!allowed.has(query) || /\bmutation\b/i.test(query)) throw new Error("Instagram editorial plan client is read-only; Buffer mutations are forbidden");
    return client(query, variables);
  };
}

export async function scanInstagramChannelHistory(graphql, { now = new Date(), scanId = "manual-read-only" } = {}) {
  const accountData = await graphql(queries.organizations);
  const organizations = accountData?.account?.organizations;
  if (!Array.isArray(organizations) || organizations.length === 0) throw new Error("Buffer returned no readable organizations");
  const channelMatches = [];
  for (const organization of organizations) {
    const channelData = await graphql(queries.channels, { organizationId: organization.id });
    if (!Array.isArray(channelData?.channels)) throw new Error("Buffer returned an invalid channel list");
    for (const channel of channelData.channels) {
      if (channel.service !== "instagram") continue;
      const name = String(channel.name ?? "").replace(/^@/, "").trim().toLocaleLowerCase("en-US");
      let externalHandle = "";
      let externalHost = "";
      let protocol = "";
      try {
        const external = new URL(channel.externalLink);
        externalHandle = external.pathname.replace(/^\/+|\/+$/g, "").toLocaleLowerCase("en-US");
        externalHost = external.hostname.toLocaleLowerCase("en-US");
        protocol = external.protocol;
      } catch { /* Fail exact account matching below. */ }
      if (name === INSTAGRAM_ACCOUNT && externalHandle === INSTAGRAM_ACCOUNT && protocol === "https:" &&
          ["instagram.com", "www.instagram.com"].includes(externalHost)) {
        channelMatches.push({ ...channel, organizationName: organization.name });
      }
    }
  }
  if (channelMatches.length !== 1) throw new Error(`Expected exactly one Buffer Instagram channel @${INSTAGRAM_ACCOUNT}; found ${channelMatches.length}`);
  const channel = channelMatches[0];
  if (channel.isDisconnected || channel.isLocked) throw new Error("Buffer Instagram channel is disconnected or locked");
  const posts = [];
  let after;
  do {
    const data = await graphql(queries.posts, { organizationId: channel.organizationId, channelId: channel.id, ...(after ? { after } : {}) });
    const connection = data?.posts;
    if (!connection || !Array.isArray(connection.edges) || !connection.pageInfo) throw new Error("Buffer returned an invalid post-history page");
    for (const edge of connection.edges) {
      if (!edge?.node || edge.node.channelId !== channel.id) throw new Error("Buffer history returned an invalid or cross-channel post");
      posts.push(edge.node);
    }
    if (!connection.pageInfo.hasNextPage) break;
    if (!connection.pageInfo.endCursor || connection.pageInfo.endCursor === after) throw new Error("Buffer history pagination did not advance; refusing an incomplete plan");
    after = connection.pageInfo.endCursor;
  } while (true);
  return Object.freeze({
    account: `@${INSTAGRAM_ACCOUNT}`,
    channelId: channel.id,
    organizationId: channel.organizationId,
    scannedAt: now.toISOString(),
    scanId,
    complete: true,
    postCount: posts.length,
    posts,
  });
}

export async function prepareInstagramEditorialPlan({ rootPath = root, graphql, outputPath = outputDir, now = new Date(), scanId } = {}) {
  if (typeof graphql !== "function") throw new Error("A read-only Buffer GraphQL client is required");
  const inputs = await loadEditorialInputs(rootPath);
  const bufferScan = await scanInstagramChannelHistory(graphql, { now, scanId });
  const historyPath = process.env.INSTAGRAM_HISTORY_FILE;
  let publishedPodcastIds = [];
  if (historyPath) {
    try {
      const history = JSON.parse(await readFile(historyPath, "utf8"));
      if (history.schemaVersion !== 1 || !Array.isArray(history.usedPodcastIds) || history.usedPodcastIds.some((id) => typeof id !== "string")) {
        throw new Error("Instagram history cache has an invalid schema");
      }
      publishedPodcastIds = history.usedPodcastIds;
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`Instagram publication history is invalid; refusing plan preparation: ${error.message}`);
    }
  }
  const plan = buildEditorialPlan({ ...inputs, publishedPodcastIds, bufferScan, today: now, root: rootPath });
  await mkdir(outputPath, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputPath, "instagram-editorial-plan.json"), `${JSON.stringify(plan, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputPath, "instagram-editorial-review.csv"), serializeReviewCsv(plan), "utf8"),
    writeFile(path.join(outputPath, "README.md"), reviewInstructions(plan), "utf8"),
  ]);
  return plan;
}

export function reviewInstructions(plan) {
  return `# Instagram: redaktionel gennemgang\n\n` +
    `Planen indeholder ${plan.posts.length} forslag til @podcastlisten.dk. Datoerne er kun forslag (mandag, onsdag og fredag over fem uger); ingen dato er sendt til Buffer. Buffer-historikken blev læst uden mutation ${plan.bufferHistory.scannedAt}; ${plan.bufferHistory.postCount} opslag blev gennemgået.\n\n` +
    `## Status for alle 15 kandidater\n\n` +
    `| # | Podcast-ID | Score | Hovedserie | Billedkontrol | Coverret | Adgangskilde | Lyttelink | Take | Godkendelse |\n|---:|---|---:|---|---|---|---|---|---|---|\n` +
    plan.posts.map((slot) => `| ${slot.position} | \`${slot.podcastId}\` | ${slot.score.display} | ${slot.mainSeries || "—"} | ${slot.reviewStatus.imageQuality} | ${slot.reviewStatus.coverRights} | ${slot.currentAccessReview.status} (${slot.currentAccessReview.checkedAt || "udateret"}) | ${slot.caption.targetLinkResearchStatus} | ${slot.reviewStatus.personalTake} | ${slot.reviewStatus.approval} |`).join("\n") +
    `\n\n## Kandidater på HOLD\n\n` +
    (plan.heldCandidates.length
      ? `| Podcast-ID | Titel | Score | Udgiver | Linkstatus | Kilde | Årsag |\n|---|---|---:|---|---|---|---|\n` +
        plan.heldCandidates.map((item) => `| \`${item.podcastId}\` | ${item.title} | ${String(item.score ?? "—").replace(".", ",")} | ${item.publisher} | ${item.linkResearchStatus} | ${item.linkResearchEvidenceUrl || "—"} | ${item.reason} |`).join("\n") + `\n\n`
      : "Ingen kandidater på HOLD.\n\n") +
    `Hold-poster er ikke blandt de 15 slots; pladserne udfyldes af næste kandidater, der består de eksisterende score/perle-, eksakt-ID-, cover- og historikregler. Datoerne forbliver mandag, onsdag og fredag. HOLD ændrer ikke kataloget.\n\n` +
    `## Gennemgang pr. opslag\n\n` +
    `- Skriv ejerens personlige take i JSON-feltet \`caption.ownerTake\` eller CSV-kolonnen \`ownerTake\` (10–240 tegn). Det skal være ejerens egne ord; feltet starter tomt.\n` +
    `- Aktuelle kildechecks er registreret i \`data/instagram-editorial-review-research.json\`. Hvert verificeret lyttelink har eksakt Podcast-ID, udgiver, sidetitel/episodeinterval, URL, HTTP-status og kontroldato i JSON og CSV. Udgåede links, tredjepartssider og prolog-links er markeret; research-status er ikke ejerens godkendelse. Kun handles med præcist link fra udgiverens eget website vises. Publisher-hashtags er ikke verificeret og derfor udeladt; radioetiketter normaliseres ikke.\n` +
    `- Coverrettigheder er kontrolleret mod den versionsstyrede rettighedsliste. En manglende rettighed blokerer billedgenerering og alle Buffer-handlinger; der er ingen genrekort-fallback.\n` +
    `- Delte SHA-256-værdier på tværs af Podcast-ID'er er listet i \`sharedArtworkGroups\`. De dokumenterer byte-identisk artwork, ikke unik underserieidentitet; hver identitet kræver separat manuel kontrol.\n` +
    `- De ${plan.posts.filter((slot) => slot.cover.qualityStatus === "manual-quality-review-required").length} covers med manuel kvalitetskontrol vises særskilt med faktisk målt format, dimensioner, byteantal og SHA-256 i JSON/CSV. Originalfiler ændres ikke.\n` +
    `- Gennemgå coveret, vælg placering og kontrast manuelt. Placering skal bindes til samme eksakte Podcast-ID og kilde-SHA-256.\n` +
    `- Godkend billedet og caption separat pr. opslag. Hashes skal svare til den præcise caption, coverkilde og færdige billedfil. Enhver ændring kræver ny godkendelse.\n` +
    `- Importér CSV-ændringer uden at give godkendelse med \`node scripts/instagram-editorial-plan.mjs --apply-csv <plan.json> <review.csv> <output-plan.json>\`. Validér derefter med \`node scripts/instagram-editorial-plan.mjs --validate <output-plan.json>\`. Validator og import foretager ingen Buffer-kald.\n` +
    `- Ingen publicering, scheduling, Buffer-kladde eller kølægning er implementeret i denne pipeline.\n\n` +
    `## Status\n\n` +
    `Alle opslag starter som ikke-godkendte. Der er ${plan.rights.approvalCount} coverrettighedsgodkendelser i kilden. Ingen Buffer-mutationer blev foretaget ved planlægningen.\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.env.GITHUB_REF !== "refs/heads/main" || process.env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      process.env.INSTAGRAM_PLAN_MODE !== "read-only") {
    throw new Error("Editorial plan run is restricted to the manual, read-only workflow on merged main");
  }
  if (!process.env.BUFFER_API_KEY) throw new Error("BUFFER_API_KEY is required; no Buffer request was made");
  const client = createBufferClient({ token: process.env.BUFFER_API_KEY });
  const graphql = createReadOnlyInstagramGraphql(client);
  const plan = await prepareInstagramEditorialPlan({ graphql, scanId: process.env.GITHUB_RUN_ID || "manual-read-only" });
  console.log(JSON.stringify({
    account: plan.account,
    planId: plan.planId,
    postCount: plan.posts.length,
    bufferPostCount: plan.bufferHistory.postCount,
    excludedAlreadyPublishedOrExisting: plan.excluded.alreadyInBufferOrHistory,
    heldCandidateCount: plan.heldCandidates.length,
    excludedUnverifiedListeningSource: plan.excluded.unverifiedListeningSource,
    rightsApproved: plan.rights.approvalCount,
    mutations: plan.safety.bufferMutations,
    outputFiles: ["instagram-editorial-plan.json", "instagram-editorial-review.csv", "README.md"],
  }, null, 2));
}
