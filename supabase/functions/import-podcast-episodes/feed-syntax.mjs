// Kept as plain ESM so this is shared unchanged by Node's static generator
// and the Supabase Edge (Deno) runtime.
export function parseAppleFeed(value) {
  const match = String(value ?? "").trim().match(/^apple:(\d+)$/i);
  return match ? { appleShowId: match[1] } : null;
}

// Podimo's public show link is an identity locator, not an episode feed.
// Keep it distinct from ordinary HTTP(S) URLs so callers cannot pass it to RSS.
export function parsePodimoShowFeed(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "open.podimo.com" ||
        url.username || url.password || url.search || url.hash) return null;
    const match = url.pathname.match(/^\/podcast\/([\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12})\/?$/i);
    return match ? { showId: match[1].toLowerCase(), url: `https://open.podimo.com/podcast/${match[1].toLowerCase()}` } : null;
  } catch {
    return null;
  }
}

export function parseHttpFeed(value) {
  try {
    const url = new URL(String(value ?? "").trim());
    return /^https?:$/.test(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

export function appleShowUrl(appleShowId) {
  return `https://podcasts.apple.com/dk/podcast/id${appleShowId}`;
}
