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
  "Sladder",
];

const FEATURED_ROTATION_MS = 8000;

const state = {
  podcasts: [],
  featuredReviews: [],
  featuredReviewByKey: {},
  openReviewKeys: new Set(),
  featuredIndex: 0,
  featuredTimer: null,
  activeFilter: null,
  searchTerm: "",
  sort: "placement-asc",
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
};

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

function normalizeSearchValue(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " og ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
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
      "247",
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
      "r4dio",
      "radio iiii krimiland",
      "radio4 krimiland",
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
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

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
  if (rating === null) return "";
  return `${rating.toFixed(1).replace(".", ",")} / 10`;
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
    if (!Number.isNaN(date.getTime())) return date;
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
    year: "numeric",
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
  ) return "True Crime";

  if (
    raw.includes("historie") ||
    raw.includes("historisk") ||
    raw.includes("fortid") ||
    raw.includes("krig")
  ) return "Historie";

  if (
    raw.includes("samfund") ||
    raw.includes("politik") ||
    raw.includes("nyhed") ||
    raw.includes("nyhe") ||
    raw.includes("debat") ||
    raw.includes("aktualitet") ||
    raw.includes("krise") ||
    raw.includes("erhverv") ||
    raw.includes("mediemagasin") ||
    raw.includes("sundhed") ||
    raw.includes("skandaler") ||
    raw.includes("kultur")
  ) return "Samfund";

  if (
    raw.includes("sport") ||
    raw.includes("fodbold") ||
    raw.includes("superliga") ||
    raw.includes("bold") ||
    raw.includes("cykling") ||
    raw.includes("cykel") ||
    raw.includes("tour de france") ||
    raw.includes("giro") ||
    raw.includes("vuelta")
  ) return "Sport";

  if (
    raw.includes("viden") ||
    raw.includes("science") ||
    raw.includes("forskning") ||
    raw.includes("læring") ||
    raw.includes("videnskab")
  ) return "Viden";

  if (raw.includes("sladder") || raw.includes("gossip")) return "Sladder";

  if (
    raw.includes("underholdning") ||
    raw.includes("unholdning") ||
    raw.includes("komedie") ||
    raw.includes("humor") ||
    raw.includes("comedy") ||
    raw.includes("snakke") ||
    raw.includes("snak") ||
    raw.includes("kærlighed") ||
    raw.includes("dating")
  ) return "Underholdning";

  if (
    raw.includes("dokumentar") ||
    raw.includes("dokimentar") ||
    raw.includes("portræt") ||
    raw.includes("drama") ||
    raw.includes("tv & film")
  ) return "Dokumentar";

  return "Dokumentar";
}

function normalizePublisher(value) {
  const original = normalizeText(value);
  if (!original) return "";

  const raw = normalizeComparable(original)
    .replace(/\./g, "")
    .replace(/\s*\/\s*/g, "/");

  const compact = raw.replace(/\s+/g, "");

  if (
    raw === "eb" ||
    raw === "eb+" ||
    raw === "ekstrabladet" ||
    raw === "ekstra bladet"
  ) return "Ekstra Bladet";

  if (
    raw === "radio llll" ||
    raw === "radio iiii" ||
    raw === "radio4" ||
    raw === "radio4 (krimiland)"
  ) return "RADIO IIII";

  if (raw === "r8dio") return "r8dio";
  if (compact === "radio24syv" || compact === "radio24/7") return "Radio24syv";
  if (compact === "24syv" || compact === "24/syv") return "24syv";
  if (raw === "dr" || raw === "dr lyd" || raw === "p1") return "DR";
  if (raw === "politikken" || raw === "politiken") return "Politiken";
  if (raw === "bold" || raw === "bolddk") return "Bold.dk";
  if (raw === "fc købenahvn" || raw === "fc københavn") return "F.C. København";
  if (raw === "den uafhængige" || raw === "den uafhaengige") return "Den Uafhængige";
  if (raw === "podimo" || raw === "podimo/tv2") return "Podimo";
  if (raw === "media o") return "Mediano";
  if (raw === "third ear") return "Third Ear";
  if (raw === "third ear/zetland") return "Third Ear / Zetland";
  if (raw === "bt") return "BT";
  if (raw === "zetland") return "Zetland";
  if (raw === "frihedsbrevet") return "Frihedsbrevet";
  if (raw === "mediano") return "Mediano";
  if (raw === "altinget") return "Altinget";
  if (raw === "berlingske") return "Berlingske";
  if (raw === "weekendavisen") return "Weekendavisen";
  if (raw === "mofibo") return "Mofibo";
  if (raw === "saga talks") return "Saga Talks";
  if (raw === "loud") return "Loud";

  return original;
}

