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
assert.match(lockedScoreRules, /font:\s*950\s+1\.18rem\/1\s+"Manrope"/u);
assert.match(lockedScoreRules, /own-rating-suffix[\s\S]*align-self:\s*baseline[\s\S]*font:\s*900\s+\.72rem\/1/u);
assert.match(mobileDetailCss, /podcast-detail-sheet__ratings strong[\s\S]*font-size:\s*1\.18rem\s*!important/u);
assert.match(mobileDetailCss, /podcast-detail-sheet__ratings strong small[\s\S]*font-size:\s*\.72rem\s*!important/u);
assert.match(
  mobileDetailCss,
  /podcast-detail-sheet__ratings > \.podcast-detail-sheet__rating-cell[\s\S]*grid-template-rows:\s*20px\s+24px\s+19px\s+minmax\(0,\s*1fr\)[\s\S]*rating-cell--mads > strong,[\s\S]*rating-cell--users > strong[\s\S]*grid-row:\s*3/u
);
assert.match(
  mobileDetailCss,
  /rating-cell--own\.is-episode-rating-locked \{\s*grid-template-rows:\s*20px\s+24px\s+19px\s+minmax\(0,\s*1fr\)[\s\S]*grid-template-columns:/u
);
assert.match(
  mobileDetailCss,
  /is-episode-rating-locked > \.podcast-detail-sheet__rating-label \{\s*grid-row:\s*2[\s\S]*grid-column:\s*1\s*\/\s*-1/u
);
assert.match(
  lockedScoreRules,
  /own-rating-picker \{\s*display:\s*contents\s*!important/u,
  "the calculated picker cannot span the score and helper rows"
);
assert.doesNotMatch(lockedScoreRules, /grid-row:\s*3\s*\/\s*span\s+2/u, "no calculated-score wrapper may span rows 3 and 4");
assert.match(lockedScoreRules, /rating-icon \{\s*grid-row:\s*1[\s\S]*grid-column:\s*2/u, "calculated icon occupies row 1");
assert.match(lockedScoreRules, /own-rating-copy \{\s*display:\s*contents/u, "calculated score and helper participate in the parent grid");
assert.match(lockedScoreRules, /own-rating-input\.is-episode-calculated \{\s*grid-row:\s*3/u, "calculated score occupies row 3");
assert.match(lockedScoreRules, /inline-size:\s*3ch[\s\S]*block-size:\s*19px/u, "calculated input is constrained to the score slot");
assert.match(lockedScoreRules, /own-rating-suffix \{\s*grid-row:\s*3/u, "calculated suffix occupies row 3");
assert.match(lockedScoreRules, /own-rating-copy small \{\s*grid-row:\s*4/u, "calculated helper occupies row 4");
assert.match(lockedScoreRules, /is-episode-rating-locked > em \{\s*display:\s*none/u, "only one locked helper occupies row 4");
assert.match(app, /is-episode-calculated[\s\S]*Beregnet fra episoder[\s\S]*own-rating-suffix">\/10/u, "calculated markup retains its value, helper, and suffix");

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
