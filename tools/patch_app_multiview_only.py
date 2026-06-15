from pathlib import Path

path = Path("app.js")
text = path.read_text(encoding="utf-8", errors="replace")
original = text

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FEJL: {label} - forventede 1 match, fandt {count}")
    text = text.replace(old, new, 1)
    print(f"OK: {label}")

# 1. Tilføj currentPage i state
replace_once(
'''  rankingSource: "mads",
  sort: "placement-asc",
''',
'''  rankingSource: "mads",
  currentPage: "forside",
  sort: "placement-asc",
''',
"state.currentPage"
)

# 2. Tilføj pageIntroPanel og pageLinks i elements
replace_once(
'''  rankingSourceButtons: document.querySelectorAll("[data-ranking-source]"),
  resultsText: document.getElementById("resultsText"),
''',
'''  rankingSourceButtons: document.querySelectorAll("[data-ranking-source]"),
  pageLinks: document.querySelectorAll("[data-page-link]"),
  pageIntroPanel: document.getElementById("pageIntroPanel"),
  resultsText: document.getElementById("resultsText"),
''',
"elements pageLinks/pageIntroPanel"
)

# 3. Erstat render-funktionen med routing-aware render
replace_once(
'''function render() {
  renderAuthPanel();
  updateActiveFilterUi();
  updateSortToggleUi();
  updateRankingSourceUi();
  renderRecent();
  renderPodcastGrid();
  renderFeaturedReview();
}
''',
'''const VALID_PAGES = new Set(["forside", "ranglister", "udforsk", "gemte", "profil"]);

function getPageFromHash() {
  const page = (window.location.hash || "")
    .replace(/^#/, "")
    .trim()
    .toLowerCase();

  return VALID_PAGES.has(page) ? page : "forside";
}

function getPageIntroMarkup(page) {
  if (page === "forside") {
    return `
      <h2>Velkommen til Podcast Favoritter</h2>
      <p>Forsiden bliver næste trin i redesignet med Ugens anbefaling, Populært blandt brugere, Top i hver genre og Senest bedømte. Indtil da kan du gå direkte til den fulde rangliste.</p>
      <div class="page-intro-panel__actions">
        <a class="page-intro-panel__button" href="#ranglister">Se hele ranglisten</a>
        <a class="page-intro-panel__button page-intro-panel__button--secondary" href="#udforsk">Udforsk genrer</a>
      </div>
    `;
  }

  if (page === "udforsk") {
    return `
      <h2>Udforsk podcasts</h2>
      <p>Her kommer en genreside med Top i True Crime, Top i Historie, Nye anbefalinger og andre indgange til podcastlisten.</p>
      <div class="page-intro-panel__actions">
        <a class="page-intro-panel__button" href="#ranglister">Gå til ranglister</a>
      </div>
    `;
  }

  if (page === "gemte") {
    const savedCount = state.savedPodcastKeys?.size || 0;
    return `
      <h2>Gemte podcasts</h2>
      <p>${isLoggedIn() ? `Du har ${savedCount} gemte podcasts.` : "Log ind for at se og gemme podcasts til senere."}</p>
      <div class="page-intro-panel__actions">
        <a class="page-intro-panel__button" href="#ranglister">Find podcasts</a>
      </div>
    `;
  }

  if (page === "profil") {
    return `
      <h2>Profil</h2>
      <p>${isLoggedIn() ? "Her kommer dit profiloverblik med dine vurderinger, favoritter og podcastaktivitet." : "Log ind for at se din profil og dine egne podcastvurderinger."}</p>
      <div class="page-intro-panel__actions">
        <a class="page-intro-panel__button" href="#ranglister">Til ranglisten</a>
      </div>
    `;
  }

  return "";
}

function updatePageUi() {
  state.currentPage = getPageFromHash();

  document.body.classList.remove(
    "page-forside",
    "page-ranglister",
    "page-udforsk",
    "page-gemte",
    "page-profil"
  );
  document.body.classList.add(`page-${state.currentPage}`);

  elements.pageLinks?.forEach((link) => {
    const active = link.dataset.pageLink === state.currentPage;
    link.classList.toggle("is-active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });

  if (!elements.pageIntroPanel) return;

  if (state.currentPage === "ranglister") {
    elements.pageIntroPanel.classList.add("is-hidden");
    elements.pageIntroPanel.innerHTML = "";
    return;
  }

  elements.pageIntroPanel.innerHTML = getPageIntroMarkup(state.currentPage);
  elements.pageIntroPanel.classList.remove("is-hidden");
}

function render() {
  updatePageUi();
  renderAuthPanel();

  if (state.currentPage === "ranglister") {
    updateActiveFilterUi();
    updateSortToggleUi();
    updateRankingSourceUi();
    renderRecent();
    renderPodcastGrid();
    renderFeaturedReview();
  }
}
''',
"render med hash-routing"
)

# 4. Tilføj hashchange listener
replace_once(
'''  elements.viewModeToggle?.addEventListener("click", toggleViewMode);
''',
'''  window.addEventListener("hashchange", () => {
    resetVisibleCount();
    render();
  });

  elements.viewModeToggle?.addEventListener("click", toggleViewMode);
''',
"hashchange listener"
)

# 5. Tilføj initial hash og første UI-render ved startup
replace_once(
'''ensureLoadMoreControls();
setupEvents();
applyViewModePreference();
loadPodcasts();
runSecondaryStartup();
''',
'''ensureLoadMoreControls();

if (!window.location.hash || !VALID_PAGES.has(window.location.hash.replace(/^#/, "").trim().toLowerCase())) {
  window.location.hash = "#forside";
}

setupEvents();
applyViewModePreference();
updatePageUi();
renderAuthPanel();
loadPodcasts();
runSecondaryStartup();
''',
"startup med default hash og første render"
)

path.write_text(text, encoding="utf-8")

print("")
print("Færdig. app.js er nu patchet med multi-view routing.")
print("Ændrede tegn:", len(text) - len(original))
