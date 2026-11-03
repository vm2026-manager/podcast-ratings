export const RADIO_IIII_MAIN_SERIES = "Et kapitel for sig";
export const RADIO_IIII_PUBLISHER = "RADIO IIII";
export const RADIO_IIII_HOST = "Anne Sofie Kragh";
export const RADIO_IIII_PROGRAM_URL = "https://radio4.dk/podcasts/et-kapitel-for-sig";
export const RADIO_IIII_FEED_URL = "https://www.omnycontent.com/d/playlist/414edbb4-4b91-4960-8650-ad4000dbc027/51e8702e-5649-4ff8-9681-ad4800b0bb22/2eff567a-f3db-43fe-82be-ad4000bb2c/podcast.rss";

const normalize = (value) => String(value ?? "").trim().normalize("NFKD")
  .replace(/[\u0300-\u036f]/gu, "").toLocaleLowerCase("da-DK")
  .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
  .replace(/[^a-z0-9]+/gu, " ").trim().replace(/\s+/gu, " ");
const hash = (value) => {
  let result = 2166136261;
  for (const char of value) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619) >>> 0; }
  return result.toString(16).padStart(8, "0");
};
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export const VERIFIED_RADIO_IIII_METADATA = Object.freeze({
  "mattias tesfaye": {
    genre: "Portræt",
    shortDescription: "Anne Sofie Kragh følger Mattias Tesfayes vej fra en opvækst i Aarhus og murerfaget til dansk politik og ministeransvar.",
    topics: ["opvækst i Aarhus", "arbejderklasse", "murerfaget", "dansk politik", "ministerliv", "AGF"]
  },
  "birgithe kosovic": {
    genre: "Portræt",
    shortDescription: "Birgithe Kosovic fortæller om sin familie, forfatterskabet og de erfaringer med krig, vrede og svære relationer, der vender tilbage i hendes liv.",
    topics: ["forfatterskab", "familie", "krig", "opvækst", "ægteskab", "Serbien"]
  },
  "ditlev tamm": {
    genre: "Portræt",
    shortDescription: "Ditlev Tamm ser tilbage på sin opvækst i en juristfamilie, karrieren som retshistoriker og personlige livskriser.",
    topics: ["retshistorie", "jura", "familie", "depression", "skilsmisse", "kønsidentitet"]
  },
  "sara blaedel": {
    genre: "Portræt",
    shortDescription: "Sara Blædel fortæller om sygdom, modgang og vejen fra en lang indlæggelse til et internationalt forfatterskab.",
    topics: ["forfatterskab", "sygdom", "modgang", "familie", "krimi", "karriere"]
  }
});

function cleanHtml(value) {
  return String(value ?? "").replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;/giu, " ").replace(/&amp;/giu, "&").replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'").replace(/&lt;/giu, "<").replace(/&gt;/giu, ">")
    .replace(/\s+/gu, " ").trim();
}

