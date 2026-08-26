// Kept as plain ESM so this is shared unchanged by Node's static generator
// and the Supabase Edge (Deno) runtime.
export function parseAppleFeed(value) {
  const match = String(value ?? "").trim().match(/^apple:(\d+)$/i);
  return match ? { appleShowId: match[1] } : null;
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
