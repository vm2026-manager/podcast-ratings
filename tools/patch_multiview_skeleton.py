from pathlib import Path

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FEJL i {label}: forventede 1 match, fandt {count}")
    print(f"OK: {label}")
    return text.replace(old, new, 1)

# -----------------------------
# Patch index.html
# -----------------------------
index_path = Path("index.html")
index = index_path.read_text(encoding="utf-8", errors="replace")

old = '''        </div>

        <aside id="featuredReviewPanel" class="featured-panel is-hidden">
'''
new = '''        </div>

        <nav class="site-nav" aria-label="Hovednavigation">
          <a class="site-nav__link" href="#forside" data-page-link="forside">Forside</a>
          <a class="site-nav__link" href="#ranglister" data-page-link="ranglister">Ranglister</a>
          <a class="site-nav__link" href="#udforsk" data-page-link="udforsk">Udforsk</a>
          <a class="site-nav__link" href="#gemte" data-page-link="gemte">Gemte</a>
          <a class="site-nav__link" href="#profil" data-page-link="profil">Profil</a>
        </nav>

        <aside id="featuredReviewPanel" class="featured-panel is-hidden">
'''
index = replace_once(index, old, new, "index: navigation efter logo")

old = '''        </header>

        <section class="recent-section" aria-labelledby="recentHeading">
'''
new = '''        </header>

        <section id="pageIntroPanel" class="page-intro-panel is-hidden" aria-live="polite"></section>

        <section class="recent-section" aria-labelledby="recentHeading">
'''
index = replace_once(index, old, new, "index: pageIntroPanel efter hero")

index_path.write_text(index, encoding="utf-8")

# -----------------------------
# Patch style.css
# -----------------------------
style_path = Path("style.css")
style = style_path.read_text(encoding="utf-8", errors="replace")

css = r'''

/* Multi-view navigation */
.site-nav {
  display: grid;
  gap: 0.45rem;
  margin: 1rem 0 1.25rem;
}

.site-nav__link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border: 1px solid rgba(42, 27, 18, 0.12);
  border-radius: 999px;
  padding: 0.72rem 0.9rem;
  background: rgba(255, 252, 246, 0.72);
  color: var(--color-text);
  font-weight: 700;
  text-decoration: none;
  transition: border-color 160ms ease, background 160ms ease, color 160ms ease, transform 160ms ease;
}

.site-nav__link:hover,
.site-nav__link:focus-visible {
  border-color: rgba(228, 111, 57, 0.42);
  background: rgba(255, 244, 234, 0.95);
  color: var(--color-accent);
  transform: translateY(-1px);
}

.site-nav__link.is-active {
  border-color: rgba(228, 111, 57, 0.72);
  background: var(--color-accent);
  color: #fff;
}

.page-intro-panel {
  border: 1px solid rgba(42, 27, 18, 0.1);
  border-radius: 1.35rem;
  padding: 1.2rem;
  background: rgba(255, 252, 246, 0.82);
  box-shadow: var(--shadow-card);
  margin-bottom: 1.25rem;
}

.page-intro-panel h2 {
  margin: 0 0 0.45rem;
  font-family: var(--font-heading);
  font-size: clamp(1.8rem, 3vw, 2.5rem);
}

.page-intro-panel p {
  margin: 0;
  color: var(--color-muted);
  max-width: 58rem;
  line-height: 1.55;
}

.page-intro-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  margin-top: 1rem;
}

.page-intro-panel__button {
  border: 0;
  border-radius: 999px;
  padding: 0.72rem 1rem;
  background: var(--color-accent);
  color: #fff;
  font-weight: 800;
  text-decoration: none;
}

.page-intro-panel__button--secondary {
  background: rgba(42, 27, 18, 0.08);
  color: var(--color-text);
}

body:not(.page-ranglister) .featured-panel,
body:not(.page-ranglister) .genre-nav,
body:not(.page-ranglister) .controls-sidebar,
body:not(.page-ranglister) .recent-section,
body:not(.page-ranglister) .ranking-toolbar,
body:not(.page-ranglister) .podcast-grid {
  display: none;
}

@media (max-width: 900px) {
  .site-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .site-nav__link {
    justify-content: center;
    padding: 0.65rem 0.75rem;
  }
}
'''

if "/* Multi-view navigation */" not in style:
    style = style.rstrip() + "\n" + css + "\n"
    print("OK: style: tilføjede multi-view CSS")
else:
    print("SKIP: style: multi-view CSS findes allerede")

style_path.write_text(style, encoding="utf-8")

# -----------------------------
# Patch app.js
# -----------------------------
app_path = Path("app.js")
app = app_path.read_text(encoding="utf-8", errors="replace")

old = '''  rankingSource: "mads",
  sort: "placement-asc",
'''
new = '''  rankingSource: "mads",
  currentPage: "forside",
  sort: "placement-asc",
'''
app = replace_once(app, old, new, "app: state.currentPage")

old = '''  rankingSourceButtons: document.querySelectorAll("[data-ranking-source]"),
  resultsText: document.getElementById("resultsText"),
'''
new = '''  rankingSourceButtons: document.querySelectorAll("[data-ranking-source]"),
  pageLinks: document.querySelectorAll("[data-page-link]"),
  pageIntroPanel: document.getElementById("pageIntroPanel"),
  resultsText: document.getElementById("resultsText"),
'''
app = replace_once(app, old, new, "app: page elements")

old = '''function render() {
  renderAuthPanel();
  updateActiveFilterUi();
  updateSortToggleUi();
  updateRankingSourceUi();
  renderRecent();
  renderPodcastGrid();
  renderFeaturedReview();
}
'''
new = '''const VALID_PAGES = new Set(["forside", "ranglister", "udforsk", "gemte", "profil"]);

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
'''
app = replace_once(app, old, new, "app: render erstattet med page-routing")

old = '''  elements.viewModeToggle?.addEventListener("click", toggleViewMode);

  elements.openSignupButton?.addEventListener("click", () => {
'''
new = '''  window.addEventListener("hashchange", () => {
    resetVisibleCount();
    render();
  });

  elements.viewModeToggle?.addEventListener("click", toggleViewMode);

  elements.openSignupButton?.addEventListener("click", () => {
'''
app = replace_once(app, old, new, "app: hashchange listener")

old = '''ensureLoadMoreControls();
setupEvents();
applyViewModePreference();
loadPodcasts();
runSecondaryStartup();
'''
new = '''ensureLoadMoreControls();

if (!window.location.hash || !VALID_PAGES.has(window.location.hash.replace(/^#/, "").trim().toLowerCase())) {
  window.location.hash = "#forside";
}

setupEvents();
applyViewModePreference();
loadPodcasts();
runSecondaryStartup();
'''
app = replace_once(app, old, new, "app: initial hash default")

app_path.write_text(app, encoding="utf-8")

print("\\nFærdig. Multi-view skelet er patchet.")
