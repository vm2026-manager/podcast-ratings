const JSON_DATA_URL = "data/podcasts.json";
const FEATURED_JSON_DATA_URL = "data/featured-reviews.json";

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

const FEATURED_ROTATION_MS = 8000;
const INITIAL_VISIBLE_COUNT = 25;
const AUTO_EXPAND_DELAY_MS = 900;
const DATA_VERSION = "2026-06-27-02";
const EXPANDED_LIST_STORAGE_KEY = "podcast-ratings-expanded-list";
const VIEW_MODE_STORAGE_KEY = "podcast-ratings-desktop-view";
const AUTH_PERSISTENCE_STORAGE_KEY = "podcast-ratings-auth-persistence";
const NEW_BADGE_DAYS = 14;
const IMAGE_FALLBACK_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];
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

const state = {
  podcasts: [],
  podcastByKey: {},
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
  pendingAuthAction: null,
  exploreSuggestionDialogOpen: false,
  userRatingsByKey: {},
  communityStatsByKey: {},
  userRankByKey: {},
  profileSuggestions: [],
  profileSuggestionsLoadedFor: null,
  profileSuggestionsLoading: false,
  profileSuggestionsError: "",
  savedPodcastKeys: new Set(),
  activeRatingKey: null,
  openReviewKeys: new Set(),
  featuredIndex: 0,
  featuredTimer: null,
  featuredPaused: false,
  activeFilter: null,
  searchTerm: "",
  minimumRating: 0,
  rankingSource: "mads",
  sort: "placement-asc",
  mobileRankingFiltersOpen: false,
  desktopView: readDesktopViewPreference(),
  hasExpandedInitialList: false,
  visibleCount: INITIAL_VISIBLE_COUNT,
  autoExpandHandle: null
};

