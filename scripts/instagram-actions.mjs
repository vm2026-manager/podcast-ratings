import { assertMutationSuccess } from "./buffer-graphql.mjs";

export const QUEUE_ACKNOWLEDGEMENT = "I_ACKNOWLEDGE_THIS_WILL_SCHEDULE_A_PUBLIC_POST";

export async function performInstagramAction({ mode, channel, selected, graphql, verifyImage, history,
  queueEnabled = false, queueAcknowledgement = "", logger = console } = {}) {
  if (!new Set(["dry-run", "draft", "queue"]).has(mode)) throw new Error(`Unsupported BUFFER_MODE: ${mode}`);
  if (mode === "queue" && (queueEnabled !== true || queueAcknowledgement !== QUEUE_ACKNOWLEDGEMENT)) {
    throw new Error("Queue mode is locked. Explicit owner activation and the exact acknowledgement are required.");
  }
  const existingDuplicate = (history.posts ?? []).find((post) => post.text?.includes(selected.canonicalUrl));
  if (existingDuplicate) throw new Error(`Duplicate Buffer post exists for Podcast-ID ${selected.id} (${existingDuplicate.id})`);
  await verifyImage(selected.cover.url);
  const output = { mode, podcastId: selected.id, title: selected.title, canonicalUrl: selected.canonicalUrl,
    imageUrl: selected.cover.url, caption: selected.caption, channel: { name: channel.name, service: channel.service },
    knownPosts: history.posts?.length ?? 0, action: mode === "dry-run" ? "none" : mode };
  if (mode === "dry-run") {
    logger.log(JSON.stringify(output, null, 2));
    return { output, wrote: false };
  }
  const input = { text: selected.caption, channelId: channel.id, schedulingType: "automatic", mode: "addToQueue",
    assets: [{ image: { url: selected.cover.url } }], ...(mode === "draft" ? { saveToDraft: true } : {}) };
  const mutation = `mutation CreateInstagramPost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { __typename post { id text status channelId assets { id mimeType } } } ... on MutationError { __typename message } } }`;
  const data = await graphql(mutation, { input });
  const post = assertMutationSuccess(data, "createPost");
  if (mode === "draft" && post.status !== "draft") throw new Error(`Buffer returned unexpected draft status ${post.status}; inspect post ${post.id}`);
  if (mode === "queue" && !["scheduled", "sent"].includes(post.status)) throw new Error(`Buffer returned unexpected queue status ${post.status}; inspect post ${post.id}`);
  history.usedPodcastIds.add(selected.id);
  await history.persist();
  const result = { ...output, postId: post.id, status: post.status, assets: post.assets };
  logger.log(JSON.stringify(result, null, 2));
  return { output: result, wrote: true };
}
