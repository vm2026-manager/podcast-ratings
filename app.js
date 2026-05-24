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
const INITIAL_VISIBLE_COUNT = 48;
const DATA_VERSION = "2026-05-24-18";
const EXPANDED_LIST_STORAGE_KEY = "podcast-ratings-expanded-list";
const NEW_BADGE_DAYS = 14;
const SUPABASE_CONFIG = window.PODCAST_SUPABASE_CONFIG || {
  url: "",
  anonKey: ""
};

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
  authConfigured: false,
  authBusy: false,
  authMode: "signup",
  authMessageTimer: null,
  userRatingsByKey: {},
  communityStatsByKey: {},
  savedPodcastKeys: new Set(),
  activeRatingKey: null,
  openReviewKeys: new Set(),
  featuredIndex: 0,
  featuredTimer: null,
  featuredPaused: false,
  activeFilter: null,
  searchTerm: "",
  sort: "placement-asc",
  hasExpandedInitialList: readExpandedListPreference(),
  visibleCount: readExpandedListPreference() ? Number.MAX_SAFE_INTEGER : INITIAL_VISIBLE_COUNT
};

const elements = {
  genreChips: document.getElementById("genreChips"),
  searchInput: document.getElementById("searchInput"),
  sortToggle: document.getElementById("sortToggle"),
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
  featuredPanel: document.getElementById("featuredReviewPanel"),
  featuredImage: document.getElementById("featuredImage"),
  featuredTitle: document.getElementById("featuredTitle"),
  featuredMeta: document.getElementById("featuredMeta"),
  featuredScore: document.getElementById("featuredScore"),
  featuredDate: document.getElementById("featuredDate"),
  featuredText: document.getElementById("featuredText"),
  featuredParams: document.getElementById("featuredParams"),
  featuredDots: document.getElementById("featuredDots"),
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
    image,
    description,
    placement: placement ?? index + 1,
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

function getStarString(value, muted = false) {
  const number = parseNumber(value);
  if (number === null) {
    return muted ? "\u2606\u2606\u2606\u2606\u2606" : "\u2605\u2605\u2605\u2605\u2605";
  }

  const filled = Math.max(0, Math.min(5, Math.round(number / 2)));
  return `${"\u2605".repeat(filled)}${"\u2606".repeat(5 - filled)}`;
}

function resetVisibleCount() {
  state.visibleCount = state.hasExpandedInitialList
    ? Number.MAX_SAFE_INTEGER
    : INITIAL_VISIBLE_COUNT;
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

      if (!state.searchTerm) return true;

      const query = expandSearchAliases(state.searchTerm);
      const queryParts = query
        .split(" ")
        .map((part) => part.trim())
        .filter(Boolean);

      return queryParts.every((part) => podcast.searchText.includes(part));
    })
    .sort((a, b) => {
      if (state.sort === "placement-desc") {
        const aHasRating = a.ratingValue !== null;
        const bHasRating = b.ratingValue !== null;

        if (aHasRating !== bHasRating) {
          return aHasRating ? -1 : 1;
        }

        return b.placement - a.placement;
      }

      return a.placement - b.placement;
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
  if (!elements.sortToggle) return;

  elements.sortToggle.textContent =
    state.sort === "placement-asc"
      ? "Placering: lavest f\u00f8rst"
      : "Placering: h\u00f8jest f\u00f8rst";
}

function getResultsText(filteredCount, visibleCount) {
  const baseText =
    visibleCount < filteredCount
      ? `Viser ${visibleCount} af ${filteredCount} podcasts.`
      : `Viser ${filteredCount} podcasts ud af ${state.podcasts.length}.`;

  if (!state.activeFilter) return baseText;

  if (state.activeFilter.type === "saved") {
    return `${baseText} Filtreret p\u00e5 dine gemte podcasts.`;
  }

  const label = state.activeFilter.type === "genre" ? "genren" : "udgiveren";
  return `${baseText} Filtreret p\u00e5 ${label} ${state.activeFilter.value}.`;
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

  elements.loadMoreWrap.classList.remove("is-hidden");
  elements.loadMoreButton.textContent = `Vis resten (${remaining} tilbage)`;
}

function setImage(container, image, alt) {
  if (!container) return;

  const img = container.querySelector("img");
  const placeholder = container.querySelector(".image-placeholder");

  if (!img) return;

  const src = extractUrl(image);

  const showPlaceholder = () => {
    container.classList.add("has-no-image");
    img.hidden = true;
    img.removeAttribute("src");
    img.alt = "";
    if (placeholder) placeholder.hidden = false;
  };

  if (!src) {
    showPlaceholder();
    return;
  }

  container.classList.remove("has-no-image");
  img.hidden = false;
  img.src = src;
  img.alt = alt || "";
  img.loading = "lazy";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  if (placeholder) placeholder.hidden = true;
  img.onerror = showPlaceholder;
}

function showAuthPrompt(preferredAction = "signup") {
  if (!elements.authDialog) return;

  state.authMode = preferredAction === "login" ? "login" : "signup";

  if (elements.authDialogTitle) {
    elements.authDialogTitle.textContent =
      state.authMode === "login" ? "Log ind" : "Opret dig eller log ind";
  }

  clearAuthMessage();
  elements.authDialog.classList.remove("is-hidden");
  elements.authDialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("has-dialog-open");

  window.setTimeout(() => {
    elements.authEmail?.focus();
  }, 40);
}

function closeAuthDialog() {
  if (!elements.authDialog) return;

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
  if (!elements.authPassword) return;

  elements.authPassword.type = elements.authPassword.type === "password" ? "text" : "password";
  updateAuthPasswordToggle();
}

function renderAuthPanel() {
  const configured = state.authConfigured;
  const loggedIn = isLoggedIn();

  elements.authLoggedOut?.classList.toggle("is-hidden", loggedIn);
  elements.authLoggedIn?.classList.toggle("is-hidden", !loggedIn);

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
  return state.communityStatsByKey[podcastKey] || null;
}

function getUserRating(podcastKey) {
  return state.userRatingsByKey[podcastKey] || null;
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
        autoRefreshToken: true
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

  state.supabase.auth.onAuthStateChange(async (_event, sessionUpdate) => {
    state.session = sessionUpdate;
    state.authUser = sessionUpdate?.user || null;
    clearAuthMessage();
    renderAuthPanel();
    await refreshSupabaseState();
  });
}

async function handleAuthAction(mode) {
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

  try {
    if (mode === "signup") {
      const { data, error } = await state.supabase.auth.signUp({
        email,
        password
      });

      if (error) throw error;

      if (data.session) {
        setAuthMessage("Din konto er oprettet, og du er nu logget ind.", "success", "hero");
        closeAuthDialog();
      } else {
        setAuthMessage(
          "Kontoen er oprettet. Hvis du vil logge ind med det samme uden mail, så slå Confirm email fra i Supabase.",
          "warning",
          "dialog"
        );
      }
    } else {
      const { error } = await state.supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      setAuthMessage("Du er nu logget ind.", "success", "hero");
      closeAuthDialog();
    }

    if (elements.authPassword) {
      elements.authPassword.value = "";
      elements.authPassword.type = "password";
    }
    updateAuthPasswordToggle();
  } catch (error) {
    console.error(error);
    setAuthMessage(normalizeAuthErrorMessage(error), "error", "dialog");
  } finally {
    setAuthBusy(false);
    renderAuthPanel();
  }
}

async function requestPasswordReset() {
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
  if (!state.supabase) return;

  setAuthBusy(true);

  try {
    const { error } = await state.supabase.auth.signOut();
    if (error) throw error;
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

    await refreshSupabaseState();
    elements.ratingDeleteButton?.classList.remove("is-hidden");
    if (elements.ratingSaveButton) {
      elements.ratingSaveButton.textContent = "Opdater vurdering";
    }
    updateRatingDialogMessage("Din vurdering er gemt.", "success");
    setAuthMessage("Din vurdering er gemt.", "success");
  } catch (error) {
    console.error(error);
    updateRatingDialogMessage(error.message || "Kunne ikke gemme vurderingen.", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function deleteActiveRating() {
  if (!state.supabase || !state.authUser || !state.activeRatingKey) return;

  setAuthBusy(true);
  updateRatingDialogMessage("");

  try {
    const { error } = await state.supabase
      .from("user_ratings")
      .delete()
      .eq("user_id", state.authUser.id)
      .eq("podcast_key", state.activeRatingKey);

    if (error) throw error;

    await refreshSupabaseState();
    if (elements.ratingInput) {
      elements.ratingInput.value = "";
    }
    elements.ratingDeleteButton?.classList.add("is-hidden");
    if (elements.ratingSaveButton) {
      elements.ratingSaveButton.textContent = "Gem vurdering";
    }
    updateRatingDialogMessage("Din vurdering er fjernet.", "success");
    setAuthMessage("Din vurdering er fjernet.", "success");
  } catch (error) {
    console.error(error);
    updateRatingDialogMessage(error.message || "Kunne ikke fjerne vurderingen.", "error");
  } finally {
    setAuthBusy(false);
  }
}

async function toggleSavedPodcast(podcast) {
  if (!isLoggedIn()) {
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
  const key = getPodcastKey(podcast);
  const communityStat = getCommunityStat(key);
  const userRating = getUserRating(key);

  if (ownerValue) {
    ownerValue.textContent = podcast.ratingLabel || "Ikke vurderet";
  }

  if (ownerStars) {
    ownerStars.textContent = getStarString(podcast.ratingValue);
  }

  if (communityLabel) {
    communityLabel.textContent = "Brugernes snit";
  }

  if (communitySummary) {
    delete communitySummary.dataset.userRating;
    communitySummary.removeAttribute("tabindex");
    communitySummary.removeAttribute("aria-label");

    if (userRating !== null && userRating !== undefined) {
      const userRatingText = `Din vurdering: ${formatRating(userRating)}`;
      communitySummary.dataset.userRating = userRatingText;
      communitySummary.setAttribute("tabindex", "0");
      communitySummary.setAttribute("aria-label", `Brugernes snit. ${userRatingText}`);
    }
  }

  if (communityValue) {
    communityValue.textContent =
      communityStat?.averageRating !== null && communityStat?.averageRating !== undefined
        ? formatRating(communityStat.averageRating)
        : "Ingen endnu";
  }

  if (communityStars) {
    const hasCommunityRating =
      communityStat?.averageRating !== null && communityStat?.averageRating !== undefined;

    communityStars.textContent = getStarString(
      hasCommunityRating ? communityStat.averageRating : null,
      !hasCommunityRating
    );
    communityStars.classList.toggle("is-muted", !hasCommunityRating);
  }

  if (communityMeta) {
    if (communityStat?.ratingCount) {
      communityMeta.textContent = formatUserRatingCount(communityStat.ratingCount);
    } else if (isLoggedIn()) {
      communityMeta.textContent =
        userRating !== null && userRating !== undefined
          ? "Din vurdering er gemt"
          : "Vær den første til at vurdere";
    } else {
      communityMeta.textContent = "Log ind for at stemme";
    }
  }
}

function createPodcastReviewCardElement(podcast, review, key) {
  const article = document.createElement("article");
  article.className = "podcast-card podcast-card--review";
  article.dataset.key = key;

  const placement = document.createElement("div");
  placement.className = "podcast-card__placement";
  placement.innerHTML = `
    <span class="placement-value">#${podcast.placement}</span>
    <span class="placement-label">Placering</span>
  `;

  const body = document.createElement("div");
  body.className = "podcast-card__body";

  const head = document.createElement("div");
  head.className = "review-card__head";

  const cover = document.createElement("div");
  cover.className = "review-card__cover";
  cover.innerHTML = `<img alt="" loading="lazy" />`;

  const coverImg = cover.querySelector("img");
  if (review.image || podcast.image) {
    coverImg.src = review.image || podcast.image;
  }
  coverImg.alt = review.title || podcast.title || "";
  coverImg.onerror = () => {
    cover.classList.add("has-no-image");
    coverImg.hidden = true;
    coverImg.removeAttribute("src");
  };

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

  article.dataset.key = key;

  placement.innerHTML = `
    <span class="placement-value">#${podcast.placement}</span>
    <span class="placement-label">Placering</span>
  `;

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
      elements.featuredImage.src = review.image;
      elements.featuredImage.alt = review.title || "";
      elements.featuredImage.hidden = false;
      elements.featuredImage.onerror = () => {
        elements.featuredImage.hidden = true;
        elements.featuredImage.removeAttribute("src");
      };
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
  renderRecent();
  renderPodcastGrid();
  renderFeaturedReview();
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
    normalizeRatingInputField();
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
  elements.toggleAuthPasswordButton?.addEventListener("click", toggleAuthPasswordVisibility);
  elements.forgotPasswordButton?.addEventListener("click", requestPasswordReset);

  const authForm = elements.authDialog?.querySelector(".auth-form");
  authForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    handleAuthAction(state.authMode === "login" ? "login" : "signup");
  });

  if (elements.clearFilterButton) {
    elements.clearFilterButton.addEventListener("click", clearActiveFilter);
  }

  if (elements.activeFilterPill) {
    elements.activeFilterPill.addEventListener("click", clearActiveFilter);
  }

  if (elements.podcastGrid) {
    elements.podcastGrid.addEventListener("click", handlePodcastGridClick);
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

    if (button?.id === "signupButton") {
      handleAuthAction("signup");
      return;
    }

    if (button?.id === "loginButton") {
      handleAuthAction("login");
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

        target.textContent = "blokeret i denne browser";
        window.clearInterval(interval);
      }
    }, 250);
}

function runSecondaryStartup() {
  initSupabase();
  loadVisitorCount();
}

ensureLoadMoreControls();
setupEvents();
updateAuthPasswordToggle();
window.setTimeout(() => {
  clearSearchInput({ rerender: true });
}, 120);
loadPodcasts();

if ("requestIdleCallback" in window) {
  window.requestIdleCallback(runSecondaryStartup, { timeout: 1500 });
} else {
  window.setTimeout(runSecondaryStartup, 400);
}