const elements = {
  genreChips: document.getElementById("genreChips"),
  viewportMeta: document.getElementById("viewportMeta"),
  viewModeToggle: document.getElementById("viewModeToggle"),
  searchInput: document.getElementById("searchInput"),
  sortToggle: document.getElementById("sortToggle"),
  mobileSortToggle: document.getElementById("mobileSortToggle"),
  rankingSourceButtons: document.querySelectorAll("[data-ranking-source]"),
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
  clearFilterButton: document.getElementById("clearFilterButton"),
  ratingFilter: document.getElementById("ratingFilter"),
  ratingFilterValue: document.getElementById("ratingFilterValue"),
  rankingMobileFilterSummary: document.getElementById("rankingMobileFilterSummary"),
  rankingMobileFilterToggle: document.getElementById("rankingMobileFilterToggle"),
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
  pageLinks: document.querySelectorAll("[data-page-link]"),
  globalAuthZone: document.getElementById("globalAuthZone"),
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

function normalizeMatchKey(value) {
  return normalizeComparable(value)
    .replace(/[^a-z0-9\u00e6\u00f8\u00e5 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^a-z0-9\u00e6\u00f8\u00e5 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function getImageCandidates(image) {
  const src = normalizeImageSource(image);
  const candidates = [];

  addImageCandidate(candidates, src);

  if (src.startsWith("http://")) {
    addImageCandidate(candidates, `https://${src.slice("http://".length)}`);
  }

  getLocalCoverFallbacks(src).forEach((candidate) => {
    addImageCandidate(candidates, candidate);
  });

  return candidates;
}

function loadImageWithFallback(img, image, alt, { onLoad, onFail } = {}) {
  if (!img) return;

  const candidates = getImageCandidates(image);
  let index = 0;

  const tryNextCandidate = () => {
    const nextSrc = candidates[index];
    index += 1;

    if (!nextSrc) {
      img.hidden = true;
      img.removeAttribute("src");
      img.alt = "";
      if (onFail) onFail();
      return;
    }

    img.hidden = false;
    img.alt = alt || "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.src = nextSrc;
  };

  img.onload = () => {
    if (onLoad) onLoad();
  };
  img.onerror = tryNextCandidate;
  tryNextCandidate();
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
  const rawPublisher = getField(row, ["Udgiver", "Publisher"]);
  const episodes = getField(row, ["Antal afsnit", "Afsnit", "Episodes"]);
  const yearPlayed = getField(row, ["\u00c5rstal afspillet", "Aarstal afspillet", "\u00c5r", "Aar"]);
  const link = extractUrl(getField(row, ["Link", "URL"]));
  const ratingDate = getField(row, ["Afgivet vurdering", "Dato", "Vurderingsdato", "Bed\u00f8mt"]);
  const image = extractUrl(getField(row, ["Billedlink", "Billedefil", "Billede", "Cover", "Image"]));
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
  const description = getField(row, [
    "Kort beskrivelse",
    "Kortbeskrivelse",
    "Beskrivelse",
    "Description"
  ]);
  const placement = parsePlacement(getField(row, ["Placering", "Rank", "Rangering"]));

  const genre = normalizeGenre(rawGenre);
  const publisher = normalizePublisher(rawPublisher);

  return {
    id: `${title}-${index}`,
    title,
    host,
    rawRating,
    ratingValue: parseNumber(rawRating),
    ratingLabel: formatRating(rawRating),
    rawGenre,
    genre,
    rawPublisher,
    publisher,
    episodes,
    yearPlayed,
    link,
    ratingDate,
    ratingDateObject: parseDate(ratingDate),
    ratingDateLabel: formatDate(ratingDate),
    userAverageRating,
    userRatingCount,
    userRank,
    image,
    description,
    placement: placement ?? index + 1,
    randomTieBreaker: Math.random(),
    completenessScore: getCompletenessScore({
      yearPlayed,
      link,
      image,
      description,
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
      episodes,
      yearPlayed,
      link,
      ratingDate,
      description
    ])
  };
}

function deduplicatePodcasts(podcasts) {
  const grouped = new Map();

  podcasts.forEach((podcast) => {
    const key = normalizeMatchKey(podcast.title);
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

    result.push(sorted[0]);
  });

  return result.sort((a, b) => a.placement - b.placement);
}

function mapFeaturedReview(row, index, podcastLookup) {
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

  const matchedPodcast = podcastLookup[normalizeMatchKey(matchTitle)] || null;

  return {
    active,
    title: title || matchedPodcast?.title || matchTitle,
    matchTitle: matchTitle || title,
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
    const matchKey = normalizeMatchKey(review.matchTitle);
    const titleKey = normalizeMatchKey(review.title);

    if (matchKey) lookup[matchKey] = review;
    if (titleKey) lookup[titleKey] = review;
  });

  return lookup;
}

function getReviewForPodcast(podcast) {
  return state.featuredReviewByKey[normalizeMatchKey(podcast.title)] || null;
}

function getPodcastKey(podcast) {
  return normalizeMatchKey(podcast.title);
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
  state.hasExpandedInitialList = false;
  state.visibleCount = INITIAL_VISIBLE_COUNT;
}

function cancelAutoExpandPodcastGrid() {
  if (!state.autoExpandHandle) return;

  window.clearTimeout(state.autoExpandHandle);
  state.autoExpandHandle = null;
}

function scheduleAutoExpandPodcastGrid(filteredCount, visibleCount) {
  if (visibleCount >= filteredCount || state.hasExpandedInitialList || state.autoExpandHandle) {
    return;
  }

  const expand = () => {
    state.autoExpandHandle = null;
    state.hasExpandedInitialList = true;
    state.visibleCount = Number.MAX_SAFE_INTEGER;
    renderPodcastGrid();
  };

  state.autoExpandHandle = window.setTimeout(expand, AUTO_EXPAND_DELAY_MS);
}

function clearSearchInput({ rerender = false } = {}) {
  if (!elements.searchInput) return;

  elements.searchInput.value = "";

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

function isActiveGenre(genre) {
  if (genre === "Alle") return !state.activeFilter;
  return state.activeFilter?.type === "genre" && state.activeFilter.value === genre;
}

function setActiveFilter(type, value) {
  state.activeFilter = type && value ? { type, value } : null;
  resetVisibleCount();
  createGenreChips();
  render();
}

function clearActiveFilter() {
  setActiveFilter(null, null);
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

function getPodcastRatingForActiveSource(podcast) {
  if (state.rankingSource === "users") {
    const key = getPodcastKey(podcast);
    const stat = getCommunityStat(key);
    return parseNumber(stat?.averageRating ?? podcast.userAverageRating);
  }

  return parseNumber(podcast.ratingValue);
}

function setMinimumRating(value) {
  const nextRating = Math.max(0, Math.min(10, parseNumber(value) ?? 0));
  if (state.minimumRating === nextRating) return;

  state.minimumRating = nextRating;
  resetVisibleCount();
  updateRatingFilterUi();
  render();
}

function clearRankingFilters() {
  state.activeFilter = null;
  state.minimumRating = 0;
  resetVisibleCount();
  createGenreChips();
  updateRatingFilterUi();
  render();
}

function createGenreChips() {
  if (!elements.genreChips) return;

  elements.genreChips.innerHTML = "";

  GENRES.forEach((genre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "genre-chip";
    button.textContent = genre;

    if (isActiveGenre(genre)) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      if (genre === "Alle") {
        clearActiveFilter();
      } else {
        setActiveFilter("genre", genre);
      }
    });

    elements.genreChips.appendChild(button);
  });
}

function getFilteredPodcasts() {
  return state.podcasts
    .filter((podcast) => {
      if (state.activeFilter?.type === "saved" && !isPodcastSaved(getPodcastKey(podcast))) {
        return false;
      }

      if (state.activeFilter?.type === "genre" && podcast.genre !== state.activeFilter.value) {
        return false;
      }

      if (state.activeFilter?.type === "publisher" && podcast.publisher !== state.activeFilter.value) {
        return false;
      }

      if (state.minimumRating > 0) {
        const rating = getPodcastRatingForActiveSource(podcast);
        if (rating === null || rating < state.minimumRating) {
          return false;
        }
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
      if (state.rankingSource === "users") {
        const aRank = getPodcastUserRank(a);
        const bRank = getPodcastUserRank(b);
        const aHasRank = aRank !== null;
        const bHasRank = bRank !== null;

        if (aHasRank !== bHasRank) {
          return aHasRank ? -1 : 1;
        }

        if (!aHasRank && !bHasRank) {
          return compareRandomTieBreaker(a, b);
        }

        if (state.sort === "placement-desc") {
          return bRank - aRank;
        }

        return aRank - bRank;
      }

      const aHasRating = a.ratingValue !== null;
      const bHasRating = b.ratingValue !== null;

      if (aHasRating !== bHasRating) {
        return aHasRating ? -1 : 1;
      }

      if (bothMissingMadsRating(a, b)) {
        return compareRandomTieBreaker(a, b);
      }

      const placementDelta = a.placement - b.placement;
      if (placementDelta !== 0) {
        return state.sort === "placement-desc" ? -placementDelta : placementDelta;
      }

      return compareRandomTieBreaker(a, b);
    });
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

  if (!state.activeFilter) {
    elements.activeFilterBox.classList.add("is-hidden");
    elements.activeFilterText.textContent = "";
    return;
  }

  if (state.activeFilter.type === "saved") {
    elements.activeFilterText.textContent = "Viser kun gemte podcasts";
  } else {
    const label = state.activeFilter.type === "genre" ? "Genre" : "Udgiver";
    elements.activeFilterText.textContent = `${label}: ${state.activeFilter.value}`;
  }
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

function updateMobileRankingFilterUi() {
  document.body.classList.toggle(
    "ranking-filters-open",
    state.mobileRankingFiltersOpen
  );

  if (elements.rankingMobileFilterToggle) {
    elements.rankingMobileFilterToggle.textContent = state.mobileRankingFiltersOpen
      ? "Skjul"
      : "Filtre";
    elements.rankingMobileFilterToggle.setAttribute(
      "aria-expanded",
      String(state.mobileRankingFiltersOpen)
    );
  }

  if (!elements.rankingMobileFilterSummary) return;

  const genreLabel =
    state.activeFilter?.type === "genre" ? state.activeFilter.value : "Alle genrer";
  const ratingLabel = `Vurdering: ${formatMinimumRating(state.minimumRating)}`;

  elements.rankingMobileFilterSummary.textContent = `${genreLabel} \u00b7 ${ratingLabel}`;
}

function updateRankingSourceUi() {
  elements.rankingSourceButtons?.forEach((button) => {
    const active = button.dataset.rankingSource === state.rankingSource;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function getResultsText(filteredCount, visibleCount) {
  const isMobileRanking =
    typeof window !== "undefined" &&
    window.matchMedia?.("(max-width: 768px)").matches;
  const baseText = isMobileRanking
    ? visibleCount < filteredCount
      ? `Viser ${visibleCount} af ${filteredCount} podcasts`
      : `Viser ${filteredCount} podcasts`
    : visibleCount < filteredCount
      ? `Viser ${visibleCount} af ${filteredCount} podcasts.`
      : `Viser ${filteredCount} podcasts ud af ${state.podcasts.length}.`;

  const suffixes = [];

  if (state.activeFilter?.type === "saved") {
    suffixes.push("Filtreret p\u00e5 dine gemte podcasts.");
  } else if (state.activeFilter) {
    const label = state.activeFilter.type === "genre" ? "genren" : "udgiveren";
    suffixes.push(`Filtreret p\u00e5 ${label} ${state.activeFilter.value}.`);
  }

  if (state.minimumRating > 0) {
    suffixes.push(`Minimum ${formatMinimumRating(state.minimumRating)}.`);
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

  if (remaining <= 0) {
    elements.loadMoreWrap.classList.add("is-hidden");
    return;
  }

  elements.loadMoreWrap.classList.add("is-hidden");
  elements.loadMoreButton.textContent = `Indl\u00e6ser resten (${remaining} tilbage)`;
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

  if (!normalizeImageSource(image)) {
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

function showAuthPrompt(preferredAction = "signup") {
  if (!elements.authDialog) return;

  state.authBusy = false;
  state.authMode = preferredAction === "login" ? "login" : "signup";

  if (elements.authDialogTitle) {
    elements.authDialogTitle.textContent =
      state.authMode === "login" ? "Log ind" : "Opret dig eller log ind";
  }

  const isLogin = state.authMode === "login";
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

  window.setTimeout(() => {
    elements.authEmail?.focus();
  }, 40);
}

function closeAuthDialog({ clearPending = true } = {}) {
  if (!elements.authDialog) return;

  if (clearPending) {
    if (state.pendingAuthAction?.type === "suggestion") {
      state.exploreSuggestionDialogOpen = false;
    }
    state.pendingAuthAction = null;
  }
  elements.authDialog.classList.add("is-hidden");
  elements.authDialog.setAttribute("aria-hidden", "true");

  if (elements.ratingDialog?.classList.contains("is-hidden")) {
    document.body.classList.remove("has-dialog-open");
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

function renderGlobalAuthZone() {
  if (!elements.globalAuthZone) return;

  const configured = state.authConfigured;
  const loggedIn = isLoggedIn();
  const waitingForSession = configured && !state.authReady;
  const disabled = !configured || state.authBusy || waitingForSession;

  if (loggedIn) {
    const email = state.authUser.email || "Logget ind";
    elements.globalAuthZone.innerHTML = `
      <span class="global-auth-zone__email" title="${escapeHtml(email)}">${escapeHtml(email)}</span>
      <button
        class="global-auth-zone__button global-auth-zone__button--logout"
        type="button"
        data-global-auth-action="logout"
        ${disabled ? "disabled" : ""}
      >
        Log ud
      </button>
    `;
    return;
  }

  elements.globalAuthZone.innerHTML = `
    <button
      class="global-auth-zone__button global-auth-zone__button--login"
      type="button"
      data-global-auth-action="login"
      ${disabled ? "disabled" : ""}
    >
      <span class="global-auth-zone__desktop-label">Log ind / Opret dig</span>
      <span class="global-auth-zone__mobile-label">Log ind</span>
    </button>
  `;
}

function renderAuthPanel() {
  const configured = state.authConfigured;
  const loggedIn = isLoggedIn();
  const waitingForSession = configured && !state.authReady;

  renderGlobalAuthZone();

  if (loggedIn && elements.authDialog && !elements.authDialog.classList.contains("is-hidden")) {
    closeAuthDialog({ clearPending: false });
  }

  elements.authLoggedOut?.classList.toggle("is-hidden", loggedIn || waitingForSession);
  elements.authLoggedIn?.classList.toggle("is-hidden", !loggedIn);
  elements.authPanel?.classList.toggle("is-authenticated", loggedIn);

  if (elements.authUserEmail) {
    elements.authUserEmail.textContent = loggedIn ? state.authUser.email || "" : "";
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
  if (state.communityStatsByKey[podcastKey]) {
    return state.communityStatsByKey[podcastKey];
  }

  const podcast = state.podcastByKey[podcastKey];
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
  return state.userRatingsByKey[podcastKey] ?? null;
}

function isPodcastSaved(podcastKey) {
  return state.savedPodcastKeys.has(podcastKey);
}

function renderFavoriteButton(button, podcastKey) {
  if (!button) return;

  const saved = isPodcastSaved(podcastKey);
  button.classList.toggle("is-saved", saved);
  button.setAttribute("aria-label", saved ? "Gemt til senere" : "Gem til senere");

  const icon = button.querySelector("span");
  if (icon) {
    icon.innerHTML = saved ? "&#9829;" : "&#9825;";
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
  if (!state.supabase) return;

  const { data, error } = await state.supabase
    .from("rating_public_stats")
    .select("podcast_key, average_rating, rating_count");

  if (error) {
    console.error(error);
    setAuthMessage("Kunne ikke hente brugernes snit fra Supabase.", "error", "hero");
    return;
  }

  state.communityStatsByKey = Object.fromEntries(
    (data || []).map((item) => [
      item.podcast_key,
      {
        averageRating: parseNumber(item.average_rating),
        ratingCount: Number(item.rating_count || 0)
      }
    ])
  );
}

async function fetchUserState() {
  state.userRatingsByKey = {};
  state.savedPodcastKeys = new Set();
  state.profileSuggestions = [];
  state.profileSuggestionsLoadedFor = null;
  state.profileSuggestionsLoading = false;
  state.profileSuggestionsError = "";

  if (!state.supabase || !state.authUser) return;

  const [{ data: ratings, error: ratingsError }, { data: saved, error: savedError }] =
    await Promise.all([
      state.supabase.from("user_ratings").select("podcast_key, rating"),
      state.supabase.from("saved_podcasts").select("podcast_key")
    ]);

  if (ratingsError) {
    console.error(ratingsError);
    setAuthMessage("Kunne ikke hente dine vurderinger endnu.", "error", "hero");
  } else {
    state.userRatingsByKey = Object.fromEntries(
      (ratings || []).map((item) => [item.podcast_key, parseNumber(item.rating)])
    );
  }

  if (savedError) {
    console.error(savedError);
    setAuthMessage("Kunne ikke hente dine gemte podcasts endnu.", "error", "hero");
  } else {
    state.savedPodcastKeys = new Set((saved || []).map((item) => item.podcast_key));
  }
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
    return;
  }

  const supabaseLib = await waitForSupabaseClient();

  if (!supabaseLib?.createClient) {
    setAuthMessage("Supabase-klienten kunne ikke indlæses i browseren.", "error", "hero");
    return;
  }

  state.supabase = supabaseLib.createClient(
    SUPABASE_CONFIG.url,
    SUPABASE_CONFIG.anonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storage: supabaseAuthStorage
      }
    }
  );

  const {
    data: { session },
    error
  } = await state.supabase.auth.getSession();

  if (error) {
    console.error(error);
    setAuthMessage("Supabase-session kunne ikke indlæses.", "error", "hero");
  }

  state.session = session;
  state.authUser = session?.user || null;
  state.authReady = true;

  await refreshSupabaseState();
  renderAuthPanel();

  state.supabase.auth.onAuthStateChange(async (event, sessionUpdate) => {
    state.session = sessionUpdate;
    state.authUser = sessionUpdate?.user || null;
    state.authBusy = false;
    if (!state.authUser) {
      state.userRatingsByKey = {};
      state.savedPodcastKeys = new Set();
      state.activeRatingKey = null;
      if (state.activeFilter?.type === "saved") {
        state.activeFilter = null;
        resetVisibleCount();
      }
      closeRatingDialog();
    } else if (event === "SIGNED_IN") {
      closeAuthDialog({ clearPending: false });
    }
    clearAuthMessage();
    renderAuthPanel();
    await refreshSupabaseState();
    if (state.authUser && event === "SIGNED_IN") {
      completePendingAuthAction();
    }
  });
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
    state.userRatingsByKey = {};
    state.savedPodcastKeys = new Set();
    state.activeRatingKey = null;
    state.exploreSuggestionDialogOpen = false;
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

function closeRatingDialog() {
  if (!elements.ratingDialog) return;

  state.activeRatingKey = null;
  updateRatingDialogMessage("");
  elements.ratingDialog.classList.add("is-hidden");
  elements.ratingDialog.setAttribute("aria-hidden", "true");
  if (elements.authDialog?.classList.contains("is-hidden")) {
    document.body.classList.remove("has-dialog-open");
  }
}

function completePendingAuthAction() {
  const pending = state.pendingAuthAction;
  state.pendingAuthAction = null;

  if (!pending || !state.authUser) return;

  if (pending.type === "suggestion") {
    state.exploreSuggestionDialogOpen = true;
    if (window.location.hash !== "#udforsk") {
      window.location.hash = "#udforsk";
    } else {
      render();
    }
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

async function saveActiveRating() {
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

    state.userRatingsByKey[state.activeRatingKey] = numericValue;
    await refreshSupabaseState();
    setAuthMessage("Din vurdering er gemt.", "success");
    closeRatingDialog();
  } catch (error) {
    console.error(error);
    updateRatingDialogMessage(error.message || "Kunne ikke gemme vurderingen.", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function deleteActiveRating() {
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

    delete state.userRatingsByKey[deletedKey];
    render();

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
  if (!isLoggedIn()) {
    state.pendingAuthAction = {
      type: "save",
      podcastKey: getPodcastKey(podcast)
    };
    showAuthPrompt("login");
    setAuthMessage("Log ind for at gemme podcasts til senere.", "warning", "dialog");
    return;
  }

  if (!state.supabase || !state.authUser) return;

  const podcastKey = getPodcastKey(podcast);
  const isSaved = isPodcastSaved(podcastKey);

  setAuthBusy(true);

  try {
    if (isSaved) {
      const { error } = await state.supabase
        .from("saved_podcasts")
        .delete()
        .eq("user_id", state.authUser.id)
        .eq("podcast_key", podcastKey);

      if (error) throw error;
      state.savedPodcastKeys.delete(podcastKey);
      setAuthMessage("Podcasten er fjernet fra dine gemte.", "success");
    } else {
      const { error } = await state.supabase.from("saved_podcasts").upsert(
        {
          user_id: state.authUser.id,
          podcast_key: podcastKey
        },
        { onConflict: "user_id,podcast_key" }
      );

      if (error) throw error;
      state.savedPodcastKeys.add(podcastKey);
      setAuthMessage("Podcasten er gemt til senere.", "success");
    }

    render();
  } catch (error) {
    console.error(error);
    setAuthMessage(error.message || "Kunne ikke opdatere gemte podcasts.", "error");
  } finally {
    setAuthBusy(false);
    renderAuthPanel();
  }
}

function createHomePopularCardElement(podcast) {
  const key = getPodcastKey(podcast);
  const stat = getCommunityStat(key);
  const rank = state.userRankByKey[key];
  const card = document.createElement("article");
  card.className = "home-popular-card";

  const cover = document.createElement("div");
  cover.className = "home-popular-card__cover";
  const image = document.createElement("img");
  image.className = "home-popular-card__image";
  image.loading = "lazy";
  cover.appendChild(image);
  setImage(cover, podcast.image, podcast.title);

  const copy = document.createElement("div");
  copy.className = "home-popular-card__copy";
  copy.innerHTML = `
    <span class="home-popular-card__rank">${rank ? `#${rank}` : ""}</span>
    <h3>${escapeHtml(podcast.title)}</h3>
    <p class="home-popular-card__host">${escapeHtml(
      podcast.host || podcast.publisher || ""
    )}</p>
    <p class="home-popular-card__rating">
      <strong>${escapeHtml(formatRating(stat?.averageRating))}</strong>
      <span>${escapeHtml(formatUserRatingCount(stat?.ratingCount || 0))}</span>
    </p>
  `;

  card.append(cover, copy);

  if (podcast.link) {
    card.classList.add("is-clickable");
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `Åbn ${podcast.title}`);

    const openPodcast = () => {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    };

    card.addEventListener("click", openPodcast);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openPodcast();
    });
  }

  return card;
}

function renderHomePopular(container) {
  if (!container) return;

  const popular = state.podcasts
    .filter((podcast) => {
      const key = getPodcastKey(podcast);
      const averageRating = getCommunityStat(key)?.averageRating;
      return Boolean(state.userRankByKey[key]) && averageRating !== null && averageRating !== undefined;
    })
    .sort(
      (a, b) =>
        state.userRankByKey[getPodcastKey(a)] - state.userRankByKey[getPodcastKey(b)]
    )
    .slice(0, 4);

  container.innerHTML = "";

  if (!popular.length) {
    container.innerHTML =
      '<div class="empty-state">Brugernes favoritter er på vej.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  popular.forEach((podcast) => {
    fragment.appendChild(createHomePopularCardElement(podcast));
  });
  container.appendChild(fragment);
}

function createHomeRecentCardElement(podcast) {
  const card = document.createElement("article");
  card.className = "home-recent-card";

  const cover = document.createElement("div");
  cover.className = "home-recent-card__cover";
  const image = document.createElement("img");
  image.className = "home-recent-card__image";
  image.loading = "lazy";
  cover.appendChild(image);
  setImage(cover, podcast.image, podcast.title);

  const copy = document.createElement("div");
  copy.className = "home-recent-card__copy";
  copy.innerHTML = `
    <h3>${escapeHtml(podcast.title)}</h3>
    <p class="home-recent-card__host">${escapeHtml(
      podcast.host || podcast.publisher || ""
    )}</p>
    <p class="home-recent-card__meta">
      <span>${escapeHtml(
        podcast.ratingDateLabel ? `Bed\u00f8mt ${podcast.ratingDateLabel}` : ""
      )}</span>
      <strong>${escapeHtml(podcast.ratingLabel || "Ikke vurderet")}</strong>
    </p>
  `;

  const actions = document.createElement("div");
  actions.className = "home-recent-card__actions";

  const mobileRating = document.createElement("strong");
  mobileRating.className = "home-recent-card__mobile-rating";
  mobileRating.textContent = podcast.ratingLabel || "Ikke vurderet";

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "favorite-button favorite-button--compact home-recent-card__favorite";
  favoriteButton.type = "button";
  favoriteButton.dataset.action = "toggle-save";
  favoriteButton.innerHTML = "<span aria-hidden=\"true\"></span>";
  renderFavoriteButton(favoriteButton, getPodcastKey(podcast));

  favoriteButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    toggleSavedPodcast(podcast);
  });

  actions.append(mobileRating, favoriteButton);
  card.append(cover, copy, actions);

  if (podcast.link) {
    card.classList.add("is-clickable");
    card.tabIndex = 0;
    card.setAttribute("role", "link");
    card.setAttribute("aria-label", `\u00c5bn ${podcast.title}`);

    const openPodcast = () => {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    };

    card.addEventListener("click", openPodcast);
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openPodcast();
    });
  }

  return card;
}

function renderHomeRecent(container) {
  if (!container) return;

  const section = container.closest(".home-recent");
  const recent = state.podcasts
    .filter(
      (podcast) =>
        podcast.ratingDateObject &&
        typeof podcast.ratingValue === "number" &&
        podcast.ratingValue >= 7
    )
    .sort((a, b) => b.ratingDateObject - a.ratingDateObject)
    .slice(0, 4);

  container.innerHTML = "";

  if (!recent.length) {
    if (section) section.hidden = true;
    return;
  }

  if (section) section.hidden = false;

  const fragment = document.createDocumentFragment();
  recent.forEach((podcast) => {
    fragment.appendChild(createHomeRecentCardElement(podcast));
  });
  container.appendChild(fragment);
}

function createHomeGenreCardElement(podcast, genre) {
  const card = document.createElement("article");
  card.className = "home-genres-card";

  const cover = document.createElement("div");
  cover.className = "home-genres-card__cover";
  const image = document.createElement("img");
  image.className = "home-genres-card__image";
  image.loading = "lazy";
  cover.appendChild(image);
  setImage(cover, podcast.image, podcast.title);

  const copy = document.createElement("div");
  copy.className = "home-genres-card__copy";
  copy.innerHTML = `
    <p class="home-genres-card__genre">${escapeHtml(genre)}</p>
    <h3>${escapeHtml(podcast.title)}</h3>
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
  card.setAttribute("aria-label", `Udforsk ${genre}`);

  const openGenre = () => {
    try {
      window.sessionStorage?.setItem("podcastExploreGenre", genre);
    } catch (error) {
      // Session storage can be unavailable in strict browser modes.
    }
    window.location.hash = "#udforsk";
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

  GENRES.forEach((genre) => {
    if (genre === "Alle") return;

    let topPodcast = null;
    state.podcasts.forEach((podcast) => {
      const hasMadsRating =
        podcast.ratingValue !== null && podcast.ratingValue !== undefined;
      if (!hasMadsRating || podcast.genre !== genre) return;

      if (!topPodcast || podcast.placement < topPodcast.placement) {
        topPodcast = podcast;
      }
    });

    if (!topPodcast) return;
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

  if (!cover || !image || !item?.image) {
    cover?.classList.add("is-hidden");
    return;
  }

  loadImageWithFallback(image, item.image, item.title || "", {
    onFail() {
      cover.classList.add("is-hidden");
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

  setImage(cover, podcast.image, podcast.title);

  title.textContent = podcast.title;
  host.textContent = podcast.host || podcast.publisher || "";
  rating.textContent = podcast.ratingLabel || "Ikke vurderet";
  date.textContent = podcast.ratingDateLabel ? `Bed\u00f8mt ${podcast.ratingDateLabel}` : "";
  renderRateButton(rateButton, getPodcastKey(podcast));
  renderFavoriteButton(favoriteButton, getPodcastKey(podcast));

  card.addEventListener("click", () => {
    if (podcast.link) {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    }
  });

  rateButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    openRatingDialog(podcast);
  });

  favoriteButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleSavedPodcast(podcast);
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
  chip.className = "podcast-chip";
  chip.textContent = value || "Ukendt";

  if (value && value !== "Ukendt") {
    chip.dataset.action = type === "publisher" ? "filter-publisher" : "filter-genre";
    chip.dataset.value = value;
  }

  return chip;
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
  const key = getPodcastKey(podcast);
  const communityStat = getCommunityStat(key);
  const userRating = getUserRating(key);

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
    userCount.textContent = count > 0 ? formatUserReviewCount(count) : "";
    userCount.classList.toggle("is-hidden", count <= 0);
  }
}

function createPodcastReviewCardElement(podcast, review, key) {
  const article = document.createElement("article");
  article.className = "podcast-card podcast-card--review";
  article.dataset.key = key;
  const placementDisplay = getPodcastPlacementDisplay(podcast);
  article.classList.toggle("podcast-card--unranked", !placementDisplay.hasPlacement);

  const placement = document.createElement("div");
  placement.className = "podcast-card__placement";
  if (placementDisplay.hasPlacement) {
    placement.innerHTML = `
      <span class="placement-value">#${placementDisplay.value}</span>
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
    loadImageWithFallback(coverImg, review.image || podcast.image, review.title || podcast.title || "", {
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
    <p class="review-card__eyebrow">Mads anmelder</p>
    <h3 class="review-card__title">${escapeHtml(review.title || podcast.title)}</h3>
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

function createPodcastCardElement(podcast) {
  const review = getReviewForPodcast(podcast);
  const key = getPodcastKey(podcast);

  if (review && state.openReviewKeys.has(key)) {
    return createPodcastReviewCardElement(podcast, review, key);
  }

  const fragment = elements.podcastTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".podcast-card");
  const placement = fragment.querySelector(".podcast-card__placement");
  const media = fragment.querySelector(".podcast-card__media");
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

  article.dataset.key = key;
  article.classList.toggle("podcast-card--unranked", !placementDisplay.hasPlacement);

  if (placementDisplay.hasPlacement) {
    placement.innerHTML = `
      <span class="placement-value">#${placementDisplay.value}</span>
      <span class="placement-label">${placementDisplay.label}</span>
    `;
  } else {
    placement.classList.add("podcast-card__placement--unranked");
    placement.innerHTML = `
      <span class="placement-value">#---</span>
      <span class="placement-label">${placementDisplay.label}</span>
    `;
  }

  setImage(media, podcast.image, podcast.title);

  title.textContent = podcast.title;
  host.textContent = podcast.host || "";
  description.textContent = podcast.description || "";

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
  favoriteButton.dataset.action = "toggle-save";
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

function renderPodcastGrid() {
  if (!elements.podcastGrid) return;

  const filtered = getFilteredPodcasts();
  const visible = filtered.slice(0, state.visibleCount);

  elements.podcastGrid.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Ingen podcasts matcher filtreringen.";
    elements.podcastGrid.appendChild(empty);
  } else {
    const fragment = document.createDocumentFragment();

    visible.forEach((podcast) => {
      fragment.appendChild(createPodcastCardElement(podcast));
    });

    elements.podcastGrid.appendChild(fragment);
  }

  if (elements.resultsText) {
    elements.resultsText.textContent = getResultsText(filtered.length, visible.length);
  }

  updateLoadMoreUi(filtered.length, visible.length);
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
      loadImageWithFallback(elements.featuredImage, review.image, review.title || "");
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
  renderAuthPanel();
  updateActiveFilterUi();
  updateSortToggleUi();
  updateRankingSourceUi();
  updateRatingFilterUi();
  updateMobileRankingFilterUi();
  renderRoute();

  if (document.body.classList.contains("page-ranglister")) {
    renderRecent();
    renderPodcastGrid();
    renderFeaturedReview();
  }
}

function createProfilePodcastCardElement(podcast, badgeText, badgeTone = "neutral") {
  const card = document.createElement(podcast.link ? "a" : "article");
  card.className = "profile-podcast-card";

  if (podcast.link) {
    card.href = podcast.link;
    card.target = "_blank";
    card.rel = "noopener noreferrer";
    card.setAttribute("aria-label", `\u00c5bn ${podcast.title}`);
  }

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
  setImage(cover, podcast.image, podcast.title);

  const meta = [podcast.host || podcast.publisher, podcast.genre].filter(Boolean).join(" / ");
  const copy = document.createElement("div");
  copy.className = "profile-podcast-card__copy";
  copy.innerHTML = `
    <h3>${escapeHtml(podcast.title)}</h3>
    <p>${escapeHtml(meta)}</p>
  `;

  const badge = document.createElement("strong");
  badge.className = `profile-podcast-card__badge profile-podcast-card__badge--${badgeTone}`;
  badge.textContent = badgeText;

  card.append(cover, copy, badge);
  return card;
}

function getProfileRatedPodcasts() {
  return Object.entries(state.userRatingsByKey)
    .map(([key, rating]) => ({ podcast: state.podcastByKey[key], rating }))
    .filter((item) => item.podcast)
    .sort((a, b) => a.podcast.title.localeCompare(b.podcast.title, "da", { sensitivity: "base" }));
}

function getSavedPodcasts() {
  return Array.from(state.savedPodcastKeys)
    .map((key) => state.podcastByKey[key])
    .filter(Boolean)
    .sort((a, b) => a.title.localeCompare(b.title, "da", { sensitivity: "base" }));
}

function bindAuthPromptButtons(container) {
  container?.querySelectorAll("[data-auth-prompt]").forEach((button) => {
    button.addEventListener("click", () => {
      showAuthPrompt(button.dataset.authPrompt === "login" ? "login" : "signup");
    });
  });
}

function getSuggestionStatusLabel(status) {
  const normalized = normalizeComparable(status);
  const labels = {
    new: "Afventer",
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
    scoreParts.push(`Mads ${escapeHtml(madsRating)}`);
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
    ${getSuggestionMatchMarkup(suggestion)}
  `;

  return card;
}

async function fetchProfileSuggestions() {
  if (!state.supabase || !state.authUser || state.profileSuggestionsLoading) return;

  const userId = state.authUser.id;
  state.profileSuggestionsLoading = true;
  state.profileSuggestionsError = "";

  try {
    const { data, error } = await state.supabase
      .from("podcast_suggestions")
      .select("id, title, podcast_url, platform, comment, status, created_at")
      .eq("suggested_by_user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    state.profileSuggestions = data || [];
    state.profileSuggestionsLoadedFor = userId;
  } catch (error) {
    console.error(error);
    state.profileSuggestions = [];
    state.profileSuggestionsLoadedFor = userId;
    state.profileSuggestionsError =
      "Dine podcastforslag kunne ikke hentes lige nu.";
  } finally {
    state.profileSuggestionsLoading = false;
    if (document.body.classList.contains("page-profil")) {
      renderProfilePage();
    }
  }
}

function renderProfilePage() {
  const container = elements.pageIntroPanel;
  if (!container) return;

  container.innerHTML = "";
  container.classList.remove("is-hidden");

  if (state.authConfigured && !state.authReady) {
    container.innerHTML = `
      <section class="profile-page">
        <div class="profile-state-card" aria-live="polite">
          <p class="profile-eyebrow">Konto</p>
          <h1>Indl&aelig;ser din profil&hellip;</h1>
          <p>Vi kontrollerer din loginstatus og henter dine personlige podcastdata.</p>
        </div>
      </section>
    `;
    return;
  }

  if (!isLoggedIn()) {
    const disabled = !state.authConfigured || state.authBusy ? "disabled" : "";
    const availabilityMessage = state.authConfigured
      ? "Log ind for at se dine vurderinger og gemte podcasts."
      : "Login er ikke tilg&aelig;ngeligt, fordi auth ikke er konfigureret.";

    container.innerHTML = `
      <section class="profile-page">
        <div class="profile-state-card profile-state-card--logged-out">
          <p class="profile-eyebrow">Din podcastkonto</p>
          <h1>Din profil</h1>
          <p>${availabilityMessage}</p>
          <div class="profile-actions">
            <button class="profile-button profile-button--primary" type="button" data-auth-prompt="login" ${disabled}>
              Log ind
            </button>
            <button class="profile-button profile-button--secondary" type="button" data-auth-prompt="signup" ${disabled}>
              Opret konto
            </button>
            <a class="profile-button profile-button--quiet" href="#ranglister">Se ranglister</a>
          </div>
        </div>
      </section>
    `;

    bindAuthPromptButtons(container);
    return;
  }

  const ratedPodcasts = getProfileRatedPodcasts();
  const ratingCount = Object.keys(state.userRatingsByKey).length;

  container.innerHTML = `
    <section class="profile-page">
      <header class="profile-header">
        <div class="profile-avatar" aria-hidden="true">${escapeHtml(
          (state.authUser.email || "?").trim().charAt(0).toUpperCase() || "?"
        )}</div>
        <div class="profile-header__copy">
          <p class="profile-eyebrow"><span class="profile-status-dot" aria-hidden="true"></span> Logget ind</p>
          <h1 data-mobile-title="Profil">Din profil</h1>
          <p class="profile-email">${escapeHtml(state.authUser.email || "Email ikke tilg\u00e6ngelig")}</p>
        </div>
        <nav class="profile-actions" aria-label="Profilhandlinger">
          <a class="profile-button profile-button--primary" href="#ranglister">Se ranglister</a>
          <a class="profile-button profile-button--secondary" href="#gemte">Se gemte</a>
          <button class="profile-button profile-button--logout" type="button" data-profile-logout ${state.authBusy ? "disabled" : ""}>
            Log ud
          </button>
        </nav>
      </header>

      <div class="profile-stats" aria-label="Profilstatistik">
        <article class="profile-stat-card">
          <span class="profile-stat-card__label">Dine vurderinger</span>
          <strong>${ratingCount}</strong>
          <span class="profile-stat-card__desktop-label">Vurderinger</span>
          <span class="profile-stat-card__icon" aria-hidden="true">&starf;</span>
        </article>
      </div>

      <div class="profile-dashboard">
        <section class="profile-panel" aria-labelledby="profileRatingsHeading">
          <header class="profile-panel__header">
            <div>
              <p class="profile-eyebrow">Dine scores</p>
              <h2 id="profileRatingsHeading">Dine vurderinger</h2>
            </div>
            <span>${ratingCount}</span>
          </header>
          <p class="profile-panel__note">Vises alfabetisk.</p>
          <div class="profile-podcast-list" data-profile-ratings></div>
        </section>

        <section class="profile-panel profile-suggestions-panel" aria-labelledby="profileSuggestionsHeading">
          <header class="profile-panel__header">
            <div>
              <p class="profile-eyebrow">Dine indsendelser</p>
              <h2 id="profileSuggestionsHeading">Mine podcastforslag</h2>
            </div>
            <span data-profile-suggestions-count></span>
          </header>
          <p class="profile-panel__note">Nyeste forslag vises f&oslash;rst.</p>
          <div class="profile-suggestion-list" data-profile-suggestions></div>
        </section>
      </div>

      <nav class="profile-menu" aria-label="Profilmenu">
        <a class="profile-menu__item" href="#profil">
          <span aria-hidden="true">&star;</span>
          <strong>Mine vurderinger</strong>
          <em aria-hidden="true">&rsaquo;</em>
        </a>
        <a class="profile-menu__item" href="#profil">
          <span aria-hidden="true">&#9881;</span>
          <strong>Indstillinger</strong>
          <em aria-hidden="true">&rsaquo;</em>
        </a>
        <a class="profile-menu__item" href="#profil">
          <span aria-hidden="true">?</span>
          <strong>Hj&aelig;lp &amp; FAQ</strong>
          <em aria-hidden="true">&rsaquo;</em>
        </a>
        <button class="profile-menu__item profile-menu__item--logout" type="button" data-profile-logout ${state.authBusy ? "disabled" : ""}>
          <span aria-hidden="true">&#8618;</span>
          <strong>Log ud</strong>
        </button>
      </nav>
    </section>
  `;

  container
    .querySelectorAll("[data-profile-logout]")
    .forEach((button) => button.addEventListener("click", handleLogout));

  const ratingsContainer = container.querySelector("[data-profile-ratings]");
  if (ratedPodcasts.length) {
    const ratingsFragment = document.createDocumentFragment();
    ratedPodcasts.forEach(({ podcast, rating }) => {
      ratingsFragment.appendChild(
        createProfilePodcastCardElement(podcast, formatRating(rating), "rating")
      );
    });
    ratingsContainer.appendChild(ratingsFragment);
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

  const suggestionsContainer = container.querySelector("[data-profile-suggestions]");
  const suggestionsCount = container.querySelector("[data-profile-suggestions-count]");
  const suggestionsLoaded = state.profileSuggestionsLoadedFor === state.authUser.id;

  if (suggestionsCount) {
    suggestionsCount.textContent = suggestionsLoaded ? String(state.profileSuggestions.length) : "";
  }

  if (!suggestionsLoaded) {
    suggestionsContainer.innerHTML = `
      <div class="profile-empty-state">
        <h3>Indl&aelig;ser dine podcastforslag&hellip;</h3>
        <p>Vi henter de forslag, du har sendt ind.</p>
      </div>
    `;
    fetchProfileSuggestions();
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
        <h3>Du har ikke sendt nogen podcastforslag endnu.</h3>
        <p>G&aring; til Udforsk, hvis der mangler en podcast p&aring; listen.</p>
        <a class="profile-button profile-button--quiet" href="#udforsk">Foresl&aring; podcast</a>
      </div>
    `;
  }

}

function createSavedPodcastCardElement(podcast) {
  const podcastKey = getPodcastKey(podcast);
  const communityStat = getCommunityStat(podcastKey);
  const card = document.createElement("article");
  card.className = "saved-card";

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
  setImage(cover, podcast.image, podcast.title);

  const copy = document.createElement("div");
  copy.className = "saved-card__copy";
  const meta = [podcast.host || podcast.publisher, podcast.genre].filter(Boolean).join(" / ");
  copy.innerHTML = `
    <h2>${escapeHtml(podcast.title)}</h2>
    <p>${escapeHtml(meta)}</p>
  `;

  const scores = document.createElement("div");
  scores.className = "saved-card__scores";

  if (podcast.ratingValue !== null && podcast.ratingValue !== undefined) {
    const madsScore = document.createElement("span");
    madsScore.innerHTML = `<small>Mads</small><strong>${escapeHtml(
      podcast.ratingLabel || formatRating(podcast.ratingValue)
    )}</strong>`;
    scores.appendChild(madsScore);
  }

  if (communityStat?.averageRating !== null && communityStat?.averageRating !== undefined) {
    const communityScore = document.createElement("span");
    communityScore.innerHTML = `
      <small>Brugere</small>
      <strong>${escapeHtml(formatRating(communityStat.averageRating))}</strong>
      <em>${escapeHtml(formatUserRatingCount(communityStat.ratingCount || 0))}</em>
    `;
    scores.appendChild(communityScore);
  }

  const actions = document.createElement("div");
  actions.className = "saved-card__actions";

  if (podcast.link) {
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
  removeButton.setAttribute("aria-label", `Fjern ${podcast.title} fra gemte`);
  removeButton.textContent = "Fjern fra gemte";
  removeButton.addEventListener("click", async () => {
    if (state.authBusy) return;

    removeButton.disabled = true;
    await toggleSavedPodcast(podcast);
    if (removeButton.isConnected) {
      removeButton.disabled = false;
    }
  });
  actions.appendChild(removeButton);

  card.append(cover, copy);
  if (scores.childElementCount) {
    card.appendChild(scores);
  }
  card.appendChild(actions);
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

function getExploreScoreMarkup(podcast, className) {
  const communityStat = getCommunityStat(getPodcastKey(podcast));
  const hasUsers = hasCommunityRating(communityStat);
  const userRating = hasUsers ? formatCompactRating(communityStat.averageRating) : "";
  const madsRating = formatCompactRating(podcast.ratingValue);
  const parts = [];

  if (userRating) {
    parts.push(`<span><strong>Brugere</strong> ${escapeHtml(userRating)}</span>`);
  }

  if (madsRating) {
    parts.push(`<span><strong>Mads</strong> ${escapeHtml(madsRating)}</span>`);
  }

  if (!parts.length) {
    parts.push("<span>Ikke vurderet</span>");
  }

  const count = Number(communityStat?.ratingCount || 0);
  const countMarkup = count
    ? `<em>${escapeHtml(formatUserReviewCount(count))}</em>`
    : "";

  return `
    <div class="${className}">
      <p>${parts.join(" <span aria-hidden=\"true\">&middot;</span> ")}</p>
      ${countMarkup}
    </div>
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

function setSuggestionMessage(messageElement, message = "", tone = "info") {
  if (!messageElement) return;
  messageElement.innerHTML = message;
  messageElement.classList.toggle("is-hidden", !message);
  messageElement.dataset.tone = tone;
}

async function submitPodcastSuggestion(form, messageElement) {
  if (!form) return;

  const formData = new FormData(form);
  const title = normalizeText(formData.get("title"));
  const podcastUrl = normalizeSuggestionUrl(formData.get("podcast_url"));

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

    const payload = {
      title,
      podcast_url: podcastUrl || null,
      platform: normalizeText(formData.get("platform")) || null,
      comment: normalizeText(formData.get("comment")) || null,
      suggested_by_user_id: user.id,
      suggested_by_email: user.email || null,
      status: "new"
    };

    const { error } = await state.supabase.from("podcast_suggestions").insert(payload);
    if (error) throw error;

    form.reset();
    state.profileSuggestionsLoadedFor = null;
    const successState = form
      .closest(".explore-suggestion-dialog__panel")
      ?.querySelector("[data-explore-suggest-success]");
    form.hidden = true;
    successState?.classList.remove("is-hidden");
    setSuggestionMessage(messageElement, "");
  } catch (error) {
    console.warn("Podcast suggestion submit failed", error);
    setSuggestionMessage(messageElement, getSuggestionErrorMessage(error), "error");
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
}

function createExplorePodcastCardElement(podcast) {
  const card = document.createElement("article");
  card.className = "explore-card";

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
  setImage(cover, podcast.image, podcast.title);

  const copy = document.createElement("div");
  copy.className = "explore-card__copy";
  copy.innerHTML = `
    <p class="explore-card__genre">${escapeHtml(podcast.genre || "Podcast")}</p>
    <h3>${escapeHtml(podcast.title)}</h3>
    <p class="explore-card__host">${escapeHtml(
      podcast.host || podcast.publisher || ""
    )}</p>
    ${getExploreScoreMarkup(podcast, "explore-card__rating")}
  `;

  const actions = document.createElement("div");
  actions.className = "explore-card__actions";

  if (podcast.link) {
    const openLink = document.createElement("a");
    openLink.className = "explore-button explore-button--card";
    openLink.href = podcast.link;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = "\u00c5bn podcast";
    actions.appendChild(openLink);
  }

  card.append(cover, copy);
  if (actions.childElementCount) {
    card.appendChild(actions);
  }
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
  setImage(cover, review.image, review.title || "");

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
  setImage(cover, podcast.image, podcast.title);

  const copy = document.createElement("div");
  copy.className = "explore-genre-card__copy";
  copy.innerHTML = `
    <p class="explore-genre-card__genre">${escapeHtml(podcast.genre)}</p>
    <h3>${escapeHtml(podcast.title)}</h3>
    <p class="explore-genre-card__host">${escapeHtml(
      podcast.host || podcast.publisher || ""
    )}</p>
    ${getExploreScoreMarkup(podcast, "explore-genre-card__scores")}
  `;

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
  const fragment = document.createDocumentFragment();
  let sectionCount = 0;

  visibleGenres.forEach((genreName) => {
    const podcasts = state.podcasts
      .filter(
        (podcast) =>
          podcast.genre === genreName &&
          (hasCommunityRating(getCommunityStat(getPodcastKey(podcast))) ||
            (podcast.ratingValue !== null && podcast.ratingValue !== undefined))
      )
      .sort(compareExplorePodcasts)
      .slice(0, 4);

    if (!podcasts.length) return;

    const section = document.createElement("section");
    section.className = "explore-genre-section";
    section.setAttribute("aria-labelledby", `exploreGenre${sectionCount}Heading`);
    section.innerHTML = `
      <header class="explore-genre-section__header">
        <div>
          <p class="explore-eyebrow">Bedst vurderet af brugere</p>
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

  container.innerHTML = `
    <section class="explore-page">
      <header class="explore-hero">
        <div class="explore-hero__copy">
          <p class="explore-eyebrow">Opdag din n&aelig;ste favorit</p>
          <h1 data-mobile-title="Udforsk">Udforsk podcasts</h1>
          <p>Find podcasts efter genre, emne og brugernes vurderinger.</p>
        </div>
        <label class="explore-search" for="exploreSearchInput">
          <span>S&oslash;g i Udforsk</span>
          <input
            id="exploreSearchInput"
            type="search"
            placeholder="S&oslash;g efter podcast, v&aelig;rt, udgiver eller genre"
            autocomplete="off"
            spellcheck="false"
          />
        </label>
        <div class="explore-genres" aria-label="Filtrer Udforsk efter genre">
          ${genreMarkup}
        </div>
      </header>

      <section class="explore-featured" aria-labelledby="exploreFeaturedHeading">
        <header class="explore-section-header">
          <div>
            <p class="explore-eyebrow">Kurateret inspiration</p>
            <h2 id="exploreFeaturedHeading">Mads&rsquo; udvalgte</h2>
          </div>
        </header>
        <div class="explore-featured__grid" data-explore-featured></div>
      </section>

      <section class="explore-popular" aria-labelledby="explorePopularHeading">
        <header class="explore-section-header">
          <div>
            <p class="explore-eyebrow">Communityrangering</p>
            <h2 id="explorePopularHeading">Popul&aelig;re blandt brugere</h2>
          </div>
          <span class="explore-results-count" data-explore-count></span>
        </header>
        <div class="explore-grid" data-explore-grid></div>
      </section>

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

      <div
        class="explore-genre-sections"
        data-explore-genre-sections
        aria-label="Podcastanbefalinger efter genre"
      ></div>

      <div class="explore-suggestion-dialog is-hidden" data-explore-suggest-dialog aria-hidden="true">
        <div class="explore-suggestion-dialog__backdrop" data-explore-suggest-close></div>
        <div
          class="explore-suggestion-dialog__panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exploreSuggestionTitle"
        >
          <button
            class="explore-suggestion-dialog__close"
            type="button"
            aria-label="Luk forslag"
            data-explore-suggest-close
          >
            &times;
          </button>
          <p class="explore-eyebrow">Podcastforslag</p>
          <h2 id="exploreSuggestionTitle">Foresl&aring; podcast</h2>
          <p class="explore-suggestion-dialog__intro">Send en podcast til manuel gennemgang.</p>
          <form class="explore-suggestion-form" data-explore-suggest-form novalidate>
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
            <div class="explore-suggestion-form__actions">
              <button class="auth-button auth-button--secondary" type="button" data-explore-suggest-close>
                Annuller
              </button>
              <button class="auth-button auth-button--primary" type="submit">
                Send forslag
              </button>
            </div>
          </form>
          <div class="explore-suggestion-success is-hidden" data-explore-suggest-success>
            <h3>Tak for forslaget!</h3>
            <p>Vi kigger p&aring; den.</p>
            <button class="auth-button auth-button--primary" type="button" data-explore-suggest-close>
              Luk
            </button>
          </div>
        </div>
      </div>
    </section>
  `;
  container.classList.remove("is-hidden");

  const searchInput = container.querySelector("#exploreSearchInput");
  const genreButtons = container.querySelectorAll("[data-explore-genre]");
  const grid = container.querySelector("[data-explore-grid]");
  const count = container.querySelector("[data-explore-count]");
  const genreSections = container.querySelector("[data-explore-genre-sections]");
  const featuredGrid = container.querySelector("[data-explore-featured]");
  const suggestionDialog = container.querySelector("[data-explore-suggest-dialog]");
  const suggestionForm = container.querySelector("[data-explore-suggest-form]");
  const suggestionMessage = container.querySelector("[data-explore-suggest-message]");
  const suggestionSuccess = container.querySelector("[data-explore-suggest-success]");
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

  renderExploreFeatured(featuredGrid);

  const renderExploreResults = () => {
    const expandedQuery = expandSearchAliases(localSearchTerm);
    const queryParts = expandedQuery
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean);

    const matchingPodcasts = state.podcasts
      .filter((podcast) => {
        const stat = getCommunityStat(getPodcastKey(podcast));
        if (!hasCommunityRating(stat)) {
          return false;
        }

        if (localGenre !== "Alle" && podcast.genre !== localGenre) {
          return false;
        }

        return queryParts.every((part) => podcast.searchText.includes(part));
      })
      .sort(compareExplorePodcasts);

    renderExploreGenreSections(genreSections, {
      searchTerm: localSearchTerm,
      genre: localGenre
    });

    if (count) {
      const visibleResultCount = Math.min(matchingPodcasts.length, 12);
      count.textContent =
        matchingPodcasts.length > visibleResultCount
          ? `Viser ${visibleResultCount} af ${matchingPodcasts.length}`
          : `${matchingPodcasts.length} ${
              matchingPodcasts.length === 1 ? "podcast" : "podcasts"
            }`;
    }

    grid.innerHTML = "";
    if (!matchingPodcasts.length) {
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
      return;
    }

    const fragment = document.createDocumentFragment();
    matchingPodcasts.slice(0, 12).forEach((podcast) => {
      fragment.appendChild(createExplorePodcastCardElement(podcast));
    });
    grid.appendChild(fragment);
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

  const closeSuggestionDialog = () => {
    state.exploreSuggestionDialogOpen = false;
    suggestionDialog?.classList.add("is-hidden");
    suggestionDialog?.setAttribute("aria-hidden", "true");
    if (
      elements.authDialog?.classList.contains("is-hidden") &&
      elements.ratingDialog?.classList.contains("is-hidden")
    ) {
      document.body.classList.remove("has-dialog-open");
    }
  };

  const openSuggestionDialog = () => {
    if (!isLoggedIn()) {
      state.pendingAuthAction = { type: "suggestion" };
      showAuthPrompt("login");
      setAuthMessage("Log ind for at sende podcastforslag.", "warning", "dialog");
      return;
    }

    setSuggestionMessage(suggestionMessage, "");
    state.exploreSuggestionDialogOpen = true;
    if (suggestionForm) {
      suggestionForm.hidden = false;
      suggestionForm.reset();
    }
    suggestionSuccess?.classList.add("is-hidden");
    suggestionDialog?.classList.remove("is-hidden");
    suggestionDialog?.setAttribute("aria-hidden", "false");
    document.body.classList.add("has-dialog-open");
    suggestionForm?.querySelector("[name='title']")?.focus();
  };

  container.querySelector("[data-explore-suggest-open]")?.addEventListener("click", openSuggestionDialog);

  container.querySelectorAll("[data-explore-suggest-close]").forEach((button) => {
    button.addEventListener("click", closeSuggestionDialog);
  });

  suggestionForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    submitPodcastSuggestion(suggestionForm, suggestionMessage);
  });

  if (state.exploreSuggestionDialogOpen && isLoggedIn()) {
    window.setTimeout(openSuggestionDialog, 0);
  }

  renderExploreResults();
}

function renderRoute() {
  const route = window.location.hash.slice(1).toLowerCase();

  switch (route) {
    case "forside":
    case "ranglister":
    case "udforsk":
    case "gemte":
    case "profil":
      break;
    default:
      window.location.replace("#forside");
      return;
  }

  document.body.classList.remove(
    "page-forside",
    "page-ranglister",
    "page-udforsk",
    "page-gemte",
    "page-profil"
  );
  document.body.classList.add(`page-${route}`);

  if (route !== "udforsk") {
    state.exploreSuggestionDialogOpen = false;
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

  if (!elements.pageIntroPanel) return;

  if (route === "ranglister") {
    elements.pageIntroPanel.classList.add("is-hidden");
    elements.pageIntroPanel.innerHTML = "";
    return;
  }

  if (route === "forside") {
    const featuredReview = state.featuredReviews[0] || null;
    const showHomeCommunityCta = !isLoggedIn();
    const heroPodcastPrimary =
      state.podcasts.find(
        (podcast) => podcast.image && podcast.title !== featuredReview?.title
      ) || null;
    const heroPodcastSecondary =
      state.podcasts.find(
        (podcast) =>
          podcast.image &&
          podcast !== heroPodcastPrimary &&
          podcast.title !== featuredReview?.title
      ) || null;
    const ratedPodcastCount = state.podcasts.reduce(
      (count, podcast) =>
        count +
        (podcast.ratingValue !== null && podcast.ratingValue !== undefined ? 1 : 0),
      0
    );

    elements.pageIntroPanel.innerHTML = `
      <div class="home-hero">
        <div class="home-hero__copy">
          <p class="eyebrow"><span class="mobile-brand-word">Podcast<span class="mobile-brand-accent">listen</span></span>Personlige podcastfavoritter</p>
          <h1>Find din n&aelig;ste podcastfavorit</h1>
          <p
            class="intro"
            data-mobile-intro="Se hvilke podcasts lytterne vurderer h&oslash;jest &ndash; og find inspiration til din n&aelig;ste lytning."
          >
            Mads Asps personlige rangliste over podcasts &ndash; udvalgt og delt til
            inspiration for andre lyttere.
          </p>
          <div class="home-mobile-actions" aria-label="Hurtige handlinger">
            <a class="home-mobile-action home-mobile-action--primary" href="#ranglister">Se ranglisten</a>
            <a class="home-mobile-action home-mobile-action--secondary" href="#ranglister">Vurder podcasts</a>
          </div>
          <p class="home-mobile-helper">Filtr&eacute;r efter genre, gem favoritter og giv dine egne vurderinger.</p>
          <div class="page-intro-panel__actions">
            <a class="page-intro-panel__button" href="#ranglister">Se ranglister</a>
            <a
              class="page-intro-panel__button page-intro-panel__button--secondary"
              href="#udforsk"
            >
              Udforsk podcasts
            </a>
          </div>
        </div>
        <div class="home-hero__visual" aria-label="Udvalgte podcasts">
          <div class="home-hero__glow" aria-hidden="true"></div>
          <div class="home-hero__cover home-hero__cover--featured">
            <img alt="" loading="lazy" />
          </div>
          <div class="home-hero__cover home-hero__cover--primary">
            <img alt="" loading="lazy" />
          </div>
          <div class="home-hero__cover home-hero__cover--secondary">
            <img alt="" loading="lazy" />
          </div>
          <div class="home-hero__stat">
            <strong>${ratedPodcastCount}</strong>
            <span>podcasts vurderet af Mads</span>
          </div>
        </div>
      </div>
      <div class="home-primary-row">
      <section class="home-featured" aria-labelledby="homeFeaturedHeading">
        <div class="section-header">
          <div>
            <p class="eyebrow">Mads anbefaler</p>
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
          <span class="home-swipe-hint">Swipe &rarr;</span>
        </div>
        <div class="home-popular__grid"></div>
      </section>
      </div>
      <div class="home-secondary-row">
        <section class="home-genres" aria-labelledby="homeGenresHeading">
          <div class="section-header">
            <div>
              <p class="eyebrow">Mads' favoritter</p>
              <h2 id="homeGenresHeading" data-mobile-title="Top i genrer">Top i hver genre</h2>
            </div>
          </div>
          <p class="home-genres__hint">Tryk p&aring; en genre for at udforske podcasts i kategorien.</p>
          <div class="home-genres__grid"></div>
        </section>
        <section class="home-recent" aria-labelledby="homeRecentHeading">
          <div class="section-header">
            <div>
              <p class="eyebrow">Nye vurderinger</p>
              <h2 id="homeRecentHeading">
                <span class="home-recent-heading__desktop">Senest bed&oslash;mte</span>
                <span class="home-recent-heading__mobile">Nye fund p&aring; listen</span>
              </h2>
            </div>
          </div>
          <div class="home-recent__grid"></div>
        </section>
      </div>
      ${
        showHomeCommunityCta
          ? `
            <section class="home-community-cta" aria-labelledby="homeCommunityCtaHeading">
              <div class="home-community-cta__copy">
                <h2 id="homeCommunityCtaHeading">Bliv en del af f&aelig;llesskabet</h2>
                <p>Opret en gratis konto, gem dine favoritter og del dine vurderinger.</p>
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

    setHomeHeroCover(
      elements.pageIntroPanel,
      ".home-hero__cover--featured",
      featuredReview
    );
    setHomeHeroCover(
      elements.pageIntroPanel,
      ".home-hero__cover--primary",
      heroPodcastPrimary
    );
    setHomeHeroCover(
      elements.pageIntroPanel,
      ".home-hero__cover--secondary",
      heroPodcastSecondary
    );

    const featuredContent = elements.pageIntroPanel.querySelector(
      ".home-featured__content"
    );

    if (featuredReview) {
      const meta = [featuredReview.host, featuredReview.publisher, featuredReview.genre]
        .filter(Boolean)
        .join(" / ");
      const linkMarkup = featuredReview.link
        ? `
          <a
            class="page-intro-panel__button home-featured__link"
            href="${escapeHtml(featuredReview.link)}"
            target="_blank"
            rel="noopener noreferrer"
          >
            Åbn podcast
          </a>
        `
        : "";

      featuredContent.innerHTML = `
        <div class="home-featured__cover">
          <img class="home-featured__image" alt="" loading="lazy" />
        </div>
        <div class="home-featured__copy">
          <p class="home-featured__label">Ugens anbefaling</p>
          <h3>${escapeHtml(featuredReview.title || "")}</h3>
          <p class="home-featured__meta">${escapeHtml(meta)}</p>
          <div class="home-featured__details">
            <strong>${escapeHtml(featuredReview.scoreLabel || "Ikke vurderet")}</strong>
            <span>${escapeHtml(featuredReview.reviewDateLabel || "")}</span>
          </div>
          <p class="home-featured__review">${escapeHtml(featuredReview.review || "")}</p>
          ${linkMarkup}
        </div>
      `;

      const image = featuredContent.querySelector(".home-featured__image");
      const cover = featuredContent.querySelector(".home-featured__cover");

      if (featuredReview.image) {
        loadImageWithFallback(image, featuredReview.image, featuredReview.title || "", {
          onFail() {
            cover.classList.add("has-no-image");
          }
        });
      } else {
        cover.classList.add("has-no-image");
      }
    } else {
      featuredContent.innerHTML =
        '<div class="empty-state">Ugens anbefaling er på vej.</div>';
    }

    renderHomePopular(
      elements.pageIntroPanel.querySelector(".home-popular__grid")
    );
    renderHomeRecent(
      elements.pageIntroPanel.querySelector(".home-recent__grid")
    );
    renderHomeGenres(
      elements.pageIntroPanel.querySelector(".home-genres__grid")
    );

    const homeCommunityCtaButton = elements.pageIntroPanel.querySelector(
      ".home-community-cta__button"
    );
    homeCommunityCtaButton?.addEventListener("click", () => {
      showAuthPrompt("signup");
    });

    elements.pageIntroPanel.classList.remove("is-hidden");
    return;
  }

  if (route === "profil") {
    renderProfilePage();
    return;
  }

  if (route === "gemte") {
    renderSavedPage();
    return;
  }

  if (route === "udforsk") {
    renderExplorePage();
    return;
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
}

function handlePodcastGridClick(event) {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget || !elements.podcastGrid.contains(actionTarget)) {
    return;
  }

  const card = actionTarget.closest(".podcast-card");
  const key = card?.dataset.key;
  const podcast = key ? state.podcastByKey[key] : null;

  if (!podcast) return;

  const review = getReviewForPodcast(podcast);
  const action = actionTarget.dataset.action;

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
    card.replaceWith(createPodcastReviewCardElement(podcast, review, key));
    return;
  }

  if (action === "close-review") {
    state.openReviewKeys.delete(key);
    card.replaceWith(createPodcastCardElement(podcast));
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

  if (action === "open-rating") {
    openRatingDialog(podcast);
    return;
  }

  if (action === "toggle-save") {
    toggleSavedPodcast(podcast);
  }
}

function setupEvents() {
  window.addEventListener("hashchange", render);

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
      resetVisibleCount();
      render();
    });
  }

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
      state.sort =
        state.sort === "placement-asc" ? "placement-desc" : "placement-asc";
      resetVisibleCount();
      render();
    });
  }

  if (elements.mobileSortToggle) {
    elements.mobileSortToggle.addEventListener("click", () => {
      state.sort =
        state.sort === "placement-asc" ? "placement-desc" : "placement-asc";
      resetVisibleCount();
      render();
    });
  }

  elements.rankingSourceButtons?.forEach((button) => {
    button.addEventListener("click", () => {
      const nextSource = button.dataset.rankingSource === "users" ? "users" : "mads";
      if (state.rankingSource === nextSource) return;

      state.rankingSource = nextSource;
      resetVisibleCount();
      render();
    });
  });

  elements.ratingFilter?.addEventListener("input", (event) => {
    setMinimumRating(event.target.value);
  });

  elements.rankingMobileFilterToggle?.addEventListener("click", () => {
    state.mobileRankingFiltersOpen = !state.mobileRankingFiltersOpen;
    updateMobileRankingFilterUi();
  });

  elements.viewModeToggle?.addEventListener("click", toggleViewMode);

  elements.openSignupButton?.addEventListener("click", () => {
    showAuthPrompt("signup");
  });

  elements.openLoginButton?.addEventListener("click", () => {
    showAuthPrompt("login");
  });

  elements.globalAuthZone?.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) return;

    const actionTarget = event.target.closest("[data-global-auth-action]");
    if (!actionTarget || !elements.globalAuthZone.contains(actionTarget)) return;

    const action = actionTarget.dataset.globalAuthAction;
    if (action === "logout") {
      handleLogout();
      return;
    }

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

  if (elements.podcastGrid) {
    elements.podcastGrid.addEventListener("click", handlePodcastGridClick);
    elements.podcastGrid.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (!(event.target instanceof HTMLElement)) return;

      const actionTarget = event.target.closest("[data-action]");
      if (!actionTarget || !elements.podcastGrid.contains(actionTarget)) return;

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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.authDialog?.classList.contains("is-hidden")) {
      closeAuthDialog();
    }

    if (event.key === "Escape" && !elements.ratingDialog?.classList.contains("is-hidden")) {
      closeRatingDialog();
    }

    const suggestionDialog = document.querySelector(".explore-suggestion-dialog:not(.is-hidden)");
    if (event.key === "Escape" && suggestionDialog) {
      state.exploreSuggestionDialogOpen = false;
      suggestionDialog.classList.add("is-hidden");
      suggestionDialog.setAttribute("aria-hidden", "true");
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
    }, 0);
  });

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
    cache: "default"
  });

  if (!response.ok) {
    throw new Error("Kunne ikke hente lokal podcasts.json.");
  }

  const data = await response.json();
  return extractRowsFromJsonPayload(data, "podcasts.json har ikke forventet format.");
}

async function loadFeaturedReviewObjectsFromJson() {
  const response = await fetch(`${FEATURED_JSON_DATA_URL}?v=${DATA_VERSION}`, {
    cache: "default"
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

function buildPodcastLookup(podcasts) {
  const lookup = {};

  podcasts.forEach((podcast) => {
    const key = getPodcastKey(podcast);
    if (!key) return;
    lookup[key] = podcast;
  });

  return lookup;
}

async function loadPodcasts() {
  try {
    const [podcastRows, featuredRows] = await Promise.all([
      loadPodcastObjectsFromJson(),
      loadFeaturedReviewObjectsFromJson().catch((error) => {
        console.warn("Udvalgte vurderinger blev ikke indlæst:", error);
        return [];
      })
    ]);

    const mappedPodcasts = podcastRows.map(mapPodcast).filter(isUsefulPodcast);

    state.podcasts = deduplicatePodcasts(mappedPodcasts);
    state.podcastByKey = buildPodcastLookup(state.podcasts);

    state.allReviews = featuredRows
      .map((row, index) => mapFeaturedReview(row, index, state.podcastByKey))
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
    rebuildUserRanks();

    createGenreChips();
    render();
    startFeaturedRotation();
  } catch (error) {
    console.error(error);
    showLoadError(
      "Kunne ikke indl\u00e6se podcasts. Tjek data/podcasts.json og data/featured-reviews.json."
    );
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

function runSecondaryStartup() {
  initSupabase();
  loadVisitorCount();
}

ensureLoadMoreControls();
applyViewModePreference();
setupEvents();
updateAuthPasswordToggle();
renderRoute();
window.setTimeout(() => {
  clearSearchInput({ rerender: true });
}, 120);
loadPodcasts();

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(runSecondaryStartup, { timeout: 1500 });
} else {
  window.setTimeout(runSecondaryStartup, 400);
}

