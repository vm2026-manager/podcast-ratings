const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

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
  selectedGenre: "Alle",
  searchTerm: "",
  sort: "placement-asc",
};

const elements = {
  genreChips: document.getElementById("genreChips"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  resultsText: document.getElementById("resultsText"),
  podcastGrid: document.getElementById("podcastGrid"),
  recentGrid: document.getElementById("recentGrid"),
  recentSummary: document.getElementById("recentSummary"),
  podcastTemplate: document.getElementById("podcastCardTemplate"),
  recentTemplate: document.getElementById("recentCardTemplate"),
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
  const raw = normalizeText(value).toLowerCase();

  if (!raw) {
    return "Dokumentar";
  }

  if (
    raw.includes("true") ||
    raw.includes("crime") ||
    raw.includes("krimi") ||
    raw.includes("mord") ||
    raw.includes("forbryd")
  ) {
    return "True Crime";
  }

  if (
    raw.includes("historie") ||
    raw.includes("historisk") ||
    raw.includes("fortid")
  ) {
    return "Historie";
  }

  if (
    raw.includes("samfund") ||
    raw.includes("politik") ||
    raw.includes("nyhed") ||
    raw.includes("debat") ||
    raw.includes("aktualitet")
  ) {
    return "Samfund";
  }

  if (
    raw.includes("sport") ||
    raw.includes("fodbold") ||
    raw.includes("superliga") ||
    raw.includes("bold")
  ) {
    return "Sport";
  }

  if (
    raw.includes("viden") ||
    raw.includes("science") ||
    raw.includes("forskning") ||
    raw.includes("læring")
  ) {
    return "Viden";
  }

  if (
    raw.includes("underholdning") ||
    raw.includes("komedie") ||
    raw.includes("humor") ||
    raw.includes("comedy")
  ) {
    return "Underholdning";
  }

  if (
    raw.includes("sladder") ||
    raw.includes("kendt") ||
    raw.includes("celebrity") ||
    raw.includes("gossip")
  ) {
    return "Sladder";
  }

  return "Dokumentar";
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
  const rawRating = getField(row, ["Vuring", "Vurdering", "Rating", "Score"]);
  const rawGenre = getField(row, ["Genre"]);
  const publisher = getField(row, ["Udgiver", "Publisher"]);
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
  const placement = parsePlacement(
    getField(row, ["Placering", "Rank", "Rangering"])
  );

  return {
    id: `${title}-${index}`,
    title,
    host,
    rawRating,
    ratingValue: parseNumber(rawRating),
    ratingLabel: formatRating(rawRating),
    genre: normalizeGenre(rawGenre),
    publisher,
    episodes,
    link,
    ratingDate,
    ratingDateObject: parseDate(ratingDate),
    ratingDateLabel: formatDate(ratingDate),
    image,
    placement: placement ?? index + 1,
    searchText: [
      title,
      host,
      rawGenre,
      publisher,
      episodes,
      link,
      ratingDate,
    ]
      .join(" ")
      .toLowerCase(),
  };
}

function isUsefulPodcast(podcast) {
  return Boolean(podcast.title);
}

function createGenreChips() {
  elements.genreChips.innerHTML = "";

  GENRES.forEach((genre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "genre-chip";
    button.textContent = genre;

    if (genre === state.selectedGenre) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => {
      state.selectedGenre = genre;
      createGenreChips();
      render();
    });

    elements.genreChips.appendChild(button);
  });
}

function getFilteredPodcasts() {
  return state.podcasts
    .filter((podcast) => {
      if (state.selectedGenre !== "Alle" && podcast.genre !== state.selectedGenre) {
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

  if (podcast.link) {
    linkButton.classList.remove("is-hidden");
    linkButton.addEventListener("click", () => {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    });
  } else {
    linkButton.classList.add("is-hidden");
  }

  const publisherChip = document.createElement("span");
  publisherChip.className = "podcast-chip";
  publisherChip.textContent = podcast.publisher || "Ukendt";

  const genreChip = document.createElement("span");
  genreChip.className = "podcast-chip";
  genreChip.textContent = podcast.genre || "Dokumentar";

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

  elements.resultsText.textContent = `Viser ${filtered.length} podcasts ud af ${state.podcasts.length}.`;
}

function render() {
  renderRecent();
  renderPodcastGrid();
}

function setupEvents() {
  elements.searchInput.addEventListener("input", (event) => {
    state.searchTerm = event.target.value.trim();
    render();
  });

  elements.sortSelect.addEventListener("change", (event) => {
    state.sort = event.target.value;
    render();
  });
}

async function loadPodcasts() {
  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });

    if (!response.ok) {
      throw new Error("Kunne ikke hente Google Sheets-data.");
    }

    const csv = await response.text();
    const rows = parseCsv(csv);
    const objects = rowsToObjects(rows);

    state.podcasts = objects.map(mapPodcast).filter(isUsefulPodcast);

    createGenreChips();
    render();
  } catch (error) {
    elements.resultsText.textContent =
      "Kunne ikke indlæse podcasts. Tjek Google Sheets-linket.";
    elements.podcastGrid.innerHTML = "";
  }
}

function normalizeCounterValue(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return String(value).trim();
}

async function tryLoadGoatCounterUrl(url) {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const data = await response.json();

  return (
    normalizeCounterValue(data.count) ||
    normalizeCounterValue(data.count_unique) ||
    normalizeCounterValue(data.total)
  );
}

async function loadVisitorCount() {
  const target = document.getElementById("goatcounter-visits");

  if (!target) {
    return;
  }

  const base = "https://podcastratings.goatcounter.com/counter";
  const start = "2026-05-03";
  const paths = [
    "/podcast-ratings/",
    "/podcast-ratings/index.html",
    "TOTAL",
  ];

  const urls = paths.flatMap((path) => {
    const encodedPath = path === "TOTAL" ? "TOTAL" : encodeURIComponent(path);

    return [
      `${base}/${encodedPath}.json?start=${start}`,
      `${base}/${encodedPath}.json`,
    ];
  });

  for (const url of urls) {
    try {
      const count = await tryLoadGoatCounterUrl(url);

      if (count !== null) {
        target.textContent = count;
        return;
      }
    } catch (error) {
      // Try next URL.
    }
  }

  target.textContent = "ikke tilgængeligt";
}

setupEvents();
loadPodcasts();

window.setTimeout(() => {
  loadVisitorCount();
}, 1200);
