const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

const JSON_DATA_URL = "data/podcasts.json";

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

const state = {
  podcasts: [],
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
  const cleaned = normalizeText(value)
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const number = Number.parseFloat(cleaned);
  return Number.isFinite(number) ? number : null;
}

function formatRating(value) {
  const rating = parseNumber(value);

  if (rating === null) {
    return "";
  }

  return `${rating.toFixed(1).replace(".", ",")} / 10`;
}

function parsePlacement(value) {
  const number = parseNumber(value);
  return number === null ? null : number;
}

function parseDate(value) {
  const raw = normalizeText(value);

  if (!raw) {
    return null;
  }

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

  if (!date) {
    return "";
  }

  return new Intl.DateTimeFormat("da-DK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function normalizeGenre(value) {
  const raw = normalizeComparable(value);

  if (!raw) {
    return "Dokumentar";
  }

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

  if (
    raw.includes("historie") ||
    raw.includes("historisk") ||
    raw.includes("fortid") ||
    raw.includes("krig")
  ) {
    return "Historie";
  }

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
  ) {
    return "Samfund";
  }

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
  ) {
    return "Sport";
  }

  if (
    raw.includes("viden") ||
    raw.includes("science") ||
    raw.includes("forskning") ||
    raw.includes("læring") ||
    raw.includes("videnskab")
  ) {
    return "Viden";
  }

  if (raw.includes("sladder") || raw.includes("gossip")) {
    return "Sladder";
  }

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
  ) {
    return "Underholdning";
  }

  if (
    raw.includes("dokumentar") ||
    raw.includes("dokimentar") ||
    raw.includes("portræt") ||
    raw.includes("drama") ||
    raw.includes("tv & film")
  ) {
    return "Dokumentar";
  }

  return "Dokumentar";
}

function normalizePublisher(value) {
  const original = normalizeText(value);

  if (!original) {
    return "";
  }

  const raw = normalizeComparable(original)
    .replace(/\./g, "")
    .replace(/\s*\/\s*/g, "/");

  const compact = raw.replace(/\s+/g, "");

  if (
    raw === "eb" ||
    raw === "eb+" ||
    raw === "ekstrabladet" ||
    raw === "ekstra bladet"
  ) {
    return "Ekstra Bladet";
  }

  if (
    raw === "radio llll" ||
    raw === "radio iiii" ||
    raw === "radio4" ||
    raw === "radio4 (krimiland)"
  ) {
    return "RADIO IIII";
  }

  if (raw === "r8dio") {
    return "r8dio";
  }

  if (compact === "radio24syv" || compact === "radio24/7") {
    return "Radio24syv";
  }

  if (compact === "24syv" || compact === "24/syv") {
    return "24syv";
  }

  if (raw === "dr" || raw === "dr lyd" || raw === "p1") {
    return "DR";
  }

  if (raw === "politikken" || raw === "politiken") {
    return "Politiken";
  }

  if (raw === "bold" || raw === "bolddk") {
    return "Bold.dk";
  }

  if (raw === "fc købenahvn" || raw === "fc københavn") {
    return "F.C. København";
  }

  if (raw === "den uafhængige" || raw === "den uafhaengige") {
    return "Den Uafhængige";
  }

  if (raw === "podimo" || raw === "podimo/tv2") {
    return "Podimo";
  }

  if (raw === "media o") {
    return "Mediano";
  }

  if (raw === "jyllands-posten/politiken" || raw === "jyllands posten/politiken") {
    return "Jyllands-Posten / Politiken";
  }

  if (raw === "third ear") {
    return "Third Ear";
  }

  if (raw === "third ear/zetland") {
    return "Third Ear / Zetland";
  }

  if (raw === "bt") {
    return "BT";
  }

  if (raw === "zetland") {
    return "Zetland";
  }

  if (raw === "frihedsbrevet") {
    return "Frihedsbrevet";
  }

  if (raw === "mediano") {
    return "Mediano";
  }

  if (raw === "altinget") {
    return "Altinget";
  }

  if (raw === "berlingske") {
    return "Berlingske";
  }

  if (raw === "weekendavisen") {
    return "Weekendavisen";
  }

  if (raw === "mofibo") {
    return "Mofibo";
  }

  if (raw === "saga talks") {
    return "Saga Talks";
  }

  if (raw === "loud") {
    return "Loud";
  }

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
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }

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
  if (!rows.length) {
    return [];
  }

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
    link,
    ratingDate,
    ratingDateObject: parseDate(ratingDate),
    ratingDateLabel: formatDate(ratingDate),
    image,
    description,
    placement: placement ?? index + 1,
    searchText: [
      title,
      host,
      rawGenre,
      genre,
      rawPublisher,
      publisher,
      episodes,
      link,
      ratingDate,
      description,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function isUsefulPodcast(podcast) {
  return Boolean(podcast.title);
}

function isActiveGenre(genre) {
  if (genre === "Alle") {
    return !state.activeFilter;
  }

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
      if (state.activeFilter?.type === "genre" && podcast.genre !== state.activeFilter.value) {
        return false;
      }

      if (
        state.activeFilter?.type === "publisher" &&
        podcast.publisher !== state.activeFilter.value
      ) {
        return false;
      }

      if (!state.searchTerm) {
        return true;
      }

      return podcast.searchText.includes(state.searchTerm.toLowerCase());
    })
    .sort((a, b) => {
      if (state.sort === "placement-desc") {
        return b.placement - a.placement;
      }

      return a.placement - b.placement;
    });
}

function updateActiveFilterUi() {
  if (!elements.activeFilterBox || !elements.activeFilterText) {
    return;
  }

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
  if (!elements.sortToggle) {
    return;
  }

  elements.sortToggle.textContent =
    state.sort === "placement-asc"
      ? "Placering: lavest først"
      : "Placering: højest først";
}

function getResultsText(filtered) {
  const countText = `Viser ${filtered.length} podcasts ud af ${state.podcasts.length}.`;

  if (!state.activeFilter) {
    return countText;
  }

  const label = state.activeFilter.type === "genre" ? "genren" : "udgiveren";

  return `${countText} Filtreret på ${label} ${state.activeFilter.value}.`;
}

function setImage(container, image, alt) {
  const img = container.querySelector("img");

  if (!img) {
    return;
  }

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
  const fragment = elements.podcastTemplate.content.cloneNode(true);

  const placement = fragment.querySelector(".podcast-card__placement");
  const rating = fragment.querySelector(".podcast-card__rating");
  const media = fragment.querySelector(".podcast-card__media");
  const title = fragment.querySelector(".podcast-card__title");
  const host = fragment.querySelector(".podcast-card__host");
  const description = fragment.querySelector(".podcast-card__description");
  const linkButton = fragment.querySelector(".podcast-card__link");
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

function render() {
  updateActiveFilterUi();
  updateSortToggleUi();
  renderRecent();
  renderPodcastGrid();
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

async function loadPodcasts() {
  try {
    let objects;

    try {
      objects = await loadPodcastObjectsFromJson();
    } catch (jsonError) {
      objects = await loadPodcastObjectsFromCsv();
    }

    state.podcasts = objects.map(mapPodcast).filter(isUsefulPodcast);

    createGenreChips();
    render();
  } catch (error) {
    elements.resultsText.textContent =
      "Kunne ikke indlæse podcasts. Tjek data/podcasts.json eller Google Sheets-linket.";
    elements.podcastGrid.innerHTML = "";
  }
}

function loadVisitorCount() {
  const target = document.getElementById("goatcounter-visits");

  if (!target) {
    return;
  }

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

  if (renderCount()) {
    return;
  }

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
