const podcastGrid = document.querySelector("#podcastGrid");
const recentGrid = document.querySelector("#recentGrid");
const recentSummary = document.querySelector("#recentSummary");
const resultsText = document.querySelector("#resultsText");
const searchInput = document.querySelector("#searchInput");
const genreChips = document.querySelector("#genreChips");
const sortToggle = document.querySelector("#sortToggle");
const activeFilterBox = document.querySelector("#activeFilterBox");
const activeFilterPill = document.querySelector("#activeFilterPill");
const activeFilterText = document.querySelector("#activeFilterText");
const clearFilterButton = document.querySelector("#clearFilterButton");
const featuredReviewPanel = document.querySelector("#featuredReviewPanel");
const featuredImage = document.querySelector("#featuredImage");
const featuredTitle = document.querySelector("#featuredTitle");
const featuredMeta = document.querySelector("#featuredMeta");
const featuredScore = document.querySelector("#featuredScore");
const featuredDate = document.querySelector("#featuredDate");
const featuredText = document.querySelector("#featuredText");
const featuredParams = document.querySelector("#featuredParams");
const featuredDots = document.querySelector("#featuredDots");
const recentCardTemplate = document.querySelector("#recentCardTemplate");
const cardTemplate = document.querySelector("#podcastCardTemplate");

const DATA_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQRBWQdj-WDNN3l9yxIMCCu_O2dYfP7modSODcYgJRoQDG3GYsu83W_wIFyijPx6v8l-W011zrFyOdq/pub?gid=0&single=true&output=csv";

