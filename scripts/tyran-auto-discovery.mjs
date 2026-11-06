export const TYRAN_PROGRAM_URL = "https://www.dr.dk/lyd/p3/tyran-4747004850000";
export const TYRAN_PARENT = "Tyran";
export const TYRAN_BASELINE = "2026-11-06T00:00:00.000Z";
export const TYRAN_MACIAS_ID = "tyran-auto-v1-08d0021f";

export function normalizeTyranIdentity(value) {
  return String(value ?? "").trim().toLocaleLowerCase("da-DK").normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "").replace(/æ/g, "ae").replace(/ø/g, "oe")
    .replace(/å/g, "aa").replace(/&/g, " og ").replace(/[^a-z0-9]+/gu, " ")
    .trim().replace(/\s+/gu, " ");
}

function stableId(key) {
  let hash = 2166136261;
  for (const character of key) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619) >>> 0; }
  return `tyran-auto-v1-${hash.toString(16).padStart(8, "0")}`;
}

// Frozen to PR #243's exact canonical IDs. Any mismatch is a hard stop.
export const TYRAN_PROTECTED_IDS = Object.freeze({
  "ayatollah khomeini": "ayatollah khomeini", "benito mussolini": "benito mussolini",
  bokassa: "bokassa", ceausescu: "ceausescu", "charles taylor": "charles taylor",
  "enver hoxha": "enver hoxha", franco: "franco", hirohito: "hirohito", "idi amin": "idi amin",
  "kim il sung og kim jong il": "kim il sung og kim jong il", lenin: "lenin", "leopold ii": "leopold ii",
  mao: "mao", milosevic: "milosevic", "muammar gaddafi": "muammar gaddafi", nijasov: "nijasov",
  "papa doc": "papa doc", pinochet: "pinochet", "pol pot": "pol pot", "saddam hussein": "saddam hussein",
  suharto: "suharto", trujillo: "trujillo"
});
export const TYRAN_PROTECTED_IMAGE_IDS = Object.freeze({
  "ayatollah khomeini": "696f3b31753c04e7ed879d0b", "benito mussolini": "689097bbab10e7b0b6977e33",
  bokassa: "68944676de2818e2a02f4bdf", ceausescu: "69205604a90450d1bd85ffe7",
  "charles taylor": "69b27b8d2b11372a7da944f6", "enver hoxha": "69d8daa9fb001330decce834",
  franco: "6890920cab10e7b0b6975544", hirohito: "6890922a2e199a1c531f835c", "idi amin": "68909215ab10e7b0b69756c7",
  "kim il sung og kim jong il": "689092222e199a1c531f82a9", lenin: "68909209ab10e7b0b697551a",
  "leopold ii": "6a96ae037472ce653345f984", mao: "68bed3d32b60b4c321271a43", milosevic: "6890922bab10e7b0b69759ec",
  "muammar gaddafi": "6a0c0f4e7b148e5451e16710", nijasov: "6890920a2e199a1c531f7fad", "papa doc": "68909221ab10e7b0b697587e",
  pinochet: "689092062e199a1c531f7f2a", "pol pot": "68909219ab10e7b0b697574e", "saddam hussein": "6890920f2e199a1c531f8095",
  suharto: "689092012e199a1c531f7ebc", trujillo: "6901d9eb91066218a4c409de"
});

function parseNextData(html) {
  const match = String(html ?? "").match(/<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/iu);
  if (!match?.[1]) throw new Error("Invalid DR Lyd page: missing __NEXT_DATA__");
  try { return JSON.parse(match[1]); } catch { throw new Error("Invalid DR Lyd __NEXT_DATA__ JSON"); }
}

