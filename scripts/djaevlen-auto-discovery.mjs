export const DJAEVLEN_MAIN_SERIES = "Djævlen i detaljen";
export const DJAEVLEN_PUBLISHER = "DR";
export const DJAEVLEN_COVER = "https://api.dr.dk/podcasts/v1/images/urn:dr:podcast:image:66f271c4b75d19480fa40d01.jpg";

export function normalizeDjaevlenIdentity(value) {
  return String(value ?? "").trim().toLocaleLowerCase("da-DK").normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "").replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/gu, " ").trim().replace(/\s+/gu, " ");
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) { result ^= character.charCodeAt(0); result = Math.imul(result, 16777619) >>> 0; }
  return result.toString(16).padStart(8, "0");
}

export function parseDjaevlenChildTitle(episodeTitle) {
  const value = String(episodeTitle ?? "").trim();
  if (/^(?:teaser|trailer|bonus|arkiv)\b/iu.test(value)) return { kind: "special", title: value };
  // DR's verified umbrella convention is a visible child title followed by N:N.
  const match = value.match(/^(.+?)\s+\d+\s*:\s*\d+\b/iu);
  if (!match) return { kind: "unsafe", title: value };
  const title = match[1].trim();
  return title ? { kind: "candidate", title, discovery_key: normalizeDjaevlenIdentity(title) } : { kind: "unsafe", title: value };
}

function existingIdentityIndex(rows, registry, aliases = []) {
  const ids = new Set(); const titleKeys = new Set();
  for (const row of [...(rows || []), ...(registry?.records || [])]) {
    const id = String(row["Podcast-ID"] ?? row.podcast_id ?? "").trim();
    const title = String(row.Titel ?? row.title ?? "").trim();
    if (id) ids.add(id);
    if (title) titleKeys.add(normalizeDjaevlenIdentity(title));
  }
  for (const alias of aliases) ids.add(String(alias));
  return { ids, titleKeys };
}

export function discoverDjaevlenChildren({ episodeTitles, catalogueRows, registry = { version: 1, records: [] }, aliases = [] }) {
  const next = structuredClone(registry); next.records ||= [];
  const index = existingIdentityIndex(catalogueRows, next, aliases);
  const report = { created: [], existing: [], special: [], unsafe: [], collisions: [] };
  const knownDiscovery = new Set(next.records.map((record) => record.discovery_key));
  for (const episodeTitle of episodeTitles || []) {
    const parsed = parseDjaevlenChildTitle(episodeTitle);
    if (parsed.kind !== "candidate") { report[parsed.kind].push(parsed); continue; }
    if (index.titleKeys.has(parsed.discovery_key) || knownDiscovery.has(parsed.discovery_key)) { report.existing.push(parsed); continue; }
    const podcastId = `djaevlen-auto-v1-${hash(parsed.discovery_key)}`;
    if (index.ids.has(podcastId)) { report.collisions.push({ ...parsed, podcast_id: podcastId }); continue; }
    const record = { discovery_key: parsed.discovery_key, podcast_id: podcastId, title: parsed.title, hovedserie: DJAEVLEN_MAIN_SERIES, publisher: DJAEVLEN_PUBLISHER, cover: DJAEVLEN_COVER };
    next.records.push(record); knownDiscovery.add(parsed.discovery_key); index.ids.add(podcastId); index.titleKeys.add(parsed.discovery_key); report.created.push(record);
  }
  return { registry: next, report };
}

export function mergeAutoDiscoveredDjaevlenRows(sheetRows, registry) {
  const sheet = Array.isArray(sheetRows) ? sheetRows : [];
  const sheetIds = new Set(sheet.map((row) => String(row["Podcast-ID"] ?? "").trim()).filter(Boolean));
  const sheetTitles = new Set(sheet.map((row) => normalizeDjaevlenIdentity(row.Titel)).filter(Boolean));
  const additions = [];
  for (const record of registry?.records || []) {
    if (sheetIds.has(record.podcast_id) || sheetTitles.has(record.discovery_key)) continue; // Sheet owns editorial representation.
    additions.push({ Titel: record.title, "Podcast-ID": record.podcast_id, Hovedserie: record.hovedserie, Udgiver: record.publisher, Billedlink: record.cover });
  }
  return [...sheet, ...additions];
}
