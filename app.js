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
const LOAD_MORE_STEP = 48;
const DATA_VERSION = "2026-05-18-1";

const state = {
  podcasts: [],
  podcastByKey: {},
  allReviews: [],
  featuredReviews: [],
  featuredReviewByKey: {},
  openReviewKeys: new Set(),
  featuredIndex: 0,
  featuredTimer: null,
  activeFilter: null,
  searchTerm: "",
  sort: "placement-asc",
  visibleCount: INITIAL_VISIBLE_COUNT
};

const elements = {
  genreChips: document.getElementById("genreChips"),
  searchInput: document.getElementById("searchInput"),
  sortToggle: document.getElementById("sortToggle"),
  resultsText: document.getElementById("resultsText"),
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
    .replace(/[^a-z0-9æøå ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
