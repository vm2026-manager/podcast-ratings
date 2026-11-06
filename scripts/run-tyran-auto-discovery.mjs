import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { discoverTyranSeries, parseTyranChildPage, parseTyranDirectory, TYRAN_PROGRAM_URL, TYRAN_PROTECTED_IDS } from "./tyran-auto-discovery.mjs";

const REGISTRY_PATH = "data/auto-discovered-tyran.json";
const TIMEOUT_MS = 15000;
async function fetchBytes(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept } });
    if (!response.ok) throw new Error(`DR source returned HTTP ${response.status}: ${url}`);
    return { response, bytes: Buffer.from(await response.arrayBuffer()) };
  } finally { clearTimeout(timer); }
}
function jpegSize(bytes) {
  if (bytes.toString("hex", 0, 2) !== "ffd8") return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(offset + 5), width: bytes.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}
async function mapLimit(items, limit, mapper) {
  const out = new Array(items.length); let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) { const i = cursor++; out[i] = await mapper(items[i]); }
  }));
  return out;
}

const [directoryResult, catalogue, registry, app] = await Promise.all([
  fetchBytes(TYRAN_PROGRAM_URL, "text/html,application/xhtml+xml"),
  readFile("data/podcasts.json", "utf8").then(JSON.parse),
  readFile(REGISTRY_PATH, "utf8").then(JSON.parse),
  readFile("app.js", "utf8")
]);
const html = directoryResult.bytes.toString("utf8");
const parts = parseTyranDirectory(html);
const aliasMatch = app.match(/const LEGACY_PODCAST_RATING_KEY_ALIASES = Object\.freeze\(([\s\S]*?)\n\}\);/u);
if (!aliasMatch) throw new Error("Could not read authoritative legacy rating aliases");
const aliases = Function(`return (${aliasMatch[1]}})`)();
const candidates = parts.filter((part) => !Object.hasOwn(TYRAN_PROTECTED_IDS, part.discovery_key));
const childPages = Object.fromEntries(await mapLimit(candidates, 3, async (part) => {
  const { bytes } = await fetchBytes(part.source_url, "text/html,application/xhtml+xml");
  return [part.discovery_key, parseTyranChildPage(bytes.toString("utf8"), part)];
}));
const coverChecksums = Object.fromEntries(await mapLimit(candidates, 3, async (part) => {
  const url = `https://asset.dr.dk/drlyd/images/urn:dr:radio:image:${part.cover_image_id}?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29`;
  const { response, bytes } = await fetchBytes(url, "image/*");
  const mimeType = String(response.headers.get("content-type") || "").split(";")[0];
  let size = null;
  if (mimeType === "image/png" && bytes.toString("hex", 0, 8) === "89504e470d0a1a0a") size = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  else if (mimeType === "image/jpeg") size = jpegSize(bytes);
  if (!size) throw new Error(`Unsupported or malformed Tyran cover image: ${url}`);
  return [part.cover_image_id, { mimeType, ...size, byteLength: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }];
}));
const result = discoverTyranSeries({ html, childPages, coverChecksums, catalogueRows: catalogue.rows || [], registry, aliases });
if (result.report.collisions.length) throw new Error(`Tyran identity collision requires manual review: ${JSON.stringify(result.report.collisions)}`);
const dryRun = process.argv.includes("--dry-run");
if (!dryRun && JSON.stringify(registry) !== JSON.stringify(result.registry)) await writeFile(REGISTRY_PATH, `${JSON.stringify(result.registry, null, 2)}\n`);
console.log(JSON.stringify({ dry_run: dryRun, directory_series: parts.length, protected_existing: result.report.existing.filter((x) => !result.report.full_episode_checks.some((check) => check.title === x.title)).length,
  new_or_adopted: result.report.created.map(({ podcast_id, title, source_url, cover_source_url, cover_sha256, first_full_episode }) => ({ podcast_id, title, source_url, cover_source_url, cover_sha256, first_full_episode })),
  full_episode_checks: result.report.full_episode_checks, manual_review: result.report.manual_review, collisions: result.report.collisions }, null, 2));
