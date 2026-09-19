import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [app, mobileDetailCss] = await Promise.all([
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../mobile-featured-detail.css", import.meta.url), "utf8")
]);

const lockedScoreStart = mobileDetailCss.indexOf(
  "html body #podcastDetailSheet .podcast-detail-sheet__rating-cell--own.is-episode-rating-locked .podcast-detail-sheet__own-rating-picker"
);
const lockedScoreRules = mobileDetailCss.slice(lockedScoreStart, mobileDetailCss.indexOf("html body #podcastDetailSheet .podcast-detail-sheet__rating-cell--own .podcast-detail-sheet__episode-rating-lock-help", lockedScoreStart));
assert.ok(lockedScoreStart >= 0, "mobile calculated-score rules exist");
assert.match(lockedScoreRules, /align-items:\s*baseline\s*!important/u);
assert.match(lockedScoreRules, /height:\s*auto\s*!important/u);
assert.match(lockedScoreRules, /font:\s*950\s+1\.18rem\/1\s+"Manrope"/u);
assert.match(lockedScoreRules, /own-rating-suffix[\s\S]*align-self:\s*baseline[\s\S]*font:\s*900\s+\.72rem\/1/u);
assert.match(mobileDetailCss, /podcast-detail-sheet__ratings strong[\s\S]*font-size:\s*1\.18rem\s*!important/u);
assert.match(mobileDetailCss, /podcast-detail-sheet__ratings strong small[\s\S]*font-size:\s*\.72rem\s*!important/u);

const bindStart = app.indexOf("function bindPodcastEpisodeOverviewEvents(");
const bindEnd = app.indexOf("\nfunction ", bindStart + 1);
const bind = app.slice(bindStart, bindEnd);
assert.ok(bindStart >= 0, "episode workspace event binder exists");
assert.match(bind, /window\.matchMedia\("\(max-width: 768px\)"\)/u);
assert.match(bind, /\? dialog\.querySelector\("\[data-podcast-detail-content\]"\)\s*:\s*tableWrap/u);
assert.match(bind, /scrollContainer\.addEventListener\("scroll", async \(event\)/u);
assert.match(bind, /currentScrollContainer\.scrollTop \+ currentScrollContainer\.clientHeight/u);
assert.match(bind, /currentOverview\.querySelector\("\[data-episode-workspace-rows\]"\)/u);
assert.match(bind, /fetchGenstartEpisodes\(\{ append: true \}\)/u);
assert.match(app, /mergeEpisodes\(episodeState\.items, rows\)/u);

console.log("Mobile podcast-detail score and episode-scroll regression checks passed.");
