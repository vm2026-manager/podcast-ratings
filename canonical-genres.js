(function publishCanonicalGenres(root) {
  const genres = Object.freeze([
    "True Crime",
    "Historie",
    "Krig",
    "Politik",
    "Finans",
    "Samfund",
    "Sport",
    "Dokumentar",
    "Viden",
    "Underholdning"
  ]);

  if (typeof module === "object" && module.exports) module.exports = genres;
  if (root) root.PODCAST_CANONICAL_GENRES = genres;
})(typeof globalThis === "object" ? globalThis : this);