function parseCsv(text) {
  const rows = [];
  let currentRow = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i += 1;
      currentRow.push(currentCell);

      if (currentRow.some((cell) => normalizeText(cell) !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  if (currentRow.some((cell) => normalizeText(cell) !== "")) {
    rows.push(currentRow);
  }

  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];

  const headers = rows[0].map((header) => normalizeText(header));

  return rows.slice(1).map((row) => {
    const item = {};

    headers.forEach((header, index) => {
      item[header] = normalizeText(row[index] || "");
    });

    return item;
  });
}

function mapPodcast(row, index) {
  const title = getField(row, ["Titel", "Title"]);
  const host = getField(row, ["Vært", "Vaert", "Host", "Værter"]);
  const rawRating = getField(row, [
    "Vuring",
    "Vuring (1-10)",
    "Vurdering",
    "Vurdering (1-10)",
    "Vuring/Vurdering",
    "Vuring/Vurdering (1-10)",
    "Rating",
    "Score",
  ]);
  const rawGenre = getField(row, ["Genre"]);
  const rawPublisher = getField(row, ["Udgiver", "Publisher"]);
  const episodes = getField(row, ["Antal afsnit", "Afsnit", "Episodes"]);
  const yearPlayed = getField(row, ["Årstal afspillet", "Aarstal afspillet", "År", "Aar"]);
  const link = getField(row, ["Link", "URL"]);
  const ratingDate = getField(row, [
    "Afgivet vurdering",
    "Dato",
    "Vurderingsdato",
    "Bedømt",
  ]);
  const image = getField(row, [
    "Billedlink",
    "Billedefil",
    "Billede",
    "Cover",
    "Image",
  ]);
  const description = getField(row, [
    "Kort beskrivelse",
    "Kortbeskrivelse",
    "Beskrivelse",
    "Description",
  ]);
  const placement = parsePlacement(
    getField(row, ["Placering", "Rank", "Rangering"])
  );

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
      ratingDate,
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
      description,
    ]),
  };
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

