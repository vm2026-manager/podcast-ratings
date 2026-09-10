import { PUBLIC_MEDIANO_RSS_URL, MEDIANO_PUBLIC_ROUTES, normalizeRouteText, routePublicMedianoTitle } from "./mediano-public-routing.mjs";

function decodeXml(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeXml(match?.[1] || "");
}

function attribute(block, name) {
  const match = block.match(new RegExp(`\\b${name}=["']([^"']*)["']`, "i"));
  return decodeXml(match?.[1] || "");
}

export function parseRssItems(xml) {
  return [...String(xml).matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)].map((match) => {
    const block = match[1];
    const enclosure = block.match(/<enclosure\b[^>]*>/i)?.[0] || "";
    return {
      guid: tag(block, "guid"), title: tag(block, "title"), publishedAt: tag(block, "pubDate"),
      enclosureUrl: attribute(enclosure, "url"), duration: tag(block, "itunes:duration") || tag(block, "duration")
    };
  });
}

function valuesWithDuplicates(items, key, label) {
  const groups = new Map();
  for (const item of items) {
    const value = String(item[key] || "").trim();
    if (!value) continue;
    groups.set(value, [...(groups.get(value) || []), item]);
  }
  return [...groups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([value, entries]) => ({ identity: label, value, titles: entries.map((entry) => entry.title) }));
}

export function auditMedianoFeedXml(xml, { feedUrl = PUBLIC_MEDIANO_RSS_URL, routes = MEDIANO_PUBLIC_ROUTES } = {}) {
  const items = parseRssItems(xml);
  const routed = new Map();
  const unmatched = [];
  const ambiguous = [];
  for (const item of items) {
    const decision = routePublicMedianoTitle(item.title, routes);
    if (decision.status === "routed") {
      const key = decision.route.canonicalTitle;
      routed.set(key, [...(routed.get(key) || []), item]);
    } else if (decision.status === "ambiguous") {
      ambiguous.push({ ...item, candidates: decision.routes.map((route) => route.canonicalTitle) });
    } else {
      unmatched.push(item);
    }
  }
  const fingerprintItems = items.map((item) => ({ ...item, fingerprint: `${normalizeRouteText(item.title)}|${item.publishedAt}|${item.duration}` }));
  return {
    dryRun: true,
    feedUrl,
    totalItems: items.length,
    routedItems: Object.fromEntries([...routed.entries()].map(([series, entries]) => [series, {
      count: entries.length, examples: entries.slice(0, 3).map((entry) => entry.title)
    }])),
    unmatchedItems: unmatched,
    ambiguousItems: ambiguous,
    duplicateCandidates: [
      ...valuesWithDuplicates(items, "guid", "guid"),
      ...valuesWithDuplicates(items, "enclosureUrl", "enclosure_url"),
      ...valuesWithDuplicates(fingerprintItems, "fingerprint", "title_published_duration")
    ]
  };
}

async function main() {
  const feedUrl = process.argv[2] || PUBLIC_MEDIANO_RSS_URL;
  const response = await fetch(feedUrl, { headers: { accept: "application/rss+xml, application/xml, text/xml" } });
  if (!response.ok) throw new Error(`Public Mediano feed fetch failed: ${response.status}`);
  const report = auditMedianoFeedXml(await response.text(), { feedUrl });
  console.log(JSON.stringify(report, null, 2));
}

if (import.meta.url === `file:///${process.argv[1]?.replace(/\\/g, "/")}`) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