export function parseTyranDirectory(html) {
  const page = parseNextData(html)?.props?.pageProps;
  if (page?.pageType !== "umbrella" || page?.bannerData?.drlyd_itemSlug !== "tyran-4747004850000" || !Array.isArray(page.parts)) {
    throw new Error("Invalid Tyran directory identity or missing series parts");
  }
  const seenIds = new Set();
  const seenTitles = new Set();
  return page.parts.map((part) => {
    const title = String(part?.title ?? "").trim().replace(/^Tyran\s*[|:]\s*/iu, "");
    const key = normalizeTyranIdentity(title);
    const pageUrl = String(part?.presentationUrl ?? "");
    const parsed = (() => { try { return new URL(pageUrl); } catch { return null; } })();
    const productionNumber = String(part?.productionNumber ?? "");
    const square = (part?.imageAssets || []).find((item) => item?.target === "SquareImage" && item?.ratio === "1:1");
    const imageId = String(square?.id ?? "").match(/^urn:dr:radio:image:([0-9a-f]{24})$/iu)?.[1] ?? "";
    if (!key || !/^\d{13}$/u.test(productionNumber) || parsed?.protocol !== "https:" || parsed.hostname !== "www.dr.dk" ||
        !parsed.pathname.startsWith("/lyd/p3/tyran-") || parsed.search || parsed.hash || !imageId ||
        !["image/png", "image/jpeg"].includes(square.format)) throw new Error(`Unverified Tyran directory entry: ${title || "(untitled)"}`);
    if (seenIds.has(productionNumber) || seenTitles.has(key)) throw new Error("Duplicate Tyran series identity in DR directory");
    seenIds.add(productionNumber); seenTitles.add(key);
    return { title, discovery_key: key, production_number: productionNumber, source_url: pageUrl,
      dr_series_id: String(part.id ?? ""), cover_image_id: imageId, cover_format: square.format,
      description: String(part.description ?? "") };
  });
}

export function parseTyranFullEpisodes(html, series) {
  const page = parseNextData(html)?.props?.pageProps;
  const banner = page?.bannerData;
  const groups = page?.episodesGroups;
  if (!banner || banner.drlyd_pageID !== "series" || banner.drlyd_url !== series.source_url || !Array.isArray(groups)) {
    throw new Error(`DR child page does not match verified Tyran series: ${series.source_url}`);
  }
  const episodes = groups.flatMap((group) => Array.isArray(group?.items) ? group.items : []);
  const safe = episodes.filter((episode) => {
    const url = (() => { try { return new URL(episode?.presentationUrl); } catch { return null; } })();
    return /^\d{8,20}$/u.test(String(episode?.productionNumber ?? "")) &&
      Number.isFinite(Date.parse(episode?.startTime)) && Number(episode?.durationMilliseconds) >= 600_000 && Number(episode?.durationMilliseconds) <= 10_800_000 &&
      /^\d{1,2}:\d{1,2}\s+-\s+/u.test(String(episode?.title ?? "")) &&
      !/^(?:teaser|trailer|bonus|arkiv|hør alle episoder)\b/iu.test(String(episode?.title ?? "")) &&
      url?.protocol === "https:" && url.hostname === "www.dr.dk" &&
      url.pathname.startsWith("/lyd/p3/tyran-") && url.pathname.endsWith(String(episode.productionNumber));
  });
  if (!safe.length) throw new Error(`Tyran child page has no verified full episode: ${series.source_url}`);
  const unique = new Map();
  for (const episode of safe) {
    const episodeKey = `${episode.productionNumber}\u0000${episode.presentationUrl}`;
    if (!unique.has(episodeKey)) unique.set(episodeKey, episode);
  }
  return [...unique.values()].map((episode) => ({
    title: String(episode.title), production_number: String(episode.productionNumber),
    published_at: new Date(episode.startTime).toISOString(), duration_seconds: Math.round(Number(episode.durationMilliseconds) / 1000),
    source_url: String(episode.presentationUrl),
    square_image_ids: (episode.imageAssets || []).filter((asset) => asset?.ratio === "1:1" && ["SquareImage", "Default"].includes(asset?.target)).map((asset) => String(asset.id ?? "").replace(/^urn:dr:radio:image:/u, ""))
  }));
}

