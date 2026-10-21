(function attachRankingMovement(root) {
  function displayScore(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Number(number.toFixed(1)) : null;
  }

  function normalizeKey(value, resolveCanonicalKey) {
    const key = String(value || "").trim();
    if (!key) return "";
    if (key.startsWith("display-group:")) return key;
    return resolveCanonicalKey(key) || key;
  }

  function rankCompetition(entries, keyOf, scoreOf) {
    const ranked = entries
      .map((entry) => ({ entry, key: keyOf(entry), score: displayScore(scoreOf(entry)) }))
      .filter((item) => item.key && item.score !== null)
      .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
    const positions = new Map();
    let previousScore = null;
    let currentPosition = 0;
    ranked.forEach((item, index) => {
      if (item.score !== previousScore) currentPosition = index + 1;
      previousScore = item.score;
      positions.set(item.key, currentPosition);
    });
    return positions;
  }

  function movementMap(currentEntries, historicalRows, options = {}) {
    const keyOf = options.keyOf || ((entry) => entry.key);
    const scoreOf = options.scoreOf || ((entry) => entry.averageRating);
    const resolveCanonicalKey = options.resolveCanonicalKey || ((key) => key);
    const currentByKey = new Map();
    const duplicateCurrentKeys = new Set();
    currentEntries.forEach((entry) => {
      const key = normalizeKey(keyOf(entry), resolveCanonicalKey);
      const score = displayScore(scoreOf(entry));
      if (!key || score === null) return;
      if (currentByKey.has(key)) duplicateCurrentKeys.add(key);
      else currentByKey.set(key, { key, score });
    });
    duplicateCurrentKeys.forEach((key) => currentByKey.delete(key));

    const historicalByKey = new Map();
    const ambiguous = new Set();
    historicalRows.forEach((row) => {
      const key = normalizeKey(row.podcast_key, resolveCanonicalKey);
      const score = displayScore(row.average_rating);
      if (!key || score === null || Number(row.rating_count) <= 0) return;
      if (historicalByKey.has(key)) {
        const existing = historicalByKey.get(key);
        if (existing.score !== score) ambiguous.add(key);
      } else {
        historicalByKey.set(key, { key, score });
      }
    });
    ambiguous.forEach((key) => historicalByKey.delete(key));

    const cohort = [...currentByKey.keys()]
      .filter((key) => historicalByKey.has(key))
      .map((key) => ({ key, current: currentByKey.get(key).score, previous: historicalByKey.get(key).score }));
    const currentRanks = rankCompetition(cohort, (item) => item.key, (item) => item.current);
    const historicalRanks = rankCompetition(cohort, (item) => item.key, (item) => item.previous);
    const movements = new Map();
    cohort.forEach((item) => {
      movements.set(item.key, historicalRanks.get(item.key) - currentRanks.get(item.key));
    });
    return movements;
  }

  function compareSnapshotsToCurrent(currentEntries, historicalRows, options = {}) {
    const historicalDate = options.historicalDate;
    const expectedDate = options.expectedDate;
    if (
      !Array.isArray(historicalRows) || !historicalRows.length || historicalRows.length >= 1000 ||
      historicalDate !== expectedDate ||
      historicalRows.some((row) => row.snapshot_date !== expectedDate || row.source !== "users")
    ) {
      return new Map();
    }
    return movementMap(currentEntries, historicalRows, options);
  }

  function isEligible(context = {}) {
    return Boolean(
      context.route === "ranglister" && context.source === "users" &&
      !context.hasFilter && !context.hasSearch && !context.hasMinimumRating &&
      !context.freeOnly && !context.languageFilter && !context.ownRatingSort &&
      context.userSort === "rating" && context.direction === "desc" && context.sort === "placement-asc"
    );
  }

  root.PodcastRankingMovement = Object.freeze({ displayScore, rankCompetition, movementMap, compareSnapshotsToCurrent, isEligible });
})(typeof window !== "undefined" ? window : globalThis);
