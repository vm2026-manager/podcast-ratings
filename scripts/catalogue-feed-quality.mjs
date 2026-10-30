import { parseAppleFeed, parseHttpFeed } from "../supabase/functions/import-podcast-episodes/feed-syntax.mjs";

const normalize = (value) => String(value ?? "").trim();

const hasFeedEndpoint = (url) => {
  const host = url.hostname.toLowerCase();
  const path = url.pathname.toLowerCase();
  return host.startsWith("feeds.")
    || /\.(?:rss|xml|atom)$/iu.test(path)
    || /(?:^|\/)(?:rss|feed|feeds)(?:\/|$)/iu.test(path);
};

export function classifyFeedReference(value) {
  const text = normalize(value);
  if (!text) return { status: "missing" };

  const apple = parseAppleFeed(text);
  if (apple) return {
    status: "supported-apple-reference",
    appleShowId: apple.appleShowId,
    reason: "Apple ID reference syntax is supported; the listing and source feed were not fetched."
  };
  if (/^apple(?:[:_])/iu.test(text)) return { status: "invalid-syntax" };

  const httpFeed = parseHttpFeed(text);
  if (httpFeed) {
    const url = new URL(httpFeed);
    return hasFeedEndpoint(url)
      ? { status: "valid-http-feed", url: httpFeed }
      : { status: "requires-source-verification", url: httpFeed, reason: "Valid HTTP(S) URL without a recognizable feed endpoint." };
  }

  if (/^[a-z][a-z\d+.-]*:/iu.test(text)) {
    return { status: "requires-source-verification", reference: text, reason: "Unsupported non-HTTP source reference." };
  }

  return { status: "invalid-syntax" };
}