export function verifyTyranArtwork({ imageId, mimeType, width, height, byteLength, sha256, allImageIds = [] }) {
  const bareImageId = String(imageId ?? "").replace(/^urn:dr:radio:image:/u, "");
  return /^([0-9a-f]{64})$/iu.test(String(sha256 ?? "")) &&
    /^urn:dr:radio:image:[0-9a-f]{24}$/iu.test(String(imageId ?? "")) &&
    ["image/png", "image/jpeg"].includes(mimeType) && width === 720 && height === 720 && byteLength >= 10000 &&
    allImageIds.filter((id) => id === bareImageId).length === 1;
}

export function discoverTyranSeries({ html, childPages = {}, coverChecksums = {}, catalogueRows, registry, aliases = {} }) {
  if (!Array.isArray(catalogueRows) || !registry || registry.version !== 1 || !Array.isArray(registry.records)) throw new Error("Missing authoritative Tyran catalogue or registry");
  const parts = parseTyranDirectory(html);
  const ids = new Set();
  const idCounts = new Map();
  for (const row of catalogueRows) {
    const id = String(row["Podcast-ID"] ?? "").trim();
    if (id) { ids.add(id); idCounts.set(id, (idCounts.get(id) || 0) + 1); }
  }
  const byTitle = new Map();
  for (const row of catalogueRows) {
    const key = normalizeTyranIdentity(row.Titel);
    byTitle.set(key, [...(byTitle.get(key) || []), row]);
  }
  const aliasKeys = new Set(Object.entries(aliases).flatMap(([key, value]) =>
    [normalizeTyranIdentity(key), normalizeTyranIdentity(value)]).filter(Boolean));
  const registryKeys = new Set(registry.records.map((record) => record.discovery_key));
  const registryIds = new Set(registry.records.map((record) => record.podcast_id));
  if (registryKeys.size !== registry.records.length || registryIds.size !== registry.records.length) throw new Error("Tyran registry contains duplicate identities");
  const registryByKey = new Map(registry.records.map((record) => [record.discovery_key, record]));
  const next = structuredClone(registry);
  const report = { existing: [], created: [], manual_review: [], collisions: [], full_episode_checks: [] };
  const imageIds = parts.map((part) => part.cover_image_id);
  for (const part of parts) {
    const matches = byTitle.get(part.discovery_key) || [];
    const protectedId = TYRAN_PROTECTED_IDS[part.discovery_key];
    if (protectedId && (matches.length !== 1 || String(matches[0]["Podcast-ID"]) !== protectedId || normalizeTyranIdentity(matches[0].Hovedserie) !== "tyran" || idCounts.get(protectedId) !== 1)) {
      throw new Error(`Protected Tyran identity mismatch: ${part.title}`);
    }
    if (protectedId && part.cover_image_id !== TYRAN_PROTECTED_IMAGE_IDS[part.discovery_key]) throw new Error(`Protected Tyran cover identity mismatch: ${part.title}`);
    if (matches.length > 1 || (matches.length === 1 && normalizeTyranIdentity(matches[0].Hovedserie) !== "tyran")) {
      report.collisions.push({ title: part.title, reason: "catalogue identity collision" }); continue;
    }
    const existingId = matches.length === 1 ? String(matches[0]["Podcast-ID"]) : "";
    if (protectedId) { report.existing.push({ title: part.title, podcast_id: protectedId, cover_image_id: part.cover_image_id }); continue; }
    if (aliasKeys.has(part.discovery_key)) {
      report.collisions.push({ title: part.title, reason: "protected legacy alias" }); continue;
    }
    if (matches.length === 1 && idCounts.get(existingId) !== 1) {
      report.collisions.push({ title: part.title, podcast_id: existingId, reason: "canonical Podcast-ID is not unique" }); continue;
    }
    const prior = registryByKey.get(part.discovery_key);
    const podcastId = existingId || prior?.podcast_id || stableId(part.discovery_key);
    if (!existingId && (ids.has(podcastId) || registryIds.has(podcastId) && prior?.podcast_id !== podcastId)) { report.collisions.push({ title: part.title, podcast_id: podcastId, reason: "permanent Podcast-ID collision" }); continue; }
    const fullEpisodes = childPages[part.discovery_key];
    if (!Array.isArray(fullEpisodes) || !fullEpisodes.length) { report.manual_review.push({ title: part.title, reason: "full DR episode page unavailable" }); continue; }
    const cover = coverChecksums[part.cover_image_id];
    if (!verifyTyranArtwork({ imageId: `urn:dr:radio:image:${part.cover_image_id}`, ...cover, allImageIds: imageIds })) {
      report.manual_review.push({ title: part.title, reason: "unique verified 720x720 DR cover unavailable" }); continue;
    }
    if (prior && (prior.podcast_id !== podcastId || prior.cover_image_id !== part.cover_image_id || prior.cover_sha256 !== cover.sha256)) {
      throw new Error(`Registered Tyran identity or cover changed: ${part.title}`);
    }
    const record = prior || {
      discovery_key: part.discovery_key, podcast_id: podcastId, title: part.title, hovedserie: TYRAN_PARENT,
      publisher: "DR", source_url: part.source_url, source_series_production_number: part.production_number,
      dr_series_id: part.dr_series_id, cover_image_id: part.cover_image_id,
      cover_source_url: `https://asset.dr.dk/drlyd/images/urn:dr:radio:image:${part.cover_image_id}?im=AspectCrop%3D%28720%2C720%29%2CxPosition%3D.5%2CyPosition%3D.5%3BResize%3D%28720%2C720%29`,
      cover_mime_type: cover.mimeType, cover_width: cover.width, cover_height: cover.height,
      cover_byte_length: cover.byteLength, cover_sha256: cover.sha256,
      first_full_episode: fullEpisodes[0], needs_editorial_review: true, feed_activation_approved: false
    };
    if (!prior) { next.records.push(record); registryByKey.set(part.discovery_key, record); ids.add(podcastId); report.created.push(record); }
    else report.existing.push({ title: part.title, podcast_id: podcastId, cover_image_id: part.cover_image_id });
    report.full_episode_checks.push({ title: part.title, episodes: fullEpisodes.length });
  }
  for (const key of Object.keys(TYRAN_PROTECTED_IDS)) if (!report.existing.some((item) => normalizeTyranIdentity(item.title) === key) && !parts.some((part) => part.discovery_key === key)) throw new Error(`Protected Tyran series absent from DR directory: ${key}`);
  return { registry: next, report };
}