const FIXED_GENRES = [
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

const state = {
  podcasts: [],
  activeGenre: "Alle",
  sortAscending: true
};

const collator = new Intl.Collator("da", {
  sensitivity: "base",
  numeric: true
});

function normalizeText(value) {
  return String(value ?? "").toLocaleLowerCase("da").trim();
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function formatText(value, fallback = "Ikke angivet") {
  return isBlank(value) ? fallback : String(value).trim();
}

function firstNonBlank(...values) {
  for (const value of values) {
    if (!isBlank(value)) {
      return String(value).trim();
    }
  }

  return "";
}

function cleanNumericText(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\u00A0/g, " ")
    .replace(/["']/g, "")
    .trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function extractUrl(value) {
  const cleaned = String(value ?? "").trim();

  if (!cleaned) {
    return "";
  }

  const imageFormulaMatch = cleaned.match(/=IMAGE\("([^"]+)"\)/i);
  if (imageFormulaMatch) {
    return imageFormulaMatch[1].trim();
  }

  const hyperlinkFormulaMatch = cleaned.match(/=HYPERLINK\("([^"]+)"/i);
  if (hyperlinkFormulaMatch) {
    return hyperlinkFormulaMatch[1].trim();
  }

  const quotedUrlMatch = cleaned.match(/"(https?:\/\/[^"]+)"/i);
  if (quotedUrlMatch) {
    return quotedUrlMatch[1].trim();
  }

  const urlMatch = cleaned.match(/https?:\/\/[^\s",)]+/i);
  if (urlMatch) {
    return urlMatch[0].trim();
  }

  return cleaned;
}

function parseNumber(value) {
  const cleaned = cleanNumericText(value);
  const match = cleaned.match(/-?\d+(?:[.,]\d+)?/);

  if (!match) {
    return null;
  }

  const numeric = Number.parseFloat(match[0].replace(",", "."));
  return Number.isNaN(numeric) ? null : numeric;
}

function parseRating(value) {
  const numeric = parseNumber(value);
  return numeric === null ? Number.NEGATIVE_INFINITY : numeric;
}

function formatRating(value) {
  const numeric = parseRating(value);

  if (numeric === Number.NEGATIVE_INFINITY) {
    return "Ikke vurderet";
  }

  return `${numeric.toFixed(1).replace(".", ",")} / 10`;
}

function parsePlacement(value) {
  const numeric = Number.parseInt(cleanNumericText(value), 10);
  return Number.isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric;
}

function parseDateDMY(value) {
  if (isBlank(value)) {
    return null;
  }

  const cleaned = String(value).trim();
  const dashMatch = cleaned.match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (dashMatch) {
    const [, dd, mm, yyyy] = dashMatch;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const dotMatch = cleaned.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);

  if (dotMatch) {
    const [, dd, mm, yyyy] = dotMatch;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

function formatDateDMY(value) {
  const date = parseDateDMY(value);

  if (!date) {
    return "";
  }

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function sanitizeHeader(header) {
  return String(header ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLocaleLowerCase("da")
    .replace(/\s+/g, " ");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let insideQuotes = false;

  const normalized = String(text ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  for (let index = 0; index < normalized.length; index += 1) {
    const character = normalized[index];
    const nextCharacter = normalized[index + 1];

    if (character === '"') {
      if (insideQuotes && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (character === "," && !insideQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if (character === "\n" && !insideQuotes) {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += character;
  }

  row.push(value);
  rows.push(row);

  return rows
    .map((currentRow) => currentRow.map((cell) => String(cell ?? "").trim()))
    .filter((currentRow) => currentRow.some((cell) => !isBlank(cell)));
}

function findHeaderIndex(headerIndexes, ...aliases) {
  for (const alias of aliases) {
    const normalizedAlias = sanitizeHeader(alias);
    if (headerIndexes.has(normalizedAlias)) {
      return headerIndexes.get(normalizedAlias);
    }
  }

  return -1;
}

function getCell(row, index) {
  return index >= 0 && index < row.length ? String(row[index] ?? "").trim() : "";
}

function normalizeGenre(genre) {
  const value = normalizeText(genre);

  if (
    value.includes("true crime") ||
    value.includes("crime") ||
    value.includes("krimi") ||
    value.includes("svindel")
  ) {
    return "True Crime";
  }

  if (
    value.includes("historie") ||
    value.includes("krig") ||
    value.includes("kriger / historie")
  ) {
    return "Historie";
  }

  if (
    value.includes("fodbold") ||
    value.includes("sport") ||
    value.includes("cykling") ||
    value.includes("sport/politik") ||
    value.includes("fodbold/politik") ||
    value.includes("fodbold/snak")
  ) {
    return "Sport";
  }

  if (
    value.includes("dokumentar") ||
    value.includes("dokimentar") ||
    value.includes("portræt") ||
    value.includes("portraet")
  ) {
    return "Dokumentar";
  }

  if (
    value.includes("viden") ||
    value.includes("videnskab") ||
    value.includes("forskning") ||
    value.includes("sundhed")
  ) {
    return "Viden";
  }

  if (
    value.includes("sladder") ||
    value.includes("gossip") ||
    value.includes("skandaler")
  ) {
    return "Sladder";
  }

  if (
    value.includes("underholdning") ||
    value.includes("unholdning") ||
    value.includes("tv & film") ||
    value.includes("humor") ||
    value.includes("drama") ||
    value.includes("dating") ||
    value.includes("kærlighed")
  ) {
    return "Underholdning";
  }

  if (
    value.includes("politik") ||
    value.includes("samfund") ||
    value.includes("nyheder") ||
    value.includes("nyhe") ||
    value.includes("snakke") ||
    value.includes("snak") ||
    value.includes("erhverv") ||
    value.includes("mediemagasin") ||
    value.includes("krise")
  ) {
    return "Samfund";
  }

  return formatText(genre, "");
}

function normalizePodcastRow(rawPodcast) {
  const image = extractUrl(
    firstNonBlank(
      rawPodcast["Billedlink"],
      rawPodcast["Billedefil"],
      rawPodcast["Billedlink/Billedefil"],
      rawPodcast["Billedlink / Billedefil"]
    )
  );

  return {
    placement: firstNonBlank(rawPodcast["Placering"]),
    title: firstNonBlank(rawPodcast["Titel"]),
    host: firstNonBlank(rawPodcast["Vært"], rawPodcast["Vaert"]),
    rating: firstNonBlank(
      rawPodcast["Vuring (1-10)"],
      rawPodcast["Vuring/Vurdering (1-10)"],
      rawPodcast["Vurdering (1-10)"],
      rawPodcast["Vurdering"]
    ),
    genre: normalizeGenre(firstNonBlank(rawPodcast["Genre"])),
    publisher: firstNonBlank(rawPodcast["Udgiver"]),
    episodes: firstNonBlank(rawPodcast["Antal afsnit"]),
    yearPlayed: firstNonBlank(rawPodcast["Årstal afspillet"]),
    link: extractUrl(firstNonBlank(rawPodcast["Link"])),
    reviewDate: firstNonBlank(
      rawPodcast["Afgivet vurdering"],
      rawPodcast["Afgivet vurd"]
    ),
    image,
    ratingLabel: formatRating(
      firstNonBlank(
        rawPodcast["Vuring (1-10)"],
        rawPodcast["Vuring/Vurdering (1-10)"],
        rawPodcast["Vurdering (1-10)"],
        rawPodcast["Vurdering"]
      )
    )
  };
}

function mapCsvToPodcasts(csvText) {
  const rows = parseCsv(csvText);

  if (rows.length < 2) {
    throw new Error("CSV-filen indeholder ikke nok rækker.");
  }

  const [headerRow, ...dataRows] = rows;
  const headerIndexes = new Map();

  headerRow.forEach((header, index) => {
    headerIndexes.set(sanitizeHeader(header), index);
  });

  const indexes = {
    placement: findHeaderIndex(headerIndexes, "Placering"),
    title: findHeaderIndex(headerIndexes, "Titel"),
    host: findHeaderIndex(headerIndexes, "Vært", "Vaert"),
    rating: findHeaderIndex(
      headerIndexes,
      "Vuring (1-10)",
      "Vuring/Vurdering (1-10)",
      "Vurdering (1-10)",
      "Vurdering"
    ),
    genre: findHeaderIndex(headerIndexes, "Genre"),
    publisher: findHeaderIndex(headerIndexes, "Udgiver"),
    episodes: findHeaderIndex(headerIndexes, "Antal afsnit"),
    yearPlayed: findHeaderIndex(headerIndexes, "Årstal afspillet"),
    link: findHeaderIndex(headerIndexes, "Link"),
    reviewDate: findHeaderIndex(
      headerIndexes,
      "Afgivet vurdering",
      "Afgivet vurd"
    ),
    image: findHeaderIndex(
      headerIndexes,
      "Billedlink",
      "Billedefil",
      "Billedlink/Billedefil",
      "Billedlink / Billedefil"
    )
  };

  return dataRows
    .map((row) => {
      const rawPodcast = {
        Placering: getCell(row, indexes.placement),
        Titel: getCell(row, indexes.title),
        Vært: getCell(row, indexes.host),
        "Vuring (1-10)": getCell(row, indexes.rating),
        Genre: getCell(row, indexes.genre),
        Udgiver: getCell(row, indexes.publisher),
        "Antal afsnit": getCell(row, indexes.episodes),
        "Årstal afspillet": getCell(row, indexes.yearPlayed),
        Link: getCell(row, indexes.link),
        "Afgivet vurdering": getCell(row, indexes.reviewDate),
        Billedlink: getCell(row, indexes.image)
      };

      return normalizePodcastRow(rawPodcast);
    })
    .filter((podcast) => !isBlank(podcast.title));
}

function createFilterChip(label, kind) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `podcast-chip podcast-chip--${kind}`;
  button.textContent = label;
  button.addEventListener("click", () => {
    if (kind === "genre") {
      state.activeGenre = label;
      populateGenreChips();
      renderAll();
    }
  });
  return button;
}

function createStaticChip(label, kind) {
  const chip = document.createElement("span");
  chip.className = `podcast-chip podcast-chip--${kind}`;
  chip.textContent = label;
  return chip;
}

function populateGenreChips() {
  if (!genreChips) {
    return;
  }

  genreChips.innerHTML = "";

  FIXED_GENRES.forEach((genre) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `genre-chip${genre === state.activeGenre ? " active" : ""}`;
    button.textContent = genre;
    button.addEventListener("click", () => {
      state.activeGenre = genre;
      populateGenreChips();
      renderAll();
    });
    genreChips.appendChild(button);
  });
}

function updateActiveFilterUI() {
  if (!activeFilterBox || !activeFilterText) {
    return;
  }

  if (state.activeGenre === "Alle") {
    activeFilterBox.classList.add("is-hidden");
    return;
  }

  activeFilterText.textContent = state.activeGenre;
  activeFilterBox.classList.remove("is-hidden");
}

function applyImageState(wrapper, image, placeholder, imageUrl, altText) {
  if (!wrapper || !image || !placeholder) {
    return;
  }

  const cleanedUrl = extractUrl(imageUrl);

  const showPlaceholder = () => {
    wrapper.classList.add("has-no-image");
    placeholder.hidden = false;
    image.hidden = true;
    image.removeAttribute("src");
    image.alt = "";
  };

  if (!cleanedUrl) {
    showPlaceholder();
    return;
  }

  wrapper.classList.remove("has-no-image");
  placeholder.hidden = true;
  image.hidden = false;
  image.src = cleanedUrl;
  image.alt = altText;
  image.referrerPolicy = "no-referrer";
  image.decoding = "async";
  image.loading = "lazy";
  image.addEventListener("error", showPlaceholder, { once: true });
}

function renderFeaturedPanel(items) {
  if (
    !featuredReviewPanel ||
    !featuredImage ||
    !featuredTitle ||
    !featuredMeta ||
    !featuredScore ||
    !featuredDate ||
    !featuredText ||
    !featuredParams ||
    !featuredDots
  ) {
    return;
  }

  const recent = getRecentRatedPodcasts(items, 5);

  if (recent.length === 0) {
    featuredReviewPanel.classList.add("is-hidden");
    return;
  }

  const featured = recent[0];

  featuredReviewPanel.classList.remove("is-hidden");
  featuredImage.src = featured.image || "";
  featuredImage.alt = featured.title || "";
  featuredImage.hidden = !featured.image;
  featuredMeta.textContent = [featured.host, featured.publisher]
    .filter(Boolean)
    .join(" · ");
  featuredTitle.textContent = featured.title || "";
  featuredScore.textContent = featured.ratingLabel || "Ikke vurderet";
  featuredDate.textContent = featured.reviewDate
    ? `Bedømt ${formatDateDMY(featured.reviewDate)}`
    : "";
  featuredText.textContent =
    "Denne podcast ligger helt i toppen af listen lige nu og er en af de senest bedømte.";

  featuredParams.innerHTML = "";

  [
    { label: "Vurdering", value: featured.ratingLabel },
    { label: "Genre", value: featured.genre || "Ukendt" },
    { label: "Afsnit", value: featured.episodes || "—" }
  ].forEach((item) => {
    const row = document.createElement("div");
    row.className = "featured-param";
    row.innerHTML = `
      <span class="featured-param-name">${escapeHtml(item.label)}</span>
      <span class="featured-param-value">${escapeHtml(item.value)}</span>
    `;
    featuredParams.appendChild(row);
  });

  featuredDots.innerHTML = "";
  recent.forEach((podcast, index) => {
    const dot = document.createElement("span");
    dot.className = `featured-dot${index === 0 ? " is-active" : ""}`;
    dot.title = podcast.title;
    featuredDots.appendChild(dot);
  });
}

function createRecentCard(podcast) {
  const fragment = recentCardTemplate.content.cloneNode(true);
  const coverWrap = fragment.querySelector(".recent-cover-wrap");
  const cover = fragment.querySelector(".recent-cover");
  const placeholder = fragment.querySelector(".image-placeholder");

  applyImageState(
    coverWrap,
    cover,
    placeholder,
    podcast.image,
    `Cover til ${formatText(podcast.title, "podcast")}`
  );

  fragment.querySelector(".recent-title").textContent = formatText(podcast.title);
  fragment.querySelector(".recent-host").textContent = formatText(
    podcast.host,
    "Vært ikke angivet"
  );
  fragment.querySelector(".recent-rating").textContent = podcast.ratingLabel;
  fragment.querySelector(".recent-date").textContent = podcast.reviewDate
    ? `Bedømt ${formatDateDMY(podcast.reviewDate)}`
    : "";

  return fragment;
}

function getRecentRatedPodcasts(items, limit = 3) {
  return [...items]
    .filter((podcast) => parseDateDMY(podcast.reviewDate))
    .sort((a, b) => parseDateDMY(b.reviewDate) - parseDateDMY(a.reviewDate))
    .slice(0, limit);
}

function renderRecentRated() {
  if (!recentGrid || !recentSummary) {
    return;
  }

  const recentItems = getRecentRatedPodcasts(state.podcasts, 3);
  recentGrid.innerHTML = "";

  if (recentItems.length === 0) {
    recentGrid.innerHTML =
      '<p class="empty-state">Ingen nylige bedømmelser fundet endnu.</p>';
    recentSummary.textContent = "Ingen nylige bedømmelser";
    return;
  }

  const fragment = document.createDocumentFragment();
  recentItems.forEach((podcast) => {
    fragment.appendChild(createRecentCard(podcast));
  });

  recentGrid.appendChild(fragment);
  recentSummary.textContent = "Viser de seneste bedømmelser";
}

function renderPodcastCard(podcast) {
  const fragment = cardTemplate.content.cloneNode(true);
  const article = fragment.querySelector(".podcast-card");
  const placement = fragment.querySelector(".podcast-card__placement");
  const rating = fragment.querySelector(".podcast-card__rating");
  const title = fragment.querySelector(".podcast-card__title");
  const host = fragment.querySelector(".podcast-card__host");
  const description = fragment.querySelector(".podcast-card__description");
  const chips = fragment.querySelector(".podcast-card__chips");
  const linkButton = fragment.querySelector(".podcast-card__link");
  const reviewButton = fragment.querySelector(".podcast-card__review");
  const coverWrap = fragment.querySelector(".cover-wrap");
  const image = fragment.querySelector(".podcast-image");
  const placeholder = fragment.querySelector(".image-placeholder");

  placement.innerHTML = `
    <span class="placement-value">#${escapeHtml(podcast.placement || "—")}</span>
    <span class="placement-label">Placering</span>
  `;

  rating.textContent = podcast.ratingLabel;
  title.textContent = formatText(podcast.title);
  host.textContent = formatText(podcast.host, "Vært ikke angivet");
  description.textContent = [podcast.publisher, podcast.yearPlayed]
    .filter(Boolean)
    .join(" · ");

  applyImageState(
    coverWrap,
    image,
    placeholder,
    podcast.image,
    `Cover til ${formatText(podcast.title, "podcast")}`
  );

  chips.innerHTML = "";
  chips.appendChild(
    createFilterChip(formatText(podcast.genre, "Ukendt"), "genre")
  );
  chips.appendChild(
    createStaticChip(formatText(podcast.publisher, "Ukendt"), "publisher")
  );
  chips.appendChild(
    createStaticChip(formatText(podcast.episodes, "—"), "episodes")
  );

  if (podcast.link) {
    linkButton.addEventListener("click", () => {
      window.open(podcast.link, "_blank", "noopener,noreferrer");
    });
  } else {
    linkButton.classList.add("is-hidden");
  }

  reviewButton.classList.add("is-hidden");
  reviewButton.disabled = true;

  article.dataset.genre = podcast.genre || "";
  return article;
}

function sortPodcasts(items) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    const difference = parsePlacement(a.placement) - parsePlacement(b.placement);
    return state.sortAscending ? difference : -difference;
  });

  return sorted;
}

function filterPodcasts(items) {
  const query = normalizeText(searchInput?.value ?? "");

  return items.filter((podcast) => {
    const matchesQuery = !query
      ? true
      : [podcast.title, podcast.host, podcast.publisher]
          .map(normalizeText)
          .join(" ")
          .includes(query);

    const matchesGenre =
      state.activeGenre === "Alle"
        ? true
        : normalizeText(podcast.genre) === normalizeText(state.activeGenre);

    return matchesQuery && matchesGenre;
  });
}

function updateSummary(count, total) {
  if (!resultsText) {
    return;
  }

  const noun = count === 1 ? "podcast" : "podcasts";
  resultsText.textContent = `Viser ${count} ${noun} ud af ${total}.`;
}

function renderPodcastGrid() {
  if (!podcastGrid) {
    return;
  }

  const filtered = filterPodcasts(state.podcasts);
  const sorted = sortPodcasts(filtered);

  podcastGrid.innerHTML = "";
  updateSummary(sorted.length, state.podcasts.length);

  if (sorted.length === 0) {
    podcastGrid.innerHTML =
      '<div class="empty-state">Ingen podcasts matcher din søgning eller dit filter.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  sorted.forEach((podcast) => {
    fragment.appendChild(renderPodcastCard(podcast));
  });
  podcastGrid.appendChild(fragment);
}

function updateSortButton() {
  if (!sortToggle) {
    return;
  }

  sortToggle.textContent = state.sortAscending
    ? "Placering: lavest først"
    : "Placering: højest først";
}

function renderAll() {
  updateSortButton();
  updateActiveFilterUI();
  renderPodcastGrid();
  renderRecentRated();
  renderFeaturedPanel(state.podcasts);
}

function showLoadError(message) {
  if (resultsText) {
    resultsText.textContent = "Podcasts kunne ikke indlæses.";
  }

  if (podcastGrid) {
    podcastGrid.innerHTML = `<div class="empty-state">${escapeHtml(message)}</div>`;
  }

  if (recentGrid) {
    recentGrid.innerHTML = "";
  }
}

function installEventHandlers() {
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      renderPodcastGrid();
    });
  }

  if (sortToggle) {
    sortToggle.addEventListener("click", () => {
      state.sortAscending = !state.sortAscending;
      renderPodcastGrid();
      updateSortButton();
    });
  }

  if (activeFilterPill) {
    activeFilterPill.addEventListener("click", () => {
      state.activeGenre = "Alle";
      populateGenreChips();
      renderAll();
    });
  }

  if (clearFilterButton) {
    clearFilterButton.addEventListener("click", () => {
      state.activeGenre = "Alle";
      populateGenreChips();
      renderAll();
    });
  }
}

async function loadPodcasts() {
  try {
    const response = await fetch(DATA_URL, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Kunde ikke hente Google Sheets-data (${response.status}).`);
    }

    const csvText = await response.text();
    state.podcasts = mapCsvToPodcasts(csvText);

    if (!Array.isArray(state.podcasts) || state.podcasts.length === 0) {
      throw new Error("Google Sheets-data blev læst, men gav ingen podcasts.");
    }

    renderAll();
  } catch (error) {
    console.error(error);
    showLoadError(
      "Data kunne ikke indlæses fra Google Sheets. Tjek at arket stadig er publiceret som CSV, og at kolonnerne matcher."
    );
  }
}

populateGenreChips();
installEventHandlers();
loadPodcasts();
