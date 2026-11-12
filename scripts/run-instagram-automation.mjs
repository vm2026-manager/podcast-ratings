import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createBufferClient } from "./buffer-graphql.mjs";
import { buildCaption, resolveInstagramChannel, selectPodcast } from "./instagram-selector.mjs";
import { performInstagramAction } from "./instagram-actions.mjs";
import { slugFromPodcastId } from "./generate-seo-podcast-pages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.env.BUFFER_MODE || "dry-run";
const historyPath = path.resolve(process.env.INSTAGRAM_HISTORY_FILE || path.join(root, ".instagram", "used-podcast-ids.json"));

const queries = {
  organizations: `query InstagramOrganizations { account { organizations { id name } } }`,
  channels: `query InstagramChannels($organizationId: OrganizationId!) { channels(input: { organizationId: $organizationId }) { id name displayName externalLink service organizationId allowedActions isDisconnected isLocked } }`,
  posts: `query InstagramPosts($organizationId: OrganizationId!, $channelId: ChannelId!, $after: String) { posts(first: 100, after: $after, input: { organizationId: $organizationId, filter: { channelIds: [$channelId], status: [draft, scheduled, sent, sending, error, needs_approval] } }) { edges { node { id text status channelId assets { id mimeType } } } pageInfo { hasNextPage endCursor } } }`,
};

async function json(file) { return JSON.parse(await readFile(path.join(root, file), "utf8")); }
async function readHistory() {
  try {
    const state = JSON.parse(await readFile(historyPath, "utf8"));
    if (state.schemaVersion !== 1 || !Array.isArray(state.usedPodcastIds)) throw new Error("invalid history shape");
    return new Set(state.usedPodcastIds);
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw new Error(`Instagram history is invalid; refusing to continue: ${error.message}`);
  }
}
async function writeHistory(ids) {
  await mkdir(path.dirname(historyPath), { recursive: true });
  await writeFile(historyPath, `${JSON.stringify({ schemaVersion: 1, usedPodcastIds: [...ids].sort() }, null, 2)}\n`, "utf8");
}
async function verifyPublicImage(url) {
  const response = await fetch(url, { method: "GET", headers: { range: "bytes=0-31" }, redirect: "error" });
  if (!response.ok || !/^image\/(webp|jpeg|png)$/.test(response.headers.get("content-type") ?? "")) {
    throw new Error(`Cover URL is not a publicly reachable image (${response.status})`);
  }
  if (response.body) await response.body.cancel();
}
async function allChannelPosts(graphql, organizationId, channelId) {
  const posts = [];
  let after;
  do {
    const data = await graphql(queries.posts, { organizationId, channelId, ...(after ? { after } : {}) });
    const result = data?.posts;
    if (!result || !Array.isArray(result.edges) || !result.pageInfo) throw new Error("Buffer returned an invalid paginated post list");
    posts.push(...result.edges.map((edge) => edge.node).filter(Boolean));
    if (!result.pageInfo.hasNextPage) break;
    if (!result.pageInfo.endCursor || result.pageInfo.endCursor === after) throw new Error("Buffer post history pagination did not advance");
    after = result.pageInfo.endCursor;
  } while (true);
  return posts;
}

if (!new Set(["dry-run", "draft", "queue"]).has(mode)) throw new Error(`Unsupported BUFFER_MODE: ${mode}`);

const [catalog, reviews, manifest, approvals, history] = await Promise.all([
  json("data/podcasts.json"), json("data/featured-reviews.json"), json("data/podcast-cover-manifest.json"),
  json("config/instagram-cover-rights.json"), readHistory(),
]);
const graphql = createBufferClient({ token: process.env.BUFFER_API_KEY });
const accountData = await graphql(queries.organizations);
const organizations = accountData?.account?.organizations;
if (!Array.isArray(organizations) || organizations.length === 0) throw new Error("Buffer returned no readable organizations");
const channelsByOrganization = new Map();
for (const organization of organizations) {
  const data = await graphql(queries.channels, { organizationId: organization.id });
  if (!Array.isArray(data?.channels)) throw new Error(`Buffer returned no channel list for organization ${organization.id}`);
  channelsByOrganization.set(organization.id, data.channels);
}
const channel = resolveInstagramChannel(organizations, channelsByOrganization);
const posts = await allChannelPosts(graphql, channel.organizationId, channel.id);
for (const post of posts) {
  const link = post.text?.match(/https:\/\/podcastlisten\.dk\/podcast\/[^\s)]+/u)?.[0];
  if (!link) continue;
  const matches = catalog.rows.filter((row) => `https://podcastlisten.dk/podcast/${slugFromPodcastId(String(row["Podcast-ID"] ?? "").trim())}/` === link);
  if (matches.length > 1) throw new Error(`Existing Buffer post URL maps to ${matches.length} catalogue Podcast-IDs; refusing to continue`);
  if (matches.length === 1) history.add(matches[0]["Podcast-ID"]);
}
const selected = selectPodcast({ podcasts: catalog.rows, reviews, manifest, approvals, usedPodcastIds: [...history] });
await performInstagramAction({ mode, channel, selected: { ...selected, caption: buildCaption(selected) }, graphql,
  verifyImage: verifyPublicImage, history: { posts, usedPodcastIds: history, persist: () => writeHistory(history) },
  queueEnabled: process.env.BUFFER_QUEUE_ENABLED === "true", queueAcknowledgement: process.env.BUFFER_QUEUE_ACK });