export function mergeAutoDiscoveredTyranRows(sheetRows, registry) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const appended = [];
  for (const record of registry?.records || []) {
    if (record.feed_activation_approved !== false || record.cover_width !== 720 || record.cover_height !== 720 || !record.cover_sha256 || !record.cover_source_url) {
      throw new Error(`Unverified or activatable Tyran registry record: ${record.title}`);
    }
    const sameId = rows.filter((row) => String(row["Podcast-ID"] ?? "").trim() === record.podcast_id);
    const sameTitle = rows.filter((row) => normalizeTyranIdentity(row.Titel) === record.discovery_key);
    if (sameId.length || sameTitle.length) {
      if (sameId.length !== 1 || sameTitle.length !== 1 || normalizeTyranIdentity(sameId[0].Hovedserie) !== "tyran" || sameId[0] !== sameTitle[0]) {
        throw new Error(`Unsafe Tyran registry takeover for ${record.title}`);
      }
      continue;
    }
    appended.push({ Titel: record.title, "Podcast-ID": record.podcast_id, Hovedserie: TYRAN_PARENT,
      Udgiver: "DR", Link: record.source_url, Kilde: record.source_url, Billedlink: record.cover_source_url,
      "Kort beskrivelse": "", "Lang beskrivelse": "", Genre: "Historie", needs_editorial_review: true,
      tyran_cover_sha256: record.cover_sha256 });
  }
  return [...rows, ...appended];
}