function deduplicatePodcasts(podcasts) {
  const grouped = new Map();

  podcasts.forEach((podcast) => {
    const key = normalizeMatchKey(podcast.title);
    if (!key) return;

    if (!grouped.has(key)) grouped.set(key, []);
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
    "Fortæller",
    "Fortaeller",
    "Vært/formidling",
    "Vaert/formidling",
  ]);
  const sound = getField(row, ["Lydside", "Produktion"]);
  const relevance = getField(row, [
    "Aktualitet",
    "Aktualitet/relevans",
    "Relevans",
  ]);

  const score = getField(row, ["Samlet score"]);
  const reviewDate = getField(row, ["Anmeldelsesdato", "Anmeldelsesdat", "Anmeldt"]);
  const displayOrder = parsePlacement(getField(row, ["Visningsrækkefølge"]));
  const autoPublisher = getField(row, ["Auto-udgiver"]);
  const autoLink = getField(row, ["Auto-link"]);
  const autoImage = getField(row, ["Auto-billedlink"]);
  const autoGenre = getField(row, ["Auto-genre"]);
  const autoHost = getField(row, ["Auto-vært", "Auto-vaert"]);

  const matchedPodcast = podcastLookup[normalizeMatchKey(matchTitle)] || null;

  return {
    active,
    title: title || matchedPodcast?.title || matchTitle,
    matchTitle,
    review,
    score,
    scoreLabel: formatRating(score),
    reviewDate,
    reviewDateLabel: formatFeaturedDate(reviewDate),
    displayOrder: displayOrder ?? index + 1,
    publisher: normalizePublisher(autoPublisher || matchedPodcast?.publisher || ""),
    link: autoLink || matchedPodcast?.link || "",
    image: autoImage || matchedPodcast?.image || "",
    genre: normalizeGenre(autoGenre || matchedPodcast?.genre || ""),
    host: autoHost || matchedPodcast?.host || "",
    params: [
      { label: "Historie", value: story },
      { label: "Fortæller", value: narrator },
      { label: "Lydside", value: sound },
      { label: "Aktualitet", value: relevance },
    ],
  };
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

function isActiveGenre(genre) {
  if (genre === "Alle") return !state.activeFilter;
  return state.activeFilter?.type === "genre" && state.activeFilter.value === genre;
}

function setActiveFilter(type, value) {
  if (!type || !value) {
    state.activeFilter = null;
  } else {
    state.activeFilter = { type, value };
  }

  createGenreChips();
  render();
}

function clearActiveFilter() {
  setActiveFilter(null, null);
}

function createGenreChips() {
  elements.genreChips.innerHTML = "";

  GENRES.forEach((genre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "genre-chip";
    button.textContent = genre;

    if (isActiveGenre(genre)) button.classList.add("active");

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
      if (state.activeFilter?.type === "genre" && podcast.genre !== state.activeFilter.value) {
        return false;
      }

      if (
        state.activeFilter?.type === "publisher" &&
        podcast.publisher !== state.activeFilter.value
      ) {
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
      if (state.sort === "placement-desc") return b.placement - a.placement;
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

  const label = state.activeFilter.type === "genre" ? "Genre" : "Udgiver";
  elements.activeFilterText.textContent = `${label}: ${state.activeFilter.value}`;
  elements.activeFilterBox.classList.remove("is-hidden");
}

function updateSortToggleUi() {
  if (!elements.sortToggle) return;

  elements.sortToggle.textContent =
    state.sort === "placement-asc"
      ? "Placering: lavest først"
      : "Placering: højest først";
}

function getResultsText(filtered) {
  const countText = `Viser ${filtered.length} podcasts ud af ${state.podcasts.length}.`;

  if (!state.activeFilter) return countText;

  const label = state.activeFilter.type === "genre" ? "genren" : "udgiveren";
  return `${countText} Filtreret på ${label} ${state.activeFilter.value}.`;
}

function setImage(container, image, alt) {
  const img = container.querySelector("img");
  if (!img) return;

  img.alt = alt || "";

  if (image) {
    container.classList.remove("has-no-image");
    img.src = image;
  } else {
    container.classList.add("has-no-image");
    img.removeAttribute("src");
  }
}

function renderRecent() {
  const recent = [...state.podcasts]
    .filter((podcast) => podcast.ratingDateObject)
    .sort((a, b) => b.ratingDateObject - a.ratingDateObject)
    .slice(0, 3);

  elements.recentGrid.innerHTML = "";

  if (elements.recentSummary) {
    elements.recentSummary.textContent = `Viser de ${recent.length} seneste bedømmelser`;
  }

  recent.forEach((podcast) => {
    const fragment = elements.recentTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".recent-card");
    const cover = fragment.querySelector(".recent-cover-wrap");
    const title = fragment.querySelector(".recent-title");
    const host = fragment.querySelector(".recent-host");
    const rating = fragment.querySelector(".recent-rating");
    const date = fragment.querySelector(".recent-date");

    setImage(cover, podcast.image, podcast.title);

    title.textContent = podcast.title;
    host.textContent = podcast.host || podcast.publisher || "";
    rating.textContent = podcast.ratingLabel || "Ikke vurderet";
    date.textContent = podcast.ratingDateLabel
      ? `Bedømt ${podcast.ratingDateLabel}`
      : "";

    card.addEventListener("click", () => {
      if (podcast.link) {
        window.open(podcast.link, "_blank", "noopener,noreferrer");
      }
    });

    elements.recentGrid.appendChild(fragment);
  });
}

function renderPodcastCard(podcast) {
  const review = getReviewForPodcast(podcast);
  const key = getPodcastKey(podcast);

  if (review && state.openReviewKeys.has(key)) {
    return renderPodcastReviewCard(podcast, review, key);
  }

  const fragment = elements.podcastTemplate.content.cloneNode(true);

  const placement = fragment.querySelector(".podcast-card__placement");
  const rating = fragment.querySelector(".podcast-card__rating");
  const media = fragment.querySelector(".podcast-card__media");
  const title = fragment.querySelector(".podcast-card__title");
  const host = fragment.querySelector(".podcast-card__host");
  const description = fragment.querySelector(".podcast-card__description");
  const linkButton = fragment.querySelector(".podcast-card__link");
  const reviewButton = fragment.querySelector(".podcast-card__review");
  const chips = fragment.querySelector(".podcast-card__chips");

  placement.innerHTML = `
    <span class="placement-value">#${podcast.placement}</span>
    <span class="placement-label">Placering</span>
  `;

  rating.textContent = podcast.ratingLabel || "Ikke vurderet";
  setImage(media, podcast.image, podcast.title);

  title.textContent = podcast.title;
  host.textContent = podcast.host || "";
  description.textContent = podcast.description || "";

  if (podcast.link) {
    linkButton.classList.remove("is-hidden");
    linkButton.addEventListener("click", () => {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    });
  } else {
    linkButton.classList.add("is-hidden");
  }

  if (review) {
    reviewButton.classList.remove("is-hidden");
    reviewButton.addEventListener("click", () => {
      state.openReviewKeys.add(key);
      renderPodcastGrid();
    });
  } else {
    reviewButton.classList.add("is-hidden");
  }

  const publisherChip = document.createElement("button");
  publisherChip.type = "button";
  publisherChip.className = "podcast-chip";
  publisherChip.textContent = podcast.publisher || "Ukendt";
  publisherChip.title = `Vis podcasts fra ${podcast.publisher || "Ukendt"}`;
  publisherChip.addEventListener("click", () => {
    if (podcast.publisher) {
      setActiveFilter("publisher", podcast.publisher);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  const genreChip = document.createElement("button");
  genreChip.type = "button";
  genreChip.className = "podcast-chip";
  genreChip.textContent = podcast.genre || "Dokumentar";
  genreChip.title = `Vis podcasts i genren ${podcast.genre || "Dokumentar"}`;
  genreChip.addEventListener("click", () => {
    if (podcast.genre) {
      setActiveFilter("genre", podcast.genre);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  });

  const episodesChip = document.createElement("span");
  episodesChip.className = "podcast-chip podcast-chip--episodes";
  episodesChip.textContent = podcast.episodes || "—";

  chips.append(publisherChip, genreChip, episodesChip);

  return fragment;
}

function renderPodcastReviewCard(podcast, review, key) {
  const article = document.createElement("article");
  article.className = "podcast-card podcast-card--review";

  const placement = document.createElement("div");
  placement.className = "podcast-card__placement";
  placement.innerHTML = `
    <span class="placement-value">#${podcast.placement}</span>
    <span class="placement-label">Placering</span>
  `;

  const rating = document.createElement("div");
  rating.className = "podcast-card__rating";
  rating.textContent = review.scoreLabel || podcast.ratingLabel || "Ikke vurderet";

  const body = document.createElement("div");
  body.className = "podcast-card__body";

  const mediaColumn = document.createElement("div");
  mediaColumn.className = "podcast-card__media-column";

  const media = document.createElement("div");
  media.className = "podcast-card__media cover-wrap";
  media.innerHTML = `
    <img class="podcast-image" alt="" loading="lazy" />
    <div class="image-placeholder" aria-hidden="true">
      <span class="image-placeholder-icon">▢</span>
      <span class="image-placeholder-label">Billede mangler</span>
    </div>
  `;
  setImage(media, review.image || podcast.image, review.title || podcast.title);

  const actions = document.createElement("div");
  actions.className = "podcast-card__actions";

  const linkButton = document.createElement("button");
  linkButton.className = "podcast-card__link";
  linkButton.type = "button";
  linkButton.textContent = "Åbn link";

  if (review.link || podcast.link) {
    linkButton.addEventListener("click", () => {
      window.open(review.link || podcast.link, "_blank", "noopener,noreferrer");
    });
  } else {
    linkButton.classList.add("is-hidden");
  }

  const backButton = document.createElement("button");
  backButton.className = "review-card__back";
  backButton.type = "button";
  backButton.textContent = "Tilbage";
  backButton.addEventListener("click", () => {
    state.openReviewKeys.delete(key);
    renderPodcastGrid();
  });

  actions.append(linkButton, backButton);
  mediaColumn.append(media, actions);

  const content = document.createElement("div");
  content.className = "podcast-card__content";

  const meta = [review.publisher, review.genre].filter(Boolean).join(" / ");

  content.innerHTML = `
    <p class="review-card__eyebrow">Mads anmelder</p>
    <h3 class="review-card__title">${escapeHtml(review.title || podcast.title)}</h3>
    <p class="review-card__meta">${escapeHtml(review.host || podcast.host || "")}${meta ? " · " + escapeHtml(meta) : ""}</p>
    <p class="review-card__date">${escapeHtml(review.reviewDateLabel || "")}</p>
    <p class="review-card__text">${escapeHtml(review.review || "")}</p>
    <p class="review-card__heading">Vurderet på parametre</p>
    <div class="review-card__params"></div>
  `;

  const params = content.querySelector(".review-card__params");

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

  body.append(mediaColumn, content);

  const footer = document.createElement("div");
  footer.className = "podcast-card__footer";

  const chips = document.createElement("div");
  chips.className = "podcast-card__chips";

  [
    review.publisher || podcast.publisher || "Ukendt",
    review.genre || podcast.genre || "Dokumentar",
    podcast.episodes || "—",
  ].forEach((value) => {
    const chip = document.createElement("span");
    chip.className = "podcast-chip";
    chip.textContent = value;
    chips.appendChild(chip);
  });

  footer.appendChild(chips);
  article.append(placement, rating, body, footer);

  return article;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPodcastGrid() {
  const filtered = getFilteredPodcasts();

  elements.podcastGrid.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Ingen podcasts matcher filtreringen.";
    elements.podcastGrid.appendChild(empty);
  } else {
    filtered.forEach((podcast) => {
      elements.podcastGrid.appendChild(renderPodcastCard(podcast));
    });
  }

  elements.resultsText.textContent = getResultsText(filtered);
}

function renderFeaturedReview() {
  if (!elements.featuredPanel) return;

  if (!state.featuredReviews.length) {
    elements.featuredPanel.classList.add("is-hidden");
    return;
  }

  const review = state.featuredReviews[state.featuredIndex % state.featuredReviews.length];

  elements.featuredPanel.classList.remove("is-hidden");
  elements.featuredTitle.textContent = review.title || "";
  elements.featuredMeta.textContent = [review.publisher, review.genre].filter(Boolean).join(" / ");
  elements.featuredScore.textContent = review.scoreLabel || formatRating(review.score) || "Ikke vurderet";

  if (elements.featuredDate) {
    elements.featuredDate.textContent = review.reviewDateLabel || "";
  }

  elements.featuredText.textContent = review.review || "";

  if (review.image) {
    elements.featuredImage.src = review.image;
    elements.featuredImage.alt = review.title || "";
  } else {
    elements.featuredImage.removeAttribute("src");
    elements.featuredImage.alt = "";
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
      state.featuredIndex = index;
      renderFeaturedReview();
      restartFeaturedRotation();
    });

    elements.featuredDots.appendChild(dot);
  });
}

function startFeaturedRotation() {
  if (state.featuredTimer) {
    window.clearInterval(state.featuredTimer);
  }

  if (state.featuredReviews.length <= 1) return;

  state.featuredTimer = window.setInterval(() => {
    state.featuredIndex = (state.featuredIndex + 1) % state.featuredReviews.length;
    renderFeaturedReview();
  }, FEATURED_ROTATION_MS);
}

function restartFeaturedRotation() {
  startFeaturedRotation();
}

function render() {
  updateActiveFilterUi();
  updateSortToggleUi();
  renderRecent();
  renderPodcastGrid();
  renderFeaturedReview();
}

function setupEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim();
    render();
  });

  if (elements.sortToggle) {
    elements.sortToggle.addEventListener("click", () => {
      state.sort =
        state.sort === "placement-asc" ? "placement-desc" : "placement-asc";
      render();
    });
  }

  if (elements.clearFilterButton) {
    elements.clearFilterButton.addEventListener("click", clearActiveFilter);
  }

  if (elements.activeFilterPill) {
    elements.activeFilterPill.addEventListener("click", clearActiveFilter);
  }
}

async function loadPodcastObjectsFromJson() {
  const response = await fetch(`${JSON_DATA_URL}?v=${Date.now()}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Kunne ikke hente lokal podcasts.json.");
  }

  const data = await response.json();

  if (!Array.isArray(data.rows)) {
    throw new Error("podcasts.json har ikke forventet format.");
  }

  return data.rows;
}

async function loadPodcastObjectsFromCsv() {
  const response = await fetch(DATA_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error("Kunne ikke hente Google Sheets-data.");
  }

  const csv = await response.text();
  const rows = parseCsv(csv);

  return rowsToObjects(rows);
}

async function loadFeaturedReviewObjects() {
  try {
    const response = await fetch(`${FEATURED_JSON_DATA_URL}?v=${Date.now()}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Kunne ikke hente featured-reviews.json.");
    }

    const data = await response.json();

    if (!Array.isArray(data.rows)) {
      throw new Error("featured-reviews.json har ikke forventet format.");
    }

    return data.rows;
  } catch (error) {
    console.warn("Udvalgte vurderinger blev ikke indlæst:", error);
    return [];
  }
}

