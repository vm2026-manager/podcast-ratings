import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const POLICIES = new Map([
  ["original_podcastlisten_graphic", { type: "image/png", format: "PNG", pathPrefix: "assets/instagram/original-cards/" }],
  ["rights_approved_podcast_cover", { type: "image/webp", format: "WEBP", pathPrefix: "data/covers/800/" }],
]);
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const require = createRequire(import.meta.url);
const canonicalGenres = require("../canonical-genres.js");

export async function verifyGraphicManifestSources(graphicsManifest, { root } = {}) {
  if (!graphicsManifest || graphicsManifest.schemaVersion !== 1 || graphicsManifest.generator !== "scripts/generate-instagram-cards.py" ||
      graphicsManifest.width !== 1080 || graphicsManifest.height !== 1080 || graphicsManifest.format !== "PNG" ||
      graphicsManifest.contentType !== "image/png" || !Array.isArray(graphicsManifest.assets)) {
    throw new Error("Original graphic manifest has an unsupported schema or image specification");
  }
  const [generator, style, genreSource] = await Promise.all([
    readFile(path.join(root, "scripts/generate-instagram-cards.py")),
    readFile(path.join(root, "style.css")),
    readFile(path.join(root, "canonical-genres.js")),
  ]);
  const generatorSha = sha256(generator);
  const sourceSha = sha256(Buffer.concat([generator, style, genreSource]));
  if (graphicsManifest.generatorSha256 !== generatorSha || graphicsManifest.genreSource?.count !== canonicalGenres.length ||
      graphicsManifest.assets.length !== canonicalGenres.length) throw new Error("Original graphic source does not match its manifest");
  for (let index = 0; index < canonicalGenres.length; index += 1) {
    const asset = graphicsManifest.assets[index];
    const expectedSlug = canonicalGenres[index].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    if (asset.genre !== canonicalGenres[index] || asset.path !== `assets/instagram/original-cards/${expectedSlug}.png` ||
        asset.sourceSha256 !== sourceSha || asset.sourceKind !== "original_podcastlisten_graphic" || asset.thirdPartyMaterials !== false) {
      throw new Error(`Original graphic source metadata is invalid for canonical genre ${canonicalGenres[index]}`);
    }
  }
  return true;
}

export async function verifyInstagramMedia(media, { root, fetchImpl = fetch } = {}) {
  const policy = POLICIES.get(media?.kind);
  const validAssetPath = media?.kind === "original_podcastlisten_graphic"
    ? /^assets\/instagram\/original-cards\/[a-z0-9-]+\.png$/.test(media.path ?? "")
    : /^data\/covers\/800\/[\w.-]+\.webp$/.test(media?.path ?? "");
  if (!policy || !validAssetPath || media.contentType !== policy.type || media.format !== policy.format || !media.path?.startsWith(policy.pathPrefix)) {
    throw new Error("Selected media does not match an allowed, isolated Instagram asset path");
  }
  const localPath = path.resolve(root, media.path);
  if (!localPath.startsWith(`${root}${path.sep}`)) throw new Error("Selected media escaped the repository asset directory");
  const [bytes, fileStat] = await Promise.all([readFile(localPath), stat(localPath)]);
  if (!Number.isInteger(media.bytes) || media.bytes < 1024 || media.bytes > 5 * 1024 * 1024 || fileStat.size !== media.bytes || bytes.length !== media.bytes || sha256(bytes) !== media.checksum) {
    throw new Error("Local media size or SHA-256 does not match its approved manifest");
  }
  if (media.kind === "original_podcastlisten_graphic") {
    if (media.width !== 1080 || media.height !== 1080 || bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a" ||
        bytes.readUInt32BE(16) !== 1080 || bytes.readUInt32BE(20) !== 1080) throw new Error("Original graphic is not a valid 1080x1080 PNG");
  }
  const url = new URL(media.url);
  if (url.protocol !== "https:" || url.hostname !== "podcastlisten.dk") throw new Error("Instagram media URL must be a Podcastlisten HTTPS URL");
  const response = await fetchImpl(url, { method: "GET", redirect: "error" });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== policy.type) {
    throw new Error(`Public Pages media is unavailable or has the wrong content type (${response.status})`);
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && Number(contentLength) !== media.bytes) throw new Error("Public Pages media length differs from the committed asset");
  if (!response.body) throw new Error("Public Pages returned an empty media response");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > media.bytes) {
      await reader.cancel();
      throw new Error("Public Pages media exceeds the committed asset size");
    }
    chunks.push(Buffer.from(value));
  }
  const publicBytes = Buffer.concat(chunks, total);
  if (publicBytes.length !== media.bytes || sha256(publicBytes) !== media.checksum) {
    throw new Error("Public Pages media size or SHA-256 differs from the committed asset");
  }
  return { bytes: media.bytes, checksum: media.checksum, contentType: policy.type, url: url.href };
}
