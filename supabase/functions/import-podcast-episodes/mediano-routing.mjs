// Shared editorial registry for the public Mediano umbrella source. A destination
// is enabled only when its stable Podcast-ID exists in the public catalogue.
export const PUBLIC_MEDIANO_RSS_URL = "https://www.spreaker.com/show/6169233/episodes/feed";

const enabled = (key, canonicalTitle, podcastKey, aliases) => ({ key, canonicalTitle, podcastKey, aliases, status: "enabled" });
const pending = (key, canonicalTitle, proposedPodcastKey, aliases) => ({ key, canonicalTitle, podcastKey: null, proposedPodcastKey, aliases, status: "pending_catalogue" });
const skipped = (key, canonicalTitle, aliases, reason) => ({ key, canonicalTitle, podcastKey: null, aliases, status: "skip", reason });

export const MEDIANO_PUBLIC_ROUTE_DEFINITIONS = [
  enabled("mediano_superliga", "Mediano Superliga", "mediano superliga", ["Mediano Superliga"]),
  enabled("max_mediano", "Max Mediano", "max mediano", ["Max Mediano"]),
  enabled("mediano_pl", "Mediano PL", "mediano pl", ["Mediano PL"]),
  enabled("superliga_preview", "Superliga Preview", "superliga preview", ["Superliga Preview"]),
  enabled("klub_mediano", "Klub Mediano", "klub mediano", ["Klub Mediano"]),
  enabled("mediano_landshold", "Mediano Landshold", "mediano landshold", ["Mediano Landshold", "Landshold Special"]),
  enabled("mediano_breaking", "Mediano Breaking", "mediano breaking", ["Mediano Breaking"]),
  enabled("fodbold_90erne", "Fodbold var bedre i 90'erne", "fodbold var bedre i 90 erne", ["Fodbold var bedre i 90'erne", "Fodbold var bedre i 90’erne"]),
  enabled("fredagsfrokosten", "Fredagsfrokosten", "fredagsfrokosten", ["Fredagsfrokosten"]),
  enabled("mediano_serie_a", "Mediano Serie A", "mediano serie a", ["Mediano Serie A"]),
  enabled("mediano_1_division", "Mediano 1. division", "mediano 1 division", ["Mediano 1. division"]),
  enabled("mediano_business", "Mediano Business", "mediano business", ["Mediano Business"]),
  enabled("mediano_la_liga", "Mediano La Liga", "mediano la liga", ["Mediano La Liga"]),
  enabled("bold_boger", "Bold & Bøger", "bold boger", ["Bold & Bøger", "Bold og Bøger"]),
  enabled("mediano_bundesliga", "Mediano Bundesliga", "mediano bundesliga", ["Mediano Bundesliga", "Bundesliga"]),
  enabled("mediano_garra", "Mediano Garra", "mediano garra", ["Mediano Garra"]),
  enabled("superliga_special", "Superliga Special", "superliga special", ["Superliga Special"]),
  enabled("mediano_2_division", "Mediano 2. division", "mediano 2 division", ["Mediano 2. division"]),
  enabled("fredagsbold", "Fredagsbold", "fredagsbold", ["Fredagsbold"]),
  enabled("mediano_championship", "Mediano Championship", "mediano championship", ["Mediano Championship"]),
  enabled("mediano_sport_perspektiv", "Mediano Sport og Perspektiv", "mediano sport og perspektiv", ["Mediano Sport og Perspektiv"]),
  enabled("mediano_q", "Mediano Q", "mediano q", ["Mediano Q", "MedianoQ"]),
  enabled("mediano_bossword", "Mediano Bossword", "mediano bossword", ["Mediano Bossword", "Bossword"]),
  enabled("mediano_marketing", "Mediano Marketing", "mediano marketing", ["Mediano Marketing"]),
  enabled("souplesse", "Souplesse", "souplesse", ["Souplesse"]),
  enabled("camp_canada", "Camp Canada", "camp canada", ["Camp Canada"]),
  skipped("fodboldministeriet_source_overlap", "Fodboldministeriet", ["Fodboldministeriet"], "has_dedicated_feed"),
  pending("magasinet_jennings", "Magasinet Jennings", "magasinet jennings", ["Magasinet Jennings", "Jennings"]),
  pending("bruchmann_ringer_til", "Brüchmann ringer til", "bruchmann ringer til", ["Brüchmann ringer til", "Bruchmann ringer til"]),
  pending("der_var_engang_et_maal", "Der var engang et mål", "der var engang et mal", ["Der var engang et mål"]),
  pending("fodboldens_kongeraekke", "Fodboldens Kongerække", "fodboldens kongeraekke", ["Fodboldens Kongerække"]),
  pending("vm_showet", "VM Showet", "vm showet", ["VM Showet"]),
  pending("em_roadshow", "EM Roadshow", "em roadshow", ["EM Roadshow"]),
  pending("mediano_story", "Mediano Story", "mediano story", ["Mediano Story"]),
  pending("superliga_update", "Superliga Update", "superliga update", ["Superliga Update"]),
  pending("bornefodboldkommissionen", "Børnefodboldkommissionen", "bornefodboldkommissionen", ["Børnefodboldkommissionen"]),
  pending("europa_magasinet", "Europa Magasinet", "europa magasinet", ["Europa Magasinet"]),
  pending("det_taktiske_vaerksted", "Det taktiske værksted", "det taktiske vaerksted", ["Det taktiske værksted"])
];

export function normalizeMedianoText(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("da-DK").replace(/&/g, " og ").replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function normalizePrefix(value) {
  return String(value ?? "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("da-DK").replace(/&/g, " og ").replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

export function matchesExplicitTitlePrefix(title, aliases) {
  const normalizedTitle = normalizePrefix(title);
  return (aliases || []).some((alias) => new RegExp(
    `^${escapeRegExp(normalizePrefix(alias))}(?:$|\\s*(?::|#|[-–—|]|\\.{2,}))`, "u"
  ).test(normalizedTitle));
}

export function routeMedianoPublicTitle(title, definitions = MEDIANO_PUBLIC_ROUTE_DEFINITIONS) {
  const matches = definitions.filter((definition) => matchesExplicitTitlePrefix(title, definition.aliases));
  if (matches.length === 1) return { status: matches[0].podcastKey ? "routed" : "known_no_destination", route: matches[0] };
  if (matches.length > 1) return { status: "ambiguous", routes: matches };
  return { status: "unmatched", routes: [] };
}

export function buildMedianoPublicFeedRoutes() {
  return MEDIANO_PUBLIC_ROUTE_DEFINITIONS.map((definition) => ({
    key: definition.key,
    podcast_key: definition.podcastKey,
    title: { prefixes: definition.aliases }
  }));
}

// Design-only interface. It deliberately carries the *name* of an Edge Function
// secret, not its value, and is not registered in FEED_CONFIGS. Activation must
// wait for private-audio authorization/redaction support in the importer/UI.
export const STOT_MEDIANO_RSS_URL_ENV = "STOT_MEDIANO_RSS_URL";
export function describeStotMedianoSource() {
  return {
    source: "mediano_stot_rss",
    feed_url_env: STOT_MEDIANO_RSS_URL_ENV,
    routes: buildMedianoPublicFeedRoutes(),
    activation: "blocked_pending_private_audio_authorization"
  };
}