function buildPodcastLookup(podcasts) {
  const lookup = {};

  podcasts.forEach((podcast) => {
    if (!podcast.title) return;
    lookup[normalizeMatchKey(podcast.title)] = podcast;
  });

  return lookup;
}

async function loadPodcasts() {
  try {
    let objects;

    try {
      objects = await loadPodcastObjectsFromJson();
    } catch (jsonError) {
      objects = await loadPodcastObjectsFromCsv();
    }

    const mappedPodcasts = objects.map(mapPodcast).filter(isUsefulPodcast);
    state.podcasts = deduplicatePodcasts(mappedPodcasts);

    const podcastLookup = buildPodcastLookup(state.podcasts);
    const featuredObjects = await loadFeaturedReviewObjects();

    state.featuredReviews = featuredObjects
      .map((row, index) => mapFeaturedReview(row, index, podcastLookup))
      .filter(isActiveFeatured)
      .sort((a, b) => a.displayOrder - b.displayOrder);

    state.featuredReviewByKey = buildFeaturedReviewLookup(state.featuredReviews);
    state.featuredIndex = 0;

    createGenreChips();
    render();
    startFeaturedRotation();
  } catch (error) {
    elements.resultsText.textContent =
      "Kunne ikke indlæse podcasts. Tjek data/podcasts.json eller Google Sheets-linket.";
    elements.podcastGrid.innerHTML = "";
  }
}

function loadVisitorCount() {
  const target = document.getElementById("goatcounter-visits");

  if (!target) return;

  target.textContent = "indlæser…";

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
          title: "Besøgstæller",
        },
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
      target.textContent = "ikke tilgængeligt";
      window.clearInterval(interval);
    }
  }, 250);
}

setupEvents();
loadPodcasts();
loadVisitorCount();