export function parseRadioIIIISeasonLinks(html) {
  const seasons = [...String(html ?? "").matchAll(/href=["']\/podcasts\/et-kapitel-for-sig\?season=(\d+)["']/giu)]
    .map((match) => Number(match[1]));
  const unique = [...new Set(seasons)];
  if (!unique.length || unique.some((season) => !Number.isSafeInteger(season) || season < 1 || season > 200)) {
    throw new Error("RADIO IIII program page did not expose a valid official season list");
  }
  return unique;
}

export function parseRadioIIIISeasonPage(html, season) {
  const source = String(html ?? "");
  const items = [...source.matchAll(/<a href=["']([^"']+)["'] class=["']titleAndPlayLink["'][^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<\/a>/giu)]
    .map((match) => {
      const afterTitle = source.slice(match.index + match[0].length);
      const descriptionHtml = afterTitle.match(/<div class=["']description["'][^>]*>([\s\S]*?)<\/div>/iu)?.[1] || "";
      const description = cleanHtml(descriptionHtml);
      const host = description.match(/\bVært:\s*([^.!?\r\n]+?)(?=\s+(?:Klipper|Redaktør|Research):|$)/iu)?.[1]?.trim() || "";
      return {
        title: cleanHtml(match[2]),
        source_url: new URL(match[1].replace(/&amp;/giu, "&"), RADIO_IIII_PROGRAM_URL).href,
        season, description, host
      };
    });
  if (!items.length) throw new Error(`RADIO IIII season ${season} has no official episode cards`);
  if (items.some((item) => {
    const url = new URL(item.source_url);
    return url.protocol !== "https:" || url.hostname !== "radio4.dk" || !url.pathname.startsWith("/podcasts/et-kapitel-for-sig/");
  })) throw new Error(`RADIO IIII season ${season} contains an off-program episode URL`);
  return items;
}

export function parseRadioIIIIEpisodePage(html, episodeUrl, { fallbackDescription = "", fallbackHost = "" } = {}) {
  const sourceUrl = new URL(episodeUrl);
  if (sourceUrl.protocol !== "https:" || sourceUrl.hostname !== "radio4.dk" ||
      !sourceUrl.pathname.startsWith("/podcasts/et-kapitel-for-sig/")) throw new Error("Untrusted RADIO IIII episode URL");
  const source = String(html ?? "");
  const title = cleanHtml(source.match(/<h1[^>]*>([\s\S]*?)<\/h1>/iu)?.[1]);
  const description = cleanHtml(fallbackDescription) || cleanHtml(source.match(/<div class=["']description["'][^>]*>([\s\S]*?)<\/div>/iu)?.[1]) ||
    cleanHtml(source.match(/<meta property=["']og:description["'] content=["']([^"']*)/iu)?.[1]);
  const creditText = description;
  const hostMatches = [...creditText.matchAll(/\bVært:\s*([^.!?\r\n]+?)(?=\s+(?:Klipper|Redaktør|Research):|$)/giu)]
    .map((match) => match[1].trim());
  const audioUrl = source.match(/https:\/\/traffic\.omny\.fm\/d\/clips\/414edbb4-4b91-4960-8650-ad4000dbc027\/51e8702e-5649-4ff8-9681-ad4800b0bb22\/([0-9a-f-]{36})\/audio\.mp3/iu);
  const imageUrl = source.match(/<meta property=["']og:image["'] content=["']([^"']+)/iu)?.[1]?.replace(/&amp;/giu, "&") || "";
  if (!title || !description || !audioUrl || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(audioUrl[1])) {
    throw new Error(`RADIO IIII episode source is incomplete for ${sourceUrl.href}`);
  }
  if (fallbackHost && fallbackHost !== RADIO_IIII_HOST) throw new Error(`RADIO IIII season-card host credit conflict for ${sourceUrl.href}`);
  const resolvedHost = hostMatches.length === 1 ? hostMatches[0] : fallbackHost;
  if (hostMatches.some((host) => host !== RADIO_IIII_HOST) || (hostMatches.length !== 1 && resolvedHost !== RADIO_IIII_HOST)) {
    throw new Error(`RADIO IIII episode host credit is missing, conflicting, or ambiguous for ${sourceUrl.href}`);
  }
  return { title, description, host: resolvedHost, guid: audioUrl[1].toLowerCase(), audio_url: audioUrl[0], source_url: sourceUrl.href, image_url: imageUrl };
}

function parseProlog(title) {
  const match = String(title ?? "").trim().match(/^Prolog\s*[-:–]\s*(.{2,100})$/iu);
  if (!match) return null;
  const guest = match[1].trim();
  if (/^(?:teaser|trailer|bonus|repris|genhør)\b/iu.test(guest)) return null;
  return guest;
}

function parseChapter(title) {
  const match = String(title ?? "").trim().match(/^Kapitel\s+([1-9]\d*)\s*:\s*(.+)$/iu);
  if (!match) return null;
  const ordinal = Number(match[1]);
  let details = match[2].trim();
  const sequences = [...details.matchAll(/\(([1-9]\d*)\s*:\s*([1-9]\d*)\)/gu)];
  if (sequences.length !== 1) return null;
  const sequence = sequences[0];
  details = details.replace(sequence[0], "").trim();
  const explicitGuest = details.match(/^(.*?)\s+[–-]\s+([^–-].+)$/u);
  return {
    ordinal,
    numerator: Number(sequence[1]),
    total: Number(sequence[2]),
    subtitle: explicitGuest ? explicitGuest[1].trim() : details,
    titledGuest: explicitGuest?.[2].trim() || ""
  };
}

export function validateRadioIIIISeason({ season, episodePages }) {
  if (!Number.isSafeInteger(season) || season < 1 || !Array.isArray(episodePages) || !episodePages.length) {
    return { safe: false, reason: "missing official season identity or episode pages" };
  }
  const prologs = episodePages.filter((item) => parseProlog(item.title));
  if (prologs.length !== 1) return { safe: false, reason: "season must have exactly one named prolog" };
  const guest = parseProlog(prologs[0].title);
  const chapters = episodePages.filter((item) => item !== prologs[0]).map((item) => ({ item, parsed: parseChapter(item.title) }));
  if (chapters.some(({ parsed }) => !parsed)) return { safe: false, reason: "season contains a teaser, reprise, bonus, or unnumbered item" };
  const parsed = chapters.map(({ parsed }) => parsed);
  const total = parsed[0]?.total;
  if (!total || total > 12 || parsed.length !== total ||
      parsed.some((chapter) => chapter.total !== total || chapter.numerator !== chapter.ordinal) ||
      parsed.map((chapter) => chapter.ordinal).sort((a, b) => a - b).some((value, index) => value !== index + 1)) {
    return { safe: false, reason: "chapter sequence is incomplete, overlapping, or inconsistent" };
  }
  const explicitGuests = parsed.map((chapter) => chapter.titledGuest).filter(Boolean);
  if (explicitGuests.some((name) => normalize(name) !== normalize(guest))) {
    return { safe: false, reason: "chapter title conflicts with the official prolog guest" };
  }
  const urls = episodePages.map((item) => item.source_url);
  const guids = episodePages.map((item) => item.guid);
  if (urls.some((url) => !url) || new Set(urls).size !== urls.length ||
      guids.some((guid) => !/^[0-9a-f-]{36}$/iu.test(String(guid ?? ""))) || new Set(guids).size !== guids.length) {
    return { safe: false, reason: "episode URLs or official Omny GUIDs are missing or duplicated" };
  }
  if (episodePages.some((item) => item.host !== RADIO_IIII_HOST || !item.description ||
      !String(item.audio_url ?? "").startsWith("https://traffic.omny.fm/d/clips/414edbb4-4b91-4960-8650-ad4000dbc027/51e8702e-5649-4ff8-9681-ad4800b0bb22/"))) {
    return { safe: false, reason: "episode source or host credit conflicts with RADIO IIII" };
  }
  const orderedChapters = chapters.sort((a, b) => a.parsed.ordinal - b.parsed.ordinal).map(({ item }) => item);
  return { safe: true, guest, prolog: prologs[0], chapters: orderedChapters, total };
}

export function discoverRadioIIIIChildren({ seasons, catalogueRows = [], registry = { version: 1, records: [] }, knownGuests = [] }) {
  if (!Array.isArray(seasons) || !Array.isArray(catalogueRows) || !registry || !Array.isArray(registry.records)) {
    throw new Error("RADIO IIII discovery requires official seasons, catalogue rows, and a registry");
  }
  const next = structuredClone(registry);
  next.version = 1;
  next.records ||= [];
  const report = { created: [], existing: [], unsafe: [], collisions: [] };
  const byTitle = new Map();
  const ids = new Set();
  for (const row of [...catalogueRows, ...next.records.map((item) => ({ Titel: item.title, "Podcast-ID": item.podcast_id, Hovedserie: item.hovedserie }))]) {
    const titleKey = normalize(row?.Titel ?? row?.title);
    if (titleKey) byTitle.set(titleKey, [...(byTitle.get(titleKey) || []), row]);
    const id = String(row?.["Podcast-ID"] ?? row?.podcast_id ?? "").trim();
    if (id) ids.add(id);
  }
  const names = new Map();
  for (const season of seasons) {
    const validated = validateRadioIIIISeason(season);
    if (!validated.safe) { report.unsafe.push({ season: season.season, reason: validated.reason }); continue; }
    const key = normalize(validated.guest);
    names.set(key, [...(names.get(key) || []), season]);
  }
  const registered = new Map(next.records.map((record) => [record.discovery_key, record]));
  for (const [key, seasonMatches] of names) {
    if (seasonMatches.length !== 1) {
      report.collisions.push({ title: seasonMatches[0].guest || parseProlog(seasonMatches[0].episodePages?.[0]?.title), reason: "same guest identity occurs in multiple official seasons" });
      continue;
    }
    const season = seasonMatches[0];
    const validated = validateRadioIIIISeason(season);
    const existing = byTitle.get(key) || [];
    if (existing.length) {
      if (existing.length !== 1 || normalize(existing[0].Hovedserie ?? existing[0].hovedserie) !== normalize(RADIO_IIII_MAIN_SERIES)) {
        report.collisions.push({ title: validated.guest, season: season.season, reason: "same-title catalogue identity is not a unique guest child" });
      } else report.existing.push({ title: validated.guest, season: season.season });
      continue;
    }
    if (registered.has(key)) {
      report.existing.push({ title: validated.guest, season: season.season });
      continue;
    }
    if (knownGuests.length && !knownGuests.some((name) => normalize(name) === key)) continue;
    const podcastId = `radio-iiii-auto-v1-${hash(key)}`;
    if (ids.has(podcastId)) {
      report.collisions.push({ title: validated.guest, season: season.season, podcast_id: podcastId, reason: "permanent Podcast-ID collision" });
      continue;
    }
    const metadata = VERIFIED_RADIO_IIII_METADATA[key] || {};
    const orderedEpisodes = [validated.prolog, ...validated.chapters];
    const topics = metadata.topics || validated.chapters
      .map((episode) => parseChapter(episode.title)?.subtitle.replace(/[\s:;,]+$/gu, "").trim())
      .filter(Boolean).slice(0, 6);
    const sourceDescription = orderedEpisodes.map((episode) => episode.description).join("\n\n");
    const record = {
      discovery_key: key, podcast_id: podcastId, title: validated.guest,
      hovedserie: RADIO_IIII_MAIN_SERIES, publisher: RADIO_IIII_PUBLISHER,
      host: RADIO_IIII_HOST, genre: metadata.genre || "Portræt", topics,
      short_description: metadata.shortDescription || validated.prolog.description.slice(0, 240),
      long_description: sourceDescription.slice(0, 1800),
      source_url: validated.chapters[0].source_url,
      season_url: `${RADIO_IIII_PROGRAM_URL}?season=${season.season}`,
      source_episode_guid: validated.chapters[0].guid,
      source_description: sourceDescription,
      image_url: validated.prolog.image_url || validated.chapters[0].image_url || "",
      season: season.season,
      manual_episodes: orderedEpisodes.map((episode) => episode.title),
      episodes: orderedEpisodes.map((episode, index) => ({
        guid: episode.guid, title: episode.title, source_url: episode.source_url,
        audio_url: episode.audio_url, description: episode.description,
        role: index === 0 ? "prolog" : "chapter", chapter: index || null
      })),
      review_status: "SOURCE_VERIFIED_REQUIRES_OWNER_APPROVAL"
    };
    next.records.push(record);
    registered.set(key, record);
    ids.add(podcastId);
    report.created.push(record);
  }
  const allGuids = new Map();
  for (const record of next.records) for (const episode of record.episodes || []) {
    allGuids.set(episode.guid, [...(allGuids.get(episode.guid) || []), record.podcast_id]);
  }
  const conflicts = [...allGuids].filter(([, owners]) => owners.length > 1);
  if (conflicts.length) throw new Error(`RADIO IIII episode GUIDs overlap across child seasons: ${JSON.stringify(conflicts)}`);
  return { registry: next, report };
}

export function mergeAutoDiscoveredRadioIIIIRows(sheetRows, registry) {
  const rows = Array.isArray(sheetRows) ? sheetRows : [];
  const output = [];
  const enrichments = new Map();
  for (const record of registry?.records || []) {
    const sameId = rows.filter((row) => String(row?.["Podcast-ID"] ?? "").trim() === record.podcast_id);
    const sameTitle = rows.filter((row) => normalize(row?.Titel) === record.discovery_key);
    if (sameId.length || sameTitle.length) {
      if (sameTitle.length === 1 && normalize(sameTitle[0].Hovedserie) === normalize(RADIO_IIII_MAIN_SERIES) &&
          (!sameId.length || sameId[0] === sameTitle[0])) {
        enrichments.set(sameTitle[0], {
          radioIIIISeason: record.season, radioIIIISeasonUrl: record.season_url,
          radioIIIIEpisodes: structuredClone(record.episodes), radioIIIIReviewStatus: record.review_status
        });
        continue;
      }
      if (sameId.length !== 1 || sameTitle.length !== 1 || sameId[0] !== sameTitle[0] ||
          normalize(sameId[0].Hovedserie) !== normalize(RADIO_IIII_MAIN_SERIES)) {
        throw new Error(`Unsafe RADIO IIII catalogue takeover for ${record.title}`);
      }
    }
    output.push({
      Titel: record.title, "Podcast-ID": record.podcast_id, "Vært": record.host,
      Genre: record.genre, Udgiver: record.publisher, Hovedserie: record.hovedserie,
      "Antal afsnit": String(record.episodes.length),
      Link: record.source_url, Kilde: record.source_url, Billedlink: record.image_url,
      "Kort beskrivelse": record.short_description, "Lang beskrivelse": record.long_description,
      Emner: record.topics.join("; "), topics: record.topics,
      manualEpisodes: record.manual_episodes,
      radioIIIISeason: record.season, radioIIIISeasonUrl: record.season_url,
      radioIIIIEpisodes: record.episodes, radioIIIIReviewStatus: record.review_status
    });
  }
  return [...rows.map((row) => enrichments.has(row) ? { ...row, ...enrichments.get(row) } : row), ...output];
}

export function buildRadioIIIIExactGuidRoutes(registry) {
  return (registry?.records || []).flatMap((record) => (record.episodes || []).map((episode) => ({
    key: `radio_iiii:${record.podcast_id}:${episode.role}${episode.chapter ? `-${episode.chapter}` : ""}`,
    podcast_key: record.podcast_id,
    external_guids: [episode.guid],
    title: { patterns: [new RegExp(`^${escapeRegExp(episode.title)}$`, "iu")] }
  })));
}
