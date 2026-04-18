const podcastGrid = document.querySelector("#podcastGrid");
const resultsText = document.querySelector("#resultsText");
const searchInput = document.querySelector("#searchInput");
const genreFilter = document.querySelector("#genreFilter");
const publisherFilter = document.querySelector("#publisherFilter");
const sortSelect = document.querySelector("#sortSelect");
const cardTemplate = document.querySelector("#podcastCardTemplate");
const appScript = document.querySelector('script[src$="app.js"]');

let podcasts = [];

const collator = new Intl.Collator("da", {
  sensitivity: "base",
  numeric: true
});

function normalizeText(value) {
  return String(value).toLocaleLowerCase("da");
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function formatText(value, fallback = "Ikke angivet") {
  return isBlank(value) ? fallback : String(value).trim();
}

function formatRating(rating) {
  const numeric = parseRating(rating);

  if (numeric === Number.NEGATIVE_INFINITY) {
    return "Ikke vurderet";
  }

  return numeric.toFixed(1).replace(".", ",") + " / 10";
}

function parseRating(value) {
  if (typeof value === "number") {
    return value;
  }

  if (isBlank(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  const normalized = String(value).replace(",", ".").trim();
  const numeric = Number.parseFloat(normalized);

  return Number.isNaN(numeric) ? Number.NEGATIVE_INFINITY : numeric;
}

function parsePlacement(value) {
  const numeric = Number.parseInt(String(value).trim(), 10);
  return Number.isNaN(numeric) ? Number.POSITIVE_INFINITY : numeric;
}

function parsePlayedYear(value) {
  if (isBlank(value)) {
    return Number.NEGATIVE_INFINITY;
  }

  const match = String(value).match(/\d{4}/);
  return match ? Number.parseInt(match[0], 10) : Number.NEGATIVE_INFINITY;
}

function populateFilterOptions(select, values, allLabel) {
  select.innerHTML = `<option value="">${allLabel}</option>`;

  values.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });
}

function sortPodcasts(items, sortValue) {
  const sorted = [...items];

  sorted.sort((a, b) => {
    switch (sortValue) {
      case "placement-desc":
        return parsePlacement(b["Placering"]) - parsePlacement(a["Placering"]);

      case "placement-asc":
        return parsePlacement(a["Placering"]) - parsePlacement(b["Placering"]);

      case "rating-asc":
        return (
          parseRating(a["Vurdering (1-10)"]) -
          parseRating(b["Vurdering (1-10)"])
        );

      case "rating-desc":
        return (
          parseRating(b["Vurdering (1-10)"]) -
          parseRating(a["Vurdering (1-10)"])
        );

      case "title-desc":
        return collator.compare(b["Titel"], a["Titel"]);

      case "title-asc":
        return collator.compare(a["Titel"], b["Titel"]);

      case "playedYear-asc":
        return (
          parsePlayedYear(a["Årstal afspillet"]) -
          parsePlayedYear(b["Årstal afspillet"])
        );

      case "playedYear-desc":
      default:
        return (
          parsePlayedYear(b["Årstal afspillet"]) -
          parsePlayedYear(a["Årstal afspillet"])
        );
    }
  });

  return sorted;
}

function filterPodcasts(items, query) {
  return items.filter((podcast) => {
    const matchesQuery = !query
      ? true
      : [podcast["Titel"], podcast["Vært"]]
          .map(normalizeText)
          .join(" ")
          .includes(normalizeText(query));

    const matchesGenre = !genreFilter.value
      ? true
      : normalizeText(podcast["Genre"]) === normalizeText(genreFilter.value);

    const matchesPublisher = !publisherFilter.value
      ? true
      : normalizeText(podcast["Udgiver"]) === normalizeText(publisherFilter.value);

    return matchesQuery && matchesGenre && matchesPublisher;
  });
}

function updateSummary(count, total) {
  const noun = count === 1 ? "podcast" : "podcasts";
  resultsText.textContent = `Viser ${count} ${noun} ud af ${total}.`;
}

function createCard(podcast) {
  const fragment = cardTemplate.content.cloneNode(true);

  fragment.querySelector(".placement").textContent = `#${formatText(
    podcast["Placering"],
    "–"
  )}`;
  fragment.querySelector(".genre").textContent = formatText(podcast["Genre"]);
  fragment.querySelector(".rating").textContent = formatRating(
    podcast["Vurdering (1-10)"]
  );
  fragment.querySelector(".title").textContent = formatText(podcast["Titel"]);

  const hostText = formatText(podcast["Vært"], "Vært ikke angivet");
  fragment.querySelector(".host").textContent = hostText;

  fragment.querySelector(".publisher").textContent = formatText(
    podcast["Udgiver"]
  );
  fragment.querySelector(".played-year").textContent = formatText(
    podcast["Årstal afspillet"]
  );
  fragment.querySelector(".episodes").textContent = formatText(
    podcast["Antal afsnit"]
  );

  const linkButton = fragment.querySelector(".podcast-link");
  const link = isBlank(podcast["Link"]) ? "" : String(podcast["Link"]).trim();

  if (link) {
    linkButton.addEventListener("click", () => {
      window.open(link, "_blank", "noreferrer");
    });
    linkButton.setAttribute(
      "aria-label",
      `Åbn podcasten ${formatText(podcast["Titel"], "podcast")}`
    );
  } else {
    linkButton.remove();
  }

  return fragment;
}

function populateFilters(items) {
  const genres = [
    ...new Set(
      items
        .map((podcast) => formatText(podcast["Genre"], ""))
        .filter(Boolean)
    )
  ].sort((a, b) => collator.compare(a, b));

  const publishers = [
    ...new Set(
      items
        .map((podcast) => formatText(podcast["Udgiver"], ""))
        .filter(Boolean)
    )
  ].sort((a, b) => collator.compare(a, b));

  populateFilterOptions(genreFilter, genres, "Alle genrer");
  populateFilterOptions(publisherFilter, publishers, "Alle udgivere");
}

function getDataUrl() {
  const scriptSource = appScript?.src;

  if (scriptSource) {
    return new URL("data/podcasts.json", scriptSource).href;
  }

  const pageUrl = window.location.href.endsWith("/")
    ? window.location.href
    : `${window.location.href}/`;

  return new URL("data/podcasts.json", pageUrl).href;
}

function showLoadError(message) {
  resultsText.textContent = "Podcasts kunne ikke indlæses.";
  podcastGrid.innerHTML = `<div class="empty-state">${message}</div>`;
}

function renderPodcasts() {
  const query = searchInput.value.trim();
  const sortValue = sortSelect.value;
  const filtered = filterPodcasts(podcasts, query);
  const sorted = sortPodcasts(filtered, sortValue);

  podcastGrid.innerHTML = "";
  updateSummary(sorted.length, podcasts.length);

  if (sorted.length === 0) {
    podcastGrid.innerHTML =
      '<div class="empty-state">Ingen podcasts matcher din søgning. Prøv et andet ord eller vælg en anden sortering.</div>';
    return;
  }

  const fragment = document.createDocumentFragment();

  sorted.forEach((podcast) => {
    fragment.appendChild(createCard(podcast));
  });

  podcastGrid.appendChild(fragment);
}

async function loadPodcasts() {
  try {
    const response = await fetch(getDataUrl(), {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Kunne ikke hente datafilen (${response.status}).`);
    }

    podcasts = await response.json();

    if (!Array.isArray(podcasts)) {
      throw new Error("Datafilen har ikke det forventede JSON-format.");
    }

    populateFilters(podcasts);
    renderPodcasts();
  } catch (error) {
    showLoadError(
      "Data kunne ikke indlæses. Tjek at `data/podcasts.json` ligger i projektet, og at GitHub Pages er publiceret fra den rigtige mappe."
    );
    console.error(error);
  }
}

searchInput.addEventListener("input", renderPodcasts);
genreFilter.addEventListener("change", renderPodcasts);
publisherFilter.addEventListener("change", renderPodcasts);
sortSelect.addEventListener("change", renderPodcasts);

loadPodcasts();
