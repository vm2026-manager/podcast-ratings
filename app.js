const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

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

const state = {
  podcasts: [],
  allReviews: [],
  featuredReviews: [],
  featuredReviewByKey: {},
  openReviewKeys: new Set(),
  featuredIndex: 0,
  featured
