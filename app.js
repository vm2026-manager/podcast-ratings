const JSON_DATA_URL = "data/podcasts.json";
const FEATURED_JSON_DATA_URL = "data/featured-reviews.json";
const COVER_MANIFEST_URL = "data/podcast-cover-manifest.json";
const LOCAL_EPISODE_DATA_URL = "data/podcast-episodes.json";
const RECOMMENDATION_METADATA_URL = "data/recommendation-metadata.json";
const PODCAST_SIMILARITY_PRODUCT_URL = "data/podcast-similarity-product-v1.3.json";

const GENRES = [
  "Alle",
  "True Crime",
  "Historie",
  "Samfund",
  "Sport",
  "Dokumentar",
  "Viden",
  "Underholdning",
  "Sladder"
];
const HOME_GENRES = GENRES.filter((genre) => genre !== "Alle");

const FEATURED_ROTATION_MS = 8000;
const INITIAL_VISIBLE_COUNT = 24;
const MOBILE_RANKING_BATCH_SIZE = 20;
const MOBILE_RANKING_TAIL_SIZE = 50;
const DESKTOP_RANKING_BATCH_SIZE = 24;
const VALID_RANKING_SOURCES = new Set(["mads", "users"]);
const VALID_LANGUAGE_FILTERS = new Set(["all", "danish", "english"]);
const PODCAST_DATA_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const HOME_HERO_COVER_COUNT = 12;
const HOME_ROTATION_TOP_LIMIT = 50;
const HOME_POPULAR_CAROUSEL_POOL_LIMIT = 20;
const HOME_COMMUNITY_MIN_RATING = 6;
const HOME_COMMUNITY_PRIMARY_MIN_COUNT = 3;
const HOME_COMMUNITY_SECONDARY_MIN_COUNT = 2;
const AUTO_EXPAND_DELAY_MS = 900;
const SEO_PILOT_PODCAST_IDS = new Set([
  "mørkeland", "genstart", "millionærklubben", "sagen genabnet",
  "borgerlig tabloid", "det vi taler om", "langt fra løgnen", "mads og a holdet",
  "vanvittig verdenshistorie", "afhørt",
  "fantino og bonde", "danske drabssager", "only in america", "dkpol",
  "børsen morgenbriefing", "jagten pa det evige liv", "sig det løgn", "frontlinjen",
  "børsen brænder", "hva sa", "112 for knuste hjerter", "aftalt spil",
  "transferguru", "grebet af gvfb", "opskriften pa kærlighed", "bomben",
  "mathias helts talkshow", "tiden", "nationens mareridt", "kvart i bold"
]);
const EPISODE_DATABASE_KEY_ALIASES = {
  "genstart": "genstart",
  "det vi taler om": "det vi taler om",
  "morkeland": "mørkeland",
  "mørkeland": "mørkeland",
  "verdens klogeste land": "verdens klogeste land",
  "borgen unplugged 2 0": "borgen unplugged 2 0",
  "jagten paa det evige liv": "jagten pa det evige liv",
  "jagten på det evige liv": "jagten pa det evige liv",
  "hva saa": "hva sa",
  "hva så": "hva sa",
  "112 for knuste hjerter": "112 for knuste hjerter",
  "langt fra lognen": "langt fra løgnen",
  "langt fra løgnen": "langt fra løgnen",
  "dkpol": "dkpol",
  "millionaerklubben": "millionærklubben",
  "millionærklubben": "millionærklubben",
  "sagen genaabnet": "sagen genabnet",
  "sagen genåbnet": "sagen genabnet",
  "vi ser paa det": "vi ser pa det",
  "vi ser på det": "vi ser pa det",
  "vaagn lidt op": "vagn lidt op",
  "vågn lidt op": "vagn lidt op"
};
const EPISODE_PODCAST_CONFIG = {
  "mads og a holdet": {
    podcastKey: "mads og a holdet",
    databasePodcastKey: "mads og a holdet",
    enabled: true,
    displayName: "Mads og A-holdet",
    searchPlaceholder: "Søg i Mads og A-holdet-episoder",
    source: "apple_podcasts",
    persistence: "supabase"
  },
  genstart: {
    podcastKey: "genstart",
    databasePodcastKey: "genstart",
    enabled: true,
    displayName: "Genstart",
    searchPlaceholder: "S\u00f8g i Genstart-episoder",
    source: "dr",
    persistence: "supabase"
  },
  "det vi taler om": {
    podcastKey: "det vi taler om",
    databasePodcastKey: "det vi taler om",
    enabled: true,
    displayName: "Det, vi taler om",
    searchPlaceholder: "S\u00f8g i Det, vi taler om-episoder",
    source: "radio4",
    persistence: "supabase"
  },
  "mørkeland": {
    podcastKey: "mørkeland",
    databasePodcastKey: "mørkeland",
    enabled: true,
    displayName: "Mørkeland",
    searchPlaceholder: "Søg i Mørkeland-episoder",
    source: "podplay",
    persistence: "supabase"
  },
  "verdens klogeste land": {
    podcastKey: "verdens klogeste land",
    databasePodcastKey: "verdens klogeste land",
    enabled: true,
    displayName: "Verdens klogeste land",
    searchPlaceholder: "Søg i Verdens klogeste land-episoder",
    source: "simplecast",
    persistence: "supabase"
  },
  "borgen unplugged 2 0": {
    podcastKey: "borgen unplugged 2 0",
    databasePodcastKey: "borgen unplugged 2 0",
    enabled: true,
    displayName: "Borgen Unplugged 2.0",
    searchPlaceholder: "Søg i Borgen Unplugged 2.0-episoder",
    source: "soundcloud",
    persistence: "supabase"
  },
  "transfer talk": {
    podcastKey: "transfer talk",
    databasePodcastKey: "transfer talk",
    enabled: true,
    displayName: "Transfer Talk",
    searchPlaceholder: "Søg i Transfer Talk-episoder",
    source: "buzzsprout",
    persistence: "supabase"
  },
  "spillet bag spillet": {
    podcastKey: "spillet bag spillet",
    databasePodcastKey: "spillet bag spillet",
    enabled: true,
    displayName: "Spillet bag spillet",
    searchPlaceholder: "Søg i Spillet bag spillet-episoder",
    source: "buzzsprout",
    persistence: "supabase"
  },
  "superligaens sandheder": {
    podcastKey: "superligaens sandheder",
    databasePodcastKey: "superligaens sandheder",
    enabled: true,
    displayName: "Superligaens Sandheder",
    searchPlaceholder: "Søg i Superligaens Sandheder-episoder",
    source: "buzzsprout",
    persistence: "supabase"
  },
  femtedommer: {
    podcastKey: "femtedommer",
    databasePodcastKey: "femtedommer",
    enabled: true,
    displayName: "Femtedommer",
    searchPlaceholder: "Søg i Femtedommer-episoder",
    source: "buzzsprout",
    persistence: "supabase"
  },
  "jagten pa det evige liv": {
    podcastKey: "jagten pa det evige liv",
    databasePodcastKey: "jagten pa det evige liv",
    enabled: true,
    displayName: "Jagten på det evige liv",
    searchPlaceholder: "Søg i Jagten på det evige liv-episoder",
    source: "dr",
    persistence: "supabase"
  },
  "hva sa": {
    podcastKey: "hva sa",
    databasePodcastKey: "hva sa",
    enabled: true,
    displayName: "Hva så?!",
    searchPlaceholder: "Søg i Hva så?!-episoder",
    source: "simplecast",
    persistence: "supabase"
  },
  "112 for knuste hjerter": {
    podcastKey: "112 for knuste hjerter",
    databasePodcastKey: "112 for knuste hjerter",
    enabled: true,
    displayName: "112 For Knuste Hjerter",
    searchPlaceholder: "Søg i 112 For Knuste Hjerter-episoder",
    source: "spreaker",
    persistence: "supabase"
  },
  "langt fra løgnen": {
    podcastKey: "langt fra løgnen",
    databasePodcastKey: "langt fra løgnen",
    enabled: true,
    displayName: "Langt fra løgnen",
    searchPlaceholder: "Søg i Langt fra løgnen-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "dkpol": {
    podcastKey: "dkpol",
    databasePodcastKey: "dkpol",
    enabled: true,
    displayName: "#DKpol",
    searchPlaceholder: "Søg i #DKpol-episoder",
    source: "acast",
    persistence: "supabase"
  },
  "millionærklubben": {
    podcastKey: "millionærklubben",
    databasePodcastKey: "millionærklubben",
    enabled: true,
    displayName: "Millionærklubben",
    searchPlaceholder: "Søg i Millionærklubben-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "sagen genabnet": {
    podcastKey: "sagen genabnet",
    databasePodcastKey: "sagen genabnet",
    enabled: true,
    displayName: "Sagen Genåbnet",
    searchPlaceholder: "Søg i Sagen Genåbnet-episoder",
    source: "simplecast",
    persistence: "supabase"
  },
  "vi ser pa det": {
    podcastKey: "vi ser pa det",
    databasePodcastKey: "vi ser pa det",
    enabled: true,
    displayName: "Vi ser på det",
    searchPlaceholder: "Søg i Vi ser på det-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "marcus og realitypanelet": {
    podcastKey: "marcus og realitypanelet",
    databasePodcastKey: "marcus og realitypanelet",
    enabled: true,
    displayName: "Marcus og realitypanelet",
    searchPlaceholder: "Søg i Marcus og realitypanelet-episoder",
    source: "spreaker",
    persistence: "supabase"
  },
  "borgerlig tabloid": {
    podcastKey: "borgerlig tabloid",
    databasePodcastKey: "borgerlig tabloid",
    enabled: true,
    displayName: "Borgerlig tabloid",
    searchPlaceholder: "Søg i Borgerlig tabloid-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "magten": {
    podcastKey: "magten",
    databasePodcastKey: "magten",
    enabled: true,
    displayName: "Magten",
    searchPlaceholder: "Søg i Magten-episoder",
    source: "dr",
    persistence: "supabase"
  },
  "frontlinjen": {
    podcastKey: "frontlinjen",
    databasePodcastKey: "frontlinjen",
    enabled: true,
    displayName: "Frontlinjen",
    searchPlaceholder: "Søg i Frontlinjen-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "sig det løgn": {
    podcastKey: "sig det løgn",
    databasePodcastKey: "sig det løgn",
    enabled: true,
    displayName: "Sig det' løgn",
    searchPlaceholder: "Søg i Sig det' løgn-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "ægte par": {
    podcastKey: "ægte par",
    databasePodcastKey: "ægte par",
    enabled: true,
    displayName: "Ægte par",
    searchPlaceholder: "Søg i Ægte par-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "aftalt spil": {
    podcastKey: "aftalt spil",
    databasePodcastKey: "aftalt spil",
    enabled: true,
    displayName: "Aftalt spil",
    searchPlaceholder: "Søg i Aftalt spil-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "alt det vi arver": {
    podcastKey: "alt det vi arver",
    databasePodcastKey: "alt det vi arver",
    enabled: true,
    displayName: "Alt det, vi arver",
    searchPlaceholder: "Søg i Alt det, vi arver-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "børnefri": {
    podcastKey: "børnefri",
    databasePodcastKey: "børnefri",
    enabled: true,
    displayName: "Børnefri",
    searchPlaceholder: "Søg i Børnefri-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "børsen brænder": {
    podcastKey: "børsen brænder",
    databasePodcastKey: "børsen brænder",
    enabled: true,
    displayName: "Børsen brænder",
    searchPlaceholder: "Søg i Børsen brænder-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "du er ikke alene": {
    podcastKey: "du er ikke alene",
    databasePodcastKey: "du er ikke alene",
    enabled: true,
    displayName: "Du er ikke alene",
    searchPlaceholder: "Søg i Du er ikke alene-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "epstein filerne": {
    podcastKey: "epstein filerne",
    databasePodcastKey: "epstein filerne",
    enabled: true,
    displayName: "Epstein-filerne",
    searchPlaceholder: "Søg i Epstein-filerne-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "europa i krig": {
    podcastKey: "europa i krig",
    databasePodcastKey: "europa i krig",
    enabled: true,
    displayName: "Europa i krig",
    searchPlaceholder: "Søg i Europa i krig-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "fixerummet": {
    podcastKey: "fixerummet",
    databasePodcastKey: "fixerummet",
    enabled: true,
    displayName: "Fixerummet",
    searchPlaceholder: "Søg i Fixerummet-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "har du hørt": {
    podcastKey: "har du hørt",
    databasePodcastKey: "har du hørt",
    enabled: true,
    displayName: "Har du hørt?",
    searchPlaceholder: "Søg i Har du hørt?-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "hvis du vil vide mere": {
    podcastKey: "hvis du vil vide mere",
    databasePodcastKey: "hvis du vil vide mere",
    enabled: true,
    displayName: "Hvis du vil vide mere",
    searchPlaceholder: "Søg i Hvis du vil vide mere-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "løgn og morfin": {
    podcastKey: "løgn og morfin",
    databasePodcastKey: "løgn og morfin",
    enabled: true,
    displayName: "Løgn og morfin",
    searchPlaceholder: "Søg i Løgn og morfin-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "mathias helts talkshow": {
    podcastKey: "mathias helts talkshow",
    databasePodcastKey: "mathias helts talkshow",
    enabled: true,
    displayName: "Mathias Helts Talkshow",
    searchPlaceholder: "Søg i Mathias Helts Talkshow-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "only in america": {
    podcastKey: "only in america",
    databasePodcastKey: "only in america",
    enabled: true,
    displayName: "Only in America",
    searchPlaceholder: "Søg i Only in America-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "portrætalbum": {
    podcastKey: "portrætalbum",
    databasePodcastKey: "portrætalbum",
    enabled: true,
    displayName: "Portrætalbum",
    searchPlaceholder: "Søg i Portrætalbum-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "skytsenglen": {
    podcastKey: "skytsenglen",
    databasePodcastKey: "skytsenglen",
    enabled: true,
    displayName: "Skytsenglen",
    searchPlaceholder: "Søg i Skytsenglen-episoder",
    source: "omny",
    persistence: "supabase"
  },
  "vagn lidt op": {
    podcastKey: "vagn lidt op",
    databasePodcastKey: "vagn lidt op",
    enabled: true,
    displayName: "Vågn lidt op!",
    searchPlaceholder: "Søg i Vågn lidt op!-episoder",
    source: "omny",
    persistence: "supabase"
  },
  bomben: {
    podcastKey: "bomben",
    enabled: true,
    displayName: "Bomben",
    source: "radio4",
    dataSource: "local",
    persistence: "supabase",
    episodeCount: 10,
    teaserExcluded: true
  }
};
const MANUAL_CATALOGUE_SOURCE = "manual_catalogue_v1";
const REVIEWED_LEGACY_MANUAL_CATALOGUE_SOURCE = "manual_sheet";
const BOMBEN_LEGACY_EPISODE_ID_TO_CANONICAL_ID = Object.freeze({
  "bomben-01": "c7599019-1106-5e7e-a5f1-893306e57790",
  "bomben-02": "00a1b3cb-40ae-52de-8276-4d45ebf4f4c0",
  "bomben-03": "c150d333-7b03-5bcc-8c47-48c97e32d48a",
  "bomben-04": "2df98b7c-0a87-50eb-bf10-069e03e57225",
  "bomben-05": "95715ea8-c123-5bbb-b14c-e2c65f2ade81",
  "bomben-06": "8e19963d-335b-52a8-916e-c2b30d9fe466",
  "bomben-07": "12a33e5c-865a-57fb-8202-d55a2e658c01",
  "bomben-08": "faeb474e-fb2c-50c1-b5d0-bbf8de49ca1b",
  "bomben-09": "9ea45188-e72e-557f-a4bc-7796fa6781e5",
  "bomben-10": "f5428bc3-1e71-5af6-8363-93cd13708f70"
});
const EPISODE_PAGE_SIZE = 20;
const EPISODE_WORKSPACE_PAGE_SIZE = 16;
const MINIMUM_RATEABLE_EPISODE_COUNT = 2;
const EPISODE_CACHE_TTL_MS = 10 * 60 * 1000;
const EPISODE_SEARCH_DEBOUNCE_MS = 320;
const PROFILE_EPISODE_RATINGS_PAGE_SIZE = 20;
const PODCAST_RATING_PUBLIC_STATS_VIEW = "podcast_rating_combined_public_stats";
const DATA_VERSION = "2026-07-16-underrated-pearls";
const EXPANDED_LIST_STORAGE_KEY = "podcast-ratings-expanded-list";
const VIEW_MODE_STORAGE_KEY = "podcast-ratings-desktop-view";
const DESKTOP_RANKING_LAYOUT_STORAGE_KEY = "podcast-ratings-desktop-ranking-layout";
const AUTH_PERSISTENCE_STORAGE_KEY = "podcast-ratings-auth-persistence";
const PROFILE_PREFERENCES_STORAGE_KEY = "podcast-ratings-profile-preferences";
const EXPLORE_PERSONAL_SEED_HISTORY_STORAGE_KEY =
  "podcast-ratings-explore-personal-seed-history-v1";
const UDFORSK_RECOMMENDATION_VERSION = 5;
const EXPLORE_PERSONAL_SNAPSHOT_STORAGE_KEY =
  "podcast-ratings-explore-personal-snapshots-v2";
const EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE = 3;
const LOCAL_EPISODE_RATINGS_STORAGE_KEY = "podcast-ratings-local-episode-ratings-v1";
const EPISODE_PARENT_RATING_BACKUP_STORAGE_KEY =
  "podcast-ratings-episode-parent-rating-backups-v1";
const EXPLORE_PERSONAL_SEED_FRESHNESS_DAYS = 3;
const EXPLORE_PERSONAL_SEED_HISTORY_MAX_AGE_DAYS = 30;
const NEW_BADGE_DAYS = 14;
const IMAGE_FALLBACK_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
const NORMAL_VIEWPORT_CONTENT = "width=device-width, initial-scale=1, viewport-fit=cover";
const ZOOM_RESET_VIEWPORT_CONTENT =
  "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover";
let viewportZoomResetToken = 0;
let viewportZoomResetFrame = 0;
let viewportZoomResetSecondFrame = 0;
let viewportZoomResetTimeout = 0;
const LOCAL_COVER_ALIASES = {
  "data/covers/075-boraghi-og-pengedoktoren.jpg": "data/covers/076-boraghi-og-pengedoktoren.jpg",
  "data/covers/076-borgen-unplugged.jpg": "data/covers/077-borgen-unplugged.jpg",
  "data/covers/077-mediano-waiting.jpg": "data/covers/078-mediano-waiting.jpg",
  "data/covers/078-med-dansk-hilsen.jpg": "data/covers/079-med-dansk-hilsen.jpg",
  "data/covers/079-casey-anthony-den-mest-hadede-kvinde-i-usa.png": "data/covers/080-casey-anthony-den-mest-hadede-kvinde-i-usa.png",
  "data/covers/086-frank-william-abagnale.png": "data/covers/087-frank-william-abagnale.png",
  "data/covers/090-genstart.jpg": "data/covers/091-genstart.jpg",
  "data/covers/091-livet-if-lge-emil-og-thomas.jpg": "data/covers/092-livet-if-lge-emil-og-thomas.jpg",
  "data/covers/183-mediano-marketing.jpg": "data/covers/187-mediano-marketing.jpg",
  "data/covers/184-max-mediano.jpg": "data/covers/188-max-mediano.jpg",
  "data/covers/194-der-var-engang-et-mal-af-peter-m-ller-mod-farum.jpg": "data/covers/198-der-var-engang-et-mal-af-peter-m-ller-mod-farum.jpg",
  "data/covers/210-blodbad.jpg": "data/covers/214-blodbad.jpg",
  "data/covers/269-spiralkampagnen.png": "data/covers/272-spiralkampagnen.png",
  "data/covers/280-sadan-blev-han-victor-froholdt.jpg": "data/covers/282-sadan-blev-han-victor-froholdt.jpg",
  "data/covers/281-minimax.jpg": "data/covers/283-minimax.jpg",
  "data/covers/293-mediano-special-sagen-om-de-15-point-forsvandt-fra-inlommen-af-den-gamle-dame.jpg": "data/covers/299-mediano-special-sagen-om-de-15-point-forsvandt-fra-inlommen-af-den-gamle-dame.jpg",
  "data/covers/305-bech-bag-bolden-landsholdets-analytiker-mounir-akhiat.jpg": "data/covers/315-bech-bag-bolden-landsholdets-analytiker-mounir-akhiat.jpg",
  "data/covers/311-den-store-talentserie.jpg": "data/covers/320-den-store-talentserie.jpg",
  "data/covers/356-reality-tjek.jpg": "data/covers/362-reality-tjek.jpg",
  "data/covers/378-hammers-kaffebar.jpg": "data/covers/383-hammers-kaffebar.jpg",
  "data/covers/424-europa-rundt-med-hebo.jpg": "data/covers/294-europa-rundt-med-hebo.jpg",
  "data/covers/446-valgfl-sk.jpg": "data/covers/445-valgfl-sk.jpg",
  "data/covers/451-peter-og-profeterne.jpg": "data/covers/450-peter-og-profeterne.jpg",
  "data/covers/512-i-dinosaurernes-fodspor.jpg": "data/covers/509-i-dinosaurernes-fodspor.jpg"
};
const SUPABASE_CONFIG = window.PODCAST_SUPABASE_CONFIG || {
  url: "",
  anonKey: ""
};

// This is only a UI convenience gate. The matching Supabase migration enforces
// the same rule through RLS before any suggestion can be read or reviewed.
const PODCAST_SUGGESTION_ADMIN_EMAILS = new Set(["aspmads@hotmail.com"]);
const PODCAST_SUGGESTION_STATUSES = new Set(["new", "approved", "rejected"]);

function readAuthPersistencePreference() {
  try {
    return window.localStorage.getItem(AUTH_PERSISTENCE_STORAGE_KEY) !== "session";
  } catch {
    return true;
  }
}

let authUsesPersistentStorage = readAuthPersistencePreference();
const trackedAuthStorageKeys = new Set();

function getAuthStorage(persistent = authUsesPersistentStorage) {
  try {
    return persistent ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function setAuthStorageMode(persistent, { savePreference = true } = {}) {
  authUsesPersistentStorage = Boolean(persistent);

  if (!savePreference) return;

  try {
    window.localStorage.setItem(
      AUTH_PERSISTENCE_STORAGE_KEY,
      authUsesPersistentStorage ? "local" : "session"
    );
  } catch {
    // Supabase reports storage failures during authentication when relevant.
  }
}

function removeAuthStorageKey(storage, key) {
  if (!storage) return;

  try {
    storage.removeItem(key);
  } catch {
    // Ignore cleanup failures in unavailable browser storage.
  }
}

const supabaseAuthStorage = {
  getItem(key) {
    trackedAuthStorageKeys.add(key);
    const selectedStorage = getAuthStorage();
    if (!selectedStorage) return null;

    try {
      return selectedStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    trackedAuthStorageKeys.add(key);
    const selectedStorage = getAuthStorage();
    if (!selectedStorage) throw new Error("Browserens sessionlager er ikke tilg\u00e6ngeligt.");

    selectedStorage.setItem(key, value);
    removeAuthStorageKey(getAuthStorage(!authUsesPersistentStorage), key);
  },
  removeItem(key) {
    trackedAuthStorageKeys.add(key);
    removeAuthStorageKey(getAuthStorage(true), key);
    removeAuthStorageKey(getAuthStorage(false), key);
  }
};

function clearTrackedAuthStorage() {
  trackedAuthStorageKeys.forEach((key) => {
    supabaseAuthStorage.removeItem(key);
  });
}

function readExpandedListPreference() {
  try {
    return window.localStorage.getItem(EXPANDED_LIST_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistExpandedListPreference(value) {
  try {
    window.localStorage.setItem(EXPANDED_LIST_STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Ignore localStorage failures.
  }
}

function readDesktopViewPreference() {
  try {
    return window.localStorage.getItem(VIEW_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function persistDesktopViewPreference(value) {
  try {
    window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Ignore localStorage failures.
  }
}

function readDesktopRankingLayoutPreference() {
  try {
    const value = window.localStorage.getItem(DESKTOP_RANKING_LAYOUT_STORAGE_KEY);
    if (value === "cards") return "cards";
    return "list";
  } catch {
    return "list";
  }
}
function persistDesktopRankingLayoutPreference(value) {
  try {
    window.localStorage.setItem(DESKTOP_RANKING_LAYOUT_STORAGE_KEY, value);
  } catch {
    // Layout preference is optional; the in-session state still works.
  }
}

function readProfilePreferences() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_PREFERENCES_STORAGE_KEY) || "{}");
    const rankingPositionModeByUser =
      parsed.rankingPositionModeByUser &&
      typeof parsed.rankingPositionModeByUser === "object" &&
      !Array.isArray(parsed.rankingPositionModeByUser)
        ? parsed.rankingPositionModeByUser
        : {};
    return {
      defaultRankingSource:
        parsed.defaultRankingSource === "mads" || parsed.defaultRankingSource === "users"
          ? parsed.defaultRankingSource
          : "users",
      defaultSort:
        parsed.defaultSort === "placement-desc" || parsed.defaultSort === "placement-asc"
          ? parsed.defaultSort
          : "placement-asc",
      rankingPositionModeByUser
    };
  } catch {
    return {
      defaultRankingSource: "users",
      defaultSort: "placement-asc",
      rankingPositionModeByUser: {}
    };
  }
}

function persistProfilePreferences(preferences) {
  state.profilePreferences = {
    ...state.profilePreferences,
    ...preferences
  };
  try {
    window.localStorage.setItem(
      PROFILE_PREFERENCES_STORAGE_KEY,
      JSON.stringify(state.profilePreferences)
    );
  } catch {
    // Preferences are convenience-only; the UI still works without localStorage.
  }
}

const state = {
  podcasts: [],
  podcastByKey: {},
  podcastById: {},
  podcastByLegacyKey: {},
  coverManifestByKey: {},
  coverMetaByPrimarySrc: {},
  coverManifestWarningShown: false,
  failedImageSources: new Set(),
  allReviews: [],
  featuredReviews: [],
  featuredReviewByKey: {},
  supabase: null,
  session: null,
  authUser: null,
  authReady: false,
  authConfigured: hasSupabaseConfig(),
  authBusy: false,
  authMode: "signup",
  authMessageTimer: null,
  passwordRecovery: {
    status: "idle",
    userId: "",
    // Capture the recovery URL before the application's hash router normalizes it.
    linkObserved: window.PODCAST_RECOVERY_PROVENANCE?.type === "recovery" || hasRecoveryLinkInHash(),
    invalidLinkTimer: null
  },
  pendingAuthAction: null,
  authReturnFocus: null,
  exploreSuggestionDialogOpen: false,
  activeSuggestionEditId: null,
  userRatingsByKey: {},
  communityStatsByKey: {},
  userRankByKey: {},
  profileSuggestions: [],
  profileSuggestionsLoadedFor: null,
  profileSuggestionsLoading: false,
  profileSuggestionsError: "",
  suggestionNotificationTarget: null,
  adminPodcastSuggestions: [],
  adminPodcastSuggestionsLoadedFor: null,
  adminPodcastSuggestionsLoading: false,
  adminPodcastSuggestionsError: "",
  adminPodcastSuggestionsFeedback: "",
  adminPodcastSuggestionsFeedbackIsError: false,
  adminPodcastSuggestionFilter: "new",
  adminPodcastSuggestionNoteDrafts: new Map(),
  adminPodcastSuggestionCatalogueDrafts: new Map(),
  podcastSuggestionStatusPendingIds: new Set(),
  profileRatingsSort: "alpha",
  profileSavedExpanded: false,
  savedPodcastKeys: new Set(),
  savedPodcastMetaByKey: {},
  activeRatingKey: null,
  openReviewKeys: new Set(),
  featuredIndex: 0,
  featuredTimer: null,
  featuredPaused: false,
  homeFeaturedIndex: 0,
  homeFeaturedAutoplayTimer: null,
  homeFeaturedAutoplayPaused: false,
  activeFilter: null,
  activePublisherFilter: "",
  activeMainSeriesFilter: "",
  searchTerm: "",
  minimumRating: 0,
  freeOnly: false,
  languageFilter: "all",
  rankingSource: "mads",
  rankingSourceTouched: false,
  userRankingSort: "rating",
  userRankingDirection: "desc",
  sort: "placement-asc",
  sortTouched: false,
  profilePreferences: readProfilePreferences(),
  rankingPositionMode: "dynamic",
  profileSettingsBusy: false,
  profileSettingsMessage: "",
  profileSettingsMessageTone: "info",
  currentRoute: null,
  currentRawRoute: "",
  rankingScrollY: 0,
  rankingUsedGoToBottom: false,
  rankingScrollPositionCaptured: false,
  favoriteSavePendingKeys: new Set(),
  ratingDialogMode: "podcast",
  activePodcastDetailKey: null,
  activeEpisodeRatingId: null,
  podcastDetailView: "detail",
  podcastDetailMainSeriesValue: "",
  podcastDetailMainSeriesSourceKey: null,
  podcastDetailBackToMainSeries: false,
  podcastDetailDetailScrollTop: 0,
  podcastDetailEpisodeId: null,
  podcastDetailEpisodeScrollTop: 0,
  podcastDetailReturnFocus: null,
  podcastDetailScrollY: 0,
  podcastDetailNavigationHistory: [],
  podcastDetailRankingKeys: [],
  podcastDetailRankingIndex: -1,
  episodeParentRatingSyncSignatures: {},
  episodeParentRatingSyncPendingKeys: new Set(),
  localEpisodeDataPromise: null,
  // Keyed by immutable manual_episode_key so a reviewed legacy canonical row
  // can retain its pre-existing Supabase UUID while the catalogue keeps its
  // historical v1 local identity as a read-only fallback alias.
  manualCanonicalEpisodeMappings: new Map(),
  manualCanonicalResolutionLoadingKeys: new Set(),
  podcastEpisodesByKey: {
    genstart: {
    items: [],
    hasMore: true,
    totalCount: null,
    fetchedAt: 0,
    loading: false,
    loadingMore: false,
    error: "",
    searchTerm: "",
    searchLocalResults: [],
    searchResults: [],
    searchResolved: false,
    searchLoading: false,
    searchLoadingMore: false,
    searchHasMore: false,
    searchTotalCount: null,
    searchError: "",
    searchTimer: null,
    searchToken: 0,
    statsById: {},
    userRatingsById: {},
    statsLoadingIds: new Set(),
    userRatingLoadingIds: new Set()
    }
  },
  profileEpisodeRatings: {
    items: [],
    episodeMetaById: {},
    hasMore: false,
    loadedFor: null,
    loading: false,
    loadingMore: false,
    error: ""
  },
  mobileRankingFiltersOpen: false,
  desktopView: readDesktopViewPreference(),
  desktopRankingLayout: readDesktopRankingLayoutPreference(),
  hasExpandedInitialList: false,
  visibleCount: INITIAL_VISIBLE_COUNT,
  mobileRankingTailMode: false,
  autoExpandHandle: null,
  rankingListCache: new Map(),
  rankingListCacheVersion: 0,
  rankingSourceRenderFrame: null,
  rankingSourceRenderToken: 0,
  rankingSourceLastPointerAt: 0,
  mobileRankingBatchLoading: false,
  mobileRankingObserver: null,
  mobileRankingObserverToken: 0,
  mobileRankingSentinel: null,
  podcastDataRefreshTimer: null,
  podcastDataRefreshInProgress: false,
  podcastDataStatus: "idle",
  podcastSimilarityProductStatus: "idle",
  podcastSimilarityProductPromise: null,
  podcastSimilarityMetadataPayload: null,
  podcastSimilarityProductByRecommendationId: {},
  podcastSimilarityRecommendationIdByPodcastKey: {},
  podcastSimilarityPodcastByRecommendationId: {},
  podcastSimilarityWarningShown: false,
  communityStatsStatus: "idle",
  lastSuccessfulPodcastDataRefreshAt: 0,
  exploreUnderratedHourBucket: null,
  homeHeroHourBucket: null,
  homeHeroRotationTimer: null
};

const elements = {
  genreChips: document.getElementById("genreChips"),
  viewportMeta: document.getElementById("viewportMeta"),
  viewModeToggle: document.getElementById("viewModeToggle"),
  desktopHeaderSearch: document.getElementById("desktopHeaderSearch"),
  desktopHeaderSearchInput: document.getElementById("desktopHeaderSearchInput"),
  desktopHeaderSearchResults: document.getElementById("desktopHeaderSearchResults"),
  mobileHeaderSearchButton: document.getElementById("mobileHeaderSearchButton"),
  mobileHeaderSearchClose: document.getElementById("mobileHeaderSearchClose"),
  desktopUserButton: document.getElementById("desktopUserButton"),
  desktopUserMenu: document.getElementById("desktopUserMenu"),
  desktopUserProfileLink: document.getElementById("desktopUserProfileLink"),
  desktopUserLogoutButton: document.getElementById("desktopUserLogoutButton"),
  desktopUserAvatar: document.getElementById("desktopUserAvatar"),
  desktopUserLabel: document.getElementById("desktopUserLabel"),
  desktopUserMeta: document.getElementById("desktopUserMeta"),
  searchInput: document.getElementById("searchInput"),
  searchClearButton: document.getElementById("searchClearButton"),
  sortToggle: document.getElementById("sortToggle"),
  mobileSortToggle: document.getElementById("mobileSortToggle"),
  rankingSourceButtons: document.querySelectorAll("[data-ranking-source]"),
  rankingSourceToggle: document.querySelector(".ranking-source-toggle"),
  rankingUserSortField: document.querySelector("[data-ranking-user-sort-field]"),
  rankingUserSortButtons: document.querySelectorAll("[data-ranking-user-sort]"),
  resultsText: document.getElementById("resultsText"),
  rankingToolbar: document.querySelector(".ranking-toolbar"),
  podcastGrid: document.getElementById("podcastGrid"),
  recentGrid: document.getElementById("recentGrid"),
  recentSummary: document.getElementById("recentSummary"),
  podcastTemplate: document.getElementById("podcastCardTemplate"),
  recentTemplate: document.getElementById("recentCardTemplate"),
  activeFilterBox: document.getElementById("activeFilterBox"),
  activeFilterText: document.getElementById("activeFilterText"),
  activeFilterPill: document.getElementById("activeFilterPill"),
  activeFilterRemoveButton: document.getElementById("activeFilterRemoveButton"),
  clearFilterButton: document.getElementById("clearFilterButton"),
  ratingFilter: document.getElementById("ratingFilter"),
  ratingFilterValue: document.getElementById("ratingFilterValue"),
  rankingFreeOnly: document.getElementById("rankingFreeOnly"),
  rankingLanguageButtons: document.querySelectorAll("[data-ranking-language]"),
  rankingMobileFilterSummary: document.getElementById("rankingMobileFilterSummary"),
  rankingMobileActiveFilterRemove: document.getElementById("rankingMobileActiveFilterRemove"),
  rankingMobileFilterToggle: document.getElementById("rankingMobileFilterToggle"),
  rankingMobileFilterCount: document.getElementById("rankingMobileFilterCount"),
  rankingFilterPanel: document.getElementById("rankingFilterPanel"),
  rankingSearchStrip: document.querySelector(".ranking-search-strip"),
  rankingSidebarColumn: document.querySelector(".ranking-sidebar-column"),
  rankingMainColumn: document.querySelector(".ranking-main-column"),
  featuredPanel: document.getElementById("featuredReviewPanel"),
  featuredImage: document.getElementById("featuredImage"),
  featuredTitle: document.getElementById("featuredTitle"),
  featuredMeta: document.getElementById("featuredMeta"),
  featuredScore: document.getElementById("featuredScore"),
  featuredDate: document.getElementById("featuredDate"),
  featuredText: document.getElementById("featuredText"),
  featuredParams: document.getElementById("featuredParams"),
  featuredDots: document.getElementById("featuredDots"),
  pageIntroPanel: document.getElementById("pageIntroPanel"),
  mobileHomeSearchOverlay: document.getElementById("mobileHomeSearchOverlay"),
  mobileHomeSearchOverlayClose: document.getElementById("mobileHomeSearchOverlayClose"),
  mobileHomeSearchOverlayForm: document.getElementById("mobileHomeSearchOverlayForm"),
  mobileHomeSearchOverlayInput: document.getElementById("mobileHomeSearchOverlayInput"),
  mobileHomeSearchOverlayResults: document.getElementById("mobileHomeSearchOverlayResults"),
  pageLinks: document.querySelectorAll("[data-page-link]"),
  authPanel: document.getElementById("authPanel"),
  authLoggedOut: document.getElementById("authLoggedOut"),
  authLoggedIn: document.getElementById("authLoggedIn"),
  openSignupButton: document.getElementById("openSignupButton"),
  openLoginButton: document.getElementById("openLoginButton"),
  authDialog: document.getElementById("authDialog"),
  authDialogTitle: document.getElementById("authDialogTitle"),
  authDialogCloseButton: document.getElementById("authDialogCloseButton"),
  authEmail: document.getElementById("authEmail"),
  authPassword: document.getElementById("authPassword"),
  authPersistenceField: document.getElementById("authPersistenceField"),
  authRememberLogin: document.getElementById("authRememberLogin"),
  toggleAuthPasswordButton: document.getElementById("toggleAuthPasswordButton"),
  forgotPasswordButton: document.getElementById("forgotPasswordButton"),
  passwordRecoveryDialog: document.getElementById("passwordRecoveryDialog"),
  passwordRecoveryCloseButton: document.getElementById("passwordRecoveryCloseButton"),
  passwordRecoveryForm: document.getElementById("passwordRecoveryForm"),
  passwordRecoveryPassword: document.getElementById("passwordRecoveryPassword"),
  passwordRecoveryPasswordRepeat: document.getElementById("passwordRecoveryPasswordRepeat"),
  toggleRecoveryPassword: document.getElementById("toggleRecoveryPassword"),
  toggleRecoveryPasswordRepeat: document.getElementById("toggleRecoveryPasswordRepeat"),
  passwordRecoverySaveButton: document.getElementById("passwordRecoverySaveButton"),
  passwordRecoveryMessage: document.getElementById("passwordRecoveryMessage"),
  authUserEmail: document.getElementById("authUserEmail"),
  savedPodcastCount: document.getElementById("savedPodcastCount"),
  savedFilterButton: document.getElementById("savedFilterButton"),
  authMessage: document.getElementById("authMessage"),
  authDialogMessage: document.getElementById("authDialogMessage"),
  signupButton: document.getElementById("signupButton"),
  loginButton: document.getElementById("loginButton"),
  logoutButton: document.getElementById("logoutButton"),
  ratingDialog: document.getElementById("ratingDialog"),
  ratingDialogTitle: document.getElementById("ratingDialogTitle"),
  ratingDialogMeta: document.getElementById("ratingDialogMeta"),
  ratingInput: document.getElementById("ratingInput"),
  ratingDialogMessage: document.getElementById("ratingDialogMessage"),
  ratingSaveButton: document.getElementById("ratingSaveButton"),
  ratingCancelButton: document.getElementById("ratingCancelButton"),
  ratingDeleteButton: document.getElementById("ratingDeleteButton"),
  ratingCloseButton: document.getElementById("ratingCloseButton"),
  loadMoreWrap: null,
  loadMoreButton: null
};

const headerSearchState = {
  matches: [],
  activeIndex: -1
};

const homeSearchState = {
  matches: [],
  activeIndex: -1,
  viewportCleanup: null,
  focusViewportHeight: 0
};

const mobileHomeSearchOverlayState = {
  matches: [],
  activeIndex: -1,
  viewportCleanup: null,
  viewportFrame: 0
};

function applyViewModePreference() {
  const desktopView = Boolean(state.desktopView);

  document.documentElement.classList.toggle("force-desktop-view", desktopView);
  document.body.classList.toggle("force-desktop-view", desktopView);

  if (elements.viewportMeta) {
    elements.viewportMeta.setAttribute(
      "content",
      desktopView ? "width=1180, initial-scale=1.0" : "width=device-width, initial-scale=1.0"
    );
  }

  if (elements.viewModeToggle) {
    elements.viewModeToggle.setAttribute("aria-pressed", desktopView ? "true" : "false");
    elements.viewModeToggle.textContent = desktopView ? "Mobil-visning" : "PC-visning";
  }
}

function toggleViewMode() {
  state.desktopView = !state.desktopView;
  persistDesktopViewPreference(state.desktopView);
  applyViewModePreference();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeComparable(value) {
  return normalizeText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/\s+/g, " ")
    .trim();
}

function getComparableHostParts(value) {
  const comparable = normalizeComparable(value)
    .replace(/\b(m\.?\s*fl\.?|med flere)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!comparable) return [];

  return Array.from(
    new Set(
      [comparable]
        .concat(comparable.split(/\s+(?:og|med)\s+|[,/;|]+/))
        .map((part) => part.trim())
        .filter((part) => part.length >= 4)
    )
  );
}

function hostsMatchComparable(left, right) {
  const leftComparable = normalizeComparable(left);
  const rightComparable = normalizeComparable(right);

  if (!leftComparable || !rightComparable) return false;
  if (leftComparable === rightComparable) return true;

  const shortest = leftComparable.length < rightComparable.length ? leftComparable : rightComparable;
  const longest = leftComparable.length < rightComparable.length ? rightComparable : leftComparable;

  if (shortest.length >= 6 && longest.includes(shortest)) return true;

  return getComparableHostParts(leftComparable).some((leftPart) =>
    getComparableHostParts(rightComparable).some(
      (rightPart) =>
        leftPart === rightPart ||
        (leftPart.length >= 6 && rightPart.includes(leftPart)) ||
        (rightPart.length >= 6 && leftPart.includes(rightPart))
    )
  );
}

function normalizeMatchKey(value) {
  return normalizeComparable(value)
    .replace(/[^a-z0-9\u00e6\u00f8\u00e5 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCatalogueIdentityPart(value) {
  return normalizeText(value)
    .toLocaleLowerCase("da-DK")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function createCatalogueId({ title, host, publisher, link, feedUrl }) {
  const identity = [title, host, publisher, link, feedUrl]
    .map(normalizeCatalogueIdentityPart)
    .join("|");
  return `catalogue-v1-${hashStringToEightHex(identity)}`;
}

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/æ/g, "xdanishaeqx")
    .replace(/ø/g, "xdanishoeqx")
    .replace(/å/g, "xdanishaaqx")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/xdanishaeqx/g, "æ")
    .replace(/xdanishoeqx/g, "ø")
    .replace(/xdanishaaqx/g, "å")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9\u00e6\u00f8\u00e5 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchVariants(value) {
  const native = normalizeSearchValue(value);
  if (!native) return [];

  const transliterated = native
    .replace(/æ/g, "ae")
    .replace(/ø/g, "oe")
    .replace(/å/g, "aa");
  const simplified = native
    .replace(/[æå]/g, "a")
    .replace(/ø/g, "o");

  return [...new Set([native, transliterated, simplified])].map((readable) => ({
    readable,
    compact: readable.replace(/\s+/g, "")
  }));
}

function searchVariantsMatch(queryVariants, fieldVariants) {
  return queryVariants.some((query) =>
    fieldVariants.some(
      (field) =>
        field.compact.includes(query.compact) ||
        query.readable.split(" ").every((part) => field.readable.includes(part))
    )
  );
}

function getHeaderSearchMatches(rawQuery) {
  const query = normalizeSearchValue(rawQuery);
  if (query.length < 2) return [];

  const queryVariants = normalizeSearchVariants(rawQuery);

  return state.podcasts
    .map((podcast) => {
      const fields = {
        title: normalizeSearchVariants(podcast.title),
        host: normalizeSearchVariants(podcast.host),
        mainSeries: normalizeSearchVariants(podcast.mainSeries),
        publisher: normalizeSearchVariants(podcast.publisher),
        genre: normalizeSearchVariants(podcast.genre),
        secondaryGenre: normalizeSearchVariants(podcast.secondaryGenre)
      };
      const titleNative = normalizeSearchValue(podcast.title);
      const matchesField = (field) => searchVariantsMatch(queryVariants, field);
      const matchesAnyField = Object.values(fields).some(matchesField);

      if (!matchesAnyField) return null;

      let score = 0;
      let matchLabel = "";

      if (titleNative === query) {
        score = 600;
        matchLabel = "Titel";
      } else if (titleNative.startsWith(query)) {
        score = 500;
        matchLabel = "Titel";
      } else if (titleNative.includes(query)) {
        score = 400;
        matchLabel = "Titel";
      } else if (matchesField(fields.title)) {
        score = 350;
        matchLabel = "Titel";
      } else if (matchesField(fields.host)) {
        score = 300;
        matchLabel = "Vært";
      } else if (matchesField(fields.mainSeries)) {
        score = 250;
        matchLabel = "Hovedserie";
      } else if (matchesField(fields.publisher)) {
        score = 200;
        matchLabel = "Udgiver";
      } else if (
        matchesField(fields.genre) ||
        matchesField(fields.secondaryGenre)
      ) {
        score = 150;
        matchLabel = "Genre";
      } else {
        return null;
      }

      return { podcast, score, matchLabel };
    })
    .filter(Boolean)
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.podcast.title || "").localeCompare(String(right.podcast.title || ""), "da")
    )
    .slice(0, 8);
}

function setHeaderSearchActiveIndex(index) {
  const { matches } = headerSearchState;
  if (!matches.length) return;

  const nextIndex = (index + matches.length) % matches.length;
  headerSearchState.activeIndex = nextIndex;
  const options = elements.desktopHeaderSearchResults?.querySelectorAll("[data-header-search-index]") || [];

  options.forEach((option, optionIndex) => {
    const isActive = optionIndex === nextIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });

  elements.desktopHeaderSearchInput?.setAttribute(
    "aria-activedescendant",
    `desktopHeaderSearchResult-${nextIndex}`
  );
}

function closeHeaderPodcastSearch({ clearInput = false, closeMobile = false } = {}) {
  headerSearchState.matches = [];
  headerSearchState.activeIndex = -1;
  elements.desktopHeaderSearchResults?.classList.add("is-hidden");
  elements.desktopHeaderSearchResults?.replaceChildren();
  elements.desktopHeaderSearchInput?.setAttribute("aria-expanded", "false");
  elements.desktopHeaderSearchInput?.removeAttribute("aria-activedescendant");

  if (clearInput && elements.desktopHeaderSearchInput) {
    elements.desktopHeaderSearchInput.value = "";
  }

  if (closeMobile) {
    elements.desktopHeaderSearch?.classList.remove("is-mobile-open");
    elements.mobileHeaderSearchButton?.setAttribute("aria-expanded", "false");
  }
}

function renderHeaderSearchResults() {
  const input = elements.desktopHeaderSearchInput;
  const results = elements.desktopHeaderSearchResults;
  if (!input || !results) return;

  const query = input.value.trim();
  if (normalizeSearchValue(query).length < 2) {
    closeHeaderPodcastSearch();
    return;
  }

  const matches = getHeaderSearchMatches(query);
  headerSearchState.matches = matches;
  headerSearchState.activeIndex = -1;

  if (!matches.length) {
    results.innerHTML = '<p class="desktop-header-search__empty" role="status">Ingen podcasts matcher din søgning.</p>';
  } else {
    results.innerHTML = matches
      .map(({ podcast, matchLabel }, index) => {
        const metadata = [podcast.host, podcast.publisher, podcast.genre].filter(Boolean).join(" · ");
        return `
          <button
            id="desktopHeaderSearchResult-${index}"
            class="desktop-header-search__result"
            type="button"
            role="option"
            aria-selected="false"
            data-header-search-index="${index}"
          >
            <span class="desktop-header-search__cover">
              <img alt="" />
              <span class="image-placeholder" hidden aria-hidden="true"></span>
            </span>
            <span class="desktop-header-search__copy">
              <strong>${escapeHtml(podcast.title)}${getPodcastAccessIndicatorMarkup(podcast)}</strong>
              <span>${escapeHtml(metadata || matchLabel)}</span>
            </span>
            <span class="desktop-header-search__match">${escapeHtml(matchLabel)}</span>
          </button>
        `;
      })
      .join("");

    results.querySelectorAll(".desktop-header-search__cover").forEach((cover, index) => {
      const podcast = matches[index]?.podcast;
      setImage(cover, getPodcastImageSources(podcast), podcast?.title || "Podcastcover");
    });
  }

  results.classList.remove("is-hidden");
  input.setAttribute("aria-expanded", "true");
}

function openHeaderSearchResult(index) {
  const match = headerSearchState.matches[index];
  if (!match) return;

  const navigationKeys = headerSearchState.matches
    .map(({ podcast }) => getPodcastKey(podcast))
    .filter(Boolean);
  closeHeaderPodcastSearch({ clearInput: true, closeMobile: true });
  openPodcastDetailSheet(match.podcast, elements.desktopHeaderSearchInput, {
    allowDesktop: true,
    navigationKeys: isMobileViewport() ? navigationKeys : null
  });
}

function getHomeSearchElements() {
  const container = elements.pageIntroPanel;
  return {
    form: container?.querySelector("[data-home-podcast-search]"),
    input: container?.querySelector("[data-home-podcast-search-input]"),
    results: container?.querySelector("[data-home-podcast-search-results]")
  };
}

function deactivateHomePodcastSearchFocus() {
  homeSearchState.viewportCleanup?.();
  homeSearchState.viewportCleanup = null;
  homeSearchState.focusViewportHeight = 0;
  document.body.classList.remove("has-home-search-focus", "has-home-search-keyboard");

  const { form } = getHomeSearchElements();
  form?.classList.remove("is-focused");
  form?.style.removeProperty("--home-search-results-height");
  form?.style.removeProperty("--home-search-viewport-top");
}

function activateHomePodcastSearchFocus() {
  if (!isMobileViewport()) return;

  const { form } = getHomeSearchElements();
  if (!form) return;

  deactivateHomePodcastSearchFocus();
  form.classList.add("is-focused");
  document.body.classList.add("has-home-search-focus");
  homeSearchState.focusViewportHeight = window.visualViewport?.height || window.innerHeight;

  const updateViewport = () => {
    const viewport = window.visualViewport;
    const viewportHeight = viewport?.height || window.innerHeight;
    const viewportTop = Math.max(0, viewport?.offsetTop || 0);
    const referenceHeight = Math.max(
      homeSearchState.focusViewportHeight,
      window.innerHeight,
      document.documentElement.clientHeight
    );
    const keyboardOpen = Boolean(
      viewport && viewport.height < referenceHeight - 120
    );
    const bottomClearance = keyboardOpen ? 12 : 88;
    form.style.setProperty("--home-search-viewport-top", `${Math.round(viewportTop + 12)}px`);
    const formBottom = form.getBoundingClientRect().bottom;
    const visibleBottom = viewportTop + viewportHeight;
    const resultsHeight = Math.max(
      120,
      Math.floor(visibleBottom - formBottom - bottomClearance - 7)
    );

    form.style.setProperty("--home-search-results-height", `${resultsHeight}px`);
    document.body.classList.toggle("has-home-search-keyboard", keyboardOpen);
  };

  updateViewport();
  window.requestAnimationFrame(updateViewport);
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);
  homeSearchState.viewportCleanup = () => {
    window.visualViewport?.removeEventListener("resize", updateViewport);
    window.visualViewport?.removeEventListener("scroll", updateViewport);
  };
}

function closeHomePodcastSearch({ clearInput = false, exitFocus = false } = {}) {
  const { input, results } = getHomeSearchElements();
  homeSearchState.matches = [];
  homeSearchState.activeIndex = -1;
  results?.classList.add("is-hidden");
  results?.replaceChildren();
  input?.setAttribute("aria-expanded", "false");
  input?.removeAttribute("aria-activedescendant");
  if (clearInput && input) input.value = "";
  if (exitFocus) deactivateHomePodcastSearchFocus();
}

function setHomeSearchActiveIndex(index) {
  const { input, results } = getHomeSearchElements();
  if (!homeSearchState.matches.length || !results) return;
  const nextIndex = (index + homeSearchState.matches.length) % homeSearchState.matches.length;
  homeSearchState.activeIndex = nextIndex;
  results.querySelectorAll("[data-home-search-index]").forEach((option, optionIndex) => {
    const isActive = optionIndex === nextIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });
  input?.setAttribute("aria-activedescendant", `homePodcastSearchResult-${nextIndex}`);
}

function renderHomePodcastSearchResults({ exitFocusOnEmpty = false } = {}) {
  const { input, results } = getHomeSearchElements();
  if (!input || !results) return;
  const query = input.value.trim();
  if (normalizeSearchValue(query).length < 2) {
    closeHomePodcastSearch({ exitFocus: exitFocusOnEmpty && query.length === 0 });
    return;
  }
  const matches = getHeaderSearchMatches(query);
  homeSearchState.matches = matches;
  homeSearchState.activeIndex = -1;
  if (!matches.length) {
    results.innerHTML = '<p class="home-podcast-search__empty" role="status">Ingen podcasts matcher din søgning.</p>';
  } else {
    results.innerHTML = matches.map(({ podcast, matchLabel }, index) => {
      const metadata = [podcast.host, podcast.publisher, podcast.genre].filter(Boolean).join(" · ");
      return `
        <button id="homePodcastSearchResult-${index}" class="home-podcast-search__result" type="button" role="option" aria-selected="false" data-home-search-index="${index}">
          <span class="home-podcast-search__cover"><img alt="" /></span>
          <span class="home-podcast-search__copy"><strong>${escapeHtml(podcast.title)}${getPodcastAccessIndicatorMarkup(podcast)}</strong><span>${escapeHtml(metadata || matchLabel)}</span></span>
          <span class="home-podcast-search__match">${escapeHtml(matchLabel)}</span>
        </button>`;
    }).join("");
    results.querySelectorAll(".home-podcast-search__cover").forEach((cover, index) => {
      const podcast = matches[index]?.podcast;
      setImage(cover, getPodcastImageSources(podcast), podcast?.title || "Podcastcover");
    });
  }
  results.classList.remove("is-hidden");
  input.setAttribute("aria-expanded", "true");
}

function openHomePodcastSearchResult(index) {
  const match = homeSearchState.matches[index];
  if (!match) return;
  const navigationKeys = homeSearchState.matches.map(({ podcast }) => getPodcastKey(podcast)).filter(Boolean);
  const { input } = getHomeSearchElements();
  closeHomePodcastSearch({ clearInput: true, exitFocus: true });
  openPodcastDetailSheet(match.podcast, input, {
    allowDesktop: true,
    navigationKeys: isMobileViewport() ? navigationKeys : null
  });
}

function bindHomePodcastSearch() {
  const { form, input, results } = getHomeSearchElements();
  if (!form || !input || !results) return;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (homeSearchState.matches.length) openHomePodcastSearchResult(homeSearchState.activeIndex >= 0 ? homeSearchState.activeIndex : 0);
  });
  input.addEventListener("pointerdown", (event) => {
    if (!isMobileViewport()) return;
    event.preventDefault();
    openMobileHomeSearchOverlay();
  });
  input.addEventListener("input", () => renderHomePodcastSearchResults({ exitFocusOnEmpty: true }));
  input.addEventListener("focus", () => {
    if (isMobileViewport()) {
      openMobileHomeSearchOverlay();
      return;
    }
    activateHomePodcastSearchFocus();
    renderHomePodcastSearchResults();
  });
  input.addEventListener("blur", () => {
    window.requestAnimationFrame(() => {
      if (!form.contains(document.activeElement)) closeHomePodcastSearch({ exitFocus: true });
    });
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeHomePodcastSearch({ clearInput: true, exitFocus: true });
      return;
    }
    if (!homeSearchState.matches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHomeSearchActiveIndex(homeSearchState.activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHomeSearchActiveIndex(homeSearchState.activeIndex < 0 ? homeSearchState.matches.length - 1 : homeSearchState.activeIndex - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      openHomePodcastSearchResult(homeSearchState.activeIndex >= 0 ? homeSearchState.activeIndex : 0);
    }
  });
  results.addEventListener("click", (event) => {
    const result = event.target.closest("[data-home-search-index]");
    if (result) openHomePodcastSearchResult(Number(result.dataset.homeSearchIndex));
  });
}

function clearMobileHomeSearchOverlayResults({ clearInput = false } = {}) {
  const { mobileHomeSearchOverlayInput: input, mobileHomeSearchOverlayResults: results } = elements;
  mobileHomeSearchOverlayState.matches = [];
  mobileHomeSearchOverlayState.activeIndex = -1;
  results?.replaceChildren();
  input?.setAttribute("aria-expanded", "false");
  input?.removeAttribute("aria-activedescendant");
  if (clearInput && input) input.value = "";
}

function scheduleMobileHomeSearchOverlayGeometry() {
  if (!document.body.classList.contains("mobile-home-search-overlay-open")) return;
  if (mobileHomeSearchOverlayState.viewportFrame) return;

  mobileHomeSearchOverlayState.viewportFrame = window.requestAnimationFrame(() => {
    mobileHomeSearchOverlayState.viewportFrame = 0;
    const { mobileHomeSearchOverlay: overlay } = elements;
    if (!overlay || overlay.hidden) return;

    const viewport = window.visualViewport;
    const top = Math.max(0, viewport?.offsetTop || 0);
    const height = Math.max(0, viewport?.height || window.innerHeight);
    overlay.style.setProperty("--mobile-search-overlay-top", `${Math.round(top)}px`);
    overlay.style.setProperty("--mobile-search-overlay-height", `${Math.floor(height)}px`);
  });
}

function closeMobileHomeSearchOverlay({ clearInput = true } = {}) {
  const {
    mobileHomeSearchOverlay: overlay,
    mobileHomeSearchOverlayInput: input
  } = elements;
  if (!overlay) return;

  mobileHomeSearchOverlayState.viewportCleanup?.();
  mobileHomeSearchOverlayState.viewportCleanup = null;
  if (mobileHomeSearchOverlayState.viewportFrame) {
    window.cancelAnimationFrame(mobileHomeSearchOverlayState.viewportFrame);
  }
  mobileHomeSearchOverlayState.viewportFrame = 0;
  clearMobileHomeSearchOverlayResults({ clearInput });
  input?.blur();
  overlay.hidden = true;
  overlay.setAttribute("aria-hidden", "true");
  overlay.style.removeProperty("--mobile-search-overlay-top");
  overlay.style.removeProperty("--mobile-search-overlay-height");
  document.body.classList.remove("mobile-home-search-overlay-open");
}

function openMobileHomeSearchOverlay() {
  if (!isMobileViewport()) return false;

  const {
    mobileHomeSearchOverlay: overlay,
    mobileHomeSearchOverlayInput: input
  } = elements;
  if (!overlay || !input) return false;

  deactivateHomePodcastSearchFocus();
  overlay.hidden = false;
  overlay.setAttribute("aria-hidden", "false");
  document.body.classList.add("mobile-home-search-overlay-open");
  scheduleMobileHomeSearchOverlayGeometry();

  if (!mobileHomeSearchOverlayState.viewportCleanup) {
    const updateGeometry = () => scheduleMobileHomeSearchOverlayGeometry();
    window.visualViewport?.addEventListener("resize", updateGeometry);
    window.visualViewport?.addEventListener("scroll", updateGeometry);
    mobileHomeSearchOverlayState.viewportCleanup = () => {
      window.visualViewport?.removeEventListener("resize", updateGeometry);
      window.visualViewport?.removeEventListener("scroll", updateGeometry);
    };
  }

  input.focus({ preventScroll: true });
  return true;
}

function renderMobileHomeSearchOverlayResults() {
  const {
    mobileHomeSearchOverlayInput: input,
    mobileHomeSearchOverlayResults: results
  } = elements;
  if (!input || !results) return;

  const query = input.value.trim();
  if (normalizeSearchValue(query).length < 2) {
    clearMobileHomeSearchOverlayResults();
    scheduleMobileHomeSearchOverlayGeometry();
    return;
  }

  const matches = getHeaderSearchMatches(query);
  mobileHomeSearchOverlayState.matches = matches;
  mobileHomeSearchOverlayState.activeIndex = -1;
  if (!matches.length) {
    results.innerHTML = '<p class="mobile-home-search-overlay__empty" role="status">Ingen podcasts matcher din søgning.</p>';
  } else {
    results.innerHTML = matches.map(({ podcast, matchLabel }, index) => {
      const metadata = [podcast.host, podcast.publisher, podcast.genre].filter(Boolean).join(" · ");
      return `
        <button id="mobileHomeSearchOverlayResult-${index}" class="mobile-home-search-overlay__result" type="button" role="option" aria-selected="false" data-mobile-home-search-index="${index}">
          <span class="mobile-home-search-overlay__cover"><img alt="" /></span>
          <span class="mobile-home-search-overlay__copy"><strong>${escapeHtml(podcast.title)}${getPodcastAccessIndicatorMarkup(podcast)}</strong><span>${escapeHtml(metadata || matchLabel)}</span></span>
          <span class="mobile-home-search-overlay__match">${escapeHtml(matchLabel)}</span>
        </button>`;
    }).join("");
    results.querySelectorAll(".mobile-home-search-overlay__cover").forEach((cover, index) => {
      const podcast = matches[index]?.podcast;
      setImage(cover, getPodcastImageSources(podcast), podcast?.title || "Podcastcover");
    });
  }

  input.setAttribute("aria-expanded", "true");
  scheduleMobileHomeSearchOverlayGeometry();
}

function setMobileHomeSearchOverlayActiveIndex(index) {
  const { mobileHomeSearchOverlayInput: input, mobileHomeSearchOverlayResults: results } = elements;
  if (!mobileHomeSearchOverlayState.matches.length || !results) return;

  const nextIndex = (index + mobileHomeSearchOverlayState.matches.length) % mobileHomeSearchOverlayState.matches.length;
  mobileHomeSearchOverlayState.activeIndex = nextIndex;
  results.querySelectorAll("[data-mobile-home-search-index]").forEach((option, optionIndex) => {
    const isActive = optionIndex === nextIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });
  input?.setAttribute("aria-activedescendant", `mobileHomeSearchOverlayResult-${nextIndex}`);
}

function openMobileHomeSearchOverlayResult(index) {
  const match = mobileHomeSearchOverlayState.matches[index];
  if (!match) return;

  const navigationKeys = mobileHomeSearchOverlayState.matches
    .map(({ podcast }) => getPodcastKey(podcast))
    .filter(Boolean);
  const { input: returnFocus } = getHomeSearchElements();
  closeMobileHomeSearchOverlay();
  openPodcastDetailSheet(match.podcast, returnFocus, {
    allowDesktop: true,
    navigationKeys
  });
}

function bindMobileHomeSearchOverlay() {
  const {
    mobileHomeSearchOverlay: overlay,
    mobileHomeSearchOverlayClose: closeButton,
    mobileHomeSearchOverlayForm: form,
    mobileHomeSearchOverlayInput: input,
    mobileHomeSearchOverlayResults: results
  } = elements;
  if (!overlay || !closeButton || !form || !input || !results) return;

  closeButton.addEventListener("click", () => closeMobileHomeSearchOverlay());
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (mobileHomeSearchOverlayState.matches.length) {
      openMobileHomeSearchOverlayResult(
        mobileHomeSearchOverlayState.activeIndex >= 0 ? mobileHomeSearchOverlayState.activeIndex : 0
      );
    }
  });
  input.addEventListener("input", renderMobileHomeSearchOverlayResults);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMobileHomeSearchOverlay();
      return;
    }
    if (!mobileHomeSearchOverlayState.matches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setMobileHomeSearchOverlayActiveIndex(mobileHomeSearchOverlayState.activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setMobileHomeSearchOverlayActiveIndex(
        mobileHomeSearchOverlayState.activeIndex < 0
          ? mobileHomeSearchOverlayState.matches.length - 1
          : mobileHomeSearchOverlayState.activeIndex - 1
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      openMobileHomeSearchOverlayResult(
        mobileHomeSearchOverlayState.activeIndex >= 0 ? mobileHomeSearchOverlayState.activeIndex : 0
      );
    }
  });
  results.addEventListener("click", (event) => {
    const result = event.target.closest("[data-mobile-home-search-index]");
    if (result) openMobileHomeSearchOverlayResult(Number(result.dataset.mobileHomeSearchIndex));
  });
}

function compactSearchValue(value) {
  return normalizeSearchValue(value).replace(/\s+/g, "");
}

function expandSearchAliases(value) {
  const normal = normalizeSearchValue(value);
  const compact = compactSearchValue(value);
  const aliases = new Set([normal, compact]);

  const radio24Pattern =
    normal.includes("radio 24 7") ||
    normal.includes("radio 24 syv") ||
    normal.includes("24 7") ||
    normal.includes("24 syv") ||
    compact.includes("radio247") ||
    compact.includes("radio24syv") ||
    compact.includes("247") ||
    compact.includes("24syv");

  if (radio24Pattern) {
    [
      "radio24syv",
      "radio 24 syv",
      "radio 24 7",
      "radio247",
      "24syv",
      "24 syv",
      "24 7",
      "247"
    ].forEach((alias) => aliases.add(alias));
  }

  const radio4Pattern =
    normal.includes("radio 4") ||
    normal.includes("radio fire") ||
    normal.includes("radio iiii") ||
    normal.includes("radio llll") ||
    compact.includes("radio4") ||
    compact.includes("radioiiii") ||
    compact.includes("radiollll");

  if (radio4Pattern) {
    [
      "radio 4",
      "radio4",
      "radio fire",
      "radio iiii",
      "radioiiii",
      "radio llll",
      "radiollll",
      "r4dio"
    ].forEach((alias) => aliases.add(alias));
  }

  return [...aliases].filter(Boolean).join(" ");
}

function buildSearchText(parts) {
  return parts
    .flatMap((part) => {
      const value = normalizeText(part);
      if (!value) return [];
      return [value, expandSearchAliases(value)];
    })
    .join(" ")
    .toLowerCase();
}

function getField(row, candidates) {
  const keys = Object.keys(row);
  const normalizedCandidates = candidates.map(normalizeKey);

  for (const key of keys) {
    if (normalizedCandidates.includes(normalizeKey(key))) {
      return normalizeText(row[key]);
    }
  }

  return "";
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const raw = normalizeText(value);
  if (!raw) return null;

  let cleaned = raw.replace(/[^\d,.\-]/g, "");

  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  }

  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : null;
}

function formatRating(value) {
  const rating = parseNumber(value);
  if (rating === null) return "Ikke vurderet";
  return `${rating.toFixed(1).replace(".", ",")} / 10`;
}

function formatCompactRating(value) {
  const rating = parseNumber(value);
  if (rating === null) return "";
  return rating.toFixed(1).replace(".", ",");
}

function parseRatingInputValue(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  if (/^[\d]+$/.test(raw)) {
    if (raw === "10" || raw === "100") {
      return 10;
    }

    if (raw.length === 1) {
      return parseNumber(raw);
    }

    if (raw.length <= 3) {
      return Number(raw) / 10;
    }
  }

  return parseNumber(raw.replace(/\./g, ","));
}

function formatRatingInputValue(value) {
  const rating = parseRatingInputValue(value);
  if (rating === null || rating < 0 || rating > 10) {
    return normalizeText(value);
  }

  return rating.toFixed(1).replace(".", ",");
}

function normalizeRatingInputField({ force = false } = {}) {
  if (!elements.ratingInput) return;

  const raw = normalizeText(elements.ratingInput.value);
  if (!raw) return;

  const digitsOnly = /^[\d]+$/.test(raw);
  const shouldFormatNow =
    force ||
    raw === "10" ||
    raw === "100" ||
    (digitsOnly && raw.length >= 2) ||
    /[,.]/.test(raw);

  if (!shouldFormatNow) return;

  const formatted = formatRatingInputValue(raw);

  if (formatted && formatted !== raw) {
    elements.ratingInput.value = formatted;
  }
}

function parsePlacement(value) {
  const number = parseNumber(value);
  return number === null ? null : number;
}

function parseDate(value) {
  const raw = normalizeText(value);
  if (!raw) return null;

  const parts = raw.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{2,4})$/);

  if (parts) {
    const day = Number(parts[1]);
    const month = Number(parts[2]) - 1;
    const year = Number(parts[3].length === 2 ? `20${parts[3]}` : parts[3]);
    const date = new Date(year, month, day);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  const fallback = new Date(raw);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function formatDate(value) {
  const date = parseDate(value);
  if (!date) return "";

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function formatSavedDateLabel(value) {
  const formatted = formatDate(value);
  return formatted ? `Gemt ${formatted}` : "Gemt tidligere";
}

function formatFeaturedDate(value) {
  const formatted = formatDate(value);
  return formatted ? `Anmeldt ${formatted}` : "";
}

function normalizeGenre(value) {
  const raw = normalizeComparable(value);

  if (!raw) return "Dokumentar";

  if (
    raw.includes("true") ||
    raw.includes("crime") ||
    raw.includes("krimi") ||
    raw.includes("mord") ||
    raw.includes("forbryd") ||
    raw.includes("svindel")
  ) {
    return "True Crime";
  }

  if (raw.includes("historie") || raw.includes("historisk") || raw.includes("krig")) {
    return "Historie";
  }

  if (
    raw.includes("sport") ||
    raw.includes("fodbold") ||
    raw.includes("superliga") ||
    raw.includes("cykling") ||
    raw.includes("cykel")
  ) {
    return "Sport";
  }

  if (
    raw.includes("viden") ||
    raw.includes("science") ||
    raw.includes("forskning") ||
    raw.includes("videnskab")
  ) {
    return "Viden";
  }

  if (raw.includes("sladder") || raw.includes("gossip")) {
    return "Sladder";
  }

  if (
    raw.includes("samfund") ||
    raw.includes("politik") ||
    raw.includes("nyhed") ||
    raw.includes("debat") ||
    raw.includes("aktualitet") ||
    raw.includes("krise") ||
    raw.includes("erhverv") ||
    raw.includes("mediemagasin") ||
    raw.includes("sundhed") ||
    raw.includes("kultur")
  ) {
    return "Samfund";
  }

  if (
    raw.includes("underholdning") ||
    raw.includes("komedie") ||
    raw.includes("humor") ||
    raw.includes("comedy") ||
    raw.includes("snakke") ||
    raw.includes("snak") ||
    raw.includes("k\u00e6rlighed") ||
    raw.includes("dating")
  ) {
    return "Underholdning";
  }

  return "Dokumentar";
}

function normalizePublisher(value) {
  const original = normalizeText(value);
  if (!original) return "";

  const raw = normalizeComparable(original)
    .replace(/\./g, "")
    .replace(/\s*\/\s*/g, "/");

  const compact = raw.replace(/\s+/g, "");

  if (compact === "bolddk" || raw === "bold" || raw === "bold dk") {
    return "Bold";
  }

  if (raw === "eb" || raw === "eb+" || raw === "ekstrabladet" || raw === "ekstra bladet") {
    return "Ekstra Bladet";
  }

  if (raw === "radio llll" || raw === "radio iiii" || raw === "radio4") {
    return "RADIO IIII";
  }

  if (raw === "r8dio") return "r8dio";
  if (compact === "radio24syv" || compact === "radio24/7") return "Radio24syv";
  if (compact === "24syv" || compact === "24/syv") return "24syv";
  if (raw === "dr" || raw === "dr lyd" || raw === "p1") return "DR";
  if (raw === "podimo" || raw === "podimo/tv2") return "Podimo";
  if (raw === "third ear") return "Third Ear";
  if (raw === "third ear/zetland") return "Third Ear / Zetland";
  if (raw === "bt") return "BT";
  if (raw === "frihedsbrevet") return "Frihedsbrevet";
  if (raw === "mediano") return "Mediano";

  return original;
}

function extractUrl(value) {
  const text = normalizeText(value);
  if (!text) return "";

  const imageFormula = text.match(/=IMAGE\("([^"]+)"\)/i);
  if (imageFormula) return imageFormula[1];

  const hyperlinkFormula = text.match(/=HYPERLINK\("([^"]+)"/i);
  if (hyperlinkFormula) return hyperlinkFormula[1];

  const quotedUrl = text.match(/"(https?:\/\/[^"]+)"/i);
  if (quotedUrl) return quotedUrl[1];

  const url = text.match(/https?:\/\/[^\s",)]+/i);
  if (url) return url[0];

  return text;
}

function normalizeCoverManifestEntries(payload) {
  const entries = Array.isArray(payload?.podcasts)
    ? payload.podcasts
    : Array.isArray(payload?.entries)
      ? payload.entries
      : [];
  const podcastIdCandidates = new Map();
  const signatureCandidates = new Map();
  const legacyKeyCandidates = new Map();

  const addCandidate = (candidates, key, entry) => {
    if (!key) return;
    if (!candidates.has(key)) candidates.set(key, []);
    const matches = candidates.get(key);
    if (!matches.includes(entry)) matches.push(entry);
  };

  const uniqueEntries = (candidates) => {
    const lookup = {};
    candidates.forEach((matches, key) => {
      if (matches.length === 1) lookup[key] = matches[0];
    });
    return lookup;
  };

  entries.forEach((entry) => {
    const podcastId = normalizeText(entry?.podcastId || entry?.["Podcast-ID"]);
    const signature = getCoverManifestSignature(entry);
    const keys = [
      entry?.podcastKey,
      entry?.matchKey,
      entry?.titleKey,
      entry?.title
    ]
      .map(normalizeMatchKey)
      .filter(Boolean);

    addCandidate(podcastIdCandidates, podcastId, entry);
    addCandidate(signatureCandidates, signature, entry);
    keys.forEach((key) => {
      addCandidate(legacyKeyCandidates, key, entry);
    });
  });

  return {
    byPodcastId: uniqueEntries(podcastIdCandidates),
    bySignature: uniqueEntries(signatureCandidates),
    byLegacyKey: uniqueEntries(legacyKeyCandidates)
  };
}

function getCoverManifestSignature(record) {
  const normalizePart = (value) => normalizeMatchKey(value).replace(/\s+/g, "");
  const title = normalizePart(record?.title);
  if (!title) return "";

  return [title, normalizePart(record?.host), normalizePart(record?.publisher)].join("|");
}

function getManifestVariantEntries(entry) {
  const variants = entry?.variants && typeof entry.variants === "object" ? entry.variants : {};
  const seenWidths = new Set();

  return Object.values(variants)
    .map((variant) => ({
      path: normalizeText(variant?.path || variant?.webPath || variant?.src),
      width: Number(variant?.actualWidth || variant?.width || 0),
      height: Number(variant?.actualHeight || variant?.height || 0),
      checksum: normalizeText(variant?.checksum)
    }))
    .filter((variant) => {
      if (!variant.path || variant.width <= 0 || seenWidths.has(variant.width)) return false;
      seenWidths.add(variant.width);
      return true;
    })
    .sort((a, b) => a.width - b.width);
}

function applyLocalCoverManifest(podcasts, manifestLookup) {
  state.coverMetaByPrimarySrc = {};
  const legacyKeyCounts = new Map();

  podcasts.forEach((podcast) => {
    const legacyKey = getLegacyPodcastKey(podcast);
    if (!legacyKey) return;
    legacyKeyCounts.set(legacyKey, (legacyKeyCounts.get(legacyKey) || 0) + 1);
  });

  podcasts.forEach((podcast) => {
    const podcastId = getPodcastId(podcast);
    const legacyKey = getLegacyPodcastKey(podcast);
    const entry =
      manifestLookup?.byPodcastId?.[podcastId] ||
      manifestLookup?.bySignature?.[getCoverManifestSignature(podcast)] ||
      (legacyKeyCounts.get(legacyKey) === 1
        ? manifestLookup?.byLegacyKey?.[legacyKey]
        : null);
    const variants = getManifestVariantEntries(entry);

    podcast.localCoverVariants = variants;
    podcast.needsCoverPlaceholder = Boolean(entry?.needsPlaceholder || entry?.needs_placeholder);
    podcast.coverQualityCategory = normalizeText(
      entry?.qualityCategory || entry?.quality_category || entry?.category
    );

    if (!variants.length) return;

    const primary = variants[0].path;
    state.coverMetaByPrimarySrc[primary] = {
      variants,
      externalSources: [
        podcast.image,
        ...(Array.isArray(podcast.imageFallbacks) ? podcast.imageFallbacks : [])
      ]
        .map(normalizeText)
        .filter(Boolean),
      title: podcast.title || ""
    };
  });
}

function getResponsiveCoverMeta(src) {
  return state.coverMetaByPrimarySrc[normalizeText(src)] || null;
}

function getResponsiveImageSizes(img) {
  const container = img?.parentElement;
  if (!container) return "(max-width: 768px) 50vw, (max-width: 1200px) 32vw, 420px";

  if (container.closest(".desktop-ranking-row__cover")) {
    return "(max-width: 768px) 18vw, 72px";
  }

  if (container.closest(".desktop-ranking-top-card .desktop-ranking-cover")) {
    return "(max-width: 768px) 42vw, 220px";
  }

  if (container.closest(".home-recent-card__cover, .home-quick-card__desktop-cover, .home-quick-card__cover")) {
    return "(max-width: 768px) 28vw, 120px";
  }

  if (container.closest(".home-hero, .home-featured, .explore-featured-card, .explore-card--large")) {
    return "(max-width: 768px) 92vw, (max-width: 1200px) 64vw, 720px";
  }

  if (container.closest(".explore-card, .explore-genre-card, .home-recent-card")) {
    return "(max-width: 768px) 82vw, (max-width: 1200px) 42vw, 520px";
  }

  if (container.closest(".saved-card, .profile-podcast-card, .home-popular-card, .podcast-detail-sheet__series-cover")) {
    return "(max-width: 768px) 44vw, (max-width: 1200px) 24vw, 280px";
  }

  return "(max-width: 768px) 50vw, (max-width: 1200px) 32vw, 420px";
}

function clearResponsiveImageAttributes(img) {
  img?.removeAttribute("srcset");
  img?.removeAttribute("sizes");
}

function withLocalCoverRevision(source, revision = "") {
  const normalizedSource = normalizeText(source);
  if (!revision || !normalizedSource.startsWith("data/covers/")) return normalizedSource;
  return `${normalizedSource}${normalizedSource.includes("?") ? "&" : "?"}v=${encodeURIComponent(revision)}`;
}

function applyResponsiveImageAttributes(img, meta, cacheVersion = "") {
  if (!img || !meta?.variants?.length) {
    clearResponsiveImageAttributes(img);
    return;
  }

  const srcset = meta.variants
    .map((variant) => `${withLocalCoverRevision(variant.path, variant.checksum || cacheVersion)} ${variant.width}w`)
    .join(", ");

  if (!srcset) {
    clearResponsiveImageAttributes(img);
    return;
  }

  img.srcset = srcset;
  img.sizes = getResponsiveImageSizes(img);
}

function getPlaceholderInitials(value) {
  const words = normalizeText(value)
    .replace(/[^a-zA-Z0-9æøåÆØÅ ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "P";
  return words.slice(0, 2).map((word) => word.charAt(0).toUpperCase()).join("");
}

function createPodcastPlaceholderSource(title) {
  const safeTitle = normalizeText(title) || "Podcast";
  const initials = getPlaceholderInitials(safeTitle);
  const seed = Array.from(safeTitle).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const accent = ["#ff5c16", "#e85f25", "#d84d16", "#f27a36"][seed % 4];
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" role="img" aria-label="${escapeHtml(safeTitle)}">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#fff8f1"/>
          <stop offset="1" stop-color="#eadfd4"/>
        </linearGradient>
      </defs>
      <rect width="600" height="600" rx="48" fill="url(#bg)"/>
      <circle cx="300" cy="250" r="118" fill="${accent}" opacity="0.96"/>
      <text x="300" y="278" text-anchor="middle" font-family="Arial, sans-serif" font-size="112" font-weight="800" fill="#fff">${initials}</text>
      <text x="300" y="430" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#241b16">Podcastlisten</text>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeImageSource(value) {
  const src = extractUrl(value);
  if (!src) return "";

  if (src.trim().toLowerCase().startsWith("data:image/")) {
    return "";
  }

  try {
    const url = new URL(src, window.location.href);
    const directImageUrl = url.searchParams.get("imgurl");
    if (url.hostname.includes("google.") && directImageUrl) {
      return directImageUrl;
    }
  } catch {
    // Keep the original value when it is a relative path or malformed URL.
  }

  return src;
}

function addImageCandidate(candidates, candidate) {
  if (!candidate || candidates.includes(candidate)) return;
  candidates.push(candidate);
}

function getLocalCoverFallbacks(src) {
  const normalizedSrc = normalizeText(src).replace(/\\/g, "/");
  const alias = LOCAL_COVER_ALIASES[normalizedSrc];
  const match = normalizedSrc.match(/^data\/covers\/(\d+)-(.+)\.([a-z0-9]+)$/i);
  const fallbacks = [];

  if (alias) {
    fallbacks.push(alias);
  }

  if (!match) return fallbacks;

  const currentNumber = Number(match[1]);
  const slug = match[2];
  const extension = match[3].toLowerCase();
  const nearbyOffsets = [-1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6, -7, 7, -8, 8, -9, 9, -10, 10];

  nearbyOffsets.forEach((offset) => {
    const nextNumber = currentNumber + offset;
    if (nextNumber < 1) return;

    const paddedNumber = String(nextNumber).padStart(match[1].length, "0");
    IMAGE_FALLBACK_EXTENSIONS.forEach((fallbackExtension) => {
      if (fallbackExtension !== extension && fallbackExtension !== "jpg" && fallbackExtension !== "png") return;
      fallbacks.push(`data/covers/${paddedNumber}-${slug}.${fallbackExtension}`);
    });
  });

  return fallbacks;
}

function getImageCandidates(image, alt = "") {
  const candidates = [];
  const sources = Array.isArray(image) ? image : [image];
  let responsiveMeta = null;

  sources.forEach((source) => {
    const src = normalizeImageSource(source);
    if (!src) return;

    if (!responsiveMeta) {
      responsiveMeta = getResponsiveCoverMeta(src);
    }

    if (!state.failedImageSources.has(src)) {
      addImageCandidate(candidates, src);
    }

    if (src.startsWith("http://")) {
      const secureSrc = `https://${src.slice("http://".length)}`;
      if (!state.failedImageSources.has(secureSrc)) {
        addImageCandidate(candidates, secureSrc);
      }
    }

    getLocalCoverFallbacks(src).forEach((candidate) => {
      if (!state.failedImageSources.has(candidate)) {
        addImageCandidate(candidates, candidate);
      }
    });

    if (responsiveMeta?.externalSources?.length) {
      responsiveMeta.externalSources.forEach((externalSource) => {
        const normalizedExternal = normalizeImageSource(externalSource);
        if (normalizedExternal && !state.failedImageSources.has(normalizedExternal)) {
          addImageCandidate(candidates, normalizedExternal);
        }
      });
    }
  });

  addImageCandidate(candidates, createPodcastPlaceholderSource(alt));
  candidates.responsiveMeta = responsiveMeta;
  return candidates;
}

function getPodcastImageSources(podcast) {
  if (!podcast) return [];

  const localSources = Array.isArray(podcast.localCoverVariants)
    ? podcast.localCoverVariants.map((variant) => variant.path)
    : [];

  return Array.from(
    new Set(
      [
        ...localSources,
        podcast.image,
        ...(Array.isArray(podcast.imageFallbacks) ? podcast.imageFallbacks : [])
      ]
        .map(normalizeText)
        .filter(Boolean)
    )
  );
}

function getPodcastCoverRevision(podcast) {
  if (!Array.isArray(podcast?.localCoverVariants)) return "";
  return podcast.localCoverVariants.map((variant) => variant.checksum).find(Boolean) || "";
}

function loadImageWithFallback(img, image, alt, { onLoad, onFail, cacheVersion = "" } = {}) {
  if (!img) return;

  const candidates = getImageCandidates(image, alt);
  const responsiveMeta = candidates.responsiveMeta;
  const resolvedCacheVersion =
    cacheVersion || responsiveMeta?.variants?.map((variant) => variant.checksum).find(Boolean) || "";
  let index = 0;
  let activeSrc = "";

  const tryNextCandidate = () => {
    const failedSrc = normalizeText(img.currentSrc || activeSrc);
    if (failedSrc && !failedSrc.startsWith("data:image/svg+xml")) {
      state.failedImageSources.add(failedSrc);
    }

    const nextSrc = candidates[index];
    index += 1;

    if (!nextSrc) {
      clearResponsiveImageAttributes(img);
      img.hidden = true;
      img.removeAttribute("src");
      img.alt = "";
      if (onFail) onFail();
      return;
    }

    const requestSrc = withLocalCoverRevision(nextSrc, resolvedCacheVersion);
    activeSrc = requestSrc;
    img.hidden = false;
    img.alt = alt || "";
    img.loading = img.loading || "lazy";
    img.decoding = "async";
    img.referrerPolicy = nextSrc.startsWith("http") ? "no-referrer" : "";

    if (index === 1 && responsiveMeta) {
      applyResponsiveImageAttributes(img, responsiveMeta, resolvedCacheVersion);
    } else {
      clearResponsiveImageAttributes(img);
    }

    img.src = requestSrc;
  };

  img.onload = () => {
    if (onLoad) onLoad();
  };
  img.onerror = tryNextCandidate;
  tryNextCandidate();
}

const warmedPodcastCoverSources = new Set();
let backgroundRouteWarmupScheduled = false;

function preloadPodcastCoverInBackground(podcast) {
  const source = getPodcastImageSources(podcast)[0] || "";
  const normalizedSource = normalizeImageSource(source);
  if (!normalizedSource || warmedPodcastCoverSources.has(normalizedSource)) return;

  warmedPodcastCoverSources.add(normalizedSource);
  const candidates = getImageCandidates(getPodcastImageSources(podcast), podcast?.title || "");
  if (!candidates.length) return;

  const image = new Image();
  image.decoding = "async";
  image.loading = "eager";
  image.fetchPriority = "low";
  image.referrerPolicy = "no-referrer";
  image.src = withLocalCoverRevision(candidates[0], getPodcastCoverRevision(podcast));

  if (typeof image.decode === "function") {
    image.decode().catch(() => {
      // Et manglende cover håndteres fortsat af den normale fallback-funktion.
    });
  }
}

function getRouteWarmupPodcasts(route) {
  const withImage = (podcasts) => podcasts.filter((podcast) => podcast?.image);

  if (route === "profil") {
    const saved = Array.from(state.savedPodcastKeys)
      .map((key) => state.podcastByKey[key])
      .filter(Boolean);
    const rated = Object.keys(state.userRatingsByKey || {})
      .map((key) => state.podcastByKey[key])
      .filter(Boolean);
    return withImage([...saved, ...rated]);
  }

  if (route === "forside") {
    const hero = getHomeHeroPodcasts(getExploreHourBucket());
    const ranked = getPodcastlistenPlacementPool(1, 30);
    return withImage([...hero, ...ranked]);
  }

  if (route === "ranglister") {
    return withImage(
      [...state.podcasts]
        .sort((a, b) => (a.placement ?? 999999) - (b.placement ?? 999999))
    );
  }

  if (route === "udforsk") {
    return withImage(
      [...state.podcasts].sort((a, b) => {
        const aScore = parseNumber(a.userAverageRating) ?? parseNumber(a.ratingValue) ?? 0;
        const bScore = parseNumber(b.userAverageRating) ?? parseNumber(b.ratingValue) ?? 0;
        return bScore - aScore || (a.placement ?? 999999) - (b.placement ?? 999999);
      })
    );
  }

  return [];
}

function warmRouteAssets(route, { limit = 18 } = {}) {
  if (!state.podcasts.length || !route) return;

  const uniquePodcasts = [];
  const seenSources = new Set();
  getRouteWarmupPodcasts(route).some((podcast) => {
    const source = normalizeImageSource(podcast?.image);
    if (!source || seenSources.has(source)) return false;
    seenSources.add(source);
    uniquePodcasts.push(podcast);
    return uniquePodcasts.length >= limit;
  });

  uniquePodcasts.forEach(preloadPodcastCoverInBackground);
}

function scheduleBackgroundRouteWarmup() {
  if (backgroundRouteWarmupScheduled || !state.podcasts.length) return;
  backgroundRouteWarmupScheduled = true;

  const run = () => {
    backgroundRouteWarmupScheduled = false;
    ["forside", "ranglister", "udforsk", "profil"].forEach((route, index) => {
      window.setTimeout(() => warmRouteAssets(route), index * 90);
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1800 });
  } else {
    window.setTimeout(run, 450);
  }
}

function warmRouteFromNavigationLink(link) {
  const route = normalizeText(link?.dataset?.pageLink);
  if (!route) return;
  warmRouteAssets(route, { limit: 24 });
}

function getCompletenessScore(podcast) {
  let score = 0;
  if (podcast.yearPlayed) score += 100;
  if (podcast.link) score += 60;
  if (podcast.image) score += 50;
  if (podcast.description) score += 40;
  if (podcast.episodes) score += 25;
  if (podcast.publisher) score += 20;
  if (podcast.genre) score += 15;
  if (podcast.host) score += 15;
  if (podcast.ratingDate) score += 10;
  return score;
}

function normalizeEnglishFlag(value) {
  if (value === true) return true;
  if (value === false) return false;
  return normalizeText(value).toLocaleLowerCase("da-DK") === "x";
}

function mapPodcast(row, index) {
  const title = getField(row, ["Titel", "Title"]);
  const host = getField(row, ["V\u00e6rt", "Vaert", "Host", "V\u00e6rter"]);
  const rawRating = getField(row, [
    "Vuring",
    "Vuring (1-10)",
    "Vurdering",
    "Vurdering (1-10)",
    "Vuring/Vurdering",
    "Vuring/Vurdering (1-10)",
    "Rating",
    "Score"
  ]);
  const rawGenre = getField(row, ["Genre"]);
  const rawSecondaryGenre = getField(row, ["secondaryGenre", "Secondary genre", "Sekundærgenre"]);
  const rawPublisher = getField(row, ["Udgiver", "Publisher"]);
  const isEnglish = normalizeEnglishFlag(
    row?.isEnglish ?? getField(row, ["Engelsk"])
  );
  const accessTypeValue = normalizeText(getField(row, ["accessType"])).toLowerCase();
  const accessType = ["free", "partial", "paid", "unknown"].includes(accessTypeValue)
    ? accessTypeValue
    : "";
  const accessEvidenceUrl = normalizeText(getField(row, ["accessEvidenceUrl"]));
  const accessCheckedAt = normalizeText(getField(row, ["accessCheckedAt"]));
  const podcastId = normalizeText(getField(row, ["Podcast-ID", "Podcast ID", "PodcastID"]));
  const topics = (Array.isArray(row?.topics) ? row.topics : String(getField(row, ["topics", "Topics", "Emner"]) || "").split(/[;,]/))
    .map(normalizeText)
    .filter(Boolean);
  const mainSeries = normalizeText(
    getField(row, ["Hovedserie", "Hoved serie", "Main series", "MainSeries", "mainSeries"])
  );
  const episodes = getField(row, ["Antal afsnit", "Afsnit", "Episodes"]);
  const yearPlayed = getField(row, ["\u00c5rstal afspillet", "Aarstal afspillet", "\u00c5r", "Aar"]);
  const link = extractUrl(getField(row, ["Link", "URL"]));
  const rawFeed = normalizeText(getField(row, ["Feed", "RSS", "RSS feed", "Episode feed"]));
  const feedUrl = extractUrl(rawFeed);
  const ratingDate = getField(row, ["Afgivet vurdering", "Dato", "Vurderingsdato", "Bed\u00f8mt"]);
  const rawImage = extractUrl(getField(row, ["Billedlink", "Billedefil", "Billede", "Cover", "Image"]));
  const imageFallback = extractUrl(
    getField(row, [
      "Billedlink fallback",
      "Tidligere billedlink",
      "Image fallback",
      "Fallback image"
    ])
  );
  const image = rawImage || imageFallback;
  const imageFallbacks = Array.from(
    new Set([imageFallback].map(normalizeText).filter((source) => source && source !== image))
  );
  const userAverageRating = parseNumber(
    getField(row, [
      "Brugernes snit",
      "Brugerens snit",
      "Brugervurdering",
      "User average rating",
      "userAverageRating"
    ])
  );
  const userRatingCount = parseNumber(
    getField(row, [
      "Antal brugervurderinger",
      "Brugerstemmer",
      "User rating count",
      "userRatingCount"
    ])
  );
  const userRank = parsePlacement(
    getField(row, ["Brugerplacering", "User rank", "userRank"])
  );
  const shortDescription = getField(row, [
    "Kort beskrivelse",
    "Kortbeskrivelse",
    "Beskrivelse",
    "Description"
  ]);
  const longDescription = getField(row, [
    "Lang beskrivelse",
    "Langbeskrivelse"
  ]);
  const rawUnderratedPearl = getField(row, [
    "Undervurderet perle",
    "Undervurderede perler",
    "Underrated pearl",
    "Underrated"
  ]);
  const isUnderratedPearl =
    normalizeText(rawUnderratedPearl).trim().toLowerCase() === "x";
  const placement = parsePlacement(getField(row, ["Placering", "Rank", "Rangering"]));
  const manualEpisodes = parseManualEpisodeTitles(
    row?.manualEpisodes || row?.manual_episodes || getField(row, ["Episoder", "Manual episodes", "ManualEpisodes"])
  );

  const genre = normalizeGenre(rawGenre);
  const secondaryGenre = normalizeGenre(rawSecondaryGenre);
  const publisher = normalizePublisher(rawPublisher);
  const catalogueId =
    normalizeText(getField(row, ["catalogue_id", "Catalogue ID"])) ||
    createCatalogueId({ title, host, publisher: rawPublisher, link, feedUrl });

  return {
    id: `${title}-${index}`,
    catalogueId,
    podcastId,
    legacyKey: normalizeMatchKey(title),
    title,
    host,
    rawRating,
    ratingValue: parseNumber(rawRating),
    ratingLabel: formatRating(rawRating),
    rawGenre,
    genre,
    secondaryGenre,
    topics,
    rawPublisher,
    publisher,
    isEnglish,
    accessType,
    accessEvidenceUrl,
    accessCheckedAt,
    mainSeries,
    episodes,
    manualEpisodes,
    yearPlayed,
    link,
    feedUrl,
    rawFeed,
    ratingDate,
    ratingDateObject: parseDate(ratingDate),
    ratingDateLabel: formatDate(ratingDate),
    userAverageRating,
    userRatingCount,
    userRank,
    image,
    imageFallbacks,
    description: shortDescription,
    shortDescription,
    longDescription,
    isUnderratedPearl,
    placement: placement ?? index + 1,
    randomTieBreaker: Math.random(),
    completenessScore: getCompletenessScore({
      yearPlayed,
      link,
      image,
      description: shortDescription || longDescription,
      episodes,
      publisher,
      genre,
      host,
      ratingDate
    }),
    searchText: buildSearchText([
      title,
      host,
      rawGenre,
      genre,
      rawPublisher,
      publisher,
      mainSeries,
      episodes,
      manualEpisodes.join(" "),
      yearPlayed,
      link,
      feedUrl,
      ratingDate,
      shortDescription,
      longDescription,
      rawUnderratedPearl
    ])
  };
}

function deduplicatePodcasts(podcasts) {
  const grouped = new Map();

  podcasts.forEach((podcast) => {
    const key = getPodcastId(podcast);
    if (!key) return;

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }

    grouped.get(key).push(podcast);
  });

  const result = [];

  grouped.forEach((items) => {
    if (items.length === 1) {
      result.push(items[0]);
      return;
    }

    const sorted = [...items].sort((a, b) => {
      if (b.completenessScore !== a.completenessScore) {
        return b.completenessScore - a.completenessScore;
      }

      const aPlacement = Number.isFinite(a.placement) ? a.placement : 999999;
      const bPlacement = Number.isFinite(b.placement) ? b.placement : 999999;
      return aPlacement - bPlacement;
    });

    const primary = { ...sorted[0] };
    const imageCandidates = [];

    sorted.forEach((item) => {
      [item.image, ...(Array.isArray(item.imageFallbacks) ? item.imageFallbacks : [])]
        .map(normalizeText)
        .filter(Boolean)
        .forEach((source) => {
          if (!imageCandidates.includes(source)) imageCandidates.push(source);
        });
    });

    if (!normalizeText(primary.image) && imageCandidates.length) {
      primary.image = imageCandidates[0];
    }

    primary.imageFallbacks = imageCandidates.filter(
      (source) => source !== normalizeText(primary.image)
    );

    result.push(primary);
  });

  return result.sort((a, b) => a.placement - b.placement);
}

function mapFeaturedReview(row, index) {
  const active = getField(row, ["Aktiv"]);
  const title = getField(row, ["Titel"]);
  const matchTitle = getField(row, ["Matchtitel"]) || title;
  const review = getField(row, ["Kort vurdering"]);

  const story = getField(row, ["Historie", "Historie/sag"]);
  const narrator = getField(row, [
    "Fort\u00e6ller",
    "Fortaeller",
    "V\u00e6rt",
    "Vaert",
    "V\u00e6rt/formidling",
    "Vaert/formidling",
    "Fort\u00e6lling"
  ]);
  const sound = getField(row, ["Lydside", "Produktion"]);
  const relevance = getField(row, ["Aktualitet", "Aktualitet/relevans", "Relevans"]);

  const score = getField(row, ["Samlet score"]);
  const reviewDate = getField(row, ["Anmeldelsesdato", "Anmeldelsesdat", "Anmeldt"]);
  const displayOrder = parsePlacement(getField(row, ["Visningsr\u00e6kkef\u00f8lge"]));
  const autoPublisher = getField(row, ["Auto-udgiver"]);
  const autoLink = extractUrl(getField(row, ["Auto-link"]));
  const autoImage = extractUrl(getField(row, ["Auto-billedlink"]));
  const autoGenre = getField(row, ["Auto-genre"]);
  const autoHost = getField(row, ["Auto-v\u00e6rt", "Auto-vaert"]);
  const podcastId = normalizeText(getField(row, ["Podcast-ID", "Podcast ID", "PodcastID"]));

  const matchedPodcast = podcastId
    ? state.podcastById[podcastId] || null
    : resolvePodcastByStoredKey(normalizeMatchKey(matchTitle)) ||
      resolvePodcastByStoredKey(normalizeMatchKey(title));

  return {
    active,
    title: title || matchedPodcast?.title || matchTitle,
    matchTitle: matchTitle || title,
    podcastId: getPodcastId(matchedPodcast),
    review,
    score,
    scoreLabel: formatRating(score),
    reviewDate,
    reviewDateObject: parseDate(reviewDate),
    reviewDateLabel: formatFeaturedDate(reviewDate),
    displayOrder: displayOrder ?? index + 1,
    publisher: normalizePublisher(autoPublisher || matchedPodcast?.publisher || ""),
    link: autoLink || matchedPodcast?.link || "",
    image: autoImage || matchedPodcast?.image || "",
    genre: normalizeGenre(autoGenre || matchedPodcast?.genre || ""),
    host: autoHost || matchedPodcast?.host || "",
    params: [
      { label: "Historie", value: story },
      { label: "Fort\u00e6ller", value: narrator },
      { label: "Lydside", value: sound },
      { label: "Aktualitet", value: relevance }
    ]
  };
}

function isUsableReview(review) {
  return Boolean((review.title || review.matchTitle) && review.review);
}

function buildFeaturedReviewLookup(reviews) {
  const lookup = {};

  reviews.forEach((review) => {
    const podcastId = getPodcastId(review);
    const matchKey = normalizeMatchKey(review.matchTitle);
    const titleKey = normalizeMatchKey(review.title);

    if (matchKey) lookup[matchKey] = review;
    if (titleKey) lookup[titleKey] = review;
    if (podcastId) lookup[podcastId] = review;
  });

  return lookup;
}

function getReviewForPodcast(podcast) {
  return state.featuredReviewByKey[getPodcastId(podcast)] ||
    state.featuredReviewByKey[getLegacyPodcastKey(podcast)] ||
    null;
}

function getFeaturedReviewPodcast(review) {
  if (!review) return null;
  return (
    state.podcastById[getPodcastId(review)] ||
    resolvePodcastByStoredKey(normalizeMatchKey(review.matchTitle || review.title)) ||
    resolvePodcastByStoredKey(normalizeMatchKey(review.title)) ||
    null
  );
}

function getFeaturedReviewImageSources(review) {
  const podcast = getFeaturedReviewPodcast(review);
  return Array.from(
    new Set(
      [
        ...(podcast ? getPodcastImageSources(podcast) : []),
        review?.image
      ]
        .map(normalizeText)
        .filter(Boolean)
    )
  );
}

function getPodcastId(podcast) {
  return normalizeText(podcast?.podcastId);
}

function getSeoPilotRoute(podcast) {
  const id = getPodcastId(podcast);
  if (!SEO_PILOT_PODCAST_IDS.has(id)) return "";
  const slug = id.toLowerCase()
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return slug ? `/podcast/${slug}/` : "";
}

function getLegacyPodcastKey(podcast) {
  return normalizeText(podcast?.legacyKey) || normalizeMatchKey(podcast?.title);
}

function getPodcastKey(podcast) {
  return getPodcastId(podcast) || getLegacyPodcastKey(podcast);
}

function getEpisodePodcastKey(podcastOrKey) {
  if (typeof podcastOrKey === "object") return getLegacyPodcastKey(podcastOrKey);
  const resolved = resolvePodcastByStoredKey(podcastOrKey);
  return resolved ? getLegacyPodcastKey(resolved) : normalizeMatchKey(podcastOrKey);
}

// Local/manual episode data is part of the catalogue namespace, not the
// imported-feed namespace. Keep this deliberately separate from
// getEpisodePodcastKey(), whose title-derived value is still the database key
// until the remote episode migration happens.
function getLocalEpisodePodcastKey(podcastOrKey) {
  const podcast =
    typeof podcastOrKey === "object"
      ? podcastOrKey
      : resolvePodcastByStoredKey(podcastOrKey);
  return getPodcastId(podcast);
}

function resolvePodcastByStoredKey(key) {
  const storedKey = normalizeText(key);
  if (!storedKey) return null;
  return state.podcastById[storedKey] || state.podcastByLegacyKey[storedKey] || null;
}

function resolveCanonicalPodcastId(key) {
  return getPodcastId(resolvePodcastByStoredKey(key));
}

function findPodcastByCatalogueId(catalogueId) {
  const normalizedId = normalizeText(catalogueId);
  if (!normalizedId) return null;
  return state.podcasts.find((podcast) => normalizeText(podcast.catalogueId) === normalizedId) || null;
}

function isUsefulPodcast(podcast) {
  return Boolean(podcast.title);
}

function isActiveFeatured(review) {
  const active = normalizeComparable(review.active);
  return active === "ja" || active === "yes" || active === "1" || active === "true";
}

function isNewPodcast(podcast) {
  if (!podcast.ratingDateObject) return false;

  const ageMs = Date.now() - podcast.ratingDateObject.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays >= 0 && ageDays <= NEW_BADGE_DAYS;
}

function getPodcastRandomTieBreaker(podcast) {
  return Number.isFinite(podcast?.randomTieBreaker) ? podcast.randomTieBreaker : 0.5;
}

function compareRandomTieBreaker(a, b) {
  return getPodcastRandomTieBreaker(a) - getPodcastRandomTieBreaker(b);
}

function hasSameMadsRating(a, b) {
  return a.ratingValue !== null && b.ratingValue !== null && a.ratingValue === b.ratingValue;
}

function bothMissingMadsRating(a, b) {
  return a.ratingValue === null && b.ratingValue === null;
}

function getScoreBadgeMarkup(value) {
  const number = parseNumber(value);
  if (number === null) {
    return '<span class="rating-score-badge rating-score-badge--empty" aria-hidden="true">–</span>';
  }

  return `<span class="rating-score-badge" aria-hidden="true">${number
    .toFixed(1)
    .replace(".", ",")}</span>`;
}

function resetVisibleCount() {
  cancelAutoExpandPodcastGrid();
  disconnectMobileRankingObserver();
  state.hasExpandedInitialList = false;
  state.mobileRankingTailMode = false;
  state.visibleCount = isMobileRankingRoute() ? MOBILE_RANKING_BATCH_SIZE : INITIAL_VISIBLE_COUNT;
}

function isMobileRankingRoute() {
  return isMobileViewport() && getRouteInfoFromHash().route === "ranglister";
}

function isRankingRoute() {
  return getRouteInfoFromHash().route === "ranglister";
}

function getRankingBatchSize() {
  return isMobileRankingRoute() ? MOBILE_RANKING_BATCH_SIZE : DESKTOP_RANKING_BATCH_SIZE;
}

function cancelAutoExpandPodcastGrid() {
  if (!state.autoExpandHandle) return;

  window.clearTimeout(state.autoExpandHandle);
  state.autoExpandHandle = null;
}

function scheduleAutoExpandPodcastGrid(filteredCount, visibleCount) {
  cancelAutoExpandPodcastGrid();
}

function clearSearchInput({ rerender = false } = {}) {
  if (!elements.searchInput) return;

  elements.searchInput.value = "";
  updateSearchClearButton();

  if (state.searchTerm) {
    state.searchTerm = "";

    if (rerender) {
      resetVisibleCount();
      render();
    }
  }
}

function enableSearchInput() {
  if (!elements.searchInput) return;
  elements.searchInput.removeAttribute("readonly");
}

function updateSearchClearButton() {
  if (!elements.searchClearButton || !elements.searchInput) return;

  elements.searchClearButton.hidden = !elements.searchInput.value.trim();
}

function isMobileViewport() {
  return window.matchMedia?.("(max-width: 768px)").matches ?? window.innerWidth <= 768;
}

function getRouteInfoFromHash() {
  const rawRoute = window.location.hash.slice(1).toLowerCase();
  const profileRoutes = new Set(["profil-gemte", "profil-indstillinger", "profil-faq"]);
  return {
    rawRoute,
    route: profileRoutes.has(rawRoute) ? "profil" : rawRoute
  };
}

function getViewportMetaElement() {
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  return meta;
}

function restoreNormalViewportMeta() {
  getViewportMetaElement().setAttribute("content", NORMAL_VIEWPORT_CONTENT);
}

function blurActiveTextControlForRouteChange() {
  const active = document.activeElement;
  if (
    active instanceof HTMLInputElement ||
    active instanceof HTMLSelectElement ||
    active instanceof HTMLTextAreaElement ||
    active?.isContentEditable
  ) {
    active.blur();
  }
}

function clearPendingViewportZoomReset({ restore = false } = {}) {
  if (viewportZoomResetFrame) {
    window.cancelAnimationFrame(viewportZoomResetFrame);
    viewportZoomResetFrame = 0;
  }
  if (viewportZoomResetSecondFrame) {
    window.cancelAnimationFrame(viewportZoomResetSecondFrame);
    viewportZoomResetSecondFrame = 0;
  }
  if (viewportZoomResetTimeout) {
    window.clearTimeout(viewportZoomResetTimeout);
    viewportZoomResetTimeout = 0;
  }
  if (restore) {
    restoreNormalViewportMeta();
  }
}

function resetVisualZoomForMainRouteChange() {
  const token = ++viewportZoomResetToken;
  clearPendingViewportZoomReset({ restore: true });
  blurActiveTextControlForRouteChange();

  const needsMobileZoomReset =
    window.matchMedia?.("(max-width: 1100px), (pointer: coarse)").matches ??
    window.innerWidth <= 1100;

  // Desktop-navigation skal ikke tvinge to layouts, to resize-events og en
  // ekstra 260 ms ventetid igennem. Zoom-reset beholdes kun på touch/mobil,
  // hvor det løser browserens fastlåste input-zoom.
  if (!needsMobileZoomReset) {
    restoreNormalViewportMeta();
    return;
  }

  const meta = getViewportMetaElement();
  meta.setAttribute("content", NORMAL_VIEWPORT_CONTENT);
  document.documentElement.getBoundingClientRect();
  meta.setAttribute("content", ZOOM_RESET_VIEWPORT_CONTENT);
  window.dispatchEvent(new Event("resize"));

  const restore = () => {
    if (token !== viewportZoomResetToken) return;
    viewportZoomResetTimeout = 0;
    restoreNormalViewportMeta();
    window.dispatchEvent(new Event("resize"));
  };

  viewportZoomResetFrame = window.requestAnimationFrame(() => {
    if (token !== viewportZoomResetToken) return;
    viewportZoomResetFrame = 0;
    meta.setAttribute("content", ZOOM_RESET_VIEWPORT_CONTENT);

    viewportZoomResetSecondFrame = window.requestAnimationFrame(() => {
      if (token !== viewportZoomResetToken) return;
      viewportZoomResetSecondFrame = 0;
      viewportZoomResetTimeout = window.setTimeout(restore, 260);
    });
  });
}

function saveRankingScrollPosition() {
  state.rankingScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
}

function scrollWindowToTop() {
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  });
}

function stabilizeFreshForsideScroll() {
  const navigationType = performance.getEntriesByType?.("navigation")?.[0]?.type;
  const isFreshNavigation = navigationType !== "back_forward";
  if (!isFreshNavigation || getRouteInfoFromHash().route !== "forside") return;

  const reset = () => window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  window.requestAnimationFrame(() => {
    reset();
    window.setTimeout(reset, 120);
  });
}

function restoreRankingScrollPosition() {
  const targetY = Math.max(0, state.rankingScrollY || 0);

  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      window.scrollTo({
        top: Math.min(targetY, maxY),
        left: 0,
        behavior: "auto"
      });
    });
  });
}

function isActiveGenre(genre) {
  if (genre === "Alle") return !state.activeFilter;
  return state.activeFilter?.type === "genre" && state.activeFilter.value === genre;
}

function getActiveFilterLabel(type) {
  if (type === "genre") return "Genre";
  if (type === "publisher") return "Udgiver";
  if (type === "mainSeries") return "Hovedserie";
  return "";
}

function getPublisherFilterToken(value) {
  const normalized = normalizeComparable(value)
    .replace(/\./g, "")
    .replace(/\s+/g, " ")
    .trim();
  const compact = normalized.replace(/\s+/g, "");

  if (
    normalized === "radio llll" ||
    normalized === "radio iiii" ||
    compact === "radio4"
  ) {
    return "radio4";
  }

  return normalized;
}

function getPublisherFilterTokens(value) {
  const normalized = normalizeText(value);
  if (!normalized) return [];

  const parts = normalized
    .split(/\s*(?:\/|&|\+|,|\bog\b)\s*/i)
    .map(getPublisherFilterToken)
    .filter((part) => part.length >= 3);
  const full = getPublisherFilterToken(normalized);

  return Array.from(new Set([full, ...parts].filter((part) => part.length >= 3)));
}

function getPublisherFilterLabel(value) {
  const publisher = normalizeText(value);
  if (!publisher) return "";
  return getPublisherFilterToken(publisher) === "radio4" ? "RADIO IIII" : publisher;
}

function publisherMatchesFilter(publisher, filterValue) {
  const publisherTokens = getPublisherFilterTokens(publisher);
  const filterTokens = getPublisherFilterTokens(filterValue);
  if (!publisherTokens.length || !filterTokens.length) return false;

  return filterTokens.some((token) => publisherTokens.includes(token));
}

function getExactPublisherFilterToken(value) {
  return normalizeComparable(value).replace(/\s+/g, " ").trim();
}

function getDesktopPublisherDisplayTokens(value) {
  const publisher = normalizeText(value);
  if (!publisher) return [];

  return publisher
    .split(/\s+\/\s+/)
    .map((token) => normalizeText(token))
    .filter(Boolean);
}

function publisherMatchesExactFilter(publisher, filterValue) {
  const filterToken = getExactPublisherFilterToken(filterValue);
  if (!filterToken) return false;

  if (getExactPublisherFilterToken(publisher) === filterToken) return true;

  return getDesktopPublisherDisplayTokens(publisher).some(
    (token) => getExactPublisherFilterToken(token) === filterToken
  );
}

function getExactMainSeriesFilterToken(value) {
  return normalizeText(value).replace(/\s+/g, " ").trim().toLocaleLowerCase("da-DK");
}

function mainSeriesMatchesExactFilter(mainSeries, filterValue) {
  const filterToken = getExactMainSeriesFilterToken(filterValue);
  return (
    Boolean(filterToken) &&
    getExactMainSeriesFilterToken(mainSeries) === filterToken
  );
}

function getDesktopPublisherLinksMarkup(value, buttonClass = "") {
  const tokens = getDesktopPublisherDisplayTokens(value);
  const publishers = tokens.length ? tokens : ["Ukendt"];
  const classAttribute = buttonClass ? ` class="${escapeHtml(buttonClass)}"` : "";

  return publishers
    .map(
      (publisher, index) => `
        ${index ? '<span class="desktop-ranking-publisher-separator" aria-hidden="true">/</span>' : ""}
        <button
          ${classAttribute}
          type="button"
          data-action="filter-desktop-publisher"
          data-value="${escapeHtml(publisher)}"
          aria-label="Filtr\u00e9r efter udgiveren ${escapeHtml(publisher)}"
        >${escapeHtml(publisher)}</button>
      `
    )
    .join("");
}

function setDesktopPublisherFilter(value) {
  const nextValue = normalizeText(value);
  const isSamePublisher =
    nextValue &&
    publisherMatchesExactFilter(nextValue, state.activePublisherFilter);

  state.activePublisherFilter = isSamePublisher ? "" : nextValue;
  resetVisibleCount();
  render();
  scrollToRankingStart();
}

function clearDesktopPublisherFilter() {
  if (!state.activePublisherFilter) return;
  state.activePublisherFilter = "";
  resetVisibleCount();
  render();
  scrollToRankingStart();
}

function setDesktopMainSeriesFilter(value) {
  const nextValue = normalizeText(value);
  state.activeMainSeriesFilter = nextValue;
  resetVisibleCount();
  render();
  scrollToRankingStart();
}

function clearDesktopMainSeriesFilter() {
  if (!state.activeMainSeriesFilter) return;
  state.activeMainSeriesFilter = "";
  resetVisibleCount();
  render();
  scrollToRankingStart();
}

function setActiveFilter(type, value, { render: shouldRender = true } = {}) {
  if (type === "publisher") {
    state.activePublisherFilter = normalizeText(value);
  } else if (type === "mainSeries") {
    state.activeMainSeriesFilter = normalizeText(value);
  } else {
    state.activeFilter = type && value ? { type, value } : null;
  }
  resetVisibleCount();
  createGenreChips();
  if (shouldRender) render();
}

function consumePendingRankingGenre() {
  let pendingGenre = "";

  try {
    pendingGenre = normalizeText(window.sessionStorage?.getItem("podcastRankingGenre"));
  } catch (error) {
    return;
  }

  if (!pendingGenre) return;

  const genre = GENRES.find(
    (candidate) =>
      candidate !== "Alle" &&
      normalizeComparable(candidate) === normalizeComparable(pendingGenre)
  );

  try {
    window.sessionStorage?.removeItem("podcastRankingGenre");
  } catch (error) {
    // Session storage is optional; the in-memory ranking filter still works.
  }

  if (genre) setActiveFilter("genre", genre, { render: false });
}

function clearActiveFilter() {
  setActiveFilter(null, null);
}

function getActiveCategoryFilters() {
  const filters = [];
  if (state.activeFilter?.type === "genre" && state.activeFilter.value) {
    filters.push({ type: "genre", label: "Genre", value: state.activeFilter.value });
  }
  if (state.activePublisherFilter) {
    filters.push({ type: "publisher", label: "Udgiver", value: state.activePublisherFilter });
  }
  if (state.activeMainSeriesFilter) {
    filters.push({
      type: "mainSeries",
      label: "Hovedserie",
      value: state.activeMainSeriesFilter
    });
  }
  return filters;
}

function clearCategoryFilter(type) {
  if (type === "genre" && state.activeFilter?.type === "genre") {
    state.activeFilter = null;
  } else if (type === "publisher") {
    state.activePublisherFilter = "";
  } else if (type === "mainSeries") {
    state.activeMainSeriesFilter = "";
  } else {
    return;
  }

  resetVisibleCount();
  createGenreChips();
  render();
}

function formatMinimumRating(value) {
  const number = Number(value) || 0;
  if (number <= 0) return "Alle";
  return `${number.toLocaleString("da-DK", {
    minimumFractionDigits: Number.isInteger(number) ? 0 : 1,
    maximumFractionDigits: 1
  })}+`;
}

function updateRatingFilterUi() {
  if (elements.ratingFilter) {
    elements.ratingFilter.value = String(state.minimumRating);
  }

  if (elements.ratingFilterValue) {
    elements.ratingFilterValue.textContent = formatMinimumRating(state.minimumRating);
  }
}

function invalidateRankingListCache() {
  state.rankingListCache.clear();
  state.rankingListCacheVersion += 1;
}

function getPodcastRatingForActiveSource(podcast) {
  if (state.rankingSource === "users") {
    const key = getPodcastKey(podcast);
    const stat = getCommunityStat(key);
    return parseNumber(stat?.averageRating ?? podcast.userAverageRating);
  }

  return parseNumber(podcast.ratingValue);
}

function getCommunityRatingCount(podcast) {
  const count = Number(getCommunityStat(getPodcastKey(podcast))?.ratingCount || 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function setMinimumRating(value) {
  const nextRating = Math.max(0, Math.min(10, parseNumber(value) ?? 0));
  if (state.minimumRating === nextRating) return;

  state.minimumRating = nextRating;
  resetVisibleCount();
  updateRatingFilterUi();
  render();
}

function updateFreeOnlyFilterUi() {
  if (elements.rankingFreeOnly) {
    elements.rankingFreeOnly.checked = state.freeOnly;
  }
}

function setFreeOnly(value) {
  const nextValue = Boolean(value);
  if (state.freeOnly === nextValue) return;

  state.freeOnly = nextValue;
  resetVisibleCount();
  updateFreeOnlyFilterUi();
  render();
}

function updateLanguageFilterUi() {
  elements.rankingLanguageButtons?.forEach((button) => {
    const active = button.dataset.rankingLanguage === state.languageFilter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function setLanguageFilter(value) {
  const nextValue = VALID_LANGUAGE_FILTERS.has(value) ? value : "all";
  if (state.languageFilter === nextValue) return;

  state.languageFilter = nextValue;
  resetVisibleCount();
  updateLanguageFilterUi();
  render();
}

function clearRankingFilters() {
  state.activeFilter = null;
  state.activePublisherFilter = "";
  state.activeMainSeriesFilter = "";
  state.searchTerm = "";
  state.minimumRating = 0;
  state.freeOnly = false;
  state.languageFilter = "all";
  state.sortTouched = false;
  state.sort = state.profilePreferences.defaultSort;
  if (state.rankingSource === "users") {
    state.userRankingSort = "rating";
    state.userRankingDirection = "desc";
  }
  if (elements.searchInput) {
    elements.searchInput.value = "";
  }
  updateSearchClearButton();
  resetVisibleCount();
  createGenreChips();
  updateRatingFilterUi();
  updateFreeOnlyFilterUi();
  updateLanguageFilterUi();
  render();
}

function resetRankingFiltersForPodcastDetailNavigation(type, value) {
  const nextValue = normalizeText(value);
  if (!nextValue) return;

  state.activeFilter = null;
  state.activePublisherFilter = "";
  state.activeMainSeriesFilter = "";
  state.searchTerm = "";
  state.minimumRating = 0;
  state.freeOnly = false;
  state.languageFilter = "all";

  if (elements.searchInput) elements.searchInput.value = "";

  if (type === "publisher") state.activePublisherFilter = nextValue;
  if (type === "mainSeries") state.activeMainSeriesFilter = nextValue;

  updateSearchClearButton();
  resetVisibleCount();
  createGenreChips();
  updateRatingFilterUi();
  updateFreeOnlyFilterUi();
  updateLanguageFilterUi();
}

function createGenreChips() {
  if (!elements.genreChips) return;

  elements.genreChips.innerHTML = "";

  GENRES.forEach((genre) => {
    const isTrueCrime = genre === "True Crime";
    const button = document.createElement(isTrueCrime ? "a" : "button");
    if (isTrueCrime) button.href = "/genre/true-crime/";
    else button.type = "button";
    button.className = "genre-chip";
    button.dataset.genre = genre;
    button.textContent = genre;

    if (isActiveGenre(genre)) {
      button.classList.add("active");
    }

    button.addEventListener("click", (event) => {
      if (isTrueCrime) event.preventDefault();
      if (genre === "Alle") {
        clearActiveFilter();
      } else {
        setActiveFilter("genre", genre);
      }
    });

    elements.genreChips.appendChild(button);
  });
}

function getRankingListCacheKey() {
  const activeFilter =
    state.activeFilter?.type && state.activeFilter?.value
      ? `${state.activeFilter.type}:${state.activeFilter.value}`
      : "";
  const savedFilterKeys =
    state.activeFilter?.type === "saved"
      ? [...state.savedPodcastKeys].sort().join("|")
      : "";

  return [
    state.rankingListCacheVersion,
    state.rankingSource,
    hasDesktopUserRankingSort() ? state.userRankingSort : "",
    hasDesktopUserRankingSort() ? state.userRankingDirection : "",
    state.sort,
    activeFilter,
    getExactPublisherFilterToken(state.activePublisherFilter),
    getExactMainSeriesFilterToken(state.activeMainSeriesFilter),
    state.minimumRating,
    state.freeOnly,
    state.languageFilter,
    state.searchTerm,
    savedFilterKeys
  ].join("||");
}

function getFilteredPodcasts() {
  const cacheKey = getRankingListCacheKey();
  const cached = state.rankingListCache.get(cacheKey);
  if (cached) return cached;

  const filtered = state.podcasts
    .filter((podcast) => {
      if (
        state.activePublisherFilter &&
        !publisherMatchesExactFilter(podcast.publisher, state.activePublisherFilter)
      ) {
        return false;
      }

      if (
        state.activeMainSeriesFilter &&
        !mainSeriesMatchesExactFilter(
          podcast.mainSeries,
          state.activeMainSeriesFilter
        )
      ) {
        return false;
      }

      if (state.activeFilter?.type === "saved" && !isPodcastSaved(getPodcastKey(podcast))) {
        return false;
      }

      if (
        state.activeFilter?.type === "genre" &&
        normalizeComparable(podcast.genre) !== normalizeComparable(state.activeFilter.value)
      ) {
        return false;
      }

      if (
        state.activeFilter?.type === "publisher" &&
        !publisherMatchesFilter(podcast.publisher, state.activeFilter.value)
      ) {
        return false;
      }

      if (
        state.activeFilter?.type === "mainSeries" &&
        normalizeComparable(podcast.mainSeries) !== normalizeComparable(state.activeFilter.value)
      ) {
        return false;
      }

      if (state.minimumRating > 0) {
        const rating = getPodcastRatingForActiveSource(podcast);
        if (rating === null || rating < state.minimumRating) {
          return false;
        }
      }

      if (state.freeOnly && podcast.accessType !== "free") {
        return false;
      }

      if (state.languageFilter === "english" && podcast.isEnglish !== true) {
        return false;
      }

      if (state.languageFilter === "danish" && podcast.isEnglish !== false) {
        return false;
      }

      if (!state.searchTerm) return true;

      const query = expandSearchAliases(state.searchTerm);
      const queryParts = query
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean);

      return queryParts.every((part) => podcast.searchText.includes(part));
    })
    .sort((a, b) => {
      const usesDesktopUserRankingSort = hasDesktopUserRankingSort();
      const isUserCountSort = usesDesktopUserRankingSort && state.userRankingSort === "count";
      const isUserSortAscending = usesDesktopUserRankingSort && state.userRankingDirection === "asc";

      if (isUserCountSort) {
        const aStat = getCommunityStat(getPodcastKey(a));
        const bStat = getCommunityStat(getPodcastKey(b));
        const aCount = getCommunityRatingCount(a);
        const bCount = getCommunityRatingCount(b);
        if (bCount !== aCount) {
          return isUserSortAscending ? aCount - bCount : bCount - aCount;
        }

        const aAverage = parseNumber(aStat?.averageRating) ?? -1;
        const bAverage = parseNumber(bStat?.averageRating) ?? -1;
        if (bAverage !== aAverage) return bAverage - aAverage;

        return comparePodcastsByActiveRankingOrder(a, b);
      }

      const aRating = getPodcastRatingForActiveSource(a);
      const bRating = getPodcastRatingForActiveSource(b);
      const aHasRating = aRating !== null;
      const bHasRating = bRating !== null;

      if (aHasRating !== bHasRating) {
        return aHasRating ? -1 : 1;
      }

      if (!aHasRating && !bHasRating) {
        return compareRandomTieBreaker(a, b);
      }

      const ratingDelta = aRating - bRating;
      if (ratingDelta !== 0) {
        if (usesDesktopUserRankingSort) {
          return isUserSortAscending ? ratingDelta : -ratingDelta;
        }
        return state.sort === "placement-desc" ? ratingDelta : -ratingDelta;
      }

      return comparePodcastsByActiveRankingOrder(a, b);
    });

  state.rankingListCache.set(cacheKey, filtered);
  return filtered;
}

function comparePodcastsByActiveRankingOrder(a, b) {
  if (state.rankingSource === "users") {
    const aRank = getPodcastUserRank(a);
    const bRank = getPodcastUserRank(b);
    return state.sort === "placement-desc" ? bRank - aRank : aRank - bRank;
  }

  const placementDelta = a.placement - b.placement;
  if (placementDelta !== 0) {
    return state.sort === "placement-desc" ? -placementDelta : placementDelta;
  }

  return compareRandomTieBreaker(a, b);
}

function getPodcastUserRank(podcast) {
  const key = getPodcastKey(podcast);
  if (state.userRankByKey[key]) return state.userRankByKey[key];
  return podcast.userRank || null;
}

function getPodcastPlacementDisplay(podcast) {
  if (state.rankingSource === "users") {
    const rank = getPodcastUserRank(podcast);
    return {
      hasPlacement: rank !== null,
      value: rank,
      label: "Bruger"
    };
  }

  const hasOwnerRating = podcast.ratingValue !== null && podcast.ratingValue !== undefined;
  return {
    hasPlacement: hasOwnerRating,
    value: podcast.placement,
    label: "Placering"
  };
}

function normalizeRankingPositionMode(value) {
  return value === "fixed" ? "fixed" : "dynamic";
}

function syncRankingPositionModeForAuthUser() {
  const userId = state.authUser?.id || "";
  const storedMode = userId
    ? state.profilePreferences.rankingPositionModeByUser?.[userId]
    : "dynamic";
  state.rankingPositionMode = normalizeRankingPositionMode(storedMode);
}

function persistRankingPositionMode(value) {
  const mode = normalizeRankingPositionMode(value);
  state.rankingPositionMode = mode;

  const userId = state.authUser?.id || "";
  if (!userId) return;

  persistProfilePreferences({
    rankingPositionModeByUser: {
      ...(state.profilePreferences.rankingPositionModeByUser || {}),
      [userId]: mode
    }
  });
}

function getRankingDisplayRank(index) {
  return state.rankingPositionMode === "dynamic" ? index + 1 : null;
}

function rebuildUserRanks() {
  const ranked = state.podcasts
    .map((podcast) => {
      const key = getPodcastKey(podcast);
      const stat = getCommunityStat(key);
      const averageRating = stat?.averageRating ?? podcast.userAverageRating;

      return {
        key,
        podcast,
        averageRating: parseNumber(averageRating)
      };
    })
    .filter((item) => item.averageRating !== null)
    .sort((a, b) => {
      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }

      return compareRandomTieBreaker(a.podcast, b.podcast);
    });

  state.userRankByKey = {};
  ranked.forEach((item, index) => {
    state.userRankByKey[item.key] = index + 1;
  });
}

function updateActiveFilterUi() {
  if (!elements.activeFilterBox || !elements.activeFilterText) return;

  if (state.activeFilter?.type !== "saved") {
    elements.activeFilterBox.classList.add("is-hidden");
    elements.activeFilterText.textContent = "";
    return;
  }

  elements.activeFilterText.textContent = "Viser kun gemte podcasts";
  elements.activeFilterBox.classList.remove("is-hidden");
}

function updateSortToggleUi() {
  const isAscending = state.sort === "placement-asc";

  if (elements.sortToggle) {
    elements.sortToggle.textContent = isAscending
      ? "Placering: lavest f\u00f8rst"
      : "Placering: h\u00f8jest f\u00f8rst";
  }

  if (elements.mobileSortToggle) {
    elements.mobileSortToggle.textContent = isAscending ? "\u21c5 Lavest" : "\u21c5 H\u00f8jest";
    elements.mobileSortToggle.setAttribute(
      "aria-label",
      isAscending ? "Sorter efter laveste placering f\u00f8rst" : "Sorter efter h\u00f8jeste placering f\u00f8rst"
    );
  }
}

function isMobileRankingFiltersViewport() {
  return (
    isMobileViewport() &&
    document.body.classList.contains("page-ranglister") &&
    !document.body.classList.contains("force-desktop-view")
  );
}

function syncMobileRankingFilterPlacement() {
  const panel = elements.rankingFilterPanel;
  if (!panel || !elements.rankingSidebarColumn || !elements.rankingMainColumn) return;

  if (isMobileRankingFiltersViewport()) {
    if (panel.parentElement !== elements.rankingMainColumn) {
      elements.rankingSearchStrip?.after(panel);
    }
    return;
  }

  if (panel.parentElement !== elements.rankingSidebarColumn) {
    elements.featuredPanel?.after(panel);
  }
}

function getMobileRankingActiveFilterCount() {
  let count = 0;
  const defaultSource = state.profilePreferences?.defaultRankingSource || "mads";

  if (state.rankingSource !== defaultSource) count += 1;
  if (state.rankingSource === "users" && state.userRankingSort !== "rating") count += 1;
  if (getActiveCategoryFilters().length) count += 1;
  if (state.minimumRating > 0) count += 1;
  if (state.languageFilter !== "all") count += 1;
  if (state.freeOnly) count += 1;

  return count;
}

function updateMobileRankingFilterUi() {
  syncMobileRankingFilterPlacement();

  const isMobileRanking = isMobileRankingFiltersViewport();
  const isOpen = isMobileRanking && state.mobileRankingFiltersOpen;
  document.body.classList.toggle("ranking-filters-open", isOpen);
  if (elements.rankingFilterPanel) {
    elements.rankingFilterPanel.hidden = isMobileRanking && !state.mobileRankingFiltersOpen;
  }

  if (elements.rankingMobileFilterToggle) {
    elements.rankingMobileFilterToggle.setAttribute(
      "aria-expanded",
      String(isOpen)
    );
    elements.rankingMobileFilterToggle.setAttribute(
      "aria-label",
      getMobileRankingActiveFilterCount()
        ? `Filtre, ${getMobileRankingActiveFilterCount()} aktive`
        : "Filtre"
    );
  }

  const categoryFilters = getActiveCategoryFilters();
  const isSavedFilter = state.activeFilter?.type === "saved";
  const ratingLabel = `Vurdering: ${formatMinimumRating(state.minimumRating)}`;
  const freeOnlyMarkup = state.freeOnly
    ? '<span class="ranking-mobile-filter-summary__free">Kun gratis</span>'
    : "";
  const languageMarkup =
    state.languageFilter === "danish"
      ? '<span class="ranking-mobile-filter-summary__language">Dansk</span>'
      : state.languageFilter === "english"
        ? '<span class="ranking-mobile-filter-summary__language">Engelsk</span>'
        : "";

  const categoryMarkup = categoryFilters
    .map(
      (filter) => `
        <button
          class="ranking-mobile-active-filter-chip"
          type="button"
          data-clear-category-filter="${escapeHtml(filter.type)}"
          aria-label="Fjern ${escapeHtml(filter.label.toLocaleLowerCase("da-DK"))}filteret ${escapeHtml(filter.value)}"
        >
          ${escapeHtml(filter.label)}: ${escapeHtml(filter.value)}
          <span aria-hidden="true">\u00d7</span>
        </button>
      `
    )
    .join("");
  const baseLabel = isSavedFilter
    ? '<span class="ranking-mobile-filter-summary__base">Gemte podcasts</span>'
    : categoryFilters.length
      ? ""
      : '<span class="ranking-mobile-filter-summary__base">Alle genrer</span>';
  if (elements.rankingMobileFilterSummary) {
    elements.rankingMobileFilterSummary.innerHTML = `
      ${baseLabel}
      ${categoryMarkup}
      ${languageMarkup}
      ${freeOnlyMarkup}
      <span class="ranking-mobile-filter-summary__rating">${escapeHtml(ratingLabel)}</span>
    `;
  }

  if (elements.rankingMobileFilterCount) {
    const count = getMobileRankingActiveFilterCount();
    elements.rankingMobileFilterCount.hidden = count === 0;
    elements.rankingMobileFilterCount.textContent = count ? String(count) : "";
  }

  if (elements.rankingMobileActiveFilterRemove) {
    const hasRemovableFilter =
      isSavedFilter ||
      categoryFilters.length > 0 ||
      state.minimumRating > 0 ||
      state.freeOnly ||
      state.languageFilter !== "all" ||
      Boolean(state.searchTerm);
    elements.rankingMobileActiveFilterRemove.textContent = "Nulstil";
    elements.rankingMobileActiveFilterRemove.setAttribute(
      "aria-label",
      "Nulstil alle filtre"
    );
    elements.rankingMobileActiveFilterRemove.classList.toggle("is-hidden", !hasRemovableFilter);
    elements.rankingMobileActiveFilterRemove.disabled = !hasRemovableFilter;
  }
}

function normalizeRankingSource(source) {
  return VALID_RANKING_SOURCES.has(source) ? source : null;
}

function resolveRankingSourceForRoute(route) {
  const normalizedSource = normalizeRankingSource(state.rankingSource);

  if (!normalizedSource) {
    state.rankingSource =
      route === "ranglister" ? state.profilePreferences.defaultRankingSource : "mads";
    return;
  }

  state.rankingSource = normalizedSource;

  if (route === "ranglister" && !state.rankingSourceTouched) {
    state.rankingSource = state.profilePreferences.defaultRankingSource;
  }
}

function updateRankingSourceUi() {
  elements.rankingSourceButtons?.forEach((button) => {
    const active = button.dataset.rankingSource === state.rankingSource;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    if (active) {
      button.setAttribute("aria-current", "true");
    } else {
      button.removeAttribute("aria-current");
    }
    if (button.dataset.rankingSource === "users") {
      button.setAttribute("aria-label", "Brugere");
    }
    if (button.dataset.rankingSource === "mads") {
      button.setAttribute("aria-label", "Podcastlisten");
    }
  });

  const showUserSort = isDesktopRankingViewport();
  const userSortEnabled = showUserSort && state.rankingSource === "users";
  if (elements.rankingUserSortField) {
    elements.rankingUserSortField.hidden = !showUserSort;
    elements.rankingUserSortField.setAttribute("aria-hidden", String(!showUserSort));
  }

  elements.rankingUserSortButtons?.forEach((button) => {
    const active = userSortEnabled && button.dataset.rankingUserSort === state.userRankingSort;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = !userSortEnabled;
    button.setAttribute("aria-disabled", String(!userSortEnabled));
  });
}

function scheduleRankingSourceGridRender() {
  if (state.rankingSourceRenderFrame) {
    window.cancelAnimationFrame(state.rankingSourceRenderFrame);
    state.rankingSourceRenderFrame = null;
  }

  const token = ++state.rankingSourceRenderToken;
  state.rankingSourceRenderFrame = window.requestAnimationFrame(() => {
    if (token !== state.rankingSourceRenderToken) return;
    state.rankingSourceRenderFrame = null;
    renderPodcastGrid();
  });
}

function handleRankingSourceChange(source) {
  const nextSource = normalizeRankingSource(source) || "mads";
  if (state.rankingSource === nextSource) {
    updateRankingSourceUi();
    return;
  }

  state.rankingSourceTouched = true;
  state.rankingSource = nextSource;
  resetVisibleCount();
  updateRankingSourceUi();
  updateMobileRankingFilterUi();
  scheduleRankingSourceGridRender();
}

function handleRankingSourceToggleEvent(event) {
  const button = event.target.closest("[data-ranking-source]");
  if (!button || !elements.rankingSourceToggle?.contains(button)) return;

  if (event.type === "click" && Date.now() - state.rankingSourceLastPointerAt < 500) {
    return;
  }

  if (event.type === "pointerup") {
    state.rankingSourceLastPointerAt = Date.now();
    event.preventDefault();
  }

  handleRankingSourceChange(button.dataset.rankingSource);
}

function getResultsText(filteredCount, visibleCount) {
  const isMobileRanking =
    typeof window !== "undefined" &&
    window.matchMedia?.("(max-width: 768px)").matches;
  const baseText = isMobileRanking
    ? visibleCount < filteredCount
      ? `Viser ${visibleCount} af ${filteredCount} podcasts`
      : `Viser ${filteredCount} podcasts`
    : `Viser ${filteredCount} podcasts.`;

  const suffixes = [];

  if (state.activeFilter?.type === "saved") {
    suffixes.push("Filtreret p\u00e5 dine gemte podcasts.");
  } else if (state.activeFilter) {
    const label =
      state.activeFilter.type === "genre"
        ? "genren"
        : state.activeFilter.type === "mainSeries"
          ? "hovedserien"
          : "udgiveren";
    suffixes.push(`Filtreret p\u00e5 ${label} ${state.activeFilter.value}.`);
  }

  if (state.minimumRating > 0) {
    suffixes.push(`Minimum ${formatMinimumRating(state.minimumRating)}.`);
  }

  if (state.activePublisherFilter) {
    suffixes.push(`Udgiver: ${state.activePublisherFilter}.`);
  }

  if (state.activeMainSeriesFilter) {
    suffixes.push(`Hovedserie: ${state.activeMainSeriesFilter}.`);
  }

  if (state.languageFilter === "danish") {
    suffixes.push("Sprog: Dansk.");
  } else if (state.languageFilter === "english") {
    suffixes.push("Sprog: Engelsk.");
  }

  return suffixes.length ? `${baseText} ${suffixes.join(" ")}` : baseText;
}

function toggleSavedFilter() {
  if (!isLoggedIn()) {
    showAuthPrompt("login");
    setAuthMessage("Log ind for at se dine gemte podcasts.", "warning", "dialog");
    return;
  }

  state.activeFilter =
    state.activeFilter?.type === "saved"
      ? null
      : { type: "saved", value: "" };

  resetVisibleCount();
  createGenreChips();
  render();
  scrollToRankingStart();
}

function ensureLoadMoreControls() {
  if (!elements.podcastGrid || elements.loadMoreWrap) return;

  const wrap = document.createElement("div");
  wrap.className = "load-more-wrap is-hidden";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "load-more-button";
  button.textContent = "Vis resten";

  button.addEventListener("click", () => {
    if (isRankingRoute()) {
      loadNextMobileRankingBatch({ trigger: "button" });
      return;
    }

    state.hasExpandedInitialList = true;
    persistExpandedListPreference(true);
    state.visibleCount = Number.MAX_SAFE_INTEGER;
    renderPodcastGrid();
  });

  wrap.appendChild(button);
  elements.podcastGrid.insertAdjacentElement("afterend", wrap);

  elements.loadMoreWrap = wrap;
  elements.loadMoreButton = button;
}

function updateLoadMoreUi(filteredCount, visibleCount) {
  if (!elements.loadMoreWrap || !elements.loadMoreButton) return;

  const remaining = filteredCount - visibleCount;
  elements.loadMoreButton.disabled = false;

  if (remaining <= 0) {
    elements.loadMoreWrap.classList.add("is-hidden");
    return;
  }

  if (isRankingRoute()) {
    const nextCount = Math.min(getRankingBatchSize(), remaining);
    elements.loadMoreWrap.classList.remove("is-hidden");
    elements.loadMoreButton.textContent = `Vis ${nextCount} flere`;
    elements.loadMoreButton.setAttribute(
      "aria-label",
      `Vis ${nextCount} flere podcasts. ${remaining} podcasts tilbage.`
    );
    return;
  }

  elements.loadMoreWrap.classList.add("is-hidden");
  elements.loadMoreButton.textContent = `Indl\u00e6ser resten (${remaining} tilbage)`;
  elements.loadMoreButton.removeAttribute("aria-label");
}

function getMobileRankingCardCount() {
  if (!elements.podcastGrid) return 0;
  return elements.podcastGrid.querySelectorAll(".podcast-card").length;
}

function disconnectMobileRankingObserver() {
  state.mobileRankingObserverToken += 1;

  if (state.mobileRankingObserver) {
    state.mobileRankingObserver.disconnect();
    state.mobileRankingObserver = null;
  }

  state.mobileRankingSentinel?.classList.add("is-hidden");
}

function ensureMobileRankingSentinel() {
  if (!elements.podcastGrid) return null;

  if (!state.mobileRankingSentinel) {
    const sentinel = document.createElement("div");
    sentinel.className = "mobile-ranking-autoload-sentinel is-hidden";
    sentinel.setAttribute("aria-hidden", "true");
    state.mobileRankingSentinel = sentinel;
  }

  const sentinel = state.mobileRankingSentinel;
  const targetParent = elements.loadMoreWrap?.parentElement || elements.podcastGrid.parentElement;
  if (!targetParent) return sentinel;

  const beforeNode = elements.loadMoreWrap || elements.podcastGrid.nextSibling;
  if (sentinel.parentElement !== targetParent || sentinel.nextSibling !== beforeNode) {
    targetParent.insertBefore(sentinel, beforeNode);
  }

  return sentinel;
}

function setupMobileRankingAutoLoad(filteredCount, visibleCount) {
  disconnectMobileRankingObserver();

  const sentinel = ensureMobileRankingSentinel();
  const hasMore = isRankingRoute() && visibleCount < filteredCount;

  if (!sentinel || !hasMore || !("IntersectionObserver" in window)) {
    sentinel?.classList.add("is-hidden");
    return;
  }

  sentinel.classList.remove("is-hidden");
  const token = state.mobileRankingObserverToken;
  const observer = new IntersectionObserver(
    (entries) => {
      if (token !== state.mobileRankingObserverToken) return;
      if (!entries.some((entry) => entry.isIntersecting)) return;
      loadNextMobileRankingBatch({ trigger: "observer", token });
    },
    {
      root: null,
      rootMargin: "0px 0px 520px 0px",
      threshold: 0
    }
  );

  state.mobileRankingObserver = observer;
  observer.observe(sentinel);
}

function appendRankingBatchItems(podcasts, startIndex) {
  if (!elements.podcastGrid || !podcasts.length) return false;

  const fragment = document.createDocumentFragment();
  if (isDesktopRankingViewport()) {
    const table = elements.podcastGrid.querySelector(".desktop-ranking-table");
    if (!table) return false;

    podcasts.forEach((podcast, index) => {
      const displayRank = getRankingDisplayRank(startIndex + index);
      fragment.appendChild(createDesktopRankingTableRowElement(podcast, displayRank));
    });
    table.appendChild(fragment);
    return true;
  }

  podcasts.forEach((podcast, index) => {
    fragment.appendChild(createPodcastCardElement(podcast, getRankingDisplayRank(startIndex + index)));
  });
  elements.podcastGrid.appendChild(fragment);
  return true;
}

function loadNextMobileRankingBatch({ trigger = "manual", token = null } = {}) {
  if (!isRankingRoute() || !elements.podcastGrid) return false;
  if (token !== null && token !== state.mobileRankingObserverToken) return false;
  if (state.mobileRankingBatchLoading) return false;

  const filtered = getFilteredPodcasts();
  const start = Math.min(state.visibleCount, filtered.length);
  const end = Math.min(start + getRankingBatchSize(), filtered.length);

  if (end <= start) {
    updateLoadMoreUi(filtered.length, state.visibleCount);
    setupMobileRankingAutoLoad(filtered.length, state.visibleCount);
    return false;
  }

  state.mobileRankingBatchLoading = true;
  disconnectMobileRankingObserver();

  if (elements.loadMoreButton) {
    elements.loadMoreButton.disabled = true;
    elements.loadMoreButton.textContent = "Indl\u00e6ser\u2026";
  }

  const currentCardCount = getMobileRankingCardCount();
  const nextItems = filtered.slice(start, end);
  state.visibleCount = end;

  if (currentCardCount !== start || !appendRankingBatchItems(nextItems, start)) {
    renderPodcastGrid();
    state.mobileRankingBatchLoading = false;
    return true;
  }

  if (elements.resultsText) {
    elements.resultsText.textContent = getResultsText(filtered.length, end);
  }

  updateLoadMoreUi(filtered.length, end);
  state.mobileRankingBatchLoading = false;
  setupMobileRankingAutoLoad(filtered.length, end);
  return trigger === "observer" || trigger === "button" || trigger === "manual";
}

function setImage(container, image, alt) {
  if (!container) return;

  const img = container.querySelector("img");
  const placeholder = container.querySelector(".image-placeholder");

  if (!img) return;

  const showPlaceholder = () => {
    container.classList.add("has-no-image");
    img.hidden = true;
    img.removeAttribute("src");
    img.alt = "";
    if (placeholder) placeholder.hidden = false;
  };

  if (!getImageCandidates(image, alt).length) {
    showPlaceholder();
    return;
  }

  container.classList.remove("has-no-image");
  if (placeholder) placeholder.hidden = true;

  loadImageWithFallback(img, image, alt, {
    onLoad() {
      container.classList.remove("has-no-image");
      if (placeholder) placeholder.hidden = true;
    },
    onFail: showPlaceholder
  });
}

function setImageWithFallbackSource(container, primaryImage, fallbackImage, alt) {
  const primarySources = Array.isArray(primaryImage) ? primaryImage : [primaryImage];
  const fallbackSources = Array.isArray(fallbackImage) ? fallbackImage : [fallbackImage];
  const sources = Array.from(
    new Set([...primarySources, ...fallbackSources].map(normalizeText).filter(Boolean))
  );
  setImage(container, sources, alt);
}

function setPodcastDetailAuthLayerActive(active) {
  const dialog = document.getElementById("podcastDetailSheet");
  const panel = dialog?.querySelector(".podcast-detail-sheet__panel");

  if (!panel || dialog.classList.contains("is-hidden")) return;

  if (active) {
    panel.setAttribute("inert", "");
    panel.setAttribute("aria-hidden", "true");
  } else {
    panel.removeAttribute("inert");
    panel.removeAttribute("aria-hidden");
  }
}

function showAuthPrompt(preferredAction = "signup") {
  if (!elements.authDialog) return;

  const wasHidden = elements.authDialog.classList.contains("is-hidden");
  if (wasHidden && document.activeElement instanceof HTMLElement) {
    state.authReturnFocus = document.activeElement;
  }

  state.authBusy = false;
  state.authMode = preferredAction === "login" ? "login" : "signup";

  if (elements.authDialogTitle) {
    elements.authDialogTitle.textContent =
      state.authMode === "login" ? "Log ind" : "Opret dig eller log ind";
  }

  const isLogin = state.authMode === "login";
  if (elements.signupButton && elements.loginButton) {
    const authActions = elements.signupButton.parentElement;

    if (authActions) {
      if (isLogin) {
        authActions.insertBefore(elements.loginButton, elements.signupButton);
      } else {
        authActions.insertBefore(elements.signupButton, elements.loginButton);
      }
    }

    elements.loginButton.classList.toggle("auth-button--primary", isLogin);
    elements.loginButton.classList.toggle("auth-button--secondary", !isLogin);
    elements.signupButton.classList.toggle("auth-button--primary", !isLogin);
    elements.signupButton.classList.toggle("auth-button--secondary", isLogin);
  }
  elements.authPersistenceField?.classList.toggle("is-hidden", !isLogin);
  elements.authPersistenceField?.setAttribute("aria-hidden", String(!isLogin));
  if (elements.authRememberLogin) {
    elements.authRememberLogin.checked = true;
  }

  clearAuthMessage();
  renderAuthPanel();
  elements.authDialog.classList.remove("is-hidden");
  elements.authDialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-dialog-open");
  setPodcastDetailAuthLayerActive(true);

  window.setTimeout(() => {
    elements.authEmail?.focus();
  }, 40);
}

function closeAuthDialog({ clearPending = true } = {}) {
  if (!elements.authDialog) return;

  const returnFocus = state.authReturnFocus;
  state.authReturnFocus = null;

  if (clearPending) {
    if (state.pendingAuthAction?.type === "suggestion") {
      state.exploreSuggestionDialogOpen = false;
    }
    state.pendingAuthAction = null;
  }
  elements.authDialog.classList.add("is-hidden");
  elements.authDialog.setAttribute("aria-hidden", "true");
  setPodcastDetailAuthLayerActive(false);

  if (
    elements.ratingDialog?.classList.contains("is-hidden") &&
    !document.body.classList.contains("has-podcast-detail-open")
  ) {
    document.body.classList.remove("has-dialog-open");
  }

  if (returnFocus?.isConnected) {
    window.requestAnimationFrame(() => returnFocus.focus());
  }
}

window.podcastAuth = {
  showSignup() {
    showAuthPrompt("signup");
  },
  showLogin() {
    showAuthPrompt("login");
  },
  submitSignup() {
    handleAuthAction("signup");
  },
  submitLogin() {
    handleAuthAction("login");
  },
  forgotPassword() {
    requestPasswordReset();
  },
  closeDialog() {
    closeAuthDialog();
  }
};

function scrollToRankingStart() {
  const target = elements.rankingToolbar || elements.podcastGrid;
  if (!target) return;

  const top = target.getBoundingClientRect().top + window.scrollY - 18;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
}

function hasSupabaseConfig() {
  return Boolean(normalizeText(SUPABASE_CONFIG.url) && normalizeText(SUPABASE_CONFIG.anonKey));
}

async function waitForSupabaseClient(timeoutMs = 5000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (window.supabase?.createClient) {
      return window.supabase;
    }

    await new Promise((resolve) => {
      window.setTimeout(resolve, 120);
    });
  }

  return null;
}

function isLoggedIn() {
  return Boolean(state.authUser);
}

function getCurrentUserEmail() {
  return normalizeText(state.authUser?.email).toLowerCase();
}

function isPodcastSuggestionAdmin() {
  return PODCAST_SUGGESTION_ADMIN_EMAILS.has(getCurrentUserEmail());
}

function getUnreadSuggestionItems() {
  const items = isPodcastSuggestionAdmin() ? state.adminPodcastSuggestions : state.profileSuggestions;
  return (items || []).filter((suggestion) => isPodcastSuggestionAdmin()
    ? normalizeComparable(suggestion.status) === "new" && !suggestion.moderator_seen_at
    : Boolean(suggestion.reviewed_at) && !suggestion.user_seen_response_at
  ).sort((a, b) => new Date((b.reviewed_at || b.created_at) || 0) - new Date((a.reviewed_at || a.created_at) || 0));
}

function getSuggestionUnreadCount() {
  return getUnreadSuggestionItems().length;
}

function formatSuggestionUnreadCount(count) {
  return count >= 10 ? "9+" : String(count);
}

function renderSuggestionNotificationBadges() {
  const count = getSuggestionUnreadCount();
  const label = count ? formatSuggestionUnreadCount(count) : "";
  const unreadLabel = count ? `${label} ulæste podcastforslag` : "";
  document.querySelectorAll(".suggestion-notification-badge").forEach((badge) => {
    badge.textContent = label;
    badge.classList.toggle("is-hidden", !count);
    badge.setAttribute("aria-label", unreadLabel);
  });
  document.querySelectorAll("[data-home-account-toggle]").forEach((button) => {
    button.setAttribute("aria-label", unreadLabel ? `Åbn profilmenu, ${unreadLabel}` : "Åbn profilmenu");
  });
  if (elements.desktopUserButton && isLoggedIn()) {
    const currentLabel = getProfileDisplayName() || normalizeText(state.authUser?.email) || "Din profil";
    elements.desktopUserButton.setAttribute("aria-label", unreadLabel
      ? `Åbn brugermenu for ${currentLabel}, ${unreadLabel}`
      : `Åbn brugermenu for ${currentLabel}`);
  }
}

function navigateToSuggestionNotification() {
  const target = getUnreadSuggestionItems()[0];
  if (!target) {
    window.location.hash = "#profil";
    return;
  }
  state.suggestionNotificationTarget = { id: target.id, moderator: isPodcastSuggestionAdmin() };
  if (isPodcastSuggestionAdmin()) state.adminPodcastSuggestionFilter = "new";
  window.location.hash = isPodcastSuggestionAdmin() ? "#moderator" : "#profil";
}

async function markSuggestionNotificationTargetSeen(target) {
  if (!target?.id || !state.supabase) return;
  const rpc = target.moderator
    ? "mark_podcast_suggestion_seen_by_moderator"
    : "mark_podcast_suggestion_response_seen";
  const { error } = await state.supabase.rpc(rpc, { p_suggestion_id: target.id });
  if (error) return;
  const list = target.moderator ? state.adminPodcastSuggestions : state.profileSuggestions;
  const field = target.moderator ? "moderator_seen_at" : "user_seen_response_at";
  const seenAt = new Date().toISOString();
  const next = list.map((item) => normalizeText(item.id) === normalizeText(target.id) ? { ...item, [field]: seenAt } : item);
  if (target.moderator) state.adminPodcastSuggestions = next; else state.profileSuggestions = next;
  renderSuggestionNotificationBadges();
}

function revealSuggestionNotificationTarget() {
  const target = state.suggestionNotificationTarget;
  if (!target) return;
  const card = document.querySelector(`[data-suggestion-id="${CSS.escape(target.id)}"]`);
  if (!card) return;

  card.closest(".profile-suggestions-panel")?.classList.add("is-expanded");
  state.suggestionNotificationTarget = null;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  card.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "center" });
  card.classList.add("is-notification-target");
  window.setTimeout(() => card.classList.remove("is-notification-target"), 2000);

  let targetingFrames = 0;
  const markWhenTargeted = () => {
    const rect = card.getBoundingClientRect();
    if (rect.bottom > 0 && rect.top < window.innerHeight) {
      markSuggestionNotificationTargetSeen(target);
      return;
    }
    if (targetingFrames >= 60) {
      state.suggestionNotificationTarget = target;
      return;
    }
    targetingFrames += 1;
    window.requestAnimationFrame(markWhenTargeted);
  };
  window.requestAnimationFrame(markWhenTargeted);
}

function isProfileSavedRoute() {
  return window.location.hash.slice(1).toLowerCase() === "profil-gemte";
}

function openProfileSavedSection() {
  if (window.location.hash.slice(1).toLowerCase() === "profil-gemte") {
    document.getElementById("profileSaved")?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
    return;
  }

  window.location.hash = "#profil-gemte";
}

function openSavedProfileOrLogin() {
  if (isLoggedIn()) {
    openProfileSavedSection();
    return;
  }

  state.pendingAuthAction = {
    type: "profileSaved"
  };
  showAuthPrompt("login");
  setAuthMessage(
    "Log ind eller opret en konto for at se dine gemte podcasts.",
    "warning",
    "dialog"
  );
}

function bindHomeAccountMenu(root = elements.pageIntroPanel) {
  if (!root) return;

  const accountToggle = root.querySelector("[data-home-account-toggle]");
  const accountMenu = root.querySelector("[data-home-account-menu]");
  if (!accountToggle || !accountMenu) return;

  const closeHomeAccountMenu = () => {
    accountMenu.hidden = true;
    accountToggle.setAttribute("aria-expanded", "false");
  };

  accountToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const shouldOpen = accountMenu.hidden;
    accountMenu.hidden = !shouldOpen;
    accountToggle.setAttribute("aria-expanded", String(shouldOpen));

    if (shouldOpen) {
      window.setTimeout(() => {
        document.addEventListener("click", closeHomeAccountMenu, { once: true });
      }, 0);
    }
  });

  accountMenu.addEventListener("click", (event) => {
    event.stopPropagation();

    if (event.target.closest("[data-home-logout]")) {
      closeHomeAccountMenu();
      handleLogout();
      return;
    }

    if (event.target.closest("[data-suggestion-profile-link]")) {
      if (getSuggestionUnreadCount()) {
        event.preventDefault();
        closeHomeAccountMenu();
        navigateToSuggestionNotification();
      }
      return;
    }

    if (event.target.closest("a")) {
      closeHomeAccountMenu();
    }
  });
}

function getMobileToplineProfileMarkup() {
  if (isLoggedIn()) {
    const initial = (state.authUser?.email || "?").trim().charAt(0).toUpperCase() || "?";
    return `
      <div class="home-account-menu mobile-page-topline__account">
        <button
          class="home-account-menu__toggle"
          type="button"
          aria-label="\u00c5bn profilmenu"
          aria-expanded="false"
          data-home-account-toggle
        >
          ${escapeHtml(initial)}<span class="suggestion-notification-badge${getSuggestionUnreadCount() ? "" : " is-hidden"}" aria-label="${getSuggestionUnreadCount() ? `${formatSuggestionUnreadCount(getSuggestionUnreadCount())} ulæste podcastforslag` : ""}">${getSuggestionUnreadCount() ? formatSuggestionUnreadCount(getSuggestionUnreadCount()) : ""}</span>
        </button>
        <div class="home-account-menu__panel" data-home-account-menu hidden>
          <a class="home-account-menu__item" href="#profil" data-suggestion-profile-link>G\u00e5 til profil</a>
          <button class="home-account-menu__item home-account-menu__item--logout" type="button" data-home-logout>
            Log ud
          </button>
        </div>
      </div>
    `;
  }

  return `
    <button
      class="mobile-page-topline__profile"
      type="button"
      aria-label="Log ind eller opret konto"
      data-mobile-page-profile-button
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"></path>
        <path d="M4.6 20.4a7.4 4.8 0 0 1 14.8 0"></path>
      </svg>
    </button>
  `;
}

function getMobilePageToplineMarkup(extraClass = "") {
  const className = `mobile-page-topline${extraClass ? ` ${extraClass}` : ""}`;
  return `
    <div class="${className}">
      <a class="mobile-page-topline__brand" href="#forside" aria-label="G\u00e5 til forsiden">
        <span>Podcast</span><span>listen</span>
      </a>
      ${getMobileToplineProfileMarkup()}
    </div>
  `;
}

function getProfileMobilePageHeadingMarkup() {
  return `
    ${getMobilePageToplineMarkup("mobile-page-topline--profile")}
    <div class="profile-mobile-titlebar">
      <h1>Profil</h1>
    </div>
  `;
}

function handleMobileToplineProfileClick() {
  if (isLoggedIn()) {
    navigateToSuggestionNotification();
    return;
  }

  showAuthPrompt("login");
}

function bindMobileToplineProfileButtons(root = document) {
  root.querySelectorAll("[data-mobile-page-profile-button]").forEach((button) => {
    button.onclick = handleMobileToplineProfileClick;
  });
}

function renderStaticMobileToplines() {
  const rankingHeader = document.getElementById("rankingMobilePageHeader");
  if (!rankingHeader) return;

  if (getRouteInfoFromHash().route !== "ranglister") {
    rankingHeader.innerHTML = "";
    return;
  }

  rankingHeader.innerHTML = `
    ${getMobilePageToplineMarkup("mobile-page-topline--ranking")}
    <h1 class="ranking-mobile-title">Rang<span class="ranking-mobile-title__accent">liste</span></h1>
  `;
  bindMobileToplineProfileButtons(rankingHeader);
  bindHomeAccountMenu(rankingHeader);
}

function getHomeDisplayName() {
  const metadata = state.authUser?.user_metadata || {};
  const rawName =
    normalizeText(metadata.full_name) ||
    normalizeText(metadata.name) ||
    normalizeText(metadata.display_name) ||
    normalizeText(metadata.first_name);

  if (!rawName) return "";
  return rawName.split(/\s+/)[0] || rawName;
}

function getProfileRatingDisplayName() {
  const metadata = state.authUser?.user_metadata || {};
  return (
    normalizeText(metadata.full_name) ||
    normalizeText(metadata.name) ||
    normalizeText(metadata.display_name) ||
    normalizeText(metadata.first_name) ||
    "Din vurdering"
  );
}

function formatRatingCount(value) {
  const count = Number(value || 0);
  return new Intl.NumberFormat("da-DK").format(count);
}

function formatUserRatingCount(value) {
  const count = Number(value || 0);
  const label = count === 1 ? "bruger" : "brugere";
  return `${new Intl.NumberFormat("da-DK").format(count)} ${label}`;
}

function formatUserReviewCount(value) {
  const count = Number(value || 0);
  const label = count === 1 ? "brugervurdering" : "brugervurderinger";
  return `${new Intl.NumberFormat("da-DK").format(count)} ${label}`;
}

function setElementMessage(element, message = "", tone = "info") {
  if (!element) return;

  element.textContent = message;
  element.classList.toggle("is-hidden", !message);
  element.dataset.tone = tone;
}

function setAuthMessage(message = "", tone = "info", target = "both") {
  if (state.authMessageTimer) {
    window.clearTimeout(state.authMessageTimer);
    state.authMessageTimer = null;
  }

  if (target === "hero" || target === "both") {
    setElementMessage(elements.authMessage, message, tone);
  }

  if (target === "dialog" || target === "both") {
    setElementMessage(elements.authDialogMessage, message, tone);
  }

  if (message && tone === "success" && (target === "hero" || target === "both")) {
    state.authMessageTimer = window.setTimeout(() => {
      clearAuthMessage("hero");
    }, 2600);
  }
}

function clearAuthMessage(target = "both") {
  setAuthMessage("", "info", target);
}

function normalizeAuthErrorMessage(error) {
  const raw = normalizeText(error?.message || error || "");
  const lower = raw.toLowerCase();

  if (lower.includes("email rate limit exceeded")) {
    return "Der er sendt for mange mails fra Supabase lige nu. Vent lidt og prøv igen. Hvis du vil undgå det, så slå Confirm email fra i Supabase.";
  }

  if (lower.includes("user already registered")) {
    return "Den email er allerede oprettet. Prøv i stedet at logge ind.";
  }

  if (lower.includes("invalid login credentials")) {
    return "Email eller adgangskode er forkert.";
  }

  if (lower.includes("password should be at least")) {
    return "Adgangskoden skal være mindst 6 tegn.";
  }

  return raw || "Login mislykkedes.";
}

function setAuthBusy(isBusy) {
  state.authBusy = isBusy;

  [
    elements.signupButton,
    elements.loginButton,
    elements.logoutButton,
    elements.authRememberLogin,
    elements.toggleAuthPasswordButton,
    elements.forgotPasswordButton,
    elements.passwordRecoverySaveButton,
    elements.ratingSaveButton,
    elements.ratingDeleteButton
  ].forEach((button) => {
    if (button) {
      button.disabled = isBusy;
    }
  });
}

function updateAuthPasswordToggle() {
  if (!elements.authPassword || !elements.toggleAuthPasswordButton) return;

  const isVisible = elements.authPassword.type === "text";
  elements.toggleAuthPasswordButton.textContent = isVisible ? "Skjul" : "Vis";
  elements.toggleAuthPasswordButton.setAttribute("aria-pressed", String(isVisible));
  elements.toggleAuthPasswordButton.setAttribute(
    "aria-label",
    isVisible ? "Skjul adgangskode" : "Vis adgangskode"
  );
}

function toggleAuthPasswordVisibility() {
  if (!elements.authPassword || elements.toggleAuthPasswordButton?.disabled) return;

  elements.authPassword.type = elements.authPassword.type === "password" ? "text" : "password";
  updateAuthPasswordToggle();
}

function hasRecoveryLinkInHash() {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  return (
    params.get("type") === "recovery" ||
    params.has("error_code") ||
    params.has("error_description")
  );
}

function replaceVisibleRecoveryHash(hash = "") {
  // Supabase has already consumed the recovery parameters before this is called.
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${hash}`);
}

function setPasswordRecoveryMessage(message = "", tone = "info") {
  setElementMessage(elements.passwordRecoveryMessage, message, tone);
}

function openPasswordRecoveryDialog(status) {
  const dialog = elements.passwordRecoveryDialog;
  if (!dialog) return;

  state.passwordRecovery.status = status;
  const isValid = status === "valid";
  const isSuccess = status === "success";
  dialog.classList.remove("is-hidden");
  dialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-dialog-open");
  setPodcastDetailAuthLayerActive(true);

  elements.passwordRecoveryForm?.classList.toggle("is-hidden", !isValid);
  elements.passwordRecoveryCloseButton?.classList.toggle("is-hidden", isValid);
  if (isValid) {
    setPasswordRecoveryMessage("Vælg en ny adgangskode på mindst 6 tegn.", "info");
    window.setTimeout(() => elements.passwordRecoveryPassword?.focus(), 40);
  } else if (!isSuccess) {
    setPasswordRecoveryMessage("Linket er ugyldigt eller udløbet. Bed om et nyt link.", "error");
    window.setTimeout(() => elements.passwordRecoveryCloseButton?.focus(), 40);
  }
}

function closePasswordRecoveryDialog() {
  const dialog = elements.passwordRecoveryDialog;
  if (!dialog) return;

  dialog.classList.add("is-hidden");
  dialog.setAttribute("aria-hidden", "true");
  setPodcastDetailAuthLayerActive(false);
  if (elements.authDialog?.classList.contains("is-hidden") && elements.ratingDialog?.classList.contains("is-hidden")) {
    document.body.classList.remove("has-dialog-open");
  }
}

function clearPasswordRecoveryState() {
  if (state.passwordRecovery.invalidLinkTimer) {
    window.clearTimeout(state.passwordRecovery.invalidLinkTimer);
  }
  state.passwordRecovery = { status: "idle", userId: "", linkObserved: false, invalidLinkTimer: null };
  if (elements.passwordRecoveryPassword) elements.passwordRecoveryPassword.value = "";
  if (elements.passwordRecoveryPasswordRepeat) elements.passwordRecoveryPasswordRepeat.value = "";
}

function handlePasswordRecoveryEvent(session) {
  const userId = normalizeText(session?.user?.id);
  if (!userId) {
    openPasswordRecoveryDialog("invalid");
    return;
  }

  if (state.passwordRecovery.invalidLinkTimer) {
    window.clearTimeout(state.passwordRecovery.invalidLinkTimer);
    state.passwordRecovery.invalidLinkTimer = null;
  }
  state.passwordRecovery.linkObserved = true;
  state.passwordRecovery.userId = userId;
  replaceVisibleRecoveryHash("#reset-password");
  openPasswordRecoveryDialog("valid");
}

async function submitPasswordRecovery() {
  if (state.authBusy || state.passwordRecovery.status !== "valid" || !state.supabase) return;

  const password = normalizeText(elements.passwordRecoveryPassword?.value);
  const passwordRepeat = normalizeText(elements.passwordRecoveryPasswordRepeat?.value);
  if (!password || !passwordRepeat) {
    setPasswordRecoveryMessage("Indtast og gentag din nye adgangskode.", "warning");
    return;
  }
  if (password.length < 6) {
    setPasswordRecoveryMessage("Adgangskoden skal være mindst 6 tegn.", "warning");
    return;
  }
  if (password !== passwordRepeat) {
    setPasswordRecoveryMessage("Adgangskoderne matcher ikke.", "warning");
    return;
  }

  setAuthBusy(true);
  setPasswordRecoveryMessage("Gemmer ny adgangskode…", "info");
  try {
    // The user is read solely from Supabase's current authenticated recovery session.
    const { data, error: userError } = await state.supabase.auth.getUser();
    if (userError || !data.user || data.user.id !== state.passwordRecovery.userId) {
      throw new Error("RECOVERY_SESSION_INVALID");
    }

    const { error } = await state.supabase.auth.updateUser({ password });
    const samePassword = /new password should be different from the old password/i.test(normalizeText(error?.message));
    if (error && !samePassword) throw error;

    elements.passwordRecoveryPassword.value = "";
    elements.passwordRecoveryPasswordRepeat.value = "";
    state.passwordRecovery.status = "success";
    setPasswordRecoveryMessage("Din adgangskode er opdateret. Du er nu logget ind.", "success");
    replaceVisibleRecoveryHash("#profil");
    window.setTimeout(() => {
      closePasswordRecoveryDialog();
      clearPasswordRecoveryState();
      render();
    }, 1600);
  } catch (error) {
    const invalidSession = normalizeText(error?.message) === "RECOVERY_SESSION_INVALID";
    setPasswordRecoveryMessage(
      invalidSession ? "Linket er ugyldigt eller udløbet. Bed om et nyt link." : normalizeAuthErrorMessage(error),
      "error"
    );
    if (invalidSession) openPasswordRecoveryDialog("invalid");
  } finally {
    setAuthBusy(false);
  }
}

function renderAuthPanel() {
  const configured = state.authConfigured;
  const loggedIn = isLoggedIn();
  const waitingForSession = configured && !state.authReady;

  if (loggedIn && elements.authDialog && !elements.authDialog.classList.contains("is-hidden")) {
    closeAuthDialog({ clearPending: false });
  }

  elements.authLoggedOut?.classList.toggle("is-hidden", loggedIn || waitingForSession);
  elements.authLoggedIn?.classList.toggle("is-hidden", !loggedIn);
  elements.authPanel?.classList.toggle("is-authenticated", loggedIn);

  if (elements.authUserEmail) {
    elements.authUserEmail.textContent = loggedIn ? state.authUser.email || "" : "";
  }

  renderStaticMobileToplines();
  renderDesktopUserArea();

  if (loggedIn && state.supabase) {
    if (isPodcastSuggestionAdmin()) {
      if (state.adminPodcastSuggestionsLoadedFor !== state.authUser?.id && !state.adminPodcastSuggestionsLoading) {
        fetchPodcastSuggestionsForAdmin();
      }
    } else if (state.profileSuggestionsLoadedFor !== state.authUser?.id && !state.profileSuggestionsLoading) {
      fetchProfileSuggestions();
    }
  }

  if (elements.savedPodcastCount) {
    elements.savedPodcastCount.textContent = String(state.savedPodcastKeys.size);
  }

  if (elements.authEmail) {
    elements.authEmail.disabled = !configured || state.authBusy;
  }

  if (elements.authPassword) {
    elements.authPassword.disabled = !configured || state.authBusy;
  }

  if (elements.authRememberLogin) {
    elements.authRememberLogin.disabled =
      !configured || state.authBusy || state.authMode !== "login";
  }

  if (elements.toggleAuthPasswordButton) {
    elements.toggleAuthPasswordButton.disabled = !configured || state.authBusy;
  }

  if (elements.openSignupButton) {
    elements.openSignupButton.disabled = !configured;
  }

  if (elements.openLoginButton) {
    elements.openLoginButton.disabled = !configured;
  }

  if (elements.savedFilterButton) {
    elements.savedFilterButton.disabled = !configured || !loggedIn;
    elements.savedFilterButton.textContent =
      state.activeFilter?.type === "saved" ? "Vis alle" : "Vis gemte";
  }

  if (elements.signupButton) {
    elements.signupButton.disabled = !configured || state.authBusy;
  }

  if (elements.loginButton) {
    elements.loginButton.disabled = !configured || state.authBusy;
  }

  if (elements.logoutButton) {
    elements.logoutButton.disabled = !configured || state.authBusy;
  }

  if (!configured) {
    setAuthMessage(
      "Tilføj Supabase URL og anon key i window.PODCAST_SUPABASE_CONFIG for at aktivere login.",
      "warning",
      "hero"
    );
  }
}

function getCommunityStat(podcastKey) {
  const canonicalKey = resolveCanonicalPodcastId(podcastKey) || normalizeText(podcastKey);
  if (state.communityStatsByKey[canonicalKey]) {
    return state.communityStatsByKey[canonicalKey];
  }

  const podcast = resolvePodcastByStoredKey(podcastKey);
  if (!podcast) return null;

  if (podcast.userAverageRating === null || podcast.userAverageRating === undefined) {
    return null;
  }

  return {
    averageRating: podcast.userAverageRating,
    ratingCount: Number(podcast.userRatingCount || 0)
  };
}

function hasCommunityRating(stat) {
  return stat?.averageRating !== null && stat?.averageRating !== undefined;
}

function resetRatingDialogMode() {
  state.ratingDialogMode = "podcast";
  state.activeEpisodeRatingId = null;
  elements.ratingDialog?.classList.remove("rating-dialog--episode");
  const eyebrow = elements.ratingDialog?.querySelector(".rating-dialog__eyebrow");
  if (eyebrow) eyebrow.textContent = "Din vurdering";
  const hint = elements.ratingDialog?.querySelector(".rating-dialog__hint");
  if (hint) {
    hint.textContent = "Du kan altid \u00e6ndre eller fjerne din vurdering senere.";
  }
}

function updateLocalCommunityStatForRating(podcastKey, nextRating, previousRating = null) {
  if (!podcastKey) return;

  const currentStat = getCommunityStat(podcastKey);
  const currentAverage = parseNumber(currentStat?.averageRating);
  const previousValue = parseNumber(previousRating);
  const nextValue = parseNumber(nextRating);
  const hadPrevious = previousValue !== null;
  const currentCount = Math.max(0, Number(currentStat?.ratingCount || 0));

  if (nextValue === null) {
    if (!hadPrevious) return;

    const nextCount = Math.max(0, currentCount - 1);
    if (!nextCount) {
      delete state.communityStatsByKey[podcastKey];
      invalidateRankingListCache();
      return;
    }

    state.communityStatsByKey[podcastKey] = {
      averageRating:
        currentAverage === null
          ? null
          : (currentAverage * currentCount - previousValue) / nextCount,
      ratingCount: nextCount
    };
    invalidateRankingListCache();
    return;
  }

  const nextCount = hadPrevious ? Math.max(1, currentCount || 1) : currentCount + 1;
  const baseAverage = currentAverage ?? 0;
  state.communityStatsByKey[podcastKey] = {
    averageRating: hadPrevious
      ? (baseAverage * nextCount - previousValue + nextValue) / nextCount
      : (baseAverage * currentCount + nextValue) / nextCount,
    ratingCount: nextCount
  };
  invalidateRankingListCache();
}

function readEpisodeParentRatingBackups() {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(EPISODE_PARENT_RATING_BACKUP_STORAGE_KEY) || "{}"
    );
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeEpisodeParentRatingBackups(backups) {
  try {
    window.localStorage.setItem(
      EPISODE_PARENT_RATING_BACKUP_STORAGE_KEY,
      JSON.stringify(backups || {})
    );
    return true;
  } catch {
    return false;
  }
}

function getEpisodeParentRatingBackup(podcastKey, { local = false } = {}) {
  const userId = state.authUser?.id;
  const key = local ? getLocalEpisodePodcastKey(podcastKey) : normalizeText(podcastKey);
  if (!userId || !key) return null;
  const userBackups = readEpisodeParentRatingBackups()?.[userId] || {};
  if (userBackups[key]) return userBackups[key];

  if (!local) return null;
  const podcast = resolvePodcastByStoredKey(key);
  const legacyKey = getLegacyPodcastKey(podcast);
  return getPodcastId(resolvePodcastByStoredKey(legacyKey)) === key
    ? userBackups[legacyKey] ?? null
    : null;
}

function captureEpisodeParentRatingBackup(podcastKey, { local = false } = {}) {
  const userId = state.authUser?.id;
  const key = local ? getLocalEpisodePodcastKey(podcastKey) : normalizeText(podcastKey);
  if (!userId || !key || getEpisodeParentRatingBackup(key, { local })) return false;

  const manualRating = parseNumber(
    state.userRatingsByKey[resolveCanonicalPodcastId(key) || key]
  );
  const backups = readEpisodeParentRatingBackups();
  backups[userId] = {
    ...(backups[userId] || {}),
    [key]: {
      hasManualRating: manualRating !== null,
      manualRating
    }
  };
  return writeEpisodeParentRatingBackups(backups);
}

function clearEpisodeParentRatingBackup(podcastKey, { local = false } = {}) {
  const userId = state.authUser?.id;
  const key = local ? getLocalEpisodePodcastKey(podcastKey) : normalizeText(podcastKey);
  if (!userId || !key) return;

  const backups = readEpisodeParentRatingBackups();
  if (!backups[userId]) return;
  delete backups[userId][key];
  if (local) {
    const podcast = resolvePodcastByStoredKey(key);
    const legacyKey = getLegacyPodcastKey(podcast);
    if (getPodcastId(resolvePodcastByStoredKey(legacyKey)) === key) {
      delete backups[userId][legacyKey];
    }
  }
  if (!Object.keys(backups[userId]).length) delete backups[userId];
  writeEpisodeParentRatingBackups(backups);
}

async function persistEffectiveParentRating(
  podcastKey,
  nextRating,
  previousEffectiveRating = null
) {
  const key = normalizeText(podcastKey);
  const nextValue = parseNumber(nextRating);
  const previousValue = parseNumber(previousEffectiveRating);
  if (!state.supabase || !state.authUser || !key) {
    throw new Error("Forældrepodcastens vurdering kunne ikke synkroniseres.");
  }

  if (nextValue === null) {
    const { error } = await state.supabase
      .from("user_ratings")
      .delete()
      .eq("user_id", state.authUser.id)
      .eq("podcast_key", key);
    if (error) throw error;
    delete state.userRatingsByKey[key];
  } else {
    const { error } = await state.supabase.from("user_ratings").upsert(
      {
        user_id: state.authUser.id,
        podcast_key: key,
        rating: nextValue
      },
      { onConflict: "user_id,podcast_key" }
    );
    if (error) throw error;
    state.userRatingsByKey[key] = nextValue;
  }

  updateLocalCommunityStatForRating(key, nextValue, previousValue);
  invalidateExplorePersonalSnapshot();
}

async function synchronizeEpisodeDerivedParentRating(
  podcastKey,
  previousEffectiveRating = null,
  { refreshUi = true, local = false } = {}
) {
  const episodeKey = local
    ? getLocalEpisodePodcastKey(podcastKey)
    : getEpisodePodcastKey(podcastKey);
  const canonicalKey = resolveCanonicalPodcastId(podcastKey);
  if (!episodeKey || !canonicalKey) return;
  const summary = getPodcastEpisodeUserRatingSummary(episodeKey);
  const backup = getEpisodeParentRatingBackup(episodeKey, { local });
  const nextEffectiveRating =
    summary.count > 0
      ? Math.round(Number(summary.average) * 10) / 10
      : backup?.hasManualRating
        ? parseNumber(backup.manualRating)
        : null;

  await persistEffectiveParentRating(canonicalKey, nextEffectiveRating, previousEffectiveRating);

  if (summary.count === 0) {
    clearEpisodeParentRatingBackup(episodeKey, { local });
    delete state.episodeParentRatingSyncSignatures[episodeKey];
  } else {
    state.episodeParentRatingSyncSignatures[episodeKey] =
      `${summary.count}:${formatCompactRating(nextEffectiveRating)}`;
  }

  rebuildUserRanks();
  if (refreshUi) {
    render();
    refreshOpenPodcastDetailSheet();
  }
}

async function reconcileExistingEpisodeDerivedParentRating(podcastKey) {
  const local = usesLocalEpisodePersistence(podcastKey);
  const episodeKey = local
    ? getLocalEpisodePodcastKey(podcastKey)
    : getEpisodePodcastKey(podcastKey);
  const canonicalKey = resolveCanonicalPodcastId(podcastKey);
  const summary = getPodcastEpisodeUserRatingSummary(episodeKey);
  if (!state.authUser || !episodeKey || !canonicalKey || summary.count === 0) return;

  const derivedRating = Math.round(Number(summary.average) * 10) / 10;
  const signature = `${summary.count}:${formatCompactRating(derivedRating)}`;
  if (
    state.episodeParentRatingSyncPendingKeys.has(episodeKey) ||
    (state.episodeParentRatingSyncSignatures[episodeKey] === signature &&
      parseNumber(state.userRatingsByKey[canonicalKey]) === derivedRating)
  ) {
    return;
  }

  if (!getEpisodeParentRatingBackup(episodeKey, { local })) {
    captureEpisodeParentRatingBackup(episodeKey, { local });
    if (!getEpisodeParentRatingBackup(episodeKey, { local })) {
      console.error("Din tidligere samlede vurdering kunne ikke bevares.");
      return;
    }
  }

  const previousEffectiveRating = state.userRatingsByKey[canonicalKey] ?? null;
  state.episodeParentRatingSyncPendingKeys.add(episodeKey);
  try {
    await synchronizeEpisodeDerivedParentRating(episodeKey, previousEffectiveRating, { local });
  } catch (error) {
    console.error(error);
    setAuthMessage(
      "Episodegennemsnittet kunne ikke synkroniseres med podcastens samlede vurdering.",
      "warning"
    );
  } finally {
    state.episodeParentRatingSyncPendingKeys.delete(episodeKey);
  }
}

function getExploreSortStats(podcast) {
  const communityStat = getCommunityStat(getPodcastKey(podcast));
  return {
    hasCommunityRating: hasCommunityRating(communityStat),
    communityRating: parseNumber(communityStat?.averageRating),
    ratingCount: Number(communityStat?.ratingCount || 0),
    madsRating: parseNumber(podcast.ratingValue)
  };
}

function compareExplorePodcasts(a, b) {
  const aStats = getExploreSortStats(a);
  const bStats = getExploreSortStats(b);

  if (aStats.hasCommunityRating !== bStats.hasCommunityRating) {
    return aStats.hasCommunityRating ? -1 : 1;
  }

  const aCommunityRating = aStats.communityRating ?? -1;
  const bCommunityRating = bStats.communityRating ?? -1;
  if (bCommunityRating !== aCommunityRating) {
    return bCommunityRating - aCommunityRating;
  }

  if (bStats.ratingCount !== aStats.ratingCount) {
    return bStats.ratingCount - aStats.ratingCount;
  }

  const aMadsRating = aStats.madsRating ?? -1;
  const bMadsRating = bStats.madsRating ?? -1;
  if (bMadsRating !== aMadsRating) {
    return bMadsRating - aMadsRating;
  }

  return normalizeText(a.title).localeCompare(normalizeText(b.title), "da", {
    sensitivity: "base"
  });
}

function getUserRating(podcastKey) {
  const canonicalKey = resolveCanonicalPodcastId(podcastKey) || normalizeText(podcastKey);
  return state.userRatingsByKey[canonicalKey] ?? null;
}

function getLoosePodcastRatingKey(value) {
  return normalizeMatchKey(String(value || "").replace(/\([^)]*\)/g, " "))
    .replace(/\bsaeson\b|\bsæson\b|\bseason\b/g, " ")
    .replace(/\b[0-9]+\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getUserRatingForPodcast(podcast) {
  if (!podcast) return null;

  const keys = [
    getPodcastKey(podcast),
    podcast.key,
    podcast.matchKey,
    podcast.titleKey,
    normalizeMatchKey(podcast.title)
  ].filter(Boolean);

  for (const key of Array.from(new Set(keys))) {
    const rating = getUserRating(key);
    if (rating !== null && rating !== undefined) return rating;
  }

  const looseKey = getLoosePodcastRatingKey(podcast.title);
  if (!looseKey) return null;

  for (const [ratingKey, rating] of Object.entries(state.userRatingsByKey)) {
    const looseRatingKey = getLoosePodcastRatingKey(ratingKey);
    if (
      looseRatingKey &&
      (looseRatingKey === looseKey ||
        looseRatingKey.includes(looseKey) ||
        looseKey.includes(looseRatingKey))
    ) {
      return rating;
    }
  }

  return null;
}

function getMobileRankingRatingParts(podcast) {
  const key = getPodcastKey(podcast);
  const communityStat = getCommunityStat(key);
  const primary =
    state.rankingSource === "users"
      ? {
          label: "Brugere",
          value: hasCommunityRating(communityStat) ? communityStat.averageRating : null
        }
      : {
          label: "Podcastlisten",
          value: podcast.ratingValue ?? null
        };
  const parts = [
    `${primary.label} ${
      primary.value !== null && primary.value !== undefined ? formatCompactRating(primary.value) : "-"
    }`
  ];
  const ownRating = isLoggedIn() ? getUserRatingForPodcast(podcast) : null;

  if (ownRating !== null && ownRating !== undefined) {
    parts.push(`${getProfileRatingDisplayName()} ${formatCompactRating(ownRating)}`);
  }

  return parts;
}

function getMobileRankingScoreFields(podcast) {
  const key = getPodcastKey(podcast);
  const communityStat = getCommunityStat(key);
  const primary =
    state.rankingSource === "users"
      ? {
          label: "Brugere",
          value: hasCommunityRating(communityStat) ? communityStat.averageRating : null,
          type: "primary",
          source: "users"
        }
      : {
          label: "Podcastlisten",
          value: podcast.ratingValue ?? null,
          type: "primary",
          source: "mads"
        };
  const fields = [];

  if (primary.value !== null && primary.value !== undefined) {
    fields.push(primary);
  }

  const ownRating = isLoggedIn() ? getUserRatingForPodcast(podcast) : null;

  if (ownRating !== null && ownRating !== undefined) {
    fields.push({
      label: "Din",
      value: ownRating,
      type: "own",
      source: "own"
    });
  }

  return fields;
}

function getMobileRankingScoreMarkup(podcast) {
  return getMobileRankingScoreFields(podcast)
    .map(
      (field) => `
        <span class="podcast-card__mobile-score-field podcast-card__mobile-score-field--${field.type} podcast-card__mobile-score-field--${field.source}">
          <span class="podcast-card__mobile-score-label">${field.type === "primary" ? "✓" : escapeHtml(field.label)}</span>
          <span class="podcast-card__mobile-score-spacer" aria-hidden="true"> </span>
          <strong class="podcast-card__mobile-score-value">${escapeHtml(formatCompactRating(field.value))}</strong>
        </span>
      `
    )
    .join("");
}

function getMobileRankingRatingText(podcast) {
  return getMobileRankingRatingParts(podcast).join(" \u00b7 ");
}

function isDesktopRankingViewport() {
  return Boolean(
    typeof window !== "undefined" &&
      window.matchMedia?.("(min-width: 1101px)").matches
  );
}

function hasDesktopUserRankingSort() {
  return isDesktopRankingViewport() && state.rankingSource === "users";
}

function syncDesktopRankingSearchPlacement() {
  const searchStrip = document.querySelector(".ranking-search-strip");
  const mainColumn = document.querySelector(".ranking-main-column");
  const listPanel = document.querySelector(".ranking-list-panel");
  const podcastGrid = document.getElementById("podcastGrid");
  if (!searchStrip || !mainColumn || !listPanel || !podcastGrid) return;

  if (elements.clearFilterButton) {
    elements.clearFilterButton.textContent =
      isDesktopRankingViewport() && document.body.classList.contains("page-ranglister")
      ? "Nulstil alle filtre"
      : "Ryd alle";
  }

  const useDesktopRanking =
    isDesktopRankingViewport() && document.body.classList.contains("page-ranglister");
  if (useDesktopRanking) {
    if (searchStrip.parentElement !== listPanel || searchStrip.nextElementSibling !== podcastGrid) {
      listPanel.insertBefore(searchStrip, podcastGrid);
    }
    return;
  }

  if (searchStrip.parentElement !== mainColumn) {
    mainColumn.insertBefore(searchStrip, listPanel);
  }
}

function getDesktopRankingScore(podcast) {
  const communityStat = getCommunityStat(getPodcastKey(podcast));
  const isUserRanking = state.rankingSource === "users";
  const value = isUserRanking
    ? parseNumber(communityStat?.averageRating ?? podcast.userAverageRating)
    : parseNumber(podcast.ratingValue);

  return {
    label: isUserRanking ? "Brugernes vurdering" : "Podcastlistens vurdering",
    sourceLabel: isUserRanking ? "Brugere" : "Podcastlisten",
    value,
    showCount: isUserRanking,
    count: isUserRanking
      ? Number(communityStat?.ratingCount ?? podcast.userRatingCount ?? 0)
      : 0
  };
}

function getDesktopRankingOwnScore(podcast) {
  if (!isLoggedIn()) return null;
  return parseNumber(getUserRatingForPodcast(podcast));
}

function getDesktopRankingUserCountText(score) {
  if (!score.showCount) return "";
  if (score.count <= 0) return "Ingen brugere endnu";
  return `${score.count} ${score.count === 1 ? "bruger" : "brugere"}`;
}

function getDesktopRankingScoreMarkup(score) {
  const value =
    score.value === null || score.value === undefined
      ? "\u2014"
      : formatCompactRating(score.value);
  const countText = score.showCount
    ? `<span class="desktop-ranking-score__count">${escapeHtml(
        getDesktopRankingUserCountText(score)
      )}</span>`
    : "";

  return `
    <div class="desktop-ranking-score">
      <span class="desktop-ranking-score__line">
        <span class="desktop-ranking-score__star" aria-hidden="true">\u2605</span>
        <strong>${escapeHtml(value)}</strong>
        <span>/10</span>
      </span>
      <span class="desktop-ranking-score__label">${escapeHtml(score.label)}</span>
      ${countText}
    </div>
  `;
}

function setDesktopRankingCover(container, podcast) {
  if (!container.querySelector(".desktop-ranking-cover__image")) return;
  setImage(container, getPodcastImageSources(podcast), podcast.title);
}

function formatDesktopRankingPlacement(value) {
  const placement = normalizeText(value).replace(/^#\s*/, "");
  return placement && placement !== "\u2014" && placement !== "-"
    ? `#${placement}`
    : "\u2014";
}

function escapeRegularExpression(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getPodcastAccessIndicatorMarkup(podcast, { detail = false } = {}) {
  if (podcast?.accessType !== "partial" && podcast?.accessType !== "paid") {
    return "";
  }

  const iconMarkup = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path></svg>`;
  if (detail) {
    return `<span class="podcast-access-detail" role="img" aria-label="Ikke fuldt gratis – kræver abonnement">${iconMarkup}<span>Kræver abonnement</span></span>`;
  }

  return `<span class="podcast-access-indicator" role="img" aria-label="Ikke fuldt gratis – kræver abonnement">${iconMarkup}</span>`;
}

let podcastAccessTooltip = null;
let activePodcastAccessIndicator = null;

function canShowPodcastAccessTooltip() {
  return Boolean(
    window.matchMedia?.("(hover: hover) and (pointer: fine)").matches
  );
}

function getPodcastAccessTooltip() {
  if (podcastAccessTooltip?.isConnected) return podcastAccessTooltip;

  podcastAccessTooltip = document.getElementById("podcastAccessTooltip");
  if (!podcastAccessTooltip) {
    podcastAccessTooltip = document.createElement("div");
    podcastAccessTooltip.id = "podcastAccessTooltip";
    podcastAccessTooltip.className = "podcast-access-tooltip";
    podcastAccessTooltip.setAttribute("role", "tooltip");
    podcastAccessTooltip.textContent = "Kræver abonnement";
    document.body.appendChild(podcastAccessTooltip);
  }

  return podcastAccessTooltip;
}

function hidePodcastAccessTooltip() {
  activePodcastAccessIndicator = null;
  if (!podcastAccessTooltip) return;

  podcastAccessTooltip.classList.remove("is-visible");
  podcastAccessTooltip.hidden = true;
}

function showPodcastAccessTooltip(indicator) {
  if (!canShowPodcastAccessTooltip() || !indicator?.isConnected) return;

  const tooltip = getPodcastAccessTooltip();
  const indicatorRect = indicator.getBoundingClientRect();
  const edgeMargin = 8;
  const offset = 8;

  tooltip.hidden = false;
  tooltip.classList.remove("is-visible");
  tooltip.style.left = "0px";
  tooltip.style.top = "0px";

  const tooltipRect = tooltip.getBoundingClientRect();
  let left = indicatorRect.left + indicatorRect.width / 2 - tooltipRect.width / 2;
  let top = indicatorRect.top - tooltipRect.height - offset;

  if (top < edgeMargin) {
    top = indicatorRect.bottom + offset;
  }

  left = Math.max(
    edgeMargin,
    Math.min(left, window.innerWidth - tooltipRect.width - edgeMargin)
  );

  tooltip.style.left = `${Math.round(left)}px`;
  tooltip.style.top = `${Math.round(top)}px`;
  tooltip.classList.add("is-visible");
  activePodcastAccessIndicator = indicator;
}

function bindPodcastAccessTooltip() {
  document.addEventListener("pointerover", (event) => {
    if (!canShowPodcastAccessTooltip() || !(event.target instanceof Element)) return;

    const indicator = event.target.closest(".podcast-access-indicator");
    if (!indicator || indicator === activePodcastAccessIndicator) return;
    showPodcastAccessTooltip(indicator);
  });

  document.addEventListener("pointerout", (event) => {
    if (!(event.target instanceof Element)) return;

    const indicator = event.target.closest(".podcast-access-indicator");
    if (!indicator || indicator.contains(event.relatedTarget)) return;
    hidePodcastAccessTooltip();
  });

  window.addEventListener("scroll", hidePodcastAccessTooltip, {
    capture: true,
    passive: true
  });
  window.addEventListener("resize", hidePodcastAccessTooltip, { passive: true });
}

function getDesktopRankingTitleParts(podcast) {
  const series = normalizeText(podcast?.mainSeries);
  const title = normalizeText(podcast?.title);

  if (!series || !title) {
    return {
      series: "",
      seriesLinkText: "",
      titleText: title,
      displayText: title
    };
  }

  const flexibleSeriesPattern = series
    .split(/\s+/)
    .map(escapeRegularExpression)
    .join("\\s+");
  const prefixPattern = new RegExp(
    `^\\s*(${flexibleSeriesPattern})(?=\\s*(?::|[-\\u2013\\u2014])|\\s|$)\\s*(?::\\s*)?`,
    "iu"
  );
  const prefixMatch = title.match(prefixPattern);
  let titleText = prefixMatch ? title.slice(prefixMatch[0].length).trim() : title;
  const isHvemErSeries = normalizeComparable(series) === "hvem er...";

  if (isHvemErSeries) {
    titleText = titleText.replace(/^hvem\s+er\s+/iu, "").trim();
  }

  return {
    series,
    seriesLinkText: `${series}${titleText && !isHvemErSeries ? ":" : ""}`,
    titleText,
    displayText: title
  };
}

function getDesktopRankingTitleMarkup(podcast, variant) {
  const { series, seriesLinkText, titleText, displayText } =
    getDesktopRankingTitleParts(podcast);
  const titleClass =
    variant === "top" ? "desktop-ranking-title" : "desktop-ranking-row__title";

  if (!series) {
    return `
      <button class="${titleClass}" type="button" data-action="open-details">
        ${escapeHtml(displayText)}${getPodcastAccessIndicatorMarkup(podcast)}
      </button>
    `;
  }

  return `
    <span class="desktop-ranking-title-flow desktop-ranking-title-flow--${variant}">
      <button
        class="desktop-ranking-main-series-link"
        type="button"
        data-action="filter-desktop-main-series"
        data-value="${escapeHtml(series)}"
        aria-label="Filtr\u00e9r efter hovedserien ${escapeHtml(series)}"
      >${escapeHtml(seriesLinkText)}</button>${titleText ? ` <button
        class="desktop-ranking-title-rest"
        type="button"
        data-action="open-details"
        aria-label="Vis detaljer om ${escapeHtml(displayText)}"
      >${escapeHtml(titleText)}${getPodcastAccessIndicatorMarkup(podcast)}</button>` : getPodcastAccessIndicatorMarkup(podcast)}
    </span>
  `;
}

function createDesktopRankingTopCardElement(podcast, displayRank = null) {
  const key = getPodcastKey(podcast);
  const score = getDesktopRankingScore(podcast);
  const ownScore = getDesktopRankingOwnScore(podcast);
  const placementDisplay = getPodcastPlacementDisplay(podcast);
  const article = document.createElement("article");
  const rankText =
    displayRank ?? (placementDisplay.hasPlacement ? placementDisplay.value : "\u2014");
  const rankLabel = formatDesktopRankingPlacement(rankText);
  const ownScoreText = ownScore === null ? "\u2014" : `${formatCompactRating(ownScore)} / 10`;

  article.className = "podcast-card desktop-ranking-top-card";
  article.dataset.key = key;
  article.innerHTML = `
    <span class="desktop-ranking-rank" aria-label="Placering ${escapeHtml(String(rankText))}">
      ${escapeHtml(rankLabel)}
    </span>
    <button
      class="favorite-button desktop-ranking-top-card__favorite"
      type="button"
      aria-label="Gem som favorit"
    >
      <span aria-hidden="true"></span>
    </button>
    <button
      class="desktop-ranking-cover"
      type="button"
      data-action="open-details"
      aria-label="Vis detaljer om ${escapeHtml(podcast.title)}"
    >
      <img class="desktop-ranking-cover__image" alt="" loading="lazy" />
      <span class="image-placeholder" aria-hidden="true">
        <span class="image-placeholder-icon">\u25a1</span>
        <span class="image-placeholder-label">Billede mangler</span>
      </span>
    </button>
    <div class="desktop-ranking-top-card__copy">
      <span class="desktop-ranking-publisher-list">
        ${getDesktopPublisherLinksMarkup(
          podcast.publisher || "Ukendt udgiver",
          "desktop-ranking-publisher"
        )}
      </span>
      ${getDesktopRankingTitleMarkup(podcast, "top")}
      <p class="desktop-ranking-host">${escapeHtml(podcast.host || "")}</p>
      ${getDesktopRankingScoreMarkup(score)}
    </div>
    <div class="desktop-ranking-top-card__actions">
      <button
        class="desktop-ranking-own-score"
        type="button"
        data-action="open-rating"
        aria-label="Din vurdering af ${escapeHtml(podcast.title)}"
      >
        <svg class="desktop-ranking-own-score__icon" aria-hidden="true" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="3.5"></circle>
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0"></path>
        </svg>
        <span>Din vurdering</span>
        <strong>${escapeHtml(ownScoreText)}</strong>
      </button>
      <button class="desktop-ranking-open" type="button" data-action="open-details">
        <span aria-hidden="true">\u25b6</span> \u00c5bn
      </button>
    </div>
  `;

  setDesktopRankingCover(article, podcast);
  renderFavoriteButton(article.querySelector(".favorite-button"), key);
  return article;
}

function createDesktopRankingTableRowElement(podcast, displayRank = null) {
  const key = getPodcastKey(podcast);
  const score = getDesktopRankingScore(podcast);
  const ownScore = getDesktopRankingOwnScore(podcast);
  const placementDisplay = getPodcastPlacementDisplay(podcast);
  const article = document.createElement("article");
  const rankText =
    displayRank ?? (placementDisplay.hasPlacement ? placementDisplay.value : "\u2014");
  const rankLabel = formatDesktopRankingPlacement(rankText);
  const scoreText = score.value === null ? "\u2014" : formatCompactRating(score.value);
  const ownScoreText = ownScore === null ? "\u2014" : formatCompactRating(ownScore);
  const hasExternalLink = isValidPodcastLink(podcast.link);

  article.className = "podcast-card desktop-ranking-row";
  article.dataset.key = key;
  article.setAttribute("role", "row");
  article.innerHTML = `
    <span class="desktop-ranking-row__rank" role="cell" aria-label="Placering ${escapeHtml(String(rankText))}">${escapeHtml(rankLabel)}</span>
    <div class="desktop-ranking-row__podcast" role="cell">
      <button
        class="desktop-ranking-row__cover desktop-ranking-cover"
        type="button"
        data-action="open-details"
        aria-label="Vis detaljer om ${escapeHtml(podcast.title)}"
      >
        <img class="desktop-ranking-cover__image" alt="" loading="lazy" />
        <span class="image-placeholder" aria-hidden="true">
          <span class="image-placeholder-icon">\u25a1</span>
          <span class="image-placeholder-label">Billede mangler</span>
        </span>
      </button>
      <span class="desktop-ranking-row__identity">
        ${getDesktopRankingTitleMarkup(podcast, "row")}
        <span>${escapeHtml(podcast.host || "")}</span>
      </span>
    </div>
    <span class="desktop-ranking-row__publisher" role="cell">
      ${getDesktopPublisherLinksMarkup(podcast.publisher || "Ukendt")}
    </span>
    <span class="desktop-ranking-row__score" role="cell">
      <span class="desktop-ranking-row__score-line">
        <span aria-hidden="true">\u2605</span>
        <strong>${escapeHtml(scoreText)}</strong>
        <small>/ 10</small>
      </span>
      ${
        score.showCount
          ? `<span class="desktop-ranking-row__score-count">${escapeHtml(
              getDesktopRankingUserCountText(score)
            )}</span>`
          : ""
      }
    </span>
    <button
      class="desktop-ranking-row__own${ownScore === null ? " is-empty" : ""}"
      type="button"
      data-action="open-rating"
      role="cell"
      aria-label="Din vurdering af ${escapeHtml(podcast.title)}"
    >
      <span class="desktop-ranking-row__own-star" aria-hidden="true">\u2605</span>
      <strong>${escapeHtml(ownScoreText)}</strong>
      <small>/ 10</small>
    </button>
    <span class="desktop-ranking-row__actions" role="cell">
      <button
        class="desktop-ranking-row__external-link"
        type="button"
        data-action="open-link"
        aria-label="${
          hasExternalLink
            ? `\u00c5bn eksternt link til ${escapeHtml(podcast.title)}`
            : `Mangler eksternt link til ${escapeHtml(podcast.title)}`
        }"
        data-tooltip="${hasExternalLink ? "Link til podcasten" : "Link mangler"}"
        ${hasExternalLink ? "" : "disabled"}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M14 5h5v5"></path>
          <path d="M10 14 19 5"></path>
          <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"></path>
        </svg>
      </button>
      <button class="favorite-button" type="button" aria-label="Gem som favorit" data-tooltip="Gem til senere">
        <span aria-hidden="true"></span>
      </button>
    </span>
  `;

  setDesktopRankingCover(article, podcast);
  renderFavoriteButton(article.querySelector(".favorite-button"), key);
  return article;
}

function updateDesktopRankingSourceContext() {
  const toolbar = document.querySelector(".ranking-toolbar");
  const searchStrip = document.querySelector(".ranking-search-strip");
  if (!toolbar) return;

  let note = toolbar.querySelector(".desktop-ranking-source-note");
  let layoutToggle = toolbar.querySelector(".desktop-ranking-layout-toggle");
  const filterPanelHeader = document.querySelector(".ranking-filter-panel__header");
  let activeFilters = filterPanelHeader?.querySelector(".desktop-ranking-active-filters");
  let searchFilters = searchStrip?.querySelector(".desktop-ranking-search-filter-summary");
  if (!isDesktopRankingViewport()) {
    note?.remove();
    layoutToggle?.remove();
    activeFilters?.remove();
    searchFilters?.remove();
    searchStrip?.classList.remove("has-desktop-ranking-filters");
    return;
  }

  if (!note) {
    note = document.createElement("p");
    note.className = "desktop-ranking-source-note";
    toolbar.appendChild(note);
  }
  const sourceText =
    state.rankingSource === "users"
      ? "\u2605 Baseret p\u00e5 brugernes vurderinger"
      : "\u2605 Baseret p\u00e5 Podcastlistens vurderinger";
  note.textContent = sourceText;

  if (!layoutToggle) {
    layoutToggle = document.createElement("button");
    layoutToggle.className = "desktop-ranking-layout-toggle";
    layoutToggle.type = "button";
    toolbar.appendChild(layoutToggle);
  }
  const showsCards = state.desktopRankingLayout === "cards";
  layoutToggle.textContent = showsCards ? "Vis som liste" : "Vis som kort";
  layoutToggle.setAttribute("aria-label", showsCards ? "Vis ranglisten som liste" : "Vis ranglisten som kort");
  layoutToggle.setAttribute("aria-pressed", String(showsCards));
  layoutToggle.onclick = () => {
    state.desktopRankingLayout =
      state.desktopRankingLayout === "cards" ? "list" : "cards";
    persistDesktopRankingLayoutPreference(state.desktopRankingLayout);
    renderPodcastGrid();
  };

  const categoryFilters = getActiveCategoryFilters();
  if (!filterPanelHeader || !categoryFilters.length) {
    activeFilters?.remove();
  } else {
    if (!activeFilters) {
      activeFilters = document.createElement("div");
      activeFilters.className = "desktop-ranking-active-filters";
      activeFilters.setAttribute("aria-label", "Aktive filtre");
      filterPanelHeader.insertBefore(activeFilters, elements.clearFilterButton || null);
    }

    activeFilters.innerHTML = `
    <span class="desktop-ranking-active-filters__label">Aktive filtre</span>
    <div class="desktop-ranking-active-filters__chips">
      ${categoryFilters
        .map(
          (filter) => `
            <button
              class="desktop-ranking-active-filter-chip"
              type="button"
              data-clear-category-filter="${escapeHtml(filter.type)}"
              aria-label="Fjern filteret ${escapeHtml(filter.label)}: ${escapeHtml(filter.value)}"
            >
              <span class="desktop-ranking-active-filter-chip__text">${escapeHtml(filter.label)}: ${escapeHtml(filter.value)}</span>
              <span aria-hidden="true">\u00d7</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;
    activeFilters.onclick = (event) => {
      const button = event.target.closest("[data-clear-category-filter]");
      if (!button) return;
      const type = button.dataset.clearCategoryFilter || "";
      if (type === "publisher") {
        clearDesktopPublisherFilter();
      } else if (type === "mainSeries") {
        clearDesktopMainSeriesFilter();
      } else {
        clearCategoryFilter(type);
      }
    };
  }

  const searchFilterItems = [
    ...categoryFilters.map((filter) => ({
      ...filter,
      label:
        filter.type === "genre"
          ? filter.value
          : filter.type === "mainSeries"
            ? `Serie: ${filter.value}`
            : `${filter.label}: ${filter.value}`
    })),
    ...(state.minimumRating > 0
      ? [{ type: "minimumRating", label: `Min. vurdering: ${formatMinimumRating(state.minimumRating)}` }]
      : [])
  ];

  if (!searchStrip || !searchFilterItems.length) {
    searchFilters?.remove();
    searchStrip?.classList.remove("has-desktop-ranking-filters");
    return;
  }

  if (!searchFilters) {
    searchFilters = document.createElement("div");
    searchFilters.className = "desktop-ranking-search-filter-summary";
    searchFilters.setAttribute("aria-label", "Aktive filtre");
    searchStrip.appendChild(searchFilters);
  }

  searchStrip.classList.add("has-desktop-ranking-filters");
  searchFilters.innerHTML = searchFilterItems
    .map(
      (filter) => `
        <button
          class="desktop-ranking-active-filter-chip"
          type="button"
          ${
            filter.type === "minimumRating"
              ? "data-clear-minimum-rating"
              : `data-clear-category-filter="${escapeHtml(filter.type)}"`
          }
          aria-label="Fjern filteret ${escapeHtml(filter.label)}"
        >
          <span class="desktop-ranking-active-filter-chip__text">${escapeHtml(filter.label)}</span>
          <span aria-hidden="true">×</span>
        </button>
      `
    )
    .join("");
  searchFilters.onclick = (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.hasAttribute("data-clear-minimum-rating")) {
      setMinimumRating(0);
      return;
    }
    const type = button.dataset.clearCategoryFilter || "";
    if (type === "publisher") {
      clearDesktopPublisherFilter();
    } else if (type === "mainSeries") {
      clearDesktopMainSeriesFilter();
    } else {
      clearCategoryFilter(type);
    }
  };
}

function renderDesktopRanking(podcasts) {
  const activeScoreLabel =
    state.rankingSource === "users"
      ? "Brugernes vurdering"
      : "Podcastlistens vurdering";
  const canToggleUserSortDirection = state.rankingSource === "users";
  const userSortDirection = state.userRankingDirection === "asc" ? "asc" : "desc";
  const showsCards = state.desktopRankingLayout === "cards";

  if (showsCards) {
    const top = document.createElement("section");
    top.className = "desktop-ranking-top";
    top.setAttribute("aria-label", "Ranglisten som kort");

    podcasts.forEach((podcast, index) => {
      const displayRank = getRankingDisplayRank(index);
      top.appendChild(createDesktopRankingTopCardElement(podcast, displayRank));
    });
    elements.podcastGrid.appendChild(top);
    return;
  }

  if (!podcasts.length) return;

  const table = document.createElement("section");
  table.className = "desktop-ranking-table";
  table.setAttribute("role", "table");
  table.setAttribute(
    "aria-label",
    "Hele ranglisten som liste"
  );
  table.innerHTML = `
    <div class="desktop-ranking-table__head" role="row">
      <span role="columnheader">#</span>
      <span role="columnheader">Podcast</span>
      <span role="columnheader">Udgiver</span>
      <span role="columnheader"${
        canToggleUserSortDirection ? ` aria-sort="${userSortDirection === "asc" ? "ascending" : "descending"}"` : ""
      }>${
        canToggleUserSortDirection
          ? `<button class="desktop-ranking-score-direction" type="button" data-ranking-user-direction-toggle aria-label="Sortér ${escapeHtml(activeScoreLabel)}: ${userSortDirection === "asc" ? "laveste først" : "højeste først"}"><span>${escapeHtml(activeScoreLabel)}</span><span class="desktop-ranking-score-direction__indicator" aria-hidden="true">${userSortDirection === "asc" ? "↑" : "↓"}</span></button>`
          : escapeHtml(activeScoreLabel)
      }</span>
      <span role="columnheader">Min vurdering</span>
      <span role="columnheader"><span class="sr-only">Handlinger</span></span>
    </div>
  `;

  podcasts.forEach((podcast, index) => {
    const displayRank = getRankingDisplayRank(index);
    table.appendChild(createDesktopRankingTableRowElement(podcast, displayRank));
  });
  elements.podcastGrid.appendChild(table);

  table.querySelector("[data-ranking-user-direction-toggle]")?.addEventListener("click", () => {
    state.userRankingDirection = state.userRankingDirection === "asc" ? "desc" : "asc";
    resetVisibleCount();
    renderPodcastGrid();
  });

}

function isPodcastSaved(podcastKey) {
  const canonicalKey = resolveCanonicalPodcastId(podcastKey) || normalizeText(podcastKey);
  return state.savedPodcastKeys.has(canonicalKey);
}

function getSavedMetaStorageKey() {
  const userId = state.authUser?.id || "anonymous";
  return `podcast-ratings-saved-meta-${userId}`;
}

function readSavedPodcastMeta() {
  try {
    const raw = window.localStorage.getItem(getSavedMetaStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistSavedPodcastMeta() {
  try {
    window.localStorage.setItem(
      getSavedMetaStorageKey(),
      JSON.stringify(state.savedPodcastMetaByKey || {})
    );
  } catch {
    // Saved podcasts still work without local date metadata.
  }
}

function setSavedPodcastMeta(podcastKey, updates = {}) {
  if (!podcastKey) return;
  state.savedPodcastMetaByKey = {
    ...state.savedPodcastMetaByKey,
    [podcastKey]: {
      ...(state.savedPodcastMetaByKey[podcastKey] || {}),
      ...updates
    }
  };
  persistSavedPodcastMeta();
}

function removeSavedPodcastMeta(podcastKey) {
  if (!podcastKey || !state.savedPodcastMetaByKey[podcastKey]) return;
  const nextMeta = { ...state.savedPodcastMetaByKey };
  delete nextMeta[podcastKey];
  state.savedPodcastMetaByKey = nextMeta;
  persistSavedPodcastMeta();
}

function getSavedPodcastDateLabel(podcastKey) {
  return formatSavedDateLabel(state.savedPodcastMetaByKey[podcastKey]?.savedAt);
}

function escapeAttributeSelectorValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function setFavoriteButtonState(button, isFavorite, isPending = false) {
  if (!button) return;

  button.classList.toggle("is-saved", isFavorite);
  button.classList.toggle("is-pending", isPending);
  button.disabled = Boolean(isPending);
  button.setAttribute("aria-label", isFavorite ? "Gemt til senere" : "Gem til senere");
  button.setAttribute("aria-pressed", String(Boolean(isFavorite)));
  const detailSubtitle = button.querySelector("[data-favorite-subtitle]");
  const favoriteLabel = detailSubtitle
    ? isFavorite
      ? "Podcast gemt"
      : "Gem podcast"
    : isFavorite
      ? "Fjern fra gemte"
      : "Gem podcast";

  button.querySelector("[data-favorite-label]")?.replaceChildren(
    document.createTextNode(favoriteLabel)
  );

  if (detailSubtitle) {
    detailSubtitle.replaceChildren(
      document.createTextNode(isFavorite ? "Fjern fra gemte" : "F\u00f8j til dine gemte")
    );
  }

  const icon = button.querySelector("span");
  if (icon) {
    icon.innerHTML = `
      <svg class="favorite-button__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6.5 4.5h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4v-15a1 1 0 0 1 1-1Z" />
      </svg>
    `;
  }
}

function updateFavoriteButtonsForPodcast(podcastKey, isFavorite, isPending = false) {
  const selector = `[data-podcast-id="${escapeAttributeSelectorValue(podcastKey)}"][data-action="toggle-favorite"]`;
  const buttons = document.querySelectorAll(selector);

  if (!buttons.length) return;

  buttons.forEach((button) => {
    setFavoriteButtonState(button, isFavorite, isPending);
  });
}

function renderFavoriteButton(button, podcastKey) {
  if (!button) return;

  button.dataset.action = "toggle-favorite";
  button.dataset.podcastId = podcastKey;
  setFavoriteButtonState(
    button,
    isPodcastSaved(podcastKey),
    state.favoriteSavePendingKeys.has(podcastKey)
  );
}

function updateProfileSavedCounts() {
  if (!document.body.classList.contains("page-profil")) return;

  const savedCount = state.savedPodcastKeys.size;
  document.querySelectorAll("[data-profile-saved-count]").forEach((element) => {
    element.textContent = String(savedCount);
  });
}


function getProfileSavedPreviewPodcasts() {
  if (isMobileViewport()) {
    const savedPodcasts = getRecentlySavedPodcasts(Infinity);
    return state.profileSavedExpanded ? savedPodcasts : savedPodcasts.slice(0, 4);
  }

  return getRecentlySavedPodcasts(isMobileViewport() ? 4 : 5);
}

function renderProfileSavedPreview() {
  const savedContainer = document.querySelector("[data-profile-saved]");
  if (!savedContainer) return;

  const visibleSavedPodcasts = getProfileSavedPreviewPodcasts();
  const savedCount = state.savedPodcastKeys.size;
  savedContainer.replaceChildren();

  if (visibleSavedPodcasts.length) {
    const fragment = document.createDocumentFragment();
    visibleSavedPodcasts.forEach((podcast) => {
      fragment.appendChild(createSavedPodcastCardElement(podcast));
    });
    savedContainer.appendChild(fragment);
    return;
  }

  savedContainer.innerHTML = `
    <div class="saved-empty-state profile-saved-empty">
      <h2>${savedCount ? "Ingen gemte podcasts kan vises" : "Ingen gemte podcasts endnu"}</h2>
      <p>${
        savedCount
          ? "Dine gemte n&oslash;gler matcher ikke de aktuelle podcastdata."
          : "Gem podcasts fra ranglisten, s&aring; dukker de op her."
      }</p>
      <a class="saved-button saved-button--primary" href="#ranglister">Se ranglister</a>
    </div>
  `;
}

async function removeSavedPodcastFromProfileCard(podcast, card, button) {
  const podcastKey = getPodcastKey(podcast);
  if (!podcastKey || state.favoriteSavePendingKeys.has(podcastKey)) return;

  const wasSaved = isPodcastSaved(podcastKey);
  if (!wasSaved) return;

  const parent = card?.parentNode;
  const nextSibling = card?.nextSibling || null;
  const previousMeta = { ...(state.savedPodcastMetaByKey[podcastKey] || {}) };
  let shouldRemoveCard = true;

  state.favoriteSavePendingKeys.add(podcastKey);
  state.savedPodcastKeys.delete(podcastKey);
  removeSavedPodcastMeta(podcastKey);
  invalidateExplorePersonalSnapshot();
  updateFavoriteButtonsForPodcast(podcastKey, false, true);
  updateProfileSavedCounts();
  renderProfileSavedPreview();

  button?.classList.add("is-pending");
  button?.setAttribute("aria-busy", "true");
  if (button) button.disabled = true;

  card?.classList.add("is-removing");
  window.setTimeout(() => {
    if (shouldRemoveCard && card?.isConnected) {
      card.remove();
    }
  }, 120);

  try {
    if (!state.supabase || !state.authUser) {
      throw new Error("Du skal v\u00e6re logget ind for at fjerne gemte podcasts.");
    }

    const { error } = await state.supabase
      .from("saved_podcasts")
      .delete()
      .eq("user_id", state.authUser.id)
      .eq("podcast_key", podcastKey);

    if (error) throw error;
  } catch (error) {
    console.error(error);
    state.savedPodcastKeys.add(podcastKey);
    setSavedPodcastMeta(podcastKey, previousMeta.savedAt ? previousMeta : { savedAt: new Date().toISOString() });
    updateFavoriteButtonsForPodcast(podcastKey, true, false);
    updateProfileSavedCounts();
    renderProfileSavedPreview();
    shouldRemoveCard = false;

    if (parent && card) {
      card.classList.remove("is-removing");
      parent.insertBefore(card, nextSibling);
    }

    setAuthMessage(error.message || "Kunne ikke fjerne podcasten fra gemte.", "error");
  } finally {
    state.favoriteSavePendingKeys.delete(podcastKey);
    updateFavoriteButtonsForPodcast(podcastKey, isPodcastSaved(podcastKey), false);
    button?.classList.remove("is-pending");
    button?.removeAttribute("aria-busy");
    if (button?.isConnected) {
      button.disabled = false;
    }
  }
}

function renderRateButton(button, podcastKey) {
  if (!button) return;

  const hasUserRating = getUserRating(podcastKey) !== null;
  button.classList.toggle("has-user-rating", hasUserRating);
  button.setAttribute(
    "aria-label",
    hasUserRating ? "Rediger din vurdering" : "Vurder podcast"
  );
}

function updateRatingDialogMessage(message = "", tone = "info") {
  if (!elements.ratingDialogMessage) return;

  elements.ratingDialogMessage.textContent = message;
  elements.ratingDialogMessage.classList.toggle("is-hidden", !message);
  elements.ratingDialogMessage.dataset.tone = tone;
}

async function fetchCommunityStats() {
  if (!state.supabase) {
    state.communityStatsStatus = "error";
    return;
  }

  state.communityStatsStatus = "loading";

  const { data, error } = await state.supabase
    .from(PODCAST_RATING_PUBLIC_STATS_VIEW)
    .select("podcast_key, average_rating, rating_count");

  if (error) {
    console.error(error);
    state.communityStatsStatus = "error";
    setAuthMessage("Kunne ikke hente brugernes snit fra Supabase.", "error", "hero");
    return;
  }

  state.communityStatsByKey = Object.fromEntries(
    (data || [])
      .map((item) => [resolveCanonicalPodcastId(item.podcast_key), item])
      .filter(([podcastId]) => podcastId)
      .map(([podcastId, item]) => [
        podcastId,
        {
          averageRating: parseNumber(item.average_rating),
          ratingCount: Number(item.rating_count || 0)
        }
      ])
  );
  state.communityStatsStatus = "ready";
  invalidateRankingListCache();
}

async function refreshPodcastCommunityStat(podcastKey) {
  const key = normalizeText(podcastKey);
  if (!state.supabase || !key) return;

  const { data, error } = await state.supabase
    .from(PODCAST_RATING_PUBLIC_STATS_VIEW)
    .select("podcast_key, average_rating, rating_count")
    .eq("podcast_key", key)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    delete state.communityStatsByKey[key];
  } else {
    state.communityStatsByKey[key] = {
      averageRating: parseNumber(data.average_rating),
      ratingCount: Number(data.rating_count || 0)
    };
  }

  invalidateRankingListCache();
}

async function fetchSavedPodcastRows() {
  if (!state.supabase) return { data: [], error: null };

  const attempts = [
    "podcast_key, saved_at, created_at",
    "podcast_key, created_at",
    "podcast_key"
  ];

  let lastError = null;

  for (const columns of attempts) {
    const { data, error } = await state.supabase
      .from("saved_podcasts")
      .select(columns);

    if (!error) {
      return { data: data || [], error: null };
    }

    lastError = error;
    const message = normalizeText(error.message || error.details || error.hint).toLowerCase();
    if (
      !message.includes("saved_at") &&
      !message.includes("created_at") &&
      !message.includes("column") &&
      !message.includes("schema cache")
    ) {
      break;
    }
  }

  return { data: [], error: lastError };
}

async function fetchUserState() {
  clearUserScopedState();

  if (!state.supabase || !state.authUser) return;

  const [{ data: ratings, error: ratingsError }, { data: saved, error: savedError }] =
    await Promise.all([
      state.supabase.from("user_ratings").select("podcast_key, rating"),
      fetchSavedPodcastRows()
    ]);

  if (ratingsError) {
    console.error(ratingsError);
    setAuthMessage("Kunne ikke hente dine vurderinger endnu.", "error", "hero");
  } else {
    state.userRatingsByKey = Object.fromEntries(
      (ratings || [])
        .map((item) => [resolveCanonicalPodcastId(item.podcast_key), parseNumber(item.rating)])
        .filter(([podcastId]) => podcastId)
    );
  }

  if (savedError) {
    console.error(savedError);
    setAuthMessage("Kunne ikke hente dine gemte podcasts endnu.", "error", "hero");
  } else {
    const localMeta = readSavedPodcastMeta();
    state.savedPodcastKeys = new Set(
      (saved || []).map((item) => resolveCanonicalPodcastId(item.podcast_key)).filter(Boolean)
    );
    state.savedPodcastMetaByKey = Object.fromEntries(
      Object.entries(localMeta)
        .map(([key, value]) => [resolveCanonicalPodcastId(key), value])
        .filter(([podcastId]) => podcastId)
    );
    (saved || []).forEach((item) => {
      const podcastId = resolveCanonicalPodcastId(item.podcast_key);
      if (!podcastId) return;
      const savedAt = item.saved_at || item.created_at || localMeta[item.podcast_key]?.savedAt || "";
      if (savedAt) {
        state.savedPodcastMetaByKey[podcastId] = {
          ...(state.savedPodcastMetaByKey[podcastId] || {}),
          savedAt
        };
      }
    });
    persistSavedPodcastMeta();
  }
  invalidateRankingListCache();
}

async function refreshSupabaseState() {
  if (!state.supabase) return;

  await fetchCommunityStats();
  await fetchUserState();
  rebuildUserRanks();
  render();
}

async function initSupabase() {
  state.authConfigured = hasSupabaseConfig();
  renderAuthPanel();

  if (!state.authConfigured) {
    state.communityStatsStatus = "error";
    state.authReady = true;
    render();
    if (document.body.classList.contains("page-ranglister")) renderPodcastGrid();
    return;
  }

  const supabaseLib = await waitForSupabaseClient();

  if (!supabaseLib?.createClient) {
    state.communityStatsStatus = "error";
    state.authReady = true;
    setAuthMessage("Supabase-klienten kunne ikke indlæses i browseren.", "error", "hero");
    render();
    if (document.body.classList.contains("page-ranglister")) renderPodcastGrid();
    return;
  }

  const recoveryProvenance = window.PODCAST_RECOVERY_PROVENANCE;
  const recoveryAccessToken = recoveryProvenance?.type === "recovery" ? recoveryProvenance.accessToken : "";
  const recoveryRefreshToken = recoveryProvenance?.type === "recovery" ? recoveryProvenance.refreshToken : "";
  const isExplicitRecovery = Boolean(recoveryAccessToken && recoveryRefreshToken);
  if (isExplicitRecovery) window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#reset-password`);

  state.supabase = supabaseLib.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: !isExplicitRecovery,
        storage: supabaseAuthStorage
      }
    }
  );

  // Subscribe before getSession(): the client may consume an implicit recovery
  // fragment while it initializes, so a later subscription can miss this event.
  state.supabase.auth.onAuthStateChange((event, recoverySession) => {
    if (event === "PASSWORD_RECOVERY") {
      handlePasswordRecoveryEvent(recoverySession);
    }
  });

  let session = null;
  let error = null;
  try {
    const result = isExplicitRecovery
      ? await state.supabase.auth.setSession({ access_token: recoveryAccessToken, refresh_token: recoveryRefreshToken })
      : await state.supabase.auth.getSession();
    session = result.data?.session || null;
    error = result.error;
  } catch (sessionError) {
    error = sessionError;
  } finally {
    window.PODCAST_RECOVERY_PROVENANCE = null;
  }

  if (error) {
    console.error(error);
    setAuthMessage("Supabase-session kunne ikke indlæses.", "error", "hero");
  }

  state.session = session;
  state.authUser = session?.user || null;
  syncRankingPositionModeForAuthUser();
  state.authReady = true;

  if (isExplicitRecovery) {
    if (error || !session?.user) openPasswordRecoveryDialog("invalid");
    else handlePasswordRecoveryEvent(session);
  }

  // Keep the normal subscription separate from the recovery subscription above.
  // The initial session has already been resolved explicitly, so its INITIAL_SESSION
  // event must not trigger a second full user-state refresh.
  state.supabase.auth.onAuthStateChange(async (event, sessionUpdate) => {
    const previousUserId = state.authUser?.id || "";
    const nextUserId = sessionUpdate?.user?.id || "";
    const isRecurringSameUserEvent =
      Boolean(previousUserId) &&
      previousUserId === nextUserId &&
      ["INITIAL_SESSION", "SIGNED_IN", "TOKEN_REFRESHED"].includes(event);

    state.session = sessionUpdate;
    state.authUser = sessionUpdate?.user || null;
    syncRankingPositionModeForAuthUser();
    state.authBusy = false;

    if (event === "PASSWORD_RECOVERY") {
      handlePasswordRecoveryEvent(sessionUpdate);
    }

    if (event === "INITIAL_SESSION") {
      renderAuthPanel();
      return;
    }

    // Supabase kan udsende de samme session-events igen, når fanen får fokus.
    // Sessionen og brugeren er uændret, så undgå at genhente alt og genopbygge profilsiden.
    if (isRecurringSameUserEvent) {
      clearAuthMessage();
      renderAuthPanel();
      return;
    }

    if (!state.authUser) {
      clearUserScopedState({ clearUi: true });
      if (state.activeFilter?.type === "saved") {
        state.activeFilter = null;
        resetVisibleCount();
      }
      closeRatingDialog();
      render();
    } else if (event === "SIGNED_IN") {
      closeAuthDialog({ clearPending: false });
    }
    clearAuthMessage();
    renderAuthPanel();
    await refreshSupabaseState();
    const cachedEpisodes = getAllCachedEpisodes();
    if (state.authUser && cachedEpisodes.length) {
      await fetchEpisodeRatingMetaForEpisodes(cachedEpisodes, { update: false });
      updateGenstartEpisodeSection();
      updateOpenEpisodeDetailScores();
    }
    if (state.authUser && event === "SIGNED_IN") {
      completePendingAuthAction();
    }
  });

  // The hero must update as soon as the session is known; ratings and saved-podcast
  // data remain on the secondary startup path below.
  render();
}

async function handleAuthAction(mode) {
  if (state.authBusy) return;

  if (!state.supabase) {
    setAuthMessage(
      "Supabase er ikke sat op endnu. Tilføj først URL og anon key i konfigurationen.",
      "warning",
      "dialog"
    );
    return;
  }

  const email = normalizeText(elements.authEmail?.value);
  const password = normalizeText(elements.authPassword?.value);

  if (!email || !password) {
    setAuthMessage("Indtast både email og adgangskode.", "warning", "dialog");
    return;
  }

  if (password.length < 6) {
    setAuthMessage("Adgangskoden skal være mindst 6 tegn.", "warning", "dialog");
    return;
  }

  setAuthBusy(true);
  clearAuthMessage("dialog");

  let shouldCompletePendingAuthAction = false;
  let authenticationSucceeded = false;
  const previousStorageMode = authUsesPersistentStorage;
  const requestedStorageMode =
    mode === "login" ? Boolean(elements.authRememberLogin?.checked) : true;
  setAuthStorageMode(requestedStorageMode);

  try {
    if (mode === "signup") {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;
      authenticationSucceeded = Boolean(data.session);

      state.session = data.session || state.session;
      state.authUser = data.session?.user || data.user || state.authUser;
      if (data.session) {
        setAuthMessage("Din konto er oprettet, og du er nu logget ind.", "success", "hero");
        closeAuthDialog({ clearPending: false });
        renderAuthPanel();
        await refreshSupabaseState();
        shouldCompletePendingAuthAction = true;
      } else {
        setAuthMessage(
          "Kontoen er oprettet. Hvis du vil logge ind med det samme uden mail, så slå Confirm email fra i Supabase.",
          "warning",
          "dialog"
        );
      }
    } else {
      const { data, error } = await state.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;
      authenticationSucceeded = true;

      state.session = data.session || state.session;
      state.authUser = data.session?.user || state.authUser;
      setAuthMessage("Du er nu logget ind.", "success", "hero");
      closeAuthDialog({ clearPending: false });
      renderAuthPanel();
      await refreshSupabaseState();
      shouldCompletePendingAuthAction = true;
    }

    if (elements.authPassword) {
      elements.authPassword.value = "";
      elements.authPassword.type = "password";
    }
    updateAuthPasswordToggle();
  } catch (error) {
    if (!authenticationSucceeded) {
      setAuthStorageMode(previousStorageMode);
    }
    console.error(error);
    setAuthMessage(normalizeAuthErrorMessage(error), "error", "dialog");
  } finally {
    setAuthBusy(false);
    renderAuthPanel();
    if (shouldCompletePendingAuthAction) {
      completePendingAuthAction();
    }
  }
}

async function requestPasswordReset() {
  if (state.authBusy) return;

  if (!state.supabase) {
    setAuthMessage(
      "Supabase er ikke sat op endnu. Tilføj først URL og anon key i konfigurationen.",
      "warning",
      "dialog"
    );
    return;
  }

  const email = normalizeText(elements.authEmail?.value);

  if (!email) {
    setAuthMessage("Indtast din email først, så sender vi et nulstillingslink.", "warning", "dialog");
    return;
  }

  setAuthBusy(true);
  clearAuthMessage("dialog");

  try {
    const redirectTo = window.location.href.split("#")[0];
    const { error } = await state.supabase.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) throw error;

    setAuthMessage(
      "Vi har sendt et link til din email, så du kan nulstille din adgangskode.",
      "success",
      "dialog"
    );
  } catch (error) {
    console.error(error);
    setAuthMessage(normalizeAuthErrorMessage(error), "error", "dialog");
  } finally {
    setAuthBusy(false);
    renderAuthPanel();
  }
}

async function handleLogout() {
  if (state.authBusy) return;

  if (!state.supabase) return;

  setAuthBusy(true);

  try {
    const { error } = await state.supabase.auth.signOut();
    if (error) throw error;
    clearTrackedAuthStorage();
    state.session = null;
    state.authUser = null;
    syncRankingPositionModeForAuthUser();
    clearUserScopedState({ clearUi: true });
    if (state.activeFilter?.type === "saved") {
      state.activeFilter = null;
      resetVisibleCount();
    }
    closeRatingDialog();
    closeAuthDialog();
    render();
    setAuthMessage("Du er logget ud.", "success", "hero");
  } catch (error) {
    console.error(error);
    setAuthMessage(error.message || "Logout mislykkedes.", "error", "hero");
  } finally {
    setAuthBusy(false);
    renderAuthPanel();
  }
}

function openRatingDialog(podcast) {
  resetRatingDialogMode();
  if (!isLoggedIn()) {
    state.pendingAuthAction = {
      type: "rating",
      podcastKey: getPodcastKey(podcast)
    };
    showAuthPrompt("login");
    setAuthMessage("Log ind for at gemme din egen vurdering.", "warning", "dialog");
    return;
  }

  if (!elements.ratingDialog || !elements.ratingInput) return;

  const key = getPodcastKey(podcast);
  const existingRating = getUserRating(key);

  state.activeRatingKey = key;
  elements.ratingDialogTitle.textContent = podcast.title;
  elements.ratingDialogMeta.textContent = podcast.host || podcast.publisher || "";
  elements.ratingInput.value =
    existingRating === null || existingRating === undefined
      ? ""
      : formatRatingInputValue(existingRating);
  if (elements.ratingSaveButton) {
    elements.ratingSaveButton.textContent =
      existingRating === null || existingRating === undefined
        ? "Gem vurdering"
        : "Opdater vurdering";
    elements.ratingSaveButton.disabled = false;
  }
  if (elements.ratingDeleteButton) {
    elements.ratingDeleteButton.disabled = false;
  }
  elements.ratingDeleteButton?.classList.toggle(
    "is-hidden",
    existingRating === null || existingRating === undefined
  );

  updateRatingDialogMessage("");
  elements.ratingDialog.classList.remove("is-hidden");
  elements.ratingDialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-dialog-open");
  window.setTimeout(() => {
    elements.ratingInput?.focus();
    elements.ratingInput?.select();
  }, 40);
}

function openEpisodeRatingDialog(episode) {
  const episodeId = getEpisodeKey(episode);

  if (!isLoggedIn()) {
    state.pendingAuthAction = {
      type: "episodeRating",
      episodeId
    };
    showAuthPrompt("login");
    setAuthMessage("Log ind for at gemme din vurdering af episoden.", "warning", "dialog");
    return;
  }

  if (!elements.ratingDialog || !elements.ratingInput || !episodeId) return;

  const existingRating = getEpisodeUserRating(episodeId);
  const podcastName = getEpisodePodcastDisplayName(episode?.podcast_key || state.activePodcastDetailKey);

  state.ratingDialogMode = "episode";
  state.activeRatingKey = null;
  state.activeEpisodeRatingId = episodeId;
  elements.ratingDialog?.classList.add("rating-dialog--episode");
  const eyebrow = elements.ratingDialog?.querySelector(".rating-dialog__eyebrow");
  if (eyebrow) eyebrow.textContent = "Episodevurdering";
  const hint = elements.ratingDialog?.querySelector(".rating-dialog__hint");
  if (hint) {
    hint.textContent = `Din vurdering gemmes kun p\u00e5 denne ${podcastName}-episode.`;
  }

  elements.ratingDialogTitle.textContent = "Vurder episoden";
  elements.ratingDialogMeta.textContent = episode.title || `${podcastName}-episode`;
  elements.ratingInput.value =
    existingRating === null || existingRating === undefined
      ? ""
      : formatRatingInputValue(existingRating);
  if (elements.ratingSaveButton) {
    elements.ratingSaveButton.textContent =
      existingRating === null || existingRating === undefined
        ? "Gem vurdering"
        : "Opdater vurdering";
    elements.ratingSaveButton.disabled = false;
  }
  if (elements.ratingDeleteButton) {
    elements.ratingDeleteButton.disabled = false;
    elements.ratingDeleteButton.classList.toggle(
      "is-hidden",
      existingRating === null || existingRating === undefined
    );
  }

  updateRatingDialogMessage("");
  elements.ratingDialog.classList.remove("is-hidden");
  elements.ratingDialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-dialog-open");
  window.setTimeout(() => {
    elements.ratingInput?.focus();
    elements.ratingInput?.select();
  }, 40);
}

function closeRatingDialog() {
  if (!elements.ratingDialog) return;

  state.activeRatingKey = null;
  state.activeEpisodeRatingId = null;
  updateRatingDialogMessage("");
  elements.ratingDialog.classList.add("is-hidden");
  elements.ratingDialog.setAttribute("aria-hidden", "true");
  resetRatingDialogMode();
  if (
    elements.authDialog?.classList.contains("is-hidden") &&
    !document.body.classList.contains("has-podcast-detail-open") &&
    !document.querySelector("#profileListDialog.profile-list-dialog--ratings")
  ) {
    document.body.classList.remove("has-dialog-open");
  }
}

function completePendingAuthAction() {
  const pending = state.pendingAuthAction;
  state.pendingAuthAction = null;

  if (!pending || !state.authUser) return;

  if (pending.type === "profileSaved") {
    openProfileSavedSection();
    return;
  }

  if (pending.type === "suggestion") {
    state.exploreSuggestionDialogOpen = true;
    const targetRoute = pending.route === "#profil" ? "#profil" : "#udforsk";
    if (window.location.hash !== targetRoute) {
      window.location.hash = targetRoute;
    } else {
      render();
    }
    return;
  }

  if (pending.type === "episodeRating") {
    const episode = getGenstartEpisodeById(pending.episodeId);
    if (episode) openEpisodeRatingDialog(episode);
    return;
  }

  const podcast = state.podcastByKey[pending.podcastKey];
  if (!podcast) return;

  if (pending.type === "rating") {
    openRatingDialog(podcast);
    return;
  }

  if (pending.type === "save") {
    toggleSavedPodcast(podcast);
  }
}

async function refreshSingleEpisodeStat(episodeId, { retry = true } = {}) {
  await fetchEpisodeStatsForIds([episodeId], { force: true });
  const stat = getEpisodeStat(episodeId);
  if (retry && (!stat || Number(stat.ratingCount || 0) === 0)) {
    await new Promise((resolve) => window.setTimeout(resolve, 320));
    await fetchEpisodeStatsForIds([episodeId], { force: true });
  }
}

function updatePodcastEpisodeOverviewRatingRow(episodeId) {
  const dialog = document.getElementById("podcastDetailSheet");
  if (!dialog || dialog.classList.contains("is-hidden")) return;
  if (state.podcastDetailView !== "episodes") return;

  const normalizedEpisodeId = normalizeText(episodeId);
  const ratingButton = Array.from(
    dialog.querySelectorAll("[data-episode-overview-rating-id]")
  ).find(
    (button) => normalizeText(button.dataset.episodeOverviewRatingId) === normalizedEpisodeId
  );
  if (!ratingButton) return;

  const activePodcast = state.podcastByKey[state.activePodcastDetailKey];
  const episode = getGenstartEpisodeById(normalizedEpisodeId)
    || (activePodcast
      ? getPodcastManualEpisodes(activePodcast).find((item) => normalizeText(getEpisodeKey(item)) === normalizedEpisodeId)
      : null);
  if (!episode) return;

  const userRating = getEpisodeUserRating(normalizedEpisodeId);
  ratingButton.classList.toggle("is-empty", userRating === null);
  ratingButton.setAttribute(
    "aria-label",
    `${userRating === null ? "Vurder" : "Rediger vurderingen af"} ${episode.title || "episoden"}`
  );
  const ownScore = ratingButton.querySelector("strong");
  if (ownScore) ownScore.innerHTML = formatEpisodeOverviewOwnScore(userRating);
  ratingButton.closest("tr")?.classList.toggle("is-user-rated", userRating !== null);

  const stat = getEpisodeStat(normalizedEpisodeId);
  const sourceScore = parseNumber(stat?.averageRating);
  const ratingCount = Number(stat?.ratingCount || 0);
  const sourceScoreElement = ratingButton
    .closest("tr")
    ?.querySelector(".podcast-detail-sheet__episode-source-score");
  if (sourceScoreElement) {
    sourceScoreElement.innerHTML = `
      <strong>${formatEpisodeOverviewScore(sourceScore)}</strong>
      <em>${ratingCount ? escapeHtml(formatUserRatingCount(ratingCount)) : "Ingen vurderinger endnu"}</em>
    `;
  }
}

async function finalizeSavedEpisodeRating({
  episodeId,
  podcastKey,
  rating,
  previousEffectiveParentRating
}) {
  try {
    await refreshSingleEpisodeStat(episodeId);
    updatePodcastEpisodeOverviewRatingRow(episodeId);
    updateOpenEpisodeDetailScores();
  } catch (error) {
    console.error("Kunne ikke opdatere episodens ratingstatistik efter gemning.", error);
  }

  try {
    await synchronizeEpisodeDerivedParentRating(podcastKey, previousEffectiveParentRating, {
      refreshUi: false
    });
  } catch (error) {
    console.error("Kunne ikke synkronisere podcastens afledte vurdering.", error);
  }

  updateProfileEpisodeRatingAfterSave(episodeId, rating);
}

async function saveActiveEpisodeRating() {
  if (!state.authUser || !state.activeEpisodeRatingId || !elements.ratingInput) return;

  normalizeRatingInputField({ force: true });
  const numericValue = parseRatingInputValue(elements.ratingInput.value);

  if (numericValue === null || numericValue < 0 || numericValue > 10) {
    updateRatingDialogMessage("Indtast en score mellem 0 og 10.", "warning");
    return;
  }

  const episodeId = state.activeEpisodeRatingId;
  const episode = getGenstartEpisodeById(episodeId);
  const podcastKey = normalizeText(episode?.podcast_key) || getEpisodePodcastKey(state.activePodcastDetailKey);
  const config = getEpisodeRatingPersistenceConfig(podcastKey, episode);
  const isLocalEpisodeRating = config?.persistence === "local";
  const episodeState = getPodcastEpisodeState(podcastKey);
  const previousUserRating = episodeState.userRatingsById[episodeId];
  const previousEpisodeSummary = getPodcastEpisodeUserRatingSummary(podcastKey);
  const previousEffectiveParentRating =
    state.userRatingsByKey[resolveCanonicalPodcastId(podcastKey)] ?? null;
  const originalSaveLabel = elements.ratingSaveButton?.textContent || "Gem vurdering";

  setAuthBusy(true);
  if (elements.ratingSaveButton) elements.ratingSaveButton.textContent = "Gemmer …";
  updateRatingDialogMessage("");

  try {
    if (previousEpisodeSummary.count === 0 && !getEpisodeParentRatingBackup(podcastKey, { local: isLocalEpisodeRating })) {
      captureEpisodeParentRatingBackup(podcastKey, { local: isLocalEpisodeRating });
      if (!getEpisodeParentRatingBackup(podcastKey, { local: isLocalEpisodeRating })) {
        throw new Error("Din tidligere samlede vurdering kunne ikke bevares.");
      }
    }

    if (config?.persistence === "local") {
      if (!saveLocalEpisodeRating(podcastKey, episodeId, numericValue)) {
        throw new Error("Kunne ikke gemme episodevurderingen lokalt.");
      }
      await synchronizeEpisodeDerivedParentRating(
        podcastKey,
        previousEffectiveParentRating,
        { local: true }
      );
      closeRatingDialog();
      updatePodcastEpisodeOverview(document.getElementById("podcastDetailSheet"));
      refreshOpenPodcastDetailSheet();
      setAuthMessage("Din episodevurdering er gemt.", "success");
      return;
    }

    if (!state.supabase) {
      throw new Error("Episodevurderinger er ikke klar endnu. Prøv igen om et øjeblik.");
    }
    const { error } = await state.supabase.from("episode_ratings").upsert(
      {
        user_id: state.authUser.id,
        episode_id: episodeId,
        rating: numericValue
      },
      { onConflict: "user_id,episode_id" }
    );

    if (error) throw error;

    episodeState.userRatingsById[episodeId] = numericValue;
    closeRatingDialog();
    updatePodcastEpisodeOverviewRatingRow(episodeId);
    updateOpenEpisodeDetailScores();
    setAuthMessage("Din episodevurdering er gemt.", "success");
    void finalizeSavedEpisodeRating({
      episodeId,
      podcastKey,
      rating: numericValue,
      previousEffectiveParentRating
    });
  } catch (error) {
    if (config?.persistence === "local") {
      if (previousUserRating === null || previousUserRating === undefined) {
        deleteLocalEpisodeRating(podcastKey, episodeId);
      } else {
        saveLocalEpisodeRating(podcastKey, episodeId, previousUserRating);
      }
    }
    if (previousEpisodeSummary.count === 0) {
      clearEpisodeParentRatingBackup(podcastKey, { local: isLocalEpisodeRating });
    }
    console.error(error);
    if (elements.ratingSaveButton) elements.ratingSaveButton.textContent = originalSaveLabel;
    updateRatingDialogMessage(error.message || "Kunne ikke gemme episodevurderingen.", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function saveActiveRating() {
  if (state.ratingDialogMode === "episode") {
    await saveActiveEpisodeRating();
    return;
  }

  if (!state.supabase || !state.authUser || !state.activeRatingKey || !elements.ratingInput) return;

  normalizeRatingInputField({ force: true });
  const numericValue = parseRatingInputValue(elements.ratingInput.value);

  if (numericValue === null || numericValue < 0 || numericValue > 10) {
    updateRatingDialogMessage("Indtast en score mellem 0 og 10.", "warning");
    return;
  }

  setAuthBusy(true);
  updateRatingDialogMessage("");

  try {
    const { error } = await state.supabase.from("user_ratings").upsert(
      {
        user_id: state.authUser.id,
        podcast_key: state.activeRatingKey,
        rating: numericValue
      },
      { onConflict: "user_id,podcast_key" }
    );

    if (error) throw error;

    const ratingKey = state.activeRatingKey;
    const previousRating = state.userRatingsByKey[ratingKey] ?? null;
    state.userRatingsByKey[ratingKey] = numericValue;
    updateLocalCommunityStatForRating(ratingKey, numericValue, previousRating);
    invalidateExplorePersonalSnapshot();
    rebuildUserRanks();
    render();
    refreshOpenPodcastDetailSheet();
    setAuthMessage("Din vurdering er gemt.", "success");
    closeRatingDialog();
    refreshSupabaseState()
      .then(refreshOpenPodcastDetailSheet)
      .catch((refreshError) => {
        console.error(refreshError);
        setAuthMessage("Din vurdering er gemt, men snittet kunne ikke opdateres endnu.", "warning");
      });
  } catch (error) {
    console.error(error);
    updateRatingDialogMessage(error.message || "Kunne ikke gemme vurderingen.", "error");
  } finally {
    setAuthBusy(false);
  }
}

function updateProfileEpisodeRatingAfterDelete(episodeId) {
  const id = normalizeText(episodeId);
  if (!id || !state.authUser) return;

  const episodeRatings = getProfileEpisodeRatingsState();
  if (episodeRatings.loadedFor !== state.authUser.id) return;

  episodeRatings.items = episodeRatings.items.filter(
    (item) => normalizeText(item.episode_id) !== id
  );
  updateProfileEpisodeRatingsSection();
}

async function deleteActiveEpisodeRating() {
  if (!state.authUser || !state.activeEpisodeRatingId) return;

  const episodeId = state.activeEpisodeRatingId;
  const episode = getGenstartEpisodeById(episodeId);
  const podcastKey = normalizeText(episode?.podcast_key) || getEpisodePodcastKey(state.activePodcastDetailKey);
  const config = getEpisodeRatingPersistenceConfig(podcastKey, episode);
  const episodeState = getPodcastEpisodeState(podcastKey);
  const previousUserRating = episodeState.userRatingsById[episodeId];
  const previousEffectiveParentRating =
    state.userRatingsByKey[resolveCanonicalPodcastId(podcastKey)] ?? null;

  setAuthBusy(true);
  updateRatingDialogMessage("");

  try {
    if (config?.persistence === "local") {
      if (!deleteLocalEpisodeRating(podcastKey, episodeId)) {
        throw new Error("Kunne ikke fjerne episodevurderingen lokalt.");
      }
      closeRatingDialog();
      updatePodcastEpisodeOverviewRatingRow(episodeId);
      updateOpenEpisodeDetailScores();
      await synchronizeEpisodeDerivedParentRating(
        podcastKey,
        previousEffectiveParentRating,
        { local: true }
      );
      updatePodcastEpisodeOverview(document.getElementById("podcastDetailSheet"));
      refreshOpenPodcastDetailSheet();
      setAuthMessage("Din episodevurdering er fjernet.", "success");
      return;
    }

    if (!state.supabase) return;
    const { error } = await state.supabase
      .from("episode_ratings")
      .delete()
      .eq("user_id", state.authUser.id)
      .eq("episode_id", episodeId);

    if (error) throw error;

    episodeState.userRatingsById[episodeId] = null;
    updateProfileEpisodeRatingAfterDelete(episodeId);
    closeRatingDialog();
    updatePodcastEpisodeOverviewRatingRow(episodeId);
    updateOpenEpisodeDetailScores();
    await synchronizeEpisodeDerivedParentRating(
      podcastKey,
      previousEffectiveParentRating
    );
    await refreshSingleEpisodeStat(episodeId);
    updateGenstartEpisodeSection();
    updateOpenEpisodeDetailScores();
    updateProfileEpisodeRatingsSection();
    setAuthMessage("Din episodevurdering er fjernet.", "success");
  } catch (error) {
    if (config?.persistence === "local") {
      if (previousUserRating !== null && previousUserRating !== undefined) {
        saveLocalEpisodeRating(podcastKey, episodeId, previousUserRating);
      }
    } else {
      episodeState.userRatingsById[episodeId] = previousUserRating;
      if (
        state.supabase &&
        previousUserRating !== null &&
        previousUserRating !== undefined
      ) {
        await state.supabase
          .from("episode_ratings")
          .upsert(
            {
              user_id: state.authUser.id,
              episode_id: episodeId,
              rating: previousUserRating
            },
            { onConflict: "user_id,episode_id" }
          )
          .then(({ error: rollbackError }) => {
            if (rollbackError) console.error(rollbackError);
          });
      }
    }
    updatePodcastEpisodeOverviewRatingRow(episodeId);
    updateOpenEpisodeDetailScores();
    console.error(error);
    updateRatingDialogMessage(error.message || "Kunne ikke fjerne episodevurderingen.", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function deleteActiveRating() {
  if (state.ratingDialogMode === "episode") {
    await deleteActiveEpisodeRating();
    return;
  }

  if (!state.supabase || !state.authUser || !state.activeRatingKey) return;

  const deletedKey = state.activeRatingKey;

  setAuthBusy(true);
  updateRatingDialogMessage("");

  try {
    const { error } = await state.supabase
      .from("user_ratings")
      .delete()
      .eq("user_id", state.authUser.id)
      .eq("podcast_key", deletedKey);

    if (error) throw error;

    const previousRating = state.userRatingsByKey[deletedKey] ?? null;
    delete state.userRatingsByKey[deletedKey];
    updateLocalCommunityStatForRating(deletedKey, null, previousRating);
    invalidateExplorePersonalSnapshot();
    rebuildUserRanks();
    render();
    refreshOpenPodcastDetailSheet();

    if (elements.ratingInput) {
      elements.ratingInput.value = "";
    }
    elements.ratingDeleteButton?.classList.add("is-hidden");
    if (elements.ratingSaveButton) {
      elements.ratingSaveButton.textContent = "Gem vurdering";
    }
    setAuthMessage("Din vurdering er fjernet.", "success");
    closeRatingDialog();
    refreshSupabaseState().catch((refreshError) => {
      console.error(refreshError);
      setAuthMessage("Din vurdering er fjernet, men snittet kunne ikke opdateres endnu.", "warning");
    });
  } catch (error) {
    console.error(error);
    updateRatingDialogMessage(error.message || "Kunne ikke fjerne vurderingen.", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function toggleSavedPodcast(podcast) {
  const podcastKey = getPodcastKey(podcast);

  if (!isLoggedIn()) {
    state.pendingAuthAction = {
      type: "save",
      podcastKey
    };
    showAuthPrompt("login");
    setAuthMessage("Log ind for at gemme podcasts til senere.", "warning", "dialog");
    return;
  }

  if (!podcastKey || state.favoriteSavePendingKeys.has(podcastKey)) {
    return;
  }

  const wasSaved = isPodcastSaved(podcastKey);
  const nextSaved = !wasSaved;
  state.favoriteSavePendingKeys.add(podcastKey);

  if (nextSaved) {
    state.savedPodcastKeys.add(podcastKey);
    setSavedPodcastMeta(podcastKey, { savedAt: new Date().toISOString() });
  } else {
    state.savedPodcastKeys.delete(podcastKey);
    removeSavedPodcastMeta(podcastKey);
  }
  invalidateExplorePersonalSnapshot();

  updateFavoriteButtonsForPodcast(podcastKey, nextSaved, true);

  try {
    if (!state.supabase || !state.authUser) {
      throw new Error("Du skal v\u00e6re logget ind for at gemme podcasts.");
    }

    if (wasSaved) {
      const { error } = await state.supabase
        .from("saved_podcasts")
        .delete()
        .eq("user_id", state.authUser.id)
        .eq("podcast_key", podcastKey);

      if (error) throw error;
    } else {
      const { error } = await state.supabase.from("saved_podcasts").upsert(
        {
          user_id: state.authUser.id,
          podcast_key: podcastKey
        },
        { onConflict: "user_id,podcast_key" }
      );

      if (error) throw error;
    }
  } catch (error) {
    console.error(error);

    if (wasSaved) {
      state.savedPodcastKeys.add(podcastKey);
      setSavedPodcastMeta(podcastKey, { savedAt: new Date().toISOString() });
    } else {
      state.savedPodcastKeys.delete(podcastKey);
      removeSavedPodcastMeta(podcastKey);
    }

    updateFavoriteButtonsForPodcast(podcastKey, wasSaved, false);
    setAuthMessage(error.message || "Kunne ikke opdatere gemte podcasts.", "error");
  } finally {
    state.favoriteSavePendingKeys.delete(podcastKey);
    updateFavoriteButtonsForPodcast(podcastKey, isPodcastSaved(podcastKey), false);
  }
}

function handleFavoriteToggle(event, podcast) {
  if (!podcast) return;

  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation?.();

  return toggleSavedPodcast(podcast);
}

function isInteractivePodcastDetailTarget(target) {
  return Boolean(
    target?.closest?.(
      [
        "a",
        "button",
        "input",
        "select",
        "textarea",
        "[data-action]",
        ".rating-summary[role='button']",
        ".explore-card__rating",
        ".explore-genre-card__scores",
        ".saved-card__scores",
        ".profile-podcast-card__badge",
        "[data-profile-scroll]",
        "[data-profile-expand]",
        "[data-explore-suggest-open]"
      ].join(",")
    )
  );
}

function isValidPodcastLink(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function getPodcastLinkLabel(url) {
  if (!isValidPodcastLink(url)) return "";

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "dr.dk" || host.endsWith(".dr.dk")) return "Lyt hos DR";
    if (host === "spotify.com" || host === "open.spotify.com") return "\u00c5bn i Spotify";
    if (host === "podimo.com" || host.endsWith(".podimo.com")) return "Find p\u00e5 Podimo";
    if (host === "podcasts.apple.com") return "\u00c5bn i Apple Podcasts";
  } catch {
    // Fall through to default label.
  }

  return "Find podcasten";
}

function getPodcastLinkSubtitle(url) {
  if (!isValidPodcastLink(url)) return "";

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host === "dr.dk" || host.endsWith(".dr.dk")) return "\u00c5bn i DR Lyd";
    if (host === "spotify.com" || host === "open.spotify.com") return "\u00c5bn podcasten";
    if (host === "podimo.com" || host.endsWith(".podimo.com")) return "Se podcasten p\u00e5 Podimo";
    if (host === "podcasts.apple.com") return "\u00c5bn podcasten";
  } catch {
    // Fall through to default subtitle.
  }

  return "Se hvor du kan lytte";
}

function showInlineToast(message) {
  const text = normalizeText(message);
  if (!text) return;

  let toast = document.querySelector("[data-inline-toast]");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "inline-toast";
    toast.dataset.inlineToast = "";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = text;
  toast.classList.add("is-visible");
  window.clearTimeout(showInlineToast.timer);
  showInlineToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 2200);
}

async function sharePodcastLink(podcast) {
  const link = isValidPodcastLink(podcast?.link) ? podcast.link : window.location.href;
  const title = podcast?.title || "Podcastlisten";

  try {
    if (navigator.share) {
      await navigator.share({
        title,
        text: `Se ${title} p\u00e5 Podcastlisten`,
        url: link
      });
      return;
    }
  } catch (error) {
    if (error?.name === "AbortError") return;
  }

  try {
    await navigator.clipboard?.writeText(link);
    showInlineToast("Link kopieret");
  } catch {
    showInlineToast("Kunne ikke kopiere linket");
  }
}

async function copyPodcastLink(podcast) {
  const link = isValidPodcastLink(podcast?.link) ? podcast.link : window.location.href;

  try {
    await navigator.clipboard?.writeText(link);
    showInlineToast("Link kopieret");
  } catch {
    showInlineToast("Kunne ikke kopiere linket");
  }
}

function getPodcastDetailMeta(podcast) {
  return podcast.host || podcast.publisher || "";
}

function getPodcastDetailPublisherLabel(podcast) {
  const publisher = normalizeText(podcast?.publisher);
  if (!publisher) return "";
  return getPublisherFilterLabel(publisher);
}

function getPodcastDetailDescription(podcast) {
  return (
    normalizeText(podcast.longDescription) ||
    normalizeText(podcast.shortDescription) ||
    normalizeText(podcast.description) ||
    "Der er endnu ikke tilf\u00f8jet en beskrivelse af podcasten."
  );
}

function warnPodcastSimilarityProduct(message) {
  if (state.podcastSimilarityWarningShown) return;
  state.podcastSimilarityWarningShown = true;
  console.warn(`Podcast-lighed blev skjult: ${message}`);
}

function normalizePodcastIdentityLink(value) {
  const link = normalizeText(value);
  if (!link) return "";

  try {
    const parsed = new URL(link, window.location.href);
    parsed.hash = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return link.replace(/\/$/, "");
  }
}

function buildPodcastSimilarityProductLookups(metadataPayload, productPayload) {
  const metadataRows = Array.isArray(metadataPayload?.rows) ? metadataPayload.rows : null;
  const productResults =
    productPayload?.results &&
    typeof productPayload.results === "object" &&
    !Array.isArray(productPayload.results)
      ? productPayload.results
      : null;

  // Recommendation metadata retains title-derived legacy identities, while
  // row per source record; only the two source artifacts are count-comparable.
  if (
    !metadataRows ||
    !productResults ||
    productPayload.version !== 1.3 ||
    Object.keys(productResults).length !== metadataRows.length
  ) {
    throw new Error("produktfil eller metadata har et uventet format");
  }

  const metadataByExistingId = new Map();
  const metadataByRecommendationId = new Map();
  const podcastByDisplayTitle = new Map();
  state.podcasts.forEach((podcast) => {
    const titleKey = normalizeMatchKey(podcast?.title);
    if (!titleKey) return;
    if (!podcastByDisplayTitle.has(titleKey)) {
      podcastByDisplayTitle.set(titleKey, []);
    }
    podcastByDisplayTitle.get(titleKey).push(podcast);
  });
  metadataRows.forEach((row) => {
    const recommendationId = normalizeText(row?.recommendationId);
    const existingId = normalizeMatchKey(row?.id);
    if (
      !recommendationId ||
      metadataByRecommendationId.has(recommendationId) ||
      !productResults[recommendationId]
    ) {
      throw new Error("recommendationId kan ikke valideres entydigt");
    }
    metadataByRecommendationId.set(recommendationId, row);
    if (!metadataByExistingId.has(existingId)) metadataByExistingId.set(existingId, []);
    metadataByExistingId.get(existingId).push(row);
  });

  const recommendationIdByPodcastKey = {};
  const podcastByRecommendationId = {};
  state.podcasts.forEach((podcast) => {
    const podcastId = getPodcastId(podcast);
    const matches = metadataByExistingId.get(getLegacyPodcastKey(podcast)) || [];
    let resolved = matches.length === 1 ? matches[0] : null;

    if (matches.length > 1) {
      const podcastLink = normalizePodcastIdentityLink(podcast.link);
      const exactLinkMatches = matches.filter((row) => {
        const productSource = productResults[row.recommendationId];
        return (
          podcastLink &&
          normalizePodcastIdentityLink(productSource?.sourceLink) === podcastLink
        );
      });
      resolved = exactLinkMatches.length === 1 ? exactLinkMatches[0] : null;
    }

    if (!resolved) return;
    recommendationIdByPodcastKey[podcastId] = resolved.recommendationId;
    podcastByRecommendationId[resolved.recommendationId] = podcast;
  });

  metadataRows.forEach((row) => {
    if (podcastByRecommendationId[row.recommendationId]) return;
    const productSource = productResults[row.recommendationId];
    const exactTitleMatches =
      podcastByDisplayTitle.get(normalizeMatchKey(productSource?.title)) || [];
    if (exactTitleMatches.length === 1) {
      podcastByRecommendationId[row.recommendationId] = exactTitleMatches[0];
    }
  });

  return {
    productByRecommendationId: productResults,
    recommendationIdByPodcastKey,
    podcastByRecommendationId
  };
}

async function loadPodcastSimilarityProductData() {
  if (state.podcastSimilarityProductStatus === "ready") return true;
  if (state.podcastSimilarityProductPromise) {
    return state.podcastSimilarityProductPromise;
  }

  state.podcastSimilarityProductStatus = "loading";
  state.podcastSimilarityProductPromise = Promise.all([
    fetch(`${RECOMMENDATION_METADATA_URL}?v=${DATA_VERSION}`, { cache: "no-store" }),
    fetch(`${PODCAST_SIMILARITY_PRODUCT_URL}?v=${DATA_VERSION}`, { cache: "no-store" })
  ])
    .then(async ([metadataResponse, productResponse]) => {
      if (!metadataResponse.ok || !productResponse.ok) {
        throw new Error("produktdata kunne ikke hentes");
      }
      const [metadataPayload, productPayload] = await Promise.all([
        metadataResponse.json(),
        productResponse.json()
      ]);
      const lookups = buildPodcastSimilarityProductLookups(
        metadataPayload,
        productPayload
      );
      state.podcastSimilarityMetadataPayload = metadataPayload;
      state.podcastSimilarityProductByRecommendationId =
        lookups.productByRecommendationId;
      state.podcastSimilarityRecommendationIdByPodcastKey =
        lookups.recommendationIdByPodcastKey;
      state.podcastSimilarityPodcastByRecommendationId =
        lookups.podcastByRecommendationId;
      state.podcastSimilarityProductStatus = "ready";
      state.podcastSimilarityWarningShown = false;
      refreshOpenPodcastDetailSheet();
      if (document.body.classList.contains("page-udforsk")) {
        renderExplorePage();
      }
      return true;
    })
    .catch((error) => {
      state.podcastSimilarityProductStatus = "error";
      state.podcastSimilarityMetadataPayload = null;
      state.podcastSimilarityProductByRecommendationId = {};
      state.podcastSimilarityRecommendationIdByPodcastKey = {};
      state.podcastSimilarityPodcastByRecommendationId = {};
      warnPodcastSimilarityProduct(error?.message || "ukendt valideringsfejl");
      return false;
    });

  return state.podcastSimilarityProductPromise;
}

function getValidatedPodcastSimilarityProduct(podcast) {
  if (state.podcastSimilarityProductStatus !== "ready") return null;
  const podcastKey = getPodcastKey(podcast);
  const recommendationId =
    state.podcastSimilarityRecommendationIdByPodcastKey[podcastKey];
  const product =
    recommendationId &&
    state.podcastSimilarityProductByRecommendationId[recommendationId];
  if (!recommendationId || !product || product.recommendationId !== recommendationId) {
    return null;
  }

  const validateCandidates = (candidates) => {
    const resolved = [];
    for (const candidate of candidates || []) {
      const candidatePodcast =
        state.podcastSimilarityPodcastByRecommendationId[candidate.recommendationId];
      if (!candidatePodcast) return null;
      resolved.push({ candidate, podcast: candidatePodcast });
    }
    return resolved;
  };
  const similar = validateCandidates(product.similarResults);
  const sameSeries = validateCandidates(product.sameSeriesResults);
  if (!similar || !sameSeries) {
    warnPodcastSimilarityProduct("en podcastrelation kunne ikke joines entydigt");
    return null;
  }
  return { recommendationId, product, similar, sameSeries };
}

function renderPodcastSimilarityProductCard({ candidate, podcast }, sectionType) {
  const reason =
    sectionType === "same-series"
      ? "Fra samme serie"
      : normalizeText(candidate.similarityReason);
  const rating =
    candidate.editorialScore === null || candidate.editorialScore === undefined
      ? ""
      : `<span class="podcast-detail-sheet__related-rating" aria-label="Podcastlistens vurdering ${escapeHtml(
          formatCompactRating(candidate.editorialScore)
        )} ud af 10">★ ${escapeHtml(formatCompactRating(candidate.editorialScore))}</span>`;
  return `
    <button
      class="podcast-detail-sheet__related-card"
      type="button"
      data-podcast-similarity-card="${escapeHtml(candidate.recommendationId)}"
      data-podcast-similarity-podcast-key="${escapeHtml(getPodcastKey(podcast))}"
      aria-label="Åbn ${escapeHtml(candidate.title)}"
    >
      <span class="podcast-detail-sheet__related-cover">
        <img alt="Cover til ${escapeHtml(candidate.title)}" loading="lazy" />
      </span>
      <span class="podcast-detail-sheet__related-copy">
        <strong>${escapeHtml(candidate.title)}</strong>
        <span class="podcast-detail-sheet__related-meta">
          <span>${escapeHtml(candidate.primaryGenre || "")}</span>
          ${rating}
        </span>
        <small>${escapeHtml(reason)}</small>
      </span>
    </button>
  `;
}

function renderPodcastSimilarityProductSection(title, items) {
  if (!items.length) return "";
  const sectionLabel = "lignende podcasts";
  return `
    <section class="podcast-detail-sheet__related-section" data-podcast-similarity-section="recommendations">
      <div class="podcast-detail-sheet__related-heading">
        <h3>${escapeHtml(title)}</h3>
        <button class="podcast-detail-sheet__related-show-all" type="button" data-podcast-similarity-scroll="1">${isMobileViewport() ? "Se flere" : "Se alle"}</button>
        <div class="podcast-detail-sheet__related-controls" aria-label="Naviger i ${sectionLabel}">
          <button type="button" data-podcast-similarity-scroll="-1" aria-label="Rul tilbage i ${sectionLabel}">‹</button>
          <button type="button" data-podcast-similarity-scroll="1" aria-label="Rul frem i ${sectionLabel}">›</button>
        </div>
      </div>
      <div class="podcast-detail-sheet__related-track" tabindex="0" aria-label="${escapeHtml(title)}">
        ${items
          .map(({ item, sectionType }) =>
            renderPodcastSimilarityProductCard(item, sectionType)
          )
          .join("")}
      </div>
    </section>
  `;
}

function scorePodcastDetailRecommendation(podcast, item, sectionType) {
  const candidate = item?.candidate || {};
  const candidatePodcast = item?.podcast || {};
  const asScore = (value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  };
  const currentGenre = normalizeComparable(podcast?.genre);
  const candidateGenre = normalizeComparable(
    candidatePodcast?.genre || candidate.primaryGenre
  );
  const currentSeries = normalizeComparable(podcast?.mainSeries);
  const candidateSeries = normalizeComparable(
    candidatePodcast?.mainSeries || candidate.authoritativeMainSeries
  );
  const currentPublisher = normalizeComparable(podcast?.publisher);
  const candidatePublisher = normalizeComparable(
    candidatePodcast?.publisher || candidate.publisher
  );
  const hasSameSeries = Boolean(
    currentSeries && candidateSeries && currentSeries === candidateSeries
  );
  const hasSamePublisher = Boolean(
    currentPublisher && candidatePublisher && currentPublisher === candidatePublisher
  );
  const hasSameHost = Boolean(
    podcast?.host &&
      candidatePodcast?.host &&
      hostsMatchComparable(podcast.host, candidatePodcast.host)
  );
  const sharedTopicCount = Array.isArray(candidate.sharedTopics)
    ? candidate.sharedTopics.filter(Boolean).length
    : 0;
  const currentRating = asScore(podcast?.ratingValue);
  const candidateRating = asScore(candidate.editorialScore ?? candidatePodcast?.ratingValue);
  const ratingRelevance =
    currentRating && candidateRating
      ? Math.max(0, 3 - Math.abs(currentRating - candidateRating) * 0.8)
      : 0;

  return (
    asScore(candidate.contentSimilarityScore) +
    Math.min(sharedTopicCount, 3) * 3 +
    (currentGenre && candidateGenre && currentGenre === candidateGenre ? 4 : 0) +
    ratingRelevance +
    (hasSameHost ? 2 : 0) +
    (hasSameSeries || sectionType === "same-series" ? 2.5 : 0) +
    (hasSamePublisher ? 1 : 0)
  );
}

function getPodcastDetailFallbackRecommendations(podcast, seenPodcastKeys, seenPodcastTitles) {
  const currentKey = getPodcastKey(podcast);
  const currentGenre = normalizeComparable(podcast?.genre);
  const currentSeries = normalizeComparable(podcast?.mainSeries);
  const currentRating = Number(podcast?.ratingValue) || 0;
  const candidates = state.podcasts
    .filter((candidatePodcast) => {
      const candidateKey = getPodcastKey(candidatePodcast);
      const candidateTitle = normalizeComparable(candidatePodcast?.title);
      return (
        candidateKey &&
        candidateKey !== currentKey &&
        !seenPodcastKeys.has(candidateKey) &&
        !(candidateTitle && seenPodcastTitles.has(candidateTitle))
      );
    })
    .map((candidatePodcast) => {
      const candidateGenre = normalizeComparable(candidatePodcast?.genre);
      const candidateSeries = normalizeComparable(candidatePodcast?.mainSeries);
      const sameSeries = Boolean(currentSeries && candidateSeries === currentSeries);
      const sameGenre = Boolean(currentGenre && candidateGenre === currentGenre);
      const rating = Number(candidatePodcast?.ratingValue) || 0;
      const score =
        (sameSeries ? 200 : 0) +
        (sameGenre ? 100 : 0) +
        Math.max(0, 12 - Math.abs(currentRating - rating) * 2) +
        rating;
      return { candidatePodcast, candidateKey: getPodcastKey(candidatePodcast), candidateTitle, sameSeries, score };
    })
    .sort(
      (left, right) =>
        right.score - left.score ||
        String(left.candidatePodcast.title || "").localeCompare(
          String(right.candidatePodcast.title || ""),
          "da"
        )
    );

  // One same-series result may lead, but the remainder stays diverse where
  // the catalogue offers equally relevant podcasts outside that series.
  const firstSameSeries = candidates.find((candidate) => candidate.sameSeries);
  const remaining = candidates.filter((candidate) => candidate !== firstSameSeries);
  return [...(firstSameSeries ? [firstSameSeries] : []), ...remaining].map(
    ({ candidatePodcast, candidateKey, candidateTitle }) => ({
      item: {
        candidate: {
          recommendationId: `fallback:${candidateKey}`,
          title: candidatePodcast.title,
          primaryGenre: candidatePodcast.genre,
          editorialScore: candidatePodcast.ratingValue,
          similarityReason:
            normalizeComparable(candidatePodcast.genre) === currentGenre
              ? "Samme genre"
              : "Podcastlisten anbefaler"
        },
        podcast: candidatePodcast
      },
      sectionType: "fallback",
      candidateKey,
      candidateTitle
    })
  );
}

function getPodcastTopicKeys(podcast) {
  return new Set((Array.isArray(podcast?.topics) ? podcast.topics : []).map(normalizeComparable).filter(Boolean));
}

function getPodcastDetailDynamicRecommendations(podcast, validated) {
  const currentKey = getPodcastKey(podcast);
  const currentTitle = normalizeComparable(podcast?.title);
  const currentGenre = normalizeComparable(podcast?.genre);
  const currentSecondaryGenre = normalizeComparable(podcast?.secondaryGenre);
  const currentSeries = normalizeComparable(podcast?.mainSeries);
  const currentPublisher = normalizeComparable(podcast?.publisher);
  const currentTopics = getPodcastTopicKeys(podcast);
  const productCandidatesByKey = new Map();
  const manualCandidateKeys = new Set();
  const resolveCandidate = (candidate) =>
    state.podcastSimilarityPodcastByRecommendationId[candidate?.recommendationId] ||
    state.podcasts.find((entry) => normalizeComparable(entry.title) === normalizeComparable(candidate?.title));

  [
    ...(validated?.product?.combinedSimilarResults || []),
    ...(validated?.product?.sameSeriesResults || [])
  ].forEach((candidate) => {
    const candidatePodcast = resolveCandidate(candidate);
    const candidateKey = getPodcastKey(candidatePodcast);
    if (candidateKey && !productCandidatesByKey.has(candidateKey)) {
      productCandidatesByKey.set(candidateKey, candidate);
    }
  });

  (validated?.product?.manualSupplementaryResults || []).forEach((candidate) => {
    const candidatePodcast = resolveCandidate(candidate);
    const candidateKey = getPodcastKey(candidatePodcast);
    if (candidateKey) manualCandidateKeys.add(candidateKey);
  });

  const seenTitles = new Set([currentTitle]);
  const scoredCandidates = state.podcasts
    .filter((candidatePodcast) => {
      const candidateKey = getPodcastKey(candidatePodcast);
      const candidateTitle = normalizeComparable(candidatePodcast?.title);
      if (!candidateKey || candidateKey === currentKey || seenTitles.has(candidateTitle)) return false;
      seenTitles.add(candidateTitle);
      return true;
    })
    .map((candidatePodcast, index) => {
      const candidateKey = getPodcastKey(candidatePodcast);
      const productCandidate = productCandidatesByKey.get(candidateKey);
      const candidateTopics = getPodcastTopicKeys(candidatePodcast);
      const sharedTopics = [...currentTopics].filter((topic) => candidateTopics.has(topic));
      const sameSeries = Boolean(currentSeries && currentSeries === normalizeComparable(candidatePodcast.mainSeries));
      const sameGenre = Boolean(currentGenre && currentGenre === normalizeComparable(candidatePodcast.genre));
      const secondaryGenreMatch = Boolean(
        (currentSecondaryGenre && currentSecondaryGenre === normalizeComparable(candidatePodcast.secondaryGenre)) ||
        (currentGenre && currentGenre === normalizeComparable(candidatePodcast.secondaryGenre)) ||
        (currentSecondaryGenre && currentSecondaryGenre === normalizeComparable(candidatePodcast.genre))
      );
      const sameHost = Boolean(podcast.host && candidatePodcast.host && hostsMatchComparable(podcast.host, candidatePodcast.host));
      const samePublisher = Boolean(currentPublisher && currentPublisher === normalizeComparable(candidatePodcast.publisher));
      const isManual = manualCandidateKeys.has(candidateKey);
      const ratingDistance = Math.abs((Number(podcast.ratingValue) || 0) - (Number(candidatePodcast.ratingValue) || 0));
      const score =
        (isManual ? 15 : 0) +
        (sameSeries ? 45 : 0) +
        Math.min(sharedTopics.length, 3) * 18 +
        (sameGenre ? 18 : 0) +
        (secondaryGenreMatch ? 8 : 0) +
        (sameHost ? 9 : 0) +
        (samePublisher ? 4 : 0) +
        Math.min(18, (Number(productCandidate?.contentSimilarityScore) || 0) / 5) +
        Math.max(0, 3 - ratingDistance * 0.7) +
        Math.min(2, (Number(candidatePodcast.ratingValue) || 0) / 5);
      const similarityReason = isManual
        ? "Redaktionelt anbefalet"
        : sharedTopics.length
          ? `Fælles emne${sharedTopics.length > 1 ? "r" : ""}: ${sharedTopics.slice(0, 2).join(" og ")}`
          : sameSeries
            ? "Fra samme serie"
            : sameGenre
              ? "Samme genre"
              : sameHost
                ? "Samme vært"
                : samePublisher
                  ? "Samme udgiver"
                  : "Podcastlisten anbefaler";
      return {
        item: {
          candidate: {
            recommendationId: productCandidate?.recommendationId || `catalogue:${candidateKey}`,
            title: candidatePodcast.title,
            primaryGenre: candidatePodcast.genre,
            editorialScore: candidatePodcast.ratingValue,
            similarityReason
          },
          podcast: candidatePodcast
        },
        sectionType: sameSeries ? "same-series" : "similar",
        sameSeries,
        score,
        index
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index);

  // Keep the strongest relationship signals ahead of broad catalogue matches:
  // main-series first, then every resolved product candidate, then generic fill.
  // Build the complete pool before applying diversity so same-series candidates
  // cannot consume every visible slot ahead of validated product matches.
  const candidatePool = [];
  const selectedKeys = new Set();
  const selectedTitles = new Set([currentTitle]);
  const appendPhase = (candidates) => {
    candidates.forEach((candidate) => {
      const candidatePodcast = candidate?.item?.podcast;
      const candidateKey = getPodcastKey(candidatePodcast);
      const candidateTitle = normalizeComparable(candidatePodcast?.title);
      if (!candidateKey || selectedKeys.has(candidateKey)) return;
      if (candidateTitle && selectedTitles.has(candidateTitle)) return;
      candidatePool.push(candidate);
      selectedKeys.add(candidateKey);
      if (candidateTitle) selectedTitles.add(candidateTitle);
    });
  };

  const sameSeriesCandidates = scoredCandidates.filter((candidate) => candidate.sameSeries);
  const manuallyValidatedCandidates = scoredCandidates.filter((candidate) =>
    manualCandidateKeys.has(getPodcastKey(candidate?.item?.podcast))
  );

  // A manually validated same-series match may lead. The complete same-series
  // pool still follows before broader candidates, while its validated external
  // counterparts remain available for the diversity pass.
  appendPhase(
    sameSeriesCandidates.filter((candidate) =>
      manualCandidateKeys.has(getPodcastKey(candidate?.item?.podcast))
    )
  );
  appendPhase(sameSeriesCandidates);
  appendPhase(manuallyValidatedCandidates);
  appendPhase(
    scoredCandidates.filter((candidate) =>
      productCandidatesByKey.has(getPodcastKey(candidate?.item?.podcast))
    )
  );
  appendPhase(scoredCandidates);
  return selectPodcastDetailRecommendations(candidatePool, 8);
}

function getRecommendationDiversityKey(candidate) {
  const candidatePodcast = candidate?.item?.podcast || candidate?.podcast || {};
  const recommendation = candidate?.item?.candidate || candidate?.candidate || {};
  const mainSeries = normalizeComparable(
    candidatePodcast.mainSeries || recommendation.authoritativeMainSeries
  );
  if (mainSeries) return `series:${mainSeries}`;

  const baseTitle = normalizeText(candidatePodcast.title || recommendation.title)
    .replace(/\s*(?:\(\s*)?(?:sæson|season)\s+\d+(?:\s*\))?\s*$/iu, "")
    .replace(/\s*(?:\(\s*|[-–—:]\s*)(?:version|ver\.?|v)\s*\d+\s*\)?\s*$/iu, "")
    .replace(/\s*(?:\(\s*|[-–—:]\s*)(?:19|20)\d{2}\s*\)?\s*$/u, "");
  const normalizedTitle = normalizeMatchKey(baseTitle);
  return normalizedTitle ? `title:${normalizedTitle}` : "";
}

function selectPodcastDetailRecommendations(candidates, limit = 4) {
  const selected = [];
  const remaining = [...candidates];

  while (selected.length < limit && remaining.length) {
    const previousKey = getRecommendationDiversityKey(selected.at(-1));
    const nextIndex = remaining.findIndex(
      (candidate) => getRecommendationDiversityKey(candidate) !== previousKey
    );
    selected.push(remaining.splice(nextIndex === -1 ? 0 : nextIndex, 1)[0]);
  }

  return selected;
}

function getPodcastSimilarityProductMarkup(podcast) {
  if (state.podcastSimilarityProductStatus === "idle") {
    loadPodcastSimilarityProductData();
  }
  const validated = getValidatedPodcastSimilarityProduct(podcast);
  const completedRecommendations = selectPodcastDetailRecommendations(
    getPodcastDetailDynamicRecommendations(podcast, validated),
    8
  );

  if (!completedRecommendations.length) return "";
  return `
    <div class="podcast-detail-sheet__related" data-podcast-similarity-product>
      ${renderPodcastSimilarityProductSection(
        "Mere som dette",
        completedRecommendations
      )}
    </div>
  `;
}

function hydratePodcastSimilarityProduct(dialog, podcast) {
  const content = dialog.querySelector("[data-podcast-detail-content]");
  const container = content?.querySelector("[data-podcast-similarity-product]");
  if (!container) return;

  container.querySelectorAll("[data-podcast-similarity-card]").forEach((card) => {
    const recommendationId = card.dataset.podcastSimilarityCard;
    const podcastKey = card.dataset.podcastSimilarityPodcastKey;
    const candidatePodcast =
      state.podcastByKey[podcastKey] ||
      state.podcasts.find((candidate) => getPodcastKey(candidate) === podcastKey) ||
      state.podcastSimilarityPodcastByRecommendationId[recommendationId];
    if (!candidatePodcast) return;
    const cover = card.querySelector(".podcast-detail-sheet__related-cover");
    setImage(cover, getPodcastImageSources(candidatePodcast), candidatePodcast.title);
    card.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPodcastDetailFromModal(candidatePodcast, card);
    });
  });

  container.querySelectorAll("[data-podcast-similarity-scroll]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const section = button.closest("[data-podcast-similarity-section]");
      const track = section?.querySelector(".podcast-detail-sheet__related-track");
      const direction = Number(button.dataset.podcastSimilarityScroll) || 1;
      track?.scrollBy?.({
        left: direction * Math.max(220, track.clientWidth * 0.8),
        behavior: "smooth"
      });
    });
  });
}

function getPodcastCompactDescription(podcast) {
  return (
    normalizeText(podcast?.shortDescription) ||
    normalizeText(podcast?.description) ||
    normalizeText(podcast?.longDescription) ||
    ""
  );
}

function getPodcastDetailRatingData(podcast) {
  const communityStat = getCommunityStat(getPodcastKey(podcast));
  const hasMadsRating = podcast.ratingValue !== null && podcast.ratingValue !== undefined;
  const hasUserRating =
    communityStat?.averageRating !== null && communityStat?.averageRating !== undefined;

  return {
    mads: hasMadsRating ? formatCompactRating(podcast.ratingValue) : "\u2014",
    users: hasUserRating ? formatCompactRating(communityStat.averageRating) : "\u2014",
    userCount: Number(communityStat?.ratingCount || 0)
  };
}

function getMainSeriesPodcasts(mainSeries) {
  const seriesKey = normalizeComparable(mainSeries);
  if (!seriesKey) return [];

  const seen = new Set();
  return state.podcasts
    .filter((podcast) => normalizeComparable(podcast.mainSeries) === seriesKey)
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => {
      const placementDelta = (a.placement || 9999) - (b.placement || 9999);
      if (placementDelta !== 0) return placementDelta;
      return normalizeText(a.title).localeCompare(normalizeText(b.title), "da");
    });
}

function averageNumbers(values) {
  const numbers = values.filter((value) => value !== null && value !== undefined);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0) / numbers.length;
}

function getMainSeriesSummary(mainSeries) {
  const podcasts = getMainSeriesPodcasts(mainSeries);
  const madsScores = podcasts
    .map((podcast) => parseNumber(podcast.ratingValue))
    .filter((value) => value !== null);
  const userStats = podcasts
    .map((podcast) => {
      const stat = getCommunityStat(getPodcastKey(podcast));
      const averageRating = parseNumber(stat?.averageRating);
      const ratingCount = Number(stat?.ratingCount || 0);
      if (averageRating === null || ratingCount <= 0) return null;
      return { averageRating, ratingCount };
    })
    .filter(Boolean);
  const userRatingTotal = userStats.reduce((total, stat) => total + stat.ratingCount, 0);
  const userWeightedTotal = userStats.reduce(
    (total, stat) => total + stat.averageRating * stat.ratingCount,
    0
  );

  return {
    podcasts,
    madsAverage: averageNumbers(madsScores),
    userAverage: userRatingTotal ? userWeightedTotal / userRatingTotal : null,
    madsRatedCount: madsScores.length,
    userRatedCount: userStats.length,
    userRatingTotal
  };
}

function ensurePodcastDetailSheet() {
  let dialog = document.getElementById("podcastDetailSheet");
  if (dialog) {
    if (dialog.parentElement !== document.body) {
      document.body.appendChild(dialog);
    }
    return dialog;
  }

  dialog = document.createElement("div");
  dialog.id = "podcastDetailSheet";
  dialog.className = "podcast-detail-sheet is-hidden";
  dialog.setAttribute("aria-hidden", "true");
  dialog.innerHTML = `
    <div class="podcast-detail-sheet__backdrop" data-podcast-detail-close></div>
    <button
      class="podcast-detail-sheet__ranking-nav podcast-detail-sheet__ranking-nav--previous is-hidden"
      type="button"
      data-podcast-detail-ranking-previous
      aria-label="Forrige podcast i ranglisten"
    >
      <span aria-hidden="true">&lsaquo;</span>
    </button>
    <button
      class="podcast-detail-sheet__ranking-nav podcast-detail-sheet__ranking-nav--next is-hidden"
      type="button"
      data-podcast-detail-ranking-next
      aria-label="N\u00e6ste podcast i ranglisten"
    >
      <span aria-hidden="true">&rsaquo;</span>
    </button>
    <section
      class="podcast-detail-sheet__panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="podcastDetailTitle"
    >
      <div class="podcast-detail-sheet__drag-header" data-detail-sheet-drag-handle>
        <div class="podcast-detail-sheet__toolbar-actions" data-podcast-detail-toolbar-actions></div>
        <div class="podcast-detail-sheet__handle" aria-hidden="true"></div>
        <div class="podcast-detail-sheet__top-left-controls">
          <span data-podcast-detail-placement></span>
          <button
            class="podcast-detail-sheet__modal-back is-hidden"
            type="button"
            data-podcast-detail-modal-back
            aria-label="Tilbage til forrige podcast"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Tilbage</span>
          </button>
        </div>
        <button class="podcast-detail-sheet__close" type="button" aria-label="Luk" data-podcast-detail-close>
          &times;
        </button>
      </div>
      <div class="podcast-detail-sheet__content" data-podcast-detail-content></div>
    </section>
  `;

  dialog.addEventListener("click", (event) => {
    if (event.target.closest("[data-podcast-detail-close]")) {
      closePodcastDetailSheet();
    }
  });

  dialog
    .querySelector("[data-podcast-detail-ranking-previous]")
    ?.addEventListener("click", () => navigatePodcastDetailRanking(-1));
  dialog
    .querySelector("[data-podcast-detail-ranking-next]")
    ?.addEventListener("click", () => navigatePodcastDetailRanking(1));
  dialog
    .querySelector("[data-podcast-detail-modal-back]")
    ?.addEventListener("click", () => navigatePodcastDetailHistoryBack());

  document.body.appendChild(dialog);
  initPodcastDetailSheetDrag(dialog);
  initPodcastDetailRankingSwipe(dialog);
  return dialog;
}

function clearPodcastDetailRankingContext() {
  state.podcastDetailRankingKeys = [];
  state.podcastDetailRankingIndex = -1;
}

function clearPodcastDetailNavigationHistory() {
  state.podcastDetailNavigationHistory = [];
}

function updatePodcastDetailNavigationHistoryButton(dialog) {
  const button = dialog?.querySelector("[data-podcast-detail-modal-back]");
  const isVisible = state.podcastDetailNavigationHistory.length > 0;
  if (!button) return;

  button.classList.toggle("is-hidden", !isVisible);
  button.tabIndex = isVisible ? 0 : -1;
  button.setAttribute("aria-hidden", isVisible ? "false" : "true");
}

function openPodcastDetailFromModal(podcast, triggerElement = null) {
  const dialog = document.getElementById("podcastDetailSheet");
  const currentKey = normalizeText(state.activePodcastDetailKey);
  const nextKey = getPodcastKey(podcast);
  const currentPodcast = currentKey ? state.podcastByKey[currentKey] : null;

  if (!dialog || dialog.classList.contains("is-hidden") || !currentPodcast || !nextKey || nextKey === currentKey) {
    return false;
  }

  const lastKey = state.podcastDetailNavigationHistory.at(-1);
  if (lastKey !== currentKey) {
    state.podcastDetailNavigationHistory.push(currentKey);
  }

  return openPodcastDetailSheet(podcast, triggerElement, {
    allowDesktop: true,
    preserveModalHistory: true
  });
}

function navigatePodcastDetailHistoryBack() {
  const dialog = document.getElementById("podcastDetailSheet");
  const previousKey = state.podcastDetailNavigationHistory.pop();
  const previousPodcast = previousKey ? state.podcastByKey[previousKey] : null;

  if (!dialog || dialog.classList.contains("is-hidden") || !previousPodcast) {
    updatePodcastDetailNavigationHistoryButton(dialog);
    return false;
  }

  const opened = openPodcastDetailSheet(previousPodcast, null, {
    allowDesktop: true,
    preserveModalHistory: true
  });
  updatePodcastDetailNavigationHistoryButton(dialog);
  return opened;
}

function setPodcastDetailRankingContext(podcast, navigationKeys = null) {
  const suppliedKeys = Array.isArray(navigationKeys)
    ? navigationKeys.map((key) => normalizeText(key)).filter(Boolean)
    : [];
  const isRankingRoute = getRouteInfoFromHash().route === "ranglister";
  if (!suppliedKeys.length && !isRankingRoute) {
    clearPodcastDetailRankingContext();
    return;
  }

  const keys = suppliedKeys.length
    ? suppliedKeys
    : getFilteredPodcasts().map((item) => getPodcastKey(item)).filter(Boolean);
  const activeKey = getPodcastKey(podcast);
  const index = keys.indexOf(activeKey);

  state.podcastDetailRankingKeys = index >= 0 ? keys : [];
  state.podcastDetailRankingIndex = index;
}

function updatePodcastDetailRankingNavigation(dialog) {
  const previousButton = dialog?.querySelector("[data-podcast-detail-ranking-previous]");
  const nextButton = dialog?.querySelector("[data-podcast-detail-ranking-next]");
  const hasContext =
    state.podcastDetailView === "detail" &&
    state.podcastDetailRankingIndex >= 0 &&
    state.podcastDetailRankingKeys.length > 0;
  const canGoPrevious = hasContext && state.podcastDetailRankingIndex > 0;
  const canGoNext =
    hasContext &&
    state.podcastDetailRankingIndex < state.podcastDetailRankingKeys.length - 1;

  [
    [previousButton, canGoPrevious],
    [nextButton, canGoNext]
  ].forEach(([button, enabled]) => {
    if (!button) return;
    button.classList.toggle("is-hidden", !enabled);
    button.disabled = !enabled;
    button.tabIndex = enabled ? 0 : -1;
    button.setAttribute("aria-hidden", enabled ? "false" : "true");
  });
}

function navigatePodcastDetailRanking(direction) {
  const dialog = document.getElementById("podcastDetailSheet");
  if (!dialog || dialog.classList.contains("is-hidden") || state.podcastDetailView !== "detail") {
    return false;
  }

  const nextIndex = state.podcastDetailRankingIndex + direction;
  const nextKey = state.podcastDetailRankingKeys[nextIndex];
  const podcast = nextKey ? state.podcastByKey[nextKey] : null;
  if (!podcast) return false;

  state.podcastDetailRankingIndex = nextIndex;
  state.activePodcastDetailKey = nextKey;
  state.podcastDetailMainSeriesValue = "";
  state.podcastDetailMainSeriesSourceKey = null;
  state.podcastDetailBackToMainSeries = false;
  state.podcastDetailDetailScrollTop = 0;
  state.podcastDetailEpisodeId = null;
  state.podcastDetailEpisodeScrollTop = 0;

  renderPodcastDetailSheetContent(dialog, podcast);
  dialog
    .querySelector("[data-podcast-detail-content]")
    ?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  updatePodcastDetailRankingNavigation(dialog);

  const focusTarget =
    direction < 0
      ? dialog.querySelector("[data-podcast-detail-ranking-previous]:not(.is-hidden)")
      : dialog.querySelector("[data-podcast-detail-ranking-next]:not(.is-hidden)");
  (focusTarget || dialog.querySelector(".podcast-detail-sheet__close"))?.focus?.({
    preventScroll: true
  });
  return true;
}

function resetPodcastDetailDragStyles(dialog) {
  const panel = dialog?.querySelector(".podcast-detail-sheet__panel");
  const backdrop = dialog?.querySelector(".podcast-detail-sheet__backdrop");
  if (panel) {
    panel.style.transform = "";
    panel.style.transition = "";
  }
  if (backdrop) {
    backdrop.style.opacity = "";
  }
}

function initPodcastDetailSheetDrag(dialog) {
  if (!dialog || dialog.dataset.dragReady === "true") return;
  dialog.dataset.dragReady = "true";

  const panel = dialog.querySelector(".podcast-detail-sheet__panel");
  const backdrop = dialog.querySelector(".podcast-detail-sheet__backdrop");
  if (!panel) return;

  let dragState = null;

  const canStartDrag = (event) => {
    const target = event.target;
    if (target.closest("button, a, input, select, textarea, [data-action]")) return false;
    return Boolean(target.closest("[data-detail-sheet-drag-handle]"));
  };

  panel.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!canStartDrag(event)) return;

    event.preventDefault();
    dragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocity: 0
    };
    panel.setPointerCapture?.(event.pointerId);
    panel.style.transition = "none";
  });

  panel.addEventListener("pointermove", (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const deltaY = Math.max(0, event.clientY - dragState.startY);
    if (deltaY <= 0) return;

    event.preventDefault();
    const elapsed = Math.max(1, event.timeStamp - dragState.lastTime);
    dragState.velocity = (event.clientY - dragState.lastY) / elapsed;
    dragState.lastY = event.clientY;
    dragState.lastTime = event.timeStamp;
    panel.style.transform = `translateY(${deltaY}px)`;
    if (backdrop) {
      backdrop.style.opacity = String(Math.max(0.25, 1 - deltaY / 360));
    }
  });

  const finishDrag = (event) => {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const deltaY = Math.max(0, event.clientY - dragState.startY);
    const threshold = Math.min(120, Math.max(82, panel.getBoundingClientRect().height * 0.22));
    const shouldClose = deltaY > threshold || (deltaY > 48 && dragState.velocity > 0.55);

    panel.releasePointerCapture?.(event.pointerId);
    panel.style.transition = "transform 180ms ease";

    if (shouldClose) {
      panel.style.transform = "translateY(105%)";
      if (backdrop) {
        backdrop.style.opacity = "0";
      }
      window.setTimeout(() => {
        closePodcastDetailSheet();
        resetPodcastDetailDragStyles(dialog);
      }, 160);
    } else {
      panel.style.transform = "translateY(0)";
      if (backdrop) {
        backdrop.style.opacity = "";
      }
      window.setTimeout(() => resetPodcastDetailDragStyles(dialog), 180);
    }

    dragState = null;
  };

  panel.addEventListener("pointerup", finishDrag);
  panel.addEventListener("pointercancel", finishDrag);
}

function initPodcastDetailRankingSwipe(dialog) {
  if (!dialog || dialog.dataset.rankingSwipeReady === "true") return;
  dialog.dataset.rankingSwipeReady = "true";

  const content = dialog.querySelector("[data-podcast-detail-content]");
  if (!content) return;

  let swipeStart = null;
  content.addEventListener("pointerdown", (event) => {
    if (!isMobileViewport() || event.pointerType === "mouse") return;
    if (event.target.closest("button, a, input, select, textarea, [data-action]")) return;
    swipeStart = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
  });
  content.addEventListener("pointerup", (event) => {
    if (!swipeStart || event.pointerId !== swipeStart.pointerId) return;
    const deltaX = event.clientX - swipeStart.x;
    const deltaY = event.clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(deltaX) < 54 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;
    navigatePodcastDetailRanking(deltaX < 0 ? 1 : -1);
  });
  content.addEventListener("pointercancel", () => {
    swipeStart = null;
  });
}

function getPodcastDetailPlacementText(podcast) {
  const hasRankingContext =
    state.podcastDetailRankingIndex >= 0 &&
    state.podcastDetailRankingKeys[state.podcastDetailRankingIndex] === getPodcastKey(podcast);

  if (!hasRankingContext) return "";

  const placementDisplay = getPodcastPlacementDisplay(podcast);
  const placementValue =
    state.rankingPositionMode === "dynamic"
      ? state.podcastDetailRankingIndex + 1
      : placementDisplay.hasPlacement
        ? placementDisplay.value
        : null;
  const placementText = formatDesktopRankingPlacement(placementValue);

  return placementText === "\u2014" ? "" : placementText;
}

function parseManualEpisodeEntries(value) {
  const rawEntries = Array.isArray(value) ? value : String(value ?? "").split(";");
  const entries = [];
  const seen = new Set();

  rawEntries.forEach((value) => {
    const title = normalizeText(typeof value === "object" ? value?.title : value);
    if (!title || seen.has(title)) return;

    seen.add(title);
    entries.push({
      title,
      manualEpisodeKey: normalizeText(
        typeof value === "object" ? value?.manual_episode_key || value?.manualEpisodeKey : ""
      )
    });
  });

  return entries;
}

function parseManualEpisodeTitles(value) {
  return parseManualEpisodeEntries(value).map((entry) => entry.title);
}

function getPodcastManualEpisodeTitles(podcast) {
  return parseManualEpisodeTitles(
    podcast?.manualEpisodes || podcast?.manual_episodes || podcast?.["Episoder"] || ""
  );
}

function podcastHasManualEpisodeList(podcast) {
  return getPodcastManualEpisodeTitles(podcast).length >= MINIMUM_RATEABLE_EPISODE_COUNT;
}

function hashStringToEightHex(input, seed = 0) {
  let hash = (2166136261 ^ seed) >>> 0;
  const value = String(input || "");

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }

  return hash.toString(16).padStart(8, "0").slice(0, 8);
}

function createStableManualEpisodeUuid(podcastKey, episodeNumber, title) {
  const source = `podcastlisten-manual-episode-v1|${normalizeText(podcastKey)}|${episodeNumber}|${normalizeText(title)}`;
  const hex = [
    hashStringToEightHex(source, 0x11),
    hashStringToEightHex(source, 0x22),
    hashStringToEightHex(source, 0x33),
    hashStringToEightHex(source, 0x44)
  ].join("");

  const variantNibble = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variantNibble}${hex.slice(17, 20)}`,
    hex.slice(20, 32)
  ].join("-");
}

function createStableManualCatalogueEpisodeUuid(podcastKey, manualEpisodeKey) {
  const source = `podcastlisten-manual-catalogue-v2|${normalizeText(podcastKey)}|${normalizeText(manualEpisodeKey)}`;
  const hex = [
    hashStringToEightHex(source, 0x51),
    hashStringToEightHex(source, 0x52),
    hashStringToEightHex(source, 0x53),
    hashStringToEightHex(source, 0x54)
  ].join("");
  const variantNibble = ((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `${variantNibble}${hex.slice(17, 20)}`,
    hex.slice(20, 32)
  ].join("-");
}

function getPodcastManualEpisodes(podcast) {
  const podcastKey = getLocalEpisodePodcastKey(podcast) || "podcast";
  const legacyPodcastKey = getLegacyPodcastKey(podcast);
  const canReadLegacyEpisodeIds =
    Boolean(legacyPodcastKey) &&
    getPodcastId(resolvePodcastByStoredKey(legacyPodcastKey)) === podcastKey;

  return parseManualEpisodeEntries(
    podcast?.manualEpisodes || podcast?.manual_episodes || podcast?.["Episoder"] || ""
  ).map((entry, index) => {
    const title = entry.title;
    const episodeNumber = index + 1;
    const legacyEpisodeId = canReadLegacyEpisodeIds
      ? createStableManualEpisodeUuid(legacyPodcastKey, episodeNumber, title)
      : "";
    const legacyCanonicalEpisodeId = createStableManualEpisodeUuid(podcastKey, episodeNumber, title);
    const hasImmutableManualKey = Boolean(entry.manualEpisodeKey);
    const canonicalEpisodeId = hasImmutableManualKey
      ? createStableManualCatalogueEpisodeUuid(podcastKey, entry.manualEpisodeKey)
      : legacyCanonicalEpisodeId;
    const manualEpisodeKey = hasImmutableManualKey
      ? `manual-catalogue-v2:${podcastKey}:${entry.manualEpisodeKey}`
      : `manual-catalogue-v1:${canonicalEpisodeId}`;

    return {
      id: canonicalEpisodeId,
      legacy_manual_episode_id: legacyEpisodeId || legacyCanonicalEpisodeId,
      manual_episode_key: manualEpisodeKey,
      podcast_key: podcastKey,
      title,
      episode_number: episodeNumber,
      is_active: true,
      source: MANUAL_CATALOGUE_SOURCE,
      dataSource: "manual"
    };
  });
}

function resolveManualCatalogueEpisodeFromLocalRow(podcastKey, episode) {
  const legacyEpisodeId = normalizeText(episode?.id);
  const canonicalEpisodeId = BOMBEN_LEGACY_EPISODE_ID_TO_CANONICAL_ID[legacyEpisodeId] || legacyEpisodeId;

  return {
    ...episode,
    id: canonicalEpisodeId,
    podcast_key: normalizeText(episode?.podcast_key) || normalizeText(podcastKey),
    legacy_manual_episode_id: legacyEpisodeId && legacyEpisodeId !== canonicalEpisodeId ? legacyEpisodeId : "",
    manual_episode_key: `manual-catalogue-v1:${canonicalEpisodeId}`,
    source: MANUAL_CATALOGUE_SOURCE,
    dataSource: "manual"
  };
}

function getEpisodePodcastConfig(podcastOrKey) {
  const podcast =
    typeof podcastOrKey === "object" ? podcastOrKey : resolvePodcastByStoredKey(podcastOrKey);
  const podcastId = getPodcastId(podcast);
  const episodeKey = getEpisodePodcastKey(podcastOrKey);
  const rawKey = typeof podcastOrKey === "string" ? normalizeText(podcastOrKey) : "";
  const configKeys = [podcastId, rawKey, episodeKey]
    .flatMap((key) => {
      const normalized = normalizeText(key);
      const comparable = normalizeMatchKey(key);
      return [
        normalized,
        EPISODE_DATABASE_KEY_ALIASES[normalized],
        EPISODE_DATABASE_KEY_ALIASES[comparable]
      ];
    })
    .map(normalizeText)
    .filter(Boolean);

  for (const configKey of configKeys) {
    const config = EPISODE_PODCAST_CONFIG[configKey];
    if (config?.enabled) return config;
  }

  if (!podcastId) return null;

  const rawFeed = normalizeText(podcast?.rawFeed || podcast?.Feed);
  const appleMatch = rawFeed.match(/^apple:(\d+)$/i);
  if (appleMatch) {
    // Apple identity comes only from the permanent catalogue ID and show ID;
    // never infer it from a display title.
    return {
      podcastKey: podcastId,
      databasePodcastKey: podcastId,
      displayName: podcast?.title || podcastId,
      searchPlaceholder: `Søg i ${podcast?.title || podcastId}-episoder`,
      source: `apple_podcasts_${appleMatch[1]}`,
      enabled: true,
      persistence: "supabase"
    };
  }

  const feedUrl = normalizeText(podcast?.feedUrl || podcast?.Feed);

  try {
    const url = new URL(feedUrl);
    if (!/^https?:$/.test(url.protocol)) return null;
  } catch {
    return null;
  }

  // Sheet-managed RSS feeds use the same Supabase episode lookup as the
  // existing manual configurations. Import configuration is generated separately.
  return {
    podcastKey: podcastId,
    databasePodcastKey: podcastId,
    displayName: podcast?.title || podcastId,
    enabled: true,
    persistence: "supabase"
  };
}

function getEpisodeRatingPersistenceConfig(podcastOrKey, episode) {
  // A manual episode becomes Supabase-backed only after the canonical mapping
  // row has been read. This prevents a partially applied catalogue migration
  // from breaking an otherwise usable legacy catalogue.
  if (episode?.dataSource === "manual") {
    return {
      podcastKey: normalizeText(episode.podcast_key) || getEpisodePodcastKey(podcastOrKey),
      persistence: state.manualCanonicalEpisodeMappings.has(normalizeText(episode.manual_episode_key))
        ? "supabase"
        : "local"
    };
  }

  const config = getEpisodePodcastConfig(podcastOrKey);
  if (config) return config;

  return null;
}

function usesLocalEpisodePersistence(podcastOrKey) {
  const podcast =
    typeof podcastOrKey === "object"
      ? podcastOrKey
      : resolvePodcastByStoredKey(podcastOrKey);
  const config = getEpisodePodcastConfig(podcast || podcastOrKey);
  return Boolean(config?.persistence === "local");
}

function getEpisodeDatabasePodcastKey(configOrPodcast) {
  const config =
    configOrPodcast &&
    typeof configOrPodcast === "object" &&
    configOrPodcast.podcastKey
      ? configOrPodcast
      : getEpisodePodcastConfig(configOrPodcast);

  const explicitDatabaseKey = normalizeText(config?.databasePodcastKey);
  if (explicitDatabaseKey) return explicitDatabaseKey;

  const rawCandidates = [
    config?.podcastKey,
    typeof configOrPodcast === "object" ? getPodcastId(configOrPodcast) : "",
    config?.displayName,
    typeof configOrPodcast === "string" ? configOrPodcast : "",
    typeof configOrPodcast === "object" ? configOrPodcast?.title : "",
    typeof configOrPodcast === "object" ? configOrPodcast?.Titel : "",
    getEpisodePodcastKey(state.activePodcastDetailKey)
  ];

  for (const candidate of rawCandidates) {
    const normalized = normalizeText(candidate);
    if (!normalized) continue;

    const aliased = EPISODE_DATABASE_KEY_ALIASES[normalized];
    if (aliased) return aliased;

    const comparable = normalizeMatchKey(candidate);
    const comparableAlias = EPISODE_DATABASE_KEY_ALIASES[comparable];
    if (comparableAlias) return comparableAlias;
  }

  return normalizeText(config?.podcastKey || getPodcastId(configOrPodcast) || "");
}
function podcastHasEpisodeConfiguration(podcastOrKey) {
  return Boolean(getEpisodePodcastConfig(podcastOrKey)) ||
    (typeof podcastOrKey === "object" && podcastHasManualEpisodeList(podcastOrKey));
}

function isRateablePodcastEpisode(episode) {
  const metadata =
    episode?.metadata && typeof episode.metadata === "object" ? episode.metadata : {};
  return Boolean(
    episode &&
      episode.is_active !== false &&
      episode.rateable !== false &&
      metadata.rateable !== false &&
      normalizeText(episode.title) &&
      !/\b(?:teaser|trailer)\b/i.test(normalizeText(episode.title))
  );
}

function getRateablePodcastEpisodes(episodes) {
  return (Array.isArray(episodes) ? episodes : []).filter(isRateablePodcastEpisode);
}

function getDefaultEpisodePodcastKey() {
  const entry = Object.values(EPISODE_PODCAST_CONFIG).find((config) => config?.enabled);
  return normalizeText(entry?.podcastKey);
}

function podcastSupportsEpisodes(podcast) {
  return podcastHasEpisodeConfiguration(podcast);
}

function getEpisodePodcastDisplayName(podcastOrKey) {
  const config = getEpisodePodcastConfig(podcastOrKey);
  if (config?.displayName) return config.displayName;
  if (typeof podcastOrKey !== "string" && podcastOrKey?.title) return podcastOrKey.title;
  const key = getEpisodePodcastKey(podcastOrKey);
  return key ? key.replace(/[-_]+/g, " ") : "Podcast";
}

function readLocalEpisodeRatingStore() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_EPISODE_RATINGS_STORAGE_KEY) || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeLocalEpisodeRatingStore(store) {
  try {
    window.localStorage.setItem(LOCAL_EPISODE_RATINGS_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

function getStoredLocalEpisodeRating(ratings, episode) {
  const canonicalEpisodeId = getEpisodeKey(episode);
  const direct = ratings?.[canonicalEpisodeId];
  if (direct) return direct;

  // Legacy manual IDs were title-keyed. Read one only if that title remains an
  // unambiguous alias for this exact canonical podcast; never attach a shared
  // legacy namespace to either same-title podcast.
  const legacyEpisodeId = normalizeText(episode?.legacy_manual_episode_id);
  const localPodcastKey = getLocalEpisodePodcastKey(episode?.podcast_key);
  const legacy = legacyEpisodeId ? ratings?.[legacyEpisodeId] : null;
  return legacy && getLocalEpisodePodcastKey(legacy.podcastKey) === localPodcastKey
    ? legacy
    : null;
}

function hydrateLocalEpisodeRatingState(podcastKey, episodes) {
  const localPodcastKey = getLocalEpisodePodcastKey(podcastKey);
  if (!localPodcastKey) return;

  const episodeState = getPodcastEpisodeState(localPodcastKey);
  const store = readLocalEpisodeRatingStore();
  const activeUserRatings = state.authUser ? store[state.authUser.id] || {} : {};

  (episodes || []).forEach((episode) => {
    const episodeId = getEpisodeKey(episode);
    if (!episodeId) return;

    const values = Object.values(store)
      .map((ratings) => parseNumber(getStoredLocalEpisodeRating(ratings, episode)?.rating))
      .filter((value) => value !== null);

    episodeState.statsById[episodeId] = {
      averageRating: values.length
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null,
      ratingCount: values.length
    };
    episodeState.userRatingsById[episodeId] = state.authUser
      ? parseNumber(getStoredLocalEpisodeRating(activeUserRatings, episode)?.rating)
      : null;
  });
}

function applyLegacyLocalEpisodeRatingFallback(podcastKey, episodeIds) {
  if (!state.authUser) return;

  const localPodcastKey = getLocalEpisodePodcastKey(podcastKey);
  if (!localPodcastKey) return;

  const episodeState = getPodcastEpisodeState(localPodcastKey);
  const ratings = readLocalEpisodeRatingStore()[state.authUser.id] || {};
  const ids = new Set((episodeIds || []).map(normalizeText).filter(Boolean));

  episodeState.items.forEach((episode) => {
    const episodeId = getEpisodeKey(episode);
    if (!episodeId || !ids.has(episodeId) || episodeState.userRatingsById[episodeId] !== null) return;
    episodeState.userRatingsById[episodeId] = parseNumber(getStoredLocalEpisodeRating(ratings, episode)?.rating);
  });
}

function saveLocalEpisodeRating(podcastKey, episodeId, rating) {
  if (!state.authUser) return false;
  const localPodcastKey = getLocalEpisodePodcastKey(podcastKey);
  if (!localPodcastKey) return false;

  const store = readLocalEpisodeRatingStore();
  const userRatings = store[state.authUser.id] || {};
  userRatings[episodeId] = {
    podcastKey: localPodcastKey,
    rating,
    updatedAt: new Date().toISOString()
  };
  store[state.authUser.id] = userRatings;

  if (!writeLocalEpisodeRatingStore(store)) return false;
  hydrateLocalEpisodeRatingState(localPodcastKey, getPodcastEpisodeState(localPodcastKey).items);
  return true;
}

function deleteLocalEpisodeRating(podcastKey, episodeId) {
  if (!state.authUser) return false;
  const localPodcastKey = getLocalEpisodePodcastKey(podcastKey);
  if (!localPodcastKey) return false;

  const store = readLocalEpisodeRatingStore();
  const userRatings = store[state.authUser.id] || {};
  delete userRatings[episodeId];
  store[state.authUser.id] = userRatings;

  if (!writeLocalEpisodeRatingStore(store)) return false;
  hydrateLocalEpisodeRatingState(localPodcastKey, getPodcastEpisodeState(localPodcastKey).items);
  return true;
}

function createEmptyPodcastEpisodeState() {
  return {
    items: [],
    eligibilityResolved: false,
    hasMore: true,
    totalCount: null,
    fetchedAt: 0,
    loading: false,
    loadingMore: false,
    error: "",
    searchTerm: "",
    searchLocalResults: [],
    searchResults: [],
    searchResolved: false,
    searchLoading: false,
    searchLoadingMore: false,
    searchHasMore: false,
    searchTotalCount: null,
    searchError: "",
    searchTimer: null,
    searchToken: 0,
    workspaceVisibleCount: EPISODE_WORKSPACE_PAGE_SIZE,
    statsById: {},
    userRatingsById: {},
    statsLoadingIds: new Set(),
    userRatingLoadingIds: new Set()
  };
}

function getPodcastEpisodeState(podcastOrKey) {
  const config = getEpisodePodcastConfig(podcastOrKey);
  const localEpisodeKey = usesLocalEpisodePersistence(podcastOrKey)
    ? getLocalEpisodePodcastKey(podcastOrKey)
    : "";

  const podcastKey = localEpisodeKey || (config
    ? getEpisodeDatabasePodcastKey(config)
    : normalizeText(
        typeof podcastOrKey === "string"
          ? getEpisodePodcastKey(podcastOrKey)
          : getEpisodePodcastKey(podcastOrKey)
      ));

  if (!podcastKey) {
    return createEmptyPodcastEpisodeState();
  }

  if (!state.podcastEpisodesByKey[podcastKey]) {
    state.podcastEpisodesByKey[podcastKey] = createEmptyPodcastEpisodeState();
  }

  return state.podcastEpisodesByKey[podcastKey];
}

function getActivePodcastEpisodeState() {
  return getPodcastEpisodeState(state.activePodcastDetailKey);
}

function isGenstartEpisodeCacheFresh() {
  const episodeState = getActivePodcastEpisodeState();
  return (
    episodeState.eligibilityResolved &&
    episodeState.fetchedAt > 0 &&
    Date.now() - episodeState.fetchedAt < EPISODE_CACHE_TTL_MS
  );
}

function getEpisodeKey(episode) {
  const manualEpisodeKey = normalizeText(episode?.manual_episode_key);
  const manualMapping = manualEpisodeKey
    ? state.manualCanonicalEpisodeMappings.get(manualEpisodeKey)
    : null;
  if (manualMapping?.episodeId) return manualMapping.episodeId;
  return normalizeText(episode?.id || episode?.external_guid || "");
}

function mergeEpisodes(existing, incoming) {
  const seen = new Set();
  return [...existing, ...(incoming || [])].filter((episode) => {
    const key = getEpisodeKey(episode);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatEpisodeDate(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("da-DK", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
}

function formatEpisodeDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} min.`;
}

function getEpisodeDescription(episode) {
  return normalizeText(episode?.description).replace(/\s+/g, " ");
}

function getEpisodeImage(episode, podcast) {
  return normalizeImageSource(episode?.image_url) || normalizeImageSource(podcast?.image);
}

function getEpisodeLink(episode) {
  return normalizeText(episode?.episode_url) || normalizeText(episode?.audio_url);
}

function formatEpisodeRatingCount(count) {
  const total = Number(count || 0);
  if (total === 1) return "1 vurdering";
  return `${total} vurderinger`;
}

function getEpisodeStat(episodeId) {
  const key = normalizeText(episodeId);
  for (const episodeState of Object.values(state.podcastEpisodesByKey)) {
    if (episodeState?.statsById?.[key]) return episodeState.statsById[key];
  }
  return null;
}

function getEpisodeUserRating(episodeId) {
  const key = normalizeText(episodeId);
  for (const episodeState of Object.values(state.podcastEpisodesByKey)) {
    const value = episodeState?.userRatingsById?.[key];
    if (value !== undefined) return value;
  }
  return null;
}

function getPodcastEpisodeUserRatingSummary(podcastOrKey) {
  const episodeState = getPodcastEpisodeState(podcastOrKey);
  const ratings = Object.values(episodeState.userRatingsById)
    .map((value) => parseNumber(value))
    .filter((value) => value !== null);
  const count = ratings.length;

  return {
    count,
    average: count
      ? ratings.reduce((total, value) => total + value, 0) / count
      : null
  };
}

function getEpisodeIdsForQuery(episodes) {
  return Array.from(
    new Set((episodes || []).map((episode) => getEpisodeKey(episode)).filter(Boolean))
  );
}

async function fetchManualCanonicalEpisodeMappings(episodes) {
  if (!state.supabase) return;

  const manualEpisodeKeys = [...new Set((episodes || [])
    .filter((episode) => episode?.dataSource === "manual")
    .map((episode) => normalizeText(episode.manual_episode_key))
    .filter(Boolean))]
    .filter((key) => !state.manualCanonicalEpisodeMappings.has(key) && !state.manualCanonicalResolutionLoadingKeys.has(key));
  if (!manualEpisodeKeys.length) return;

  manualEpisodeKeys.forEach((key) => state.manualCanonicalResolutionLoadingKeys.add(key));
  try {
    const { data, error } = await state.supabase
      .from("manual_catalogue_episode_map")
      .select("manual_episode_key,episode_id,canonical_source")
      .in("manual_episode_key", manualEpisodeKeys)
      .eq("is_active", true);
    if (error) throw error;
    (data || []).forEach((row) => {
      const manualEpisodeKey = normalizeText(row.manual_episode_key);
      const episodeId = normalizeText(row.episode_id);
      const canonicalSource = normalizeText(row.canonical_source);
      if (!manualEpisodeKey || !episodeId) return;
      if (canonicalSource !== MANUAL_CATALOGUE_SOURCE && canonicalSource !== REVIEWED_LEGACY_MANUAL_CATALOGUE_SOURCE) return;
      state.manualCanonicalEpisodeMappings.set(manualEpisodeKey, { episodeId, canonicalSource });
    });
  } catch (error) {
    // The migration may not have been applied yet. Keep unresolved episodes on
    // the legacy local path rather than attempting an invalid foreign-key write.
    console.error("Kunne ikke bekræfte kanoniske manuelle episoder.", error);
  } finally {
    manualEpisodeKeys.forEach((key) => state.manualCanonicalResolutionLoadingKeys.delete(key));
  }
}

async function refreshManualEpisodeRatingData(podcastKey, episodes) {
  await fetchManualCanonicalEpisodeMappings(episodes);
  const canonical = (episodes || []).filter((episode) =>
    state.manualCanonicalEpisodeMappings.has(normalizeText(episode.manual_episode_key))
  );
  const unresolved = (episodes || []).filter((episode) =>
    !state.manualCanonicalEpisodeMappings.has(normalizeText(episode.manual_episode_key))
  );
  if (unresolved.length) hydrateLocalEpisodeRatingState(podcastKey, unresolved);
  if (canonical.length) await fetchEpisodeRatingMetaForEpisodes(canonical, { update: false });
}

async function fetchEpisodeStatsForIds(ids, { force = false, podcastKey = "" } = {}) {
  const episodeState = podcastKey ? getPodcastEpisodeState(podcastKey) : getActivePodcastEpisodeState();
  const queryIds = getEpisodeIdsForQuery(ids.map((id) => ({ id }))).filter((id) => {
    if (force) return true;
    return !episodeState.statsById[id] && !episodeState.statsLoadingIds.has(id);
  });
  if (!queryIds.length || !state.supabase) return;

  queryIds.forEach((id) => episodeState.statsLoadingIds.add(id));
  try {
    const { data, error } = await state.supabase
      .from("episode_rating_public_stats")
      .select("episode_id,average_rating,rating_count")
      .in("episode_id", queryIds);

    if (error) throw error;

    const returnedIds = new Set();
    (data || []).forEach((item) => {
      const id = normalizeText(item.episode_id);
      returnedIds.add(id);
      episodeState.statsById[id] = {
        averageRating: parseNumber(item.average_rating),
        ratingCount: Number(item.rating_count || 0)
      };
    });
    queryIds.forEach((id) => {
      if (!returnedIds.has(id)) {
        episodeState.statsById[id] = { averageRating: null, ratingCount: 0 };
      }
    });
  } catch (error) {
    console.error(error);
  } finally {
    queryIds.forEach((id) => episodeState.statsLoadingIds.delete(id));
  }
}

async function fetchEpisodeUserRatingsForIds(ids, { force = false, podcastKey = "" } = {}) {
  const episodeState = podcastKey ? getPodcastEpisodeState(podcastKey) : getActivePodcastEpisodeState();
  if (!state.supabase || !state.authUser) return;

  const queryIds = getEpisodeIdsForQuery(ids.map((id) => ({ id }))).filter((id) => {
    if (force) return true;
    return episodeState.userRatingsById[id] === undefined && !episodeState.userRatingLoadingIds.has(id);
  });
  if (!queryIds.length) return;

  queryIds.forEach((id) => episodeState.userRatingLoadingIds.add(id));
  try {
    const { data, error } = await state.supabase
      .from("episode_ratings")
      .select("episode_id,rating")
      .eq("user_id", state.authUser.id)
      .in("episode_id", queryIds);

    if (error) throw error;

    const returnedIds = new Set();
    (data || []).forEach((item) => {
      const id = normalizeText(item.episode_id);
      returnedIds.add(id);
      episodeState.userRatingsById[id] = parseNumber(item.rating);
    });
    queryIds.forEach((id) => {
      if (!returnedIds.has(id)) {
        episodeState.userRatingsById[id] = null;
      }
    });
    applyLegacyLocalEpisodeRatingFallback(podcastKey, queryIds.filter((id) => !returnedIds.has(id)));
  } catch (error) {
    console.error(error);
  } finally {
    queryIds.forEach((id) => episodeState.userRatingLoadingIds.delete(id));
  }
}

async function fetchEpisodeRatingMetaForEpisodes(episodes, { force = false, update = true } = {}) {
  const groups = new Map();
  (episodes || []).forEach((episode) => {
    const id = getEpisodeKey(episode);
    if (!id) return;
    const podcastKey = normalizeText(episode?.podcast_key) || state.activePodcastDetailKey || "";
    if (!groups.has(podcastKey)) groups.set(podcastKey, []);
    groups.get(podcastKey).push(id);
  });
  if (!groups.size) return;

  await Promise.all(
    Array.from(groups.entries()).flatMap(([podcastKey, ids]) => [
      fetchEpisodeStatsForIds(ids, { force, podcastKey }),
      state.authUser ? fetchEpisodeUserRatingsForIds(ids, { force, podcastKey }) : Promise.resolve()
    ])
  );

  if (update) {
    updateGenstartEpisodeSection();
    updateOpenEpisodeDetailScores();
  }
}

function getAllCachedEpisodes() {
  return Object.values(state.podcastEpisodesByKey).flatMap((episodeState) =>
    mergeEpisodes(episodeState.items, episodeState.searchResults)
  );
}

function getGenstartEpisodeById(id) {
  const target = normalizeText(id);
  if (!target) return null;
  return (
    getAllCachedEpisodes().find((episode) => getEpisodeKey(episode) === target) ||
    state.profileEpisodeRatings.episodeMetaById[target] ||
    null
  );
}

function getProfileEpisodeRatingsState() {
  return state.profileEpisodeRatings;
}

function resetProfileEpisodeRatingsState() {
  state.profileEpisodeRatings = {
    items: [],
    episodeMetaById: {},
    hasMore: false,
    loadedFor: null,
    loading: false,
    loadingMore: false,
    error: ""
  };
}

function getProfileEpisodeRatingIds(items = getProfileEpisodeRatingsState().items) {
  return Array.from(
    new Set((items || []).map((item) => normalizeText(item.episode_id)).filter(Boolean))
  );
}

async function fetchProfileEpisodeRatings({ append = false } = {}) {
  const episodeRatings = getProfileEpisodeRatingsState();
  if (!state.supabase || !state.authUser) return;
  if (episodeRatings.loading || episodeRatings.loadingMore) return;

  const userId = state.authUser.id;
  if (!append && episodeRatings.loadedFor === userId && (episodeRatings.items.length || !episodeRatings.hasMore)) {
    updateProfileEpisodeRatingsSection();
    return;
  }

  const offset = append ? episodeRatings.items.length : 0;
  episodeRatings.loading = !append;
  episodeRatings.loadingMore = append;
  episodeRatings.error = "";

  try {
    const { data, error } = await state.supabase
      .from("episode_ratings")
      .select("episode_id,rating,created_at,updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .range(offset, offset + PROFILE_EPISODE_RATINGS_PAGE_SIZE - 1);

    if (error) throw error;

    const rows = data || [];
    const nextItems = append ? [...episodeRatings.items, ...rows] : rows;
    const seen = new Set();
    episodeRatings.items = nextItems.filter((item) => {
      const id = normalizeText(item.episode_id);
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
    episodeRatings.hasMore = rows.length === PROFILE_EPISODE_RATINGS_PAGE_SIZE;
    episodeRatings.loadedFor = userId;

    const ids = getProfileEpisodeRatingIds(rows);
    if (ids.length) {
      const { data: episodes, error: episodeError } = await state.supabase
        .from("podcast_episodes")
        .select("id,podcast_key,title,description,published_at,duration_seconds,episode_url,audio_url,image_url,is_active")
        .in("id", ids);

      if (episodeError) throw episodeError;

      (episodes || []).forEach((episode) => {
        const id = getEpisodeKey(episode);
        if (id) {
          episodeRatings.episodeMetaById[id] = episode;
          const rating = rows.find((item) => normalizeText(item.episode_id) === id);
          if (rating) {
            getPodcastEpisodeState(episode.podcast_key).userRatingsById[id] = parseNumber(rating.rating);
          }
        }
      });

      await Promise.all(
        Array.from(
          (episodes || []).reduce((map, episode) => {
            const key = normalizeText(episode.podcast_key);
            const id = getEpisodeKey(episode);
            if (!key || !id) return map;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(id);
            return map;
          }, new Map())
        ).map(([podcastKey, episodeIds]) => fetchEpisodeStatsForIds(episodeIds, { podcastKey }))
      );
    }
  } catch (error) {
    console.error(error);
    episodeRatings.error = "Dine episodevurderinger kunne ikke hentes lige nu.";
  } finally {
    episodeRatings.loading = false;
    episodeRatings.loadingMore = false;
    updateProfileEpisodeRatingsSection();
  }
}

function createProfileEpisodeRatingCardElement(item) {
  const episodeId = normalizeText(item.episode_id);
  const episode = getGenstartEpisodeById(episodeId);
  const podcastKey = normalizeText(episode?.podcast_key) || getDefaultEpisodePodcastKey();
  const podcast = resolvePodcastByStoredKey(podcastKey);
  const podcastName = getEpisodePodcastDisplayName(podcast || podcastKey);
  const stat = getEpisodeStat(episodeId);
  const userRating = parseNumber(item.rating);
  const hasPublicRating = stat && Number(stat.ratingCount || 0) > 0 && stat.averageRating !== null;
  const title = episode?.title || `${podcastName}-episode`;
  const date = formatEpisodeDate(episode?.published_at);
  const duration = formatEpisodeDuration(episode?.duration_seconds);
  const isActive = episode?.is_active !== false;

  const card = document.createElement("article");
  card.className = `profile-episode-card${isActive ? "" : " profile-episode-card--inactive"}`;
  card.dataset.profileEpisodeId = episodeId;
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Vis episoden ${title}`);

  const cover = document.createElement("div");
  cover.className = "profile-episode-card__cover";
  const image = document.createElement("img");
  image.className = "profile-episode-card__image";
  image.loading = "lazy";
  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder profile-episode-card__placeholder";
  placeholder.textContent = "Episode";
  placeholder.hidden = true;
  cover.append(image, placeholder);
  setImageWithFallbackSource(cover, episode?.image_url, podcast?.image, title);

  const meta = [date, duration].filter(Boolean).join(" · ");
  const copy = document.createElement("div");
  copy.className = "profile-episode-card__copy";
  copy.innerHTML = `
    <span class="profile-episode-card__series">${escapeHtml(podcastName)}</span>
    <h3>${escapeHtml(title)}</h3>
    <p>${escapeHtml(meta || (isActive ? "Episode" : "Episoden er ikke l\u00e6ngere tilg\u00e6ngelig"))}</p>
  `;

  const scores = document.createElement("div");
  scores.className = "profile-episode-card__scores";
  scores.innerHTML = `
    <strong
      class="profile-episode-card__score profile-episode-card__score--mine"
      aria-label="Din vurdering ${escapeHtml(formatCompactRating(userRating))}"
    >
      <span class="profile-episode-card__score-label">Din vurdering</span>
      <span class="profile-episode-card__score-value">${escapeHtml(formatCompactRating(userRating))}</span>
      <span class="profile-episode-card__score-scale">/ 10</span>
    </strong>
    ${
      hasPublicRating
        ? `<span class="profile-episode-card__score profile-episode-card__score--public">
            Brugere ${escapeHtml(formatCompactRating(stat.averageRating))}
            <small>${escapeHtml(formatEpisodeRatingCount(stat.ratingCount))}</small>
          </span>`
        : `<span class="profile-episode-card__score profile-episode-card__score--empty">Ingen samlet score endnu</span>`
    }
  `;

  card.append(cover, copy, scores);
  card.addEventListener("click", (event) => {
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openProfileEpisodeDetail(episodeId, card);
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openProfileEpisodeDetail(episodeId, card);
  });

  return card;
}

function renderProfileEpisodeRatingsSectionContent(container = document) {
  const ratingsContainer = container.querySelector("[data-profile-episode-ratings]");
  if (!ratingsContainer) return;

  const episodeRatings = getProfileEpisodeRatingsState();
  const loadedForCurrentUser = episodeRatings.loadedFor === state.authUser?.id;
  const count = episodeRatings.items.length;
  const countElement = container.querySelector("[data-profile-episode-ratings-count]");
  if (countElement) countElement.textContent = loadedForCurrentUser ? String(count) : "";

  if (!loadedForCurrentUser || (episodeRatings.loading && !count)) {
    ratingsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Henter dine episodevurderinger &hellip;</h3>
        <p>Vi finder de episoder, du har vurderet.</p>
      </div>
    `;
  } else if (episodeRatings.error) {
    ratingsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Dine episodevurderinger kunne ikke hentes lige nu.</h3>
        <p>Pr&oslash;v igen om lidt.</p>
        <button class="profile-button profile-button--quiet" type="button" data-profile-episode-ratings-retry>
          Pr&oslash;v igen
        </button>
      </div>
    `;
  } else if (!count) {
    ratingsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Du har endnu ikke vurderet nogen episoder.</h3>
        <p>Vurder en episode, s&aring; samler vi den her.</p>
      </div>
    `;
  } else {
    const fragment = document.createDocumentFragment();
    episodeRatings.items.forEach((item) => {
      fragment.appendChild(createProfileEpisodeRatingCardElement(item));
    });
    ratingsContainer.replaceChildren(fragment);
  }

  const moreButton = container.querySelector("[data-profile-episode-ratings-more]");
  if (moreButton) {
    moreButton.hidden = !loadedForCurrentUser || !episodeRatings.hasMore || Boolean(episodeRatings.error);
    moreButton.disabled = episodeRatings.loadingMore;
    moreButton.textContent = episodeRatings.loadingMore
      ? "Henter flere ..."
      : "Vis flere episodevurderinger";
  }

  bindProfileEpisodeRatingsEvents(container);
}

function updateProfileEpisodeRatingsSection() {
  const section = document.getElementById("profileEpisodeRatings");
  if (!section) return;
  renderProfileEpisodeRatingsSectionContent(section);
}

function bindProfileEpisodeRatingsEvents(container = document) {
  const moreButton = container.querySelector("[data-profile-episode-ratings-more]");
  if (moreButton && moreButton.dataset.profileEpisodeRatingsBound !== "true") {
    moreButton.dataset.profileEpisodeRatingsBound = "true";
    moreButton.addEventListener("click", (event) => {
      event.preventDefault();
      fetchProfileEpisodeRatings({ append: true });
    });
  }

  container.querySelectorAll("[data-profile-episode-ratings-retry]").forEach((button) => {
    if (button.dataset.profileEpisodeRatingsBound === "true") return;
    button.dataset.profileEpisodeRatingsBound = "true";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const episodeRatings = getProfileEpisodeRatingsState();
      episodeRatings.loadedFor = null;
      fetchProfileEpisodeRatings();
    });
  });
}

function updateProfileEpisodeRatingAfterSave(episodeId, rating) {
  const id = normalizeText(episodeId);
  if (!id || !state.authUser) return;

  const episodeRatings = getProfileEpisodeRatingsState();
  if (episodeRatings.loadedFor !== state.authUser.id) return;

  const now = new Date().toISOString();
  const existingIndex = episodeRatings.items.findIndex((item) => normalizeText(item.episode_id) === id);
  const nextItem = {
    episode_id: id,
    rating,
    created_at: existingIndex >= 0 ? episodeRatings.items[existingIndex].created_at : now,
    updated_at: now
  };

  if (existingIndex >= 0) {
    episodeRatings.items.splice(existingIndex, 1);
  }
  episodeRatings.items.unshift(nextItem);
  updateProfileEpisodeRatingsSection();
}

function openProfileEpisodeDetail(episodeId, triggerElement = null) {
  const episode = getGenstartEpisodeById(episodeId);
  const podcastKey = normalizeText(episode?.podcast_key) || getDefaultEpisodePodcastKey();
  const podcast = state.podcastByKey[podcastKey] || {
    key: podcastKey,
    title: getEpisodePodcastDisplayName(podcastKey),
    image: ""
  };
  if (!episode || !podcast) return;

  const dialog = ensurePodcastDetailSheet();
  state.activePodcastDetailKey = podcastKey;
  state.podcastDetailView = "episode";
  state.podcastDetailMainSeriesValue = "";
  state.podcastDetailMainSeriesSourceKey = null;
  state.podcastDetailBackToMainSeries = false;
  state.podcastDetailDetailScrollTop = 0;
  state.podcastDetailEpisodeId = getEpisodeKey(episode);
  state.podcastDetailEpisodeScrollTop = 0;
  state.podcastDetailReturnFocus = triggerElement || document.activeElement;
  state.podcastDetailScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);

  renderPodcastEpisodeDetailContent(dialog, podcast, episode, { backLabel: "Tilbage til Profil" });
  resetPodcastDetailDragStyles(dialog);
  dialog.classList.remove("is-hidden");
  dialog.setAttribute("aria-hidden", "false");
  dialog.querySelector("[data-podcast-detail-content]")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  document.body.style.setProperty("--podcast-detail-scroll-y", `${state.podcastDetailScrollY}px`);
  document.body.classList.add("has-dialog-open", "has-podcast-detail-open");
}

function getLocalGenstartEpisodeMatches(term) {
  const comparable = normalizeComparable(term);
  if (!comparable) return [];
  return getActivePodcastEpisodeState().items.filter((episode) => {
    const haystack = normalizeComparable(`${episode.title || ""} ${episode.description || ""}`);
    return haystack.includes(comparable);
  });
}

function getSupabaseLikePattern(value) {
  return normalizeText(value).replace(/[%,()]/g, " ").replace(/_/g, "\\_").replace(/\s+/g, " ").trim();
}

async function loadLocalEpisodeData() {
  if (!state.localEpisodeDataPromise) {
    state.localEpisodeDataPromise = fetch(`${LOCAL_EPISODE_DATA_URL}?v=${DATA_VERSION}`, {
      cache: "no-store"
    }).then(async (response) => {
      if (!response.ok) {
        throw new Error(`Kunne ikke hente lokale episoder (HTTP ${response.status}).`);
      }
      return response.json();
    });
  }
  return state.localEpisodeDataPromise;
}

async function fetchGenstartEpisodes({ append = false } = {}) {
  const config = getEpisodePodcastConfig(state.activePodcastDetailKey);
  if (!config) return;
  const episodeState = getPodcastEpisodeState(config.podcastKey);
  if (config.dataSource === "local") {
    if (episodeState.loading) return;

    episodeState.loading = true;
    episodeState.error = "";
    try {
      const payload = await loadLocalEpisodeData();
      const entry = payload?.podcasts?.[config.podcastKey];
      const rows = Array.isArray(entry?.episodes)
        ? entry.episodes.map((episode) => resolveManualCatalogueEpisodeFromLocalRow(config.podcastKey, episode))
        : [];
      episodeState.items = getRateablePodcastEpisodes(mergeEpisodes([], rows)).sort(
        (left, right) => Number(left.episode_number || 0) - Number(right.episode_number || 0)
      );
      episodeState.eligibilityResolved = true;
      episodeState.hasMore = false;
      episodeState.totalCount = episodeState.items.length;
      episodeState.fetchedAt = Date.now();
      refreshManualEpisodeRatingData(config.podcastKey, episodeState.items)
        .then(() => {
          updateGenstartEpisodeSection();
          updateOpenEpisodeDetailScores();
        })
        .catch(console.error);
    } catch (error) {
      console.error(error);
      episodeState.error = "Episoderne kunne ikke hentes lige nu.";
    } finally {
      episodeState.loading = false;
    }
    return;
  }

  if (!state.supabase) {
    episodeState.error = "Episoderne kunne ikke hentes lige nu.";
    return;
  }

  if (episodeState.loading || episodeState.loadingMore) return;

  const offset = append ? episodeState.items.length : 0;
  episodeState.loading = !append;
  episodeState.loadingMore = append;
  episodeState.error = "";

  try {
    const { data, error, count } = await state.supabase
      .from("podcast_episodes")
      .select("id,podcast_key,title,description,published_at,duration_seconds,episode_url,audio_url,image_url,external_guid,is_active,metadata", { count: "exact" })
      .eq("podcast_key", getEpisodeDatabasePodcastKey(config))
      .eq("is_active", true)
      .order("published_at", { ascending: false })
      .range(offset, offset + EPISODE_PAGE_SIZE - 1);

    if (error) throw error;

    const fetchedRows = data || [];
    const rows = getRateablePodcastEpisodes(fetchedRows);
    episodeState.items = append
      ? mergeEpisodes(episodeState.items, rows)
      : mergeEpisodes([], rows);
    episodeState.eligibilityResolved = true;
    episodeState.totalCount = Number.isFinite(count) ? count : null;
    episodeState.hasMore = fetchedRows.length === EPISODE_PAGE_SIZE && (
      episodeState.totalCount === null || offset + fetchedRows.length < episodeState.totalCount
    );
    episodeState.fetchedAt = Date.now();
    fetchEpisodeRatingMetaForEpisodes(rows).catch(console.error);
  } catch (error) {
    console.error(error);
    episodeState.error = "Episoderne kunne ikke hentes lige nu.";
  } finally {
    episodeState.loading = false;
    episodeState.loadingMore = false;
  }
}

async function searchGenstartEpisodes(term, token, { append = false } = {}) {
  const config = getEpisodePodcastConfig(state.activePodcastDetailKey);
  if (!config) return;
  const episodeState = getPodcastEpisodeState(config.podcastKey);
  if (!state.supabase) {
    episodeState.searchError = "S\u00f8gning er ikke tilg\u00e6ngelig lige nu.";
    return;
  }

  const cleanTerm = normalizeText(term);
  if (cleanTerm.length < 2 || (append && (!episodeState.searchHasMore || episodeState.searchLoadingMore))) return;

  const offset = append ? episodeState.searchResults.length : 0;
  episodeState.searchLoading = !append;
  episodeState.searchLoadingMore = append;
  episodeState.searchError = "";
  updateGenstartEpisodeSection();

  try {
    const pattern = `%${getSupabaseLikePattern(cleanTerm)}%`;
    const { data, error, count } = await state.supabase
      .from("podcast_episodes")
      .select("id,podcast_key,title,description,published_at,duration_seconds,episode_url,audio_url,image_url,external_guid,is_active,metadata", { count: "exact" })
      .eq("podcast_key", getEpisodeDatabasePodcastKey(config))
      .eq("is_active", true)
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .order("published_at", { ascending: false })
      .range(offset, offset + EPISODE_PAGE_SIZE - 1);

    if (token !== episodeState.searchToken) return;
    if (error) throw error;

    const fetchedRows = data || [];
    const rows = getRateablePodcastEpisodes(fetchedRows);
    episodeState.searchResults = append
      ? mergeEpisodes(episodeState.searchResults, rows)
      : getRateablePodcastEpisodes(mergeEpisodes([], rows));
    episodeState.searchResolved = true;
    episodeState.searchTotalCount = Number.isFinite(count) ? count : null;
    episodeState.searchHasMore = fetchedRows.length === EPISODE_PAGE_SIZE && (
      episodeState.searchTotalCount === null || offset + fetchedRows.length < episodeState.searchTotalCount
    );
    fetchEpisodeRatingMetaForEpisodes(rows).catch(console.error);
  } catch (error) {
    if (token !== episodeState.searchToken) return;
    console.error(error);
    episodeState.searchError = "Episoderne kunne ikke s\u00f8ges lige nu.";
  } finally {
    if (token === episodeState.searchToken) {
      episodeState.searchLoading = false;
      episodeState.searchLoadingMore = false;
      updateGenstartEpisodeSection();
      if (state.podcastDetailView === "episodes") {
        updatePodcastEpisodeOverview();
      }
    }
  }
}

function ensureGenstartEpisodesLoaded() {
  const episodeState = getActivePodcastEpisodeState();
  if (isGenstartEpisodeCacheFresh() || episodeState.loading) return;

  fetchGenstartEpisodes().then(updateGenstartEpisodeSection);
}

function scheduleGenstartEpisodeSearch(term) {
  const episodeState = getActivePodcastEpisodeState();
  window.clearTimeout(episodeState.searchTimer);
  episodeState.searchTerm = term;
  episodeState.searchLocalResults = getLocalGenstartEpisodeMatches(term);
  episodeState.searchResults = [];
  episodeState.searchResolved = false;
  episodeState.searchLoadingMore = false;
  episodeState.searchHasMore = false;
  episodeState.searchTotalCount = null;

  if (normalizeText(term).length < 2) {
    episodeState.searchResults = [];
    episodeState.searchResolved = false;
    episodeState.searchLoading = false;
    episodeState.searchLoadingMore = false;
    episodeState.searchHasMore = false;
    episodeState.searchTotalCount = null;
    episodeState.searchError = "";
    episodeState.searchToken += 1;
    updateGenstartEpisodeSection();
    return;
  }

  const token = episodeState.searchToken + 1;
  episodeState.searchToken = token;
  updateGenstartEpisodeSection();
  episodeState.searchTimer = window.setTimeout(() => {
    searchGenstartEpisodes(term, token);
  }, EPISODE_SEARCH_DEBOUNCE_MS);
}

function resetGenstartEpisodeSearch() {
  const episodeState = getActivePodcastEpisodeState();
  window.clearTimeout(episodeState.searchTimer);
  episodeState.searchTerm = "";
  episodeState.searchLocalResults = [];
  episodeState.searchResults = [];
  episodeState.searchResolved = false;
  episodeState.searchLoading = false;
  episodeState.searchError = "";
  episodeState.searchToken += 1;
}

function getVisibleGenstartEpisodes() {
  const episodeState = getActivePodcastEpisodeState();
  const hasSearch = normalizeText(episodeState.searchTerm).length > 0;
  if (!hasSearch) return episodeState.items;
  if (episodeState.searchResolved) return episodeState.searchResults;
  return episodeState.searchResults.length ? episodeState.searchResults : episodeState.searchLocalResults;
}

function renderGenstartEpisodeRows(podcast) {
  const episodeState = getPodcastEpisodeState(podcast);
  const hasSearch = normalizeText(episodeState.searchTerm).length > 0;
  const episodes = getVisibleGenstartEpisodes();

  if (episodeState.loading && !episodeState.items.length) {
    return `<p class="podcast-detail-sheet__episodes-state" role="status">Henter episoder ...</p>`;
  }

  if (episodeState.error && !episodeState.items.length) {
    return `
      <div class="podcast-detail-sheet__episodes-state" role="alert">
        <p>${escapeHtml(episodeState.error)}</p>
        <button type="button" data-genstart-episodes-retry>Pr\u00f8v igen</button>
      </div>
    `;
  }

  if (!episodes.length) {
    return `<p class="podcast-detail-sheet__episodes-state">${hasSearch ? "Ingen episoder matcher din s\u00f8gning." : "Der er endnu ingen episoder at vise."}</p>`;
  }

  return episodes
    .map((episode, index) => {
      const date = formatEpisodeDate(episode.published_at);
      const duration = formatEpisodeDuration(episode.duration_seconds);
      const description = getEpisodeDescription(episode);
      const episodeKey = getEpisodeKey(episode);
      const stat = getEpisodeStat(episodeKey);
      const userRating = getEpisodeUserRating(episodeKey);
      const hasPublicRating = stat && Number(stat.ratingCount || 0) > 0 && stat.averageRating !== null;
      return `
        <button
          class="podcast-detail-sheet__episode-row"
          type="button"
          data-genstart-episode-id="${escapeHtml(episodeKey)}"
          aria-label="Vis episoden ${escapeHtml(episode.title || "Podcast-episode")}"
        >
          <span class="podcast-detail-sheet__episode-cover" data-genstart-episode-cover="${escapeHtml(episodeKey)}">
            <img alt="" loading="${index < 4 ? "eager" : "lazy"}" decoding="async" />
          </span>
          <span class="podcast-detail-sheet__episode-copy">
            <strong>${escapeHtml(episode.title || "Podcast-episode")}</strong>
            <span class="podcast-detail-sheet__episode-meta">
              ${date ? `<span>${escapeHtml(date)}</span>` : ""}
              ${duration ? `<span>${escapeHtml(duration)}</span>` : ""}
            </span>
            <span class="podcast-detail-sheet__episode-scores" aria-label="Episodevurderinger">
              ${
                hasPublicRating
                  ? `<span class="podcast-detail-sheet__episode-score"><strong>${escapeHtml(
                      formatCompactRating(stat.averageRating)
                    )}</strong><small>${escapeHtml(formatEpisodeRatingCount(stat.ratingCount))}</small></span>`
                  : `<span class="podcast-detail-sheet__episode-score podcast-detail-sheet__episode-score--empty">Ingen vurderinger endnu</span>`
              }
              ${
                userRating !== null
                  ? `<span class="podcast-detail-sheet__episode-score podcast-detail-sheet__episode-score--mine">Din ${escapeHtml(
                      formatCompactRating(userRating)
                    )}</span>`
                  : ""
              }
            </span>
            ${description ? `<span class="podcast-detail-sheet__episode-description">${escapeHtml(description)}</span>` : ""}
          </span>
          <span class="podcast-detail-sheet__episode-arrow" aria-hidden="true">&rsaquo;</span>
        </button>
      `;
    })
    .join("");
}

function renderGenstartEpisodesSection(podcast) {
  const config = getEpisodePodcastConfig(podcast);
  const episodeState = getPodcastEpisodeState(config || podcast);
  const displayName = config?.displayName || podcast.title || "Podcast";
  const searchPlaceholder = config?.searchPlaceholder || `S\u00f8g i ${displayName}-episoder`;
  const searchTerm = episodeState.searchTerm || "";
  const hasSearch = normalizeText(searchTerm).length > 0;
  const canShowMore = !hasSearch && episodeState.hasMore && episodeState.items.length > 0;

  return `
    <section class="podcast-detail-sheet__episodes" data-genstart-episodes-section aria-labelledby="genstartEpisodesTitle">
      <div class="podcast-detail-sheet__episodes-head">
        <div>
          <span>${escapeHtml(displayName)}</span>
          <h3 id="genstartEpisodesTitle">Episoder</h3>
        </div>
        ${episodeState.items.length ? `<em>${episodeState.items.length}+ hentet</em>` : ""}
      </div>
      <div class="podcast-detail-sheet__episode-search">
        <span class="sr-only">${escapeHtml(searchPlaceholder)}</span>
        <input
          type="search"
          value="${escapeHtml(searchTerm)}"
          placeholder="${escapeHtml(searchPlaceholder)}"
          aria-label="${escapeHtml(searchPlaceholder)}"
          autocomplete="off"
          data-genstart-episode-search
        />
        <button
          class="podcast-detail-sheet__episode-search-clear${hasSearch ? "" : " is-hidden"}"
          type="button"
          aria-label="Ryd episodes\u00f8gning"
          data-genstart-episode-search-clear
        >&times;</button>
      </div>
      ${episodeState.searchLoading ? `<p class="podcast-detail-sheet__episodes-searching" role="status">S\u00f8ger i episoder ...</p>` : ""}
      ${episodeState.searchError ? `<p class="podcast-detail-sheet__episodes-searching" role="alert">${escapeHtml(episodeState.searchError)}</p>` : ""}
      <div class="podcast-detail-sheet__episode-list">
        ${renderGenstartEpisodeRows(podcast)}
      </div>
      ${
        canShowMore
          ? `<button class="podcast-detail-sheet__episode-more" type="button" data-genstart-episodes-more${episodeState.loadingMore ? " disabled aria-busy=\"true\"" : ""}>${
              episodeState.loadingMore ? "Henter flere ..." : "Vis flere episoder"
            }</button>`
          : ""
      }
    </section>
  `;
}

function formatEpisodeOverviewScore(value) {
  const numeric = parseNumber(value);
  return `${numeric === null ? "\u2014" : formatCompactRating(numeric)} <small>/10</small>`;
}

function formatEpisodeOverviewOwnScore(value) {
  return value === null ? "Vurder" : formatEpisodeOverviewScore(value);
}

function getEpisodeWorkspaceEpisodes(podcast) {
  const episodeState = getPodcastEpisodeState(podcast);
  const searchTerm = normalizeText(episodeState.searchTerm);
  const config = getEpisodePodcastConfig(podcast);

  if (!searchTerm) return episodeState.items;
  if (config?.dataSource !== "local" && config) return getVisibleGenstartEpisodes();

  const comparableSearch = normalizeComparable(searchTerm);
  return episodeState.items.filter((episode) =>
    normalizeComparable(episode.title || "").includes(comparableSearch)
  );
}

function getEpisodeWorkspaceSummary(podcast) {
  const episodeState = getPodcastEpisodeState(podcast);
  const hasSearch = normalizeText(episodeState.searchTerm).length > 0;
  const loaded = getEpisodeWorkspaceEpisodes(podcast).length;
  const total = hasSearch
    ? (episodeState.searchTotalCount ?? loaded)
    : (episodeState.totalCount ?? loaded);
  const visible = Math.min(loaded, episodeState.workspaceVisibleCount || EPISODE_WORKSPACE_PAGE_SIZE);
  if (!total && hasSearch) return "Ingen episoder matcher din s\u00f8gning.";
  if (!total) return "Der er endnu ingen episoder at vise.";
  return visible < total ? `Viser ${visible} af ${total} episoder` : `${total} episoder`;
}

function resetEpisodeWorkspaceSearch(podcast) {
  const episodeState = getPodcastEpisodeState(podcast);
  window.clearTimeout(episodeState.searchTimer);
  episodeState.searchTerm = "";
  episodeState.searchLocalResults = [];
  episodeState.searchResults = [];
  episodeState.searchResolved = false;
  episodeState.searchLoading = false;
  episodeState.searchLoadingMore = false;
  episodeState.searchHasMore = false;
  episodeState.searchTotalCount = null;
  episodeState.searchError = "";
  episodeState.searchToken += 1;
  episodeState.workspaceVisibleCount = EPISODE_WORKSPACE_PAGE_SIZE;
}

function scheduleEpisodeWorkspaceSearch(podcast, term) {
  const config = getEpisodePodcastConfig(podcast);
  const episodeState = getPodcastEpisodeState(podcast);
  document
    .querySelector("#podcastDetailSheet .podcast-detail-sheet__episode-table-wrap")
    ?.scrollTo({ top: 0, left: 0, behavior: "auto" });
  episodeState.workspaceVisibleCount = EPISODE_WORKSPACE_PAGE_SIZE;
  if (config && config.dataSource !== "local") {
    scheduleGenstartEpisodeSearch(term);
    updatePodcastEpisodeOverview();
    return;
  }
  episodeState.searchTerm = term;
  episodeState.searchLocalResults = [];
  episodeState.searchResults = [];
  episodeState.searchResolved = Boolean(normalizeText(term));
  episodeState.searchLoading = false;
  episodeState.searchError = "";
  updatePodcastEpisodeOverview();
}

function renderPodcastEpisodeOverviewRows(podcast) {
  const episodeState = getPodcastEpisodeState(podcast);
  const showPublicationDate = Boolean(getEpisodePodcastConfig(podcast)) && getEpisodePodcastConfig(podcast)?.dataSource !== "local";

  if (episodeState.loading && !episodeState.items.length) {
    return `<tr><td colspan="4" class="podcast-detail-sheet__episode-table-state">Henter episoder &hellip;</td></tr>`;
  }

  if (episodeState.error && !episodeState.items.length) {
    return `<tr><td colspan="4" class="podcast-detail-sheet__episode-table-state">${escapeHtml(
      episodeState.error
    )}</td></tr>`;
  }

  const allEpisodes = getEpisodeWorkspaceEpisodes(podcast);
  if (!allEpisodes.length) {
    return `<tr><td colspan="4" class="podcast-detail-sheet__episode-table-state">Der er endnu ingen episoder at vise.</td></tr>`;
  }

  return allEpisodes
    .slice(0, episodeState.workspaceVisibleCount || EPISODE_WORKSPACE_PAGE_SIZE)
    .map((episode, index) => {
      const episodeId = getEpisodeKey(episode);
      const episodeNumber = Number(episode.episode_number || index + 1);
      // Only surface an upstream publication date when the episode actually has
      // one. Manual catalogue entries intentionally have no inferred date.
      const publicationDate = showPublicationDate ? formatEpisodeDate(episode.published_at) : "";
      const stat = getEpisodeStat(episodeId);
      const userRating = getEpisodeUserRating(episodeId);
      const sourceScore = parseNumber(stat?.averageRating);
      const ratingCount = Number(stat?.ratingCount || 0);
      const title = episode.title || `Episode ${episodeNumber}`;
      const titleLengthClass = title.length > 115
        ? " episode-title--very-long"
        : title.length > 72
          ? " episode-title--long"
          : "";
      const rowStateClasses = [
        ratingCount > 0 ? "is-community-rated" : "",
        userRating === null ? "" : "is-user-rated"
      ].filter(Boolean).join(" ");

      return `
        <tr class="${rowStateClasses}">
          ${
            showPublicationDate
              ? `<td class="episode-publication-date-cell" data-label="Udgivelsesdato" aria-label="Udgivelsesdato ${escapeHtml(
                  publicationDate || "ukendt"
                )}">${escapeHtml(publicationDate || "—")}</td>`
              : `<td data-label="#">${escapeHtml(String(episodeNumber))}</td>`
          }
          <td data-label="Episode" data-published-date="${escapeHtml(publicationDate)}">
            <strong class="episode-title${titleLengthClass}">${escapeHtml(title)}</strong>
          </td>
          <td data-label="Brugere">
            <span class="podcast-detail-sheet__episode-source-score">
              <strong>${formatEpisodeOverviewScore(sourceScore)}</strong>
              <em>${ratingCount ? escapeHtml(formatUserRatingCount(ratingCount)) : ""}</em>
            </span>
          </td>
          <td data-label="Din vurdering">
            <button
              class="podcast-detail-sheet__episode-own-score${userRating === null ? " is-empty" : ""}"
              type="button"
              data-episode-overview-rating-id="${escapeHtml(episodeId)}"
              aria-label="${userRating === null ? "Vurder" : "Rediger vurderingen af"} ${escapeHtml(
                episode.title || `episode ${episodeNumber}`
              )}"
            >
              <strong>${formatEpisodeOverviewOwnScore(userRating)}</strong>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function ensureManualPodcastEpisodeState(podcast) {
  const episodeState = getPodcastEpisodeState(podcast);
  const episodes = getPodcastManualEpisodes(podcast);
  const podcastKey = getLocalEpisodePodcastKey(podcast);

  episodeState.items = mergeEpisodes([], episodes);
  episodeState.hasMore = false;
  episodeState.loading = false;
  episodeState.loadingMore = false;
  episodeState.error = "";
  episodeState.fetchedAt = Date.now();

  episodes.forEach((episode) => {
    const episodeId = getEpisodeKey(episode);
    if (episodeId) {
      state.profileEpisodeRatings.episodeMetaById[episodeId] = episode;
    }
  });

  return episodes;
}

function renderManualPodcastEpisodeOverviewRows(podcast) {
  return getPodcastManualEpisodes(podcast)
    .map((episode, index) => {
      const episodeId = getEpisodeKey(episode);
      const episodeNumber = Number(episode.episode_number || index + 1);
      const stat = getEpisodeStat(episodeId);
      const userRating = getEpisodeUserRating(episodeId);
      const sourceScore = parseNumber(stat?.averageRating);
      const ratingCount = Number(stat?.ratingCount || 0);

      return `
        <tr>
          <td data-label="#">${escapeHtml(String(episodeNumber))}</td>
          <td data-label="Episode">
            <strong>${escapeHtml(episode.title || `Episode ${episodeNumber}`)}</strong>
          </td>
          <td data-label="Brugere">
            <span class="podcast-detail-sheet__episode-source-score">
              <strong>${formatEpisodeOverviewScore(sourceScore)}</strong>
              <em>${ratingCount ? escapeHtml(formatUserRatingCount(ratingCount)) : ""}</em>
            </span>
          </td>
          <td data-label="Din vurdering">
            <button
              class="podcast-detail-sheet__episode-own-score${userRating === null ? " is-empty" : ""}"
              type="button"
              data-episode-overview-rating-id="${escapeHtml(episodeId)}"
              aria-label="${userRating === null ? "Vurder" : "Rediger vurderingen af"} ${escapeHtml(
                episode.title || `episode ${episodeNumber}`
              )}"
            >
              <strong>${formatEpisodeOverviewOwnScore(userRating)}</strong>
            </button>
          </td>
        </tr>
      `;
    })
    .join("");
}

function renderPodcastEpisodeOverview(podcast) {
  const config = getEpisodePodcastConfig(podcast);
  const isManualEpisodeList = !config && podcastHasManualEpisodeList(podcast);
  const firstColumnLabel = !config || config.dataSource === "local" ? "#" : "Udgivelsesdato";
  if (isManualEpisodeList) ensureManualPodcastEpisodeState(podcast);
  const episodeState = getPodcastEpisodeState(podcast);
  const searchPlaceholder = config?.searchPlaceholder || `S\u00f8g i ${podcast.title || "podcastens"} episoder`;

  return `
    <section class="podcast-detail-sheet__episode-overview" data-podcast-episode-overview aria-labelledby="podcastEpisodeOverviewTitle">
      <div class="podcast-detail-sheet__episode-overview-toolbar">
        <button class="podcast-detail-sheet__episode-back" type="button" data-podcast-episode-overview-back>
          <span aria-hidden="true">&larr;</span>
          <span>Tilbage til podcasten</span>
        </button>
        <h2 class="podcast-detail-sheet__episode-workspace-title">Episoder</h2>
        <label class="podcast-detail-sheet__episode-search">
          <span class="sr-only">S&oslash;g i episoder</span>
          <input type="search" value="${escapeHtml(episodeState.searchTerm || "")}" placeholder="${escapeHtml(searchPlaceholder)}" data-episode-workspace-search autocomplete="off" />
        </label>
      </div>
      <p class="podcast-detail-sheet__episode-workspace-summary" data-episode-workspace-summary aria-live="polite">${escapeHtml(getEpisodeWorkspaceSummary(podcast))}</p>
      <div class="podcast-detail-sheet__episode-table-wrap">
        <table class="podcast-detail-sheet__episode-table${isManualEpisodeList ? " podcast-detail-sheet__episode-table--manual" : ""}${firstColumnLabel === "Udgivelsesdato" ? " podcast-detail-sheet__episode-table--publication-date" : ""}">
          <caption class="sr-only" id="podcastEpisodeOverviewTitle">Episoder i ${escapeHtml(
            podcast.title || "podcasten"
          )}</caption>
          <colgroup>
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr>
              <th scope="col"${
                firstColumnLabel === "Udgivelsesdato" ? ' class="episode-publication-date-header"' : ""
              }>${firstColumnLabel}</th>
              <th scope="col">Episode</th>
              <th scope="col">Brugernes vurdering</th>
              <th scope="col">Din vurdering</th>
            </tr>
          </thead>
          <tbody data-episode-workspace-rows>${renderPodcastEpisodeOverviewRows(podcast)}</tbody>
        </table>
      </div>
      ${
        config?.teaserExcluded
          ? `<p class="podcast-detail-sheet__episode-note">${escapeHtml(
              String(config.episodeCount || 9)
            )} udgivne episoder. Teaseren kan ikke bed&oslash;mmes.</p>`
          : ""
      }
    </section>
  `;
}

function bindPodcastEpisodeOverviewEvents(dialog, podcast) {
  const overview = dialog?.querySelector("[data-podcast-episode-overview]");
  if (!overview) return;

  const tableWrap = overview.querySelector(".podcast-detail-sheet__episode-table-wrap");
  const searchInput = overview.querySelector("[data-episode-workspace-search]");
  if (searchInput?.dataset.episodeWorkspaceBound !== "true") {
    searchInput.dataset.episodeWorkspaceBound = "true";
    searchInput.addEventListener("input", (event) => {
      scheduleEpisodeWorkspaceSearch(podcast, event.currentTarget.value);
    });
  }

  if (tableWrap?.dataset.episodeWorkspaceScrollBound !== "true") {
    tableWrap.dataset.episodeWorkspaceScrollBound = "true";
    tableWrap.addEventListener("scroll", async () => {
      const episodeState = getPodcastEpisodeState(podcast);
      const loaded = getEpisodeWorkspaceEpisodes(podcast).length;
      const visible = episodeState.workspaceVisibleCount || EPISODE_WORKSPACE_PAGE_SIZE;
      if (tableWrap.scrollTop + tableWrap.clientHeight < tableWrap.scrollHeight - 80) return;

      if (visible < loaded) {
        episodeState.workspaceVisibleCount = Math.min(loaded, visible + EPISODE_WORKSPACE_PAGE_SIZE);
        const rows = overview.querySelector("[data-episode-workspace-rows]");
        const summary = overview.querySelector("[data-episode-workspace-summary]");
        if (rows) rows.innerHTML = renderPodcastEpisodeOverviewRows(podcast);
        if (summary) summary.textContent = getEpisodeWorkspaceSummary(podcast);
        bindPodcastEpisodeOverviewEvents(dialog, podcast);
        return;
      }

      const config = getEpisodePodcastConfig(podcast);
      if (!config || config.dataSource === "local") return;
      const hasSearch = normalizeText(episodeState.searchTerm).length > 0;
      const canLoadMore = hasSearch ? episodeState.searchHasMore : episodeState.hasMore;
      const loadingMore = hasSearch ? episodeState.searchLoadingMore : episodeState.loadingMore;
      if (!canLoadMore || loadingMore) return;

      if (hasSearch) {
        await searchGenstartEpisodes(episodeState.searchTerm, episodeState.searchToken, { append: true });
      } else {
        await fetchGenstartEpisodes({ append: true });
      }
      if (!dialog.isConnected || state.podcastDetailView !== "episodes") return;
      const nextLoaded = getEpisodeWorkspaceEpisodes(podcast).length;
      episodeState.workspaceVisibleCount = Math.min(nextLoaded, visible + EPISODE_WORKSPACE_PAGE_SIZE);
      updatePodcastEpisodeOverview(dialog);
    });
  }

  const backButton = overview.querySelector("[data-podcast-episode-overview-back]");
  if (backButton?.dataset.episodeWorkspaceBound !== "true") {
    backButton.dataset.episodeWorkspaceBound = "true";
    backButton.addEventListener("click", () => {
      renderPodcastDetailSheetContent(dialog, podcast);
      dialog.classList.remove("is-episode-workspace");
      dialog.querySelector("[data-podcast-detail-content]")?.scrollTo?.({
        top: 0,
        left: 0,
        behavior: "auto"
      });
    });
  }

  overview.querySelectorAll("[data-episode-overview-rating-id]").forEach((button) => {
    if (button.dataset.episodeWorkspaceBound === "true") return;
    button.dataset.episodeWorkspaceBound = "true";
    button.addEventListener("click", () => {
      const episodeId = button.dataset.episodeOverviewRatingId;
      const target = normalizeText(episodeId);
      const episode =
        getGenstartEpisodeById(episodeId) ||
        getPodcastManualEpisodes(podcast).find((item) => getEpisodeKey(item) === target);

      if (episode) openEpisodeRatingDialog(episode);
    });
  });
}

function updatePodcastEpisodeOverview(dialog = document.getElementById("podcastDetailSheet")) {
  if (!dialog || dialog.classList.contains("is-hidden")) return;
  if (state.podcastDetailView !== "episodes") return;

  const podcast = state.podcastByKey[state.activePodcastDetailKey];
  const overview = dialog.querySelector("[data-podcast-episode-overview]");
  if (!podcast || !overview) return;

  const searchInput = overview.querySelector("[data-episode-workspace-search]");
  const searchWasFocused = document.activeElement === searchInput;
  const searchCursor = searchWasFocused ? searchInput.selectionStart : null;
  const tableScrollTop = overview.querySelector(".podcast-detail-sheet__episode-table-wrap")?.scrollTop || 0;
  overview.outerHTML = renderPodcastEpisodeOverview(podcast);
  bindPodcastEpisodeOverviewEvents(dialog, podcast);
  const nextOverview = dialog.querySelector("[data-podcast-episode-overview]");
  const nextTableWrap = nextOverview?.querySelector(".podcast-detail-sheet__episode-table-wrap");
  if (nextTableWrap) nextTableWrap.scrollTop = tableScrollTop;
  if (searchWasFocused) {
    const nextInput = nextOverview?.querySelector("[data-episode-workspace-search]");
    nextInput?.focus?.({ preventScroll: true });
    if (searchCursor !== null && nextInput?.setSelectionRange) {
      const nextCursor = Math.min(searchCursor, nextInput.value.length);
      nextInput.setSelectionRange(nextCursor, nextCursor);
    }
  }
}

function renderPodcastEpisodeOverviewContent(dialog, podcast) {
  renderPodcastDetailSheetContent(dialog, podcast, { skipEpisodeLoad: true });
  state.podcastDetailView = "episodes";
  dialog.querySelector("[data-podcast-detail-toolbar-actions]")?.replaceChildren();
  dialog.classList.add("is-episode-workspace");
  resetEpisodeWorkspaceSearch(podcast);

  const content = dialog.querySelector("[data-podcast-detail-content]");
  if (!content) return;

  content.innerHTML = renderPodcastEpisodeOverview(podcast);
  content.classList.add("podcast-detail-sheet__content--episode-overview");
  bindPodcastEpisodeOverviewEvents(dialog, podcast);

  if (!getEpisodePodcastConfig(podcast) && podcastHasManualEpisodeList(podcast)) {
    const manualEpisodes = ensureManualPodcastEpisodeState(podcast);
    if (manualEpisodes.length) {
      refreshManualEpisodeRatingData(getLocalEpisodePodcastKey(podcast), manualEpisodes)
        .then(() => {
          updatePodcastEpisodeOverview(dialog);
          updateOpenEpisodeDetailScores();
        })
        .catch(console.error);
    }
    return;
  }

  const episodeState = getPodcastEpisodeState(podcast);
  if ((!isGenstartEpisodeCacheFresh() || episodeState.items.length < MINIMUM_RATEABLE_EPISODE_COUNT) && !episodeState.loading) {
    fetchGenstartEpisodes().then(() => updatePodcastEpisodeOverview(dialog));
  } else {
    updatePodcastEpisodeOverview(dialog);
  }
}

function renderEpisodeDetailScoreMarkup(episode) {
  const episodeId = getEpisodeKey(episode);
  const stat = getEpisodeStat(episodeId);
  const userRating = getEpisodeUserRating(episodeId);
  const hasPublicRating = stat && Number(stat.ratingCount || 0) > 0 && stat.averageRating !== null;
  const hasUserRating = userRating !== null;

  return `
    <section class="podcast-detail-sheet__episode-ratings" data-episode-score-panel aria-label="Episodevurderinger">
      <div>
        <span>Brugernes vurdering</span>
        <strong>${hasPublicRating ? escapeHtml(formatCompactRating(stat.averageRating)) : "\u2014"}<small>/10</small></strong>
        <em>${hasPublicRating ? escapeHtml(formatEpisodeRatingCount(stat.ratingCount)) : "Ingen vurderinger endnu"}</em>
      </div>
      <div>
        <span>Din vurdering</span>
        <strong>${hasUserRating ? escapeHtml(formatCompactRating(userRating)) : "\u2014"}<small>/10</small></strong>
        <em>${hasUserRating ? "Gemt p\u00e5 episoden" : "Ikke vurderet endnu"}</em>
      </div>
    </section>
  `;
}

function bindGenstartEpisodeSectionEvents(dialog, podcast) {
  const section = dialog?.querySelector("[data-genstart-episodes-section]");
  if (!section) return;

  const input = section.querySelector("[data-genstart-episode-search]");
  input?.addEventListener("input", () => {
    scheduleGenstartEpisodeSearch(input.value);
  });

  const clearEpisodeSearch = () => {
    const currentInput = section.querySelector("[data-genstart-episode-search]");
    if (currentInput) {
      currentInput.value = "";
    }
    resetGenstartEpisodeSearch();
    updateGenstartEpisodeSection();
    const nextInput = dialog.querySelector("[data-genstart-episode-search]");
    if (nextInput) {
      nextInput.value = "";
      nextInput.focus?.({ preventScroll: true });
    }
  };

  section.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("[data-genstart-episode-search-clear]")) return;
    event.preventDefault();
    clearEpisodeSearch();
  });

  section.addEventListener("click", (event) => {
    if (!event.target.closest("[data-genstart-episode-search-clear]")) return;
    event.preventDefault();
    clearEpisodeSearch();
  });

  section.querySelector("[data-genstart-episodes-retry]")?.addEventListener("click", (event) => {
    event.preventDefault();
    fetchGenstartEpisodes().then(updateGenstartEpisodeSection);
  });

  section.querySelector("[data-genstart-episodes-more]")?.addEventListener("click", (event) => {
    event.preventDefault();
    fetchGenstartEpisodes({ append: true }).then(updateGenstartEpisodeSection);
  });

  section.querySelectorAll("[data-genstart-episode-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const episode = getGenstartEpisodeById(button.dataset.genstartEpisodeId);
      if (!episode) return;
      const content = dialog.querySelector("[data-podcast-detail-content]");
      state.podcastDetailEpisodeScrollTop = content?.scrollTop || 0;
      renderPodcastEpisodeDetailContent(dialog, podcast, episode);
      content?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    });
  });

  section.querySelectorAll("[data-genstart-episode-cover]").forEach((cover) => {
    const episode = getGenstartEpisodeById(cover.dataset.genstartEpisodeCover);
    if (!episode) return;
    setImageWithFallbackSource(cover, episode.image_url, getPodcastImageSources(podcast), episode.title || podcast.title);
  });
}

function updateGenstartEpisodeSection() {
  const dialog = document.getElementById("podcastDetailSheet");
  if (!dialog || dialog.classList.contains("is-hidden")) return;
  if (state.podcastDetailView === "episodes") {
    updatePodcastEpisodeOverview(dialog);
    return;
  }
  if (state.podcastDetailView !== "detail") return;

  const podcast = state.podcastByKey[state.activePodcastDetailKey];
  if (!podcast || !podcastSupportsEpisodes(podcast)) return;

  const currentInput = dialog.querySelector("[data-genstart-episode-search]");
  const hadFocus = currentInput && document.activeElement === currentInput;
  const cursor = hadFocus ? currentInput.selectionStart : null;
  const section = dialog.querySelector("[data-genstart-episodes-section]");
  if (!section) return;

  section.outerHTML = renderGenstartEpisodesSection(podcast);
  bindGenstartEpisodeSectionEvents(dialog, podcast);

  if (hadFocus) {
    const nextInput = dialog.querySelector("[data-genstart-episode-search]");
    nextInput?.focus?.({ preventScroll: true });
    if (cursor !== null && nextInput?.setSelectionRange) {
      const nextCursor = Math.min(cursor, nextInput.value.length);
      nextInput.setSelectionRange(nextCursor, nextCursor);
    }
  }
}

function updateOpenEpisodeDetailScores() {
  const dialog = document.getElementById("podcastDetailSheet");
  if (!dialog || dialog.classList.contains("is-hidden")) return;
  if (state.podcastDetailView !== "episode" || !state.podcastDetailEpisodeId) return;

  const episode = getGenstartEpisodeById(state.podcastDetailEpisodeId);
  if (!episode) return;

  const panel = dialog.querySelector("[data-episode-score-panel]");
  if (panel) {
    panel.outerHTML = renderEpisodeDetailScoreMarkup(episode);
  }

  const button = dialog.querySelector("[data-episode-rating]");
  if (button) {
    button.textContent =
      getEpisodeUserRating(state.podcastDetailEpisodeId) !== null
        ? "Rediger din vurdering"
        : "Vurder episoden";
  }
}

function renderPodcastEpisodeDetailContent(dialog, podcast, episode, { backLabel = "Tilbage til episoder" } = {}) {
  const content = dialog.querySelector("[data-podcast-detail-content]");
  if (!content) return;

  dialog.querySelector("[data-podcast-detail-toolbar-actions]")?.replaceChildren();

  state.podcastDetailView = "episode";
  state.podcastDetailEpisodeId = getEpisodeKey(episode);

  const date = formatEpisodeDate(episode.published_at);
  const duration = formatEpisodeDuration(episode.duration_seconds);
  const description = getEpisodeDescription(episode);
  const link = getEpisodeLink(episode);
  const displayName = getEpisodePodcastDisplayName(podcast);
  const parentPodcastKey = normalizeText(episode?.podcast_key);
  const parentPodcast = parentPodcastKey ? state.podcastByKey[parentPodcastKey] : null;
  const parentPodcastTitle = normalizeText(parentPodcast?.title);
  const canOpenParentPodcast =
    backLabel === "Tilbage til Profil" && !isMobileViewport() && Boolean(parentPodcast && parentPodcastTitle);

  content.innerHTML = `
    <div class="podcast-detail-sheet__review-nav">
      <button
        class="podcast-detail-sheet__back"
        type="button"
        data-podcast-episode-back
        aria-label="${escapeHtml(backLabel)}"
      >
        <span aria-hidden="true">&larr;</span>
        <span>${escapeHtml(backLabel)}</span>
      </button>
      ${canOpenParentPodcast ? `
        <button
          class="podcast-detail-sheet__back podcast-detail-sheet__episode-series-link"
          type="button"
          data-podcast-episode-series
          aria-label="Se hovedserien ${escapeHtml(parentPodcastTitle)}"
        >
          <span>Se ${escapeHtml(parentPodcastTitle)}</span><span aria-hidden="true">&rarr;</span>
        </button>` : ""}
      <span class="podcast-detail-sheet__review-nav-title">Episode</span>
    </div>
    <article class="podcast-detail-sheet__episode-detail">
      <header class="podcast-detail-sheet__episode-detail-header">
        <div class="podcast-detail-sheet__episode-detail-cover" aria-hidden="true">
          <img alt="" loading="eager" decoding="async" />
        </div>
        <div class="podcast-detail-sheet__episode-detail-copy">
          <span>${escapeHtml(displayName)}</span>
          <h2 id="podcastDetailTitle">${escapeHtml(episode.title || `${displayName}-episode`)}</h2>
          <p>
            ${date ? `<span>${escapeHtml(date)}</span>` : ""}
            ${duration ? `<span>${escapeHtml(duration)}</span>` : ""}
          </p>
        </div>
      </header>
      <section class="podcast-detail-sheet__episode-detail-body">
        <h3>Beskrivelse</h3>
        <p>${escapeHtml(description || "Der er endnu ingen beskrivelse til episoden.")}</p>
      </section>
      ${renderEpisodeDetailScoreMarkup(episode)}
      <button class="podcast-detail-sheet__button podcast-detail-sheet__button--secondary" type="button" data-episode-rating>
        ${getEpisodeUserRating(getEpisodeKey(episode)) !== null ? "Rediger din vurdering" : "Vurder episoden"}
      </button>
      ${
        link
          ? `<a class="podcast-detail-sheet__button podcast-detail-sheet__button--primary podcast-detail-sheet__episode-link" href="${escapeHtml(
              link
            )}" target="_blank" rel="noopener noreferrer">H\u00f8r episoden</a>`
          : ""
      }
    </article>
  `;

  const cover = content.querySelector(".podcast-detail-sheet__episode-detail-cover");
  setImageWithFallbackSource(cover, episode.image_url, getPodcastImageSources(podcast), episode.title || podcast.title);

  content.querySelector("[data-podcast-episode-back]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (backLabel === "Tilbage til Profil") {
      closePodcastDetailSheet();
      return;
    }
    renderPodcastDetailSheetContent(dialog, podcast);
    content.scrollTo?.({
      top: state.podcastDetailEpisodeScrollTop || 0,
      left: 0,
      behavior: "auto"
    });
  });
  content.querySelector("[data-podcast-episode-series]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!parentPodcast) return;
    closePodcastDetailSheet({ returnFocus: false });
    openPodcastDetailSheet(parentPodcast, null, { allowDesktop: true });
  });

  content.querySelector("[data-episode-rating]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openEpisodeRatingDialog(episode);
  });
}

function renderPodcastDetailReviewContent(dialog, podcast, review) {
  const content = dialog.querySelector("[data-podcast-detail-content]");
  if (!content) return;

  dialog.querySelector("[data-podcast-detail-toolbar-actions]")?.replaceChildren();

  state.podcastDetailView = "review";

  const paramsMarkup = (review.params || [])
    .map((param) => {
      const rawValue = normalizeText(param.value);
      if (!rawValue) return "";

      const number = parseNumber(rawValue);
      const valueText = number === null ? rawValue : formatRating(rawValue);
      const percentage = number === null ? null : Math.max(0, Math.min(100, number * 10));

      return `
        <div class="podcast-detail-sheet__review-param">
          <div class="podcast-detail-sheet__review-param-head">
            <span>${escapeHtml(param.label)}</span>
            <strong>${escapeHtml(valueText)}</strong>
          </div>
          ${percentage !== null ? `
            <div class="podcast-detail-sheet__review-bar" aria-hidden="true">
              <span class="podcast-detail-sheet__review-bar-fill" style="width: ${percentage}%"></span>
            </div>
          ` : ""}
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  content.innerHTML = `
    <div class="podcast-detail-sheet__review-nav">
      <button
        class="podcast-detail-sheet__back"
        type="button"
        data-podcast-detail-back
        aria-label="Tilbage til podcasten"
      >
        <span aria-hidden="true">&larr;</span>
        <span>Tilbage</span>
      </button>
      <span class="podcast-detail-sheet__review-nav-title">Anmeldelse</span>
    </div>
    <header class="podcast-detail-sheet__review-header">
      <p class="podcast-detail-sheet__eyebrow">Podcastlisten anmelder</p>
      <h2 id="podcastDetailTitle">${escapeHtml(review.title || podcast.title || "Podcast")}</h2>
      <div class="podcast-detail-sheet__review-meta">
        <span>${escapeHtml(review.scoreLabel || "Ikke vurderet")}</span>
        ${review.reviewDateLabel ? `<span>${escapeHtml(review.reviewDateLabel)}</span>` : ""}
      </div>
    </header>
    <section class="podcast-detail-sheet__review-body">
      <h3>Hele anmeldelsen</h3>
      <p>${escapeHtml(review.review || "")}</p>
    </section>
    ${
      paramsMarkup
        ? `<section class="podcast-detail-sheet__review-params" aria-label="Anmeldelsesparametre">${paramsMarkup}</section>`
        : ""
    }
  `;

  content.querySelector("[data-podcast-detail-back]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    renderPodcastDetailSheetContent(dialog, podcast);
    content.scrollTo?.({
      top: state.podcastDetailDetailScrollTop || 0,
      left: 0,
      behavior: "auto"
    });
  });
}

function setPodcastDetailPlacementControl(dialog, placementText = "") {
  const placementControl = dialog?.querySelector("[data-podcast-detail-placement]");
  if (!placementControl) return;

  placementControl.innerHTML = placementText
    ? `<span class="podcast-detail-sheet__placement" aria-label="Placering ${escapeHtml(
        placementText.replace(/^#/, "")
      )}">${escapeHtml(placementText)}</span>`
    : "";
}

function renderPodcastDetailMainSeriesContent(dialog, sourcePodcast, mainSeries) {
  const content = dialog.querySelector("[data-podcast-detail-content]");
  if (!content) return;

  dialog.querySelector("[data-podcast-detail-toolbar-actions]")?.replaceChildren();

  setPodcastDetailPlacementControl(dialog);

  state.podcastDetailView = "mainSeries";
  state.podcastDetailMainSeriesValue = mainSeries || "";
  state.podcastDetailMainSeriesSourceKey = getPodcastKey(sourcePodcast);
  state.activePodcastDetailKey = state.podcastDetailMainSeriesSourceKey;

  const summary = getMainSeriesSummary(mainSeries);
  const representative = summary.podcasts.find((podcast) => podcast.image) || sourcePodcast;
  const madsScore = summary.madsAverage === null ? "\u2014" : formatCompactRating(summary.madsAverage);
  const usersScore = summary.userAverage === null ? "\u2014" : formatCompactRating(summary.userAverage);
  const userRatingTotal = summary.userRatingTotal;
  const rowsMarkup = summary.podcasts
    .map((podcast) => {
      const key = getPodcastKey(podcast);
      const stat = getCommunityStat(getPodcastKey(podcast));
      const hasMads = podcast.ratingValue !== null && podcast.ratingValue !== undefined;
      const hasUsers = hasCommunityRating(stat);
      const userCount = Number(stat?.ratingCount || 0);
      return `
        <button
          class="podcast-detail-sheet__series-row"
          type="button"
          data-main-series-podcast-key="${escapeHtml(getPodcastKey(podcast))}"
          aria-label="Vis ${escapeHtml(podcast.title || "underserie")}"
        >
          <span
            class="podcast-detail-sheet__series-cover"
            data-main-series-cover="${escapeHtml(key)}"
            aria-hidden="true"
          >
            <img alt="" loading="lazy" />
          </span>
          <span class="podcast-detail-sheet__series-copy">
            <strong>${escapeHtml(podcast.title || "Podcast")}</strong>
            ${podcast.host ? `<span>${escapeHtml(podcast.host)}</span>` : ""}
            <span class="podcast-detail-sheet__series-scores">
              <em>Podcastlisten ${hasMads ? escapeHtml(formatCompactRating(podcast.ratingValue)) : "\u2014"}</em>
              <em>Brugere ${hasUsers ? escapeHtml(formatCompactRating(stat.averageRating)) : "\u2014"}</em>
            </span>
            ${
              hasUsers
                ? `<small>${escapeHtml(formatUserRatingCount(userCount))}</small>`
                : `<small>Ingen brugervurderinger endnu</small>`
            }
          </span>
        </button>
      `;
    })
    .join("");

  content.innerHTML = `
    <div class="podcast-detail-sheet__review-nav">
      <button
        class="podcast-detail-sheet__back"
        type="button"
        data-podcast-detail-back
        aria-label="Tilbage til podcasten"
      >
        <span aria-hidden="true">&larr;</span>
        <span>Tilbage</span>
      </button>
      <span class="podcast-detail-sheet__review-nav-title">Hovedserie</span>
    </div>
    <header class="podcast-detail-sheet__series-header">
      <div class="podcast-detail-sheet__series-hero-cover" aria-hidden="true"></div>
      <div class="podcast-detail-sheet__series-heading">
        <span>Hovedserie</span>
        <h2 id="podcastDetailTitle">${escapeHtml(mainSeries || "Hovedserie")}</h2>
        <p>Samlet overblik over underserier</p>
      </div>
    </header>
    <section class="podcast-detail-sheet__ratings podcast-detail-sheet__series-ratings" aria-label="Hovedseriens vurderinger">
      <div>
        <span>Podcastlistens vurdering</span>
        <strong>${escapeHtml(madsScore)}<small>/10</small></strong>
        <em>${summary.madsRatedCount ? `${summary.madsRatedCount} underserier med score` : "Ingen Podcastlisten-score endnu"}</em>
      </div>
      <div>
        <span>Brugernes vurdering</span>
        <strong>${escapeHtml(usersScore)}<small>/10</small></strong>
        <em>${userRatingTotal ? formatUserRatingCount(userRatingTotal) : "Ingen brugervurderinger endnu"}</em>
      </div>
    </section>
    <section class="podcast-detail-sheet__series-meta" aria-label="Hovedserie metadata">
      <span>${summary.podcasts.length} ${summary.podcasts.length === 1 ? "underserie" : "underserier"}</span>
      <span>${userRatingTotal ? formatUserRatingCount(userRatingTotal) : "Ingen brugervurderinger endnu"}</span>
    </section>
    <section class="podcast-detail-sheet__series-list" aria-label="Underserier">
      <h3>Underserier</h3>
      ${rowsMarkup || `<p class="podcast-detail-sheet__series-empty">Der er ikke fundet underserier endnu.</p>`}
    </section>
  `;

  const heroCover = content.querySelector(".podcast-detail-sheet__series-hero-cover");
  if (representative?.image) {
    heroCover.innerHTML = `<img alt="" loading="lazy" />`;
    setImage(heroCover, representative.image, mainSeries || "Hovedserie");
  }

  content.querySelectorAll("[data-main-series-cover]").forEach((cover) => {
    const podcast = state.podcastByKey[cover.dataset.mainSeriesCover];
    if (!podcast) return;
    setImageWithFallbackSource(cover, getPodcastImageSources(podcast), getPodcastImageSources(representative), podcast.title);
  });

  content.querySelector("[data-podcast-detail-back]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.podcastDetailBackToMainSeries = false;
    renderPodcastDetailSheetContent(dialog, sourcePodcast);
    content.scrollTo?.({
      top: state.podcastDetailDetailScrollTop || 0,
      left: 0,
      behavior: "auto"
    });
  });

  content.querySelectorAll("[data-main-series-podcast-key]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const podcast = state.podcastByKey[button.dataset.mainSeriesPodcastKey];
      if (!podcast) return;
      state.activePodcastDetailKey = getPodcastKey(podcast);
      state.podcastDetailBackToMainSeries = true;
      renderPodcastDetailSheetContent(dialog, podcast, { showMainSeriesBack: true });
      content.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    });
  });
}

async function savePodcastDetailInlineRating(dialog, podcast, input, message) {
  if (getPodcastEpisodeUserRatingSummary(podcast).count > 0) {
    return;
  }

  if (!isLoggedIn()) {
    state.pendingAuthAction = { type: "rating", podcastKey: getPodcastKey(podcast) };
    showAuthPrompt("login");
    setAuthMessage("Log ind for at gemme din egen vurdering.", "warning", "dialog");
    return;
  }

  const numericValue = parseRatingInputValue(input?.value);
  if (numericValue === null || numericValue < 0 || numericValue > 10) {
    if (message) {
      message.textContent = "Indtast en score mellem 0 og 10.";
      message.dataset.tone = "warning";
    }
    return;
  }

  const podcastKey = getPodcastKey(podcast);
  if (!state.supabase || !state.authUser || !podcastKey) return;

  if (message) {
    message.textContent = "Gemmer…";
    message.dataset.tone = "neutral";
  }

  try {
    const { error } = await state.supabase.from("user_ratings").upsert(
      { user_id: state.authUser.id, podcast_key: podcastKey, rating: numericValue },
      { onConflict: "user_id,podcast_key" }
    );
    if (error) throw error;

    const previousRating = state.userRatingsByKey[podcastKey] ?? null;
    state.userRatingsByKey[podcastKey] = numericValue;
    updateLocalCommunityStatForRating(podcastKey, numericValue, previousRating);
    invalidateExplorePersonalSnapshot();
    rebuildUserRanks();
    render();
    refreshOpenPodcastDetailSheet();
    setAuthMessage("Din vurdering er gemt.", "success");
    refreshSupabaseState().catch((refreshError) => console.error(refreshError));
  } catch (error) {
    console.error(error);
    if (message) {
      message.textContent = error.message || "Kunne ikke gemme vurderingen.";
      message.dataset.tone = "error";
    }
  }
}

function renderPodcastDetailSheetContent(
  dialog,
  podcast,
  { showMainSeriesBack = false, skipEpisodeLoad = false } = {}
) {
  const content = dialog.querySelector("[data-podcast-detail-content]");
  if (!content) return;

  dialog.classList.remove("is-episode-workspace");
  state.podcastDetailView = "detail";
  state.activePodcastDetailKey = getPodcastKey(podcast);
  const supportsEpisodes = podcastSupportsEpisodes(podcast);
  content.classList.toggle("podcast-detail-sheet__content--episodes", supportsEpisodes);
  content.classList.remove("podcast-detail-sheet__content--episode-overview");

  const key = getPodcastKey(podcast);
  const rating = getPodcastDetailRatingData(podcast);
  const meta = getPodcastDetailMeta(podcast);
  const publisherLabel = getPodcastDetailPublisherLabel(podcast);
  const linkLabel = getPodcastLinkLabel(podcast.link);
  const linkSubtitle = getPodcastLinkSubtitle(podcast.link);
  const hasLink = Boolean(linkLabel);
  const review = getReviewForPodcast(podcast);
  const hasPodcastlistenReview = Boolean(review?.review);
  const placementText = getPodcastDetailPlacementText(podcast);
  const detailChipValues = new Set();
  const shouldShowDetailChip = (value) => {
    const key = normalizeComparable(value);
    if (!key || detailChipValues.has(key)) return false;
    detailChipValues.add(key);
    return true;
  };
  const genreMarkup =
    podcast.genre && shouldShowDetailChip(podcast.genre)
      ? `<button class="podcast-detail-sheet__genre" type="button" data-podcast-detail-filter="genre" data-genre="${escapeHtml(
          podcast.genre
        )}" data-value="${escapeHtml(podcast.genre)}">${escapeHtml(podcast.genre)}</button>`
      : "";
  const mainSeriesMarkup =
    podcast.mainSeries && shouldShowDetailChip(podcast.mainSeries)
      ? `<button class="podcast-detail-sheet__chip" type="button" data-podcast-detail-filter="mainSeries" data-value="${escapeHtml(
          podcast.mainSeries
        )}" aria-label="Filtrér Ranglister efter hovedserien ${escapeHtml(podcast.mainSeries)}">${escapeHtml(podcast.mainSeries)}</button>`
      : "";
  const publisherMarkup =
    publisherLabel && shouldShowDetailChip(publisherLabel)
      ? `<button class="podcast-detail-sheet__chip podcast-detail-sheet__publisher" type="button" data-podcast-detail-filter="publisher" data-value="${escapeHtml(
          publisherLabel
        )}" aria-label="Vis podcasts fra ${escapeHtml(publisherLabel)}">${escapeHtml(
          publisherLabel
        )}</button>`
      : "";
  const userCountText = rating.userCount
    ? formatUserRatingCount(rating.userCount)
    : "Ingen vurderinger endnu";
  const episodeConfig = getEpisodePodcastConfig(podcast);
  if (episodeConfig?.persistence === "local") {
    const localEpisodeState = getPodcastEpisodeState(podcast);
    if (localEpisodeState.items.length) {
      hydrateLocalEpisodeRatingState(key, localEpisodeState.items);
    }
  }
  const episodeRatingSummary = supportsEpisodes
    ? getPodcastEpisodeUserRatingSummary(podcast)
    : { count: 0, average: null };
  if (supportsEpisodes && episodeRatingSummary.count > 0 && state.authUser) {
    window.queueMicrotask(() => {
      reconcileExistingEpisodeDerivedParentRating(key);
    });
  }
  const isOwnRatingLocked = episodeRatingSummary.count > 0;
  const manualOwnRating = getUserRating(key);
  const ownRatingValue = isOwnRatingLocked
    ? formatCompactRating(episodeRatingSummary.average)
    : manualOwnRating === null || manualOwnRating === undefined
      ? ""
      : String(manualOwnRating);
  const hasManualOwnRating = !isOwnRatingLocked && ownRatingValue !== "";
  const ownRatingDisplayValue = isOwnRatingLocked
    ? ownRatingValue
    : hasManualOwnRating
      ? formatCompactRating(manualOwnRating)
      : "";
  const ownRatingSummaryMarkup = isOwnRatingLocked
    ? `<span class="podcast-detail-sheet__own-rating-display">
        <strong>${escapeHtml(ownRatingDisplayValue)}<small>/10</small></strong>
        <small>Beregnet fra episoder</small>
      </span>`
    : `<button class="podcast-detail-sheet__own-rating-reveal podcast-detail-sheet__own-rating-mobile-summary${
        hasManualOwnRating ? " is-saved-rating" : ""
      }" type="button" data-podcast-detail-inline-rating-reveal aria-expanded="false">
        ${
          hasManualOwnRating
            ? `<strong>${escapeHtml(ownRatingDisplayValue)}<small>/10</small></strong><small>Rediger</small>`
            : '<span aria-hidden="true">0–10</span><small>Vælg 0–10</small>'
        }
      </button>`;
  const episodeRatingCountText = `${episodeRatingSummary.count} ${
    episodeRatingSummary.count === 1 ? "episodevurdering" : "episodevurderinger"
  }`;
  const episodesMarkup = "";
  const podcastSimilarityMarkup = getPodcastSimilarityProductMarkup(podcast);
  const hasMainSeriesReturnContext =
    showMainSeriesBack ||
    state.podcastDetailMainSeriesValue &&
    state.podcastDetailMainSeriesSourceKey &&
    key !== state.podcastDetailMainSeriesSourceKey;
  const mainSeriesBackMarkup =
    hasMainSeriesReturnContext
      ? `
        <div class="podcast-detail-sheet__review-nav">
          <button
            class="podcast-detail-sheet__back"
            type="button"
            data-podcast-detail-main-series-back
            aria-label="Tilbage til hovedserien"
          >
            <span aria-hidden="true">&larr;</span>
            <span>Tilbage</span>
          </button>
          <span class="podcast-detail-sheet__review-nav-title">Hovedserie</span>
        </div>
      `
      : "";
  setPodcastDetailPlacementControl(dialog, placementText);
  const episodeEntryMarkup = supportsEpisodes
    ? `<span class="podcast-detail-sheet__episode-entry">
        <button class="podcast-detail-sheet__episode-entry-button" type="button" data-podcast-episodes-open aria-describedby="podcastEpisodeEntryTooltip">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M9 8h6M9 12h6M9 16h4"></path></svg>
          <span>Vurder episoder</span>
        </button>
        <span class="podcast-detail-sheet__episode-entry-tooltip" id="podcastEpisodeEntryTooltip" role="tooltip">
          Se alle episoder og bed&oslash;m dem &eacute;n for &eacute;n.
        </span>
      </span>`
    : "";
  const externalLinkMarkup = hasLink
    ? `<a class="podcast-detail-sheet__header-link" href="${escapeHtml(podcast.link)}" target="_blank" rel="noopener noreferrer" aria-label="Link til podcasten" title="Link til podcasten" data-tooltip="Link til podcasten"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 5h5v5M19 5l-9 9"></path><path d="M19 14v4a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4"></path></svg></a>`
    : "";
  const headerActionMarkup = `<span class="podcast-detail-sheet__header-action-icons"><button class="favorite-button podcast-detail-sheet__header-favorite" type="button" data-podcast-detail-favorite aria-label="Gem podcast"><span aria-hidden="true"></span></button>${externalLinkMarkup}</span>`;
  const reviewStatusMarkup = hasPodcastlistenReview
    ? `<button class="podcast-detail-sheet__review-status" type="button" data-podcast-detail-review><span class="podcast-detail-sheet__review-status-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path></svg></span><span><strong>Podcastlisten har anmeldt</strong><small>Læs den redaktionelle anmeldelse</small></span></button>`
    : `<div class="podcast-detail-sheet__review-status" aria-label="Ingen anmeldelse endnu"><span class="podcast-detail-sheet__review-status-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path></svg></span><span><strong>Ingen anmeldelse endnu</strong><small>Podcastlisten har ikke anmeldt podcasten</small></span></div>`;

  content.innerHTML = `
    ${mainSeriesBackMarkup}
    <header class="podcast-detail-sheet__header">
      <div class="podcast-detail-sheet__cover">
        <img class="podcast-detail-sheet__image" alt="" loading="lazy" />
      </div>
      <div class="podcast-detail-sheet__intro">
        <div class="podcast-detail-sheet__intro-actions">${headerActionMarkup}</div>
        <h2 id="podcastDetailTitle">${escapeHtml(podcast.title || "Podcast")}</h2>
        ${getPodcastAccessIndicatorMarkup(podcast, { detail: true })}
        ${meta ? `<p class="podcast-detail-sheet__meta">${escapeHtml(meta)}</p>` : ""}
        <div class="podcast-detail-sheet__chips">
          ${episodeEntryMarkup}
          ${genreMarkup}
          ${publisherMarkup}
          ${mainSeriesMarkup}
        </div>
        <section class="podcast-detail-sheet__description podcast-detail-sheet__description--desktop">
          <h3>Om podcasten</h3>
          <p>${escapeHtml(getPodcastDetailDescription(podcast))}</p>
        </section>
      </div>
      <section class="podcast-detail-sheet__description podcast-detail-sheet__description--mobile">
        <h3>Om podcasten</h3>
        <p data-podcast-detail-description>${escapeHtml(getPodcastDetailDescription(podcast))}</p>
        <button
          class="podcast-detail-sheet__description-toggle"
          type="button"
          data-podcast-detail-description-toggle
          aria-expanded="false"
        >Læs mere</button>
      </section>
    </header>
    <section class="podcast-detail-sheet__ratings" aria-label="Vurderinger">
      <div class="podcast-detail-sheet__rating-cell podcast-detail-sheet__rating-cell--mads">
        <span class="podcast-detail-sheet__rating-icon" aria-hidden="true">★</span>
        <span class="podcast-detail-sheet__rating-label">Podcastlistens vurdering</span>
        <strong>${escapeHtml(rating.mads)}<small>/10</small></strong>
      </div>
      <div class="podcast-detail-sheet__rating-cell podcast-detail-sheet__rating-cell--users">
        <span class="podcast-detail-sheet__rating-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"></circle><circle cx="17" cy="9" r="2.4"></circle><path d="M3.5 19c.35-3.2 2.3-5 5.5-5s5.15 1.8 5.5 5M14 15c2.5.2 4 1.55 4.35 4"></path></svg>
        </span>
        <span class="podcast-detail-sheet__rating-label">Brugernes vurdering</span>
        <strong>${escapeHtml(rating.users)}<small>/10</small></strong>
        <em>${escapeHtml(userCountText)}</em>
      </div>
      <div class="podcast-detail-sheet__rating-cell podcast-detail-sheet__rating-cell--own" aria-label="Din vurdering">
        <span class="podcast-detail-sheet__rating-label">Din vurdering</span>
        ${ownRatingSummaryMarkup}
        ${
          isOwnRatingLocked
            ? ""
            : `<div class="podcast-detail-sheet__own-rating-editor">
          <label class="podcast-detail-sheet__own-rating-control podcast-detail-sheet__own-rating-picker">
          <span class="podcast-detail-sheet__rating-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="3"></rect><path d="M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"></path></svg>
          </span>
          <span class="podcast-detail-sheet__own-rating-copy">
          <input
            class="podcast-detail-sheet__own-rating-input${isOwnRatingLocked ? " is-episode-calculated" : ""}"
            type="text"
            min="0"
            max="10"
            step="0.1"
            inputmode="decimal"
            pattern="[0-9]*[.,]?[0-9]*"
            autocomplete="off"
            enterkeyhint="done"
            placeholder="Vælg din score"
            value="${escapeHtml(ownRatingValue)}"
            data-podcast-detail-inline-rating-input
            aria-label="Din vurdering fra 0 til 10"
            ${isOwnRatingLocked ? 'disabled aria-describedby="podcastDetailEpisodeRatingLockHelp"' : ""}
          />
          <small>${isOwnRatingLocked ? "Beregnet fra episoder" : "Tryk for at vælge 0–10"}</small>
          </span>
          <span class="podcast-detail-sheet__own-rating-suffix">/10</span>
          </label>
        ${
          isOwnRatingLocked
            ? ""
            : '<button class="podcast-detail-sheet__own-rating-save" type="button" data-podcast-detail-inline-rating-save>Gem din vurdering</button>'
        }
        </div>`
        }
        <em data-podcast-detail-inline-rating-message>${
          isOwnRatingLocked
            ? `Beregnes automatisk fra ${escapeHtml(episodeRatingCountText)}`
            : ""
        }</em>
        ${
          isOwnRatingLocked
            ? `<button class="podcast-detail-sheet__episode-rating-lock-trigger" type="button" aria-label="Hvorfor er din vurdering låst?" aria-describedby="podcastDetailEpisodeRatingLockHelp">i</button>
              <div class="podcast-detail-sheet__episode-rating-lock-help" id="podcastDetailEpisodeRatingLockHelp" role="tooltip">
                Din vurdering er l&aring;st, fordi du har bed&oslash;mt episoder. Den beregnes automatisk som gennemsnittet. Fjerner du alle episodevurderinger, l&aring;ses den op igen.
              </div>`
            : ""
        }
      </div>
    </section>
    ${episodesMarkup}
    <div class="podcast-detail-sheet__recommendation-row">
    ${podcastSimilarityMarkup}
    ${reviewStatusMarkup}
    </div>
    <template class="podcast-detail-sheet__actions" aria-hidden="true">
      ${
        hasLink
          ? `<a class="podcast-detail-sheet__button podcast-detail-sheet__button--primary" href="${escapeHtml(
              podcast.link
            )}" target="_blank" rel="noopener noreferrer">
              <span class="podcast-detail-sheet__action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 14v-2a8 8 0 0 1 16 0v2"></path><path d="M4 14h3v6H5a2 2 0 0 1-2-2v-2a2 2 0 0 1 1-2Z"></path><path d="M20 14h-3v6h2a2 2 0 0 0 2-2v-2a2 2 0 0 0-1-2Z"></path></svg>
              </span>
              <span class="podcast-detail-sheet__action-copy"><strong>${escapeHtml(linkLabel)}</strong><small>${escapeHtml(linkSubtitle)}</small></span>
            </a>`
          : `<div class="podcast-detail-sheet__button podcast-detail-sheet__button--unavailable podcast-detail-sheet__button--link-unavailable" aria-disabled="true">
              <span class="podcast-detail-sheet__action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M10.5 13.5a4 4 0 0 0 5.7.1l2.4-2.4a4 4 0 0 0-5.7-5.7l-1.4 1.4"></path><path d="M13.5 10.5a4 4 0 0 0-5.7-.1l-2.4 2.4a4 4 0 0 0 5.7 5.7l1.4-1.4"></path></svg>
              </span>
              <span class="podcast-detail-sheet__action-copy"><strong>Mangler link</strong><small>Link ikke tilg\u00e6ngeligt</small></span>
            </div>`
      }
      <button class="podcast-detail-sheet__button podcast-detail-sheet__button--favorite" type="button" data-podcast-detail-favorite>
        <span class="podcast-detail-sheet__action-icon" aria-hidden="true"></span>
        <span class="podcast-detail-sheet__action-copy"><strong data-favorite-label>${isPodcastSaved(key) ? "Podcast gemt" : "Gem podcast"}</strong><small data-favorite-subtitle>${isPodcastSaved(key) ? "Fjern fra gemte" : "F\u00f8j til dine gemte"}</small></span>
      </button>
      ${
        hasPodcastlistenReview
          ? `<button class="podcast-detail-sheet__button podcast-detail-sheet__button--review" type="button" data-podcast-detail-review>
              <span class="podcast-detail-sheet__action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5Z"></path><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5Z"></path></svg>
              </span>
              <span class="podcast-detail-sheet__action-copy"><strong>L\u00e6s Podcastlistens anmeldelse</strong><small>Se den redaktionelle anmeldelse</small></span>
            </button>`
          : `<div class="podcast-detail-sheet__button podcast-detail-sheet__button--unavailable" aria-disabled="true">
              <span class="podcast-detail-sheet__action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"></rect><path d="M8 8h8M8 12h8M8 16h5"></path></svg>
              </span>
              <span class="podcast-detail-sheet__action-copy"><strong>Ingen anmeldelse endnu</strong><small>Podcastlisten har ikke anmeldt podcasten</small></span>
            </div>`
      }
    </template>
  `;

  const toolbarActions = dialog.querySelector("[data-podcast-detail-toolbar-actions]");
  const headerActions = content.querySelector(".podcast-detail-sheet__header-action-icons");
  renderFavoriteButton(headerActions?.querySelector("[data-podcast-detail-favorite]"), key);
  if (isMobileViewport() && toolbarActions && headerActions) toolbarActions.replaceChildren(headerActions);
  else toolbarActions?.replaceChildren();

  if (isMobileViewport()) {
    const header = content.querySelector(".podcast-detail-sheet__header");
    const intro = content.querySelector(".podcast-detail-sheet__intro");
    const meta = intro?.querySelector(".podcast-detail-sheet__meta");
    const episodeEntry = intro?.querySelector(".podcast-detail-sheet__episode-entry");
    const chips = intro?.querySelector(".podcast-detail-sheet__chips");
    const access = intro?.querySelector(".podcast-access-detail");
    const mobileDescription = header?.querySelector(".podcast-detail-sheet__description--mobile");
    if (episodeEntry && meta) meta.after(episodeEntry);
    if (header && chips && mobileDescription) header.insertBefore(chips, mobileDescription);
    if (header && access && mobileDescription) header.insertBefore(access, mobileDescription);
  }

  const cover = content.querySelector(".podcast-detail-sheet__cover");
  const image = content.querySelector(".podcast-detail-sheet__image");
  setImage(cover, getPodcastImageSources(podcast), podcast.title);
  hydratePodcastSimilarityProduct(dialog, podcast);

  content.querySelector("[data-podcast-detail-main-series-back]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const sourcePodcast =
      state.podcastByKey[state.podcastDetailMainSeriesSourceKey] || podcast;
    state.podcastDetailBackToMainSeries = false;
    renderPodcastDetailMainSeriesContent(
      dialog,
      sourcePodcast,
      state.podcastDetailMainSeriesValue || sourcePodcast.mainSeries
    );
    content.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  });

  content.querySelectorAll("[data-podcast-episodes-open]").forEach((episodeOpenButton) => {
    episodeOpenButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      renderPodcastEpisodeOverviewContent(dialog, podcast);
      content.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
    });
  });

  const inlineRatingInput = content.querySelector("[data-podcast-detail-inline-rating-input]");
  const inlineRatingRevealButton = content.querySelector(
    "[data-podcast-detail-inline-rating-reveal]"
  );
  const inlineRatingMessage = content.querySelector("[data-podcast-detail-inline-rating-message]");
  const inlineRatingSaveButton = content.querySelector(
    "[data-podcast-detail-inline-rating-save]"
  );
  let inlineRatingSavePending = false;

  inlineRatingRevealButton?.addEventListener("click", () => {
    const ratingCell = inlineRatingRevealButton.closest(
      ".podcast-detail-sheet__rating-cell--own"
    );
    ratingCell?.classList.add("is-rating-entry-open");
    inlineRatingRevealButton.hidden = true;
    inlineRatingRevealButton.setAttribute("aria-expanded", "true");
    inlineRatingInput?.focus({ preventScroll: true });
  });

  inlineRatingInput?.addEventListener("input", () => {
    if (inlineRatingMessage) inlineRatingMessage.textContent = "";
  });

  const submitInlineRating = async (event) => {
    event?.preventDefault();
    event?.stopPropagation();

    if (inlineRatingSavePending || getPodcastEpisodeUserRatingSummary(podcast).count > 0) return;

    inlineRatingSavePending = true;
    if (inlineRatingSaveButton) inlineRatingSaveButton.disabled = true;

    try {
      await savePodcastDetailInlineRating(
        dialog,
        podcast,
        inlineRatingInput,
        inlineRatingMessage
      );
    } finally {
      inlineRatingSavePending = false;
      if (inlineRatingSaveButton?.isConnected) {
        inlineRatingSaveButton.disabled = false;
      }
    }
  };

  inlineRatingSaveButton?.addEventListener("click", submitInlineRating);

  inlineRatingInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || event.isComposing || event.repeat) return;
    submitInlineRating(event);
  });

  content.querySelectorAll("[data-podcast-detail-filter]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const value = button.dataset.value || "";
      const filterType = button.dataset.podcastDetailFilter;

      if (filterType === "mainSeries") {
        navigatePodcastDetailToMainSeriesRanking(podcast, value);
        return;
      }

      closePodcastDetailSheet({ returnFocus: false });

      if (filterType === "publisher") {
        resetRankingFiltersForPodcastDetailNavigation("publisher", value);
        if (window.location.hash.slice(1).toLowerCase() !== "ranglister") {
          window.location.hash = "#ranglister";
        } else {
          render();
          scrollToRankingStart();
        }
        return;
      }

      setActiveFilter("genre", value);
      if (window.location.hash.slice(1).toLowerCase() !== "ranglister") {
        window.location.hash = "#ranglister";
      } else {
        scrollToRankingStart();
      }
    });
  });

  content.querySelector("[data-podcast-detail-review]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    state.podcastDetailDetailScrollTop = content.scrollTop || 0;
    renderPodcastDetailReviewContent(dialog, podcast, review);
    content.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  });

  const description = content.querySelector("[data-podcast-detail-description]");
  const descriptionToggle = content.querySelector("[data-podcast-detail-description-toggle]");
  if (description && descriptionToggle) {
    descriptionToggle.hidden =
      !isMobileViewport() || description.textContent.trim().length <= 220;
  }
  descriptionToggle?.addEventListener("click", () => {
    const expanded = description?.classList.toggle("is-expanded") || false;
    descriptionToggle.setAttribute("aria-expanded", String(expanded));
    descriptionToggle.textContent = expanded ? "Vis mindre" : "Læs mere";
  });

  content.querySelector("[data-podcast-detail-user-review]")?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (!isLoggedIn()) {
      showAuthPrompt("login");
      setAuthMessage("Log ind for at skrive en anmeldelse.", "warning", "dialog");
      return;
    }

    showInlineToast("Brugeranmeldelser kommer snart.");
  });

  dialog.querySelectorAll("[data-podcast-detail-favorite]").forEach((favoriteButton) => {
    renderFavoriteButton(favoriteButton, key);
    favoriteButton.addEventListener("click", async (event) => {
      await handleFavoriteToggle(event, podcast);
    });
  });

  if (getEpisodePodcastConfig(podcast) && !skipEpisodeLoad) {
    const episodeState = getPodcastEpisodeState(podcast);
if ((!isGenstartEpisodeCacheFresh() || episodeState.items.length < MINIMUM_RATEABLE_EPISODE_COUNT) && !episodeState.loading) {
      fetchGenstartEpisodes().then(() => {
        if (state.podcastDetailView === "detail") {
          refreshOpenPodcastDetailSheet();
          return;
        }

        updateGenstartEpisodeSection();
      });
    }
  }

  updatePodcastDetailRankingNavigation(dialog);
  updatePodcastDetailNavigationHistoryButton(dialog);
}

function refreshOpenPodcastDetailSheet() {
  const dialog = document.getElementById("podcastDetailSheet");
  if (!dialog || dialog.classList.contains("is-hidden")) return;

  const podcast = state.podcastByKey[state.activePodcastDetailKey];
  if (!podcast) return;

  const content = dialog.querySelector("[data-podcast-detail-content]");
  const scrollTop = content?.scrollTop || 0;

  if (state.podcastDetailView === "mainSeries") {
    const sourcePodcast =
      state.podcastByKey[state.podcastDetailMainSeriesSourceKey] || podcast;
    renderPodcastDetailMainSeriesContent(
      dialog,
      sourcePodcast,
      state.podcastDetailMainSeriesValue || sourcePodcast.mainSeries
    );
    content?.scrollTo?.({ top: scrollTop, left: 0, behavior: "auto" });
    return;
  }

  if (state.podcastDetailView === "episode") {
    const episode = getGenstartEpisodeById(state.podcastDetailEpisodeId);
    if (episode) {
      renderPodcastEpisodeDetailContent(dialog, podcast, episode);
      content?.scrollTo?.({ top: scrollTop, left: 0, behavior: "auto" });
    }
    return;
  }

  if (state.podcastDetailView === "episodes") {
    renderPodcastEpisodeOverviewContent(dialog, podcast);
    content?.scrollTo?.({ top: scrollTop, left: 0, behavior: "auto" });
    return;
  }

  if (state.podcastDetailView !== "detail") return;

  renderPodcastDetailSheetContent(dialog, podcast);
  content?.scrollTo?.({ top: scrollTop, left: 0, behavior: "auto" });
}

function openPodcastDetailSheet(
  podcast,
  triggerElement = null,
  { allowDesktop = false, preserveModalHistory = false, navigationKeys = null } = {}
) {
  if ((!isMobileViewport() && !allowDesktop) || !podcast) return false;

  const dialog = ensurePodcastDetailSheet();
  const isInternalModalNavigation =
    preserveModalHistory && !dialog.classList.contains("is-hidden");
  if (!isInternalModalNavigation) {
    clearPodcastDetailNavigationHistory();
  }
  setPodcastDetailRankingContext(podcast, navigationKeys);
  state.activePodcastDetailKey = getPodcastKey(podcast);
  state.podcastDetailView = "detail";
  state.podcastDetailMainSeriesValue = "";
  state.podcastDetailMainSeriesSourceKey = null;
  state.podcastDetailBackToMainSeries = false;
  state.podcastDetailDetailScrollTop = 0;
  state.podcastDetailEpisodeId = null;
  state.podcastDetailEpisodeScrollTop = 0;
  if (!isInternalModalNavigation) {
    state.podcastDetailReturnFocus = triggerElement || document.activeElement;
    state.podcastDetailScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
  }
  renderPodcastDetailSheetContent(dialog, podcast);
  resetPodcastDetailDragStyles(dialog);

  dialog.classList.remove("is-hidden");
  dialog.setAttribute("aria-hidden", "false");
  dialog.querySelector("[data-podcast-detail-content]")?.scrollTo?.({ top: 0, left: 0, behavior: "auto" });
  updatePodcastDetailNavigationHistoryButton(dialog);
  document.body.style.setProperty("--podcast-detail-scroll-y", `${state.podcastDetailScrollY}px`);
  document.body.classList.add("has-dialog-open", "has-podcast-detail-open");

  window.setTimeout(() => {
    dialog.querySelector(".podcast-detail-sheet__close")?.focus();
  }, 40);

  return true;
}

function closePodcastDetailSheet({ returnFocus = true, preserveHistoryRestore = false } = {}) {
  const dialog = document.getElementById("podcastDetailSheet");
  if (!dialog || dialog.classList.contains("is-hidden")) return;

  dialog.classList.add("is-hidden");
  dialog.setAttribute("aria-hidden", "true");
  state.activePodcastDetailKey = null;
  state.podcastDetailView = "detail";
  state.podcastDetailMainSeriesValue = "";
  state.podcastDetailMainSeriesSourceKey = null;
  state.podcastDetailBackToMainSeries = false;
  state.podcastDetailDetailScrollTop = 0;
  state.podcastDetailEpisodeId = null;
  state.podcastDetailEpisodeScrollTop = 0;
  clearPodcastDetailNavigationHistory();
  clearPodcastDetailRankingContext();

  const hasOtherDialogOpen =
    elements.ratingDialog?.getAttribute("aria-hidden") === "false" ||
    elements.authDialog?.getAttribute("aria-hidden") === "false" ||
    document.querySelector(".explore-suggestion-dialog:not(.is-hidden)");

  document.body.classList.remove("has-podcast-detail-open");
  if (!hasOtherDialogOpen) {
    document.body.classList.remove("has-dialog-open");
  }
  document.body.style.removeProperty("--podcast-detail-scroll-y");
  window.scrollTo({ top: state.podcastDetailScrollY, left: 0, behavior: "auto" });

  if (returnFocus && state.podcastDetailReturnFocus?.isConnected) {
    state.podcastDetailReturnFocus.focus?.({ preventScroll: true });
  }

  state.podcastDetailReturnFocus = null;
  if (!preserveHistoryRestore) clearPodcastDetailHistoryRestore();
}

function getRankingFilterHistoryState() {
  return {
    activeFilter: state.activeFilter ? { ...state.activeFilter } : null,
    activePublisherFilter: state.activePublisherFilter,
    activeMainSeriesFilter: state.activeMainSeriesFilter
  };
}

function restoreRankingFilterHistoryState(snapshot) {
  if (!snapshot) return;
  state.activeFilter = snapshot.activeFilter ? { ...snapshot.activeFilter } : null;
  state.activePublisherFilter = normalizeText(snapshot.activePublisherFilter);
  state.activeMainSeriesFilter = normalizeText(snapshot.activeMainSeriesFilter);
  resetVisibleCount();
}

function clearPodcastDetailHistoryRestore() {
  const currentState = window.history.state;
  if (!currentState || typeof currentState !== "object" || !currentState.podcastDetailRestore) {
    return;
  }

  const { podcastDetailRestore, ...nextState } = currentState;
  window.history.replaceState(nextState, "", window.location.href);
}

function navigatePodcastDetailToMainSeriesRanking(podcast, value) {
  const mainSeries = normalizeText(value);
  const podcastKey = getPodcastKey(podcast);
  if (!mainSeries || !podcastKey) return;

  const currentState =
    window.history.state && typeof window.history.state === "object"
      ? window.history.state
      : {};
  const sourceRoute = window.location.hash || "#forside";
  window.history.replaceState(
    {
      ...currentState,
      podcastDetailRestore: {
        podcastKey,
        route: sourceRoute,
        rankingFilters: getRankingFilterHistoryState()
      }
    },
    "",
    window.location.href
  );

  closePodcastDetailSheet({ returnFocus: false, preserveHistoryRestore: true });
  resetRankingFiltersForPodcastDetailNavigation("mainSeries", mainSeries);
  window.history.pushState({}, "", "#ranglister");
  render();
  scrollToRankingStart();
}

function restorePodcastDetailFromHistory() {
  const historyState = window.history.state;
  const restore = historyState?.podcastDetailRestore;
  if (!restore || restore.route !== (window.location.hash || "#forside")) return;

  const podcast = state.podcastByKey[restore.podcastKey];
  if (!podcast) return;

  const dialog = document.getElementById("podcastDetailSheet");
  if (
    dialog &&
    !dialog.classList.contains("is-hidden") &&
    state.activePodcastDetailKey === restore.podcastKey
  ) {
    return;
  }

  restoreRankingFilterHistoryState(restore.rankingFilters);
  if (getRouteInfoFromHash().route === "ranglister") render();
  openPodcastDetailSheet(podcast, null, { allowDesktop: true });
}

function handleMobilePodcastCardOpen(event, podcast, card) {
  if (!isMobileViewport() || isInteractivePodcastDetailTarget(event.target)) return false;

  event.preventDefault();
  event.stopPropagation();
  openPodcastDetailSheet(podcast, card);
  return true;
}

function createHomePopularCardElement(podcast, options = {}) {
  const key = getPodcastKey(podcast);
  const stat = getCommunityStat(key);
  const communityAverage = parseNumber(stat?.averageRating);
  const communityCount = Number(stat?.ratingCount || 0);
  const podcastlistenRating = parseNumber(podcast.ratingValue);
  const hasCommunityRating = communityAverage !== null && communityCount > 0;
  const rank = options.rank ?? state.userRankByKey[key];
  const ratingSource = options.ratingSource || (hasCommunityRating ? "Brugere" : "Podcastlisten");
  const ratingValue =
    options.ratingValue ?? (hasCommunityRating ? communityAverage : podcastlistenRating);
  const ratingLabel =
    options.ratingLabel ??
    (ratingValue === null ? "Ikke vurderet" : formatCompactRating(ratingValue));
  const ratingMeta =
    options.ratingMeta ??
    (hasCommunityRating
      ? `${formatRatingCount(communityCount)} ${
          communityCount === 1 ? "vurdering" : "vurderinger"
        }`
      : podcastlistenRating === null
        ? "Ingen vurdering endnu"
        : "Podcastlistens vurdering");
  const hostLabel = normalizeText(podcast.host);
  const publisherLabel = normalizeText(podcast.publisher);
  const metadataParts = [hostLabel, publisherLabel]
    .filter((value, index, values) => value && values.indexOf(value) === index);
  const metadataLabel = metadataParts.join(" · ") || "Udgiver ikke angivet";
  const card = document.createElement("article");
  card.className = "home-popular-card";
  if (options.candidateLevel) {
    card.dataset.communityCandidateLevel = options.candidateLevel;
    card.dataset.communityRating = String(communityAverage);
    card.dataset.communityRatingCount = String(communityCount);
  }

  const cover = document.createElement("div");
  cover.className = "home-popular-card__cover";
  const image = document.createElement("img");
  image.className = "home-popular-card__image";
  image.loading = "lazy";
  cover.appendChild(image);
  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  const copy = document.createElement("div");
  copy.className = "home-popular-card__copy";
  copy.innerHTML = `
    <span class="home-popular-card__rank">${rank ? `#${rank}` : ""}</span>
    <h3>${escapeHtml(podcast.title)}${getPodcastAccessIndicatorMarkup(podcast)}</h3>
    <p class="home-popular-card__metadata${hostLabel ? "" : " home-popular-card__metadata--hostless"}">
      <span class="home-popular-card__metadata-host">${escapeHtml(hostLabel)}</span>${
        hostLabel && publisherLabel && publisherLabel !== hostLabel
          ? '<span class="home-popular-card__metadata-separator" aria-hidden="true"> · </span>'
          : ""
      }<span class="home-popular-card__metadata-publisher">${escapeHtml(
        publisherLabel && publisherLabel !== hostLabel ? publisherLabel : hostLabel ? "" : metadataLabel
      )}</span>
    </p>
    <p class="home-popular-card__rating">
      <span class="home-popular-card__rating-source" aria-hidden="true">★</span>
      <strong>${escapeHtml(ratingLabel)}</strong>
      <span class="home-popular-card__rating-meta">${escapeHtml(ratingMeta)}</span>
    </p>
  `;
  copy
    .querySelector(".home-popular-card__rating-source")
    ?.style.setProperty("color", "#ff5c16", "important");

  card.append(cover, copy);

  card.classList.add("is-clickable");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Åbn detaljer om ${podcast.title}`);

  const openPodcastDetails = () => {
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  };

  card.addEventListener("click", (event) => {
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openPodcastDetails();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openPodcastDetails();
  });

  return card;
}

function getHomeFeaturedReviewScore(review) {
  const value = parseNumber(review?.score ?? review?.scoreLabel);
  return value === null ? null : value;
}

function getHomeLatestEditorialReviews() {
  const weeklyKeys = new Set();
  getHomeFeaturedReviewQueue().forEach((review) => {
    weeklyKeys.add(normalizeMatchKey(review.matchTitle || review.title));
    const podcast = getPodcastForFeaturedReview(review);
    if (podcast) weeklyKeys.add(getPodcastKey(podcast));
  });

  const reviewsByPodcastKey = new Map();
  state.allReviews.forEach((review) => {
    const podcast = getPodcastForFeaturedReview(review);
    const key = podcast ? getPodcastKey(podcast) : "";
    if (key && normalizeText(review.review)) reviewsByPodcastKey.set(key, review);
  });

  const seen = new Set();
  return state.podcasts
    .filter((podcast) => parseNumber(podcast.ratingValue) !== null && podcast.ratingDateObject)
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      if (weeklyKeys.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.ratingDateObject - a.ratingDateObject)
    .map((podcast) => {
      const review = reviewsByPodcastKey.get(getPodcastKey(podcast)) || null;
      return {
        type: "podcast",
        podcast,
        review,
        ratingValue: podcast.ratingValue,
        dateLabel: podcast.ratingDateLabel,
        hasWrittenReview: Boolean(normalizeText(review?.review))
      };
    });
}

function formatHomeEditorialScore(score) {
  const value = parseNumber(score);
  return value === null ? "—" : value.toFixed(1).replace(".", ",");
}

function createHomeEditorialCard(item) {
  const isEpisode = item.type === "episode";
  const card = document.createElement(isEpisode ? "article" : "button");
  card.className = `home-editorial-card home-editorial-card--${isEpisode ? "episode" : "podcast"}`;
  if (!isEpisode) card.type = "button";

  const cover = document.createElement("span");
  cover.className = "home-editorial-card__cover";
  const image = document.createElement("img");
  image.loading = "lazy";
  image.alt = "";
  cover.appendChild(image);

  if (item.podcast) {
    setImage(cover, getPodcastImageSources(item.podcast), item.podcast.title);
  } else {
    cover.classList.add("home-editorial-card__cover--placeholder");
    image.hidden = true;
  }

  const hasWrittenReview = !isEpisode && item.hasWrittenReview;
  const title = isEpisode ? item.title : item.podcast.title;
  const secondary = isEpisode
    ? item.parentTitle
    : item.podcast.publisher || "";
  const dateLabel = isEpisode ? item.dateLabel : item.dateLabel;
  card.innerHTML = `
    <span class="home-editorial-card__copy">
      <span class="home-editorial-card__type">${isEpisode ? "EPISODE" : "VURDERING"}</span>
      <strong class="home-editorial-card__title">${escapeHtml(title)}</strong>
      <span class="home-editorial-card__meta">${escapeHtml(secondary)}</span>
      <span class="home-editorial-card__date">${escapeHtml(dateLabel || "Dato ikke angivet")}</span>
    </span>
    <span class="home-editorial-card__score">${escapeHtml(formatHomeEditorialScore(isEpisode ? item.score : item.ratingValue))}<small>/10</small></span>`;
  card.prepend(cover);

  if (!isEpisode) {
    card.setAttribute("aria-label", `Åbn podcasten ${title}`);
    card.addEventListener("click", () => openPodcastDetailSheet(item.podcast, card, { allowDesktop: true }));
  } else {
    card.setAttribute("aria-label", "Eksempel på fremtidig episodevurdering");
  }
  return card;
}

function renderHomeLatestEditorial(container) {
  if (!container) return;
  const reviews = getHomeLatestEditorialReviews();
  const section = container.closest(".home-editorial-latest");
  if (!reviews.length) {
    if (section) section.hidden = true;
    return;
  }
  if (section) section.hidden = false;
  const featured = reviews.find((item) => item.hasWrittenReview) || null;
  const compactLimit = isMobileViewport() ? 3 : 8;
  const compactItems = reviews
    .filter((item) => item !== featured)
    .slice(0, compactLimit)
    .map((item) => ({ ...item, hasWrittenReview: false }));
  if (!featured) {
    if (section) section.hidden = true;
    return;
  }
  const featuredPodcast = featured.podcast;
  const score = formatHomeEditorialScore(featured.ratingValue);
  const featuredTitle = featuredPodcast.title;
  const featuredLabel = featured.hasWrittenReview ? "ANMELDELSE" : "VURDERING";
  container.innerHTML = `
    <button class="home-editorial-feature" type="button" aria-label="Åbn podcasten ${escapeHtml(featuredTitle)}">
      <span class="home-editorial-feature__cover"><img alt="" loading="lazy" /></span>
      <span class="home-editorial-feature__copy">
        <span class="home-editorial-feature__type">${featuredLabel}</span>
        <strong>${escapeHtml(featuredTitle)}</strong>
        <span class="home-editorial-feature__publisher">${escapeHtml(featuredPodcast.publisher || "")}</span>
        <span class="home-editorial-feature__score"><b>${escapeHtml(score)}</b><small>/10</small></span>
        <span class="home-editorial-feature__date">${escapeHtml(featured.dateLabel || "Dato ikke angivet")}</span>
        ${featured.hasWrittenReview ? `<span class="home-editorial-feature__excerpt">${escapeHtml(featured.review.review)}</span>` : ""}
        <span class="home-editorial-feature__cta">${featured.hasWrittenReview ? "Læs anmeldelse" : "Åbn podcast"} <span aria-hidden="true">→</span></span>
      </span>
    </button>
    <div class="home-editorial-latest__grid"></div>`;
  const cover = container.querySelector(".home-editorial-feature__cover");
  setImage(cover, getPodcastImageSources(featuredPodcast), featuredTitle);
  container.querySelector(".home-editorial-feature")?.addEventListener("click", () => openPodcastDetailSheet(featuredPodcast, container, { allowDesktop: true }));
  const grid = container.querySelector(".home-editorial-latest__grid");
  compactItems.forEach((item) => grid.appendChild(createHomeEditorialCard(item)));
}

function getHomeFeaturedReviewQueue() {
  return state.allReviews
    .filter(isActiveFeatured)
    .filter((review) => {
      const score = getHomeFeaturedReviewScore(review);
      return score !== null && score >= 7;
    })
    .sort((a, b) => {
      const aTime = a.reviewDateObject ? a.reviewDateObject.getTime() : 0;
      const bTime = b.reviewDateObject ? b.reviewDateObject.getTime() : 0;
      if (bTime !== aTime) return bTime - aTime;
      return a.displayOrder - b.displayOrder;
    });
}

function getPodcastForFeaturedReview(review) {
  const reviewKey = normalizeMatchKey(review?.matchTitle || review?.title);
  return reviewKey ? state.podcastByKey[reviewKey] || null : null;
}

function openHomeFeaturedReview(review, trigger) {
  if (!review) return;

  const podcast = getPodcastForFeaturedReview(review);
  if (podcast) {
    openPodcastDetailSheet(podcast, trigger, { allowDesktop: true });
    return;
  }

  if (review.link) {
    window.open(review.link, "_blank", "noopener,noreferrer");
  }
}

function updateHomeFeaturedForegroundTheme(container, image) {
  if (!container || !image?.naturalWidth || !image?.naturalHeight) return;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 1, 1);
    const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    container.classList.toggle("home-featured__content--dark", luminance < 112);
  } catch {
    container.classList.remove("home-featured__content--dark");
  }
}

const HOME_FEATURED_AUTOPLAY_DELAY = 12000;

function stopHomeFeaturedAutoplay() {
  if (state.homeFeaturedAutoplayTimer !== null) {
    window.clearTimeout(state.homeFeaturedAutoplayTimer);
    state.homeFeaturedAutoplayTimer = null;
  }
}

function startHomeFeaturedAutoplay(container) {
  stopHomeFeaturedAutoplay();

  const reviews = getHomeFeaturedReviewQueue();
  if (!container?.isConnected || reviews.length < 2 || state.homeFeaturedAutoplayPaused) return;

  state.homeFeaturedAutoplayTimer = window.setTimeout(() => {
    state.homeFeaturedAutoplayTimer = null;

    if (document.hidden || state.homeFeaturedAutoplayPaused) {
      startHomeFeaturedAutoplay(container);
      return;
    }

    state.homeFeaturedIndex = (state.homeFeaturedIndex + 1) % reviews.length;
    renderHomeFeatured(container);
  }, HOME_FEATURED_AUTOPLAY_DELAY);
}

function bindHomeFeaturedAutoplayPause(container) {
  if (!container || container.dataset.homeFeaturedAutoplayBound === "true") return;

  container.dataset.homeFeaturedAutoplayBound = "true";
  const supportsHover = () => window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

  container.addEventListener("mouseenter", () => {
    if (!supportsHover()) return;
    state.homeFeaturedAutoplayPaused = true;
    stopHomeFeaturedAutoplay();
  });

  container.addEventListener("mouseleave", () => {
    if (!supportsHover()) return;
    state.homeFeaturedAutoplayPaused = false;
    startHomeFeaturedAutoplay(container);
  });
}

function setHomeFeaturedIndex(container, index) {
  state.homeFeaturedIndex = index;
  renderHomeFeatured(container);
}

function renderHomeFeatured(container) {
  if (!container) return;

  const reviews = getHomeFeaturedReviewQueue();
  if (!reviews.length) {
    container.innerHTML = '<div class="empty-state">Ugens anbefaling er på vej.</div>';
    return;
  }

  const maxIndex = reviews.length - 1;
  state.homeFeaturedIndex = Math.min(Math.max(state.homeFeaturedIndex, 0), maxIndex);

  const review = reviews[state.homeFeaturedIndex];
  const podcast = getPodcastForFeaturedReview(review);
  const imageSources = podcast ? getPodcastImageSources(podcast) : review.image;
  const coverCacheVersion = getPodcastCoverRevision(podcast);
  const score = getHomeFeaturedReviewScore(review);
  const scoreMarkup = score === null
    ? "Ikke vurderet"
    : `<span class="home-featured__score-star" aria-hidden="true">&#9733;</span><span class="home-featured__score-number">${escapeHtml(score.toFixed(1).replace(".", ","))}</span><span class="home-featured__score-out-of">/10</span>`;
  const featuredTitle = podcast
    ? getDesktopRankingTitleParts(podcast).displayText
    : review.title || "";
  const longestTitleWord = featuredTitle
    .split(/\s+/)
    .reduce((longest, word) => Math.max(longest, word.length), 0);
  const featuredTitleSize = longestTitleWord >= 15
    ? "single-long"
    : featuredTitle.length <= 14
      ? "short"
      : featuredTitle.length <= 21
        ? "medium"
        : "long";
  container.classList.remove(
    "home-featured__content--title-short",
    "home-featured__content--title-medium",
    "home-featured__content--title-long",
    "home-featured__content--title-single-long"
  );
  container.classList.add(`home-featured__content--title-${featuredTitleSize}`);
  container.classList.toggle("home-featured__content--long-title", featuredTitle.length > 28);
  const featuredMeta = Array.from(
    new Set(
      [review.host, review.publisher, review.genre]
        .map(normalizeText)
        .filter(Boolean)
    )
  );
  const featuredMetaMarkup = featuredMeta
    .map((item) => {
      const isPublisher = item === normalizeText(review.publisher);
      const isGenre = item === normalizeText(review.genre);
      if (isPublisher || isGenre) {
        const filterType = isPublisher ? "publisher" : "genre";
        return `<button class="home-featured__meta-link home-featured__meta-badge home-featured__meta-badge--${filterType}" type="button" data-home-featured-filter="${filterType}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`;
      }
      return `<span class="home-featured__meta-host">${escapeHtml(item)}</span>`;
    })
    .join("");
  const featuredTagMarkup = featuredMeta
    .filter((item) => item === normalizeText(review.publisher) || item === normalizeText(review.genre))
    .map((item) => {
      const filterType = item === normalizeText(review.publisher) ? "publisher" : "genre";
      return `<button class="home-featured__meta-link home-featured__meta-badge home-featured__meta-badge--${filterType}" type="button" data-home-featured-filter="${filterType}" data-value="${escapeHtml(item)}">${escapeHtml(item)}</button>`;
    })
    .join("");
  const featuredHost = featuredMeta.find(
    (item) => item !== normalizeText(review.publisher) && item !== normalizeText(review.genre)
  ) || "";
  const showNavigation = reviews.length > 1;
  const indicatorMarkup = showNavigation
    ? `<div class="home-featured__indicators" aria-label="Vælg ugens anbefaling">${reviews.map((reviewItem, index) => `<button class="home-featured__indicator${index === state.homeFeaturedIndex ? " is-active" : ""}" type="button" data-home-featured-index="${index}" aria-label="Vis anbefaling ${index + 1}: ${escapeHtml(reviewItem.title || "podcast")}" aria-current="${index === state.homeFeaturedIndex ? "true" : "false"}"></button>`).join("")}</div>`
    : "";
  const previousIndex = (state.homeFeaturedIndex - 1 + reviews.length) % reviews.length;
  const nextIndex = (state.homeFeaturedIndex + 1) % reviews.length;
  const previousReview = showNavigation ? reviews[previousIndex] : null;
  const nextReview = showNavigation ? reviews[nextIndex] : null;
  const previousPodcast = previousReview ? getPodcastForFeaturedReview(previousReview) : null;
  const nextPodcast = nextReview ? getPodcastForFeaturedReview(nextReview) : null;
  const previousImageSources = previousPodcast
    ? getPodcastImageSources(previousPodcast)
    : previousReview?.image;
  const nextImageSources = nextPodcast ? getPodcastImageSources(nextPodcast) : nextReview?.image;
  const previousCoverCacheVersion = getPodcastCoverRevision(previousPodcast);
  const nextCoverCacheVersion = getPodcastCoverRevision(nextPodcast);
  const featuredPodcastKey = podcast ? getPodcastKey(podcast) : "";

  container.innerHTML = `
    <div class="home-featured__surface">
    <button class="home-featured__preview home-featured__preview--previous" type="button" data-home-featured-prev aria-label="Forrige anbefaling">
      <img class="home-featured__preview-image home-featured__preview-image--previous" alt="" loading="lazy" />
    </button>
    <div class="home-featured__cover-column">
      <button
        class="home-featured__cover"
        type="button"
        data-home-featured-open
        aria-label="Åbn podcasten ${escapeHtml(featuredTitle)}"
      >
        <img class="home-featured__image" alt="" loading="lazy" />
      </button>
      <div class="home-featured__top-action-details home-featured__cover-actions">
        <button
          class="home-featured__open"
          type="button"
          data-home-featured-open
        >
          <span>Åbn podcast</span>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m9 5 7 7-7 7"></path>
          </svg>
        </button>
        <span class="home-featured__review-date"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><rect x="4" y="5.5" width="16" height="14" rx="2"></rect><path d="M8 3.5v4M16 3.5v4M4 10h16"></path></svg>${escapeHtml(review.reviewDateLabel || "Dato ikke angivet")}</span>
      </div>
    </div>
    <div class="home-featured__copy">
      <p class="home-featured__label">
        <span>Podcastlistens ugentlige anbefaling</span>
      </p>
      <div class="home-featured__title-row">
        <h3>
          <button
            class="home-featured__title-button"
            type="button"
            data-home-featured-open
          >${escapeHtml(featuredTitle)}${podcast ? getPodcastAccessIndicatorMarkup(podcast) : ""}</button>
        </h3>
          ${featuredPodcastKey ? '<button class="favorite-button home-featured__favorite" type="button" aria-label="Gem podcast"><span aria-hidden="true"></span></button>' : ""}
        </div>
      ${
        featuredMeta.length
          ? `<p class="home-featured__meta">${featuredMetaMarkup}</p>`
          : ""
      }
      <p class="home-featured__mobile-host">${escapeHtml(featuredHost)}</p>
      <div class="home-featured__scorecard" aria-label="Podcastlistens vurdering">
        <span class="home-featured__score-item">
          <small>Podcastlistens vurdering</small>
          <strong class="home-featured__score-value">${scoreMarkup}</strong>
        </span>
      </div>
      <div class="home-featured__mobile-meta-row">
        <div class="home-featured__mobile-tags">${featuredTagMarkup}</div>
        ${featuredPodcastKey ? '<button class="favorite-button home-featured__favorite home-featured__favorite--mobile" type="button" aria-label="Gem podcast"><span aria-hidden="true"></span></button>' : ""}
      </div>
      <div class="home-featured__review-wrap">
        <p class="home-featured__review">${escapeHtml(review.review || "")}</p>
        <button class="home-featured__review-toggle" type="button" aria-expanded="false" hidden>
          Læs mere <span aria-hidden="true">↓</span>
        </button>
      </div>
    </div>
    <div class="home-featured__controls${showNavigation ? "" : " home-featured__controls--single"}">
      <div class="home-featured__nav-group" aria-label="Skift anbefaling">
      <button
        class="home-featured__nav home-featured__nav--prev"
        type="button"
        data-home-featured-prev
        aria-label="Forrige anbefaling"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m15 5-7 7 7 7"></path>
        </svg>
      </button>
      <button
        class="home-featured__nav home-featured__nav--next"
        type="button"
        data-home-featured-next
        aria-label="Næste anbefaling"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="m9 5 7 7-7 7"></path>
        </svg>
      </button>
      </div>
    </div>
    <div class="home-featured__indicators--desktop">${indicatorMarkup}</div>
    <button class="home-featured__preview home-featured__preview--next" type="button" data-home-featured-next aria-label="Næste anbefaling">
      <img class="home-featured__preview-image home-featured__preview-image--next" alt="" loading="lazy" />
    </button>
    </div>
    <div class="home-featured__indicators--mobile">${indicatorMarkup}</div>
  `;

  const image = container.querySelector(".home-featured__image");
  const coverButton = container.querySelector(".home-featured__cover");
  const initialBackgroundSource = Array.isArray(imageSources) ? imageSources[0] : imageSources;

  if (initialBackgroundSource) {
    container.style.setProperty("--home-featured-bg", `url(${JSON.stringify(initialBackgroundSource)})`);
  }

  if (imageSources && (Array.isArray(imageSources) ? imageSources.length : true)) {
    loadImageWithFallback(image, imageSources, review.title || "", {
      cacheVersion: coverCacheVersion,
      onLoad() {
        const resolvedSource = image?.currentSrc || image?.src;
        if (resolvedSource) {
          container.style.setProperty("--home-featured-bg", `url(${JSON.stringify(resolvedSource)})`);
        }
        updateHomeFeaturedForegroundTheme(container, image);
      },
      onFail() {
        coverButton?.classList.add("has-no-image");
      }
    });
  } else {
    coverButton?.classList.add("has-no-image");
    if (image) image.hidden = true;
  }

  container.querySelectorAll(".home-featured__favorite").forEach((favoriteButton) => {
    if (!podcast) return;
    renderFavoriteButton(favoriteButton, featuredPodcastKey);
    favoriteButton.addEventListener("click", (event) => handleFavoriteToggle(event, podcast));
  });

  const featuredReview = container.querySelector(".home-featured__review");
  const featuredReviewToggle = container.querySelector(".home-featured__review-toggle");
  if (featuredReview && featuredReviewToggle) {
    window.requestAnimationFrame(() => {
      const isMobile = window.matchMedia?.("(max-width: 768px)").matches;
      const hasOverflow = featuredReview.scrollHeight > featuredReview.clientHeight + 1;
      featuredReviewToggle.hidden = !isMobile || !hasOverflow;
    });

    featuredReviewToggle.addEventListener("click", () => {
      const expanded = !featuredReview.classList.contains("is-expanded");
      featuredReview.classList.toggle("is-expanded", expanded);
      featuredReviewToggle.setAttribute("aria-expanded", String(expanded));
      featuredReviewToggle.innerHTML = expanded
        ? 'Vis mindre <span aria-hidden="true">↑</span>'
        : 'Læs mere <span aria-hidden="true">↓</span>';
    });
  }

  const setPreviewImage = (selector, sources, title, cacheVersion) => {
    const preview = container.querySelector(selector);
    if (!preview) return;
    if (!sources || (Array.isArray(sources) && !sources.length)) {
      preview.closest(".home-featured__preview")?.classList.add("is-empty");
      return;
    }
    loadImageWithFallback(preview, sources, title || "", { cacheVersion });
  };
  setPreviewImage(".home-featured__preview-image--previous", previousImageSources, previousReview?.title, previousCoverCacheVersion);
  setPreviewImage(".home-featured__preview-image--next", nextImageSources, nextReview?.title, nextCoverCacheVersion);

  container.querySelectorAll("[data-home-featured-open]").forEach((element) => {
    element.addEventListener("click", () => {
      openHomeFeaturedReview(review, element);
    });
  });

  container.querySelectorAll("[data-home-featured-filter]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveFilter(button.dataset.homeFeaturedFilter, button.dataset.value);
      if (window.location.hash.slice(1).toLowerCase() !== "ranglister") {
        window.location.hash = "#ranglister";
      }
    });
  });

  container.querySelectorAll("[data-home-featured-prev]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setHomeFeaturedIndex(container, previousIndex);
    });
  });

  container.querySelectorAll("[data-home-featured-next]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setHomeFeaturedIndex(container, nextIndex);
    });
  });

  container.querySelectorAll("[data-home-featured-index]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setHomeFeaturedIndex(container, Number(button.dataset.homeFeaturedIndex));
    });
  });

  const featuredSurface = container.querySelector(".home-featured__surface");
  let swipeStartX = null;
  featuredSurface?.addEventListener("pointerdown", (event) => {
    if (!window.matchMedia?.("(max-width: 768px)").matches || event.pointerType === "mouse") return;
    swipeStartX = event.clientX;
  });
  featuredSurface?.addEventListener("pointerup", (event) => {
    if (swipeStartX === null) return;
    const distance = event.clientX - swipeStartX;
    swipeStartX = null;
    if (Math.abs(distance) < 42) return;
    setHomeFeaturedIndex(container, distance < 0 ? nextIndex : previousIndex);
  });
  featuredSurface?.addEventListener("pointercancel", () => {
    swipeStartX = null;
  });

  bindHomeFeaturedAutoplayPause(container);
  startHomeFeaturedAutoplay(container);
}

function renderHomePopular(container) {
  if (!container) return;
  const isMobileHome = window.matchMedia?.("(max-width: 768px)").matches;
  const desiredCount = isMobileHome ? 14 : 15;
  const dayKey = getHomePopularDayKey();
  const heroKeys = new Set(getHomeHeroPodcasts(dayKey).map(getPodcastKey));
  const candidatePools = getHomeCommunityPopularCandidatePools(
    HOME_POPULAR_CAROUSEL_POOL_LIMIT
  );
  const candidatePoolCounts = {
    primary: candidatePools.primary.length,
    secondary: candidatePools.secondary.length,
    tertiary: candidatePools.tertiary.length
  };
  const popular = selectHomeCommunityPopularCandidates(desiredCount, {
    hourKey: dayKey,
    deprioritizeKeys: heroKeys,
    candidatePools
  });

  container.innerHTML = "";
  container.dataset.communityPrimaryCandidates = String(
    candidatePoolCounts.primary
  );
  container.dataset.communitySecondaryCandidates = String(
    candidatePoolCounts.secondary
  );
  container.dataset.communityTertiaryCandidates = String(
    candidatePoolCounts.tertiary
  );
  container.dataset.communityRotationKey = dayKey;
  container.dataset.communitySelectedPrimary = String(
    popular.filter((candidate) => candidate.candidateLevel === "primary").length
  );
  container.dataset.communitySelectedSecondary = String(
    popular.filter((candidate) => candidate.candidateLevel === "secondary").length
  );
  container.dataset.communitySelectedTertiary = String(
    popular.filter((candidate) => candidate.candidateLevel === "tertiary").length
  );

  if (!popular.length) {
    container.innerHTML =
      '<div class="empty-state">Brugernes favoritter er på vej.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  popular.forEach((candidate) => {
    fragment.appendChild(
      createHomePopularCardElement(candidate.podcast, {
        candidateLevel: candidate.candidateLevel
      })
    );
  });
  container.appendChild(fragment);
  setupHomePopularIndicators(container, popular.length);
}

function setupHomeCarouselIndicators(
  container,
  itemCount,
  {
    sectionSelector,
    indicatorsSelector,
    cardSelector,
    cleanupKey,
    previousSelector,
    nextSelector,
  }
) {
  const section = container.closest(sectionSelector);
  const indicators = section?.querySelector(indicatorsSelector);
  if (!section || !indicators) return;

  if (typeof container[cleanupKey] === "function") {
    container[cleanupKey]();
  }

  const getMarkerCount = () => {
    const firstCard = container.querySelector(cardSelector);
    const cardWidth = firstCard?.getBoundingClientRect().width || 1;
    const styles = window.getComputedStyle(container);
    const gap = parseFloat(styles.columnGap || styles.gap || "0") || 0;
    const step = Math.max(1, cardWidth + gap);
    const visibleCards = Math.max(1, Math.floor((container.clientWidth + gap) / step));
    return Math.min(5, Math.max(2, itemCount - visibleCards + 1));
  };

  const updateActiveIndicator = () => {
    const markers = [...indicators.querySelectorAll(".home-popular__indicator")];
    const maxScroll = container.scrollWidth - container.clientWidth;
    if (!markers.length || maxScroll <= 1) return;

    const progress = container.scrollLeft / maxScroll;
    const activeIndex = Math.max(
      0,
      Math.min(markers.length - 1, Math.round(progress * (markers.length - 1)))
    );

    markers.forEach((marker, index) => {
      marker.classList.toggle("is-active", index === activeIndex);
      marker.setAttribute("aria-current", index === activeIndex ? "true" : "false");
    });
  };

  const renderIndicators = () => {
    const maxScroll = container.scrollWidth - container.clientWidth;
    const markerCount = getMarkerCount();

    indicators.hidden = itemCount <= 1 || maxScroll <= 1;
    indicators.replaceChildren();
    if (indicators.hidden) return;

    for (let index = 0; index < markerCount; index += 1) {
      const marker = document.createElement("button");
      marker.className = "home-popular__indicator";
      marker.type = "button";
      marker.setAttribute("aria-label", `Vis carousel-position ${index + 1}`);
      marker.addEventListener("click", () => {
        const target =
          markerCount === 1 ? 0 : (maxScroll * index) / (markerCount - 1);
        container.scrollTo({ left: target, behavior: "smooth" });
      });
      indicators.appendChild(marker);
    }

    updateActiveIndicator();
  };

  const handleScroll = () => window.requestAnimationFrame(updateActiveIndicator);
  const handleResize = () => window.requestAnimationFrame(renderIndicators);
  const scrollByPage = (direction) => {
    const maxScroll = Math.max(0, container.scrollWidth - container.clientWidth);
    if (maxScroll <= 1) return;

    const markers = [...indicators.querySelectorAll(".home-popular__indicator")];
    const pageCount = Math.max(2, markers.length || getMarkerCount());
    const currentPage = Math.round((container.scrollLeft / maxScroll) * (pageCount - 1));
    const nextPage = (currentPage + direction + pageCount) % pageCount;
    const target = (maxScroll * nextPage) / (pageCount - 1);

    container.scrollTo({ left: target, behavior: "smooth" });
  };
  const previousButton = previousSelector ? section.querySelector(previousSelector) : null;
  const nextButton = nextSelector ? section.querySelector(nextSelector) : null;
  const handlePrevious = () => scrollByPage(-1);
  const handleNext = () => scrollByPage(1);
  const indicatorSyncInterval = window.setInterval(updateActiveIndicator, 250);

  container.addEventListener("scroll", handleScroll, { passive: true });
  window.addEventListener("resize", handleResize);
  previousButton?.addEventListener("click", handlePrevious);
  nextButton?.addEventListener("click", handleNext);
  container[cleanupKey] = () => {
    container.removeEventListener("scroll", handleScroll);
    window.removeEventListener("resize", handleResize);
    previousButton?.removeEventListener("click", handlePrevious);
    nextButton?.removeEventListener("click", handleNext);
    window.clearInterval(indicatorSyncInterval);
  };

  window.requestAnimationFrame(renderIndicators);
  window.setTimeout(renderIndicators, 250);
}

function setupHomePopularIndicators(container, itemCount) {
  setupHomeCarouselIndicators(container, itemCount, {
    sectionSelector: ".home-popular",
    indicatorsSelector: ".home-popular__indicators",
    cardSelector: ".home-popular-card",
    cleanupKey: "_homePopularIndicatorCleanup",
    previousSelector: ".home-popular__arrow--previous",
    nextSelector: ".home-popular__arrow--next",
  });
}

function setupHomeRecentIndicators(container, itemCount) {
  setupHomeCarouselIndicators(container, itemCount, {
    sectionSelector: ".home-recent",
    indicatorsSelector: ".home-recent__indicators",
    cardSelector: ".home-popular-card, .home-recent-card",
    cleanupKey: "_homeRecentIndicatorCleanup",
  });
}

function createHomeRecentCardElement(podcast) {
  const card = document.createElement("article");
  card.className = "home-recent-card is-clickable";
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Åbn detaljer om ${podcast.title}`);

  const cover = document.createElement("div");
  cover.className = "home-recent-card__cover";
  const image = document.createElement("img");
  image.className = "home-recent-card__image";
  image.loading = "lazy";
  cover.appendChild(image);
  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  const copy = document.createElement("div");
  copy.className = "home-recent-card__copy";
  copy.innerHTML = `
    <h3>${escapeHtml(podcast.title)}${getPodcastAccessIndicatorMarkup(podcast)}</h3>
    <p class="home-recent-card__host">${escapeHtml(
      podcast.host || podcast.publisher || ""
    )}</p>
    <p class="home-recent-card__meta">
      <span>${escapeHtml(
        podcast.ratingDateLabel ? `Bedømt ${podcast.ratingDateLabel}` : ""
      )}</span>
      <span class="home-recent-card__score">${escapeHtml(
        podcast.ratingLabel || "Ikke vurderet"
      )}</span>
    </p>
  `;

  const actions = document.createElement("div");
  actions.className = "home-recent-card__actions";

  const openButton = document.createElement("button");
  openButton.className = "home-recent-card__open";
  openButton.type = "button";
  openButton.textContent = "Åbn";
  openButton.title = `Åbn ${podcast.title}`;
  openButton.setAttribute("aria-label", `Åbn detaljer om ${podcast.title}`);

  const openDetails = () => {
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  };

  openButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDetails();
  });

  card.addEventListener("click", (event) => {
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openDetails();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openDetails();
  });

  actions.appendChild(openButton);
  card.append(cover, copy, actions);

  return card;
}

function renderHomeRecent(container) {
  if (!container) return;

  const section = container.closest(".home-recent");
  const recent = getHomeRecentPodcasts();

  container.innerHTML = "";

  if (!recent.length) {
    if (section) section.hidden = true;
    return;
  }

  if (section) section.hidden = false;

  const fragment = document.createDocumentFragment();
  const usePopularCardLayout = isMobileViewport();
  recent.forEach((podcast) => {
    fragment.appendChild(
      usePopularCardLayout
        ? createHomePopularCardElement(podcast, {
            rank: "",
            ratingLabel: podcast.ratingLabel || "Ikke vurderet",
            ratingMeta: "",
          })
        : createHomeRecentCardElement(podcast)
    );
  });
  container.appendChild(fragment);
  setupHomeRecentIndicators(container, recent.length);
}

function getHomeRecentPodcasts() {
  return state.podcasts
    .filter(
      (podcast) =>
        podcast.ratingDateObject &&
        typeof podcast.ratingValue === "number" &&
        podcast.ratingValue >= 7
    )
    .sort((a, b) => b.ratingDateObject - a.ratingDateObject)
    .slice(0, 6);
}

function refreshHomeRecentSection() {
  if (!document.body.classList.contains("page-forside")) return;

  renderHomeRecent(
    elements.pageIntroPanel?.querySelector(".home-recent__grid")
  );
}

function createHomeGenreCardElement(podcast, genre) {
  const card = document.createElement("article");
  card.className = "home-genres-card";
  card.dataset.genre = genre;

  const cover = document.createElement("div");
  cover.className = "home-genres-card__cover";
  const image = document.createElement("img");
  image.className = "home-genres-card__image";
  image.loading = "lazy";
  cover.appendChild(image);
  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  const copy = document.createElement("div");
  copy.className = "home-genres-card__copy";
  copy.innerHTML = `
    <p class="home-genres-card__genre">${escapeHtml(genre)}</p>
    <h3>${escapeHtml(podcast.title)}${getPodcastAccessIndicatorMarkup(podcast)}</h3>
    <p class="home-genres-card__host">${escapeHtml(
      podcast.host || podcast.publisher || ""
    )}</p>
    <p class="home-genres-card__meta">
      <span>#${escapeHtml(podcast.placement)}</span>
      <strong>${escapeHtml(podcast.ratingLabel || "Ikke vurderet")}</strong>
    </p>
  `;

  card.append(cover, copy);

  card.classList.add("is-clickable");
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.setAttribute("aria-label", `Se ${genre} p\u00e5 ranglister`);

  const openGenre = () => {
    setActiveFilter("genre", genre);

    if (window.location.hash.slice(1).toLowerCase() !== "ranglister") {
      window.location.hash = "#ranglister";
    }
  };

  card.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openGenre();
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openGenre();
  });

  return card;
}

function renderHomeGenres(container) {
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();
  let renderedCount = 0;

  HOME_GENRES.forEach((genre) => {
    let topPodcast = null;
    state.podcasts.forEach((podcast) => {
      const hasMadsRating =
        podcast.ratingValue !== null && podcast.ratingValue !== undefined;
      if (!hasMadsRating || podcast.genre !== genre) return;

      if (!topPodcast || podcast.placement < topPodcast.placement) {
        topPodcast = podcast;
      }
    });

    if (!topPodcast) {
      topPodcast = {
        title: genre,
        host: "",
        publisher: "",
        image: "",
        placement: "",
        ratingLabel: ""
      };
    }

    fragment.appendChild(createHomeGenreCardElement(topPodcast, genre));
    renderedCount += 1;
  });

  if (!renderedCount) {
    container.innerHTML =
      '<div class="empty-state">Genreanbefalinger er p\u00e5 vej.</div>';
    return;
  }

  container.appendChild(fragment);
}

function setHomeHeroCover(container, selector, item) {
  const cover = container?.querySelector(selector);
  const image = cover?.querySelector("img");
  const title = cover?.querySelector(".home-hero__card-title");
  const genre = cover?.querySelector(".home-hero__card-genre");
  const rating = cover?.querySelector(".home-hero__card-rating");

  const imageSources = getPodcastImageSources(item);

  if (!cover || !image || !imageSources.length) {
    if (cover) {
      cover.classList.add("is-hidden");
      cover.disabled = true;
      delete cover.dataset.podcastKey;
      cover.removeAttribute("aria-label");
      cover.removeAttribute("title");
    }
    return;
  }

  const podcastTitle = item.title || "Udvalgt podcast";
  const ratingLabel = item.ratingLabel || "Ikke vurderet";

  cover.classList.remove("is-hidden");
  cover.disabled = false;
  cover.dataset.podcastKey = getPodcastKey(item);
  cover.setAttribute(
    "aria-label",
    `Åbn detaljer om ${podcastTitle}${
      item.ratingLabel ? `, vurderet ${item.ratingLabel}` : ""
    }`
  );
  cover.setAttribute("title", podcastTitle);

  if (title) {
    title.innerHTML = `${escapeHtml(podcastTitle)}${getPodcastAccessIndicatorMarkup(item)}`;
  }
  if (genre) genre.textContent = item.genre || item.publisher || "Podcast";
  if (rating) rating.textContent = ratingLabel;

  loadImageWithFallback(image, imageSources, podcastTitle, {
    onLoad() {
      cover.classList.remove("is-hidden");
      cover.disabled = false;
    },
    onFail() {
      cover.classList.add("is-hidden");
      cover.disabled = true;
    }
  });
}

function createRecentCardElement(podcast) {
  const fragment = elements.recentTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".recent-card");
  const cover = fragment.querySelector(".recent-cover-wrap");
  const title = fragment.querySelector(".recent-title");
  const host = fragment.querySelector(".recent-host");
  const rating = fragment.querySelector(".recent-rating");
  const date = fragment.querySelector(".recent-date");
  const rateButton = fragment.querySelector(".recent-rate-button");
  const favoriteButton = fragment.querySelector(".favorite-button");

  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  title.textContent = podcast.title;
  host.textContent = podcast.host || podcast.publisher || "";
  rating.textContent = podcast.ratingLabel || "Ikke vurderet";
  date.textContent = podcast.ratingDateLabel ? `Bed\u00f8mt ${podcast.ratingDateLabel}` : "";
  renderRateButton(rateButton, getPodcastKey(podcast));
  renderFavoriteButton(favoriteButton, getPodcastKey(podcast));

  card.addEventListener("click", (event) => {
    if (handleMobilePodcastCardOpen(event, podcast, card)) return;
    if (podcast.link) {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    }
  });

  rateButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openRatingDialog(podcast);
  });

  favoriteButton?.addEventListener("click", (event) => {
    handleFavoriteToggle(event, podcast);
  });

  return card;
}

function renderRecent() {
  if (!elements.recentGrid) return;

  const recent = [...state.podcasts]
    .filter((podcast) => podcast.ratingDateObject)
    .sort((a, b) => b.ratingDateObject - a.ratingDateObject)
    .slice(0, 3);

  elements.recentGrid.innerHTML = "";

  if (elements.recentSummary) {
    elements.recentSummary.textContent = `Viser de ${recent.length} seneste bed\u00f8mmelser`;
  }

  const fragment = document.createDocumentFragment();

  recent.forEach((podcast) => {
    fragment.appendChild(createRecentCardElement(podcast));
  });

  elements.recentGrid.appendChild(fragment);
}

function createFilterChip(value, type) {
  const chip = document.createElement("button");
  chip.type = "button";
  chip.className =
    type === "mainSeries"
      ? "podcast-chip podcast-chip--main-series"
      : "podcast-chip";
  chip.textContent = value || "Ukendt";

  if (value && value !== "Ukendt") {
    chip.dataset.action =
      type === "publisher"
        ? "filter-publisher"
        : type === "mainSeries"
          ? "filter-main-series"
          : "filter-genre";
    chip.dataset.value = value;
  }

  return chip;
}

function getMainSeriesTitleParts(podcast) {
  const series = normalizeText(podcast?.mainSeries);
  const title = normalizeText(podcast?.title);

  if (!series) {
    return { series: "", titleText: title };
  }

  const titleLower = title.toLocaleLowerCase("da-DK");
  const seriesPrefix = `${series.toLocaleLowerCase("da-DK")}:`;
  const titleText = titleLower.startsWith(seriesPrefix)
    ? title.slice(series.length + 1).trim()
    : title;

  return {
    series,
    titleText: titleText || title
  };
}

function getMainSeriesTitleMarkup(podcast) {
  const { series, titleText } = getMainSeriesTitleParts(podcast);

  if (!series) {
    return escapeHtml(titleText);
  }

  return `
    <span class="main-series-title-flow">
      <button
        class="main-series-title-link"
        type="button"
        data-action="filter-main-series"
        data-value="${escapeHtml(series)}"
      >${escapeHtml(series)}:</button>${titleText ? ` <span class="main-series-title-text">${escapeHtml(titleText)}</span>` : ""}
    </span>
  `;
}

function getMobileTitleLengthClass(title) {
  const length = normalizeText(title).length;
  if (length > 48) return "is-long-title";
  if (length >= 28) return "is-medium-title";
  return "";
}

function getMobileTitleClassificationText(podcast) {
  const { series, titleText } = getMainSeriesTitleParts(podcast);
  if (!series) return titleText;

  const remainingTitle = normalizeText(titleText);
  return normalizeText(`${series}:${remainingTitle ? ` ${remainingTitle}` : ""}`);
}

function activateMainSeriesFilter(value, { scroll = true } = {}) {
  const series = normalizeText(value);
  if (!series) return;

  state.activeMainSeriesFilter = series;
  resetVisibleCount();
  createGenreChips();

  if (window.location.hash.slice(1).toLowerCase() !== "ranglister") {
    window.location.hash = "#ranglister";
    return;
  }

  render();
  if (scroll) {
    scrollToRankingStart();
  }
}

function populateCardSummaries(article, podcast) {
  const ownerValue = article.querySelector(".rating-summary__value--owner");
  const ownerStars = article.querySelector(".rating-summary__stars--owner");
  const communitySummary = article.querySelector(".rating-summary--community");
  const communityValue = article.querySelector(".rating-summary__value--community");
  const communityStars = article.querySelector(".rating-summary__stars--community");
  const communityMeta = article.querySelector(".rating-summary__meta");
  const communityLabel = article.querySelector(".rating-summary--community .rating-summary__label");
  const userCount = article.querySelector(".podcast-card__user-count");
  const summary = article.querySelector(".podcast-card__summary");
  const mobileScoreTarget = isMobileViewport()
    ? article.querySelector(".podcast-card__top")
    : summary;
  const key = getPodcastKey(podcast);
  const communityStat = getCommunityStat(key);
  const userRating = getUserRating(key);
  let mobileRankingLine = article.querySelector(".podcast-card__mobile-ranking-line");

  if (!mobileRankingLine && mobileScoreTarget) {
    mobileRankingLine = document.createElement("p");
    mobileRankingLine.className = "podcast-card__mobile-ranking-line";
  }

  if (mobileRankingLine) {
    mobileRankingLine.innerHTML = getMobileRankingScoreMarkup(podcast);
    mobileScoreTarget?.appendChild(mobileRankingLine);
  }

  if (isMobileViewport() && userCount) {
    mobileScoreTarget?.appendChild(userCount);
  }

  if (ownerValue) {
    ownerValue.textContent = "/ 10";
  }

  if (ownerStars) {
    const hasOwnerRating = podcast.ratingValue !== null && podcast.ratingValue !== undefined;
    ownerStars.innerHTML = getScoreBadgeMarkup(hasOwnerRating ? podcast.ratingValue : null);
    ownerStars.setAttribute(
      "aria-label",
      hasOwnerRating ? formatRating(podcast.ratingValue) : "Ikke vurderet"
    );
    ownerStars.classList.toggle("is-muted", !hasOwnerRating);
  }

  if (communityLabel) {
    communityLabel.textContent = "Brugernes snit";
  }

  if (communitySummary) {
    delete communitySummary.dataset.userRating;
    communitySummary.dataset.action = "open-rating";
    communitySummary.setAttribute("role", "button");
    communitySummary.setAttribute("tabindex", "0");
    communitySummary.classList.add("is-clickable");

    if (userRating !== null && userRating !== undefined) {
      const userRatingText = `Din vurdering: ${formatRating(userRating)}`;
      communitySummary.dataset.userRating = userRatingText;
      communitySummary.setAttribute(
        "aria-label",
        `Brugernes snit. ${userRatingText}. Tryk for at rette din vurdering.`
      );
    } else if (isLoggedIn()) {
      communitySummary.setAttribute("aria-label", "Brugernes snit. Tryk for at give din vurdering.");
    } else {
      communitySummary.setAttribute("aria-label", "Brugernes snit. Log ind for at give din vurdering.");
    }
  }

  if (communityValue) {
    communityValue.textContent = "/ 10";
  }

  if (communityStars) {
    const hasCommunityRating =
      communityStat?.averageRating !== null && communityStat?.averageRating !== undefined;

    communityStars.innerHTML = getScoreBadgeMarkup(
      hasCommunityRating ? communityStat.averageRating : null
    );
    communityStars.setAttribute(
      "aria-label",
      hasCommunityRating ? formatRating(communityStat.averageRating) : "Ingen endnu"
    );
    communityStars.classList.toggle("is-muted", !hasCommunityRating);
  }

  if (communityMeta) {
    if (communityStat?.ratingCount) {
      communityMeta.textContent = formatUserRatingCount(communityStat.ratingCount);
    } else if (isLoggedIn()) {
      communityMeta.textContent = "Vurder først";
    } else {
      communityMeta.textContent = "Log ind";
    }
  }

  if (userCount) {
    const count = Number(communityStat?.ratingCount || 0);
    const showMobileCommunityCount = state.rankingSource === "users" && count > 0;
    userCount.textContent = showMobileCommunityCount ? formatUserReviewCount(count) : "";
    userCount.classList.toggle("is-hidden", !showMobileCommunityCount);
  }
}

function createPodcastReviewCardElement(podcast, review, key, displayRank = null) {
  const article = document.createElement("article");
  article.className = "podcast-card podcast-card--review";
  article.dataset.key = key;
  const placementDisplay = getPodcastPlacementDisplay(podcast);
  const hasDisplayedPlacement = displayRank !== null || placementDisplay.hasPlacement;
  const displayedPlacement = displayRank ?? placementDisplay.value;
  article.classList.toggle("podcast-card--unranked", !hasDisplayedPlacement);
  if (displayRank !== null) {
    article.dataset.displayRank = String(displayRank);
  }

  const placement = document.createElement("div");
  placement.className = "podcast-card__placement";
  if (hasDisplayedPlacement) {
    placement.innerHTML = `
      <span class="placement-value">#${displayedPlacement}</span>
      <span class="placement-label">${placementDisplay.label}</span>
    `;
  } else {
    placement.classList.add("podcast-card__placement--unranked");
    placement.innerHTML = `
      <span class="placement-value">#---</span>
      <span class="placement-label">${placementDisplay.label}</span>
    `;
  }

  const body = document.createElement("div");
  body.className = "podcast-card__body";

  const head = document.createElement("div");
  head.className = "review-card__head";

  const cover = document.createElement("div");
  cover.className = "review-card__cover";
  cover.innerHTML = `<img alt="" loading="lazy" />`;

  const coverImg = cover.querySelector("img");
  if (review.image || podcast.image) {
    loadImageWithFallback(coverImg, getFeaturedReviewImageSources(review).length ? getFeaturedReviewImageSources(review) : getPodcastImageSources(podcast), review.title || podcast.title || "", {
      onFail() {
        cover.classList.add("has-no-image");
      }
    });
  } else {
    cover.classList.add("has-no-image");
  }

  const headCopy = document.createElement("div");
  headCopy.className = "review-card__head-copy";

  headCopy.innerHTML = `
    <p class="review-card__eyebrow">Podcastlisten anmelder</p>
    <h3 class="review-card__title">${getMainSeriesTitleMarkup({
      ...podcast,
      title: review.title || podcast.title
    })}</h3>
    <p class="review-card__host">${escapeHtml(review.host || podcast.host || "")}</p>
    <p class="review-card__date">${escapeHtml(review.reviewDateLabel || "")}</p>
  `;

  const actions = document.createElement("div");
  actions.className = "review-card__actions";

  const linkButton = document.createElement("button");
  linkButton.className = "podcast-card__link";
  linkButton.type = "button";
  linkButton.textContent = "\u00c5bn link";
  linkButton.dataset.action = "open-link";

  if (!review.link && !podcast.link) {
    linkButton.classList.add("is-hidden");
  }

  const backButton = document.createElement("button");
  backButton.className = "review-card__back";
  backButton.type = "button";
  backButton.textContent = "Tilbage";
  backButton.dataset.action = "close-review";

  actions.append(linkButton, backButton);
  headCopy.appendChild(actions);
  head.append(cover, headCopy);

  const text = document.createElement("p");
  text.className = "review-card__text";
  text.textContent = review.review || "";

  const heading = document.createElement("p");
  heading.className = "review-card__heading";
  heading.textContent = "Vurderet p\u00e5 parametre";

  const params = document.createElement("div");
  params.className = "review-card__params";

  review.params.forEach((param) => {
    const rawValue = normalizeText(param.value);
    if (!rawValue) return;

    const number = parseNumber(rawValue);
    const row = document.createElement("div");
    row.className = "review-card__param";

    const label = document.createElement("span");
    label.className = "review-card__param-name";
    label.textContent = param.label;

    if (number === null) {
      row.classList.add("is-na");

      const value = document.createElement("span");
      value.className = "review-card__param-value";
      value.textContent = rawValue;

      row.append(label, value);
    } else {
      const bar = document.createElement("div");
      bar.className = "review-card__param-bar";

      const fill = document.createElement("span");
      fill.className = "review-card__param-fill";
      fill.style.width = `${Math.max(0, Math.min(100, number * 10))}%`;

      const value = document.createElement("span");
      value.className = "review-card__param-value";
      value.textContent = formatRating(rawValue);

      bar.appendChild(fill);
      row.append(label, bar, value);
    }

    params.appendChild(row);
  });

  body.append(head, text, heading, params);

  const footer = document.createElement("div");
  footer.className = "podcast-card__footer";

  const chips = document.createElement("div");
  chips.className = "podcast-card__chips";

  const publisherChip = createFilterChip(
    review.publisher || podcast.publisher || "Ukendt",
    "publisher"
  );

  const genreChip = createFilterChip(
    review.genre || podcast.genre || "Dokumentar",
    "genre"
  );

  const episodesChip = document.createElement("span");
  episodesChip.className = "podcast-chip podcast-chip--episodes";
  episodesChip.textContent = podcast.episodes || "\u2014";

  chips.append(publisherChip, genreChip, episodesChip);
  footer.appendChild(chips);

  article.append(placement, body, footer);
  return article;
}

function createPodcastCardElement(podcast, displayRank = null) {
  const review = getReviewForPodcast(podcast);
  const key = getPodcastKey(podcast);

  if (review && state.openReviewKeys.has(key)) {
    return createPodcastReviewCardElement(podcast, review, key, displayRank);
  }

  const fragment = elements.podcastTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".podcast-card");
  const placement = fragment.querySelector(".podcast-card__placement");
  const media = fragment.querySelector(".podcast-card__media");
  const cardTop = fragment.querySelector(".podcast-card__top");
  const title = fragment.querySelector(".podcast-card__title");
  const host = fragment.querySelector(".podcast-card__host");
  const description = fragment.querySelector(".podcast-card__description");
  const linkButton = fragment.querySelector(".podcast-card__link");
  const reviewButton = fragment.querySelector(".podcast-card__review");
  const rateButton = fragment.querySelector(".rate-button");
  const favoriteButton = fragment.querySelector(".favorite-button");
  const chips = fragment.querySelector(".podcast-card__chips");
  const newBadge = fragment.querySelector(".podcast-card__new-badge");
  const placementDisplay = getPodcastPlacementDisplay(podcast);
  const hasDisplayedPlacement = displayRank !== null || placementDisplay.hasPlacement;
  const displayedPlacement = displayRank ?? placementDisplay.value;

  article.dataset.key = key;
  article.classList.toggle("podcast-card--unranked", !hasDisplayedPlacement);
  if (displayRank !== null) {
    article.dataset.displayRank = String(displayRank);
  }
  if (isMobileViewport()) {
    article.tabIndex = 0;
    article.setAttribute("role", "button");
    article.setAttribute("aria-label", `Vis detaljer om ${podcast.title}`);
  }

  if (hasDisplayedPlacement) {
    placement.innerHTML = `
      <span class="placement-value">#${displayedPlacement}</span>
      <span class="placement-label">${placementDisplay.label}</span>
    `;
  } else {
    placement.classList.add("podcast-card__placement--unranked");
    placement.innerHTML = `
      <span class="placement-value">#---</span>
      <span class="placement-label">${placementDisplay.label}</span>
    `;
  }

  setImage(media, getPodcastImageSources(podcast), podcast.title);

  const seoPilotRoute = getSeoPilotRoute(podcast);
  if (seoPilotRoute) {
    const titleLink = document.createElement("a");
    titleLink.href = seoPilotRoute;
    titleLink.innerHTML = `${getMainSeriesTitleMarkup(podcast)}${getPodcastAccessIndicatorMarkup(podcast)}`;
    titleLink.style.color = "inherit";
    titleLink.style.textDecoration = "none";
    titleLink.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openPodcastDetailSheet(podcast, article, { allowDesktop: true });
    });
    title.replaceChildren(titleLink);
  } else {
    title.innerHTML = `${getMainSeriesTitleMarkup(podcast)}${getPodcastAccessIndicatorMarkup(podcast)}`;
  }
  title.classList.remove("is-medium-title", "is-long-title");
  const mobileTitleLengthClass = getMobileTitleLengthClass(
    getMobileTitleClassificationText(podcast)
  );
  if (mobileTitleLengthClass) {
    title.classList.add(mobileTitleLengthClass);
  }
  host.textContent = podcast.host || "";
  description.textContent = getPodcastCompactDescription(podcast);

  if (isNewPodcast(podcast)) {
    newBadge.classList.remove("is-hidden");
  }

  linkButton.dataset.action = "open-link";
  if (!podcast.link) {
    linkButton.classList.add("is-hidden");
  }

  if (review && review.review) {
    reviewButton.classList.remove("is-hidden");
    reviewButton.dataset.action = "open-review";
  } else {
    reviewButton.classList.add("is-hidden");
  }

  rateButton.dataset.action = "open-rating";
  renderRateButton(rateButton, key);
  renderFavoriteButton(favoriteButton, key);

  populateCardSummaries(article, podcast);

  const publisherChip = createFilterChip(podcast.publisher || "Ukendt", "publisher");
  const genreChip = createFilterChip(podcast.genre || "Dokumentar", "genre");

  const episodesChip = document.createElement("span");
  episodesChip.className = "podcast-chip podcast-chip--episodes";
  episodesChip.textContent = podcast.episodes || "\u2014";

  chips.append(publisherChip, genreChip, episodesChip);
  return article;
}

function getDesktopRankingDataState() {
  if (!isDesktopRankingViewport()) return { status: "ready" };

  if (state.podcastDataStatus === "error") {
    return {
      status: "error",
      title: "Ranglisten kunne ikke indlæses",
      message: "Podcastdata er ikke tilgængelige lige nu. Prøv at genindlæse siden."
    };
  }

  if (state.podcastDataStatus !== "ready") {
    return {
      status: "loading",
      title: "Indlæser ranglisten",
      message: "Podcastdata gøres klar."
    };
  }

  if (state.rankingSource === "users" && state.communityStatsStatus === "error") {
    return {
      status: "error",
      title: "Brugervurderinger kunne ikke indlæses",
      message: "Ranglisten vises ikke med ufuldstændige vurderinger. Prøv at genindlæse siden."
    };
  }

  if (state.rankingSource === "users" && state.communityStatsStatus !== "ready") {
    return {
      status: "loading",
      title: "Indlæser brugervurderinger",
      message: "Topplaceringerne vises, når vurderingerne er klar."
    };
  }

  return { status: "ready" };
}

function renderDesktopRankingDataState(dataState) {
  if (!elements.podcastGrid) return;

  const isLoading = dataState.status === "loading";
  const container = document.createElement("div");
  container.className = `desktop-ranking-data-state desktop-ranking-data-state--${dataState.status}`;
  container.setAttribute("role", isLoading ? "status" : "alert");
  container.setAttribute("aria-live", isLoading ? "polite" : "assertive");

  const preview = isLoading
    ? `
      <div class="desktop-ranking-data-state__preview" aria-hidden="true">
        ${Array.from({ length: 3 }, () => `
          <span class="desktop-ranking-data-state__card">
            <i></i><b></b><em></em><small></small>
          </span>
        `).join("")}
      </div>
    `
    : "";

  container.innerHTML = `
    ${preview}
    <div class="desktop-ranking-data-state__copy">
      <strong>${escapeHtml(dataState.title)}</strong>
      <span>${escapeHtml(dataState.message)}</span>
    </div>
  `;

  elements.podcastGrid.setAttribute("aria-busy", String(isLoading));
  elements.podcastGrid.appendChild(container);

  if (elements.resultsText) {
    elements.resultsText.textContent = dataState.title;
  }

  updateLoadMoreUi(0, 0);
  disconnectMobileRankingObserver();
  cancelAutoExpandPodcastGrid();
}

function renderPodcastGrid() {
  if (!elements.podcastGrid) return;

  syncDesktopRankingSearchPlacement();
  elements.podcastGrid.innerHTML = "";
  updateDesktopRankingSourceContext();

  const rankingDataState = getDesktopRankingDataState();
  if (rankingDataState.status !== "ready") {
    renderDesktopRankingDataState(rankingDataState);
    return;
  }

  const filtered = getFilteredPodcasts();
  const isMobileTail = isMobileRankingRoute() && state.mobileRankingTailMode;
  const visibleStart = isMobileTail ? Math.max(0, filtered.length - MOBILE_RANKING_TAIL_SIZE) : 0;
  const visible = isMobileTail
    ? filtered.slice(visibleStart)
    : filtered.slice(0, state.visibleCount);

  elements.podcastGrid.setAttribute("aria-busy", "false");

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Ingen podcasts matcher den valgte kombination af filtre.";
    elements.podcastGrid.appendChild(empty);
  } else if (isDesktopRankingViewport()) {
    renderDesktopRanking(visible);
  } else {
    const fragment = document.createDocumentFragment();

    visible.forEach((podcast, index) => {
      fragment.appendChild(createPodcastCardElement(podcast, getRankingDisplayRank(visibleStart + index)));
    });

    elements.podcastGrid.appendChild(fragment);
  }

  if (elements.resultsText) {
    elements.resultsText.textContent = getResultsText(filtered.length, visible.length);
  }

  updateLoadMoreUi(filtered.length, isMobileTail ? filtered.length : visible.length);
  setupMobileRankingAutoLoad(filtered.length, isMobileTail ? filtered.length : visible.length);
  scheduleAutoExpandPodcastGrid(filtered.length, visible.length);
}

function renderFeaturedReview() {
  if (
    !elements.featuredPanel ||
    !elements.featuredTitle ||
    !elements.featuredMeta ||
    !elements.featuredScore ||
    !elements.featuredText ||
    !elements.featuredParams ||
    !elements.featuredDots
  ) {
    return;
  }

  if (!state.featuredReviews.length) {
    elements.featuredPanel.classList.add("is-hidden");
    return;
  }

  const review = state.featuredReviews[state.featuredIndex % state.featuredReviews.length];

  elements.featuredPanel.classList.remove("is-hidden");
  elements.featuredPanel.classList.toggle("is-paused", state.featuredPaused);
  elements.featuredPanel.title = state.featuredPaused
    ? "Rotation er sat p\u00e5 pause. Klik igen for at starte den."
    : "Klik p\u00e5 boksen for at s\u00e6tte rotationen p\u00e5 pause.";
  elements.featuredTitle.textContent = review.title || "";
  elements.featuredMeta.textContent = [review.publisher, review.genre].filter(Boolean).join(" / ");
  elements.featuredScore.textContent = review.scoreLabel || "Ikke vurderet";

  if (elements.featuredDate) {
    elements.featuredDate.textContent = review.reviewDateLabel || "";
  }

  elements.featuredText.textContent = review.review || "";

  if (elements.featuredImage) {
    if (review.image) {
      loadImageWithFallback(elements.featuredImage, getFeaturedReviewImageSources(review), review.title || "");
    } else {
      elements.featuredImage.hidden = true;
      elements.featuredImage.removeAttribute("src");
      elements.featuredImage.alt = "";
    }
  }

  elements.featuredParams.innerHTML = "";

  review.params.forEach((param) => {
    const rawValue = normalizeText(param.value);
    if (!rawValue) return;

    const number = parseNumber(rawValue);
    const row = document.createElement("div");
    row.className = "featured-param";

    const label = document.createElement("span");
    label.className = "featured-param-name";
    label.textContent = param.label;

    if (number === null) {
      row.classList.add("is-na");

      const value = document.createElement("span");
      value.className = "featured-param-value";
      value.textContent = rawValue;

      row.append(label, value);
    } else {
      const bar = document.createElement("div");
      bar.className = "featured-param-bar";

      const fill = document.createElement("span");
      fill.className = "featured-param-fill";
      fill.style.width = `${Math.max(0, Math.min(100, number * 10))}%`;

      const value = document.createElement("span");
      value.className = "featured-param-value";
      value.textContent = formatRating(rawValue);

      bar.appendChild(fill);
      row.append(label, bar, value);
    }

    elements.featuredParams.appendChild(row);
  });

  elements.featuredDots.innerHTML = "";

  state.featuredReviews.forEach((_, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "featured-dot";

    if (index === state.featuredIndex) {
      dot.classList.add("active");
    }

    dot.addEventListener("click", () => {
      showFeaturedReview(index);
    });

    elements.featuredDots.appendChild(dot);
  });
}

function showFeaturedReview(index) {
  if (!state.featuredReviews.length) return;

  const total = state.featuredReviews.length;
  state.featuredIndex = ((index % total) + total) % total;

  renderFeaturedReview();
  if (!state.featuredPaused) {
    restartFeaturedRotation();
  }
}

function showNextFeaturedReview() {
  showFeaturedReview(state.featuredIndex + 1);
}

function showPreviousFeaturedReview() {
  showFeaturedReview(state.featuredIndex - 1);
}

function isFeaturedSwipeEnabled() {
  return (
    window.matchMedia("(max-width: 920px)").matches ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

function setupFeaturedSwipe() {
  if (!elements.featuredPanel) return;

  let startX = 0;
  let startY = 0;
  let startTime = 0;

  elements.featuredPanel.addEventListener(
    "touchstart",
    (event) => {
      if (!isFeaturedSwipeEnabled()) return;
      if (state.featuredReviews.length <= 1) return;

      const touch = event.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
      startTime = Date.now();
    },
    { passive: true }
  );

  elements.featuredPanel.addEventListener(
    "touchend",
    (event) => {
      if (!isFeaturedSwipeEnabled()) return;
      if (state.featuredReviews.length <= 1) return;
      if (!event.changedTouches || !event.changedTouches.length) return;

      const touch = event.changedTouches[0];
      const diffX = touch.clientX - startX;
      const diffY = touch.clientY - startY;
      const elapsed = Date.now() - startTime;

      const isHorizontalSwipe =
        Math.abs(diffX) > 45 &&
        Math.abs(diffX) > Math.abs(diffY) * 1.35 &&
        elapsed < 700;

      if (!isHorizontalSwipe) return;

      if (diffX < 0) {
        showNextFeaturedReview();
      } else {
        showPreviousFeaturedReview();
      }
    },
    { passive: true }
  );
}

function startFeaturedRotation() {
  if (state.featuredTimer) {
    window.clearInterval(state.featuredTimer);
    state.featuredTimer = null;
  }

  if (state.featuredPaused || state.featuredReviews.length <= 1) return;

  state.featuredTimer = window.setInterval(() => {
    state.featuredIndex = (state.featuredIndex + 1) % state.featuredReviews.length;
    renderFeaturedReview();
  }, FEATURED_ROTATION_MS);
}

function restartFeaturedRotation() {
  startFeaturedRotation();
}

function toggleFeaturedPause() {
  if (state.featuredReviews.length <= 1) return;

  state.featuredPaused = !state.featuredPaused;

  if (state.featuredPaused) {
    if (state.featuredTimer) {
      window.clearInterval(state.featuredTimer);
      state.featuredTimer = null;
    }
  } else {
    startFeaturedRotation();
  }

  renderFeaturedReview();
}

function render() {
  const nextRouteInfo = getRouteInfoFromHash();
  const previousRoute = state.currentRoute;
  const previousRawRoute = state.currentRawRoute;
  const routeChanged =
    previousRoute !== nextRouteInfo.route || previousRawRoute !== nextRouteInfo.rawRoute;
  const mainRouteChanged = previousRoute && previousRoute !== nextRouteInfo.route;

  if (routeChanged) {
    hidePodcastAccessTooltip();
  }

  if (mainRouteChanged) {
    resetVisualZoomForMainRouteChange();
  }

  if (routeChanged && previousRoute === "ranglister" && nextRouteInfo.route !== "ranglister") {
    if (state.rankingUsedGoToBottom) {
      state.rankingScrollY = 0;
      resetVisibleCount();
      elements.podcastGrid?.replaceChildren();
      state.rankingUsedGoToBottom = false;
    } else {
      if (!state.rankingScrollPositionCaptured) {
        saveRankingScrollPosition();
      }
    }
    state.rankingScrollPositionCaptured = false;
    disconnectMobileRankingObserver();
  }

  if (routeChanged && nextRouteInfo.route === "ranglister" && isMobileViewport()) {
    state.mobileRankingFiltersOpen = false;
    resetVisibleCount();
  }

  if (nextRouteInfo.route === "ranglister") {
    consumePendingRankingGenre();
  }

  resolveRankingSourceForRoute(nextRouteInfo.route);

  renderAuthPanel();
  updateActiveFilterUi();
  updateSortToggleUi();
  updateRatingFilterUi();
  updateMobileRankingFilterUi();
  const renderedRoute = renderRoute();
  updateRankingSourceUi();

  if (document.body.classList.contains("page-ranglister")) {
    renderRecent();
    renderPodcastGrid();
    renderFeaturedReview();
  }

  updateRankingScrollToBottomButton();

  if (!renderedRoute) return;

  state.currentRoute = renderedRoute;
  state.currentRawRoute = nextRouteInfo.rawRoute;

  if (routeChanged && renderedRoute === "forside") {
    scrollWindowToTop();
  }

  if (!routeChanged) return;

  if (renderedRoute === "ranglister" && previousRoute && previousRoute !== "ranglister") {
    restoreRankingScrollPosition();
    return;
  }

  if (
    ["forside", "udforsk", "profil", "moderator"].includes(renderedRoute) &&
    nextRouteInfo.rawRoute !== "profil-gemte"
  ) {
    scrollWindowToTop();
  }
}

function createProfilePodcastCardElement(podcast, badgeText, badgeTone = "neutral") {
  const card = document.createElement("article");
  card.className = "profile-podcast-card";
  card.setAttribute("role", "button");
  card.tabIndex = 0;
  card.setAttribute("aria-label", `Vis detaljer for ${podcast.title}`);

  const cover = document.createElement("div");
  cover.className = "profile-podcast-card__cover";

  const image = document.createElement("img");
  image.className = "profile-podcast-card__image";
  image.loading = "lazy";

  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder profile-podcast-card__placeholder";
  placeholder.textContent = "Billede mangler";
  placeholder.hidden = true;

  cover.append(image, placeholder);
  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  const meta = [podcast.host || podcast.publisher, podcast.genre].filter(Boolean).join(" / ");
  const copy = document.createElement("div");
  copy.className = "profile-podcast-card__copy";
  copy.innerHTML = `
    <h3>${escapeHtml(podcast.title)}</h3>
    <p>${escapeHtml(meta)}</p>
  `;

  const badge = document.createElement("strong");
  badge.className = `profile-podcast-card__badge profile-podcast-card__badge--${badgeTone}`;
  if (badgeTone === "rating") {
    badge.innerHTML = `
      <span class="profile-rating-number">${escapeHtml(badgeText)}</span>
      <span class="profile-rating-scale">/ 10</span>
    `;
  } else {
    badge.textContent = badgeText;
  }
  badge.setAttribute("role", "button");
  badge.tabIndex = 0;
  badge.setAttribute("aria-label", `Vurder ${podcast.title}`);
  badge.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openRatingDialog(podcast);
  });
  badge.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    event.stopPropagation();
    openRatingDialog(podcast);
  });

  card.append(cover, copy, badge);
  card.addEventListener("click", (event) => {
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  });
  return card;
}

function getProfileRatedPodcasts() {
  const ratedPodcasts = Object.entries(state.userRatingsByKey)
    .map(([key, rating]) => ({ podcast: state.podcastByKey[key], rating }))
    .filter((item) => item.podcast);

  if (state.profileRatingsSort === "score-low") {
    return ratedPodcasts.sort(
      (a, b) =>
        (parseNumber(a.rating) ?? 0) - (parseNumber(b.rating) ?? 0) ||
        a.podcast.title.localeCompare(b.podcast.title, "da", { sensitivity: "base" })
    );
  }

  if (state.profileRatingsSort === "score") {
    return ratedPodcasts.sort(
      (a, b) =>
        (parseNumber(b.rating) ?? 0) - (parseNumber(a.rating) ?? 0) ||
        a.podcast.title.localeCompare(b.podcast.title, "da", { sensitivity: "base" })
    );
  }

  return ratedPodcasts.sort((a, b) =>
    a.podcast.title.localeCompare(b.podcast.title, "da", { sensitivity: "base" })
  );
}

function getSavedPodcasts() {
  return Array.from(state.savedPodcastKeys)
    .map((key) => state.podcastByKey[key])
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title, "da", { sensitivity: "base" }));
}

function getRecentlySavedPodcasts(limit = 3) {
  return getRecentlySavedPodcastEntries()
    .slice(0, limit)
    .map((item) => item.podcast);
}

function getRecentlySavedPodcastEntries() {
  return Array.from(state.savedPodcastKeys)
    .map((key) => {
      const savedAt = Date.parse(state.savedPodcastMetaByKey[key]?.savedAt || "");
      return {
        key,
        podcast: state.podcastByKey[key],
        savedAt,
        hasSavedAt: Number.isFinite(savedAt)
      };
    })
    .filter((item) => item.podcast)
    .sort((a, b) => {
      if (a.hasSavedAt !== b.hasSavedAt) return a.hasSavedAt ? -1 : 1;
      if (b.savedAt !== a.savedAt) return b.savedAt - a.savedAt;
      return a.podcast.title.localeCompare(b.podcast.title, "da", { sensitivity: "base" });
    });
}

function bindAuthPromptButtons(container) {
  container?.querySelectorAll("[data-auth-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      showAuthPrompt(button.dataset.authPrompt === "login" ? "login" : "signup");
    });
  });
}

function clearUserScopedState({ clearUi = false } = {}) {
  state.userRatingsByKey = {};
  state.savedPodcastKeys = new Set();
  state.savedPodcastMetaByKey = {};
  Object.values(state.podcastEpisodesByKey).forEach((episodeState) => {
    episodeState.userRatingsById = {};
    episodeState.userRatingLoadingIds = new Set();
  });
  state.episodeParentRatingSyncSignatures = {};
  state.episodeParentRatingSyncPendingKeys = new Set();
  resetProfileEpisodeRatingsState();
  state.profileSuggestions = [];
  state.profileSuggestionsLoadedFor = null;
  state.profileSuggestionsLoading = false;
  state.profileSuggestionsError = "";
  state.suggestionNotificationTarget = null;
  state.adminPodcastSuggestions = [];
  state.adminPodcastSuggestionsLoadedFor = null;
  state.adminPodcastSuggestionsLoading = false;
  state.adminPodcastSuggestionsError = "";
  state.adminPodcastSuggestionsFeedback = "";
  state.adminPodcastSuggestionsFeedbackIsError = false;
  state.adminPodcastSuggestionFilter = "new";
  state.adminPodcastSuggestionNoteDrafts = new Map();
  state.adminPodcastSuggestionCatalogueDrafts = new Map();
  state.podcastSuggestionStatusPendingIds = new Set();
  if (clearUi) {
    state.activeRatingKey = null;
    state.activeEpisodeRatingId = null;
    state.ratingDialogMode = "podcast";
    state.exploreSuggestionDialogOpen = false;
  }
  state.rankingListCache.clear();
  state.rankingListCacheVersion += 1;
}

function getSuggestionDialogMarkup(titleId = "podcastSuggestionTitle") {
  return `
    <div class="explore-suggestion-dialog is-hidden" data-explore-suggest-dialog aria-hidden="true">
      <div class="explore-suggestion-dialog__backdrop" data-explore-suggest-close></div>
      <div
        class="explore-suggestion-dialog__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="${titleId}"
      >
        <header class="explore-suggestion-dialog__header">
          <button
            class="explore-suggestion-dialog__close"
            type="button"
            aria-label="Luk forslag"
            data-explore-suggest-close
          >
            &times;
          </button>
          <p class="explore-eyebrow">Podcastforslag</p>
          <h2 id="${titleId}" data-explore-suggest-title>Foresl&aring; podcast</h2>
          <p class="explore-suggestion-dialog__intro" data-explore-suggest-intro>Send en podcast til manuel gennemgang.</p>
        </header>
        <form class="explore-suggestion-form" data-explore-suggest-form novalidate>
          <div class="explore-suggestion-form__body">
            <label>
              <span>Podcasttitel *</span>
              <input name="title" type="text" autocomplete="off" required />
            </label>
            <label>
              <span>Link til podcast</span>
              <input name="podcast_url" type="url" placeholder="https://..." autocomplete="url" />
            </label>
            <label>
              <span>Platform/udbyder</span>
              <input name="platform" type="text" autocomplete="organization" />
            </label>
            <label>
              <span>Kort kommentar</span>
              <textarea name="comment" rows="3"></textarea>
            </label>
            <p class="explore-suggestion-message is-hidden" data-explore-suggest-message aria-live="polite"></p>
          </div>
          <footer class="explore-suggestion-form__footer">
            <div class="explore-suggestion-form__actions">
              <button class="auth-button auth-button--secondary" type="button" data-explore-suggest-close>
                Annuller
              </button>
              <button class="auth-button auth-button--primary" type="submit" data-explore-suggest-submit>
                Send forslag
              </button>
            </div>
          </footer>
        </form>
        <div class="explore-suggestion-success is-hidden" data-explore-suggest-success>
          <h3 data-explore-suggest-success-title>Tak for forslaget!</h3>
          <p data-explore-suggest-success-copy>Vi kigger p&aring; den.</p>
          <button class="auth-button auth-button--primary" type="button" data-explore-suggest-close>
            Luk
          </button>
        </div>
      </div>
    </div>
  `;
}

function bindSuggestionDialog(container) {
  const suggestionDialog = container?.querySelector("[data-explore-suggest-dialog]");
  const suggestionForm = container?.querySelector("[data-explore-suggest-form]");
  const suggestionMessage = container?.querySelector("[data-explore-suggest-message]");
  const suggestionSuccess = container?.querySelector("[data-explore-suggest-success]");
  const suggestionTitle = container?.querySelector("[data-explore-suggest-title]");
  const suggestionIntro = container?.querySelector("[data-explore-suggest-intro]");
  const suggestionSubmit = container?.querySelector("[data-explore-suggest-submit]");

  if (!suggestionDialog) return;

  const closeSuggestionDialog = () => {
    state.exploreSuggestionDialogOpen = false;
    state.activeSuggestionEditId = null;
    suggestionDialog.classList.add("is-hidden");
    suggestionDialog.setAttribute("aria-hidden", "true");
    document.body.classList.remove("has-suggestion-dialog-open");
    if (
      elements.authDialog?.classList.contains("is-hidden") &&
      elements.ratingDialog?.classList.contains("is-hidden")
    ) {
      document.body.classList.remove("has-dialog-open");
    }
    if (document.body.classList.contains("page-profil")) {
      renderProfilePage();
    }
  };

  const openSuggestionDialog = (suggestion = null) => {
    if (!isLoggedIn()) {
      state.pendingAuthAction = {
        type: "suggestion",
        route: window.location.hash || "#udforsk"
      };
      showAuthPrompt("login");
      setAuthMessage("Log ind for at sende podcastforslag.", "warning", "dialog");
      return;
    }

    setSuggestionMessage(suggestionMessage, "");
    state.exploreSuggestionDialogOpen = true;
    state.activeSuggestionEditId = suggestion?.id || null;
    if (suggestionForm) {
      suggestionForm.hidden = false;
      suggestionForm.reset();
      const titleField = suggestionForm.querySelector("[name='title']");
      const urlField = suggestionForm.querySelector("[name='podcast_url']");
      const platformField = suggestionForm.querySelector("[name='platform']");
      const commentField = suggestionForm.querySelector("[name='comment']");
      if (titleField) titleField.value = suggestion?.title || "";
      if (urlField) urlField.value = suggestion?.podcast_url || "";
      if (platformField) platformField.value = suggestion?.platform || "";
      if (commentField) commentField.value = suggestion?.comment || "";
    }
    if (suggestionTitle) {
      suggestionTitle.textContent = suggestion ? "Rediger podcastforslag" : "Foresl\u00e5 podcast";
    }
    if (suggestionIntro) {
      suggestionIntro.textContent = suggestion
        ? "Ret dit forslag og gem \u00e6ndringerne."
        : "Send en podcast til manuel gennemgang.";
    }
    if (suggestionSubmit) {
      suggestionSubmit.textContent = suggestion ? "Gem \u00e6ndringer" : "Send forslag";
    }
    suggestionSuccess?.classList.add("is-hidden");
    suggestionDialog.classList.remove("is-hidden");
    suggestionDialog.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-dialog-open", "has-suggestion-dialog-open");
    suggestionForm?.querySelector("[name='title']")?.focus();
  };

  container.querySelectorAll("[data-explore-suggest-open]").forEach((button) => {
    if (button.dataset.suggestionOpenBound === "true") return;
    button.dataset.suggestionOpenBound = "true";
    button.addEventListener("click", () => openSuggestionDialog());
  });

  container.querySelectorAll("[data-profile-suggestion-edit]").forEach((button) => {
    if (button.dataset.suggestionEditBound === "true") return;
    button.dataset.suggestionEditBound = "true";
    button.addEventListener("click", () => {
      const suggestion = getProfileSuggestionById(button.dataset.profileSuggestionEdit);
      if (suggestion) {
        openSuggestionDialog(suggestion);
      }
    });
  });

  container.querySelectorAll("[data-explore-suggest-close]").forEach((button) => {
    if (button.dataset.suggestionCloseBound === "true") return;
    button.dataset.suggestionCloseBound = "true";
    button.addEventListener("click", closeSuggestionDialog);
  });

  if (suggestionForm && suggestionForm.dataset.suggestionSubmitBound !== "true") {
    suggestionForm.dataset.suggestionSubmitBound = "true";
    suggestionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitPodcastSuggestion(suggestionForm, suggestionMessage);
    });
  }

  if (state.exploreSuggestionDialogOpen && isLoggedIn()) {
    window.setTimeout(openSuggestionDialog, 0);
  }
}

function getSuggestionStatusLabel(status) {
  const normalized = normalizeComparable(status);
  const labels = {
    new: "Afventer",
    approved: "Godkendt",
    reviewed: "Gennemg\u00e5et",
    added: "Tilf\u00f8jet",
    rejected: "Afvist",
    duplicate: "Findes allerede"
  };
  return labels[normalized] || "Afventer";
}

function findPodcastForSuggestion(suggestion) {
  const suggestionKey = normalizeMatchKey(suggestion?.title);
  if (!suggestionKey) return null;
  return state.podcastByKey[suggestionKey] || null;
}

function getSuggestionMatchMarkup(suggestion) {
  const matchedPodcast = findPodcastForSuggestion(suggestion);

  if (!matchedPodcast) {
    return `
      <div class="profile-suggestion-card__match">
        <span class="profile-suggestion-badge profile-suggestion-badge--muted">Ikke tilf&oslash;jet endnu</span>
        <p>Afventer tilf&oslash;jelse</p>
      </div>
    `;
  }

  const communityStat = getCommunityStat(getPodcastKey(matchedPodcast));
  const scoreParts = [];
  const userRating = hasCommunityRating(communityStat)
    ? formatCompactRating(communityStat.averageRating)
    : "";
  const madsRating = formatCompactRating(matchedPodcast.ratingValue);

  if (userRating) {
    scoreParts.push(`Brugere ${escapeHtml(userRating)}`);
  }

  if (madsRating) {
    scoreParts.push(`Podcastlisten ${escapeHtml(madsRating)}`);
  }

  return `
    <div class="profile-suggestion-card__match">
      <span class="profile-suggestion-badge profile-suggestion-badge--success">P&aring; siden</span>
      <p>${scoreParts.length ? scoreParts.join(" &middot; ") : "Ingen vurdering endnu"}</p>
    </div>
  `;
}

function createProfileSuggestionCardElement(suggestion) {
  const card = document.createElement("article");
  card.className = "profile-suggestion-card";
  card.dataset.suggestionId = suggestion.id || "";

  const statusLabel = getSuggestionStatusLabel(suggestion.status);
  const submittedDate = formatDate(suggestion.created_at);
  const linkMarkup = suggestion.podcast_url
    ? `<a href="${escapeHtml(suggestion.podcast_url)}" target="_blank" rel="noopener noreferrer">Podcastlink</a>`
    : "";
  const platformMarkup = suggestion.platform
    ? `<p><strong>Platform:</strong> ${escapeHtml(suggestion.platform)}</p>`
    : "";
  const commentMarkup = suggestion.comment
    ? `<p><strong>Kommentar:</strong> ${escapeHtml(suggestion.comment)}</p>`
    : "";
  const linkedPodcast =
    normalizeComparable(suggestion.status) === "approved"
      ? findPodcastByCatalogueId(suggestion.catalogue_podcast_id)
      : null;
  const reviewedDate = formatSuggestionDateTime(suggestion.reviewed_at);
  const responseMarkup = normalizeText(suggestion.admin_note)
    ? `<section class="profile-suggestion-card__response"><strong>Svar fra Podcastlisten</strong><p>${escapeHtml(suggestion.admin_note)}</p></section>`
    : "";

  card.innerHTML = `
    <header class="profile-suggestion-card__header">
      <div>
        <h3>${escapeHtml(suggestion.title || "Podcast uden titel")}</h3>
        <p>Indsendt${submittedDate ? `: ${escapeHtml(submittedDate)}` : ""}</p>
      </div>
      <span class="profile-suggestion-badge">${escapeHtml(statusLabel)}</span>
    </header>
    <div class="profile-suggestion-card__meta">
      ${linkMarkup}
      ${platformMarkup}
      ${commentMarkup}
    </div>
    ${reviewedDate ? `<p class="profile-suggestion-card__reviewed">Behandlet: ${escapeHtml(reviewedDate)}</p>` : ""}
    ${responseMarkup}
    ${linkedPodcast ? `<div class="profile-suggestion-card__actions"><button class="profile-button profile-button--quiet" type="button" data-suggestion-open-podcast="${escapeHtml(linkedPodcast.catalogueId)}">Se podcast</button></div>` : ""}
  `;

  return card;
}

function renderProfileSuggestionsSectionContent(container = document) {
  const suggestionsContainer = container.querySelector("[data-profile-suggestions]");
  if (!suggestionsContainer) return;

  const suggestionsLoaded = state.profileSuggestionsLoadedFor === state.authUser?.id;
  const countValue = suggestionsLoaded ? String(state.profileSuggestions.length) : "–";

  document.querySelectorAll("[data-profile-suggestions-stat-count]").forEach((element) => {
    element.textContent = countValue;
  });

  container.querySelectorAll("[data-profile-suggestions-count]").forEach((element) => {
    element.textContent = suggestionsLoaded ? String(state.profileSuggestions.length) : "";
  });

  suggestionsContainer.replaceChildren();

  if (!suggestionsLoaded) {
    suggestionsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Indl&aelig;ser dine podcastforslag&hellip;</h3>
        <p>Vi henter de forslag, du har sendt ind.</p>
      </div>
    `;
  } else if (state.profileSuggestionsError) {
    suggestionsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Podcastforslag kunne ikke hentes</h3>
        <p>${escapeHtml(state.profileSuggestionsError)}</p>
      </div>
    `;
  } else if (state.profileSuggestions.length) {
    const suggestionsFragment = document.createDocumentFragment();
    state.profileSuggestions.forEach((suggestion) => {
      suggestionsFragment.appendChild(createProfileSuggestionCardElement(suggestion));
    });
    suggestionsContainer.appendChild(suggestionsFragment);
  } else {
    suggestionsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Du har ikke foresl&aring;et podcasts endnu.</h3>
        <p>Foresl&aring; en podcast, hvis der mangler en p&aring; listen.</p>
        <button class="profile-button profile-button--quiet" type="button" data-explore-suggest-open>
          Foresl&aring; podcast
        </button>
      </div>
    `;
  }

  const suggestionsExpandButton = container.querySelector("[data-profile-expand='suggestions']");
  if (suggestionsExpandButton) {
    suggestionsExpandButton.hidden = !suggestionsLoaded || state.profileSuggestions.length <= 3;
  }

  const profilePage = container.closest(".profile-page") || container;
  bindSuggestionDialog(profilePage);
  container.querySelectorAll("[data-suggestion-open-podcast]").forEach((button) => {
    button.addEventListener("click", () => {
      const podcast = findPodcastByCatalogueId(button.dataset.suggestionOpenPodcast);
      if (!podcast) return;
      openPodcastDetailSheet(podcast, button, { allowDesktop: true });
    });
  });

  window.requestAnimationFrame(revealSuggestionNotificationTarget);

}

async function fetchProfileSuggestions() {
  if (!state.supabase || !state.authUser || state.profileSuggestionsLoading) return;

  const userId = state.authUser.id;
  state.profileSuggestionsLoading = true;
  state.profileSuggestionsError = "";

  try {
    let { data, error } = await state.supabase
      .from("podcast_suggestions")
      .select("id, title, podcast_url, platform, comment, status, created_at, reviewed_at, admin_note, catalogue_podcast_id, user_seen_response_at")
      .eq("suggested_by_user_id", userId)
      .order("created_at", { ascending: false });

    if (error && normalizeText(error.message).toLowerCase().includes("catalogue_podcast_id")) {
      ({ data, error } = await state.supabase
        .from("podcast_suggestions")
        .select("id, title, podcast_url, platform, comment, status, created_at, reviewed_at, admin_note, user_seen_response_at")
        .eq("suggested_by_user_id", userId)
        .order("created_at", { ascending: false }));
    }

    if (error) throw error;

    state.profileSuggestions = data || [];
    state.profileSuggestionsLoadedFor = userId;
    renderSuggestionNotificationBadges();
  } catch (error) {
    console.error(error);
    state.profileSuggestions = [];
    state.profileSuggestionsLoadedFor = userId;
    state.profileSuggestionsError =
      "Dine podcastforslag kunne ikke hentes lige nu.";
  } finally {
    state.profileSuggestionsLoading = false;
    if (document.body.classList.contains("page-profil")) {
      const suggestionsSection = document.getElementById("profileSuggestions");
      if (suggestionsSection) {
        renderProfileSuggestionsSectionContent(suggestionsSection);
      } else {
        renderProfilePage();
      }
    }
  }
}

function getAdminSuggestionSortRank(suggestion) {
  const status = normalizeComparable(suggestion?.status);
  return status === "new" ? 0 : status === "approved" ? 1 : 2;
}

function getAdminSuggestionFilterLabel(filter) {
  return { new: "Nye", all: "Alle", approved: "Godkendte", rejected: "Afviste" }[filter] || "Nye";
}

function formatSuggestionDateTime(value) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
  }).format(date);
}

function renderAdminPodcastSuggestionsSectionContent(container = document) {
  const suggestionsContainer = container.querySelector("[data-admin-podcast-suggestions]");
  if (!suggestionsContainer || !isPodcastSuggestionAdmin()) return;

  const loaded = state.adminPodcastSuggestionsLoadedFor === state.authUser?.id;
  suggestionsContainer.replaceChildren();

  if (!loaded) {
    suggestionsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Indl&aelig;ser podcastforslag&hellip;</h3>
      </div>
    `;
    return;
  }

  if (state.adminPodcastSuggestionsError) {
    suggestionsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Podcastforslag kunne ikke hentes</h3>
        <p>${escapeHtml(state.adminPodcastSuggestionsError)}</p>
      </div>
    `;
    return;
  }

  if (!state.adminPodcastSuggestions.length) {
    suggestionsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Ingen podcastforslag endnu</h3>
      </div>
    `;
    return;
  }

  const validFilters = new Set(["new", "all", "approved", "rejected"]);
  const activeFilter = validFilters.has(state.adminPodcastSuggestionFilter)
    ? state.adminPodcastSuggestionFilter
    : "new";
  const counts = state.adminPodcastSuggestions.reduce((result, suggestion) => {
    const status = normalizeComparable(suggestion?.status) || "new";
    result.all += 1;
    if (Object.hasOwn(result, status)) result[status] += 1;
    return result;
  }, { all: 0, new: 0, approved: 0, rejected: 0 });
  const visibleSuggestions = state.adminPodcastSuggestions
    .filter((suggestion) => activeFilter === "all" || normalizeComparable(suggestion?.status) === activeFilter);

  suggestionsContainer.innerHTML = `
    <div class="profile-suggestion-admin-filters" role="group" aria-label="Filtrer podcastforslag">
      ${["new", "all", "approved", "rejected"].map((filter) => `
        <button type="button" class="profile-suggestion-admin-filter${filter === activeFilter ? " is-active" : ""}" data-admin-suggestion-filter="${filter}" aria-pressed="${filter === activeFilter}">
          ${escapeHtml(getAdminSuggestionFilterLabel(filter))} <span>${counts[filter]}</span>
        </button>`).join("")}
    </div>
    ${state.adminPodcastSuggestionsFeedback ? `<p class="profile-suggestion-admin-feedback${state.adminPodcastSuggestionsFeedbackIsError ? " is-error" : ""}" role="status">${escapeHtml(state.adminPodcastSuggestionsFeedback)}</p>` : ""}
  `;

  if (!visibleSuggestions.length) {
    suggestionsContainer.insertAdjacentHTML("beforeend", `<div class="profile-empty-state"><h3>Ingen ${escapeHtml(getAdminSuggestionFilterLabel(activeFilter).toLowerCase())} forslag</h3></div>`);
  }

  const fragment = document.createDocumentFragment();
  visibleSuggestions
    .sort(
      (a, b) =>
        getAdminSuggestionSortRank(a) - getAdminSuggestionSortRank(b) ||
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
    )
    .forEach((suggestion) => {
      const card = document.createElement("article");
      const status = normalizeComparable(suggestion.status) || "new";
      const pending = state.podcastSuggestionStatusPendingIds.has(suggestion.id);
      const submittedDate = formatSuggestionDateTime(suggestion.created_at);
      const reviewedDate = formatSuggestionDateTime(suggestion.reviewed_at);
      const savedNote = state.adminPodcastSuggestionNoteDrafts.has(suggestion.id)
        ? state.adminPodcastSuggestionNoteDrafts.get(suggestion.id)
        : suggestion.admin_note || "";
      const linkMarkup = suggestion.podcast_url
        ? `<a href="${escapeHtml(suggestion.podcast_url)}" target="_blank" rel="noopener noreferrer">Åbn podcastlink</a>`
        : "";
      const platformMarkup = suggestion.platform
        ? `<p><strong>Platform:</strong> ${escapeHtml(suggestion.platform)}</p>`
        : "";
      const commentMarkup = suggestion.comment
        ? `<p><strong>Kommentar:</strong> ${escapeHtml(suggestion.comment)}</p>`
        : "";
      const decisionMarkup = status === "new"
        ? `
          <label class="profile-suggestion-admin-note">
            <span>Intern note (valgfri)</span>
            <textarea rows="2" data-admin-suggestion-note placeholder="Kun synlig for moderatorer" ${pending ? "disabled" : ""}>${escapeHtml(savedNote)}</textarea>
          </label>
          <div class="profile-suggestion-card__actions" aria-label="Moderation">
            <button class="profile-suggestion-action profile-suggestion-action--approve" type="button" data-admin-suggestion-status="approved" ${pending ? "disabled" : ""}>${pending ? "Gemmer..." : "Godkend"}</button>
            <button class="profile-suggestion-action profile-suggestion-action--reject" type="button" data-admin-suggestion-status="rejected" ${pending ? "disabled" : ""}>${pending ? "Gemmer..." : "Afvis"}</button>
          </div>`
        : `
          <div class="profile-suggestion-admin-decision">
            <p><strong>Besluttet:</strong> ${reviewedDate ? escapeHtml(reviewedDate) : "Tidspunkt ikke tilg&aelig;ngeligt"}</p>
            <p><strong>Behandlet af:</strong> ${suggestion.reviewed_by_user_id ? "Moderator" : "Ikke oplyst"}</p>
            ${suggestion.admin_note ? `<p><strong>Intern note:</strong> ${escapeHtml(suggestion.admin_note)}</p>` : ""}
          </div>`;

      card.className = "profile-suggestion-card profile-suggestion-card--admin";
      card.dataset.suggestionId = suggestion.id || "";
      card.innerHTML = `
        <header class="profile-suggestion-card__header">
          <div>
            <h3>${escapeHtml(suggestion.title || "Podcast uden titel")}</h3>
            <p>${suggestion.suggested_by_email ? `Indsendt af ${escapeHtml(suggestion.suggested_by_email)}` : "Indsendt uden email"}${submittedDate ? ` · ${escapeHtml(submittedDate)}` : ""}</p>
          </div>
          <span class="profile-suggestion-badge">${escapeHtml(getSuggestionStatusLabel(status))}</span>
        </header>
        <div class="profile-suggestion-card__meta">
          ${linkMarkup}
          ${platformMarkup}
          ${commentMarkup}
        </div>
        ${decisionMarkup}
        <div class="profile-suggestion-card__actions profile-suggestion-card__actions--legacy" aria-label="Moderation">
          <button class="profile-suggestion-action profile-suggestion-action--approve" type="button" data-admin-suggestion-status="approved" ${pending || status === "approved" ? "disabled" : ""}>
            ${pending ? "Gemmer…" : "Godkend"}
          </button>
          <button class="profile-suggestion-action profile-suggestion-action--reject" type="button" data-admin-suggestion-status="rejected" ${pending || status === "rejected" ? "disabled" : ""}>
            ${pending ? "Gemmer…" : "Afvis"}
          </button>
        </div>
      `;
      fragment.appendChild(card);
    });

  suggestionsContainer.appendChild(fragment);
  suggestionsContainer.querySelectorAll("[data-admin-suggestion-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      state.adminPodcastSuggestionFilter = button.dataset.adminSuggestionFilter || "new";
      state.adminPodcastSuggestionsFeedback = "";
      state.adminPodcastSuggestionsFeedbackIsError = false;
      renderAdminPodcastSuggestionsSectionContent(container);
    });
  });
  suggestionsContainer.querySelectorAll("[data-admin-suggestion-note]").forEach((field) => {
    field.addEventListener("input", () => {
      const suggestionId = field.closest("[data-suggestion-id]")?.dataset.suggestionId;
      if (suggestionId) state.adminPodcastSuggestionNoteDrafts.set(suggestionId, field.value);
    });
  });
  suggestionsContainer.querySelectorAll("[data-admin-suggestion-status]").forEach((button) => {
    button.addEventListener("click", () => {
      const card = button.closest("[data-suggestion-id]");
      updatePodcastSuggestionStatus(
        card?.dataset.suggestionId,
        button.dataset.adminSuggestionStatus,
        card?.querySelector("[data-admin-suggestion-note]")?.value || ""
      );
    });
  });
}

function getAdminPodcastSuggestionCounts() {
  return state.adminPodcastSuggestions.reduce((result, suggestion) => {
    const status = normalizeComparable(suggestion?.status) || "new";
    result.all += 1;
    if (Object.hasOwn(result, status)) result[status] += 1;
    return result;
  }, { all: 0, new: 0, approved: 0, rejected: 0 });
}

function renderAdminPodcastSuggestionsPreview(container = document) {
  const preview = container.querySelector("[data-admin-podcast-preview]");
  if (!preview || !isPodcastSuggestionAdmin()) return;
  const loaded = state.adminPodcastSuggestionsLoadedFor === state.authUser?.id;

  if (!loaded) {
    preview.innerHTML = `<p class="moderator-preview__loading">Indl&aelig;ser forslag&hellip;</p>`;
    return;
  }
  if (state.adminPodcastSuggestionsError) {
    preview.innerHTML = `<p class="moderator-preview__loading">Podcastforslag kunne ikke hentes lige nu.</p>`;
    return;
  }

  const counts = getAdminPodcastSuggestionCounts();
  const newest = state.adminPodcastSuggestions
    .filter((suggestion) => (normalizeComparable(suggestion?.status) || "new") === "new")
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 3);
  preview.innerHTML = `
    <p class="moderator-preview__count"><strong>${counts.new}</strong> nye ${counts.new === 1 ? "forslag" : "forslag"}</p>
    ${newest.length ? `<div class="moderator-preview__list">${newest.map((suggestion) => `
      <article class="moderator-preview__item">
        <div><strong>${escapeHtml(suggestion.title || "Podcast uden titel")}</strong><span>${escapeHtml(formatDate(suggestion.created_at) || "Dato ikke tilgængelig")}</span></div>
        <span class="moderator-status-badge moderator-status-badge--new">Afventer</span>
      </article>`).join("")}</div>` : `<p class="moderator-preview__empty">Ingen nye podcastforslag.</p>`}
    <a class="moderator-preview__open" href="#moderator">&Aring;bn moderatorpanel</a>
  `;
}

function renderModeratorPage() {
  const container = elements.pageIntroPanel;
  if (!container) return;
  container.classList.remove("is-hidden");

  if (!isPodcastSuggestionAdmin()) {
    container.innerHTML = `
      <section class="moderator-page moderator-page--denied">
        <p class="profile-eyebrow">Administration</p>
        <h1>Adgang ikke tilladt</h1>
        <p>Moderatorpanelet er kun tilgængeligt for godkendte moderatorer.</p>
        <a class="moderator-page__back" href="#profil">Tilbage til profil</a>
      </section>`;
    return;
  }

  const loaded = state.adminPodcastSuggestionsLoadedFor === state.authUser?.id;
  const counts = getAdminPodcastSuggestionCounts();
  const activeFilter = new Set(["new", "all", "approved", "rejected"]).has(state.adminPodcastSuggestionFilter)
    ? state.adminPodcastSuggestionFilter
    : "new";
  const emptyText = {
    new: "Ingen nye podcastforslag.",
    approved: "Ingen godkendte forslag endnu.",
    rejected: "Ingen afviste forslag endnu.",
    all: "Ingen podcastforslag endnu."
  };
  const visibleSuggestions = state.adminPodcastSuggestions
    .filter((suggestion) => activeFilter === "all" || (normalizeComparable(suggestion?.status) || "new") === activeFilter)
    .sort((a, b) => {
      const aStatus = normalizeComparable(a?.status) || "new";
      const bStatus = normalizeComparable(b?.status) || "new";
      if (activeFilter === "all" && aStatus !== bStatus) return aStatus === "new" ? -1 : bStatus === "new" ? 1 : 0;
      const aDate = new Date((aStatus === "new" ? a.created_at : a.reviewed_at || a.created_at) || 0).getTime();
      const bDate = new Date((bStatus === "new" ? b.created_at : b.reviewed_at || b.created_at) || 0).getTime();
      return bDate - aDate;
    });

  container.innerHTML = `
    <section class="moderator-page" aria-labelledby="moderatorPageHeading">
      <header class="moderator-page__header">
        <div><p class="profile-eyebrow">Administration</p><h1 id="moderatorPageHeading">Podcastforslag</h1><p>Gennemg&aring; forslag fra brugere og administrer deres status.</p></div>
        <a class="moderator-page__back" href="#profil">&larr; Tilbage til profil</a>
      </header>
      <div class="moderator-filter-bar" role="group" aria-label="Filtrer podcastforslag">
        ${["new", "all", "approved", "rejected"].map((filter) => `<button type="button" class="moderator-filter${filter === activeFilter ? " is-active" : ""}" data-moderator-filter="${filter}" aria-pressed="${filter === activeFilter}">${escapeHtml(getAdminSuggestionFilterLabel(filter))} <span>${counts[filter]}</span></button>`).join("")}
      </div>
      ${state.adminPodcastSuggestionsFeedback ? `<p class="moderator-feedback${state.adminPodcastSuggestionsFeedbackIsError ? " is-error" : ""}" role="status">${escapeHtml(state.adminPodcastSuggestionsFeedback)}</p>` : ""}
      <div class="moderator-suggestion-list" data-moderator-suggestions>${!loaded ? `<p class="moderator-empty">Indl&aelig;ser podcastforslag&hellip;</p>` : state.adminPodcastSuggestionsError ? `<p class="moderator-empty">${escapeHtml(state.adminPodcastSuggestionsError)}</p>` : !visibleSuggestions.length ? `<p class="moderator-empty">${emptyText[activeFilter]}</p>` : visibleSuggestions.map((suggestion) => createModeratorSuggestionMarkup(suggestion)).join("")}</div>
    </section>`;

  container.querySelectorAll("[data-moderator-filter]").forEach((button) => button.addEventListener("click", () => {
    state.adminPodcastSuggestionFilter = button.dataset.moderatorFilter || "new";
    state.adminPodcastSuggestionsFeedback = "";
    state.adminPodcastSuggestionsFeedbackIsError = false;
    renderModeratorPage();
  }));
  bindModeratorSuggestionActions(container);
  window.requestAnimationFrame(revealSuggestionNotificationTarget);
  if (!loaded) fetchPodcastSuggestionsForAdmin();
}

function createModeratorSuggestionMarkup(suggestion) {
  const status = normalizeComparable(suggestion?.status) || "new";
  const pending = state.podcastSuggestionStatusPendingIds.has(suggestion.id);
  const savedNote = state.adminPodcastSuggestionNoteDrafts.has(suggestion.id) ? state.adminPodcastSuggestionNoteDrafts.get(suggestion.id) : suggestion.admin_note || "";
  const selectedCatalogueId = state.adminPodcastSuggestionCatalogueDrafts.has(suggestion.id)
    ? state.adminPodcastSuggestionCatalogueDrafts.get(suggestion.id)
    : normalizeText(suggestion.catalogue_podcast_id);
  const linkedPodcast = findPodcastByCatalogueId(selectedCatalogueId);
  const reviewed = formatSuggestionDateTime(suggestion.reviewed_at);
  return `<article class="moderator-suggestion moderator-suggestion--${escapeHtml(status)}" data-suggestion-id="${escapeHtml(suggestion.id || "")}">
    <header><h2>${escapeHtml(suggestion.title || "Podcast uden titel")}</h2><span class="moderator-status-badge moderator-status-badge--${escapeHtml(status)}">${escapeHtml(getSuggestionStatusLabel(status))}</span></header>
    <dl class="moderator-suggestion__meta"><div><dt>Indsendt af</dt><dd>${escapeHtml(suggestion.suggested_by_email || "Ikke oplyst")}</dd></div><div><dt>Dato</dt><dd>${escapeHtml(formatSuggestionDateTime(suggestion.created_at) || "Ikke oplyst")}</dd></div>${suggestion.platform ? `<div><dt>Platform</dt><dd>${escapeHtml(suggestion.platform)}</dd></div>` : ""}${suggestion.podcast_url ? `<div class="moderator-suggestion__url"><dt>Podcastlink</dt><dd><a href="${escapeHtml(suggestion.podcast_url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(suggestion.podcast_url)}</a></dd></div>` : ""}</dl>
    ${suggestion.comment ? `<section class="moderator-suggestion__comment"><h3>Kommentar</h3><p>${escapeHtml(suggestion.comment)}</p></section>` : ""}
    ${status !== "rejected" ? renderModeratorCatalogueMatchControl(linkedPodcast, pending, state.adminPodcastSuggestionCatalogueDrafts.has(suggestion.id)) : ""}
    ${status === "new" ? `<label class="moderator-suggestion__note"><span>Svar til brugeren <small>(valgfrit)</small></span><textarea rows="2" data-admin-suggestion-note placeholder="Skriv eventuelt en kort besked til brugeren" ${pending ? "disabled" : ""}>${escapeHtml(savedNote)}</textarea></label><div class="moderator-suggestion__actions" aria-label="Moderation"><button type="button" class="moderator-action moderator-action--reject" data-admin-suggestion-status="rejected" ${pending ? "disabled" : ""}>${pending ? "Gemmer..." : "Afvis"}</button><button type="button" class="moderator-action moderator-action--approve" data-admin-suggestion-status="approved" ${pending ? "disabled" : ""}>${pending ? "Gemmer..." : "Godkend"}</button></div>` : `<section class="moderator-suggestion__decision"><p><strong>Besluttet:</strong> ${escapeHtml(reviewed || "Tidspunkt ikke tilgængeligt")}</p>${suggestion.admin_note ? `<p><strong>Svar til brugeren:</strong> ${escapeHtml(suggestion.admin_note)}</p>` : ""}</section>`}
  </article>`;
}

function renderModeratorCatalogueMatchControl(linkedPodcast, pending, hasDraft) {
  const selected = linkedPodcast
    ? `<div class="moderator-catalogue-match__selected"><img src="${escapeHtml(getPodcastImageSources(linkedPodcast)[0] || "")}" alt="" /><span><strong>${escapeHtml(linkedPodcast.title)}</strong><small>${escapeHtml([linkedPodcast.host, linkedPodcast.publisher].filter(Boolean).join(" · "))}</small></span><span class="moderator-catalogue-match__selected-actions"><button type="button" data-admin-suggestion-open-match="${escapeHtml(linkedPodcast.catalogueId)}">Åbn podcast</button><button type="button" data-admin-suggestion-clear-match ${pending ? "disabled" : ""}>Fjern kobling</button></span></div>`
    : "";
  return `<section class="moderator-catalogue-match"><label><span>Koblet podcast <small>(valgfrit)</small></span><input type="search" data-admin-suggestion-catalogue-search placeholder="Søg titel, vært, udgiver eller hovedserie" autocomplete="off" ${pending ? "disabled" : ""} /></label>${selected}<div class="moderator-catalogue-match__results" data-admin-suggestion-catalogue-results></div>${linkedPodcast || hasDraft ? `<button type="button" class="moderator-action moderator-action--link" data-admin-suggestion-save-match ${pending ? "disabled" : ""}>${linkedPodcast ? "Gem kobling" : "Gem uden kobling"}</button>` : ""}</section>`;
}

function getSuggestionCatalogueIdForSave(suggestionId) {
  if (state.adminPodcastSuggestionCatalogueDrafts.has(suggestionId)) {
    return normalizeText(state.adminPodcastSuggestionCatalogueDrafts.get(suggestionId));
  }
  return normalizeText(
    state.adminPodcastSuggestions.find((suggestion) => normalizeText(suggestion.id) === normalizeText(suggestionId))
      ?.catalogue_podcast_id
  );
}

function bindModeratorSuggestionActions(container) {
  container.querySelectorAll("[data-admin-suggestion-note]").forEach((field) => field.addEventListener("input", () => {
    const id = field.closest("[data-suggestion-id]")?.dataset.suggestionId;
    if (id) state.adminPodcastSuggestionNoteDrafts.set(id, field.value);
  }));
  container.querySelectorAll("[data-admin-suggestion-status]").forEach((button) => button.addEventListener("click", () => {
    const card = button.closest("[data-suggestion-id]");
    updatePodcastSuggestionStatus(
      card?.dataset.suggestionId,
      button.dataset.adminSuggestionStatus,
      card?.querySelector("[data-admin-suggestion-note]")?.value || "",
      getSuggestionCatalogueIdForSave(card?.dataset.suggestionId)
    );
  }));
  container.querySelectorAll("[data-admin-suggestion-catalogue-search]").forEach((field) => field.addEventListener("input", () => {
    const card = field.closest("[data-suggestion-id]");
    const results = card?.querySelector("[data-admin-suggestion-catalogue-results]");
    if (!card || !results) return;
    const query = normalizeSearchValue(field.value);
    const queryVariants = normalizeSearchVariants(query);
    const matches = query.length < 2 ? [] : state.podcasts
      .filter((podcast) => searchVariantsMatch(queryVariants, normalizeSearchVariants([podcast.title, podcast.host, podcast.publisher, podcast.mainSeries].join(" "))))
      .slice(0, 6);
    results.innerHTML = matches.map((podcast) => `<button type="button" data-admin-suggestion-select-match="${escapeHtml(podcast.catalogueId)}"><img src="${escapeHtml(getPodcastImageSources(podcast)[0] || "")}" alt="" /><span><strong>${escapeHtml(podcast.title)}</strong><small>${escapeHtml([podcast.host, podcast.publisher, podcast.mainSeries].filter(Boolean).join(" · "))}</small></span></button>`).join("");
    results.querySelectorAll("[data-admin-suggestion-select-match]").forEach((button) => button.addEventListener("click", () => {
      state.adminPodcastSuggestionCatalogueDrafts.set(card.dataset.suggestionId, button.dataset.adminSuggestionSelectMatch);
      renderModeratorPage();
    }));
  }));
  container.querySelectorAll("[data-admin-suggestion-clear-match]").forEach((button) => button.addEventListener("click", () => {
    const card = button.closest("[data-suggestion-id]");
    if (!card) return;
    state.adminPodcastSuggestionCatalogueDrafts.set(card.dataset.suggestionId, "");
    renderModeratorPage();
  }));
  container.querySelectorAll("[data-admin-suggestion-open-match]").forEach((button) => button.addEventListener("click", () => {
    const podcast = findPodcastByCatalogueId(button.dataset.adminSuggestionOpenMatch);
    if (podcast) openPodcastDetailSheet(podcast, button, { allowDesktop: true });
  }));
  container.querySelectorAll("[data-admin-suggestion-save-match]").forEach((button) => button.addEventListener("click", () => {
    const card = button.closest("[data-suggestion-id]");
    if (!card) return;
    updatePodcastSuggestionStatus(
      card.dataset.suggestionId,
      "approved",
      card.querySelector("[data-admin-suggestion-note]")?.value || "",
      getSuggestionCatalogueIdForSave(card.dataset.suggestionId)
    );
  }));
}

async function fetchPodcastSuggestionsForAdmin() {
  if (
    !isPodcastSuggestionAdmin() ||
    !state.supabase ||
    !state.authUser ||
    state.adminPodcastSuggestionsLoading
  ) {
    return;
  }

  state.adminPodcastSuggestionsLoading = true;
  state.adminPodcastSuggestionsError = "";
  try {
    let { data, error } = await state.supabase
      .from("podcast_suggestions")
      .select("id, title, podcast_url, platform, comment, suggested_by_email, status, created_at, reviewed_at, reviewed_by_user_id, admin_note, catalogue_podcast_id, moderator_seen_at")
      .order("created_at", { ascending: false });
    if (error && normalizeText(error.message).toLowerCase().includes("catalogue_podcast_id")) {
      ({ data, error } = await state.supabase
        .from("podcast_suggestions")
        .select("id, title, podcast_url, platform, comment, suggested_by_email, status, created_at, reviewed_at, reviewed_by_user_id, admin_note, moderator_seen_at")
        .order("created_at", { ascending: false }));
    }
    if (error) throw error;

    state.adminPodcastSuggestions = data || [];
    state.adminPodcastSuggestionsLoadedFor = state.authUser.id;
    renderSuggestionNotificationBadges();
  } catch (error) {
    console.error("Podcast suggestion admin fetch failed", error);
    state.adminPodcastSuggestions = [];
    state.adminPodcastSuggestionsLoadedFor = state.authUser.id;
    state.adminPodcastSuggestionsError = "Podcastforslag kunne ikke hentes lige nu.";
  } finally {
    state.adminPodcastSuggestionsLoading = false;
    if (document.body.classList.contains("page-profil")) {
      renderAdminPodcastSuggestionsPreview(document);
    } else if (document.body.classList.contains("page-moderator")) {
      renderModeratorPage();
    }
  }
}

function getPodcastSuggestionAdminErrorMessage(error) {
  const details = [error?.code, error?.message, error?.details, error?.hint]
    .map((value) => normalizeText(value).toLowerCase())
    .join(" ");
  if (
    details.includes("42501") ||
    details.includes("row-level security") ||
    details.includes("permission denied") ||
    details.includes("not authorized")
  ) {
    return "Status kunne ikke opdateres, fordi Supabase-moderationspolitikken ikke er anvendt endnu.";
  }
  if (details.includes("p_catalogue_podcast_id") || details.includes("catalogue_podcast_id")) {
    return "Katalogkoblings-migrationen skal anvendes i Supabase, før koblingen kan gemmes.";
  }
  return "Status kunne ikke opdateres. Pr\u00f8v igen.";
}

async function updatePodcastSuggestionStatus(id, status, adminNote = "", cataloguePodcastId = "") {
  const suggestionId = normalizeText(id);
  const nextStatus = normalizeComparable(status);
  const resolvedCatalogueId = normalizeText(cataloguePodcastId);
  if (
    !suggestionId ||
    !PODCAST_SUGGESTION_STATUSES.has(nextStatus) ||
    nextStatus === "new" ||
    !isPodcastSuggestionAdmin() ||
    !state.supabase ||
    !state.authUser ||
    state.podcastSuggestionStatusPendingIds.has(suggestionId)
  ) {
    return;
  }
  if (resolvedCatalogueId && !findPodcastByCatalogueId(resolvedCatalogueId)) {
    state.adminPodcastSuggestionsFeedback = "Den valgte katalogpodcast findes ikke længere.";
    state.adminPodcastSuggestionsFeedbackIsError = true;
    return;
  }

  state.podcastSuggestionStatusPendingIds.add(suggestionId);
  state.adminPodcastSuggestionNoteDrafts.set(suggestionId, adminNote);
  state.adminPodcastSuggestionsFeedback = "";
  state.adminPodcastSuggestionsFeedbackIsError = false;
  if (document.body.classList.contains("page-moderator")) renderModeratorPage();

  try {
    const { data, error } = await state.supabase.rpc("moderate_podcast_suggestion", {
      p_suggestion_id: suggestionId,
      p_status: nextStatus,
      p_admin_note: normalizeText(adminNote) || null,
      p_catalogue_podcast_id: resolvedCatalogueId || null
    });
    if (error) throw error;

    const moderatedSuggestion = Array.isArray(data) ? data[0] : data;

    state.adminPodcastSuggestions = state.adminPodcastSuggestions.map((suggestion) =>
      normalizeText(suggestion.id) === suggestionId
        ? { ...suggestion, ...moderatedSuggestion, status: nextStatus }
        : suggestion
    );
    state.adminPodcastSuggestionNoteDrafts.delete(suggestionId);
    state.adminPodcastSuggestionCatalogueDrafts.delete(suggestionId);
    state.adminPodcastSuggestionsFeedback =
      nextStatus === "approved" ? "Forslaget er godkendt." : "Forslaget er afvist.";
  } catch (error) {
    console.error("Podcast suggestion status update failed", error);
    state.adminPodcastSuggestionsFeedback = getPodcastSuggestionAdminErrorMessage(error);
    state.adminPodcastSuggestionsFeedbackIsError = true;
  } finally {
    state.podcastSuggestionStatusPendingIds.delete(suggestionId);
    if (document.body.classList.contains("page-moderator")) renderModeratorPage();
    if (document.body.classList.contains("page-profil")) renderAdminPodcastSuggestionsPreview(document);
  }
}

function getProfileDisplayName() {
  const metadata = state.authUser?.user_metadata || {};
  return (
    normalizeText(metadata.full_name) ||
    normalizeText(metadata.name) ||
    normalizeText(metadata.display_name) ||
    normalizeText(metadata.first_name) ||
    ""
  );
}

function renderDesktopUserArea() {
  if (!elements.desktopUserButton) return;

  const loggedIn = isLoggedIn();
  const displayName = loggedIn ? getProfileDisplayName() : "";
  const email = normalizeText(state.authUser?.email);
  const label =
    displayName ||
    email ||
    (loggedIn ? "Din profil" : "Log ind / Opret dig");
  const meta = loggedIn ? email || "Min profil" : "Gratis konto";
  const initialSource = displayName || email || "P";
  const initial = initialSource.trim().charAt(0).toUpperCase() || "P";

  elements.desktopUserButton.classList.toggle("is-authenticated", loggedIn);
  elements.desktopUserButton.setAttribute(
    "aria-label",
    loggedIn ? `Aabn brugermenu for ${label}` : "Log ind eller opret dig"
  );

  if (elements.desktopUserAvatar) {
    elements.desktopUserAvatar.classList.toggle("is-guest", !loggedIn);
    if (loggedIn) {
      elements.desktopUserAvatar.textContent = initial;
    } else {
      elements.desktopUserAvatar.innerHTML = `
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <circle cx="12" cy="8" r="3.2"></circle>
          <path d="M5.5 19.5v-1.2a6.5 6.5 0 0 1 13 0v1.2"></path>
        </svg>
      `;
    }
  }

  if (elements.desktopUserLabel) {
    elements.desktopUserLabel.textContent = label;
  }

  if (elements.desktopUserMeta) {
    elements.desktopUserMeta.textContent = meta;
  }

  renderSuggestionNotificationBadges();

  if (!loggedIn) {
    closeDesktopUserMenu();
  }
}

function closeDesktopUserMenu() {
  elements.desktopUserMenu?.classList.add("is-hidden");
  elements.desktopUserMenu?.setAttribute("aria-hidden", "true");
  elements.desktopUserButton?.setAttribute("aria-expanded", "false");
}

function openDesktopUserMenu() {
  if (!isLoggedIn()) {
    closeDesktopUserMenu();
    showAuthPrompt("login");
    return;
  }

  elements.desktopUserMenu?.classList.remove("is-hidden");
  elements.desktopUserMenu?.setAttribute("aria-hidden", "false");
  elements.desktopUserButton?.setAttribute("aria-expanded", "true");
}

function toggleDesktopUserMenu() {
  if (!elements.desktopUserMenu) return;

  if (elements.desktopUserMenu.classList.contains("is-hidden")) {
    openDesktopUserMenu();
    return;
  }

  closeDesktopUserMenu();
}

function setProfileSettingsMessage(message = "", tone = "info") {
  state.profileSettingsMessage = message;
  state.profileSettingsMessageTone = tone;
  const messageElement = document.querySelector("[data-profile-settings-message]");
  if (messageElement) {
    messageElement.textContent = message;
    messageElement.dataset.tone = tone;
    messageElement.classList.toggle("is-hidden", !message);
  }
}

function getProfileMenuIconMarkup(type) {
  const icons = {
    settings:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"></path><path d="M19.4 13.3v-2.6l-2-.5a6.6 6.6 0 0 0-.8-1.8l1.1-1.8-1.8-1.8-1.8 1.1a6.6 6.6 0 0 0-1.8-.8l-.5-2h-2.6l-.5 2a6.6 6.6 0 0 0-1.8.8L6.1 4.8 4.3 6.6l1.1 1.8a6.6 6.6 0 0 0-.8 1.8l-2 .5v2.6l2 .5a6.6 6.6 0 0 0 .8 1.8l-1.1 1.8 1.8 1.8 1.8-1.1a6.6 6.6 0 0 0 1.8.8l.5 2h2.6l.5-2a6.6 6.6 0 0 0 1.8-.8l1.8 1.1 1.8-1.8-1.1-1.8a6.6 6.6 0 0 0 .8-1.8l2-.5Z"></path></svg>',
    help:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M9.3 9.1a3 3 0 1 1 4.9 2.3c-1.2.9-2.2 1.5-2.2 3.1"></path><path d="M12 18.2h.01"></path><path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z"></path></svg>',
    logout:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M10 6H6.8A1.8 1.8 0 0 0 5 7.8v8.4A1.8 1.8 0 0 0 6.8 18H10"></path><path d="M14 8l4 4-4 4"></path><path d="M18 12H9"></path></svg>'
  };
  return icons[type] || "";
}

function getGenreIconMarkup(genre) {
  const icons = {
    "True Crime": '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="3"></circle><path d="M12 2v3M12 19v3M2 12h3M19 12h3"></path></svg>',
    Historie: '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 10h16M5 20h14M6 10v9M10 10v9M14 10v9M18 10v9M3 8l9-5 9 5"></path></svg>',
    Samfund: '<svg viewBox="0 0 24 24" focusable="false"><circle cx="8" cy="8" r="3"></circle><circle cx="16" cy="8" r="3"></circle><path d="M4 20v-2a4 4 0 0 1 8 0v2M12 20v-2a4 4 0 0 1 8 0v2"></path></svg>',
    Sport: '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9"></circle><path d="M7 5c3 3 7 7 12 9M5 16c5-1 9-5 10-11M9 21c0-4 4-8 10-9"></path></svg>',
    Dokumentar: '<svg viewBox="0 0 24 24" focusable="false"><rect x="3" y="7" width="12" height="10" rx="2"></rect><path d="m15 11 6-3v8l-6-3zM7 4l2 3M13 4l-2 3"></path></svg>',
    Viden: '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 18h6M10 22h4M8 14a6 6 0 1 1 8 0c-1 1-1 2-1 4H9c0-2 0-3-1-4Z"></path></svg>',
    Underholdning: '<svg viewBox="0 0 24 24" focusable="false"><circle cx="12" cy="12" r="9"></circle><path d="M8 10h.01M16 10h.01M8 15c2 2 6 2 8 0"></path></svg>',
    Sladder: '<svg viewBox="0 0 24 24" focusable="false"><path d="M3 12c3-4 6-5 9-2 3-3 6-2 9 2-3 4-6 5-9 2-3 3-6 2-9-2Z"></path><path d="M6 12h12"></path></svg>'
  };
  return icons[normalizeText(genre)] || getProfileStatIconMarkup("genre");
}

function getProfileStatIconMarkup(type) {
  const icons = {
    ratings:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 4.5h10a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-11a2 2 0 0 1 2-2Z"></path><path d="M9 9h6"></path><path d="M9 13h3"></path><path d="m14.5 15.2 1.2 1.2 2.3-2.5"></path></svg>',
    saved:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M6.5 4.5h11v15L12 16.2l-5.5 3.3v-15Z"></path></svg>',
    submitted:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 4.5h8l4 4v11H6Z"></path><path d="M14 4.5v4h4"></path><path d="M9 14h6"></path><path d="M12 11v6"></path></svg>',
    genre:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 11.2V5.5h5.7l8.8 8.8-5.7 5.7Z"></path><circle cx="8.2" cy="8.2" r="1.2"></circle></svg>',
    average:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 18.5V13"></path><path d="M10 18.5V9"></path><path d="M15 18.5V5.5"></path><path d="M20 18.5V11"></path><path d="M4 18.5h17"></path></svg>',
    rating:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.2 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.2 5.9-.9Z"></path></svg>',
    ratingOutline:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="m12 3.2 2.65 5.38 5.94.86-4.3 4.2 1.02 5.92L12 13.72l-5.3 2.78 1.02-5.92-4.3-4.2 5.94-.86Z"></path></svg>',
    savedMobile:
      '<svg viewBox="0 0 20 20" focusable="false"><path d="M4 2.5h12v15l-6-3.7-6 3.7Z"></path></svg>',
    submittedMobile:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="m21 3-8.5 18-3-7.1L3 10.8 21 3Z"></path><path d="m9.5 13.9 4.3-4.3"></path></svg>',
    genreMobile:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="m12 3 9 9-9 9-9-9Z"></path></svg>'
  };
  return icons[type] || "";
}

function getProfilePanelIconMarkup(type) {
  const icons = {
    saved:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M6.5 4.5h11v15L12 16.2l-5.5 3.3v-15Z"></path></svg>',
    ratings:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 5.5h14v13H5Z"></path><path d="M8 9h8"></path><path d="M8 13h5"></path><path d="m15 15.2 1 1 2-2.2"></path></svg>',
    submitted:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M6 4.5h8l4 4v11H6Z"></path><path d="M14 4.5v4h4"></path><path d="M9 14h6"></path><path d="M12 11v6"></path></svg>',
    episodes:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 12a7 7 0 0 1 14 0"></path><path d="M5 12v5a2 2 0 0 0 2 2h2v-7H5Z"></path><path d="M19 12v5a2 2 0 0 1-2 2h-2v-7h4Z"></path></svg>',
    tip:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 18h6"></path><path d="M10 21h4"></path><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5c-.9.8-1.5 1.6-1.5 2.5h-4c0-.9-.6-1.7-1.5-2.5Z"></path><path d="M12 2V.5"></path><path d="m4.2 4.2-1.1-1.1"></path><path d="m19.8 4.2 1.1-1.1"></path></svg>',
    edit:
      '<svg viewBox="0 0 24 24" focusable="false"><path d="m5 19 3.8-.8L18.5 8.5 15.5 5.5 5.8 15.2Z"></path><path d="m13.8 7.2 3 3"></path></svg>'
  };
  return icons[type] || "";
}

function getProfileShellMarkup(title, bodyMarkup) {
  const isSettingsPage = title === "Indstillinger";
  const eyebrow = isSettingsPage ? "Din konto" : "Hjælp og vejledning";
  const intro = isSettingsPage
    ? "Administrér din konto, visning, personlige anbefalinger og dine data samlet ét sted."
    : "Find hurtige svar om vurderinger, gemte podcasts, anbefalinger og din konto.";
  const iconMarkup = getProfileMenuIconMarkup(isSettingsPage ? "settings" : "help");

  return `
    <section class="profile-page profile-page--subview">
      ${getProfileMobilePageHeadingMarkup()}
      <section class="profile-subview-card" aria-labelledby="profileSubviewTitle">
        <header class="profile-subview-card__header">
          <span class="profile-subview-card__icon" aria-hidden="true">${iconMarkup}</span>
          <div class="profile-subview-card__heading">
            <p class="profile-eyebrow">${escapeHtml(eyebrow)}</p>
            <h2 id="profileSubviewTitle">${escapeHtml(title)}</h2>
            <p class="profile-subview-card__intro">${escapeHtml(intro)}</p>
          </div>
          <a class="profile-subview-back" href="#profil" aria-label="Tilbage til profil">
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19 12H5"></path>
              <path d="m11 18-6-6 6-6"></path>
            </svg>
            <span>Til profil</span>
          </a>
        </header>
        ${bodyMarkup}
      </section>
    </section>
  `;
}

function renderProfileSettingsPage(container) {
  if (!isLoggedIn()) {
    container.innerHTML = getProfileShellMarkup(
      "Indstillinger",
      `
        <div class="profile-empty-state">
          <h3>Log ind for at se indstillinger</h3>
          <p>Kontoindstillinger kræver en aktiv bruger.</p>
          <button class="profile-button profile-button--primary" type="button" data-auth-prompt="login">Log ind</button>
        </div>
      `
    );
    bindAuthPromptButtons(container);
    bindMobileToplineProfileButtons(container);
    bindHomeAccountMenu(container);
    return;
  }

  const displayName = getProfileDisplayName();
  const email = state.authUser?.email || "";
  const sortValue = state.profilePreferences.defaultSort;
  const sourceValue = state.profilePreferences.defaultRankingSource;
  const positionModeValue = normalizeRankingPositionMode(state.rankingPositionMode);

  container.innerHTML = getProfileShellMarkup(
    "Indstillinger",
    `
      <p class="profile-settings-message ${state.profileSettingsMessage ? "" : "is-hidden"}" data-profile-settings-message data-tone="${escapeHtml(state.profileSettingsMessageTone)}">${escapeHtml(state.profileSettingsMessage)}</p>

      <div class="profile-settings-grid">
        <form class="profile-settings-form profile-settings-section profile-settings-card profile-settings-card--account" data-settings-card="account" data-profile-display-name-form>
          <div class="profile-settings-card__heading">
            <p class="profile-eyebrow">Konto</p>
            <h3>Profiloplysninger</h3>
            <p>Opdatér det navn, som andre brugere ser på Podcastlisten.</p>
          </div>
          <div class="profile-settings-fields">
            <label class="profile-settings-field">
              <span>Visningsnavn</span>
              <input name="display_name" type="text" value="${escapeHtml(displayName)}" autocomplete="name" />
            </label>
            <label class="profile-settings-field">
              <span>E-mail</span>
              <input type="email" value="${escapeHtml(email)}" readonly />
            </label>
          </div>
          <p class="profile-settings-card__note">E-mailen bruges til login og kan ikke ændres her endnu.</p>
          <div class="profile-settings-card__actions">
            <button class="profile-button profile-button--primary" type="submit">Gem navn</button>
          </div>
        </form>

        <form class="profile-settings-form profile-settings-section profile-settings-card profile-settings-card--password" data-settings-card="password" data-profile-password-form>
          <div class="profile-settings-card__heading">
            <p class="profile-eyebrow">Sikkerhed</p>
            <h3>Skift adgangskode</h3>
            <p>Vælg en ny adgangskode på mindst seks tegn.</p>
          </div>
          <div class="profile-settings-fields profile-settings-fields--two">
            <label class="profile-settings-field">
              <span>Ny adgangskode</span>
              <input name="password" type="password" autocomplete="new-password" />
            </label>
            <label class="profile-settings-field">
              <span>Gentag adgangskode</span>
              <input name="password_repeat" type="password" autocomplete="new-password" />
            </label>
          </div>
          <div class="profile-settings-card__actions">
            <button class="profile-button profile-button--secondary" type="submit">Skift adgangskode</button>
          </div>
        </form>

        <section class="profile-settings-section profile-settings-card profile-settings-card--display" data-settings-card="display">
          <div class="profile-settings-card__heading">
            <p class="profile-eyebrow">Visning</p>
            <h3>Ranglister og sortering</h3>
            <p>Vælg hvordan Ranglister åbner som standard.</p>
          </div>
          <div class="profile-settings-fields profile-settings-fields--two">
            <label class="profile-settings-field">
              <span>Standardrangliste</span>
              <select name="default_ranking_source" data-profile-preference="defaultRankingSource">
                <option value="users"${sourceValue === "users" ? " selected" : ""}>Brugernes vurdering</option>
                <option value="mads"${sourceValue === "mads" ? " selected" : ""}>Podcastlistens vurdering</option>
              </select>
            </label>
            <label class="profile-settings-field">
              <span>Standard sortering</span>
              <select name="default_sort" data-profile-preference="defaultSort">
                <option value="placement-asc"${sortValue === "placement-asc" ? " selected" : ""}>Placering: lavest først</option>
                <option value="placement-desc"${sortValue === "placement-desc" ? " selected" : ""}>Placering: højest først</option>
              </select>
            </label>
          </div>
          <fieldset class="profile-ranking-position-mode">
            <legend>Placeringer i filtrerede ranglister</legend>
            <label class="profile-ranking-position-option">
              <input
                type="radio"
                name="ranking_position_mode"
                value="dynamic"
                data-profile-preference="rankingPositionMode"
                ${positionModeValue === "dynamic" ? "checked" : ""}
              />
              <span>
                <strong>Dynamiske placeringer</strong>
                <small>Placeringerne beregnes p\u00e5 ny efter dine aktive filtre, s\u00e5 listen altid starter ved nr. 1.</small>
              </span>
            </label>
            <label class="profile-ranking-position-option">
              <input
                type="radio"
                name="ranking_position_mode"
                value="fixed"
                data-profile-preference="rankingPositionMode"
                ${positionModeValue === "fixed" ? "checked" : ""}
              />
              <span>
                <strong>Faste placeringer</strong>
                <small>Podcastens oprindelige placering bevares, selv om listen filtreres.</small>
              </span>
            </label>
          </fieldset>
          <p class="profile-settings-card__note">Dine valg gemmes automatisk.</p>
        </section>

        <section class="profile-settings-section profile-settings-card profile-settings-card--privacy" data-settings-card="privacy">
          <div class="profile-settings-card__heading">
            <p class="profile-eyebrow">Data og privatliv</p>
            <h3>Dine data</h3>
            <p>Podcastlisten gemmer kun de oplysninger, der er nødvendige for konto, vurderinger, favoritter og forslag.</p>
          </div>
          <div class="profile-settings-card__actions">
            <button class="profile-button profile-button--secondary" type="button" data-profile-export>Eksportér mine data</button>
          </div>
        </section>

        <section class="profile-settings-section profile-settings-card profile-settings-card--recommendations" data-settings-card="recommendations">
          <div class="profile-settings-card__heading">
            <p class="profile-eyebrow">Anbefalinger</p>
            <h3>Start anbefalingerne forfra</h3>
            <p>Ryd de lokale anbefalingsdata uden at slette dine vurderinger eller gemte podcasts.</p>
          </div>
          <div class="profile-settings-card__actions">
            <button class="profile-button profile-button--secondary" type="button" data-profile-reset-recommendations>Nulstil anbefalinger</button>
          </div>
        </section>

        <section class="profile-settings-section profile-settings-card profile-settings-card--danger" data-settings-card="danger">
          <div class="profile-settings-card__heading">
            <p class="profile-eyebrow">Farezone</p>
            <h3>Slet konto</h3>
            <p>Handlingen kan ikke fortrydes. Skriv <strong>SLET</strong> i feltet for at bekræfte.</p>
          </div>
          <div class="profile-settings-danger-actions">
            <div class="profile-settings-fields profile-settings-fields--danger">
              <label class="profile-settings-field">
                <span>Bekræftelse</span>
                <input name="delete_confirm" type="text" data-profile-delete-confirm autocomplete="off" />
              </label>
            </div>
            <div class="profile-settings-card__actions">
              <button class="profile-button profile-button--logout" type="button" data-profile-delete-account>Slet konto</button>
            </div>
          </div>
        </section>
      </div>
    `
  );

  bindProfileSettings(container);
  bindMobileToplineProfileButtons(container);
  bindHomeAccountMenu(container);
}

function renderProfileFaqPage(container) {
  const contactEmail = "podcastlisten.dk@gmail.com";
  const contactLink = `mailto:${contactEmail}`;
  const faqItems = [
    { question: "Hvad er Podcastlisten?", answer: "Podcastlisten samler podcasts, vurderinger og anbefalinger, så det bliver lettere at finde den næste podcast.", categories: ["Kontakt"] },
    { question: "Hvad er forskellen på Podcastlistens vurdering og brugernes vurdering?", answer: "Podcastlistens vurdering er den redaktionelle vurdering i podcastkataloget. Brugernes vurdering er gennemsnittet af registrerede brugervurderinger.", categories: ["Vurderinger"] },
    { question: "Hvordan vurderer jeg en podcast?", answer: "Find eller åbn podcasten, tryk på Vurder podcast, vælg en vurdering og gem.", categories: ["Vurderinger"] },
    { question: "Hvordan fungerer brugerscoren?", answer: "Brugerscoren beregnes ud fra brugernes gemte vurderinger. Antal vurderinger vises de steder, hvor data understøtter det.", categories: ["Vurderinger"] },
    { question: "Hvordan fungerer Udforsk?", answer: "Udforsk bruger dine vurderinger og gemte podcasts til at finde relevante podcasts. Siden viser både personlige anbefalinger, genrer du lytter til, og redaktionelle fund som Oversete favoritter.", categories: ["Anbefalinger"] },
    { question: "Hvorfor kan jeg ikke se personlige anbefalinger?", answer: "Du skal være logget ind og have vurderet eller gemt nogle podcasts, før Podcastlisten kan lave personlige anbefalinger til dig.", categories: ["Anbefalinger", "Konto"] },
    { question: "Hvordan gemmer jeg en podcast?", answer: "Tryk på bogmærkeikonet ved en podcast. Gemte podcasts kan findes under Profil.", categories: ["Gemte podcasts"] },
    { question: "Hvordan foreslår jeg en podcast?", answer: "Gå til Profil → Mine podcastforslag, tryk Foreslå podcast og indsend titel, link og eventuel kommentar. Når forslaget er behandlet, kan du se status samme sted.", categories: ["Podcastforslag"] },
    { question: "Hvorfor mangler en podcast?", answer: "Kataloget er kurateret og opdateres løbende. Brug Foreslå podcast, hvis der mangler noget.", categories: ["Podcastforslag"] },
    { question: "Hvordan ændrer eller sletter jeg mine data?", answer: "Gå til Profil → Indstillinger. Her kan du ændre dine oplysninger og administrere din konto.", categories: ["Konto"] },
    { question: "Hvor kan jeg kontakte Podcastlisten?", answer: `Har du spørgsmål, feedback eller har du opdaget en fejl, kan du skrive til ${contactEmail}.`, categories: ["Kontakt"] },
    { question: "Om Podcastlisten.dk", answer: "Podcastlisten.dk er lavet for at gøre det nemmere at finde, vurdere og gemme danske podcasts.", categories: ["Kontakt"] }
  ];
  const categories = ["Alle", "Vurderinger", "Anbefalinger", "Gemte podcasts", "Podcastforslag", "Konto", "Kontakt"];
  let selectedCategory = "Alle";

  const renderFaqItems = (items) => items
    .map((item, index) => `
      <details class="profile-faq-item">
        <summary id="profileFaqQuestion${index}">${escapeHtml(item.question)}</summary>
        <div class="profile-faq-item__answer" aria-labelledby="profileFaqQuestion${index}">
          <p>${escapeHtml(item.answer)}</p>
        </div>
      </details>
    `)
    .join("");

  container.innerHTML = `
    <section class="profile-page profile-page--subview profile-page--faq">
      ${getProfileMobilePageHeadingMarkup()}
      <section class="profile-faq-page" aria-labelledby="profileFaqTitle">
        <a class="profile-faq-back" href="#profil" aria-label="Tilbage til profil">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M19 12H5"></path><path d="m11 18-6-6 6-6"></path></svg>
          <span>Til profil</span>
        </a>
        <header class="profile-faq-hero">
          <p class="profile-eyebrow">Hjælp og vejledning</p>
          <h1 id="profileFaqTitle">Hjælp og FAQ</h1>
          <p>Find svar på vurderinger, anbefalinger, gemte podcasts og din konto.</p>
        </header>
        <div class="profile-faq-controls" aria-label="Filtrér hjælpecenteret">
          <label class="profile-faq-search">
            <span class="sr-only">Søg i hjælp og FAQ</span>
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.2"></circle><path d="m15.4 15.4 4.2 4.2"></path></svg>
            <input type="search" data-profile-faq-search placeholder="Søg i hjælp og FAQ" autocomplete="off" />
          </label>
          <div class="profile-faq-chips" role="group" aria-label="FAQ-kategorier">
            ${categories.map((category) => `<button class="profile-faq-chip${category === "Alle" ? " is-active" : ""}" type="button" data-profile-faq-category="${escapeHtml(category)}" aria-pressed="${category === "Alle" ? "true" : "false"}">${escapeHtml(category)}</button>`).join("")}
          </div>
        </div>
        <p class="profile-faq-result-count" data-profile-faq-result-count aria-live="polite"></p>
        <div class="profile-faq-list" data-profile-faq-list>${renderFaqItems(faqItems)}</div>
        <p class="profile-faq-empty" data-profile-faq-empty hidden>Ingen svar matcher din søgning.</p>
        <section class="profile-faq-contact" aria-labelledby="profileFaqContactTitle">
          <span class="profile-faq-contact__icon" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M4.5 6.8h15v10.4h-15z" /><path d="m5.2 7.4 6.8 5.2 6.8-5.2" /></svg></span>
          <div class="profile-faq-contact__copy">
            <h2 id="profileFaqContactTitle">Fandt du ikke svar?</h2>
            <p>Skriv til Podcastlisten, hvis du har spørgsmål, feedback eller har opdaget en fejl.</p>
            <a class="profile-faq-contact__email" href="${contactLink}">${contactEmail}</a>
          </div>
          <a class="profile-faq-contact__cta" href="${contactLink}">Skriv til Podcastlisten</a>
        </section>
      </section>
    </section>
  `;

  const searchInput = container.querySelector("[data-profile-faq-search]");
  const list = container.querySelector("[data-profile-faq-list]");
  const emptyState = container.querySelector("[data-profile-faq-empty]");
  const resultCount = container.querySelector("[data-profile-faq-result-count]");
  const categoryButtons = Array.from(container.querySelectorAll("[data-profile-faq-category]"));
  const updateResults = () => {
    const searchTerm = String(searchInput?.value || "").trim().toLocaleLowerCase("da-DK");
    const filteredItems = faqItems.filter((item) => {
      const matchesCategory = selectedCategory === "Alle" || item.categories.includes(selectedCategory);
      return matchesCategory && (!searchTerm || `${item.question} ${item.answer}`.toLocaleLowerCase("da-DK").includes(searchTerm));
    });
    if (list) list.innerHTML = renderFaqItems(filteredItems);
    if (emptyState) emptyState.hidden = filteredItems.length > 0;
    if (resultCount) resultCount.textContent = filteredItems.length === faqItems.length && !searchTerm && selectedCategory === "Alle" ? "" : `${filteredItems.length} svar`;
  };

  searchInput?.addEventListener("input", updateResults);
  categoryButtons.forEach((button) => button.addEventListener("click", () => {
    selectedCategory = button.dataset.profileFaqCategory || "Alle";
    categoryButtons.forEach((chip) => {
      const isSelected = chip === button;
      chip.classList.toggle("is-active", isSelected);
      chip.setAttribute("aria-pressed", String(isSelected));
    });
    updateResults();
  }));

  bindMobileToplineProfileButtons(container);
  bindHomeAccountMenu(container);
}

async function updateProfileDisplayName(form) {
  const input = form?.querySelector("[name='display_name']");
  const displayName = normalizeText(input?.value);
  if (!displayName) {
    setProfileSettingsMessage("Visningsnavn må ikke være tomt.", "warning");
    input?.focus();
    return;
  }
  if (!state.supabase || !state.authUser) return;

  setProfileSettingsMessage("Gemmer navn...", "info");
  try {
    const { data, error } = await state.supabase.auth.updateUser({
      data: {
        full_name: displayName,
        name: displayName,
        display_name: displayName
      }
    });
    if (error) throw error;
    state.authUser = data.user || { ...state.authUser, user_metadata: { ...state.authUser.user_metadata, full_name: displayName } };
    setProfileSettingsMessage("Visningsnavn er gemt.", "success");
    renderAuthPanel();
  } catch (error) {
    console.error(error);
    setProfileSettingsMessage(normalizeAuthErrorMessage(error), "error");
  }
}

async function updateProfilePassword(form) {
  const password = normalizeText(form?.querySelector("[name='password']")?.value);
  const passwordRepeat = normalizeText(form?.querySelector("[name='password_repeat']")?.value);

  if (password.length < 6) {
    setProfileSettingsMessage("Adgangskoden skal v&aelig;re mindst 6 tegn.", "warning");
    return;
  }
  if (password !== passwordRepeat) {
    setProfileSettingsMessage("Adgangskoderne matcher ikke.", "warning");
    return;
  }
  if (!state.supabase || !state.authUser) return;

  setProfileSettingsMessage("Skifter adgangskode...", "info");
  try {
    const { error } = await state.supabase.auth.updateUser({ password });
    if (error) throw error;
    form.reset();
    setProfileSettingsMessage("Adgangskoden er opdateret.", "success");
  } catch (error) {
    console.error(error);
    setProfileSettingsMessage(normalizeAuthErrorMessage(error), "error");
  }
}

async function exportProfileData() {
  if (!state.authUser) return;
  setProfileSettingsMessage("Klargør eksport...", "info");

  try {
    const userId = state.authUser.id;
    const exportData = {
      exportedAt: new Date().toISOString(),
      account: {
        id: userId,
        email: state.authUser.email || null,
        displayName: getProfileDisplayName() || null
      },
      preferences: state.profilePreferences,
      ratings: Object.entries(state.userRatingsByKey).map(([podcastKey, rating]) => ({
        podcastKey,
        rating
      })),
      savedPodcasts: Array.from(state.savedPodcastKeys).map((podcastKey) => ({
        podcastKey,
        savedAt: state.savedPodcastMetaByKey[podcastKey]?.savedAt || null
      }))
    };

    if (state.supabase) {
      const { data, error } = await state.supabase
        .from("podcast_suggestions")
        .select("id,title,podcast_url,platform,comment,status,created_at,updated_at")
        .eq("suggested_by_user_id", userId);
      if (!error) {
        exportData.podcastSuggestions = data || [];
      }
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `podcastlisten-data-${date}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setProfileSettingsMessage("Dataeksporten er hentet som JSON.", "success");
  } catch (error) {
    console.error(error);
    setProfileSettingsMessage("Dataeksporten kunne ikke oprettes lige nu.", "error");
  }
}

function resetProfileRecommendationCaches() {
  state.exploreUnderratedHourBucket = null;
  invalidateRankingListCache();
  setProfileSettingsMessage("Lokale anbefalingscaches er nulstillet. Dine vurderinger og gemte podcasts er bevaret.", "success");
}

async function deleteProfileAccount(container) {
  const confirmation = normalizeText(container.querySelector("[data-profile-delete-confirm]")?.value);
  if (confirmation !== "SLET") {
    setProfileSettingsMessage("Skriv SLET for at bekræfte kontosletning.", "warning");
    return;
  }
  if (!state.supabase || !state.authUser) return;

  setProfileSettingsMessage("Forsøger at slette konto...", "info");
  try {
    const { error } = await state.supabase.rpc("delete_current_user");
    if (error) throw error;

    clearTrackedAuthStorage();
    state.session = null;
    state.authUser = null;
    syncRankingPositionModeForAuthUser();
    clearUserScopedState({ clearUi: true });
    window.location.hash = "#profil";
    render();
    setAuthMessage("Din konto er slettet.", "success", "hero");
  } catch (error) {
    console.error(error);
    setProfileSettingsMessage(
      "Kontoen kunne ikke slettes fuldt ud endnu. Den sikre Supabase-funktion delete_current_user skal være deployet, før auth-brugeren kan slettes.",
      "error"
    );
  }
}

function bindProfileSettings(container) {
  container
    .querySelector("[data-profile-display-name-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      updateProfileDisplayName(event.currentTarget);
    });

  container
    .querySelector("[data-profile-password-form]")
    ?.addEventListener("submit", (event) => {
      event.preventDefault();
      updateProfilePassword(event.currentTarget);
    });

  container.querySelectorAll("[data-profile-preference]").forEach((control) => {
    control.addEventListener("change", () => {
      if (control.type === "radio" && !control.checked) return;
      const key = control.dataset.profilePreference;
      const value = control.value;
      if (key === "defaultRankingSource") {
        persistProfilePreferences({ defaultRankingSource: value === "mads" ? "mads" : "users" });
        state.rankingSourceTouched = false;
      }
      if (key === "defaultSort") {
        persistProfilePreferences({ defaultSort: value === "placement-desc" ? "placement-desc" : "placement-asc" });
        state.sortTouched = false;
      }
      if (key === "rankingPositionMode") {
        persistRankingPositionMode(value);
        resetVisibleCount();
      }
      setProfileSettingsMessage("Standardvalg er gemt.", "success");
    });
  });

  container.querySelector("[data-profile-export]")?.addEventListener("click", exportProfileData);
  container
    .querySelector("[data-profile-reset-recommendations]")
    ?.addEventListener("click", resetProfileRecommendationCaches);
  container
    .querySelector("[data-profile-delete-account]")
    ?.addEventListener("click", () => deleteProfileAccount(container));
  container
    .querySelectorAll("[data-profile-logout]")
    .forEach((button) => button.addEventListener("click", handleLogout));
}

function getAdminPodcastSuggestionsSectionMarkup() {
  if (!isPodcastSuggestionAdmin()) return "";

  return `
    <section class="profile-panel profile-suggestions-panel profile-suggestions-panel--admin moderator-preview" id="adminPodcastSuggestions" aria-labelledby="adminPodcastSuggestionsHeading">
      <header class="profile-panel__header">
        <div>
          <p class="profile-eyebrow">Administration</p>
          <h2 id="adminPodcastSuggestionsHeading">Podcastforslag</h2>
        </div>
      </header>
      <p class="profile-panel__note">Se de nyeste indsendelser og &aring;bn det fulde moderatorpanel.</p>
      <div class="moderator-preview__content" data-admin-podcast-preview></div>
    </section>
  `;
}

function renderProfilePage() {
  const container = elements.pageIntroPanel;
  if (!container) return;

  container.innerHTML = "";
  container.classList.remove("is-hidden");

  if (state.authConfigured && !state.authReady) {
    container.innerHTML = `
      <section class="profile-page">
        ${getProfileMobilePageHeadingMarkup()}
        <div class="profile-state-card" aria-live="polite">
          <p class="profile-eyebrow">Konto</p>
          <h2>Indl&aelig;ser din profil&hellip;</h2>
          <p>Vi kontrollerer din loginstatus og henter dine personlige podcastdata.</p>
        </div>
      </section>
    `;
    bindMobileToplineProfileButtons(container);
    bindHomeAccountMenu(container);
    return;
  }

  const { rawRoute } = getRouteInfoFromHash();
  if (rawRoute === "profil-faq") {
    renderProfileFaqPage(container);
    return;
  }

  if (rawRoute === "profil-indstillinger" && !isLoggedIn()) {
    renderProfileSettingsPage(container);
    return;
  }

  if (!isLoggedIn()) {
    const disabled = !state.authConfigured || state.authBusy ? "disabled" : "";
    const availabilityMessage = state.authConfigured
      ? "Log ind for at se dine vurderinger og gemte podcasts."
      : "Login er ikke tilg&aelig;ngeligt, fordi auth ikke er konfigureret.";

    container.innerHTML = `
      <section class="profile-page">
        ${getProfileMobilePageHeadingMarkup()}
        <div class="profile-state-card profile-state-card--logged-out">
          <p class="profile-eyebrow">Din podcastkonto</p>
          <h2>Din profil</h2>
          <p>${availabilityMessage}</p>
          <div class="profile-benefit-grid" aria-label="Profilfordele">
            <article class="profile-benefit-card">
              <span class="profile-benefit-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M5 4.5A2.5 2.5 0 0 1 7.5 2h9A2.5 2.5 0 0 1 19 4.5v16l-7-3.8-7 3.8v-16Z" />
                </svg>
              </span>
              <strong>Gem dine favoritter</strong>
              <p>Gem og find dine yndlingspodcasts.</p>
            </article>
            <article class="profile-benefit-card">
              <span class="profile-benefit-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 3.5 14.7 9l6.1.9-4.4 4.3 1 6.1L12 17.4l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.5Z" />
                </svg>
              </span>
              <strong>Giv dine vurderinger</strong>
              <p>Hj&aelig;lp andre med at finde de bedste podcasts.</p>
            </article>
            <article class="profile-benefit-card">
              <span class="profile-benefit-card__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M12 3a7 7 0 0 0-4 12.7V18h8v-2.3A7 7 0 0 0 12 3Zm-3 17h6v2H9v-2Z" />
                </svg>
              </span>
              <strong>F&aring; personlige anbefalinger</strong>
              <p>F&aring; forslag baseret p&aring; dine interesser.</p>
            </article>
          </div>
          <div class="profile-actions">
            <button class="profile-button profile-button--primary" type="button" data-auth-prompt="login" ${disabled}>
              Log ind
            </button>
            <button class="profile-button profile-button--secondary" type="button" data-auth-prompt="signup" ${disabled}>
              Opret dig
            </button>
          </div>
        </div>
      </section>
    `;

    bindAuthPromptButtons(container);
    bindMobileToplineProfileButtons(container);
    bindHomeAccountMenu(container);
    return;
  }

  if (rawRoute === "profil-indstillinger") {
    renderProfileSettingsPage(container);
    return;
  }

  const ratedPodcasts = getProfileRatedPodcasts();
  const ratingCount = Object.keys(state.userRatingsByKey).length;
  const savedCount = state.savedPodcastKeys.size;
  if (isProfileSavedRoute()) {
    state.profileSavedExpanded = true;
  }
  const savedPodcasts = getSavedPodcasts();
  const unmatchedSavedCount = Math.max(0, savedCount - savedPodcasts.length);
  const suggestionsLoaded = state.profileSuggestionsLoadedFor === state.authUser.id;
  const suggestionCount = suggestionsLoaded ? state.profileSuggestions.length : null;
  const userMetadata = state.authUser.user_metadata || {};
  const rawProfileName =
    normalizeText(userMetadata.full_name) ||
    normalizeText(userMetadata.name) ||
    normalizeText(userMetadata.display_name);
  const profileEmail = normalizeText(state.authUser.email) || "Email ikke tilgængelig";
  const profileName = rawProfileName && rawProfileName.toLowerCase() !== "din profil" ? rawProfileName : "Din konto";
  const profileRatingValues = Object.values(state.userRatingsByKey)
    .map((value) => parseNumber(value))
    .filter((value) => value !== null);
  const profileAverageRating = profileRatingValues.length
    ? profileRatingValues.reduce((total, value) => total + value, 0) / profileRatingValues.length
    : null;
  const profileGenreCounts = new Map();
  ratedPodcasts.forEach(({ podcast }) => {
    const genreName = normalizeText(podcast?.genre);
    if (!genreName) return;
    profileGenreCounts.set(genreName, (profileGenreCounts.get(genreName) || 0) + 1);
  });
  const profileFavoriteGenre = Array.from(profileGenreCounts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "da"))[0]?.[0] || "Ikke nok data";

  const renderDesktopProfileDashboard = !isMobileViewport();
  const desktopTopRatings = [...ratedPodcasts]
    .sort(
      (a, b) =>
        (parseNumber(b.rating) ?? 0) - (parseNumber(a.rating) ?? 0) ||
        a.podcast.title.localeCompare(b.podcast.title, "da", { sensitivity: "base" })
    )
    .slice(0, 3);

  container.innerHTML = renderDesktopProfileDashboard
    ? `
    <section class="profile-page profile-page--desktop-dashboard">
      <div class="profile-desktop-top">
        <header class="profile-intro-card">
          <div class="profile-avatar" aria-hidden="true">${escapeHtml(
            (profileName || state.authUser.email || "?").trim().charAt(0).toUpperCase() || "?"
          )}</div>
          <div class="profile-intro-card__copy">
            <h1>${escapeHtml(profileName)}</h1>
            <p class="profile-email">${escapeHtml(profileEmail)}</p>
            <p class="profile-header__intro">Dit personlige overblik over gemte podcasts, vurderinger og indsendte forslag.</p>
            <div class="profile-intro-card__actions">
              <a class="profile-header__edit" href="#profil-indstillinger">
                <span class="profile-header__edit-icon" aria-hidden="true">${getProfilePanelIconMarkup("edit")}</span>
                Rediger profil
              </a>
              <button class="profile-header__settings" type="button" data-profile-settings-hub>
                <span class="profile-header__settings-icon" aria-hidden="true">${getProfileMenuIconMarkup("settings")}</span>
                <span class="profile-header__settings-label">Indstillinger</span>
              </button>
            </div>
          </div>
        </header>

        <section class="profile-stats-card" aria-label="Profilstatistik">
          <button class="profile-stat-card profile-stat-card--ratings profile-stat-card--action" type="button" data-profile-scroll="profileRatings">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("ratings")}</span>
            <strong>${ratingCount}</strong>
            <span class="profile-stat-card__label">Vurderinger</span>
          </button>
          <button class="profile-stat-card profile-stat-card--saved profile-stat-card--action" type="button" data-profile-scroll="profileSaved">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("saved")}</span>
            <strong data-profile-saved-count>${savedCount}</strong>
            <span class="profile-stat-card__label">Gemte podcasts</span>
          </button>
          <button class="profile-stat-card profile-stat-card--suggestions profile-stat-card--action" type="button" data-profile-scroll="profileSuggestions">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("submitted")}</span>
            <strong data-profile-suggestions-stat-count>${suggestionCount === null ? "&ndash;" : suggestionCount}</strong>
            <span class="profile-stat-card__label">Indsendte podcasts</span>
          </button>
          <article class="profile-stat-card profile-stat-card--genre">
            <span class="profile-stat-card__icon" aria-hidden="true">${getGenreIconMarkup(profileFavoriteGenre)}</span>
            <strong class="profile-stat-card__text-value">${escapeHtml(profileFavoriteGenre)}</strong>
            <span class="profile-stat-card__label">Yndlingsgenre</span>
          </article>
          <article class="profile-stat-card profile-stat-card--average">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("average")}</span>
            <strong>${profileAverageRating === null ? "&ndash;" : escapeHtml(formatCompactRating(profileAverageRating))}</strong>
            <span class="profile-stat-card__label">Gns. vurdering</span>
          </article>
        </section>
      </div>

      <main class="profile-desktop-grid">
        <section class="profile-panel profile-saved-panel" id="profileSaved" aria-labelledby="profileSavedHeading">
          <header class="profile-panel__header">
            <div class="profile-panel__title">
              <span class="profile-panel__icon" aria-hidden="true">${getProfilePanelIconMarkup("saved")}</span>
              <h2 id="profileSavedHeading">Mine gemte podcasts</h2>
            </div>
            <div class="profile-panel__tools">
              <span data-profile-saved-count>${savedCount}</span>
              <button class="profile-panel__view-all" type="button" data-profile-modal="saved">Se alle</button>
            </div>
          </header>
          ${
            unmatchedSavedCount
              ? `<p class="profile-panel__note">${unmatchedSavedCount} gemte ${
                  unmatchedSavedCount === 1 ? "podcast matcher" : "podcasts matcher"
                } ikke l&aelig;ngere datagrundlaget.</p>`
              : ""
          }
          <div class="saved-grid profile-saved-grid" data-profile-saved></div>
          <p class="profile-panel__footer-note">Opdateres l&oslash;bende, n&aring;r du gemmer nye favoritter.</p>
        </section>

        <section class="profile-panel profile-ratings-panel" id="profileRatings" aria-labelledby="profileRatingsHeading">
          <header class="profile-panel__header">
            <div class="profile-panel__title">
              <span class="profile-panel__icon" aria-hidden="true">${getProfilePanelIconMarkup("ratings")}</span>
              <h2 id="profileRatingsHeading">Dine vurderinger</h2>
            </div>
            <div class="profile-panel__tools">
              <span>${ratingCount}</span>
              <button class="profile-panel__view-all" type="button" data-profile-modal="ratings">Se alle</button>
            </div>
          </header>
          <div class="profile-podcast-list" data-profile-ratings></div>
          <div class="profile-average-rating">
            <span>Din gennemsnitlige vurdering:</span>
            <strong>${profileAverageRating === null ? "&ndash;" : `${escapeHtml(formatCompactRating(profileAverageRating))} <small>/ 10</small>`}</strong>
          </div>
        </section>

        <section class="profile-panel profile-suggestions-panel" id="profileSuggestions" aria-labelledby="profileSuggestionsHeading">
          <header class="profile-panel__header">
            <div class="profile-panel__title">
              <span class="profile-panel__icon" aria-hidden="true">${getProfilePanelIconMarkup("submitted")}</span>
              <h2 id="profileSuggestionsHeading">Mine podcastforslag</h2>
              <span class="profile-info-help">
                <button
                  class="profile-info-help__button"
                  type="button"
                  aria-label="Hvad kan jeg indsende?"
                  aria-describedby="profileSuggestionsInfo"
                >?</button>
                <span class="profile-info-help__tooltip" id="profileSuggestionsInfo" role="tooltip">
                  Mangler der en podcast, du gerne vil vurdere, eller er der en podcast, Podcastlisten bør lytte til? Send den som et forslag her.
                </span>
              </span>
            </div>
            <div class="profile-panel__tools">
              <span data-profile-suggestions-count></span>
              <button class="profile-panel__view-all" type="button" data-profile-modal="suggestions">Se alle</button>
            </div>
          </header>
          <div class="profile-suggestion-list" data-profile-suggestions></div>
          <div class="profile-suggestion-submit-row">
            <button class="profile-suggestion-submit-button" type="button" data-explore-suggest-open>
              <span aria-hidden="true">${getProfilePanelIconMarkup("submitted")}</span>
              Indsend en podcast
            </button>
          </div>
          <p class="profile-panel__footer-note">Tak fordi du hj&aelig;lper med at udvide universet af gode podcasts.</p>
        </section>

        ${getAdminPodcastSuggestionsSectionMarkup()}

        <section class="profile-panel profile-episode-ratings-panel" id="profileEpisodeRatings" aria-labelledby="profileEpisodeRatingsHeading">
          <header class="profile-panel__header">
            <div class="profile-panel__title">
              <span class="profile-panel__icon" aria-hidden="true">${getProfilePanelIconMarkup("episodes")}</span>
              <h2 id="profileEpisodeRatingsHeading">Dine episodevurderinger</h2>
            </div>
            <div class="profile-panel__tools">
              <span data-profile-episode-ratings-count></span>
              <button class="profile-panel__view-all" type="button" data-profile-modal="episodes">Se alle</button>
            </div>
          </header>
          <div class="profile-episode-list" data-profile-episode-ratings></div>
          <p class="profile-panel__footer-note">Hver vurdering hj&aelig;lper andre med at finde det bedste indhold.</p>
        </section>


        <section class="profile-tip-card">
          <span class="profile-tip-card__icon" aria-hidden="true">${getProfilePanelIconMarkup("tip")}</span>
          <div class="profile-tip-card__copy">
            <p class="profile-eyebrow">Tip til dig</p>
            <h2>Find din n&aelig;ste favorit</h2>
            <p>Udforsk podcasts baseret p&aring; dine vurderinger og gemte favoritter.</p>
          </div>
          <a href="#udforsk">Udforsk podcasts <span aria-hidden="true">&rsaquo;</span></a>
        </section>
      </main>

      ${getSuggestionDialogMarkup("profileSuggestionTitle")}
    </section>
  `
    : `
    <section class="profile-page">
      ${getProfileMobilePageHeadingMarkup()}

      <header class="profile-header profile-header--dashboard">
        <div class="profile-avatar" aria-hidden="true">${escapeHtml(
          (profileName || state.authUser.email || "?").trim().charAt(0).toUpperCase() || "?"
        )}</div>
        <div class="profile-header__copy">
          <p class="profile-eyebrow">Din profil</p>
          <h2 data-mobile-title="Profil">${escapeHtml(profileName)}</h2>
          <p class="profile-email">${escapeHtml(profileEmail)}</p>
          <p class="profile-header__intro">Dit personlige overblik over gemte podcasts, vurderinger og indsendte forslag.</p>
        </div>
        <div class="profile-stats profile-stats--overview" aria-label="Profilstatistik">
          <button class="profile-stat-card profile-stat-card--ratings profile-stat-card--action" type="button" data-profile-scroll="profileRatings">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("ratingOutline")}</span>
            <strong>${ratingCount}</strong>
            <span class="profile-stat-card__label">Vurderinger</span>
          </button>
          <button class="profile-stat-card profile-stat-card--saved profile-stat-card--action" type="button" data-profile-scroll="profileSaved">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("savedMobile")}</span>
            <strong data-profile-saved-count>${savedCount}</strong>
            <span class="profile-stat-card__label">Gemte</span>
          </button>
          <button class="profile-stat-card profile-stat-card--suggestions profile-stat-card--action" type="button" data-profile-scroll="profileSuggestions">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("submittedMobile")}</span>
            <strong data-profile-suggestions-stat-count>${suggestionCount === null ? "&ndash;" : suggestionCount}</strong>
            <span class="profile-stat-card__label">Forslag</span>
          </button>
          <article class="profile-stat-card profile-stat-card--genre">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("genreMobile")}</span>
            <strong class="profile-stat-card__text-value">${escapeHtml(profileFavoriteGenre)}</strong>
            <span class="profile-stat-card__label">Mest vurderede genre</span>
          </article>
          <article class="profile-stat-card profile-stat-card--average">
            <span class="profile-stat-card__icon" aria-hidden="true">${getProfileStatIconMarkup("rating")}</span>
            <strong>${profileAverageRating === null ? "–" : escapeHtml(formatCompactRating(profileAverageRating))}</strong>
            <span class="profile-stat-card__label">Gennemsnitlig bedømmelse</span>
          </article>
        </div>
        <a class="profile-header__edit" href="#profil-indstillinger"><span class="profile-header__edit-icon" aria-hidden="true">${getProfilePanelIconMarkup("edit")}</span>Rediger profil</a>
      </header>

      <div class="profile-dashboard">
        <section class="profile-panel profile-saved-panel is-expanded" id="profileSaved" aria-labelledby="profileSavedHeading">
          <header class="profile-panel__header" ${isMobileViewport() ? "" : "data-profile-panel-header"}>
            <div>
              <p class="profile-eyebrow">Dit bibliotek</p>
              <h2 id="profileSavedHeading">Mine gemte podcasts</h2>
            </div>
            <div class="profile-panel__tools">
              <span data-profile-saved-count>${savedCount}</span>
              <button
                class="profile-panel__toggle"
                type="button"
                ${
                  isMobileViewport()
                    ? `data-profile-saved-toggle aria-expanded="${state.profileSavedExpanded}"`
                    : "data-profile-panel-toggle aria-expanded=\"true\""
                }
              >${isMobileViewport() ? (state.profileSavedExpanded ? "Fold sammen" : "Fold ud") : "Fold sammen"}</button>
            </div>
          </header>
          ${
            unmatchedSavedCount
              ? `
                <p class="profile-panel__note">
                  ${unmatchedSavedCount} gemte ${
                    unmatchedSavedCount === 1 ? "podcast matcher" : "podcasts matcher"
                  } ikke l&aelig;ngere datagrundlaget.
                </p>
              `
              : ""
          }
          <div class="saved-grid profile-saved-grid" data-profile-saved></div>
          ${
            savedPodcasts.length > 3 && !isMobileViewport()
              ? `
                <button
                  class="profile-expand-button profile-expand-button--link"
                  type="button"
                  data-profile-modal="saved"
                  aria-controls="profileSavedList"
                >
                  Vis alle gemte podcasts
                </button>
              `
              : ""
          }
        </section>

        <section class="profile-panel profile-ratings-panel is-collapsed" id="profileRatings" aria-labelledby="profileRatingsHeading">
          <header class="profile-panel__header" data-profile-panel-header>
            <div>
              <p class="profile-eyebrow">Dine scores</p>
              <h2 id="profileRatingsHeading">Dine vurderinger</h2>
            </div>
            <div class="profile-panel__tools">
              <span>${ratingCount}</span>
              <div class="profile-ratings-sort" aria-label="Sortér dine vurderinger">
                <button
                  type="button"
                  data-profile-ratings-sort="alpha"
                  aria-pressed="${state.profileRatingsSort === "alpha"}"
                >
                  A-Z
                </button>
                <button
                  type="button"
                  data-profile-ratings-sort="score"
                  aria-pressed="${state.profileRatingsSort === "score"}"
                >
                  H&oslash;jeste
                </button>
                <button
                  type="button"
                  data-profile-ratings-sort="score-low"
                  aria-pressed="${state.profileRatingsSort === "score-low"}"
                >
                  Laveste
                </button>
              </div>
              <button class="profile-panel__toggle" type="button" data-profile-panel-toggle aria-expanded="false">Fold ud</button>
            </div>
          </header>
          <p class="profile-panel__note">
            ${
              state.profileRatingsSort === "score"
                ? "Vises med h&oslash;jeste score f&oslash;rst."
                : state.profileRatingsSort === "score-low"
                  ? "Vises med laveste score f&oslash;rst."
                : "Vises alfabetisk."
            }
          </p>
          <div class="profile-podcast-list" data-profile-ratings></div>
          <button class="profile-expand-button" type="button" data-profile-expand="ratings" hidden>
            Se alle vurderinger
          </button>
        </section>

        <section class="profile-panel profile-suggestions-panel is-expanded" id="profileSuggestions" aria-labelledby="profileSuggestionsHeading">
          <header class="profile-panel__header" data-profile-panel-header>
            <div>
              <p class="profile-eyebrow">Dine indsendelser</p>
              <h2 id="profileSuggestionsHeading">Mine podcastforslag</h2>
            </div>
            <div class="profile-panel__tools">
              <span data-profile-suggestions-count></span>
              <button class="profile-panel__toggle" type="button" data-profile-panel-toggle aria-expanded="true">Fold sammen</button>
            </div>
          </header>
          <button class="profile-suggest-button profile-suggest-button--wide" type="button" data-explore-suggest-open>
            Foresl&aring; podcast
          </button>
          <div class="profile-suggestion-list" data-profile-suggestions></div>
          <button class="profile-expand-button" type="button" data-profile-expand="suggestions" hidden>
            Se alle indsendte podcasts
          </button>
        </section>
        ${getAdminPodcastSuggestionsSectionMarkup()}
        <section class="profile-panel profile-episode-ratings-panel is-collapsed" id="profileEpisodeRatings" aria-labelledby="profileEpisodeRatingsHeading">
          <header class="profile-panel__header" data-profile-panel-header>
            <div>
              <p class="profile-eyebrow">Episoder</p>
              <h2 id="profileEpisodeRatingsHeading">Dine episodevurderinger</h2>
            </div>
            <div class="profile-panel__tools">
              <span data-profile-episode-ratings-count></span>
              <button class="profile-panel__toggle" type="button" data-profile-panel-toggle aria-expanded="false" aria-controls="profileEpisodeRatingsList">Fold ud</button>
            </div>
          </header>
          <p class="profile-panel__note">
            Dine vurderinger af enkelte episoder er adskilt fra dine podcastvurderinger.
          </p>
          <div class="profile-episode-list" id="profileEpisodeRatingsList" data-profile-episode-ratings></div>
          <button class="profile-expand-button" type="button" data-profile-episode-ratings-more hidden>
            Vis flere episodevurderinger
          </button>
        </section>

      </div>

      <aside class="profile-sidebar" aria-label="Profilmenu">
        <section class="profile-menu profile-menu--settings">
          <h2>Indstillinger</h2>
          <a class="profile-menu__item" href="#profil-indstillinger">
            <span aria-hidden="true">${getProfileMenuIconMarkup("settings")}</span>
            <span><strong>Rediger profil</strong><small>Konto, privatliv og data</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <a class="profile-menu__item" href="#profil-indstillinger">
            <span aria-hidden="true">${getProfileMenuIconMarkup("settings")}</span>
            <span><strong>Præferencer</strong><small>Personlige anbefalinger</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <a class="profile-menu__item" href="#profil-indstillinger">
            <span aria-hidden="true">${getProfileMenuIconMarkup("settings")}</span>
            <span><strong>Privatliv/data</strong><small>Eksport og kontosletning</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <button class="profile-menu__item profile-menu__item--logout" type="button" data-profile-logout ${state.authBusy ? "disabled" : ""}>
            <span aria-hidden="true">${getProfileMenuIconMarkup("logout")}</span>
            <span><strong>Log ud</strong><small>Afslut din session</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </button>
        </section>
        <section class="profile-menu profile-menu--help">
          <h2>FAQ / Hjælp</h2>
          <a class="profile-menu__item" href="#profil-faq">
            <span aria-hidden="true">${getProfileMenuIconMarkup("help")}</span>
            <span><strong>Hjælpecenter</strong><small>Få svar på almindelige spørgsmål</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <a class="profile-menu__item" href="mailto:podcastlisten.dk@gmail.com">
            <span aria-hidden="true">@</span>
            <span><strong>Kontakt os</strong><small>Send os en besked</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <a class="profile-menu__item" href="#om-podcastlisten">
            <span aria-hidden="true">i</span>
            <span><strong>Om Podcastlisten.dk</strong><small>Læs om idéen bag siden</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
        </section>
        <section class="profile-tip-card">
          <p class="profile-eyebrow">Tip til dig</p>
          <h2>Find din næste favorit</h2>
          <p>Udforsk podcasts baseret på dine vurderinger og gemte favoritter.</p>
          <a href="#udforsk">Udforsk podcasts</a>
        </section>
      </aside>

      ${getSuggestionDialogMarkup("profileSuggestionTitle")}
    </section>
  `;

  bindMobileToplineProfileButtons(container);
  bindHomeAccountMenu(container);

  container
    .querySelectorAll("[data-profile-logout]")
    .forEach((button) => button.addEventListener("click", handleLogout));

  container.querySelectorAll("[data-profile-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      document.getElementById(button.dataset.profileScroll)?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  container.querySelectorAll("[data-profile-ratings-sort]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextSort = ["alpha", "score", "score-low"].includes(
        button.dataset.profileRatingsSort
      )
        ? button.dataset.profileRatingsSort
        : "alpha";
      if (state.profileRatingsSort === nextSort) return;
      state.profileRatingsSort = nextSort;
      renderProfilePage();
      document.getElementById("profileRatings")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  const savedContainer = container.querySelector("[data-profile-saved]");
  if (savedContainer) {
    savedContainer.id = "profileSavedList";
    renderProfileSavedPreview();
  }

  container.querySelector("[data-profile-saved-toggle]")?.addEventListener("click", () => {
    const nextExpanded = !state.profileSavedExpanded;
    state.profileSavedExpanded = nextExpanded;
    if (!nextExpanded && isProfileSavedRoute()) {
      window.history.replaceState(null, "", "#profil");
    }
    renderProfilePage();
    window.requestAnimationFrame(() => {
      document.getElementById("profileSaved")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });

  container.querySelectorAll("[data-profile-modal]").forEach((button) => {
    button.addEventListener("click", () => {
      openProfileListDialog(button.dataset.profileModal);
    });
  });

  container
    .querySelector("[data-profile-settings-hub]")
    ?.addEventListener("click", openProfileSettingsHubDialog);

  const ratingsContainer = container.querySelector("[data-profile-ratings]");
  if (ratedPodcasts.length) {
    const ratingsFragment = document.createDocumentFragment();
    const ratingsToRender = renderDesktopProfileDashboard ? desktopTopRatings : ratedPodcasts;
    ratingsToRender.forEach(({ podcast, rating }) => {
      ratingsFragment.appendChild(
        createProfilePodcastCardElement(podcast, formatCompactRating(rating), "rating")
      );
    });
    ratingsContainer.appendChild(ratingsFragment);
    const ratingsExpandButton = container.querySelector("[data-profile-expand='ratings']");
    if (ratingsExpandButton) {
      ratingsExpandButton.hidden = ratedPodcasts.length <= 4;
    }
  } else if (ratingCount === 0) {
    ratingsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Ingen vurderinger endnu</h3>
        <p>Find en podcast i ranglisten og giv den din egen score.</p>
        <a class="profile-button profile-button--quiet" href="#ranglister">Find podcasts</a>
      </div>
    `;
  } else {
    ratingsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Vurderingerne kunne ikke vises</h3>
        <p>De gemte vurderinger matcher ikke de aktuelle podcastdata.</p>
        <a class="profile-button profile-button--quiet" href="#ranglister">Se ranglister</a>
      </div>
    `;
  }

  const profileEpisodeState = getProfileEpisodeRatingsState();
  renderProfileEpisodeRatingsSectionContent(container);
  if (
    state.authUser &&
    !profileEpisodeState.loading &&
    profileEpisodeState.loadedFor !== state.authUser.id
  ) {
    fetchProfileEpisodeRatings();
  }

  renderProfileSuggestionsSectionContent(container);
  if (!suggestionsLoaded) {
    fetchProfileSuggestions();
  }

  if (isPodcastSuggestionAdmin()) {
    renderAdminPodcastSuggestionsPreview(container);
    if (state.adminPodcastSuggestionsLoadedFor !== state.authUser.id) {
      fetchPodcastSuggestionsForAdmin();
    }
  }

  const toggleProfilePanel = (panel) => {
    if (!panel) return;
    const button = panel.querySelector("[data-profile-panel-toggle]");
    const willExpand = panel.classList.contains("is-collapsed");
    panel.classList.toggle("is-collapsed", !willExpand);
    panel.classList.toggle("is-expanded", willExpand);
    button?.setAttribute("aria-expanded", String(willExpand));
    if (button) {
      button.textContent = willExpand ? "Fold sammen" : "Fold ud";
      if (!willExpand && isMobileViewport()) {
        panel.querySelector("h2")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        button.focus({ preventScroll: true });
      }
    }
  };

  container.querySelectorAll("[data-profile-panel-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      toggleProfilePanel(button.closest(".profile-panel"));
    });
  });

  container.querySelectorAll("[data-profile-panel-header]").forEach((header) => {
    header.setAttribute("role", "button");
    header.tabIndex = 0;
    header.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, select, textarea")) return;
      toggleProfilePanel(header.closest(".profile-panel"));
    });
    header.addEventListener("keydown", (event) => {
      if (event.target !== header || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      toggleProfilePanel(header.closest(".profile-panel"));
    });
  });

  container.querySelectorAll("[data-profile-expand]").forEach((button) => {
    button.addEventListener("click", () => {
      const panel = button.closest(".profile-panel");
      const type = button.dataset.profileExpand;
      if (isMobileViewport()) {
        const isExpanded = panel?.classList.toggle("is-expanded");
        panel?.classList.toggle("is-collapsed", !isExpanded);
        button.textContent =
          type === "suggestions"
            ? isExpanded
              ? "Vis færre"
              : "Se alle forslag"
            : isExpanded
              ? "Vis færre"
              : "Se alle vurderinger";
        return;
      }
      openProfileListDialog(type);
    });
  });

  bindSuggestionDialog(container);

  if (isProfileSavedRoute()) {
    window.requestAnimationFrame(() => {
      document.getElementById("profileSaved")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  }
}

function closeProfileListDialog() {
  const dialog = document.getElementById("profileListDialog");
  if (!dialog) return;
  dialog.remove();
  if (
    elements.authDialog?.classList.contains("is-hidden") &&
    elements.ratingDialog?.classList.contains("is-hidden") &&
    !document.getElementById("podcastDetailSheet")?.classList.contains("is-open")
  ) {
    document.body.classList.remove("has-dialog-open");
  }
}

function openProfileSettingsHubDialog() {
  closeProfileListDialog();
  document.getElementById("profileSettingsHubDialog")?.remove();

  const dialog = document.createElement("div");
  dialog.id = "profileSettingsHubDialog";
  dialog.className = "profile-list-dialog profile-settings-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "profileSettingsHubTitle");
  dialog.innerHTML = `
    <section class="profile-list-dialog__sheet profile-settings-dialog__sheet">
      <header class="profile-list-dialog__header profile-settings-dialog__header">
        <div>
          <p class="profile-eyebrow">Din konto</p>
          <h2 id="profileSettingsHubTitle">Indstillinger &amp; hjælp</h2>
          <p class="profile-settings-dialog__intro">Konto, hjælp og praktiske oplysninger samlet ét sted.</p>
        </div>
        <button class="profile-list-dialog__close" type="button" aria-label="Luk">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="m7 7 10 10"></path>
            <path d="M17 7 7 17"></path>
          </svg>
        </button>
      </header>
      <div class="profile-settings-dialog__body">
        <nav class="profile-settings-dialog__menu" aria-label="Indstillinger og hjælp">
          <a class="profile-settings-dialog__item profile-settings-dialog__item--primary" href="#profil-indstillinger">
            <span aria-hidden="true">${getProfileMenuIconMarkup("settings")}</span>
            <span><strong>Konto &amp; indstillinger</strong><small>Navn, adgangskode, visning og privatliv</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <a class="profile-settings-dialog__item" href="#profil-faq">
            <span aria-hidden="true">${getProfileMenuIconMarkup("help")}</span>
            <span><strong>Hjælp, FAQ &amp; om Podcastlisten.dk</strong><small>Spørgsmål, svar og information om siden</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <a class="profile-settings-dialog__item" href="mailto:podcastlisten.dk@gmail.com">
            <span class="profile-settings-dialog__text-icon" aria-hidden="true">@</span>
            <span><strong>Kontakt</strong><small>Skriv til Podcastlisten.dk</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </a>
          <button class="profile-settings-dialog__item profile-settings-dialog__item--logout" type="button" data-profile-logout ${state.authBusy ? "disabled" : ""}>
            <span aria-hidden="true">${getProfileMenuIconMarkup("logout")}</span>
            <span><strong>Log ud</strong><small>Afslut din session</small></span>
            <em aria-hidden="true">&rsaquo;</em>
          </button>
        </nav>
      </div>
    </section>
  `;

  const close = () => {
    dialog.remove();
    if (
      elements.authDialog?.classList.contains("is-hidden") &&
      elements.ratingDialog?.classList.contains("is-hidden") &&
      !document.getElementById("podcastDetailSheet")?.classList.contains("is-open")
    ) {
      document.body.classList.remove("has-dialog-open");
    }
  };

  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  dialog.querySelector(".profile-list-dialog__close")?.addEventListener("click", close);
  dialog.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  dialog.querySelector("[data-profile-logout]")?.addEventListener("click", () => {
    close();
    handleLogout();
  });

  document.body.appendChild(dialog);
  document.body.classList.add("has-dialog-open");
  dialog.querySelector(".profile-list-dialog__close")?.focus();
}

function openProfileListDialog(type) {
  const dialogTypes = {
    saved: {
      title: "Alle gemte podcasts",
      emptyTitle: "Ingen gemte podcasts endnu",
      emptyCopy: "Gem podcasts fra ranglisten, s\u00e5 dukker de op her.",
      items: getSavedPodcasts(),
      createCard: (podcast) => createSavedPodcastCardElement(podcast, { compactLibrary: true })
    },
    ratings: {
      title: "Alle vurderinger",
      emptyTitle: "Ingen vurderinger endnu",
      emptyCopy: "Find en podcast i ranglisten og giv den din egen score.",
      items: getProfileRatedPodcasts(),
      createCard: ({ podcast, rating }) =>
        createProfilePodcastCardElement(podcast, formatCompactRating(rating), "rating")
    },
    suggestions: {
      title: "Alle indsendte podcasts",
      emptyTitle: "Ingen podcastforslag endnu",
      emptyCopy: "Foresl\u00e5 den her, hvis der mangler en podcast p\u00e5 listen.",
      items: state.profileSuggestions || [],
      createCard: (suggestion) => createProfileSuggestionCardElement(suggestion)
    },
    episodes: {
      title: "Alle episodevurderinger",
      emptyTitle: "Ingen episodevurderinger endnu",
      emptyCopy: "Vurder en episode, s\u00e5 dukker den op her.",
      items: getProfileEpisodeRatingsState().items || [],
      createCard: (item) => createProfileEpisodeRatingCardElement(item)
    }
  };
  const config = dialogTypes[type];
  if (!config) return;

  closeProfileListDialog();
  const dialog = document.createElement("div");
  dialog.id = "profileListDialog";
  dialog.className = `profile-list-dialog profile-list-dialog--${type}`;
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "profileListDialogTitle");

  const content = document.createElement("section");
  content.className = `profile-list-dialog__sheet profile-list-dialog__sheet--${type}`;
  content.innerHTML = `
    <header class="profile-list-dialog__header">
      <h2 id="profileListDialogTitle">${escapeHtml(config.title)}</h2>
      <button class="profile-list-dialog__close" type="button" aria-label="Luk">&times;</button>
    </header>
    <div class="profile-list-dialog__body"></div>
  `;
  const body = content.querySelector(".profile-list-dialog__body");
  if (config.items.length) {
    const list = document.createElement("div");
    list.className = `profile-list-dialog__list profile-list-dialog__list--${type}`;
    config.items.forEach((item) => list.appendChild(config.createCard(item)));
    body.appendChild(list);
  } else {
    body.innerHTML = `
      <div class="profile-empty-state">
        <h3>${escapeHtml(config.emptyTitle)}</h3>
        <p>${escapeHtml(config.emptyCopy)}</p>
      </div>
    `;
  }

  dialog.appendChild(content);
  document.body.appendChild(dialog);
  document.body.classList.add("has-dialog-open");

  const close = () => closeProfileListDialog();
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  dialog.querySelector(".profile-list-dialog__close")?.addEventListener("click", close);
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });
  content.querySelector(".profile-list-dialog__close")?.focus();
}

function createSavedPodcastCardElement(podcast, { compactLibrary = false } = {}) {
  const podcastKey = getPodcastKey(podcast);
  const communityStat = getCommunityStat(podcastKey);
  const card = document.createElement("article");
  card.className = `saved-card${compactLibrary ? " saved-card--library" : ""}`;
  card.dataset.podcastId = podcastKey;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Vis detaljer om ${podcast.title}`);

  const cover = document.createElement("div");
  cover.className = "saved-card__cover";

  const image = document.createElement("img");
  image.className = "saved-card__image";
  image.loading = "lazy";

  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder saved-card__placeholder";
  placeholder.textContent = "Billede mangler";
  placeholder.hidden = true;

  cover.append(image, placeholder);
  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  const copy = document.createElement("div");
  copy.className = "saved-card__copy";
  if (compactLibrary) {
    const details = [podcast.publisher, podcast.genre].filter(Boolean).join(" · ");
    copy.innerHTML = `
      <h2>${escapeHtml(podcast.title)}</h2>
      <p class="saved-card__host">${escapeHtml(podcast.host || podcast.publisher || "")}</p>
      ${details ? `<p class="saved-card__meta">${escapeHtml(details)}</p>` : ""}
      <p class="saved-card__date">${escapeHtml(getSavedPodcastDateLabel(podcastKey))}</p>
    `;
  } else {
    const meta = [podcast.host || podcast.publisher, podcast.genre].filter(Boolean).join(" / ");
    copy.innerHTML = `
      <h2>${escapeHtml(podcast.title)}</h2>
      <p>${escapeHtml(meta)}</p>
      <p class="saved-card__date">${escapeHtml(getSavedPodcastDateLabel(podcastKey))}</p>
    `;
  }

  const scores = document.createElement("div");
  scores.className = "saved-card__scores";

  const hasUserScore = hasCommunityRating(communityStat);
  const featuredScore = hasUserScore
    ? parseNumber(communityStat.averageRating)
    : parseNumber(podcast.ratingValue);
  const featuredScoreLabel = hasUserScore ? "Brugere" : "Podcastlisten";

  if (featuredScore !== null) {
    scores.innerHTML = `
      <span class="saved-card__featured-score saved-card__featured-score--${hasUserScore ? "users" : "podcastlisten"}">
        <span class="saved-card__featured-score-star" aria-hidden="true">&#9733;</span>
        <small>${featuredScoreLabel}</small>
        <strong>${escapeHtml(formatCompactRating(featuredScore))}/10</strong>
      </span>
    `;
    scores.setAttribute(
      "aria-label",
      `${featuredScoreLabel} ${formatCompactRating(featuredScore)} ud af 10`
    );
    if (!compactLibrary) cover.appendChild(scores);
  }

  const actions = document.createElement("div");
  actions.className = "saved-card__actions";

  if (podcast.link && !compactLibrary) {
    const openLink = document.createElement("a");
    openLink.className = "saved-button saved-button--primary";
    openLink.href = podcast.link;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "\u00c5bn podcast";
    actions.appendChild(openLink);
  }

  const removeButton = document.createElement("button");
  removeButton.className = "saved-button saved-button--remove";
  removeButton.type = "button";
  removeButton.setAttribute("aria-label", "Fjern fra gemte");
  removeButton.title = "Fjern fra gemte";
  removeButton.innerHTML = `
    <svg class="saved-button__heart" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 4.5h11a1 1 0 0 1 1 1v15l-6.5-4-6.5 4v-15a1 1 0 0 1 1-1Z" /></svg>
    <span class="saved-button__label">Fjern fra gemte</span>
  `;
  removeButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    removeSavedPodcastFromProfileCard(podcast, card, removeButton);
  });
  actions.appendChild(removeButton);

  card.append(cover, copy);
  if (compactLibrary && featuredScore !== null) card.appendChild(scores);
  card.appendChild(actions);
  card.addEventListener("click", (event) => {
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  });
  return card;
}

function renderSavedPage() {
  const container = elements.pageIntroPanel;
  if (!container) return;

  container.innerHTML = "";
  container.classList.remove("is-hidden");

  if (state.authConfigured && !state.authReady) {
    container.innerHTML = `
      <section class="saved-page">
        <div class="saved-state-card" aria-live="polite">
          <p class="saved-eyebrow">Dit bibliotek</p>
          <h1>Indl&aelig;ser gemte podcasts&hellip;</h1>
          <p>Vi kontrollerer din loginstatus og henter dit bibliotek.</p>
        </div>
      </section>
    `;
    return;
  }

  if (!isLoggedIn()) {
    const disabled = !state.authConfigured || state.authBusy ? "disabled" : "";
    const availabilityMessage = state.authConfigured
      ? "Log ind for at se de podcasts, du har gemt til senere."
      : "Login er ikke tilg&aelig;ngeligt, fordi auth ikke er konfigureret.";

    container.innerHTML = `
      <section class="saved-page">
        <div class="saved-state-card saved-state-card--logged-out">
          <p class="saved-eyebrow">Dit podcastbibliotek</p>
          <h1>Gemte podcasts</h1>
          <p>${availabilityMessage}</p>
          <div class="saved-actions">
            <button class="saved-button saved-button--primary" type="button" data-auth-prompt="login" ${disabled}>
              Log ind
            </button>
            <button class="saved-button saved-button--secondary" type="button" data-auth-prompt="signup" ${disabled}>
              Opret konto
            </button>
            <a class="saved-button saved-button--quiet" href="#ranglister">Se ranglister</a>
          </div>
        </div>
      </section>
    `;

    bindAuthPromptButtons(container);
    return;
  }

  const savedCount = state.savedPodcastKeys.size;
  const savedPodcasts = getSavedPodcasts();
  const unmatchedCount = Math.max(0, savedCount - savedPodcasts.length);

  container.innerHTML = `
    <section class="saved-page">
      <header class="saved-header">
        <div>
          <p class="saved-eyebrow">Dit bibliotek</p>
          <h1>Gemte podcasts</h1>
          <p>De podcasts, du har gemt til senere, vises alfabetisk.</p>
        </div>
        <div class="saved-header__aside">
          <div class="saved-count" aria-label="Antal gemte podcasts">
            <strong>${savedCount}</strong>
            <span>${savedCount === 1 ? "gemt podcast" : "gemte podcasts"}</span>
          </div>
          <a class="saved-button saved-button--primary" href="#ranglister">Find flere podcasts</a>
        </div>
      </header>
      ${
        unmatchedCount
          ? `<p class="saved-notice">${unmatchedCount} ${
              unmatchedCount === 1 ? "gemt podcast matcher" : "gemte podcasts matcher"
            } ikke l&aelig;ngere det aktuelle datagrundlag.</p>`
          : ""
      }
      <div class="saved-grid" data-saved-grid></div>
    </section>
  `;

  const grid = container.querySelector("[data-saved-grid]");
  if (savedPodcasts.length) {
    const fragment = document.createDocumentFragment();
    savedPodcasts.forEach((podcast) => {
      fragment.appendChild(createSavedPodcastCardElement(podcast));
    });
    grid.appendChild(fragment);
    return;
  }

  grid.innerHTML = `
    <div class="saved-empty-state">
      <h2>${savedCount ? "Ingen gemte podcasts kan vises" : "Ingen gemte podcasts endnu"}</h2>
      <p>${
        savedCount
          ? "Dine gemte n&oslash;gler matcher ikke de aktuelle podcastdata."
          : "G&aring; p&aring; opdagelse i ranglisten og gem de podcasts, du vil finde igen."
      }</p>
      <a class="saved-button saved-button--primary" href="#ranglister">Se ranglister</a>
    </div>
  `;
}

function getExploreDisplayScore(podcast) {
  const communityStat = getCommunityStat(getPodcastKey(podcast));
  const communityRating = parseNumber(communityStat?.averageRating);
  const podcastlistenRating = parseNumber(podcast?.ratingValue);

  if (communityRating !== null) {
    return {
      value: communityRating,
      source: "Brugere",
      count: Number(communityStat?.ratingCount || 0)
    };
  }

  if (podcastlistenRating !== null) {
    return {
      value: podcastlistenRating,
      source: "Podcastlisten",
      count: 0
    };
  }

  return {
    value: null,
    source: "",
    count: 0
  };
}

function getExploreScoreMarkup(podcast, className) {
  const score = getExploreDisplayScore(podcast);

  if (score.value === null) {
    return "";
  }

  return `
    <div class="${className}" data-score-source="${escapeHtml(score.source)}">
      <p class="explore-card__community-score">
        <span class="explore-card__community-star" aria-hidden="true">&#9733;</span>
        <span>${escapeHtml(score.source)}</span>
        <strong>${escapeHtml(formatCompactRating(score.value))}/10</strong>
      </p>
    </div>
  `;
}

function getValidUserRatingCount() {
  return Object.values(state.userRatingsByKey).filter((rating) => {
    const numericRating = parseNumber(rating);
    return numericRating !== null && numericRating >= 0 && numericRating <= 10;
  }).length;
}

function getExploreRecommendationDepth(validRatingCount = getValidUserRatingCount()) {
  if (validRatingCount <= 0) {
    return {
      personalSectionLimit: 0,
      favoriteGenreLimit: 0,
      explainer: "Log ind eller opret en konto, og vurder podcasts for at få personlige anbefalinger.",
      compactExplainer: "Log ind eller opret en konto, og vurder podcasts for at få personlige anbefalinger."
    };
  }

  if (validRatingCount === 1) {
    return {
      personalSectionLimit: 1,
      favoriteGenreLimit: 0,
      explainer: "Vurder podcasts for at få personlige anbefalinger.",
      compactExplainer: "Vurder podcasts for at få personlige anbefalinger."
    };
  }

  if (validRatingCount <= 3) {
    return {
      personalSectionLimit: 2,
      favoriteGenreLimit: 1,
      explainer: "Vurder podcasts for at få personlige anbefalinger.",
      compactExplainer: "Vurder podcasts for at få personlige anbefalinger."
    };
  }

  if (validRatingCount <= 6) {
    return {
      personalSectionLimit: 3,
      favoriteGenreLimit: 1,
      explainer: "Vurder podcasts for at få personlige anbefalinger.",
      compactExplainer: "Vurder podcasts for at få personlige anbefalinger."
    };
  }

  return {
    // Keep Udforsk focused: four personal rows, one editorial row and one genre row.
    personalSectionLimit: 4,
    favoriteGenreLimit: 1,
    explainer: "Vurder podcasts for at få personlige anbefalinger.",
    compactExplainer: "Vurder podcasts for at få personlige anbefalinger."
  };
}

function getExploreOnboardingMarkup({ personalSections = [] } = {}) {
  const loggedIn = isLoggedIn();

  if (!loggedIn && !isMobileViewport()) {
    return "";
  }

  const validRatingCount = getValidUserRatingCount();
  const shouldShowLoggedInHint = loggedIn && validRatingCount <= 2;

  if (!shouldShowLoggedInHint) {
    return "";
  }

  return `
    <section class="explore-onboarding-card" aria-labelledby="exploreOnboardingHeading">
      <div class="explore-onboarding-card__icon" aria-hidden="true">&#9733;</div>
      <div class="explore-onboarding-card__copy">
        <p class="explore-eyebrow">G&oslash;r Udforsk personlig</p>
        <h2 id="exploreOnboardingHeading">Vurd&eacute;r podcasts og f&aring; personlige anbefalinger</h2>
        <p>${escapeHtml(getExploreRecommendationDepth(validRatingCount).explainer)}</p>
        <a class="explore-onboarding-card__button" href="#ranglister">Find podcasts at vurdere</a>
      </div>
    </section>
  `;
}

function getExploreGateMarkup() {
  if (isLoggedIn() || !isMobileViewport()) return "";

  return `
    <section class="explore-inline-gate" data-explore-gate aria-labelledby="exploreGateTitle">
      <div class="explore-inline-gate__icon" aria-hidden="true">&#9733;</div>
      <div class="explore-inline-gate__copy">
        <p class="explore-eyebrow">Personlige anbefalinger</p>
        <h2 id="exploreGateTitle">Log ind og f&aring; podcasts valgt til dig</h2>
        <p>Log ind eller opret en konto, og vurd&eacute;r podcasts for at f&aring; personlige anbefalinger.</p>
      </div>
      <div class="explore-inline-gate__actions">
        <button class="explore-inline-gate__button explore-inline-gate__button--primary" type="button" data-auth-prompt="login">Log ind</button>
        <button class="explore-inline-gate__button explore-inline-gate__button--secondary" type="button" data-auth-prompt="signup">Opret dig</button>
      </div>
    </section>
  `;
}

function normalizeSuggestionUrl(value) {
  const raw = normalizeText(value);
  if (!raw) return "";

  try {
    return new URL(raw).href;
  } catch {
    return null;
  }
}

function getSuggestionErrorMessage(error) {
  const code = normalizeText(error?.code || "");
  const message = normalizeText(error?.message || "");
  const details = normalizeText(error?.details || "");
  const hint = normalizeText(error?.hint || "");
  const lower = `${message} ${details} ${hint}`.toLowerCase();

  if (
    code === "PGRST205" ||
    lower.includes("schema cache") ||
    lower.includes("could not find the table") ||
    lower.includes("relation \"podcast_suggestions\" does not exist") ||
    lower.includes("table podcast_suggestions does not exist")
  ) {
    return "Forslagstabellen er ikke klar endnu. Pr&oslash;v igen senere.";
  }

  if (
    code === "42501" ||
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized") ||
    lower.includes("violates row-level security")
  ) {
    return "Du har ikke adgang til at sende forslaget. Pr&oslash;v at logge ind igen.";
  }

  return "Forslaget kunne ikke sendes. Pr&oslash;v igen.";
}

function getSuggestionMutationErrorMessage(error, actionLabel = "opdatere") {
  const code = normalizeText(error?.code || "");
  const message = normalizeText(error?.message || "");
  const details = normalizeText(error?.details || "");
  const hint = normalizeText(error?.hint || "");
  const lower = `${message} ${details} ${hint}`.toLowerCase();

  if (
    code === "42501" ||
    lower.includes("row-level security") ||
    lower.includes("permission denied") ||
    lower.includes("not authorized") ||
    lower.includes("violates row-level security")
  ) {
    return `Du har ikke adgang til at ${actionLabel} forslaget. Supabase mangler muligvis en update/delete-policy for egne forslag.`;
  }

  return `Forslaget kunne ikke ${actionLabel}s. Pr&oslash;v igen.`;
}

function setSuggestionMessage(messageElement, message = "", tone = "info") {
  if (!messageElement) return;
  messageElement.innerHTML = message;
  messageElement.classList.toggle("is-hidden", !message);
  messageElement.dataset.tone = tone;
}

function getProfileSuggestionById(suggestionId) {
  const id = normalizeText(suggestionId);
  return state.profileSuggestions.find(
    (suggestion) => normalizeText(suggestion.id) === id
  );
}

function getSuggestionFormPayload(form) {
  const formData = new FormData(form);
  const title = normalizeText(formData.get("title"));
  const podcastUrl = normalizeSuggestionUrl(formData.get("podcast_url"));

  return {
    title,
    podcastUrl,
    payload: {
      title,
      podcast_url: podcastUrl || null,
      platform: normalizeText(formData.get("platform")) || null,
      comment: normalizeText(formData.get("comment")) || null
    }
  };
}

async function submitPodcastSuggestion(form, messageElement) {
  if (!form) return;

  const { title, podcastUrl, payload } = getSuggestionFormPayload(form);

  if (!title) {
    setSuggestionMessage(messageElement, "Skriv podcastens titel.", "warning");
    form.querySelector("[name='title']")?.focus();
    return;
  }

  if (podcastUrl === null) {
    setSuggestionMessage(messageElement, "Skriv et gyldigt link, eller lad feltet st&aring; tomt.", "warning");
    form.querySelector("[name='podcast_url']")?.focus();
    return;
  }

  if (!state.supabase) {
    setSuggestionMessage(
      messageElement,
      "Forslag kan ikke sendes endnu, fordi Supabase ikke er klar.",
      "error"
    );
    return;
  }

  const submitButton = form.querySelector("[type='submit']");
  if (submitButton) submitButton.disabled = true;
  setSuggestionMessage(messageElement, "");

  try {
    const {
      data: { session },
      error: sessionError
    } = await state.supabase.auth.getSession();

    if (sessionError) {
      console.warn("Podcast suggestion session lookup failed", sessionError);
    }

    const user = session?.user || null;
    state.session = session || null;
    state.authUser = user;
    renderAuthPanel();

    if (!user?.id) {
      setSuggestionMessage(
        messageElement,
        "Du skal v&aelig;re logget ind for at sende forslag.",
        "warning"
      );
      showAuthPrompt("login");
      return;
    }

    const activeEditId = state.activeSuggestionEditId;
    const mutation = activeEditId
      ? state.supabase
          .from("podcast_suggestions")
          .update(payload)
          .eq("id", activeEditId)
          .eq("suggested_by_user_id", user.id)
      : state.supabase.from("podcast_suggestions").insert({
          ...payload,
          suggested_by_user_id: user.id,
          suggested_by_email: user.email || null,
          status: "new"
        });

    const { error } = await mutation;
    if (error) throw error;

    if (activeEditId) {
      state.profileSuggestions = state.profileSuggestions.map((suggestion) =>
        normalizeText(suggestion.id) === normalizeText(activeEditId)
          ? { ...suggestion, ...payload }
          : suggestion
      );
    }
    form.reset();
    state.activeSuggestionEditId = null;
    if (!activeEditId) {
      state.profileSuggestionsLoadedFor = null;
    }
    const successState = form
      .closest(".explore-suggestion-dialog__panel")
      ?.querySelector("[data-explore-suggest-success]");
    const successTitle = successState?.querySelector("[data-explore-suggest-success-title]");
    const successCopy = successState?.querySelector("[data-explore-suggest-success-copy]");
    if (successTitle) {
      successTitle.textContent = activeEditId ? "Forslaget er opdateret" : "Tak for forslaget!";
    }
    if (successCopy) {
      successCopy.textContent = activeEditId
        ? "Dine \u00e6ndringer er gemt."
        : "Vi kigger p\u00e5 den.";
    }
    form.hidden = true;
    successState?.classList.remove("is-hidden");
    setSuggestionMessage(messageElement, "");
  } catch (error) {
    console.warn("Podcast suggestion submit failed", error);
    setSuggestionMessage(
      messageElement,
      state.activeSuggestionEditId
        ? getSuggestionMutationErrorMessage(error, "opdatere")
        : getSuggestionErrorMessage(error),
      "error"
    );
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function getExplorePodcastStats(podcast) {
  const stat = getCommunityStat(getPodcastKey(podcast));
  return {
    hasCommunityRating: hasCommunityRating(stat),
    communityRating: parseNumber(stat?.averageRating) ?? 0,
    ratingCount: Number(stat?.ratingCount || 0),
    madsRating: parseNumber(podcast.ratingValue) ?? 0
  };
}

function getExploreSearchParts(searchTerm) {
  return expandSearchAliases(searchTerm)
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesExploreFilters(podcast, searchParts = [], genre = "Alle") {
  if (genre !== "Alle" && podcast.genre !== genre) {
    return false;
  }

  return searchParts.every((part) => podcast.searchText.includes(part));
}

function getExploreSeedPodcasts() {
  const ratedSeeds = Object.entries(state.userRatingsByKey)
    .map(([key, rating]) => ({
      podcast: state.podcastByKey[key],
      rating: parseNumber(rating) ?? 0,
      source: "rating"
    }))
    .filter((item) => item.podcast && item.rating >= 7)
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return normalizeText(a.podcast.title).localeCompare(normalizeText(b.podcast.title), "da", {
        sensitivity: "base"
      });
    });
  const seeds = ratedSeeds.filter((item) => item.rating >= 8);

  if (seeds.length < 3) {
    ratedSeeds.forEach((seed) => {
      if (seed.rating >= 8) return;
      if (seeds.some((item) => getPodcastKey(item.podcast) === getPodcastKey(seed.podcast))) return;
      seeds.push(seed);
    });
  }

  if (seeds.length >= 3) {
    return seeds;
  }

  const existingKeys = new Set(seeds.map((item) => getPodcastKey(item.podcast)));
  Array.from(state.savedPodcastKeys).forEach((key) => {
    if (existingKeys.has(key)) return;
    const podcast = state.podcastByKey[key];
    if (!podcast) return;
    seeds.push({ podcast, rating: 0, source: "saved" });
    existingKeys.add(key);
  });

  return seeds;
}

function addExploreSignal(map, value, weight) {
  const normalized = normalizeComparable(value);
  if (!normalized) return;
  map.set(normalized, (map.get(normalized) || 0) + weight);
}

function addExploreHostSignal(signals, value, weight) {
  const host = normalizeText(value);
  if (!host) return;

  const existing = signals.find((signal) => hostsMatchComparable(signal.value, host));
  if (existing) {
    existing.weight += weight;
    return;
  }

  signals.push({ value: host, weight });
}

function getExplorePreferenceProfile() {
  const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
  const savedKeys = new Set(state.savedPodcastKeys);
  const ratingSeeds = Object.entries(state.userRatingsByKey)
    .map(([key, rating]) => ({
      key,
      podcast: state.podcastByKey[key],
      rating: parseNumber(rating) ?? 0,
      source: "rating"
    }))
    .filter((seed) => seed.podcast && seed.rating >= 7)
    .sort((a, b) => b.rating - a.rating);
  const savedSeeds = Array.from(savedKeys)
    .map((key) => ({
      key,
      podcast: state.podcastByKey[key],
      rating: 0,
      source: "saved"
    }))
    .filter((seed) => seed.podcast);
  const profile = {
    ratedKeys,
    savedKeys,
    seedKeys: new Set([...ratingSeeds, ...savedSeeds].map((seed) => seed.key)),
    ratingSeeds,
    savedSeeds,
    hostSignals: [],
    mainSeriesSignals: new Map(),
    publisherSignals: new Map(),
    genreSignals: new Map()
  };

  ratingSeeds.forEach((seed) => {
    const weight = Math.max(0.7, seed.rating / 5);
    addExploreHostSignal(profile.hostSignals, seed.podcast.host, weight);
    addExploreSignal(profile.mainSeriesSignals, seed.podcast.mainSeries, weight * 1.25);
    addExploreSignal(profile.publisherSignals, seed.podcast.publisher, weight * 0.95);
    addExploreSignal(profile.genreSignals, seed.podcast.genre, weight * 0.85);
  });

  savedSeeds.forEach((seed) => {
    const weight = profile.ratedKeys.has(seed.key) ? 0.35 : 0.75;
    addExploreHostSignal(profile.hostSignals, seed.podcast.host, weight);
    addExploreSignal(profile.mainSeriesSignals, seed.podcast.mainSeries, weight);
    addExploreSignal(profile.publisherSignals, seed.podcast.publisher, weight * 0.8);
    addExploreSignal(profile.genreSignals, seed.podcast.genre, weight * 0.7);
  });

  profile.hostSignals.sort((a, b) => b.weight - a.weight);
  return profile;
}

function getExploreRecommendationInputFingerprint() {
  const ratings = Object.entries(state.userRatingsByKey || {})
    .map(([key, rating]) => [normalizeText(key), parseNumber(rating)])
    .filter(([key, rating]) => key && rating !== null)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey, "da"));
  const savedKeys = Array.from(state.savedPodcastKeys || [])
    .map((key) => normalizeText(key))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, "da"));

  return String(
    getExploreShuffleSeed(
      JSON.stringify({ version: UDFORSK_RECOMMENDATION_VERSION, ratings, savedKeys })
    )
  );
}

function getExplorePersonalSnapshotUserKey() {
  return state.authUser?.id || null;
}

function readExplorePersonalSnapshot({ dayKey, fingerprint }) {
  const userKey = getExplorePersonalSnapshotUserKey();
  if (!userKey) return null;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(EXPLORE_PERSONAL_SNAPSHOT_STORAGE_KEY) || "{}");
    const snapshot = parsed?.byUser?.[userKey];
    if (
      !snapshot ||
      snapshot.version !== UDFORSK_RECOMMENDATION_VERSION ||
      snapshot.dayKey !== dayKey ||
      snapshot.fingerprint !== fingerprint ||
      !Array.isArray(snapshot.sections)
    ) {
      return null;
    }

    const sections = snapshot.sections
      .map((section) => ({
        ...section,
        items: (section.items || [])
          .map((item) => ({ ...item, podcast: state.podcastByKey[item.key] }))
          .filter((item) => item.podcast)
      }))
      .filter((section) => section.items.length >= EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE);

    return sections.length ? sections : null;
  } catch {
    return null;
  }
}

function persistExplorePersonalSnapshot(sections, { dayKey, fingerprint }) {
  const userKey = getExplorePersonalSnapshotUserKey();
  if (!userKey || !sections.length) return;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(EXPLORE_PERSONAL_SNAPSHOT_STORAGE_KEY) || "{}");
    const byUser = parsed?.byUser && typeof parsed.byUser === "object" ? parsed.byUser : {};
    byUser[userKey] = {
      version: UDFORSK_RECOMMENDATION_VERSION,
      dayKey,
      fingerprint,
      generatedAt: new Date().toISOString(),
      sections: sections.map((section) => ({
        eyebrow: section.eyebrow,
        title: section.title,
        note: section.note || "",
        seedPodcastKey: section.seedPodcastKey || "",
        seedPodcastTitle: section.seedPodcastTitle || "",
        seedSource: section.seedSource || "",
        seedRating: section.seedRating ?? null,
        items: section.items
          .map((item) => ({ key: getPodcastKey(item.podcast || item), reason: item.reason || "" }))
          .filter((item) => item.key)
      }))
    };
    window.localStorage.setItem(EXPLORE_PERSONAL_SNAPSHOT_STORAGE_KEY, JSON.stringify({ byUser }));
  } catch {
    // Recommendation snapshots are a convenience cache only.
  }
}

function invalidateExplorePersonalSnapshot() {
  const userKey = getExplorePersonalSnapshotUserKey();
  if (!userKey) return;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(EXPLORE_PERSONAL_SNAPSHOT_STORAGE_KEY) || "{}");
    if (!parsed?.byUser?.[userKey]) return;
    delete parsed.byUser[userKey];
    window.localStorage.setItem(EXPLORE_PERSONAL_SNAPSHOT_STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    // A mismatching input fingerprint still prevents stale snapshot reuse.
  }
}

function getExploreSignalWeight(map, value) {
  const normalized = normalizeComparable(value);
  return normalized ? map.get(normalized) || 0 : 0;
}

function getExploreHostSignalWeight(signals, host) {
  if (!host) return 0;
  return signals.reduce(
    (best, signal) => (hostsMatchComparable(signal.value, host) ? Math.max(best, signal.weight) : best),
    0
  );
}

function getExploreCandidateFit(candidate, profile) {
  const stats = getExplorePodcastStats(candidate);
  const mainSeriesWeight = getExploreSignalWeight(profile.mainSeriesSignals, candidate.mainSeries);
  const hostWeight = getExploreHostSignalWeight(profile.hostSignals, candidate.host);
  const publisherWeight = getExploreSignalWeight(profile.publisherSignals, candidate.publisher);
  const genreWeight = getExploreSignalWeight(profile.genreSignals, candidate.genre);
  const tasteScore =
    mainSeriesWeight * 4.8 +
    hostWeight * 4 +
    publisherWeight * 2.2 +
    genreWeight * 1.8;
  const qualityScore =
    stats.communityRating * 0.62 +
    stats.madsRating * 0.42 +
    Math.log(stats.ratingCount + 1) * 0.22;
  let reason = "Matcher din smag";

  if (mainSeriesWeight && candidate.mainSeries) {
    reason = `Mere fra ${candidate.mainSeries}`;
  } else if (hostWeight && candidate.host) {
    reason = `Mere med ${candidate.host}`;
  } else if (publisherWeight && candidate.publisher) {
    reason = `Mere fra ${candidate.publisher}`;
  } else if (genreWeight && candidate.genre) {
    reason = `Mere ${candidate.genre}`;
  }

  return {
    podcast: candidate,
    score: tasteScore + qualityScore,
    tasteScore,
    qualityScore,
    reason,
    stats,
    hasDirectHostOrSeries: Boolean(mainSeriesWeight || hostWeight)
  };
}

function getExplorePersonalCandidateItems(
  profile,
  {
    limit = 4,
    searchParts = [],
    genre = "Alle",
    usedKeys = new Set(),
    excludeKeys = new Set(),
    mode = "personal",
    minTasteScore = 0.1
  } = {}
) {
  return state.podcasts
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      return (
        key &&
        !profile.ratedKeys.has(key) &&
        !excludeKeys.has(key) &&
        !usedKeys.has(key) &&
        matchesExploreFilters(podcast, searchParts, genre)
      );
    })
    .map((podcast) => getExploreCandidateFit(podcast, profile))
    .filter((item) => {
      if (item.tasteScore < minTasteScore) return false;
      if (mode === "gems") {
        return (
          (item.stats.communityRating >= 8 || item.stats.madsRating >= 8) &&
          item.stats.ratingCount <= 10
        );
      }
      if (mode === "different") {
        return !item.hasDirectHostOrSeries && item.qualityScore >= 4.8;
      }
      if (mode === "new") {
        return Boolean(item.podcast.ratingDateObject || item.podcast.yearPlayed);
      }
      return item.score > 0;
    })
    .sort((a, b) => {
      if (mode === "gems") {
        const aHiddenBonus = Math.max(0, 12 - a.stats.ratingCount) * 0.35;
        const bHiddenBonus = Math.max(0, 12 - b.stats.ratingCount) * 0.35;
        const scoreDelta = b.score + bHiddenBonus - (a.score + aHiddenBonus);
        if (scoreDelta !== 0) return scoreDelta;
      }
      if (mode === "new") {
        const aTime = a.podcast.ratingDateObject ? a.podcast.ratingDateObject.getTime() : 0;
        const bTime = b.podcast.ratingDateObject ? b.podcast.ratingDateObject.getTime() : 0;
        if (bTime !== aTime) return bTime - aTime;
      }
      if (b.score !== a.score) return b.score - a.score;
      return b.stats.ratingCount - a.stats.ratingCount;
    })
    .slice(0, limit);
}

function getExploreRecommendationReason(candidate, seeds, stats = getExplorePodcastStats(candidate)) {
  const mainSeriesSeed = seeds.find(
    (seed) =>
      seed.podcast.mainSeries &&
      candidate.mainSeries &&
      normalizeComparable(seed.podcast.mainSeries) === normalizeComparable(candidate.mainSeries)
  );
  if (mainSeriesSeed?.podcast.mainSeries) {
    return `Mere fra ${mainSeriesSeed.podcast.mainSeries}`;
  }

  const hostSeed = seeds.find(
    (seed) =>
      seed.podcast.host &&
      candidate.host &&
      hostsMatchComparable(seed.podcast.host, candidate.host)
  );
  if (hostSeed?.podcast.host) {
    return `Mere med ${hostSeed.podcast.host}`;
  }

  const genreSeed = seeds.find((seed) => seed.podcast.genre && seed.podcast.genre === candidate.genre);
  if (genreSeed?.podcast.genre) {
    return `Fordi du kan lide ${genreSeed.podcast.genre}`;
  }

  const publisherSeed = seeds.find(
    (seed) =>
      seed.podcast.publisher &&
      candidate.publisher &&
      normalizeComparable(seed.podcast.publisher) === normalizeComparable(candidate.publisher)
  );
  if (publisherSeed?.podcast.publisher) {
    return `Mere fra ${publisherSeed.podcast.publisher}`;
  }

  if (stats.hasCommunityRating && stats.communityRating >= 8) {
    return "H\u00f8j brugerscore";
  }

  if (stats.madsRating >= 8) {
    return "Podcastlisten anbefaler";
  }

  return "Popul\u00e6r blandt brugere";
}

function scoreExploreRecommendation(candidate, seeds) {
  const stats = getExplorePodcastStats(candidate);
  const mainSeriesMatch = seeds.some(
    (seed) =>
      seed.podcast.mainSeries &&
      candidate.mainSeries &&
      normalizeComparable(seed.podcast.mainSeries) === normalizeComparable(candidate.mainSeries)
  );
  const genreMatch = seeds.some(
    (seed) => seed.podcast.genre && seed.podcast.genre === candidate.genre
  );
  const publisherMatch = seeds.some(
    (seed) =>
      seed.podcast.publisher &&
      candidate.publisher &&
      normalizeComparable(seed.podcast.publisher) === normalizeComparable(candidate.publisher)
  );
  const hostMatch = seeds.some(
    (seed) =>
      seed.podcast.host &&
      candidate.host &&
      hostsMatchComparable(seed.podcast.host, candidate.host)
  );

  const score =
    (mainSeriesMatch ? 4 : 0) +
    (hostMatch ? 3 : 0) +
    (genreMatch ? 2.5 : 0) +
    (publisherMatch ? 1.5 : 0) +
    stats.communityRating * 1.5 +
    Math.log(stats.ratingCount + 1) * 0.5 +
    stats.madsRating * 0.5;

  return {
    podcast: candidate,
    score: Number.isFinite(score) ? score : 0,
    reason: getExploreRecommendationReason(candidate, seeds, stats),
    stats
  };
}

function getExploreRecommendationItems({ limit = 8, searchParts = [], genre = "Alle" } = {}) {
  const seeds = getExploreSeedPodcasts();
  const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
  const seedKeys = new Set(seeds.map((seed) => getPodcastKey(seed.podcast)));

  if (!isLoggedIn() || !seeds.length) {
    return [];
  }

  const items = state.podcasts
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      return (
        !ratedKeys.has(key) &&
        !seedKeys.has(key) &&
        matchesExploreFilters(podcast, searchParts, genre)
      );
    })
    .map((podcast) => scoreExploreRecommendation(podcast, seeds))
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.stats.ratingCount !== a.stats.ratingCount) {
        return b.stats.ratingCount - a.stats.ratingCount;
      }
      return normalizeText(a.podcast.title).localeCompare(normalizeText(b.podcast.title), "da", {
        sensitivity: "base"
      });
    })
    .slice(0, limit);

  return items;
}

function getExploreRelatedSeed() {
  return getExploreSeedPodcasts().find((item) => item.source === "rating") || null;
}

function getExploreRelatedItems(seed, { limit = 6, searchParts = [], genre = "Alle" } = {}) {
  if (!seed?.podcast) return [];

  const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
  const seedKey = getPodcastKey(seed.podcast);

  return state.podcasts
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      if (key === seedKey || ratedKeys.has(key)) return false;
      if (!matchesExploreFilters(podcast, searchParts, genre)) return false;

      return (
        (seed.podcast.mainSeries &&
          podcast.mainSeries &&
          normalizeComparable(seed.podcast.mainSeries) ===
            normalizeComparable(podcast.mainSeries)) ||
        (seed.podcast.genre && podcast.genre === seed.podcast.genre) ||
        (seed.podcast.publisher &&
          podcast.publisher &&
          normalizeComparable(seed.podcast.publisher) === normalizeComparable(podcast.publisher)) ||
        (seed.podcast.host &&
          podcast.host &&
          hostsMatchComparable(seed.podcast.host, podcast.host))
      );
    })
    .map((podcast) => scoreExploreRecommendation(podcast, [seed]))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function getExploreSeedMatch(candidate, seed) {
  const sameMainSeries =
    seed.podcast.mainSeries &&
    candidate.mainSeries &&
    normalizeComparable(seed.podcast.mainSeries) === normalizeComparable(candidate.mainSeries);
  const sameHost =
    seed.podcast.host &&
    candidate.host &&
    hostsMatchComparable(seed.podcast.host, candidate.host);
  const sameGenre = seed.podcast.genre && seed.podcast.genre === candidate.genre;
  const samePublisher =
    seed.podcast.publisher &&
    candidate.publisher &&
    normalizeComparable(seed.podcast.publisher) === normalizeComparable(candidate.publisher);

  if (sameMainSeries) {
    return { weight: 4, reason: `Mere fra ${seed.podcast.mainSeries}` };
  }
  if (sameHost) {
    return { weight: 3, reason: `Mere med ${seed.podcast.host}` };
  }
  if (sameGenre) {
    return { weight: 2.5, reason: "Samme genre" };
  }
  if (samePublisher) {
    return { weight: 1.5, reason: "Samme udgiver" };
  }

  return null;
}

function getExploreProductSimilarityItems(
  seed,
  { limit = 4, searchParts = [], genre = "Alle", usedKeys = new Set() } = {}
) {
  if (state.podcastSimilarityProductStatus !== "ready") return null;

  const validated = getValidatedPodcastSimilarityProduct(seed?.podcast);
  if (!validated) return [];

  const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
  const sourceKey = getPodcastKey(seed.podcast);
  const seenKeys = new Set([...usedKeys, ...ratedKeys, sourceKey]);
  const items = [];

  const appendCandidates = (candidates, fallbackReason) => {
    for (const candidate of candidates || []) {
      if (items.length >= limit) break;

      const podcast =
        state.podcastSimilarityPodcastByRecommendationId[candidate?.recommendationId];
      const key = getPodcastKey(podcast);
      if (!podcast || !key || seenKeys.has(key)) continue;
      if (!matchesExploreFilters(podcast, searchParts, genre)) continue;

      seenKeys.add(key);
      items.push({
        podcast,
        reason: candidate?.similarityReason || fallbackReason,
        score: Number(candidate?.contentSimilarityScore || 0),
        stats: getExplorePodcastStats(podcast)
      });
    }
  };

  // The product already carries the canonical automatic-first ordering. Manual
  // supplementary results are intentionally considered only after automatic
  // matches leave open card slots.
  appendCandidates(
    validated.product.automaticSimilarResults,
    "Matcher din smag"
  );
  if (items.length < limit) {
    appendCandidates(
      validated.product.manualSupplementaryResults,
      "Supplerende lighed"
    );
  }

  return items;
}

function getExploreSeedSectionItems(
  seed,
  { limit = 4, searchParts = [], genre = "Alle", usedKeys = new Set() } = {}
) {
  if (state.podcastSimilarityProductStatus !== "ready") return [];

  const productItems = getExploreProductSimilarityItems(seed, {
    limit,
    searchParts,
    genre,
    usedKeys
  });
  if (productItems !== null) return productItems;

  // Product data may be unavailable during initial load. Keep the established
  // host/series/genre matcher as a temporary lower-priority fallback only.
  const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
  const seedKey = getPodcastKey(seed.podcast);

  return state.podcasts
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      return (
        key &&
        key !== seedKey &&
        !ratedKeys.has(key) &&
        !usedKeys.has(key) &&
        matchesExploreFilters(podcast, searchParts, genre) &&
        getExploreSeedMatch(podcast, seed)
      );
    })
    .map((podcast) => {
      const match = getExploreSeedMatch(podcast, seed);
      const scored = scoreExploreRecommendation(podcast, [seed]);
      return {
        podcast,
        reason: match.reason,
        score: scored.score + match.weight,
        stats: scored.stats
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.stats.ratingCount - a.stats.ratingCount;
    })
    .slice(0, limit);
}

function getDailyExploreRotationKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("");
}

function getDailyExploreRotationSeed(sectionKey, dayKey = getDailyExploreRotationKey()) {
  return getExploreShuffleSeed(`${dayKey}:${sectionKey}`) || 1;
}

function getExploreDayIndex(dayKey) {
  const text = String(dayKey || "");
  if (!/^\d{8}$/.test(text)) return null;
  const year = Number(text.slice(0, 4));
  const month = Number(text.slice(4, 6)) - 1;
  const day = Number(text.slice(6, 8));
  return Math.floor(Date.UTC(year, month, day) / 86400000);
}

function getExploreSeedDaysSinceShown(lastShownDate, dayKey = getDailyExploreRotationKey()) {
  const current = getExploreDayIndex(dayKey);
  const previous = getExploreDayIndex(lastShownDate);
  if (current === null || previous === null) return null;
  return current - previous;
}

function getExploreSeedHistoryUserKey() {
  return state.authUser?.id || null;
}

function readExplorePersonalSeedHistory(dayKey = getDailyExploreRotationKey()) {
  const userKey = getExploreSeedHistoryUserKey();
  if (!userKey) return {};

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(EXPLORE_PERSONAL_SEED_HISTORY_STORAGE_KEY) || "{}"
    );
    const storageState =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    const byUser =
      storageState.byUser &&
      typeof storageState.byUser === "object" &&
      !Array.isArray(storageState.byUser)
        ? storageState.byUser
        : {};
    const rawHistory =
      byUser[userKey] && typeof byUser[userKey] === "object" && !Array.isArray(byUser[userKey])
        ? byUser[userKey]
        : {};
    const history = {};
    let changed = false;

    Object.entries(rawHistory).forEach(([key, shownDate]) => {
      const daysSinceShown = getExploreSeedDaysSinceShown(shownDate, dayKey);
      if (daysSinceShown === null || daysSinceShown < 0 || daysSinceShown > EXPLORE_PERSONAL_SEED_HISTORY_MAX_AGE_DAYS) {
        changed = true;
        return;
      }
      history[key] = shownDate;
    });

    if (changed) {
      byUser[userKey] = history;
      window.localStorage.setItem(
        EXPLORE_PERSONAL_SEED_HISTORY_STORAGE_KEY,
        JSON.stringify({ byUser })
      );
    }

    return history;
  } catch {
    return {};
  }
}

function persistExplorePersonalSeedHistory(history) {
  const userKey = getExploreSeedHistoryUserKey();
  if (!userKey) return;

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(EXPLORE_PERSONAL_SEED_HISTORY_STORAGE_KEY) || "{}"
    );
    const storageState =
      parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
    const byUser =
      storageState.byUser &&
      typeof storageState.byUser === "object" &&
      !Array.isArray(storageState.byUser)
        ? storageState.byUser
        : {};
    byUser[userKey] = history;
    window.localStorage.setItem(
      EXPLORE_PERSONAL_SEED_HISTORY_STORAGE_KEY,
      JSON.stringify({ byUser })
    );
  } catch {
    // Freshness memory is convenience-only; Udforsk still works without localStorage.
  }
}

function markExplorePersonalSeedsShown(seeds, dayKey = getDailyExploreRotationKey()) {
  if (!seeds?.length) return;
  const history = readExplorePersonalSeedHistory(dayKey);
  seeds.forEach((seed) => {
    const key = seed?.key || getPodcastKey(seed?.podcast);
    if (key) history[key] = dayKey;
  });
  persistExplorePersonalSeedHistory(history);
}

function getExploreSeedTitle(seed) {
  return seed?.source === "saved"
    ? `Fordi du gemte ${seed.podcast.title}`
    : `Fordi du gav ${seed.podcast.title} ${formatCompactRating(seed.rating)}/10`;
}

function getExploreSeedUsability(seed, { searchParts = [], genre = "Alle" } = {}) {
  if (!seed?.podcast) return { ok: false, reason: "missing-podcast", count: 0 };

  const items = getExploreSeedSectionItems(seed, {
    limit: EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE,
    searchParts,
    genre,
    usedKeys: new Set()
  });

  if (items.length < EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE) {
    return { ok: false, reason: "too-few-recommendations", count: items.length };
  }

  return { ok: true, reason: "ok", count: items.length };
}

function getExploreDailySeedPool(profile, { searchParts = [], genre = "Alle" } = {}) {
  const dayKey = getDailyExploreRotationKey();
  const seedHistory = readExplorePersonalSeedHistory(dayKey);
  const seenKeys = new Set();
  const diagnostics = [];
  const candidates = [];

  const addCandidate = (seed) => {
    const key = seed?.key || getPodcastKey(seed?.podcast);
    if (!key || seenKeys.has(key)) return;
    seenKeys.add(key);

    if (seed.source === "rating" && seed.rating < 7) {
      diagnostics.push({ key, title: seed.podcast?.title || key, source: seed.source, skipped: "rating-below-7" });
      return;
    }

    const existingRating = parseNumber(state.userRatingsByKey[key]);
    if (seed.source === "saved" && existingRating !== null && existingRating < 7) {
      diagnostics.push({ key, title: seed.podcast?.title || key, source: seed.source, skipped: "saved-rating-below-7" });
      return;
    }

    const usability = getExploreSeedUsability(seed, { searchParts, genre });
    const lastShownDate = seedHistory[key] || null;
    const daysSinceShown = getExploreSeedDaysSinceShown(lastShownDate, dayKey);
    const freshnessGroup =
      daysSinceShown === null || daysSinceShown >= EXPLORE_PERSONAL_SEED_FRESHNESS_DAYS
        ? "fresh"
        : "recent";
    if (!usability.ok) {
      diagnostics.push({
        key,
        title: seed.podcast?.title || key,
        source: seed.source,
        skipped: usability.reason,
        recommendationCount: usability.count,
        lastShownDate,
        daysSinceShown,
        freshnessGroup,
        eligible: false
      });
      return;
    }

    candidates.push({ ...seed, key, lastShownDate, daysSinceShown, freshnessGroup });
    diagnostics.push({
      key,
      title: seed.podcast.title,
      source: seed.source,
      rating: seed.rating,
      selected: false,
      recommendationCount: usability.count,
      lastShownDate,
      daysSinceShown,
      freshnessGroup,
      eligible: true
    });
  };

  profile.ratingSeeds.forEach(addCandidate);
  profile.savedSeeds.forEach(addCandidate);

  if (candidates.length <= 1) {
    return { dayKey, seeds: candidates, diagnostics };
  }

  const seed = getDailyExploreRotationSeed("explore-personal-seeds", dayKey);
  const orderGroup = (items, groupKey) => {
    const groupOffset = groupKey === "fresh" ? 0 : 0x27d4eb2d;
    return [
      ...seededShuffle(
        items.filter((item) => item.freshnessGroup === groupKey && item.source === "rating" && item.rating >= 8),
        seed ^ groupOffset
      ),
      ...seededShuffle(
        items.filter((item) => item.freshnessGroup === groupKey && item.source === "rating" && item.rating < 8),
        seed ^ groupOffset ^ 0x9e3779b9
      ),
      ...seededShuffle(
        items.filter((item) => item.freshnessGroup === groupKey && item.source === "saved"),
        seed ^ groupOffset ^ 0x85ebca6b
      )
    ];
  };
  const ordered = [...orderGroup(candidates, "fresh"), ...orderGroup(candidates, "recent")];

  ordered.forEach((orderedSeed, index) => {
    const diagnostic = diagnostics.find((item) => item.key === orderedSeed.key);
    if (diagnostic) diagnostic.dailyOrder = index + 1;
  });

  return { dayKey, seeds: ordered, diagnostics };
}

function getExplorePersonalSections({
  limit = 4,
  maxSections = 5,
  searchParts = [],
  genre = "Alle"
} = {}) {
  if (!isLoggedIn()) return [];

  const profile = getExplorePreferenceProfile();
  const seedPool = getExploreDailySeedPool(profile, { searchParts, genre });
  const fingerprint = getExploreRecommendationInputFingerprint();
  const canUseSnapshot =
    state.podcastSimilarityProductStatus === "ready" &&
    !searchParts.length &&
    genre === "Alle";
  const cachedSections = canUseSnapshot
    ? readExplorePersonalSnapshot({ dayKey: seedPool.dayKey, fingerprint })
    : null;
  if (cachedSections) return cachedSections;
  const seeds = seedPool.seeds;
  const sections = [];
  const usedKeys = new Set();
  const sectionTitles = new Set();
  const renderedPersonalSeeds = [];

  const pushSection = (section, { minItems = EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE } = {}) => {
    if (!section?.items?.length || section.items.length < minItems) return false;
    if (sections.length >= maxSections || sectionTitles.has(section.title)) return false;

    section.items.forEach((item) => usedKeys.add(getPodcastKey(item.podcast || item)));
    sectionTitles.add(section.title);
    sections.push(section);
    return true;
  };

  const maxSeedSections = Math.max(1, Math.min(maxSections, 4));
  for (const seed of seeds) {
    if (sections.length >= maxSeedSections) break;
    const items = getExploreSeedSectionItems(seed, {
      limit,
      searchParts,
      genre,
      usedKeys
    });

    const pushed = pushSection({
      eyebrow: "Personlig anbefaling",
      title: getExploreSeedTitle(seed),
      seedPodcastKey: getPodcastKey(seed.podcast),
      seedPodcastTitle: seed.podcast.title,
      seedSource: seed.source,
      seedRating: seed.rating,
      items
    });

    if (pushed) {
      renderedPersonalSeeds.push(seed);
      const diagnostic = seedPool.diagnostics.find((item) => item.key === seed.key);
      if (diagnostic) diagnostic.selected = true;
    }
  }

  markExplorePersonalSeedsShown(renderedPersonalSeeds, seedPool.dayKey);

  for (const hostSignal of profile.hostSignals) {
    if (sections.length >= maxSections) break;
    const hostSeeds = profile.ratingSeeds.filter((seed) => hostsMatchComparable(hostSignal.value, seed.podcast.host));
    const excludeKeys = new Set(hostSeeds.map((seed) => seed.key));
    const items = state.podcasts
      .filter((podcast) => {
        const key = getPodcastKey(podcast);
        return (
          key &&
          !profile.ratedKeys.has(key) &&
          !usedKeys.has(key) &&
          !excludeKeys.has(key) &&
          podcast.host &&
          hostsMatchComparable(hostSignal.value, podcast.host) &&
          matchesExploreFilters(podcast, searchParts, genre)
        );
      })
      .map((podcast) => getExploreCandidateFit(podcast, profile))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    pushSection({
      eyebrow: "Mere med en favoritv\u00e6rt",
      title: `Mere med ${hostSignal.value}`,
      items
    });
  }

  const mainSeriesSignals = Array.from(profile.mainSeriesSignals.entries()).sort((a, b) => b[1] - a[1]);
  for (const [mainSeriesKey] of mainSeriesSignals) {
    if (sections.length >= maxSections) break;
    const mainSeriesSeed = profile.ratingSeeds.find(
      (seed) => normalizeComparable(seed.podcast.mainSeries) === mainSeriesKey
    );
    const mainSeriesLabel = mainSeriesSeed?.podcast.mainSeries;
    if (!mainSeriesLabel) continue;

    const excludeKeys = new Set(
      profile.ratingSeeds
        .filter((seed) => normalizeComparable(seed.podcast.mainSeries) === mainSeriesKey)
        .map((seed) => seed.key)
    );
    const items = state.podcasts
      .filter((podcast) => {
        const key = getPodcastKey(podcast);
        return (
          key &&
          !profile.ratedKeys.has(key) &&
          !usedKeys.has(key) &&
          !excludeKeys.has(key) &&
          podcast.mainSeries &&
          normalizeComparable(podcast.mainSeries) === mainSeriesKey &&
          matchesExploreFilters(podcast, searchParts, genre)
        );
      })
      .map((podcast) => getExploreCandidateFit(podcast, profile))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    pushSection({
      eyebrow: "Mere fra et univers",
      title: `Mere fra ${mainSeriesLabel}`,
      items
    });
  }

  if (profile.savedSeeds.length && sections.length < maxSections) {
    const items = getExplorePersonalCandidateItems(profile, {
      limit,
      searchParts,
      genre,
      usedKeys,
      excludeKeys: profile.savedKeys,
      minTasteScore: 0.1
    }).map((item) => ({
      ...item,
      reason: item.reason === "Matcher din smag" ? "Minder om dine gemte" : item.reason
    }));

    pushSection({
      eyebrow: "Baseret p\u00e5 dine gemte",
      title: "Podcasts fra dine gemte",
      note: "Podcasts der minder om dem, du har gemt.",
      items
    });
  }

  if (sections.length < maxSections) {
    const items = getExplorePersonalCandidateItems(profile, {
      limit,
      searchParts,
      genre,
      usedKeys,
      excludeKeys: profile.seedKeys,
      mode: "different",
      minTasteScore: 0.1
    }).map((item) => ({
      ...item,
      reason: "T\u00e6t p\u00e5 din smag"
    }));

    pushSection({
      eyebrow: "Lidt anderledes",
      title: "Pr\u00f8v noget lidt anderledes",
      note: "Podcasts t\u00e6t p\u00e5 din smag, men ikke helt det samme.",
      items
    });
  }

  if (sections.length < maxSections) {
    const items = getExplorePersonalCandidateItems(profile, {
      limit,
      searchParts,
      genre,
      usedKeys,
      excludeKeys: profile.seedKeys,
      mode: "new",
      minTasteScore: 0.1
    }).map((item) => ({
      ...item,
      reason: item.podcast.ratingDateLabel ? `Bed\u00f8mt ${item.podcast.ratingDateLabel}` : item.reason
    }));

    pushSection({
      eyebrow: "Nye fund",
      title: "Nye fund til dig",
      items
    });
  }

  state.explorePersonalSeedDebug = {
    dayKey: seedPool.dayKey,
    eligibleSeeds: seedPool.diagnostics,
    selectedSeeds: seedPool.diagnostics.filter((item) => item.selected)
  };

  const result = sections.slice(0, maxSections);
  if (canUseSnapshot) {
    persistExplorePersonalSnapshot(result, { dayKey: seedPool.dayKey, fingerprint });
  }
  return result;
}

if (typeof window !== "undefined") {
  window.debugExplorePersonalSeeds = () => {
    const debug = state.explorePersonalSeedDebug || {
      dayKey: getDailyExploreRotationKey(),
      eligibleSeeds: [],
      selectedSeeds: []
    };
    console.info("Udforsk personal seed rotation", debug);
    if (console.table) console.table(debug.eligibleSeeds || []);
    return debug;
  };
}


function getExploreShuffleSeed(value) {
  let hash = 2166136261;
  const text = String(value || "");

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function getHourlyRotationKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    String(date.getHours()).padStart(2, "0")
  ].join("");
}

function getHourlyRotationSeed(sectionKey, hourKey = getHourlyRotationKey()) {
  return getExploreShuffleSeed(`${hourKey}:${sectionKey}`) || 1;
}

function orderExplorePersonalSectionsForHour(
  sections,
  hourKey = getHourlyRotationKey()
) {
  return seededShuffle(
    sections,
    getHourlyRotationSeed("explore-personal-section-order", hourKey)
  );
}

function seededShuffle(items, seed) {
  const shuffled = [...items];
  let nextSeed = Number(seed) >>> 0 || 1;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    nextSeed = (Math.imul(nextSeed, 1664525) + 1013904223) >>> 0;
    const swapIndex = nextSeed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index]
    ];
  }

  return shuffled;
}

function getRotationMainSeriesKey(item) {
  const podcast = item?.podcast || item;
  return normalizeComparable(podcast?.mainSeries);
}

function countAdjacentMainSeriesCollisions(items, { circular = false } = {}) {
  if (items.length < 2) return 0;
  let collisions = 0;
  const pairCount = circular ? items.length : items.length - 1;

  for (let index = 0; index < pairCount; index += 1) {
    const currentSeries = getRotationMainSeriesKey(items[index]);
    const nextSeries = getRotationMainSeriesKey(items[(index + 1) % items.length]);
    if (currentSeries && nextSeries && currentSeries === nextSeries) {
      collisions += 1;
    }
  }

  return collisions;
}

function arrangeWithoutAdjacentMainSeries(
  items,
  seed,
  { limit = items.length, circular = false, maxAttempts = 24 } = {}
) {
  const targetCount = Math.max(0, Math.min(limit, items.length));
  if (targetCount < 2) return items.slice(0, targetCount);

  let best = items.slice(0, targetCount);
  let bestCollisions = countAdjacentMainSeriesCollisions(best, { circular });
  const attempts = Math.max(1, Math.min(maxAttempts, 32));

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const attemptSeed = (Number(seed) + Math.imul(attempt + 1, 2654435761)) >>> 0;
    const remaining = attempt === 0 ? [...items] : seededShuffle(items, attemptSeed);
    const selected = [];

    while (remaining.length && selected.length < targetCount) {
      const previousSeries = getRotationMainSeriesKey(selected.at(-1));
      const firstSeries = getRotationMainSeriesKey(selected[0]);
      const isLastSlot = selected.length === targetCount - 1;
      let nextIndex = remaining.findIndex((candidate) => {
        const candidateSeries = getRotationMainSeriesKey(candidate);
        const clearsPrevious =
          !previousSeries || !candidateSeries || candidateSeries !== previousSeries;
        const clearsWrap =
          !circular ||
          !isLastSlot ||
          !firstSeries ||
          !candidateSeries ||
          candidateSeries !== firstSeries;
        return clearsPrevious && clearsWrap;
      });

      if (nextIndex < 0) {
        nextIndex = remaining.findIndex((candidate) => {
          const candidateSeries = getRotationMainSeriesKey(candidate);
          return !previousSeries || !candidateSeries || candidateSeries !== previousSeries;
        });
      }
      if (nextIndex < 0) nextIndex = 0;
      selected.push(remaining.splice(nextIndex, 1)[0]);
    }

    const collisions = countAdjacentMainSeriesCollisions(selected, { circular });
    if (collisions < bestCollisions) {
      best = selected;
      bestCollisions = collisions;
    }
    if (bestCollisions === 0) break;
  }

  return best;
}

function selectRotatingItems(
  items,
  count,
  {
    sectionKey,
    hourKey = getHourlyRotationKey(),
    avoidAdjacentMainSeries = true,
    circular = false,
    deprioritizeKeys = new Set()
  } = {}
) {
  const targetCount = Math.max(0, Math.min(count, items.length));
  if (!targetCount) return [];

  const preferred = items.filter((item) => {
    const podcast = item?.podcast || item;
    return !deprioritizeKeys.has(getPodcastKey(podcast));
  });
  const eligible =
    preferred.length >= targetCount
      ? preferred
      : preferred.concat(
          items.filter((item) => {
            const podcast = item?.podcast || item;
            return deprioritizeKeys.has(getPodcastKey(podcast));
          })
        );
  const seed = getHourlyRotationSeed(sectionKey || "rotation", hourKey);
  const shuffled = seededShuffle(eligible, seed);

  if (!avoidAdjacentMainSeries) {
    return shuffled.slice(0, targetCount);
  }

  return arrangeWithoutAdjacentMainSeries(shuffled, seed, {
    limit: targetCount,
    circular
  });
}

function shuffleExploreItemsForHour(
  items,
  hourBucket = getExploreHourBucket(),
  salt = ""
) {
  return seededShuffle(items, getHourlyRotationSeed(`explore:${salt}`, hourBucket));
}

function prioritizeExploreItemsForHour(
  items,
  hourBucket = getExploreHourBucket(),
  salt = ""
) {
  const buckets = {
    elite: [],
    high: [],
    medium: [],
    low: [],
    unrated: []
  };

  items.forEach((item) => {
    const podcast = item?.podcast || item;
    const score = getExploreDisplayScore(podcast).value;

    if (score === null) {
      buckets.unrated.push(item);
    } else if (score >= 8) {
      buckets.elite.push(item);
    } else if (score >= 7) {
      buckets.high.push(item);
    } else if (score >= 6) {
      buckets.medium.push(item);
    } else {
      buckets.low.push(item);
    }
  });

  const ordered = [
    ...shuffleExploreItemsForHour(buckets.elite, hourBucket, `${salt}:elite`),
    ...shuffleExploreItemsForHour(buckets.high, hourBucket, `${salt}:high`),
    ...shuffleExploreItemsForHour(buckets.medium, hourBucket, `${salt}:medium`),
    ...shuffleExploreItemsForHour(buckets.low, hourBucket, `${salt}:low`),
    ...shuffleExploreItemsForHour(buckets.unrated, hourBucket, `${salt}:unrated`)
  ];

  return arrangeWithoutAdjacentMainSeries(
    ordered,
    getHourlyRotationSeed(`explore:${salt}:series`, hourBucket)
  );
}

function getExplorePersonalSnapshotRotationKey(sectionKey) {
  if (!isLoggedIn()) return getExploreHourBucket();
  return [
    getDailyExploreRotationKey(),
    state.authUser?.id || "anonymous",
    getExploreRecommendationInputFingerprint(),
    sectionKey
  ].join(":");
}

function prioritizeExploreItemsForPersonalSnapshot(items, sectionKey) {
  return prioritizeExploreItemsForHour(
    items,
    getExplorePersonalSnapshotRotationKey(sectionKey),
    `snapshot:${sectionKey}`
  );
}

function orderExplorePersonalSectionsForSnapshot(sections) {
  return orderExplorePersonalSectionsForHour(
    sections,
    getExplorePersonalSnapshotRotationKey("section-order")
  );
}

function getExploreHourBucket(timestamp = Date.now()) {
  return getHourlyRotationKey(timestamp);
}

function getHomePopularDayKey(timestamp = Date.now()) {
  const date = new Date(timestamp);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value) => String(value).padStart(2, "0"))
    .join("-");
}

function getRotatedExploreItems(
  items,
  limit,
  hourBucket = getExploreHourBucket(),
  salt = "explore-section"
) {
  return selectRotatingItems(items, limit, {
    sectionKey: `explore:${salt}`,
    hourKey: hourBucket,
    avoidAdjacentMainSeries: true
  });
}

function getHomeTimeRotatedItem(items, hourBucket = getExploreHourBucket(), salt = "") {
  return selectRotatingItems(items, 1, {
    sectionKey: `home:${salt}`,
    hourKey: hourBucket,
    avoidAdjacentMainSeries: false
  })[0] || null;
}

function getPodcastlistenPlacementPool(start, end) {
  return state.podcasts
    .filter((podcast) => {
      const placement = Number(podcast.placement);
      return (
        Number.isFinite(placement) &&
        placement >= start &&
        placement <= end &&
        podcast.ratingValue !== null &&
        podcast.ratingValue !== undefined
      );
    })
    .sort((a, b) => {
      const placementDelta = Number(a.placement) - Number(b.placement);
      if (placementDelta !== 0) return placementDelta;
      return normalizeText(a.title).localeCompare(normalizeText(b.title), "da", {
        sensitivity: "base"
      });
    });
}

function getPodcastlistenTopPodcasts(limit = HOME_ROTATION_TOP_LIMIT) {
  const seenKeys = new Set();
  return state.podcasts
    .filter(
      (podcast) =>
        getPodcastKey(podcast) &&
        parseNumber(podcast.ratingValue) !== null &&
        Boolean(podcast.image)
    )
    .sort((a, b) => {
      const ratingDelta =
        (parseNumber(b.ratingValue) ?? -1) - (parseNumber(a.ratingValue) ?? -1);
      if (ratingDelta !== 0) return ratingDelta;
      const placementDelta =
        (Number.isFinite(a.placement) ? a.placement : Number.MAX_SAFE_INTEGER) -
        (Number.isFinite(b.placement) ? b.placement : Number.MAX_SAFE_INTEGER);
      if (placementDelta !== 0) return placementDelta;
      return normalizeText(a.title).localeCompare(normalizeText(b.title), "da", {
        sensitivity: "base"
      });
    })
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .slice(0, Math.max(0, limit));
}

function getHomeCommunityCandidateLevel(communityRating, communityRatingCount) {
  const rating = parseNumber(communityRating);
  const rawCount = Number(communityRatingCount);
  const ratingCount =
    Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 0;

  if (
    rating === null ||
    rating < HOME_COMMUNITY_MIN_RATING ||
    ratingCount < 1
  ) {
    return null;
  }

  if (ratingCount >= HOME_COMMUNITY_PRIMARY_MIN_COUNT) return "primary";
  if (ratingCount >= HOME_COMMUNITY_SECONDARY_MIN_COUNT) return "secondary";
  return "tertiary";
}

function getHomeCommunityPopularCandidatePools(
  limit = HOME_ROTATION_TOP_LIMIT
) {
  const pools = {
    primary: [],
    secondary: [],
    tertiary: []
  };

  state.podcasts.forEach((podcast) => {
    const stat = getCommunityStat(getPodcastKey(podcast));
    const communityRating = parseNumber(stat?.averageRating);
    const rawCount = Number(stat?.ratingCount);
    const communityRatingCount =
      Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 0;
    const candidateLevel = getHomeCommunityCandidateLevel(
      communityRating,
      communityRatingCount
    );

    if (!candidateLevel) return;

    pools[candidateLevel].push({
      podcast,
      communityRating,
      communityRatingCount,
      candidateLevel
    });
  });

  const normalizedLimit = Number.isFinite(Number(limit))
    ? Math.max(0, Math.floor(Number(limit)))
    : Number.MAX_SAFE_INTEGER;

  Object.keys(pools).forEach((candidateLevel) => {
    pools[candidateLevel] = pools[candidateLevel]
      .sort((a, b) => compareExplorePodcasts(a.podcast, b.podcast))
      .slice(0, normalizedLimit);
  });

  return pools;
}

function selectHomeCommunityPopularCandidates(
  count,
  {
    hourKey = getExploreHourBucket(),
    deprioritizeKeys = new Set(),
    candidatePools = null
  } = {}
) {
  const targetCount = Math.max(0, Math.floor(Number(count) || 0));
  if (!targetCount) return [];

  const pools =
    candidatePools ||
    getHomeCommunityPopularCandidatePools(HOME_ROTATION_TOP_LIMIT);
  const selected = [];
  const candidateLevels = ["primary", "secondary", "tertiary"];

  candidateLevels.forEach((candidateLevel) => {
    const remainingCount = targetCount - selected.length;
    if (remainingCount <= 0) return;

    selected.push(
      ...selectRotatingItems(pools[candidateLevel], remainingCount, {
        sectionKey: `home-community-popular:${candidateLevel}`,
        hourKey,
        avoidAdjacentMainSeries: false,
        deprioritizeKeys
      })
    );
  });

  return arrangeWithoutAdjacentMainSeries(
    selected,
    getHourlyRotationSeed("home-community-popular", hourKey),
    {
      limit: selected.length,
      circular: true
    }
  );
}

function getHomeHeroPodcasts(
  hourBucket = getExploreHourBucket(),
  limit = HOME_HERO_COVER_COUNT
) {
  return selectRotatingItems(
    getPodcastlistenTopPodcasts(HOME_ROTATION_TOP_LIMIT),
    limit,
    {
      sectionKey: "home-editorial-hero",
      hourKey: hourBucket,
      avoidAdjacentMainSeries: true,
      circular: true
    }
  );
}


function getHomeHeroScrollerMetrics(container = elements.pageIntroPanel) {
  const rail = container?.querySelector("[data-home-hero-rail]");
  if (!rail) return null;

  const cards = [...rail.querySelectorAll(".home-hero__cover:not(.is-hidden)")];
  const firstCard = cards[0] || null;
  const styles = window.getComputedStyle(rail);
  const gap = Number.parseFloat(styles.columnGap || styles.gap || "0") || 0;
  const cardWidth = firstCard?.getBoundingClientRect().width || 1;
  const step = Math.max(1, cardWidth + gap);
  const visibleCards = Math.max(
    1,
    Math.floor((rail.clientWidth + gap) / step)
  );
  const pageCount = Math.max(1, Math.ceil(cards.length / visibleCards));
  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);

  return {
    rail,
    cards,
    gap,
    cardWidth,
    step,
    visibleCards,
    pageCount,
    maxScrollLeft
  };
}

function updateHomeHeroIndicators(container = elements.pageIntroPanel) {
  const indicators = container?.querySelector("[data-home-hero-indicators]");
  const metrics = getHomeHeroScrollerMetrics(container);
  if (!indicators || !metrics) return;

  const { rail, pageCount, maxScrollLeft } = metrics;
  const markers = [...indicators.querySelectorAll(".home-hero__indicator")];
  if (!markers.length || maxScrollLeft <= 1) return;

  const progress = Math.max(0, Math.min(1, rail.scrollLeft / maxScrollLeft));
  const activeIndex = Math.max(
    0,
    Math.min(pageCount - 1, Math.round(progress * (pageCount - 1)))
  );

  markers.forEach((marker, index) => {
    const isActive = index === activeIndex;
    marker.classList.toggle("is-active", isActive);
    marker.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function renderHomeHeroIndicators(container = elements.pageIntroPanel) {
  const indicators = container?.querySelector("[data-home-hero-indicators]");
  const metrics = getHomeHeroScrollerMetrics(container);
  if (!indicators || !metrics) return;

  const { rail, pageCount, maxScrollLeft } = metrics;
  indicators.replaceChildren();
  indicators.hidden = pageCount <= 1 || maxScrollLeft <= 1;
  if (indicators.hidden) return;

  for (let index = 0; index < pageCount; index += 1) {
    const marker = document.createElement("button");
    marker.className = "home-hero__indicator";
    marker.type = "button";
    marker.setAttribute("aria-label", `Vis podcastgruppe ${index + 1} af ${pageCount}`);
    marker.addEventListener("click", () => {
      const target =
        pageCount <= 1 ? 0 : (maxScrollLeft * index) / (pageCount - 1);
      rail.scrollTo({ left: target, behavior: "smooth" });
    });
    indicators.appendChild(marker);
  }

  updateHomeHeroIndicators(container);
}

function updateHomeHeroCovers({ force = false } = {}) {
  const hourBucket = getExploreHourBucket();
  if (!force && state.homeHeroHourBucket === hourBucket) return false;

  state.homeHeroHourBucket = hourBucket;

  if (
    !document.body.classList.contains("page-forside") ||
    !elements.pageIntroPanel
  ) {
    return false;
  }

  const podcasts = getHomeHeroPodcasts(hourBucket);

  for (let index = 0; index < HOME_HERO_COVER_COUNT; index += 1) {
    setHomeHeroCover(
      elements.pageIntroPanel,
      `[data-home-hero-slot="${index}"]`,
      podcasts[index] || null
    );
  }

  const rail = elements.pageIntroPanel.querySelector("[data-home-hero-rail]");
  if (rail && force) rail.scrollTo({ left: 0, behavior: "auto" });
  window.requestAnimationFrame(() => {
    updateHomeHeroScrollerControls(elements.pageIntroPanel);
    renderHomeHeroIndicators(elements.pageIntroPanel);
  });

  return true;
}

function updateHomeHeroScrollerControls(container = elements.pageIntroPanel) {
  const rail = container?.querySelector("[data-home-hero-rail]");
  const previousButton = container?.querySelector("[data-home-hero-scroll='previous']");
  const nextButton = container?.querySelector("[data-home-hero-scroll='next']");

  if (!rail || !previousButton || !nextButton) return;

  const maxScrollLeft = Math.max(0, rail.scrollWidth - rail.clientWidth);
  const atStart = rail.scrollLeft <= 4;
  const atEnd = rail.scrollLeft >= maxScrollLeft - 4;

  previousButton.disabled = atStart;
  nextButton.disabled = maxScrollLeft <= 4 || atEnd;
  previousButton.setAttribute("aria-hidden", atStart ? "true" : "false");
  nextButton.setAttribute("aria-hidden", maxScrollLeft <= 4 || atEnd ? "true" : "false");
  updateHomeHeroIndicators(container);
}

function bindHomeHeroScroller(container = elements.pageIntroPanel) {
  const rail = container?.querySelector("[data-home-hero-rail]");
  const previousButton = container?.querySelector("[data-home-hero-scroll='previous']");
  const nextButton = container?.querySelector("[data-home-hero-scroll='next']");

  if (!rail || !previousButton || !nextButton) return;

  const scrollByPage = (direction) => {
    const firstCard = rail.querySelector(".home-hero__cover:not(.is-hidden)");
    const cardWidth = firstCard?.getBoundingClientRect().width || 260;
    const gap = Number.parseFloat(getComputedStyle(rail).columnGap) || 16;
    const visibleCards = Math.max(1, Math.floor(rail.clientWidth / (cardWidth + gap)));
    const distance = Math.max(cardWidth + gap, (cardWidth + gap) * (visibleCards - 1));
    rail.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  previousButton.addEventListener("click", () => scrollByPage(-1));
  nextButton.addEventListener("click", () => scrollByPage(1));
  rail.addEventListener(
    "scroll",
    () => {
      updateHomeHeroScrollerControls(container);
      updateHomeHeroIndicators(container);
    },
    { passive: true }
  );

  if (typeof ResizeObserver === "function") {
    const observer = new ResizeObserver(() => {
      updateHomeHeroScrollerControls(container);
      renderHomeHeroIndicators(container);
    });
    observer.observe(rail);
  }

  window.requestAnimationFrame(() => {
    updateHomeHeroScrollerControls(container);
    renderHomeHeroIndicators(container);
  });
  window.setTimeout(() => renderHomeHeroIndicators(container), 250);
}

function scheduleHomeHeroRotation() {
  if (state.homeHeroRotationTimer) {
    window.clearTimeout(state.homeHeroRotationTimer);
  }

  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setMinutes(60, 0, 0);
  const delay = Math.max(1000, nextHour.getTime() - now.getTime() + 100);

  state.homeHeroRotationTimer = window.setTimeout(() => {
    updateHomeHeroCovers({ force: true });
    scheduleHomeHeroRotation();
  }, delay);
}

function getHomeTopPodcastCta(hourBucket = getExploreHourBucket()) {
  return getHomeTimeRotatedItem(getPodcastlistenPlacementPool(1, 15), hourBucket, "top");
}

function getHomeSavedPodcastCta(hourBucket = getExploreHourBucket()) {
  const savedPool = Array.from(state.savedPodcastKeys)
    .map((key) => state.podcastByKey[key])
    .filter(Boolean)
    .sort((a, b) =>
      normalizeText(a.title).localeCompare(normalizeText(b.title), "da", {
        sensitivity: "base"
      })
    );

  return getHomeTimeRotatedItem(
    savedPool.length ? savedPool : getPodcastlistenPlacementPool(16, 50),
    hourBucket,
    savedPool.length ? "saved" : "saved-fallback"
  );
}

function getExploreUnderratedGemItems({
  limit = 8,
  searchParts = [],
  genre = "Alle",
  hourBucket = getExploreHourBucket()
} = {}) {
  const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
  const seenKeys = new Set();

  const eligiblePodcasts = state.podcasts
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      // `isUnderratedPearl` deliberately retains the historic Google Sheet
      // source column/key; only the public Udforsk wording is renamed below.
      if (!podcast.isUnderratedPearl || !key || seenKeys.has(key)) return false;
      if (isLoggedIn() && ratedKeys.has(key)) return false;
      if (!matchesExploreFilters(podcast, searchParts, genre)) return false;

      seenKeys.add(key);
      return true;
    })
    .sort((a, b) => {
      const aPlacement = Number.isFinite(a.placement) ? a.placement : Number.MAX_SAFE_INTEGER;
      const bPlacement = Number.isFinite(b.placement) ? b.placement : Number.MAX_SAFE_INTEGER;
      if (aPlacement !== bPlacement) return aPlacement - bPlacement;
      return normalizeText(a.title).localeCompare(normalizeText(b.title), "da", {
        sensitivity: "base"
      });
    });

  return getRotatedExploreItems(
    eligiblePodcasts,
    limit,
    hourBucket,
    "undervurderede-perler"
  )
    .slice(0, limit)
    .map((podcast) => ({
      podcast,
      reason: "Undervurderet perle"
    }));
}

function getExploreFavoriteGenreSections({ searchParts = [], genre = "Alle", maxSections = 3 } = {}) {
  if (!isLoggedIn()) return [];

  const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
  const genreScores = new Map();

  Object.entries(state.userRatingsByKey).forEach(([key, rating]) => {
    const numericRating = parseNumber(rating) ?? 0;
    const podcast = state.podcastByKey[key];
    if (!podcast?.genre || numericRating < 8) return;
    genreScores.set(podcast.genre, (genreScores.get(podcast.genre) || 0) + numericRating);
  });

  return Array.from(genreScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, Math.max(0, maxSections))
    .map(([genreName]) => {
      const candidates = state.podcasts
        .filter(
          (podcast) =>
            podcast.genre === genreName &&
            !ratedKeys.has(getPodcastKey(podcast)) &&
            matchesExploreFilters(podcast, searchParts, genre)
        )
        .map((podcast) => ({
          podcast,
          score: getExploreDisplayScore(podcast).value
        }));

      const sevenPlus = candidates.filter((item) => item.score !== null && item.score >= 7);
      const sixPlus = candidates.filter(
        (item) => item.score !== null && item.score >= 6 && item.score < 7
      );
      const remaining = candidates.filter(
        (item) => item.score === null || item.score < 6
      );

      // Genreanbefalinger skal først og fremmest vise stærke podcasts.
      // Kun hvis der ikke er nok 7+-valg, fyldes der gradvist op med lavere niveauer.
      const selected =
        sevenPlus.length >= 5
          ? sevenPlus.slice(0, 12)
          : sevenPlus
              .concat(sixPlus)
              .concat(remaining)
              .slice(0, 12);

      return {
        genreName,
        podcasts: selected.map(({ podcast }) => ({
          podcast,
          reason: `Mere ${genreName} til dig`
        }))
      };
    })
    .filter((section) => section.podcasts.length);
}

function appendExploreCards(grid, items, { className = "" } = {}) {
  if (!grid) return;
  grid.innerHTML = "";
  grid.classList.remove("has-one-item", "has-two-items", "has-three-items");
  delete grid.dataset.itemCount;

  if (!items.length) {
    grid.innerHTML = `
      <div class="explore-empty-state">
        <h3>Ingen anbefalinger fundet</h3>
        <p>Pr&oslash;v en anden s&oslash;gning eller genre.</p>
      </div>
    `;
    return;
  }

  grid.dataset.itemCount = String(items.length);
  if (items.length === 1) grid.classList.add("has-one-item");
  if (items.length === 2) grid.classList.add("has-two-items");
  if (items.length === 3) grid.classList.add("has-three-items");

  const fragment = document.createDocumentFragment();
  items.forEach((item) => {
    fragment.appendChild(
      createExplorePodcastCardElement(item.podcast || item, {
        reason: item.reason || "",
        extraClassName: className
      })
    );
  });
  grid.appendChild(fragment);
}

function updateExploreCarouselIndicators(scroller, indicators) {
  if (!scroller || !indicators) return;

  const dots = Array.from(indicators.querySelectorAll(".explore-carousel-indicator"));
  if (!dots.length) return;

  const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
  const progress = maxScroll ? scroller.scrollLeft / maxScroll : 0;
  const activeIndex = Math.min(dots.length - 1, Math.max(0, Math.round(progress * (dots.length - 1))));

  dots.forEach((dot, index) => {
    const isActive = index === activeIndex;
    dot.classList.toggle("is-active", isActive);
    dot.setAttribute("aria-current", isActive ? "true" : "false");
  });
}

function setupExploreCarouselIndicators(container) {
  if (!container) return;
  const scheduleIndicatorSetup =
    typeof window.requestAnimationFrame === "function"
      ? window.requestAnimationFrame.bind(window)
      : (callback) => window.setTimeout(callback, 0);

  container.querySelectorAll(".explore-carousel-indicators").forEach((indicator) => {
    indicator.remove();
  });
  container.querySelectorAll(".explore-carousel-arrow").forEach((arrow) => {
    arrow.remove();
  });

  const scrollers = container.querySelectorAll(
    ".explore-popular .explore-grid, .explore-genre-section .explore-genre-grid, .explore-featured__grid"
  );

  scrollers.forEach((scroller) => {
    if (!scroller || scroller.children.length < 2) return;

    scheduleIndicatorSetup(() => {
      if (!document.body.contains(scroller)) return;

      const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      if (maxScroll <= 8) return;

      const section = scroller.closest("section");
      if (!section) return;
      section.classList.add("has-explore-carousel");

      const previous = document.createElement("button");
      previous.className =
        "explore-carousel-arrow explore-carousel-arrow--previous";
      previous.type = "button";
      previous.setAttribute("aria-label", "Vis tidligere podcasts");
      previous.innerHTML = '<span aria-hidden="true">&#8249;</span>';

      const next = document.createElement("button");
      next.className = "explore-carousel-arrow explore-carousel-arrow--next";
      next.type = "button";
      next.setAttribute("aria-label", "Vis flere podcasts");
      next.innerHTML = '<span aria-hidden="true">&#8250;</span>';

      const scrollByPage = (direction) => {
        scroller.scrollBy({
          left: direction * Math.max(260, scroller.clientWidth * 0.82),
          behavior: "smooth"
        });
      };

      previous.addEventListener("click", () => scrollByPage(-1));
      next.addEventListener("click", () => scrollByPage(1));
      section.append(previous, next);

      const pageCount = Math.ceil(
        scroller.scrollWidth / Math.max(1, scroller.clientWidth)
      );
      const indicatorCount = Math.min(8, Math.max(2, pageCount));
      const indicators = document.createElement("div");
      indicators.className = "explore-carousel-indicators";
      indicators.setAttribute("aria-label", "Flere podcasts i rækken");

      for (let index = 0; index < indicatorCount; index += 1) {
        const dot = document.createElement("button");
        dot.className = "explore-carousel-indicator";
        dot.type = "button";
        dot.setAttribute(
          "aria-label",
          `Vis podcastgruppe ${index + 1} af ${indicatorCount}`
        );
        dot.addEventListener("click", () => {
          const targetProgress =
            indicatorCount <= 1 ? 0 : index / (indicatorCount - 1);
          scroller.scrollTo({
            left: maxScroll * targetProgress,
            behavior: "smooth"
          });
        });
        indicators.appendChild(dot);
      }

      scroller.insertAdjacentElement("afterend", indicators);

      const updateArrows = () => {
        previous.disabled = scroller.scrollLeft <= 3;
        next.disabled =
          scroller.scrollLeft >=
          Math.max(0, scroller.scrollWidth - scroller.clientWidth - 3);
      };

      const updateIndicators = () =>
        updateExploreCarouselIndicators(scroller, indicators);

      const updateAll = () => {
        updateArrows();
        updateIndicators();
      };

      scroller.addEventListener("scroll", updateAll, { passive: true });
      updateAll();
    });
  });
}

function setupExploreCarouselDragGuard(container) {
  if (!container || !isMobileViewport()) return;

  const scrollers = container.querySelectorAll(
    ".explore-popular .explore-grid, .explore-genre-section .explore-genre-grid, .explore-featured__grid"
  );

  scrollers.forEach((scroller) => {
    if (!scroller || scroller.dataset.dragGuardReady === "true") return;
    scroller.dataset.dragGuardReady = "true";

    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let suppressClickUntil = 0;

    scroller.addEventListener(
      "pointerdown",
      (event) => {
        startX = event.clientX;
        startY = event.clientY;
        isDragging = false;
      },
      { passive: true }
    );

    scroller.addEventListener(
      "pointermove",
      (event) => {
        const deltaX = Math.abs(event.clientX - startX);
        const deltaY = Math.abs(event.clientY - startY);
        if (deltaX > 10 && deltaX > deltaY) {
          isDragging = true;
          suppressClickUntil = Date.now() + 350;
        }
      },
      { passive: true }
    );

    const endDrag = () => {
      if (isDragging) {
        suppressClickUntil = Date.now() + 350;
      }
      isDragging = false;
    };

    scroller.addEventListener("pointerup", endDrag, { passive: true });
    scroller.addEventListener("pointercancel", endDrag, { passive: true });

    scroller.addEventListener(
      "click",
      (event) => {
        if (Date.now() > suppressClickUntil) return;
        event.preventDefault();
        event.stopPropagation();
      },
      true
    );
  });
}

function dedupeExploreItems(items, usedKeys) {
  const result = [];

  items.forEach((item) => {
    const podcast = item.podcast || item;
    const key = getPodcastKey(podcast);
    if (!key || usedKeys.has(key)) return;
    usedKeys.add(key);
    result.push(item);
  });

  return result;
}

function createExplorePodcastCardElement(podcast, { reason = "", extraClassName = "" } = {}) {
  const card = document.createElement("article");
  card.className = ["explore-card", extraClassName].filter(Boolean).join(" ");
  card.dataset.podcastKey = getPodcastKey(podcast);

  const cover = document.createElement("div");
  cover.className = "explore-card__cover";

  const image = document.createElement("img");
  image.className = "explore-card__image";
  image.loading = "lazy";

  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder explore-card__placeholder";
  placeholder.textContent = "Billede mangler";
  placeholder.hidden = true;

  cover.append(image, placeholder);
  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  const hostLabel = normalizeText(podcast.host);
  const publisherLabel = getPodcastDetailPublisherLabel(podcast);

  const copy = document.createElement("div");
  copy.className = "explore-card__copy";
  copy.innerHTML = `
    <p class="explore-card__genre">${escapeHtml(podcast.genre || "Podcast")}</p>
    <h3>${getMainSeriesTitleMarkup(podcast)}${getPodcastAccessIndicatorMarkup(podcast)}</h3>
    ${hostLabel ? `<p class="explore-card__host">${escapeHtml(hostLabel)}</p>` : ""}
    ${publisherLabel ? `<button class="explore-card__publisher" type="button" data-explore-filter="publisher" data-value="${escapeHtml(publisherLabel)}" aria-label="Vis podcasts fra ${escapeHtml(publisherLabel)}">${escapeHtml(publisherLabel)}</button>` : ""}
    ${getExploreScoreMarkup(podcast, "explore-card__rating")}
  `;

  const ratingArea = copy.querySelector(".explore-card__rating");
  if (ratingArea) {
    ratingArea.setAttribute("role", "button");
    ratingArea.setAttribute("tabindex", "0");
    ratingArea.setAttribute("aria-label", `Vurder ${podcast.title}`);
    ratingArea.classList.add("is-clickable");
    ratingArea.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openRatingDialog(podcast);
    });
    ratingArea.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      openRatingDialog(podcast);
    });
  }

  const publisherButton = copy.querySelector("[data-explore-filter='publisher']");
  if (publisherButton) {
    publisherButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const value = publisherButton.dataset.value || "";
      setActiveFilter("publisher", value);
      if (window.location.hash.slice(1).toLowerCase() !== "ranglister") {
        window.location.hash = "#ranglister";
      } else {
        scrollToRankingStart();
      }
    });
  }

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "explore-card__favorite";
  favoriteButton.type = "button";
  favoriteButton.innerHTML = '<span aria-hidden="true"></span><span class="sr-only" data-favorite-label>Gem podcast</span>';
  renderFavoriteButton(favoriteButton, getPodcastKey(podcast));
  favoriteButton.addEventListener("click", (event) => {
    handleFavoriteToggle(event, podcast);
  });

  const openDetails = () => {
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  };

  card.append(cover, copy, favoriteButton);
  card.classList.add("is-clickable");
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `Vis detaljer om ${podcast.title}`);

  card.addEventListener("click", (event) => {
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openDetails();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openDetails();
  });

  return card;
}

function createExploreFeaturedCardElement(review) {
  const card = document.createElement("article");
  card.className = "explore-featured-card";

  const cover = document.createElement("div");
  cover.className = "explore-featured-card__cover";

  const image = document.createElement("img");
  image.className = "explore-featured-card__image";
  image.loading = "lazy";
  cover.appendChild(image);
  setImage(cover, getFeaturedReviewImageSources(review), review.title || "");

  const meta = [review.host, review.publisher, review.genre].filter(Boolean).join(" / ");
  const linkMarkup = review.link
    ? `
      <a
        class="explore-button explore-featured-card__link"
        href="${escapeHtml(review.link)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        \u00c5bn podcast
      </a>
    `
    : "";

  const copy = document.createElement("div");
  copy.className = "explore-featured-card__copy";
  copy.innerHTML = `
    <h3>${escapeHtml(review.title || "")}</h3>
    <p class="explore-featured-card__meta">${escapeHtml(meta)}</p>
    <p class="explore-featured-card__score">${escapeHtml(
      review.scoreLabel || "Ikke vurderet"
    )}</p>
    <p class="explore-featured-card__review">${escapeHtml(review.review || "")}</p>
    ${linkMarkup}
  `;

  card.append(cover, copy);
  return card;
}

function renderExploreFeatured(container) {
  if (!container) return;

  const reviews = state.featuredReviews.slice(0, 3);
  container.innerHTML = "";

  if (!reviews.length) {
    const section = container.closest(".explore-featured");
    if (section) section.hidden = true;
    return;
  }

  const fragment = document.createDocumentFragment();
  reviews.forEach((review) => {
    fragment.appendChild(createExploreFeaturedCardElement(review));
  });
  container.appendChild(fragment);
}

function createExploreGenreCardElement(podcast) {
  const card = document.createElement("article");
  card.className = "explore-genre-card";

  const cover = document.createElement("div");
  cover.className = "explore-genre-card__cover";

  const image = document.createElement("img");
  image.className = "explore-genre-card__image";
  image.loading = "lazy";

  const placeholder = document.createElement("span");
  placeholder.className = "image-placeholder explore-genre-card__placeholder";
  placeholder.textContent = "Billede mangler";
  placeholder.hidden = true;

  cover.append(image, placeholder);
  setImage(cover, getPodcastImageSources(podcast), podcast.title);

  const copy = document.createElement("div");
  copy.className = "explore-genre-card__copy";
  copy.innerHTML = `
    <p class="explore-genre-card__genre">${escapeHtml(podcast.genre)}</p>
    <h3>${escapeHtml(podcast.title)}${getPodcastAccessIndicatorMarkup(podcast)}</h3>
    <p class="explore-genre-card__host">${escapeHtml(
      podcast.host || podcast.publisher || ""
    )}</p>
    ${getExploreScoreMarkup(podcast, "explore-genre-card__scores")}
  `;

  const ratingArea = copy.querySelector(".explore-genre-card__scores");
  if (ratingArea) {
    ratingArea.setAttribute("role", "button");
    ratingArea.setAttribute("tabindex", "0");
    ratingArea.setAttribute("aria-label", `Vurder ${podcast.title}`);
    ratingArea.classList.add("is-clickable");
    ratingArea.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openRatingDialog(podcast);
    });
    ratingArea.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      openRatingDialog(podcast);
    });
  }

  card.append(cover, copy);

  if (podcast.link) {
    const openLink = document.createElement("a");
    openLink.className = "explore-button explore-genre-card__link";
    openLink.href = podcast.link;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "\u00c5bn podcast";
    card.appendChild(openLink);
  }

  card.classList.add("is-clickable");
  if (isMobileViewport()) {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Vis detaljer om ${podcast.title}`);
  }
  card.addEventListener("click", (event) => {
    if (handleMobilePodcastCardOpen(event, podcast, card)) return;
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  });
  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    if (isInteractivePodcastDetailTarget(event.target)) return;
    event.preventDefault();
    openPodcastDetailSheet(podcast, card, { allowDesktop: true });
  });
  return card;
}

function renderExploreGenreSections(container, { searchTerm = "", genre = "Alle" } = {}) {
  if (!container) return;

  const hasSearch = Boolean(normalizeText(searchTerm));
  container.classList.toggle("is-hidden", hasSearch);
  container.innerHTML = "";

  if (hasSearch) return;

  const visibleGenres =
    genre === "Alle" ? GENRES.filter((item) => item !== "Alle") : [genre];
  const hourKey = getExploreHourBucket();
  const fragment = document.createDocumentFragment();
  let sectionCount = 0;

  visibleGenres.forEach((genreName) => {
    const candidates = state.podcasts
      .filter(
        (podcast) =>
          podcast.genre === genreName &&
          (hasCommunityRating(getCommunityStat(getPodcastKey(podcast))) ||
            (podcast.ratingValue !== null && podcast.ratingValue !== undefined))
      )
      .sort(compareExplorePodcasts)
      .slice(0, HOME_ROTATION_TOP_LIMIT);
    const podcasts = selectRotatingItems(candidates, 4, {
      sectionKey: `explore-genre:${genreName}`,
      hourKey,
      avoidAdjacentMainSeries: true
    });

    if (!podcasts.length) return;

    const section = document.createElement("section");
    section.className = "explore-genre-section";
    section.setAttribute("aria-labelledby", `exploreGenre${sectionCount}Heading`);
    section.innerHTML = `
      <header class="explore-genre-section__header">
        <div>
          <p class="explore-eyebrow">Alle genrer</p>
          <h2 id="exploreGenre${sectionCount}Heading">${escapeHtml(genreName)}</h2>
        </div>
        <span class="explore-genre-count">${podcasts.length} ${podcasts.length === 1 ? "podcast" : "podcasts"}</span>
        <a href="#ranglister" class="explore-see-all">Se alle</a>
      </header>
      <div class="explore-genre-grid"></div>
    `;

    const grid = section.querySelector(".explore-genre-grid");
    const cardFragment = document.createDocumentFragment();
    podcasts.forEach((podcast) => {
      cardFragment.appendChild(createExploreGenreCardElement(podcast));
    });
    grid.appendChild(cardFragment);
    fragment.appendChild(section);
    sectionCount += 1;
  });

  if (!sectionCount) {
    container.innerHTML = `
      <div class="explore-empty-state">
        <h3>Ingen genreanbefalinger endnu</h3>
        <p>Der er ingen podcasts med vurderinger i den valgte genre.</p>
      </div>
    `;
    return;
  }

  container.appendChild(fragment);
}

function renderExplorePage() {
  const container = elements.pageIntroPanel;
  if (!container) return;
  if (
    isLoggedIn() &&
    state.podcastSimilarityProductStatus === "idle" &&
    getExploreSeedPodcasts().length
  ) {
    loadPodcastSimilarityProductData();
  }
  const isMobileExplore = isMobileViewport();
  const exploreIntroText = isLoggedIn()
    ? "Find podcasts udvalgt ud fra dine vurderinger, gemte favoritter og det, du allerede kan lide."
    : "Opdag h\u00e5ndplukkede podcasts, skjulte perler og inspiration til din n\u00e6ste lytteoplevelse.";
  const exploreHeroCopy = isMobileExplore
    ? `
        ${getMobilePageToplineMarkup("explore-hero__brand-row")}
        <h1 class="explore-hero__title" data-mobile-title="Udforsk"><span>Ud</span><span>forsk</span></h1>
        <p>${escapeHtml(exploreIntroText)}</p>
      `
    : `
        <p class="explore-eyebrow">Personligt udvalgt</p>
        <h1 data-mobile-title="Udforsk">Udforsk for dig</h1>
        <p>${escapeHtml(exploreIntroText)}</p>
      `;

  const isLoggedOutDesktopExplore = !isLoggedIn() && !isMobileExplore;
  const loggedOutDesktopHeroMarkup = isLoggedOutDesktopExplore
    ? `
        <div class="explore-hero__benefits" aria-label="Fordele ved en gratis konto">
          <div class="explore-hero-benefit">
            <span class="explore-hero-benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="m14.8 9.2-2 5.6-5.6 2 2-5.6z"></path></svg>
            </span>
            <span><strong>Find nye favoritter</strong><small>Vi samler de bedste podcasts p&aring; &eacute;t sted.</small></span>
          </div>
          <div class="explore-hero-benefit">
            <span class="explore-hero-benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M20.8 4.9a5.5 5.5 0 0 0-7.8 0L12 5.9l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.3 1-1a5.5 5.5 0 0 0 0-7.8Z"></path></svg>
            </span>
            <span><strong>Gem det, du elsker</strong><small>Opret en gratis konto og gem dine favoritter.</small></span>
          </div>
          <div class="explore-hero-benefit">
            <span class="explore-hero-benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m12 3 1.2 4.1L17 8.5l-3.8 1.4L12 14l-1.2-4.1L7 8.5l3.8-1.4z"></path><path d="m18.2 14.2.8 2.6 2.5.8-2.5.8-.8 2.6-.8-2.6-2.5-.8 2.5-.8z"></path></svg>
            </span>
            <span><strong>F&aring; anbefalinger til dig</strong><small>Log ind eller opret en konto, og vurd&eacute;r podcasts.</small></span>
          </div>
        </div>
        <aside class="explore-hero__auth" aria-label="Log ind eller opret konto">
          <h2>Klar til mere?</h2>
          <p>Log ind eller opret en gratis konto, og vurd&eacute;r podcasts for at f&aring; personlige anbefalinger.</p>
          <button type="button" data-auth-prompt="login">Log ind</button>
          <button type="button" data-auth-prompt="signup">Opret gratis konto</button>
        </aside>
      `
    : "";

  const genreMarkup = GENRES.map(
    (genre) => `
      <button
        class="explore-genre-chip${genre === "Alle" ? " is-active" : ""}"
        type="button"
        data-explore-genre="${escapeHtml(genre)}"
        aria-pressed="${genre === "Alle"}"
      >
        ${escapeHtml(genre)}
      </button>
    `
  ).join("");
  const exploreFallbackSectionsMarkup = "";

  container.innerHTML = `
    <section class="explore-page">
      <header class="explore-hero">
        <div class="explore-hero__copy">
          ${exploreHeroCopy}
        </div>
        ${loggedOutDesktopHeroMarkup}
        ${
          isMobileExplore
            ? `
              <label class="explore-search" for="exploreSearchInput">
                <span>S&oslash;g i Udforsk</span>
                <input
                  id="exploreSearchInput"
                  type="search"
                  placeholder="S&oslash;g efter podcast, v&aelig;rt, udgiver, genre eller hovedserie"
                  autocomplete="off"
                  spellcheck="false"
                />
              </label>
              <div class="explore-genres" aria-label="Filtrer Udforsk efter genre">
                ${genreMarkup}
              </div>
            `
            : ""
        }
      </header>

      <div data-explore-onboarding></div>

      <div class="explore-personal-modules" data-explore-personal-modules></div>

      ${exploreFallbackSectionsMarkup}
      ${getExploreGateMarkup()}

      <section class="explore-suggest-card" aria-labelledby="exploreSuggestHeading">
        <div>
          <p class="explore-eyebrow">F&aelig;llesskabet hj&aelig;lper</p>
          <h2 id="exploreSuggestHeading">Mangler der en podcast?</h2>
          <p>Send et forslag, s&aring; kigger vi p&aring; den.</p>
        </div>
        <button class="explore-suggest-card__button" type="button" data-explore-suggest-open>
          Foresl&aring; podcast
        </button>
      </section>

      ${getSuggestionDialogMarkup("exploreSuggestionTitle")}
    </section>
  `;
  container.classList.remove("is-hidden");
  document.body.classList.remove("explore-gate-active");
  document.body.classList.toggle(
    "explore-logged-out-preview",
    isLoggedOutDesktopExplore
  );

  const searchInput = container.querySelector("#exploreSearchInput");
  const genreButtons = container.querySelectorAll("[data-explore-genre]");
  const onboardingContainer = container.querySelector("[data-explore-onboarding]");
  const personalModules = container.querySelector("[data-explore-personal-modules]");
  const grid = container.querySelector("[data-explore-grid]");
  const count = container.querySelector("[data-explore-count]");
  const gemsSection = container.querySelector(".explore-gems");
  const gemsGrid = container.querySelector("[data-explore-gems]");
  const popularSection = container.querySelector("[data-explore-popular-section]");
  let localSearchTerm = "";
  let localGenre = "Alle";

  try {
    const pendingGenre = window.sessionStorage?.getItem("podcastExploreGenre");
    if (pendingGenre && GENRES.includes(pendingGenre)) {
      localGenre = pendingGenre;
    }
    window.sessionStorage?.removeItem("podcastExploreGenre");
  } catch (error) {
    localGenre = "Alle";
  }

  const renderExploreResults = () => {
    const queryParts = getExploreSearchParts(localSearchTerm);
    const exploreHourBucket = getExploreHourBucket();
    state.exploreUnderratedHourBucket = exploreHourBucket;
    const usedTopKeys = new Set();
    const usedPersonalKeys = new Set();
    const usedEditorialKeys = new Set();
    const ratedKeys = new Set(Object.keys(state.userRatingsByKey));
    const exploreDepth = getExploreRecommendationDepth(ratedKeys.size);
    const personalSections = getExplorePersonalSections({
      limit: 12,
      maxSections: exploreDepth.personalSectionLimit,
      searchParts: queryParts,
      genre: localGenre
    });
    const showPersonalFirst = isLoggedIn() && personalSections.length > 0;
    if (onboardingContainer) {
      onboardingContainer.innerHTML = getExploreOnboardingMarkup({ personalSections });
      bindAuthPromptButtons(onboardingContainer);
    }

    if (personalModules) {
      personalModules.innerHTML = "";
      const sectionsToRender = showPersonalFirst ? personalSections : [];

      const createPersonalSection = (section, index) => {
        const items = prioritizeExploreItemsForPersonalSnapshot(
          dedupeExploreItems(section.items, usedPersonalKeys),
          `${index}:${section.title}`
        );
        if (items.length < EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE) return null;

        items.forEach((item) => {
          const key = getPodcastKey(item.podcast || item);
          if (key) {
            usedPersonalKeys.add(key);
            usedTopKeys.add(key);
          }
        });

        const sectionElement = document.createElement("section");
        const headingId = `explorePersonalHeading${index + 1}`;
        sectionElement.className = [
          "explore-popular",
          "explore-recommendations",
          index === 0
            ? "explore-recommendations--lead"
            : "explore-recommendations--secondary"
        ].join(" ");
        sectionElement.setAttribute("aria-labelledby", headingId);
        sectionElement.innerHTML = `
          <header class="explore-section-header">
            <div>
              <p class="explore-eyebrow">${escapeHtml(section.eyebrow)}</p>
              <h2 id="${headingId}">
                ${
                  section.seedPodcastKey && section.seedPodcastTitle
                    ? `${
                        section.seedSource === "saved"
                          ? "Fordi du gemte "
                          : "Fordi du gav "
                      }<button
                        class="explore-seed-podcast-link"
                        type="button"
                        data-explore-seed-podcast="${escapeHtml(section.seedPodcastKey)}"
                        aria-label="&#197;bn ${escapeHtml(section.seedPodcastTitle)}"
                      >${escapeHtml(section.seedPodcastTitle)}</button>${
                        section.seedSource === "saved"
                          ? ""
                          : ` ${escapeHtml(formatCompactRating(section.seedRating))}/10`
                      }`
                    : escapeHtml(section.title)
                }
              </h2>
              ${
                section.note
                  ? `<p class="explore-section-lead">${escapeHtml(section.note)}</p>`
                  : ""
              }
            </div>
          </header>
          <div class="explore-grid"></div>
        `;

        sectionElement
          .querySelector("[data-explore-seed-podcast]")
          ?.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            const key = event.currentTarget.dataset.exploreSeedPodcast;
            const podcast = key ? state.podcastByKey[key] : null;
            if (!podcast) return;

            openPodcastDetailSheet(podcast, event.currentTarget, {
              allowDesktop: true
            });
          });

        appendExploreCards(sectionElement.querySelector(".explore-grid"), items, {
          className: "explore-card--recommended"
        });
        return sectionElement;
      };

      const underratedItems = prioritizeExploreItemsForPersonalSnapshot(
        dedupeExploreItems(
          getExploreUnderratedGemItems({
            limit: 12,
            searchParts: queryParts,
            genre: localGenre,
            hourBucket: isLoggedIn()
              ? getExplorePersonalSnapshotRotationKey("underrated-candidates")
              : exploreHourBucket
          }),
          usedEditorialKeys
        ),
        "undervurderede-perler"
      );

      const createGemsSection = () => {
        if (underratedItems.length < EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE) return null;

        underratedItems.forEach((item) => {
          const key = getPodcastKey(item.podcast || item);
          if (key) usedTopKeys.add(key);
        });

        const sectionElement = document.createElement("section");
        const headingId = "exploreCuratedGemsHeading";
        sectionElement.className = [
          "explore-popular",
          "explore-gems",
          "explore-recommendations",
          "explore-recommendations--gems",
          !isLoggedIn() ? "explore-public-gems" : ""
        ].filter(Boolean).join(" ");
        sectionElement.setAttribute("aria-labelledby", headingId);
        sectionElement.innerHTML = `
          <header class="explore-section-header">
            <div>
              <p class="explore-eyebrow">${isLoggedIn() ? "Podcastlistens udvalg" : "Tilg&aelig;ngelig for alle"}</p>
              <h2 id="${headingId}">Oversete favoritter</h2>
              <p class="explore-section-lead">Gode podcasts, som fortjener mere opm&aelig;rksomhed.</p>
            </div>
            ${!isLoggedIn() ? '<a class="explore-section-header__link" href="#ranglister">Se alle <span aria-hidden="true">&rarr;</span></a>' : ""}
          </header>
          <div class="explore-grid"></div>
        `;

        appendExploreCards(sectionElement.querySelector(".explore-grid"), underratedItems, {
          className: "explore-card--gem"
        });
        return sectionElement;
      };

      const firstSection = sectionsToRender[0]
        ? createPersonalSection(sectionsToRender[0], 0)
        : null;
      if (firstSection) personalModules.appendChild(firstSection);

      const gemsSectionElement = createGemsSection();
      if (gemsSectionElement) personalModules.appendChild(gemsSectionElement);

      if (!isLoggedIn() && !isMobileExplore) {
        const genericPreviewCandidates = [...state.podcasts]
          .filter((podcast) => matchesExploreFilters(podcast, queryParts, localGenre))
          .sort(compareExplorePodcasts)
          .slice(0, HOME_ROTATION_TOP_LIMIT);
        const genericPreviewPodcasts = selectRotatingItems(
          genericPreviewCandidates,
          14,
          {
            sectionKey: "explore-locked-previews",
            hourKey: exploreHourBucket,
            avoidAdjacentMainSeries: true
          }
        );

        const createLockedPreviewSection = ({ index, title, note, items, message }) => {
          if (!items.length) return null;
          const sectionElement = document.createElement("section");
          const headingId = `exploreLockedHeading${index}`;
          sectionElement.className = "explore-recommendations explore-locked-preview";
          sectionElement.setAttribute("aria-labelledby", headingId);
          sectionElement.innerHTML = `
            <header class="explore-section-header explore-locked-preview__header">
              <div>
                <p class="explore-eyebrow"><span aria-hidden="true">&#128274;</span> L&aring;st indtil du logger ind</p>
                <h2 id="${headingId}">${escapeHtml(title)}</h2>
                <p class="explore-section-lead">${escapeHtml(note)}</p>
              </div>
            </header>
            <div class="explore-locked-preview__stage">
              <div class="explore-grid explore-locked-preview__grid" aria-hidden="true"></div>
              <div class="explore-locked-preview__overlay">
                <span class="explore-locked-preview__lock" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"></rect><path d="M8 10V7.5a4 4 0 0 1 8 0V10"></path></svg>
                </span>
                <div>
                  <h3>${escapeHtml(message)}</h3>
                  <p>Log ind eller opret en konto, og vurd&eacute;r podcasts for at f&aring; personlige anbefalinger.</p>
                </div>
                <div class="explore-locked-preview__actions">
                  <button type="button" data-auth-prompt="login">Log ind</button>
                  <button type="button" data-auth-prompt="signup">Opret gratis konto</button>
                </div>
              </div>
            </div>
          `;

          const previewItems = items.map((podcast) => ({
            podcast,
            reason: "Personligt forslag"
          }));
          const previewGrid = sectionElement.querySelector(".explore-grid");
          appendExploreCards(previewGrid, previewItems, {
            className: "explore-card--locked-preview"
          });
          previewGrid.querySelectorAll("a, button").forEach((element) => {
            element.tabIndex = -1;
            element.setAttribute("aria-hidden", "true");
          });
          return sectionElement;
        };

        const firstLockedSection = createLockedPreviewSection({
          index: 1,
          title: "Fordi du gav …",
          note: "Log ind eller opret en konto, og vurder podcasts for at få personlige anbefalinger.",
          items: genericPreviewPodcasts.slice(0, 6),
          message: "Log ind for at se personlige anbefalinger"
        });
        if (firstLockedSection) personalModules.appendChild(firstLockedSection);

        const secondLockedSection = createLockedPreviewSection({
          index: 2,
          title: "Næste på din liste",
          note: "Log ind eller opret en konto, og vurder podcasts for at få din personlige liste.",
          items: genericPreviewPodcasts.slice(6, 12),
          message: "Log ind for at se din personlige liste"
        });
        if (secondLockedSection) personalModules.appendChild(secondLockedSection);

        const unlockCard = document.createElement("section");
        unlockCard.className = "explore-unlock-card";
        unlockCard.innerHTML = `
          <div class="explore-unlock-card__intro">
            <h2>L&aring;s op for en smartere podcastoplevelse</h2>
            <p>Log ind eller opret en gratis konto, og vurd&eacute;r podcasts for at f&aring; personlige anbefalinger.</p>
          </div>
          <ul class="explore-unlock-card__benefits">
            <li><span aria-hidden="true">&#9829;</span><div><strong>Gem dine favoritter</strong><small>Byg dit eget bibliotek med dine yndlingsshows.</small></div></li>
            <li><span aria-hidden="true">&#9733;</span><div><strong>F&aring; personlige forslag</strong><small>Vurd&eacute;r podcasts, s&aring; vi kan l&aelig;re din smag at kende.</small></div></li>
            <li><span aria-hidden="true">&#9776;</span><div><strong>Opret lister</strong><small>Organis&eacute;r dine podcasts, som du vil.</small></div></li>
          </ul>
          <div class="explore-unlock-card__actions">
            <button type="button" data-auth-prompt="login">Log ind</button>
            <button type="button" data-auth-prompt="signup">Opret gratis konto</button>
          </div>
        `;
        personalModules.appendChild(unlockCard);
      }

      sectionsToRender.slice(1).forEach((section, offset) => {
        const sectionElement = createPersonalSection(section, offset + 1);
        if (sectionElement) personalModules.appendChild(sectionElement);
      });

      const favoriteGenreSections = isLoggedIn()
        ? getExploreFavoriteGenreSections({
            searchParts: queryParts,
            genre: localGenre,
            maxSections: exploreDepth.favoriteGenreLimit
          })
        : [];

      favoriteGenreSections.forEach((section, genreIndex) => {
        // Lower-priority genre rows avoid podcasts already shown in either
        // personal or editorial rows, while those top sections keep separate scopes.
        const items = prioritizeExploreItemsForPersonalSnapshot(
          dedupeExploreItems(section.podcasts, usedTopKeys),
          `genre:${section.genreName}`
        );
        if (items.length < EXPLORE_PERSONAL_MINIMUM_GROUP_SIZE) return;

        const sectionElement = document.createElement("section");
        const headingId = `exploreFavoriteGenreHeading${genreIndex + 1}`;
        sectionElement.className =
          "explore-popular explore-recommendations explore-recommendations--genre";
        sectionElement.setAttribute("aria-labelledby", headingId);
        sectionElement.innerHTML = `
          <header class="explore-section-header">
            <div>
              <p class="explore-eyebrow">Anbefalet ud fra din smag</p>
              <h2 id="${headingId}">Mere ${escapeHtml(section.genreName)} til dig</h2>
              <p class="explore-section-lead">Fordi du har vurderet podcasts i denne genre højt.</p>
            </div>
            <a
              class="explore-section-header__link"
              href="#ranglister"
              data-explore-genre-ranking="${escapeHtml(section.genreName)}"
            >Se genren</a>
          </header>
          <div class="explore-grid"></div>
        `;

        appendExploreCards(sectionElement.querySelector(".explore-grid"), items, {
          className: "explore-card--genre-recommendation"
        });
        personalModules.appendChild(sectionElement);
      });

      const shouldRotatePersonalSectionOrder =
        isLoggedIn() && ratedKeys.size > 0 && personalModules.children.length > 1;
      if (shouldRotatePersonalSectionOrder) {
        const orderedSections = orderExplorePersonalSectionsForSnapshot([...personalModules.children]);
        orderedSections.forEach((sectionElement) => {
          personalModules.appendChild(sectionElement);
        });
        personalModules.dataset.sectionOrderHour = exploreHourBucket;
      } else {
        delete personalModules.dataset.sectionOrderHour;
      }

      bindAuthPromptButtons(personalModules);
    }

    if (isMobileExplore) {
      gemsSection?.classList.add("is-hidden");
      popularSection?.classList.add("is-hidden");
      if (gemsGrid) gemsGrid.innerHTML = "";
      if (grid) grid.innerHTML = "";
      if (count) count.textContent = "";
      setupExploreCarouselIndicators(container);
      setupExploreCarouselDragGuard(container);
      return;
    }

    if (showPersonalFirst) {
      gemsSection?.classList.add("is-hidden");
      popularSection?.classList.add("is-hidden");
      if (gemsGrid) gemsGrid.innerHTML = "";
      if (grid) grid.innerHTML = "";
      if (count) count.textContent = "";
      setupExploreCarouselIndicators(container);
      setupExploreCarouselDragGuard(container);
      return;
    }

    if (!popularSection || !grid) {
      setupExploreCarouselIndicators(container);
      setupExploreCarouselDragGuard(container);
      return;
    }

    const matchingPodcasts = state.podcasts
      .filter((podcast) => {
        const key = getPodcastKey(podcast);
        if (ratedKeys.has(key)) {
          return false;
        }

        const stat = getCommunityStat(getPodcastKey(podcast));
        if (!hasCommunityRating(stat)) {
          return false;
        }

        return matchesExploreFilters(podcast, queryParts, localGenre);
      })
      .sort(compareExplorePodcasts);

    if (count) {
      const visibleResultCount = Math.min(matchingPodcasts.length, 8);
      count.textContent =
        matchingPodcasts.length > visibleResultCount
          ? `Viser ${visibleResultCount} af ${matchingPodcasts.length}`
          : `${matchingPodcasts.length} ${
              matchingPodcasts.length === 1 ? "podcast" : "podcasts"
            }`;
    }

    const gemItems = dedupeExploreItems(
      getExploreUnderratedGemItems({
        limit: 4,
        searchParts: queryParts,
        genre: localGenre,
        hourBucket: exploreHourBucket
      }),
      usedTopKeys
    );
    gemsSection?.classList.toggle("is-hidden", !gemItems.length);
    popularSection?.classList.remove("is-hidden");
    if (gemItems.length) {
      appendExploreCards(gemsGrid, gemItems, {
        className: "explore-card--gem"
      });
    } else if (gemsGrid) {
      gemsGrid.innerHTML = "";
    }

    const popularItems = prioritizeExploreItemsForHour(
      dedupeExploreItems(
        matchingPodcasts
          .slice(0, HOME_ROTATION_TOP_LIMIT)
          .map((podcast) => ({
            podcast,
            reason: "Popul\u00e6r blandt brugere"
          })),
        usedTopKeys
      ),
      exploreHourBucket,
      "popular-community"
    ).slice(0, 8);

    grid.innerHTML = "";
    if (!popularItems.length) {
      grid.innerHTML = `
        <div class="explore-empty-state">
          <h3>Ingen podcasts fundet</h3>
          <p>${
            localSearchTerm || localGenre !== "Alle"
              ? "Pr&oslash;v en anden s&oslash;gning eller genre."
              : "Der er endnu ingen podcasts med brugervurderinger."
          }</p>
        </div>
      `;
    } else {
      appendExploreCards(grid, popularItems);
    }

    setupExploreCarouselIndicators(container);
    setupExploreCarouselDragGuard(container);
  };

  searchInput?.addEventListener("input", (event) => {
    localSearchTerm = normalizeText(event.target.value);
    renderExploreResults();
  });

  genreButtons.forEach((button) => {
    const isInitiallyActive = button.dataset.exploreGenre === localGenre;
    button.classList.toggle("is-active", isInitiallyActive);
    button.setAttribute("aria-pressed", String(isInitiallyActive));

    button.addEventListener("click", () => {
      localGenre = button.dataset.exploreGenre || "Alle";
      genreButtons.forEach((genreButton) => {
        const isActive = genreButton === button;
        genreButton.classList.toggle("is-active", isActive);
        genreButton.setAttribute("aria-pressed", String(isActive));
      });
      renderExploreResults();
    });
  });

  container.addEventListener("click", (event) => {
    const genreRankingLink = event.target.closest("[data-explore-genre-ranking]");
    if (genreRankingLink && container.contains(genreRankingLink)) {
      event.preventDefault();
      const genreName = normalizeText(genreRankingLink.dataset.exploreGenreRanking);
      try {
        window.sessionStorage?.setItem("podcastRankingGenre", genreName);
      } catch (error) {
        // Session storage er kun en bekvemmelighed; navigationen virker stadig.
      }
      window.location.hash = "#ranglister";
      return;
    }

    const mainSeriesChip = event.target.closest("[data-action='filter-main-series']");
    if (!mainSeriesChip || !container.contains(mainSeriesChip)) return;

    activateMainSeriesFilter(mainSeriesChip.dataset.value || "");
  });

  bindSuggestionDialog(container);
  bindAuthPromptButtons(container);
  renderExploreResults();
}

function renderRoute() {
  closeMobileHomeSearchOverlay({ clearInput: false });
  deactivateHomePodcastSearchFocus();
  const { rawRoute, route } = getRouteInfoFromHash();

  if (rawRoute === "gemte") {
    window.location.replace("#profil-gemte");
    return null;
  }

  switch (route) {
    case "forside":
    case "ranglister":
    case "udforsk":
    case "profil":
    case "moderator":
      break;
    default:
      window.location.replace("#forside");
      return null;
  }

  document.body.classList.remove(
    "page-forside",
    "page-ranglister",
    "page-udforsk",
    "page-profil",
    "page-moderator"
  );
  document.body.classList.add(`page-${route}`);

  if (route !== "udforsk") {
    state.exploreSuggestionDialogOpen = false;
    document.body.classList.remove("has-suggestion-dialog-open");
    document.body.classList.remove("explore-gate-active");
    document.body.classList.remove("explore-logged-out-preview");
  }

  elements.pageLinks.forEach((link) => {
    const isActive = link.dataset.pageLink === route;
    link.classList.toggle("is-active", isActive);

    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  if (!elements.pageIntroPanel) return null;

  if (route === "ranglister") {
    if (!state.sortTouched) {
      state.sort = state.profilePreferences.defaultSort;
      updateSortToggleUi();
    }
    elements.pageIntroPanel.classList.add("is-hidden");
    elements.pageIntroPanel.innerHTML = "";
    return route;
  }

  if (route === "forside") {
    const featuredReview = state.featuredReviews[0] || null;
    const loggedIn = isLoggedIn();
    const showHomeCommunityCta = !loggedIn;
    const homeDisplayName = getHomeDisplayName();
    const mobileHeroTitle = "Find din næste podcastfavorit";
    const mobileHeroIntro = "Se personlige favoritter, brugernes vurderinger og find noget nyt at lytte til.";
    const mobileHeroPodcastIds = ["millionærklubben", "genstart", "det vi taler om"];
    const mobileHeroPodcastCovers = mobileHeroPodcastIds.map((id, index) => {
      const podcast = state.podcastById[id] || state.podcasts.find((item) => getPodcastId(item) === id);
      const source = podcast ? getPodcastImageSources(podcast)[0] : "";
      return source ? `<div class="home-hero__fixed-cover home-hero__fixed-cover--${["left", "center", "right"][index]}"><img src="${escapeHtml(source)}" alt="" /></div>` : "";
    }).join("");
    const homeHourBucket = getExploreHourBucket();
    const heroPodcasts = getHomeHeroPodcasts(homeHourBucket);
    const heroPodcastPrimary =
      heroPodcasts[0] ||
      state.podcasts.find(
        (podcast) => podcast.image && podcast.title !== featuredReview?.title
      ) ||
      null;
    const heroPodcastSecondary =
      heroPodcasts[1] ||
      state.podcasts.find(
        (podcast) =>
          podcast.image &&
          podcast !== heroPodcastPrimary &&
          podcast.title !== featuredReview?.title
      ) ||
      null;
    const ratedPodcastCount = state.podcasts.reduce(
      (count, podcast) =>
        count +
        (podcast.ratingValue !== null && podcast.ratingValue !== undefined ? 1 : 0),
      0
    );
    const topPodcastCta = getHomeTopPodcastCta(homeHourBucket) || heroPodcastPrimary;
    const savedPodcastCta =
      getHomeSavedPodcastCta(homeHourBucket) ||
      heroPodcastSecondary ||
      topPodcastCta;
    const savedPodcastCtaMeta =
      savedPodcastCta?.ratingLabel || (loggedIn ? "\u00c5bn gemte" : "Log ind");
    const renderDesktopQuickCovers = (podcasts, label) => {
      const covers = podcasts
        .map((podcast) => ({
          podcast,
          image: getPodcastImageSources(podcast)[0] || ""
        }))
        .filter((item) => item.image)
        .slice(0, 4)
        .map(
          ({ image }) => `
            <span class="home-quick-card__desktop-cover">
              <img src="${escapeHtml(image)}" alt="" loading="lazy" decoding="async" />
            </span>
          `
        )
        .join("");

      if (!covers) return "";

      return `
        <span class="home-quick-card__desktop-covers" aria-label="${escapeHtml(label)}">
          ${covers}
        </span>
      `;
    };
    const topPodcastDesktopCovers = renderDesktopQuickCovers(
      getPodcastlistenPlacementPool(1, 15),
      "Udvalgte toppodcasts"
    );
    const savedDesktopPool = Array.from(state.savedPodcastKeys)
      .map((key) => state.podcastByKey[key])
      .filter(Boolean)
      .sort((a, b) =>
        normalizeText(a.title).localeCompare(normalizeText(b.title), "da", {
          sensitivity: "base"
        })
      );
    const savedPodcastDesktopCovers = renderDesktopQuickCovers(
      savedDesktopPool.length ? savedDesktopPool : getPodcastlistenPlacementPool(16, 50),
      savedDesktopPool.length ? "Gemte podcasts" : "Inspiration til gemte podcasts"
    );
    const getHomeQuickImageSource = (podcast) => getPodcastImageSources(podcast)[0] || "";
    const createHomeCtaStyle = (podcast) => {
      const image = getHomeQuickImageSource(podcast);
      return image
        ? ` style="--home-quick-image: url('${escapeHtml(image)}');"`
        : "";
    };
    const topCtaLabel = topPodcastCta?.title
      ? `Top podcasts: ${topPodcastCta.title}`
      : "Top podcasts";
    const savedCtaLabel = savedPodcastCta?.title
      ? `Mine gemte: ${savedPodcastCta.title}`
      : "Mine gemte";
    const homeCtaTopIcon = `
      <svg class="home-quick-card__outline-icon home-quick-card__outline-icon--mobile" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M5 20V11M12 20V5M19 20v-8" />
      </svg>
      <svg class="home-quick-card__outline-icon home-quick-card__outline-icon--desktop" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m12 3.4 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3.4Z" />
      </svg>
    `;
    const homeCtaRankingIcon = `
      <svg class="page-intro-panel__ranking-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
        <path d="M5 20V11M12 20V5M19 20v-8" />
      </svg>
    `;
    const homeCtaSavedIcon = `
      <svg class="home-quick-card__outline-icon home-quick-card__outline-icon--mobile" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 4.5h10a1 1 0 0 1 1 1v15l-6-3.6-6 3.6v-15a1 1 0 0 1 1-1Z" />
      </svg>
      <svg class="home-quick-card__outline-icon home-quick-card__outline-icon--desktop" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 20.2s-6.8-4.3-9.1-8.3C1 8.6 2.7 5 6.3 5c2 0 3.5 1.1 4.4 2.6C11.6 6.1 13.1 5 15.1 5c3.6 0 5.3 3.6 3.4 6.9C16.2 15.9 12 20.2 12 20.2Z" />
      </svg>
    `;

    const authPending = state.authConfigured && !state.authReady;
    const heroAuthMarkup = authPending
      ? '<div class="home-hero__auth-placeholder" aria-hidden="true"></div>'
      : loggedIn
        ? '<div class="home-hero__welcome" aria-label="Velkommen tilbage"><span aria-hidden="true">✦</span><strong>Velkommen tilbage!</strong></div>'
        : `<button class="home-hero__signup" type="button" ${state.authConfigured ? "" : "disabled"}>Opret gratis konto</button>`;

    elements.pageIntroPanel.innerHTML = `
      <div class="home-hero home-hero--${loggedIn ? "logged-in" : "logged-out"}${authPending ? " home-hero--auth-pending" : ""}">
        <div class="home-hero__header">
          <p class="eyebrow"><a class="mobile-brand-word" href="#forside" aria-label="G\u00e5 til forsiden">Podcast<span class="mobile-brand-accent">listen</span></a>Personlige podcastfavoritter</p>
          ${
            loggedIn
              ? `
                <div class="home-account-menu">
                  <button
                    class="home-account-menu__toggle"
                    type="button"
                    aria-label="\u00c5bn profilmenu"
                    aria-expanded="false"
                    data-home-account-toggle
                  >
                    ${escapeHtml((state.authUser?.email || "?").trim().charAt(0).toUpperCase() || "?")}
                  </button>
                  <div class="home-account-menu__panel" data-home-account-menu hidden>
                    <a class="home-account-menu__item" href="#profil">G\u00e5 til profil</a>
                    <button class="home-account-menu__item home-account-menu__item--logout" type="button" data-home-logout>
                      Log ud
                    </button>
                  </div>
                </div>
              `
              : `
                <button
                  class="home-profile-button"
                  type="button"
                  aria-label="Log ind eller opret konto"
                  data-home-profile-button
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
                    <path d="M12 12.2a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4Z"></path>
                    <path d="M4.6 20.4a7.4 4.8 0 0 1 14.8 0"></path>
                  </svg>
                </button>
              `
          }
        </div>
        <div class="home-hero__copy">
          <h1 data-mobile-title="${escapeHtml(mobileHeroTitle)}"><span class="home-hero__headline-line">Find din næste</span> <span class="home-hero__headline-line home-hero__headline-line--accent">podcastfavorit</span></h1>
          <p
            class="intro"
            data-mobile-intro="${escapeHtml(mobileHeroIntro)}"
          >
            ${escapeHtml(mobileHeroIntro)}
          </p>
          ${heroAuthMarkup}
          <div class="home-mobile-actions" aria-label="Hurtige handlinger">
            <a class="home-mobile-action home-mobile-action--primary" href="#ranglister">Se ranglisten</a>
          </div>
          <div class="page-intro-panel__actions">
            ${
              loggedIn
                ? '<a class="page-intro-panel__button" href="#udforsk">Udforsk podcasts</a>'
                : `<button
                    class="page-intro-panel__button home-hero__signup"
                    type="button"
                    ${state.authConfigured ? "" : "disabled"}
                  >Opret dig</button>`
            }
            <a
              class="page-intro-panel__button page-intro-panel__button--secondary"
              href="#ranglister"
            >
              ${homeCtaRankingIcon}Se ranglister
            </a>
          </div>
        </div>
        ${
          loggedIn
            ? `
              <div class="home-account-menu">
                <button
                  class="home-account-menu__toggle"
                  type="button"
                  aria-label="Åbn profilmenu"
                  aria-expanded="false"
                  data-home-account-toggle
                >
                  ${escapeHtml((state.authUser?.email || "?").trim().charAt(0).toUpperCase() || "?")}
                </button>
                <div class="home-account-menu__panel" data-home-account-menu hidden>
                  <a class="home-account-menu__item" href="#profil">Gå til profil</a>
                  <button class="home-account-menu__item home-account-menu__item--logout" type="button" data-home-logout>
                    Log ud
                  </button>
                </div>
              </div>
            `
            : ""
        }
        <div class="home-hero__visual home-hero__visual--scroller" aria-label="Bedst vurderede podcasts, udvalget skifter hver time">
          <div class="home-hero__glow" aria-hidden="true"></div>
          <div class="home-hero__scroller-shell">
            <button
              class="home-hero__scroll-button home-hero__scroll-button--previous"
              type="button"
              data-home-hero-scroll="previous"
              aria-label="Vis tidligere podcasts"
              aria-hidden="true"
              disabled
            >
              <span aria-hidden="true">&#8249;</span>
            </button>
            <div
              class="home-hero__rail"
              data-home-hero-rail
              tabindex="0"
              aria-label="Horisontal liste med bedst vurderede podcasts"
            >
              ${Array.from(
                { length: HOME_HERO_COVER_COUNT },
                (_, index) => `
                  <button
                    class="home-hero__cover home-hero__cover--slot-${index + 1}"
                    type="button"
                    data-home-hero-slot="${index}"
                    disabled
                  >
                    <img alt="" loading="lazy" />
                    <span class="home-hero__card-overlay" aria-hidden="true">
                      <span class="home-hero__card-title"></span>
                      <span class="home-hero__card-meta">
                        <span class="home-hero__card-genre"></span>
                        <strong class="home-hero__card-rating"></strong>
                      </span>
                    </span>
                  </button>
                `
              ).join("")}
            </div>
            <button
              class="home-hero__scroll-button home-hero__scroll-button--next"
              type="button"
              data-home-hero-scroll="next"
              aria-label="Vis flere podcasts"
            >
              <span aria-hidden="true">&#8250;</span>
            </button>
          </div>
          <div
            class="home-hero__indicators"
            data-home-hero-indicators
            aria-label="Flere grupper af topbedømte podcasts"
          ></div>
        </div>
        <div class="home-hero__visual home-hero__visual--mobile-fixed" aria-hidden="true">
          <div class="home-hero__fixed-glow"></div>
          ${mobileHeroPodcastCovers}
        </div>
      </div>
      <form class="home-podcast-search" data-home-podcast-search role="search" aria-label="Søg podcasts">
        <svg class="home-podcast-search__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="10.8" cy="10.8" r="6.4"></circle><path d="m16 16 4.2 4.2"></path></svg>
        <input class="home-podcast-search__input" data-home-podcast-search-input type="search" autocomplete="off" spellcheck="false" placeholder="Søg efter podcasts..." aria-label="Søg efter podcasts" aria-autocomplete="list" aria-controls="homePodcastSearchResults" aria-expanded="false" />
        <div id="homePodcastSearchResults" class="home-podcast-search__results is-hidden" data-home-podcast-search-results role="listbox" aria-label="Søgeresultater"></div>
      </form>
      <div class="home-quick-cards" aria-label="Genveje p&aring; forsiden">
        <a class="home-quick-card home-quick-card--top" href="#ranglister"${createHomeCtaStyle(topPodcastCta)} aria-label="${escapeHtml(topCtaLabel)}">
          <span class="home-quick-card__cover-bg" aria-hidden="true"></span>
          ${
            getHomeQuickImageSource(topPodcastCta)
              ? `<img class="home-quick-card__cover" src="${escapeHtml(getHomeQuickImageSource(topPodcastCta))}" alt="" loading="lazy" decoding="async" />`
              : ""
          }
          <span class="home-quick-card__content">
            <span class="home-quick-card__label">${homeCtaTopIcon}<span>Top podcasts</span></span>
            <span class="home-quick-card__desktop-copy">
              <strong>Top podcasts</strong>
              <span>Se de bedst vurderede podcasts p&aring; Podcastlisten.</span>
            </span>
            ${topPodcastDesktopCovers}
            <span class="home-quick-card__desktop-action">Se ranglisten</span>
          </span>
          <span class="home-quick-card__arrow" aria-hidden="true">&rsaquo;</span>
        </a>
        <button class="home-quick-card home-quick-card--saved" type="button" data-home-cta="saved"${createHomeCtaStyle(savedPodcastCta)} aria-label="${escapeHtml(savedCtaLabel)}">
          <span class="home-quick-card__cover-bg" aria-hidden="true"></span>
          ${
            getHomeQuickImageSource(savedPodcastCta)
              ? `<img class="home-quick-card__cover" src="${escapeHtml(getHomeQuickImageSource(savedPodcastCta))}" alt="" loading="lazy" decoding="async" />`
              : ""
          }
          <span class="home-quick-card__content">
            <span class="home-quick-card__label">${homeCtaSavedIcon}<span>Mine gemte</span></span>
            <span class="home-quick-card__desktop-copy">
              <strong>Mine gemte</strong>
              <span>${
                loggedIn
                  ? state.savedPodcastKeys.size
                    ? `${state.savedPodcastKeys.size} gemte podcasts klar i dit bibliotek.`
                    : "Gem podcasts og saml dine favoritter her."
                  : "Log ind og gem podcasts med en gratis konto."
              }</span>
            </span>
            ${savedPodcastDesktopCovers}
            <span class="home-quick-card__desktop-action">${
              loggedIn ? "\u00c5bn gemte" : "Log ind for at gemme"
            }</span>
          </span>
          <span class="home-quick-card__arrow" aria-hidden="true">&rsaquo;</span>
        </button>
      </div>
      <div class="home-primary-row">
      <section class="home-featured" aria-labelledby="homeFeaturedHeading">
        <div class="section-header">
          <div>
            <p class="eyebrow">Podcastlisten anbefaler</p>
            <h2 id="homeFeaturedHeading">Ugens anbefaling</h2>
          </div>
        </div>
        <article class="home-featured__content"></article>
      </section>
      <section class="home-popular" aria-labelledby="homePopularHeading">
        <div class="section-header">
          <div>
            <p class="eyebrow">Brugernes favoritter</p>
            <h2 id="homePopularHeading">Populært blandt brugere</h2>
          </div>
        </div>
        <div class="home-popular__grid"></div>
        <button class="home-popular__arrow home-popular__arrow--previous" type="button" aria-label="Forrige populære podcasts">
          <span aria-hidden="true">&lsaquo;</span>
        </button>
        <button class="home-popular__arrow home-popular__arrow--next" type="button" aria-label="Næste populære podcasts">
          <span aria-hidden="true">&rsaquo;</span>
        </button>
        <div class="home-popular__indicators" aria-label="Carousel-position"></div>
        <a class="home-popular__ranking-link" href="#ranglister" data-home-popular-ranking>Se hele ranglisten</a>
      </section>
      </div>
      <section class="home-editorial-latest" aria-labelledby="homeEditorialLatestHeading">
        <div class="section-header">
          <div>
            <h2 id="homeEditorialLatestHeading">Podcastlistens seneste vurderinger</h2>
        <p class="home-editorial-latest__subtitle">Seneste vurderinger og anmeldelser fra redaktionen</p>
          </div>
        </div>
        <div class="home-editorial-latest__content"></div>
      </section>
      <div class="home-secondary-row">
        <section class="home-genres" aria-labelledby="homeGenresHeading">
          <div class="section-header">
            <div>
              <p class="eyebrow">Podcastlistens favoritter</p>
              <h2 id="homeGenresHeading" data-mobile-title="Top i genrer">Top i genrer</h2>
            </div>
            <a class="home-genres__all-link" href="#ranglister" data-home-genres-all>Se alle</a>
          </div>
          <p class="home-genres__hint">Tryk p&aring; en genre for at se ranglisten i kategorien.</p>
          <div class="home-genres__grid"></div>
        </section>
      </div>
      ${
        showHomeCommunityCta
          ? `
            <section class="home-community-cta" aria-labelledby="homeCommunityCtaHeading">
              <div class="home-community-cta__copy">
                <p class="home-community-cta__eyebrow">Gratis konto</p>
                <h2 id="homeCommunityCtaHeading">F&aring; mere ud af Podcastlisten</h2>
                <ul class="home-community-cta__benefits">
                  <li>
                    <strong>Gem dine favoritter</strong>
                    <span>Gem og find dine yndlingspodcasts.</span>
                  </li>
                  <li>
                    <strong>Giv dine vurderinger</strong>
                    <span>Hj&aelig;lp andre med at finde de bedste podcasts.</span>
                  </li>
                  <li>
                    <strong>F&aring; personlige anbefalinger</strong>
                    <span>F&aring; forslag baseret p&aring; dine interesser.</span>
                  </li>
                </ul>
              </div>
              <button
                class="home-community-cta__button"
                type="button"
                ${state.authConfigured ? "" : "disabled"}
              >
                Opret gratis konto
              </button>
            </section>
          `
          : ""
      }
    `;

    updateHomeHeroCovers({ force: true });

    elements.pageIntroPanel
      .querySelectorAll("[data-home-hero-slot]")
      .forEach((cover) => {
        cover.addEventListener("click", () => {
          const podcastKey = cover.dataset.podcastKey;
          const podcast = podcastKey ? state.podcastByKey[podcastKey] : null;
          if (!podcast) return;
          openPodcastDetailSheet(podcast, cover, { allowDesktop: true });
        });
      });

    bindHomeHeroScroller(elements.pageIntroPanel);
    bindHomePodcastSearch();

    const featuredContent = elements.pageIntroPanel.querySelector(
      ".home-featured__content"
    );

    renderHomeFeatured(featuredContent);

    renderHomePopular(
      elements.pageIntroPanel.querySelector(".home-popular__grid")
    );
    renderHomeLatestEditorial(
      elements.pageIntroPanel.querySelector(".home-editorial-latest__content")
    );
    renderHomeGenres(
      elements.pageIntroPanel.querySelector(".home-genres__grid")
    );

    elements.pageIntroPanel
      .querySelector("[data-home-genres-all]")
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        state.activeFilter = null;
        state.minimumRating = 0;
        resetVisibleCount();
        createGenreChips();
        updateRatingFilterUi();
        window.location.hash = "#ranglister";
      });

    elements.pageIntroPanel
      .querySelector("[data-home-popular-ranking]")
      ?.addEventListener("click", (event) => {
        event.preventDefault();
        state.rankingSource = "users";
        state.rankingSourceTouched = true;
        resetVisibleCount();
        window.location.hash = "#ranglister";
      });

    const homeCommunityCtaButton = elements.pageIntroPanel.querySelector(
      ".home-community-cta__button"
    );
    homeCommunityCtaButton?.addEventListener("click", () => {
      showAuthPrompt("signup");
    });

    elements.pageIntroPanel
      .querySelectorAll(".home-hero__signup")
      .forEach((button) => {
        button.addEventListener("click", () => {
          showAuthPrompt("signup");
        });
      });

    elements.pageIntroPanel
      .querySelectorAll("[data-home-profile-button]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          handleMobileToplineProfileClick();
        });
      });

    elements.pageIntroPanel
      .querySelectorAll("[data-mobile-page-profile-button]")
      .forEach((button) => {
        button.addEventListener("click", handleMobileToplineProfileClick);
      });

    elements.pageIntroPanel
      .querySelectorAll("[data-home-shortcut]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          const action = button.dataset.homeShortcut;

          if (action === "recent") {
            elements.pageIntroPanel
              .querySelector(".home-recent")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }

          if (action === "genres") {
            elements.pageIntroPanel
              .querySelector(".home-genres")
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
          }

          if (action === "saved") {
            openSavedProfileOrLogin();
          }
        });
      });

    elements.pageIntroPanel
      .querySelectorAll("[data-home-cta='saved']")
      .forEach((button) => {
        button.addEventListener("click", () => {
          openSavedProfileOrLogin();
        });
      });

    renderDesktopHomeFooter(elements.pageIntroPanel);
    bindHomeAccountMenu();
    elements.pageIntroPanel.classList.remove("is-hidden");
    return route;
  }

  if (route === "profil") {
    renderProfilePage();
    return route;
  }

  if (route === "moderator") {
    renderModeratorPage();
    return route;
  }

  if (route === "udforsk") {
    renderExplorePage();
    bindMobileToplineProfileButtons(elements.pageIntroPanel);
    bindHomeAccountMenu(elements.pageIntroPanel);
    return route;
  }

  const loggedIn = isLoggedIn();
  let title = "";
  let text = "";
  let action = "";

  switch (route) {
    case "profil":
      title = "Din profil";
      text = loggedIn
        ? `Du er logget ind som ${state.authUser.email || "bruger"}.`
        : "Log ind for at se din profil.";
      break;
  }

  elements.pageIntroPanel.innerHTML = `
    <h2>${escapeHtml(title)}</h2>
    <p>${escapeHtml(text)}</p>
    ${action ? `<div class="page-intro-panel__actions">${action}</div>` : ""}
  `;
  elements.pageIntroPanel.classList.remove("is-hidden");
  return route;
}

function handlePodcastGridClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget || !elements.podcastGrid.contains(actionTarget)) {
    const card = event.target.closest(".podcast-card");
    const key = card?.dataset.key;
    const podcast = key ? state.podcastByKey[key] : null;
    if (card && podcast) {
      if (!handleMobilePodcastCardOpen(event, podcast, card)) {
        event.preventDefault();
        event.stopPropagation();
        openPodcastDetailSheet(podcast, card, { allowDesktop: true });
      }
    }
    return;
  }

  const card = actionTarget.closest(".podcast-card");
  const key = card?.dataset.key;
  const podcast = key ? state.podcastByKey[key] : null;

  if (!podcast) return;

  const review = getReviewForPodcast(podcast);
  const action = actionTarget.dataset.action;

  if (action === "filter-desktop-main-series") {
    event.preventDefault();
    event.stopPropagation();
    setDesktopMainSeriesFilter(actionTarget.dataset.value || "");
    return;
  }

  if (action === "filter-desktop-publisher") {
    event.preventDefault();
    event.stopPropagation();
    setDesktopPublisherFilter(actionTarget.dataset.value || "");
    return;
  }

  if (action === "open-details") {
    openPodcastDetailSheet(podcast, actionTarget, { allowDesktop: true });
    return;
  }

  if (action === "open-link") {
    const url =
      state.openReviewKeys.has(key) && review
        ? review.link || podcast.link
        : podcast.link;

    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    return;
  }

  if (action === "open-review" && review) {
    state.openReviewKeys.add(key);
    const displayRank = parseNumber(card.dataset.displayRank);
    card.replaceWith(createPodcastReviewCardElement(podcast, review, key, displayRank));
    return;
  }

  if (action === "close-review") {
    state.openReviewKeys.delete(key);
    const displayRank = parseNumber(card.dataset.displayRank);
    card.replaceWith(createPodcastCardElement(podcast, displayRank));
    return;
  }

  if (action === "filter-publisher") {
    setActiveFilter("publisher", actionTarget.dataset.value || "");
    scrollToRankingStart();
    return;
  }

  if (action === "filter-genre") {
    setActiveFilter("genre", actionTarget.dataset.value || "");
    scrollToRankingStart();
    return;
  }

  if (action === "filter-main-series") {
    activateMainSeriesFilter(actionTarget.dataset.value || "");
    return;
  }

  if (action === "open-rating") {
    openRatingDialog(podcast);
    return;
  }

  if (action === "toggle-favorite" || action === "toggle-save") {
    handleFavoriteToggle(event, podcast);
    return;
  }
}


function renderDesktopHomeFooter(container = elements.pageIntroPanel) {
  if (!container) return;

  container.querySelector(".desktop-home-footer")?.remove();

  const footer = document.createElement("footer");
  footer.className = "desktop-home-footer";
  footer.setAttribute("aria-label", "Om Podcastlisten og praktiske oplysninger");
  footer.innerHTML = `
    <div class="desktop-home-footer__brand">
      <span class="desktop-home-footer__logo" aria-hidden="true"></span>
      <span class="desktop-home-footer__brand-copy">
        <strong>Podcastlisten.dk</strong>
        <span>Find din næste favorit</span>
      </span>
    </div>

    <nav class="desktop-home-footer__nav" aria-label="Links i sidefoden">
      <button type="button" data-footer-info="about">Om Podcastlisten.dk</button>
      <a href="mailto:podcastlisten.dk@gmail.com">Kontakt</a>
      <a href="mailto:podcastlisten.dk@gmail.com?subject=Annoncering%20p%C3%A5%20Podcastlisten.dk">Annoncering</a>
      <button type="button" data-footer-info="privacy">Privatliv</button>
      <button type="button" data-footer-info="terms">Vilk&aring;r</button>
    </nav>

    <a
      class="desktop-home-footer__mail"
      href="mailto:podcastlisten.dk@gmail.com"
      aria-label="Skriv til Podcastlisten"
    >
      podcastlisten.dk@gmail.com
    </a>

    <dialog class="desktop-home-footer__dialog" aria-labelledby="desktopHomeFooterDialogTitle">
      <form method="dialog" class="desktop-home-footer__dialog-panel">
        <button
          class="desktop-home-footer__dialog-close"
          type="submit"
          aria-label="Luk"
        >
          &times;
        </button>
        <p class="desktop-home-footer__dialog-eyebrow"></p>
        <h2 id="desktopHomeFooterDialogTitle"></h2>
        <div class="desktop-home-footer__dialog-content"></div>
      </form>
    </dialog>
  `;

  container.appendChild(footer);

  const dialog = footer.querySelector(".desktop-home-footer__dialog");
  const title = footer.querySelector("#desktopHomeFooterDialogTitle");
  const eyebrow = footer.querySelector(".desktop-home-footer__dialog-eyebrow");
  const content = footer.querySelector(".desktop-home-footer__dialog-content");

  const pages = {
    about: {
      eyebrow: "Om os",
      title: "Om Podcastlisten.dk",
      html: `
        <p>Podcastlisten g&oslash;r det lettere at finde den n&aelig;ste podcast, der er v&aelig;rd at lytte til.</p>
        <p>Siden samler redaktionelle vurderinger, brugernes bed&oslash;mmelser, ranglister, genrer og personlige gemte podcasts &eacute;t sted.</p>
        <p>Ambitionen er en enkel og trov&aelig;rdig dansk podcastoversigt, hvor gode serier er nemme at opdage.</p>
      `
    },
    privacy: {
      eyebrow: "Dine oplysninger",
      title: "Privatliv",
      html: `
        <p>Podcastlisten kan gemme din konto og dit visningsnavn samt dine vurderinger, gemte podcasts og indsendte forslag.</p>
        <p>N&oslash;dvendige tekniske oplysninger bruges til login og drift. Under Profil kan du &aelig;ndre dine oplysninger, eksportere dine data eller anmode om at f&aring; kontoen slettet.</p>
        <p>Sp&oslash;rgsm&aring;l om privatliv kan sendes til <a href="mailto:podcastlisten.dk@gmail.com">podcastlisten.dk@gmail.com</a>.</p>
      `
    },
    terms: {
      eyebrow: "Brug af siden",
      title: "Vilk&aring;r",
      html: `
        <p>Ranglister, vurderinger og anbefalinger er vejledende og afspejler Podcastlistens redaktionelle vurderinger og brugernes bed&oslash;mmelser.</p>
        <p>Links til podcasts f&oslash;rer til eksterne udbydere, som har deres egne vilk&aring;r. Podcastlisten er ikke ansvarlig for indhold eller &aelig;ndringer hos disse tjenester.</p>
        <p>Ved at oprette en konto accepterer du, at dine egne vurderinger kan indg&aring; anonymt i de samlede brugervurderinger.</p>
      `
    }
  };

  footer.querySelectorAll("[data-footer-info]").forEach((button) => {
    button.addEventListener("click", () => {
      const page = pages[button.dataset.footerInfo];
      if (!page || !dialog || !title || !eyebrow || !content) return;
      eyebrow.textContent = page.eyebrow;
      title.innerHTML = page.title;
      content.innerHTML = page.html;
      dialog.showModal();
    });
  });

  dialog?.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function setupMobileViewportOffsets() {
  if (setupMobileViewportOffsets.initialized) return;
  setupMobileViewportOffsets.initialized = true;

  const root = document.documentElement;
  let frameId = null;

  const updateOffset = () => {
    frameId = null;
    const viewport = window.visualViewport;
    let bottomOffset = 0;
    let topOffset = 0;

    if (viewport) {
      const viewportTop = Math.max(0, viewport.offsetTop || 0);
      const occludedBottom = Math.max(0, window.innerHeight - viewport.height - viewportTop);
      const keyboardLikelyOpen = occludedBottom > 160 || viewport.height < window.innerHeight * 0.75;
      bottomOffset = keyboardLikelyOpen ? 0 : occludedBottom;
      topOffset = viewportTop;
    }

    root.style.setProperty("--mobile-browser-bottom-offset", `${Math.round(bottomOffset)}px`);
    root.style.setProperty("--mobile-visual-top", `${Math.round(topOffset)}px`);
  };

  const scheduleUpdate = () => {
    if (frameId !== null) return;
    frameId = window.requestAnimationFrame(updateOffset);
  };

  scheduleUpdate();
  window.visualViewport?.addEventListener("resize", scheduleUpdate, { passive: true });
  window.visualViewport?.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  window.addEventListener("orientationchange", scheduleUpdate, { passive: true });
  window.addEventListener("pageshow", scheduleUpdate, { passive: true });
}

function setupRankingScrollToBottomButton() {
  if (setupRankingScrollToBottomButton.initialized) return;
  setupRankingScrollToBottomButton.initialized = true;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "ranking-scroll-bottom-button";
  button.setAttribute("aria-label", "G\u00e5 til bunden af ranglisten");
  button.setAttribute("aria-hidden", "true");
  button.hidden = true;
  button.disabled = true;
  button.innerHTML = `
    <span class="ranking-scroll-bottom-button__icon" aria-hidden="true">&#8595;</span>
    <span class="ranking-scroll-bottom-button__copy">
      <strong>G\u00e5 til bunden</strong>
      <small>Se alle podcasts</small>
    </span>
  `;
  document.body.appendChild(button);

  const topButton = document.createElement("button");
  topButton.type = "button";
  topButton.className = "ranking-scroll-bottom-button ranking-scroll-bottom-button--top";
  topButton.setAttribute("aria-label", "G\u00e5 til toppen af ranglisten");
  topButton.setAttribute("aria-hidden", "true");
  topButton.hidden = true;
  topButton.disabled = true;
  topButton.innerHTML = `
    <span class="ranking-scroll-bottom-button__icon" aria-hidden="true">&#8593;</span>
    <span class="ranking-scroll-bottom-button__copy">
      <strong>G\u00e5 til toppen</strong>
    </span>
  `;
  document.body.appendChild(topButton);

  let lastRankingScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
  let upwardDistance = 0;
  let isReturningToRankingTop = false;
  let isGoingToRankingBottom = false;
  let skipNextBottomTouchClick = false;
  const nearTopThreshold = 24;

  const setControlVisibility = (control, visible) => {
    control.hidden = !visible;
    control.classList.toggle("is-visible", visible);
    control.disabled = !visible || (control === button && isGoingToRankingBottom);
    control.setAttribute("aria-hidden", String(!visible));
  };

  const updateTopControlOffset = () => {
    const headerBottom = [...document.querySelectorAll(".topbar, .site-nav")].reduce(
      (maximum, header) => {
        const style = window.getComputedStyle(header);
        const rect = header.getBoundingClientRect();
        const isTopAnchored =
          (style.position === "fixed" || style.position === "sticky") &&
          rect.top <= nearTopThreshold &&
          rect.bottom > 0;
        return isTopAnchored ? Math.max(maximum, rect.bottom) : maximum;
      },
      0
    );
    document.documentElement.style.setProperty(
      "--ranking-scroll-top-offset",
      `${Math.ceil(headerBottom + 16)}px`
    );
  };

  const getDocumentBottom = () =>
    Math.max(
      0,
      Math.max(document.body?.scrollHeight || 0, document.documentElement.scrollHeight) -
        window.innerHeight
    );

  let stopMobileRankingBottomAnchor = null;

  const getMobileRankingBottomClearance = () => {
    const fixedNavigation = [...document.querySelectorAll(".topbar .site-nav, .site-nav")].find(
      (navigation) => {
        const style = window.getComputedStyle(navigation);
        const rect = navigation.getBoundingClientRect();
        return style.position === "fixed" && rect.bottom > 0 && rect.top < window.innerHeight;
      }
    );
    if (!fixedNavigation) return 12;

    const navTop = fixedNavigation.getBoundingClientRect().top;
    return Math.ceil(Math.max(0, window.innerHeight - navTop) + 12);
  };

  const anchorMobileRankingBottom = () => {
    const rankingGrid = elements.podcastGrid;
    const target = rankingGrid?.querySelector(".podcast-card:last-of-type") || rankingGrid?.lastElementChild;
    if (!target) return false;

    stopMobileRankingBottomAnchor?.();

    let frameId = null;
    const scrollToCurrentBottom = () => {
      frameId = null;
      if (!document.body.classList.contains("page-ranglister")) return;

      // The final card is a layout anchor. Re-run this only when the ranking
      // grid actually changes size, rather than relying on an arbitrary delay.
      target.scrollIntoView({ block: "end", inline: "nearest", behavior: "auto" });
      const visibleBottom = window.innerHeight - getMobileRankingBottomClearance();
      const targetBottom = target.getBoundingClientRect().bottom;
      window.scrollBy({ top: targetBottom - visibleBottom, left: 0, behavior: "auto" });
    };
    const scheduleScroll = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(scrollToCurrentBottom);
    };
    const observer = new ResizeObserver(scheduleScroll);
    observer.observe(rankingGrid);

    const stop = () => {
      observer.disconnect();
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      frameId = null;
      ["pointerdown", "touchstart", "wheel", "keydown"].forEach((type) =>
        window.removeEventListener(type, stop, { capture: true })
      );
      if (stopMobileRankingBottomAnchor === stop) {
        stopMobileRankingBottomAnchor = null;
      }
    };
    ["pointerdown", "touchstart", "wheel", "keydown"].forEach((type) =>
      window.addEventListener(type, stop, { capture: true, once: true, passive: true })
    );
    stopMobileRankingBottomAnchor = stop;
    scrollToCurrentBottom();
    return true;
  };

  const updateRankingScrollControls = () => {
    updateTopControlOffset();
    const isRankingRoute = document.body.classList.contains("page-ranglister");
    const maxScrollY = getDocumentBottom();
    const currentScrollY = Math.max(0, window.scrollY || document.documentElement.scrollTop || 0);
    const visibilityThreshold = window.innerHeight * 2;
    const topVisibilityThreshold = window.innerHeight * 3;
    const scrollDelta = currentScrollY - lastRankingScrollY;

    if (!isRankingRoute || currentScrollY <= nearTopThreshold) {
      upwardDistance = 0;
      if (!isRankingRoute) isReturningToRankingTop = false;
      if (currentScrollY <= nearTopThreshold) isReturningToRankingTop = false;
    } else if (scrollDelta < -2) {
      upwardDistance += Math.abs(scrollDelta);
    } else if (scrollDelta > 2) {
      upwardDistance = 0;
    }
    lastRankingScrollY = currentScrollY;

    const canSkipMeaningfulContent = maxScrollY > visibilityThreshold + 120;
    const hasMoreBelow = currentScrollY < maxScrollY - 120;
    const shouldShowTop =
      isRankingRoute &&
      maxScrollY > topVisibilityThreshold + 120 &&
      currentScrollY > 120 &&
      upwardDistance >= topVisibilityThreshold &&
      !isReturningToRankingTop;
    const shouldShowBottom =
      isRankingRoute &&
      canSkipMeaningfulContent &&
      currentScrollY >= visibilityThreshold &&
      hasMoreBelow &&
      upwardDistance === 0 &&
      !shouldShowTop;

    setControlVisibility(button, shouldShowBottom);
    setControlVisibility(topButton, shouldShowTop);
  };

  const goToRankingBottom = async () => {
    if (!document.body.classList.contains("page-ranglister") || isGoingToRankingBottom) return;

    isGoingToRankingBottom = true;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");

    // Ranglister renders progressively. Expand the current filtered result first,
    // then measure the document so the target is the true page bottom, not the
    // bottom of the currently rendered batch.
    try {
      state.rankingUsedGoToBottom = true;
      const filteredCount = getFilteredPodcasts().length;
      const isMobileRanking = !isDesktopRankingViewport();
      if (isMobileRanking) {
        state.mobileRankingTailMode = true;
        state.visibleCount = Math.min(MOBILE_RANKING_TAIL_SIZE, filteredCount);
        renderPodcastGrid();
      } else if (state.visibleCount < filteredCount) {
        state.visibleCount = filteredCount;
        renderPodcastGrid();
      }

      if (isMobileRanking) {
        anchorMobileRankingBottom();
      } else {
        await new Promise((resolve) => window.requestAnimationFrame(resolve));
        const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
        window.scrollTo({
          top: getDocumentBottom(),
          left: 0,
          behavior: reduceMotion ? "auto" : "smooth"
        });
      }
    } finally {
      isGoingToRankingBottom = false;
      button.removeAttribute("aria-busy");
      updateRankingScrollControls();
    }
  };

  button.addEventListener("pointerdown", (event) => {
    // On touch screens the control moves/hides as part of its action. Own the
    // gesture before that happens so iOS cannot retarget its compatibility tap
    // to a ranking-card link now exposed at the same coordinate.
    event.stopPropagation();
    if (event.pointerType !== "touch") {
      skipNextBottomTouchClick = false;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    skipNextBottomTouchClick = false;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a guard, not a requirement for the native button.
    }
  });

  button.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch") return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    skipNextBottomTouchClick = true;
    try {
      button.releasePointerCapture(event.pointerId);
    } catch {
      // The capture may already have been released by the browser.
    }
    void goToRankingBottom();
  });

  button.addEventListener("pointercancel", (event) => {
    if (event.pointerType !== "touch") return;
    skipNextBottomTouchClick = false;
  });

  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    // A touch pointerup above owns the action. This remains a defensive
    // consume in case a browser still emits a compatibility click.
    if (skipNextBottomTouchClick && event.detail > 0) {
      skipNextBottomTouchClick = false;
      return;
    }
    void goToRankingBottom();
  });

  topButton.addEventListener("click", () => {
    if (!document.body.classList.contains("page-ranglister")) return;
    stopMobileRankingBottomAnchor?.();
    if (!isDesktopRankingViewport() && state.mobileRankingTailMode) {
      resetVisibleCount();
      renderPodcastGrid();
    }
    isReturningToRankingTop = true;
    upwardDistance = 0;
    lastRankingScrollY = 0;
    setControlVisibility(topButton, false);
    const isMobileRanking = !isDesktopRankingViewport();
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: isMobileRanking || reduceMotion ? "auto" : "smooth"
    });
  });

  window.addEventListener("scroll", updateRankingScrollControls, { passive: true });
  window.addEventListener("resize", updateRankingScrollControls, { passive: true });
  setupRankingScrollToBottomButton.updateVisibility = updateRankingScrollControls;
  updateRankingScrollControls();
}

function updateRankingScrollToBottomButton() {
  setupRankingScrollToBottomButton.updateVisibility?.();
}

function setupEvents() {
  setupRankingScrollToBottomButton();
  bindMobileHomeSearchOverlay();
  bindPodcastAccessTooltip();
  const handleRouteHistoryChange = () => {
    render();
    restorePodcastDetailFromHistory();
  };
  window.addEventListener("hashchange", handleRouteHistoryChange);
  window.addEventListener("popstate", handleRouteHistoryChange);

  elements.pageLinks.forEach((link) => {
    link.addEventListener("click", () => {
      if (link.dataset.pageLink === "forside") {
        scrollWindowToTop();
      }
      if (
        document.body.classList.contains("page-ranglister") &&
        link.dataset.pageLink !== "ranglister" &&
        !state.rankingUsedGoToBottom
      ) {
        saveRankingScrollPosition();
        state.rankingScrollPositionCaptured = true;
      }
    });

    link.addEventListener("pointerenter", () => warmRouteFromNavigationLink(link), {
      passive: true
    });
    link.addEventListener("focus", () => warmRouteFromNavigationLink(link));
  });

  if (elements.searchInput) {
    clearSearchInput();

    elements.searchInput.addEventListener("pointerdown", enableSearchInput, { once: true });

    elements.searchInput.addEventListener("focus", () => {
      enableSearchInput();

      if (elements.searchInput?.value && elements.searchInput.value.includes("@")) {
        clearSearchInput({ rerender: true });
      }
    });

    elements.searchInput.addEventListener("input", (event) => {
      state.searchTerm = event.target.value.trim();
      updateSearchClearButton();
      resetVisibleCount();
      render();
    });

    elements.searchClearButton?.addEventListener("pointerdown", (event) => {
      event.preventDefault();
    });

    elements.searchClearButton?.addEventListener("click", (event) => {
      event.preventDefault();

      if (!elements.searchInput) return;

      elements.searchInput.value = "";
      state.searchTerm = "";
      updateSearchClearButton();
      elements.searchInput.focus({ preventScroll: true });
      resetVisibleCount();
      renderPodcastGrid();
    });
  }

  elements.desktopHeaderSearch?.addEventListener("submit", (event) => {
    event.preventDefault();
    if (headerSearchState.matches.length) {
      openHeaderSearchResult(
        headerSearchState.activeIndex >= 0 ? headerSearchState.activeIndex : 0
      );
    }
  });

  elements.desktopHeaderSearchInput?.addEventListener("input", renderHeaderSearchResults);

  elements.desktopHeaderSearchInput?.addEventListener("focus", renderHeaderSearchResults);

  elements.desktopHeaderSearchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeHeaderPodcastSearch({ clearInput: true, closeMobile: true });
      return;
    }

    if (!headerSearchState.matches.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHeaderSearchActiveIndex(headerSearchState.activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHeaderSearchActiveIndex(
        headerSearchState.activeIndex < 0
          ? headerSearchState.matches.length - 1
          : headerSearchState.activeIndex - 1
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      openHeaderSearchResult(
        headerSearchState.activeIndex >= 0 ? headerSearchState.activeIndex : 0
      );
    }
  });

  elements.desktopHeaderSearchResults?.addEventListener("click", (event) => {
    const result = event.target.closest("[data-header-search-index]");
    if (!result) return;
    openHeaderSearchResult(Number(result.dataset.headerSearchIndex));
  });

  elements.mobileHeaderSearchButton?.addEventListener("click", () => {
    const isOpen = elements.desktopHeaderSearch?.classList.toggle("is-mobile-open");
    elements.mobileHeaderSearchButton?.setAttribute("aria-expanded", String(Boolean(isOpen)));

    if (isOpen) {
      elements.desktopHeaderSearchInput?.focus({ preventScroll: true });
      renderHeaderSearchResults();
    } else {
      closeHeaderPodcastSearch();
    }
  });
  elements.mobileHeaderSearchClose?.addEventListener("click", () => {
    closeHeaderPodcastSearch({ clearInput: true, closeMobile: true });
    elements.mobileHeaderSearchButton?.focus({ preventScroll: true });
  });

  elements.desktopUserButton?.addEventListener("click", () => {
    toggleDesktopUserMenu();
  });

  elements.desktopUserProfileLink?.addEventListener("click", () => {
    closeDesktopUserMenu();
    navigateToSuggestionNotification();
  });

  elements.desktopUserLogoutButton?.addEventListener("click", () => {
    closeDesktopUserMenu();
    handleLogout();
  });

  elements.ratingInput?.addEventListener("input", () => {
    updateRatingDialogMessage("");
  });

  elements.ratingInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" || state.authBusy) return;

    event.preventDefault();
    saveActiveRating();
  });

  elements.ratingInput?.addEventListener("blur", () => {
    normalizeRatingInputField({ force: true });
  });

  if (elements.sortToggle) {
    elements.sortToggle.addEventListener("click", () => {
      state.sortTouched = true;
      state.sort =
        state.sort === "placement-asc" ? "placement-desc" : "placement-asc";
      resetVisibleCount();
      render();
    });
  }

  if (elements.mobileSortToggle) {
    elements.mobileSortToggle.addEventListener("click", () => {
      state.sortTouched = true;
      state.sort =
        state.sort === "placement-asc" ? "placement-desc" : "placement-asc";
      resetVisibleCount();
      render();
    });
  }

  elements.rankingUserSortButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      if (!hasDesktopUserRankingSort()) return;
      const nextSort = button.dataset.rankingUserSort;
      if (nextSort !== "rating" && nextSort !== "count") return;
      if (state.userRankingSort === nextSort) return;

      state.userRankingSort = nextSort;
      state.userRankingDirection = "desc";
      if (nextSort === "rating") state.sort = "placement-asc";
      resetVisibleCount();
      updateRankingSourceUi();
      updateMobileRankingFilterUi();
      renderPodcastGrid();
    });
  });

  elements.rankingSourceToggle?.addEventListener("pointerup", handleRankingSourceToggleEvent);
  elements.rankingSourceToggle?.addEventListener("click", handleRankingSourceToggleEvent);
  window.matchMedia?.("(min-width: 1101px)").addEventListener?.("change", () => {
    syncDesktopRankingSearchPlacement();
    if (document.body.classList.contains("page-ranglister")) {
      updateRankingSourceUi();
      renderPodcastGrid();
    }
  });

  elements.ratingFilter?.addEventListener("input", (event) => {
    setMinimumRating(event.target.value);
  });

  elements.rankingFreeOnly?.addEventListener("change", (event) => {
    setFreeOnly(event.target.checked);
  });
  window.matchMedia?.("(max-width: 768px)").addEventListener?.("change", () => {
    updateMobileRankingFilterUi();
    updateRankingSourceUi();
  });

  elements.rankingLanguageButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      setLanguageFilter(button.dataset.rankingLanguage);
    });
  });

  elements.rankingMobileFilterToggle?.addEventListener("click", () => {
    state.mobileRankingFiltersOpen = !state.mobileRankingFiltersOpen;
    updateMobileRankingFilterUi();
    updateRankingSourceUi();
  });

  elements.rankingMobileActiveFilterRemove?.addEventListener("click", clearRankingFilters);
  elements.rankingMobileFilterSummary?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-clear-category-filter]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    clearCategoryFilter(button.dataset.clearCategoryFilter || "");
  });

  elements.viewModeToggle?.addEventListener("click", toggleViewMode);

  elements.openSignupButton?.addEventListener("click", () => {
    showAuthPrompt("signup");
  });

  elements.openLoginButton?.addEventListener("click", () => {
    showAuthPrompt("login");
  });

  elements.savedFilterButton?.addEventListener("click", toggleSavedFilter);

  elements.signupButton?.addEventListener("click", () => {
    handleAuthAction("signup");
  });

  elements.loginButton?.addEventListener("click", () => {
    handleAuthAction("login");
  });

  elements.logoutButton?.addEventListener("click", handleLogout);
  elements.authDialogCloseButton?.addEventListener("click", closeAuthDialog);
  elements.toggleAuthPasswordButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    toggleAuthPasswordVisibility();
  });

  elements.toggleAuthPasswordButton?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    toggleAuthPasswordVisibility();
  });
  elements.forgotPasswordButton?.addEventListener("click", requestPasswordReset);

  elements.passwordRecoveryForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitPasswordRecovery();
  });
  elements.passwordRecoveryCloseButton?.addEventListener("click", () => {
    closePasswordRecoveryDialog();
  });
  [
    [elements.passwordRecoveryPassword, elements.toggleRecoveryPassword],
    [elements.passwordRecoveryPasswordRepeat, elements.toggleRecoveryPasswordRepeat]
  ].forEach(([input, button]) => {
    button?.addEventListener("click", () => {
      if (!input) return;
      const visible = input.type === "password";
      input.type = visible ? "text" : "password";
      button.textContent = visible ? "Skjul" : "Vis";
      button.setAttribute("aria-label", visible ? "Skjul adgangskode" : "Vis adgangskode");
    });
  });

  const authForm = elements.authDialog?.querySelector(".auth-form");
  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuthAction(state.authMode === "login" ? "login" : "signup");
  });

  if (elements.clearFilterButton) {
    elements.clearFilterButton.addEventListener("click", clearRankingFilters);
  }

  if (elements.activeFilterPill) {
    elements.activeFilterPill.addEventListener("click", clearActiveFilter);
  }

  if (elements.activeFilterRemoveButton) {
    elements.activeFilterRemoveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      clearActiveFilter();
    });
  }

  if (elements.podcastGrid) {
    elements.podcastGrid.addEventListener("click", handlePodcastGridClick);
    elements.podcastGrid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!(event.target instanceof HTMLElement)) return;

      const actionTarget = event.target.closest("[data-action]");
      if (!actionTarget || !elements.podcastGrid.contains(actionTarget)) {
        const card = event.target.closest(".podcast-card");
        const key = card?.dataset.key;
        const podcast = key ? state.podcastByKey[key] : null;
        if (!card || !podcast) return;

        event.preventDefault();
        openPodcastDetailSheet(podcast, card, { allowDesktop: true });
        return;
      }

      event.preventDefault();
      actionTarget.click();
    });
  }

  if (elements.featuredPanel) {
    elements.featuredPanel.addEventListener("click", (event) => {
      if (event.target.closest(".featured-dot")) return;
      toggleFeaturedPause();
    });
  }

  elements.ratingSaveButton?.addEventListener("click", saveActiveRating);
  elements.ratingDeleteButton?.addEventListener("click", deleteActiveRating);
  elements.ratingCancelButton?.addEventListener("click", closeRatingDialog);
  elements.ratingCloseButton?.addEventListener("click", closeRatingDialog);

  elements.ratingDialog?.addEventListener("click", (event) => {
    if (event.target instanceof HTMLElement && event.target.dataset.ratingClose === "true") {
      closeRatingDialog();
    }
  });

  elements.authDialog?.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) return;

    const button = event.target.closest("button");

    if (button?.id === "authDialogCloseButton") {
      closeAuthDialog();
      return;
    }

    if (event.target.dataset.authClose === "true") {
      closeAuthDialog();
    }
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) return;

    const relatedCard = event.target.closest("[data-podcast-similarity-card]");
    if (!relatedCard) return;

    const recommendationId = relatedCard.dataset.podcastSimilarityCard;
    const podcastKey = relatedCard.dataset.podcastSimilarityPodcastKey;
    const podcast =
      state.podcastByKey[podcastKey] ||
      state.podcasts.find((candidate) => getPodcastKey(candidate) === podcastKey) ||
      state.podcastSimilarityPodcastByRecommendationId[recommendationId];
    if (!podcast) return;

    event.preventDefault();
    event.stopPropagation();
    openPodcastDetailFromModal(podcast, relatedCard);
  });

  document.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (
      !elements.desktopHeaderSearch?.contains(event.target) &&
      !elements.mobileHeaderSearchButton?.contains(event.target)
    ) {
      closeHeaderPodcastSearch({ closeMobile: true });
    }
    if (!elements.pageIntroPanel?.querySelector("[data-home-podcast-search]")?.contains(event.target)) {
      closeHomePodcastSearch({ exitFocus: true });
    }
    if (elements.desktopUserButton?.contains(event.target)) return;
    if (elements.desktopUserMenu?.contains(event.target)) return;

    closeDesktopUserMenu();
  });

  document.addEventListener("keydown", (event) => {
    const podcastDetailSheet = document.getElementById("podcastDetailSheet");
    const podcastDetailOpen = podcastDetailSheet && !podcastDetailSheet.classList.contains("is-hidden");
    const editableTarget = event.target?.closest?.("input, textarea, select, [contenteditable='true']");

    if (
      podcastDetailOpen &&
      !editableTarget &&
      (event.key === "ArrowLeft" || event.key === "ArrowRight")
    ) {
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      if (navigatePodcastDetailRanking(direction)) {
        event.preventDefault();
      }
      return;
    }

    if (event.key !== "Escape") return;

    if (!elements.desktopUserMenu?.classList.contains("is-hidden")) {
      closeDesktopUserMenu();
      event.preventDefault();
      return;
    }

    if (!elements.authDialog?.classList.contains("is-hidden")) {
      closeAuthDialog();
      event.preventDefault();
      return;
    }

    if (!elements.ratingDialog?.classList.contains("is-hidden")) {
      closeRatingDialog();
      event.preventDefault();
      return;
    }

    if (podcastDetailOpen) {
      closePodcastDetailSheet();
      event.preventDefault();
      return;
    }

    const suggestionDialog = document.querySelector(".explore-suggestion-dialog:not(.is-hidden)");
    if (suggestionDialog) {
      state.exploreSuggestionDialogOpen = false;
      suggestionDialog.classList.add("is-hidden");
      suggestionDialog.setAttribute("aria-hidden", "true");
      document.body.classList.remove("has-suggestion-dialog-open");
      if (
        elements.authDialog?.classList.contains("is-hidden") &&
        elements.ratingDialog?.classList.contains("is-hidden")
      ) {
        document.body.classList.remove("has-dialog-open");
      }
    }
  });

  window.addEventListener("pageshow", () => {
    window.setTimeout(() => {
      clearSearchInput({ rerender: true });
      maybeCatchUpPodcastDataRefresh();
    }, 0);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      maybeCatchUpPodcastDataRefresh();
    }
  });

  window.addEventListener("focus", maybeCatchUpPodcastDataRefresh);

  setupFeaturedSwipe();
}

function showLoadError(message) {
  if (elements.resultsText) {
    elements.resultsText.textContent = message;
  }

  if (elements.podcastGrid) {
    elements.podcastGrid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  if (elements.recentGrid) {
    elements.recentGrid.innerHTML = "";
  }

  if (elements.featuredPanel) {
    elements.featuredPanel.classList.add("is-hidden");
  }

  if (elements.loadMoreWrap) {
    elements.loadMoreWrap.classList.add("is-hidden");
  }
}

function extractRowsFromJsonPayload(data, errorMessage) {
  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  if (Array.isArray(data)) {
    return data;
  }

  throw new Error(errorMessage);
}

async function loadPodcastObjectsFromJson() {
  const response = await fetch(`${JSON_DATA_URL}?v=${DATA_VERSION}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Kunne ikke hente lokal podcasts.json.");
  }

  const data = await response.json();
  return extractRowsFromJsonPayload(data, "podcasts.json har ikke forventet format.");
}

async function loadFeaturedReviewObjectsFromJson() {
  const response = await fetch(`${FEATURED_JSON_DATA_URL}?v=${DATA_VERSION}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Kunne ikke hente featured-reviews.json.");
  }

  const data = await response.json();
  return extractRowsFromJsonPayload(
    data,
    "featured-reviews.json har ikke forventet format."
  );
}

async function loadCoverManifestFromJson() {
  try {
    const response = await fetch(`${COVER_MANIFEST_URL}?v=${DATA_VERSION}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return normalizeCoverManifestEntries(await response.json());
  } catch (error) {
    if (!state.coverManifestWarningShown) {
      state.coverManifestWarningShown = true;
      console.warn(
        "Lokalt covermanifest kunne ikke indlæses. Eksterne billeder bruges som fallback.",
        error
      );
    }
    return {};
  }
}

function buildPodcastLookups(podcasts) {
  const byId = {};
  const legacyCandidates = new Map();

  podcasts.forEach((podcast) => {
    const podcastId = getPodcastId(podcast);
    const legacyKey = getLegacyPodcastKey(podcast);
    if (podcastId) byId[podcastId] = podcast;
    if (!legacyKey || !podcastId) return;
    if (!legacyCandidates.has(legacyKey)) legacyCandidates.set(legacyKey, []);
    legacyCandidates.get(legacyKey).push(podcast);
  });

  const byLegacyKey = {};
  legacyCandidates.forEach((matches, legacyKey) => {
    if (matches.length === 1) byLegacyKey[legacyKey] = matches[0];
  });

  return { byId, byLegacyKey };
}

function applyPodcastDataRefresh(podcastRows, featuredRows, coverManifestLookup = {}) {
  const mappedPodcasts = podcastRows.map(mapPodcast).filter(isUsefulPodcast);

  state.podcasts = deduplicatePodcasts(mappedPodcasts);
  state.coverManifestByKey = coverManifestLookup;
  state.failedImageSources.clear();
  applyLocalCoverManifest(state.podcasts, coverManifestLookup);
  const lookups = buildPodcastLookups(state.podcasts);
  state.podcastById = lookups.byId;
  state.podcastByLegacyKey = lookups.byLegacyKey;
  state.podcastByKey = { ...lookups.byLegacyKey, ...lookups.byId };
  if (
    state.podcastSimilarityProductStatus === "ready" &&
    state.podcastSimilarityMetadataPayload
  ) {
    try {
      const lookups = buildPodcastSimilarityProductLookups(
        state.podcastSimilarityMetadataPayload,
        {
          version: 1.3,
          results: state.podcastSimilarityProductByRecommendationId
        }
      );
      state.podcastSimilarityRecommendationIdByPodcastKey =
        lookups.recommendationIdByPodcastKey;
      state.podcastSimilarityPodcastByRecommendationId =
        lookups.podcastByRecommendationId;
    } catch (error) {
      state.podcastSimilarityProductStatus = "error";
      warnPodcastSimilarityProduct(error?.message || "dataopdateringen kunne ikke valideres");
    }
  }
  invalidateRankingListCache();

  state.allReviews = featuredRows
    .map((row, index) => mapFeaturedReview(row, index))
    .filter(isUsableReview);

  state.featuredReviews = state.allReviews
    .filter(isActiveFeatured)
    .sort((a, b) => {
      const aTime = a.reviewDateObject ? a.reviewDateObject.getTime() : 0;
      const bTime = b.reviewDateObject ? b.reviewDateObject.getTime() : 0;

      if (bTime !== aTime) {
        return bTime - aTime;
      }

      return a.displayOrder - b.displayOrder;
    })
    .slice(0, 5);

  state.featuredReviewByKey = buildFeaturedReviewLookup(state.allReviews);
  state.featuredIndex = 0;
  state.featuredPaused = false;
  state.homeFeaturedIndex = 0;
  rebuildUserRanks();
}

function renderAfterPodcastDataRefresh({ initial = false } = {}) {
  createGenreChips();

  if (initial) {
    render();
    openPodcastFromQueryIfRequested();
    startFeaturedRotation();
    return;
  }

  if (document.body.classList.contains("page-forside")) {
    refreshHomeRecentSection();
    updateHomeHeroCovers({ force: true });
  } else if (document.body.classList.contains("page-ranglister")) {
    renderPodcastGrid();
    renderRecent();
  } else if (document.body.classList.contains("page-udforsk")) {
    renderExplorePage();
  }

  renderFeaturedReview();
  startFeaturedRotation();
}

function openPodcastFromQueryIfRequested() {
  if (state.openedPodcastFromQuery) return;
  const podcastId = new URLSearchParams(window.location.search).get("podcast") || "";
  const podcast = state.podcastById[podcastId];
  if (!podcast) return;
  state.openedPodcastFromQuery = true;
  openPodcastDetailSheet(podcast, null, { allowDesktop: true });
}

function refreshExploreUnderratedRotationIfNeeded({ force = false } = {}) {
  const nextBucket = getExploreHourBucket();
  if (!force && state.exploreUnderratedHourBucket === nextBucket) return false;

  state.exploreUnderratedHourBucket = nextBucket;
  if (document.body.classList.contains("page-udforsk")) {
    const scrollY = window.scrollY || document.documentElement.scrollTop || 0;
    renderExplorePage();
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: scrollY, left: 0, behavior: "auto" });
    });
  }

  return true;
}

async function refreshPodcastData({ initial = false, force = false } = {}) {
  if (state.podcastDataRefreshInProgress) return false;

  const now = Date.now();
  if (
    !initial &&
    !force &&
    state.lastSuccessfulPodcastDataRefreshAt &&
    now - state.lastSuccessfulPodcastDataRefreshAt < PODCAST_DATA_REFRESH_INTERVAL_MS
  ) {
    return false;
  }

  state.podcastDataRefreshInProgress = true;
  if (initial || !state.podcasts.length) {
    state.podcastDataStatus = "loading";
  }

  try {
    const [podcastRows, featuredRows, coverManifestLookup] = await Promise.all([
      loadPodcastObjectsFromJson(),
      loadFeaturedReviewObjectsFromJson().catch((error) => {
        console.warn("Udvalgte vurderinger blev ikke indlæst:", error);
        return [];
      }),
      loadCoverManifestFromJson()
    ]);

    applyPodcastDataRefresh(podcastRows, featuredRows, coverManifestLookup);
    state.podcastDataStatus = "ready";
    state.lastSuccessfulPodcastDataRefreshAt = Date.now();
    renderAfterPodcastDataRefresh({ initial });
    return true;
  } catch (error) {
    console.error(error);
    if (initial || !state.podcasts.length) {
      state.podcastDataStatus = "error";
      showLoadError(
        "Kunne ikke indl\u00e6se podcasts. Tjek data/podcasts.json og data/featured-reviews.json."
      );
    }
    return false;
  } finally {
    state.podcastDataRefreshInProgress = false;
  }
}

function startPodcastDataRefreshTimer() {
  if (state.podcastDataRefreshTimer) return;

  state.podcastDataRefreshTimer = window.setInterval(() => {
    refreshPodcastData().catch((error) => {
      console.error(error);
    });
  }, PODCAST_DATA_REFRESH_INTERVAL_MS);
}

function maybeCatchUpPodcastDataRefresh() {
  refreshExploreUnderratedRotationIfNeeded();
  if (!state.lastSuccessfulPodcastDataRefreshAt) return;
  if (Date.now() - state.lastSuccessfulPodcastDataRefreshAt < PODCAST_DATA_REFRESH_INTERVAL_MS) return;

  refreshPodcastData().catch((error) => {
    console.error(error);
  });
}

async function loadPodcasts() {
  const refreshed = await refreshPodcastData({ initial: true, force: true });
  if (refreshed) {
    startPodcastDataRefreshTimer();
    scheduleHomeHeroRotation();
    scheduleBackgroundRouteWarmup();
  }
}

function loadVisitorCount() {
  const target = document.getElementById("goatcounter-visits");
  const counter = document.getElementById("visitorCounter");
  const label = document.getElementById("visitorCounterLabel");
  if (!target) return;

  target.textContent = "indl\u00e6ser\u2026";

  const renderCount = () => {
    if (
      window.goatcounter &&
      typeof window.goatcounter.visit_count === "function"
    ) {
      target.textContent = "";

      window.goatcounter.visit_count({
        append: "#goatcounter-visits",
        path: "/podcast-ratings/",
        type: "html",
        start: "2026-05-03",
        attr: {
          width: "90",
          height: "24",
          frameborder: "0",
          scrolling: "no",
          title: "Bes\u00f8gst\u00e6ller"
        }
      });

      return true;
    }

    return false;
  };

  if (renderCount()) return;

  let attempts = 0;
  const interval = window.setInterval(() => {
    attempts += 1;

    if (renderCount()) {
      window.clearInterval(interval);
      return;
    }

      if (attempts >= 30) {
        if (counter) {
          counter.classList.add("is-unavailable");
        }

        if (label) {
          label.textContent = "Bes\u00f8gst\u00e6ller";
        }

        target.textContent = "ikke tilgængelig";
        window.clearInterval(interval);
      }
    }, 250);
}

let initialSupabaseStartup = null;
let initialPodcastStartup = null;

function runSecondaryStartup() {
  loadVisitorCount();
  Promise.all([initialSupabaseStartup, initialPodcastStartup])
    .then(() => {
      if (!state.supabase) return;
      return refreshSupabaseState();
    })
    .catch((error) => {
      console.error(error);
      setAuthMessage("Supabase-data kunne ikke indlæses endnu.", "error", "hero");
    });
}

ensureLoadMoreControls();
applyViewModePreference();
setupMobileViewportOffsets();
setupEvents();
updateAuthPasswordToggle();
restoreNormalViewportMeta();
initialSupabaseStartup = initSupabase();
renderRoute();
stabilizeFreshForsideScroll();
window.addEventListener("pageshow", (event) => {
  if (!event.persisted) stabilizeFreshForsideScroll();
});
window.setTimeout(() => {
  clearSearchInput({ rerender: true });
}, 120);
initialPodcastStartup = loadPodcasts();

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(runSecondaryStartup, { timeout: 1500 });
} else {
  window.setTimeout(runSecondaryStartup, 400);
}

// RSS_EPISODE_PUBLICATION_DATE_DOM_PATCH_V1
function applyRssEpisodePublicationDateColumns(root = document) {
  // The episode overview now renders publication dates directly. Keep this
  // legacy hook inert so it cannot scan the whole document after user input.
  return;

  const config = getEpisodePodcastConfig(state.activePodcastDetailKey);

  // Lokale, afgrænsede serier som Bomben skal fortsat vise # og episodenumre.
  if (!config || config.dataSource === "local") return;

  const episodeState = getPodcastEpisodeState(config.podcastKey);
  const episodes = Array.isArray(episodeState?.items) ? episodeState.items : [];
  if (!episodes.length) return;

  const normalizeEpisodeTitleForDisplay = (value) =>
    normalizeComparable(normalizeText(value));

  const episodesByTitle = new Map();

  episodes.forEach((episode) => {
    const titleKey = normalizeEpisodeTitleForDisplay(episode?.title);
    if (titleKey && !episodesByTitle.has(titleKey)) {
      episodesByTitle.set(titleKey, episode);
    }
  });

  const allElements = Array.from(root.querySelectorAll("*"));

  const numberHeader = allElements.find((element) => {
    if (normalizeText(element.textContent) !== "#") return false;

    const container =
      element.parentElement ||
      element.closest('[role="row"], tr, [class*="head"], [class*="header"]');

    if (!container) return false;

    const text = normalizeComparable(container.textContent);

    return (
      text.includes("episode") &&
      text.includes("vurdering")
    );
  });

  if (!numberHeader) return;

  numberHeader.textContent = "Udgivelsesdato";
  numberHeader.classList.add("episode-publication-date-header");

  const tableContainer =
    numberHeader.closest(
      '[role="table"], table, [class*="episode-table"], [class*="episodes-table"]'
    ) ||
    numberHeader.parentElement?.parentElement ||
    root;

  const possibleRows = Array.from(
    tableContainer.querySelectorAll(
      '[role="row"], tr, [class*="episode-row"]'
    )
  ).filter((row) => !row.contains(numberHeader));

  possibleRows.forEach((row) => {
    const cells = Array.from(
      row.querySelectorAll(
        ':scope > [role="cell"], :scope > td, :scope > th, :scope > span, :scope > div'
      )
    );

    if (cells.length < 2) return;

    const firstCell = cells[0];
    const titleCell = cells[1];

    const titleElement =
      titleCell.querySelector("strong, h3, h4, [class*='title']") ||
      titleCell;

    const titleKey = normalizeEpisodeTitleForDisplay(titleElement.textContent);
    const episode = episodesByTitle.get(titleKey);

    if (!episode) return;

    const dateLabel = formatEpisodeDate(episode.published_at) || "—";

    firstCell.textContent = dateLabel;
    firstCell.classList.add("episode-publication-date-cell");
    firstCell.setAttribute("aria-label", `Udgivelsesdato ${dateLabel}`);
  });
}

function scheduleRssEpisodePublicationDateColumns() {
  window.requestAnimationFrame(() => {
    applyRssEpisodePublicationDateColumns(document);
  });

  window.setTimeout(() => {
    applyRssEpisodePublicationDateColumns(document);
  }, 80);
}

// RSS_EPISODE_PUBLICATION_DATE_INLINE_GRID_V2
function fixRssEpisodePublicationDateGrid(root = document) {
  // The table is styled by its normal stylesheet; do not mutate every row
  // from a document-wide observer.
  return;

  const config = getEpisodePodcastConfig(state.activePodcastDetailKey);

  // Afgrænsede lokale serier som Bomben skal ikke ændres.
  if (!config || config.dataSource === "local") return;

  const header = root.querySelector(".episode-publication-date-header");
  if (!header) return;

  header.textContent = "Udgivelsesdato";

  const headerRow = header.parentElement;
  if (headerRow) {
    headerRow.style.display = "grid";
    headerRow.style.gridTemplateColumns =
      "8.5rem minmax(0, 1fr) 13rem 10rem";
    headerRow.style.columnGap = "0";
    headerRow.style.alignItems = "center";
  }

  header.style.width = "auto";
  header.style.minWidth = "0";
  header.style.maxWidth = "none";
  header.style.whiteSpace = "nowrap";
  header.style.overflow = "visible";
  header.style.textOverflow = "clip";
  header.style.paddingRight = "1rem";
  header.style.boxSizing = "border-box";

  root.querySelectorAll(".episode-publication-date-cell").forEach((dateCell) => {
    const row = dateCell.parentElement;
    if (!row) return;

    row.style.display = "grid";
    row.style.gridTemplateColumns =
      "8.5rem minmax(0, 1fr) 13rem 10rem";
    row.style.columnGap = "0";
    row.style.alignItems = "center";

    dateCell.style.width = "auto";
    dateCell.style.minWidth = "0";
    dateCell.style.maxWidth = "none";
    dateCell.style.whiteSpace = "nowrap";
    dateCell.style.overflow = "visible";
    dateCell.style.textOverflow = "clip";
    dateCell.style.paddingRight = "1rem";
    dateCell.style.boxSizing = "border-box";
  });
}

function scheduleRssEpisodePublicationDateGridFix() {
  window.requestAnimationFrame(() => {
    applyRssEpisodePublicationDateColumns(document);
    fixRssEpisodePublicationDateGrid(document);
  });

  window.setTimeout(() => {
    applyRssEpisodePublicationDateColumns(document);
    fixRssEpisodePublicationDateGrid(document);
  }, 100);
}
