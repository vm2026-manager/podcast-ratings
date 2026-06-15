from pathlib import Path

path = Path("app.js")
text = path.read_text(encoding="utf-8", errors="replace")
original = text

def replace_once(old, new, label):
    global text
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"FEJL: Forventede 1 match for {label}, fandt {count}")
    text = text.replace(old, new, 1)
    print(f"OK: {label}")

# 1) Tilføj helper til stabil random tie-breaker
old = '''function getScoreBadgeMarkup(value) {
'''
new = '''function getPodcastRandomTieBreaker(podcast) {
  return Number.isFinite(podcast?.randomTieBreaker) ? podcast.randomTieBreaker : 0.5;
}

function compareRandomTieBreaker(a, b) {
  return getPodcastRandomTieBreaker(a) - getPodcastRandomTieBreaker(b);
}

function hasSameMadsRating(a, b) {
  return a.ratingValue !== null && b.ratingValue !== null && a.ratingValue === b.ratingValue;
}

function bothMissingMadsRating(a, b) {
  return a.ratingValue === null && b.ratingValue === null;
}

function getScoreBadgeMarkup(value) {
'''
replace_once(old, new, "helper-funktioner før getScoreBadgeMarkup")

# 2) Tilføj randomTieBreaker én gang pr. podcast ved mapping/load
old = '''    image,
    description,
    placement: placement ?? index + 1,
    completenessScore: getCompletenessScore({
'''
new = '''    image,
    description,
    placement: placement ?? index + 1,
    randomTieBreaker: Math.random(),
    completenessScore: getCompletenessScore({
'''
replace_once(old, new, "randomTieBreaker i mapPodcast")

# 3) Brug random for brugerlisten, når podcasts mangler brugerrating
old = '''        if (!aHasRank && !bHasRank) {
          return a.placement - b.placement;
        }
'''
new = '''        if (!aHasRank && !bHasRank) {
          return compareRandomTieBreaker(a, b);
        }
'''
replace_once(old, new, "brugere uden rating randomiseres indbyrdes")

# 4) Brug random for Mads-listen ved samme rating eller manglende rating
old = '''      if (state.sort === "placement-desc") {
        const aHasRating = a.ratingValue !== null;
        const bHasRating = b.ratingValue !== null;

        if (aHasRating !== bHasRating) {
          return aHasRating ? -1 : 1;
        }

        return b.placement - a.placement;
      }

      return a.placement - b.placement;
'''
new = '''      if (state.sort === "placement-desc") {
        const aHasRating = a.ratingValue !== null;
        const bHasRating = b.ratingValue !== null;

        if (aHasRating !== bHasRating) {
          return aHasRating ? -1 : 1;
        }

        if (hasSameMadsRating(a, b) || bothMissingMadsRating(a, b)) {
          return compareRandomTieBreaker(a, b);
        }

        return b.placement - a.placement;
      }

      if (hasSameMadsRating(a, b) || bothMissingMadsRating(a, b)) {
        return compareRandomTieBreaker(a, b);
      }

      return a.placement - b.placement;
'''
replace_once(old, new, "Mads sortering randomiserer kun ens/manglende ratings")

# 5) Brug random ved ens bruger-gennemsnit i user ranks
old = '''      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }

      return a.podcast.placement - b.podcast.placement;
'''
new = '''      if (b.averageRating !== a.averageRating) {
        return b.averageRating - a.averageRating;
      }

      return compareRandomTieBreaker(a.podcast, b.podcast);
'''
replace_once(old, new, "brugerrangliste randomiserer ens gennemsnit")

path.write_text(text, encoding="utf-8")
print("\\nFærdig. app.js er patchet.")
print("Ændrede tegn:", len(text) - len(original))
