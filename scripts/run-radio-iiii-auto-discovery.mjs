import { readFile, writeFile } from "node:fs/promises";
import {
  discoverRadioIIIIChildren, parseRadioIIIIEpisodePage, parseRadioIIIISeasonLinks,
  parseRadioIIIISeasonPage, RADIO_IIII_PROGRAM_URL
} from "./radio-iiii-auto-discovery.mjs";

const REGISTRY_PATH = "data/auto-discovered-radio-iiii.json";
const KNOWN_FIRST_RUN_GUESTS = ["Mattias Tesfaye", "Birgithe Kosovic", "Ditlev Tamm", "Sara Blædel"];
const TIMEOUT_MS = 15000;

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { accept: "text/html,application/xhtml+xml" } });
    if (!response.ok) throw new Error(`RADIO IIII source returned HTTP ${response.status}: ${url}`);
    return await response.text();
  } finally { clearTimeout(timer); }
}

async function mapLimit(items, limit, mapper) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      output[index] = await mapper(items[index], index);
    }
  }));
  return output;
}

const programHtml = await fetchText(RADIO_IIII_PROGRAM_URL);
const seasonNumbers = parseRadioIIIISeasonLinks(programHtml);
const catalogue = JSON.parse(await readFile("data/podcasts.json", "utf8"));
const registry = JSON.parse(await readFile(REGISTRY_PATH, "utf8"));
const seasonCards = await mapLimit(seasonNumbers, 6, async (season) => ({
  season,
  cards: parseRadioIIIISeasonPage(await fetchText(`${RADIO_IIII_PROGRAM_URL}?season=${season}`), season)
}));

const priorNames = new Set([
  ...(catalogue.rows || []).map((row) => String(row.Titel || "").trim().toLocaleLowerCase("da-DK")),
  ...(registry.records || []).map((record) => String(record.title || "").trim().toLocaleLowerCase("da-DK"))
]);
const threshold = Number(registry.last_scanned_season || 0);
const newSeasonCandidates = seasonCards.flatMap(({ season, cards }) => {
  const prologs = cards.filter(({ title }) => /^Prolog\s*[-:–]\s*.+$/iu.test(title));
  if (prologs.length !== 1) return [];
  const guest = prologs[0].title.replace(/^Prolog\s*[-:–]\s*/iu, "").trim();
  const isNamedInitialCandidate = KNOWN_FIRST_RUN_GUESTS.some((name) => name.toLocaleLowerCase("da-DK") === guest.toLocaleLowerCase("da-DK"));
  if (!threshold && !isNamedInitialCandidate) return [];
  if (threshold && (season <= threshold || priorNames.has(guest.toLocaleLowerCase("da-DK")))) return [];
  return [{ season, guest, cards }];
});

const seasons = await mapLimit(newSeasonCandidates, 4, async ({ season, cards }) => {
  const episodePages = await mapLimit(cards, 5, async (card) => {
    const detail = parseRadioIIIIEpisodePage(await fetchText(card.source_url), card.source_url, {
      fallbackDescription: card.description, fallbackHost: card.host
    });
    if (detail.title !== card.title) throw new Error(`RADIO IIII season-card/detail title conflict for ${card.source_url}`);
    return detail;
  });
  return { season, episodePages };
});

const result = discoverRadioIIIIChildren({
  seasons,
  catalogueRows: catalogue.rows || [],
  registry,
  knownGuests: threshold ? [] : KNOWN_FIRST_RUN_GUESTS
});
const successfullyDiscoveredSeasons = new Set(result.report.created.map((record) => record.season));
let nextThreshold = threshold;
while (successfullyDiscoveredSeasons.has(nextThreshold + 1)) nextThreshold += 1;
if (!threshold && result.report.created.length === KNOWN_FIRST_RUN_GUESTS.length) {
  nextThreshold = Math.max(...result.report.created.map((record) => record.season));
}
result.registry.last_scanned_season = nextThreshold;
const dryRun = process.argv.includes("--dry-run");
if (!dryRun && JSON.stringify(registry) !== JSON.stringify(result.registry)) {
  await writeFile(REGISTRY_PATH, `${JSON.stringify(result.registry, null, 2)}\n`);
}
console.log(JSON.stringify({
  dry_run: dryRun,
  scanned_seasons: seasonNumbers.length,
  new_season_candidates: newSeasonCandidates.length,
  created: result.report.created.map(({ podcast_id, title, season, episodes }) => ({ podcast_id, title, season, episodes: episodes.length })),
  existing: result.report.existing,
  unsafe: result.report.unsafe,
  collisions: result.report.collisions
}, null, 2));
