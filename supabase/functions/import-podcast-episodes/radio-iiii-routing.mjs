export const RADIO_IIII_FEED_KEY = "radio_iiii_et_kapitel_for_sig";
export const RADIO_IIII_FEED_URL = "https://radio4.dk/api/programs/51e8702e-5649-4ff8-9681-ad4800b0bb22/episodes?orderBy=published&order=desc&limit=100";
export const RADIO_IIII_MAIN_SERIES = "Et kapitel for sig";

const normalize = (value) => String(value ?? "").trim().normalize("NFC").toLocaleLowerCase("da-DK");
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

export function buildRadioIIIIRoutes(rows = []) {
  const children = rows.filter((row) => normalize(row?.Hovedserie) === normalize(RADIO_IIII_MAIN_SERIES));
  const routes = [];
  const ids = new Set();
  const guids = new Set();
  for (const row of children) {
    const podcastKey = String(row?.["Podcast-ID"] ?? "").trim();
    const title = String(row?.Titel ?? "").trim();
    const episodes = row?.radioIIIIEpisodes;
    if (!podcastKey || !title || !Array.isArray(episodes) || episodes.length !== 5 || ids.has(podcastKey)) continue;
    const expectedRoles = ["prolog", "chapter", "chapter", "chapter", "chapter"];
    const valid = episodes.every((episode, index) =>
      episode?.role === expectedRoles[index] &&
      (index === 0 ? episode.chapter == null : episode.chapter === index) &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(String(episode.guid ?? "")) &&
      /^https:\/\/radio4\.dk\/podcasts\/et-kapitel-for-sig\//iu.test(String(episode.source_url ?? "")) &&
      !guids.has(String(episode.guid).toLowerCase()));
    if (!valid) continue;
    ids.add(podcastKey);
    for (const episode of episodes) {
      guids.add(episode.guid.toLowerCase());
      routes.push({
        key: `radio_iiii:${podcastKey}:${episode.role}${episode.chapter ? `-${episode.chapter}` : ""}`,
        podcast_key: podcastKey,
        external_guids: [episode.guid],
        title: { patterns: [new RegExp(`^${escapeRegExp(episode.title)}$`, "iu")] }
      });
    }
  }
  return routes;
}
