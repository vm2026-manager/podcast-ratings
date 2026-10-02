import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const app = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const config = JSON.parse(fs.readFileSync(new URL('../data/podcast-display-groups.json', import.meta.url)));
const payload = JSON.parse(fs.readFileSync(new URL('../data/podcasts.json', import.meta.url)));
const rows = Array.isArray(payload) ? payload : payload.rows;
const group = config.groups.find(g => g.id === 'narkobetjenten');
function extract(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  const rest = app.slice(start);
  const next = rest.slice(1).search(/\n(?:async )?function /);
  return next < 0 ? rest : rest.slice(0, next + 1);
}
const norm = value => String(value || '').trim();
const comparable = value => norm(value).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' og ').replace(/\s+/g, ' ');
const match = value => comparable(value).replace(/[^a-z0-9æøå ]/g, ' ').replace(/\s+/g, ' ').trim();
const state = { podcasts: rows.map(row => ({ title: row.Titel, podcastId: row['Podcast-ID'], legacyKey: match(row.Titel), ratingValue: row['Vuring (1-10)'] })), communityStatsByKey: {}, displayGroupCommunityStatsById: {}, podcastDisplayGroups: config.groups, podcastDisplayGroupById: { narkobetjenten: group }, podcastById: {}, podcastByLegacyKey: {} };
state.podcasts.forEach(p => { state.podcastById[p.podcastId] = p; state.podcastByLegacyKey[p.legacyKey] = p; });
const rated = new Map();
const rateButtons = [];
const content = { classList: { add() {} }, innerHTML: '', querySelector() { return null; }, querySelectorAll(selector) { return selector === '[data-podcast-season-rate]' ? rateButtons : []; } };
let opened;
const context = vm.createContext({ state, normalizeText: norm, normalizeComparable: comparable, normalizeMatchKey: match,
  LEGACY_PODCAST_RATING_KEY_ALIASES: {}, MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS: {},
  mapPodcast: (row) => ({ title: row.Titel, podcastId: row['Podcast-ID'], legacyKey: match(row.Titel), ratingValue: null }),
  buildSearchText: values => values.join(' '), averageNumbers: values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null,
  getUserRating: key => rated.get(key) ?? null, escapeHtml: String, formatUserRatingCount: String,
  openRatingDialog: podcast => { opened = podcast; }
});
for (const name of ['parseNumber','formatCompactRating','getPodcastId','getPodcastKey','getLegacyPodcastKey','resolvePodcastByStoredKey','resolveCanonicalPodcastId','canonicalizeCommunityStats','getDisplayGroupSeasonIdentities','getDisplayGroupMemberPodcasts','getDisplayGroupUserStats','createRankingDisplayGroup','getRankingCandidates','getCommunityStat','hasCommunityRating','getDisplayGroupSeasonNumber','getDisplayGroupSeasonLabel','getDisplayGroupOwnRatingStats','renderPodcastDisplayGroupSeasonWorkspace']) vm.runInContext(extract(name),context);
const snapshot = JSON.stringify(state.podcasts);
const identities = context.getDisplayGroupSeasonIdentities(group);
assert.deepEqual(Array.from(identities, p=>p.podcastId), [4,5,8,16,17,18,19,20,21,22,23,24].map(n=>`display-season:narkobetjenten:${n}`));
for (const p of identities) {
  assert.ok(!state.podcastById[p.podcastId], 'Synthetic keys must not collide with catalogue IDs');
  state.podcastById[p.podcastId] = p;
  assert.equal(context.resolveCanonicalPodcastId(p.podcastId), p.podcastId);
  assert.equal(p.ratingValue, null);
}
const members = context.getDisplayGroupMemberPodcasts(group);
assert.equal(members.length,24);
assert.deepEqual(Array.from(members,context.getDisplayGroupSeasonNumber).sort((a,b)=>a-b),Array.from({length:24},(_,i)=>i+1));
assert.ok(members.every(p=>p.podcastId !== 'narkobetjenten pa gaden sæson 1'));
const editorial = state.podcasts.filter(p=>group.memberLegacyKeys.includes(p.legacyKey));
assert.equal(editorial.length,12);
for(const p of editorial) assert.strictEqual(members.find(m=>m.podcastId===p.podcastId),p,'Use original catalogue object and score');
const display = context.createRankingDisplayGroup(group);
assert.equal(display.ratingValue,editorial.reduce((s,p)=>s+context.parseNumber(p.ratingValue),0)/12);
assert.equal(display.userAverageRating,null,'Do not fabricate deduplicated users from season stats');
state.communityStatsByKey = context.canonicalizeCommunityStats([{podcast_key:identities[0].podcastId,average_rating:9,rating_count:1}]).statsByKey;
state.displayGroupCommunityStatsById.narkobetjenten = { averageRating:7, ratingCount:2 };
assert.equal(context.createRankingDisplayGroup(group).userAverageRating,7);
assert.equal(context.getCommunityStat('display-group:narkobetjenten').ratingCount,2);
assert.equal(context.getCommunityStat(identities[0].podcastId).averageRating,9);
const candidates = context.getRankingCandidates();
assert.equal(candidates.filter(p=>p.isDisplayGroup).length,1);
assert.equal(candidates.filter(p=>p.isDisplayGroupSeason).length,0);
assert.ok(candidates.some(p=>p.podcastId==='narkobetjenten pa gaden sæson 1'));
assert.equal(JSON.stringify(state.podcasts),snapshot);
for(let i=0;i<24;i++) rateButtons.push({ dataset:{podcastSeasonRate:String(i)},addEventListener(event,handler){this.click=handler;} });
context.renderPodcastDisplayGroupSeasonWorkspace({ querySelector:selector=>selector==='[data-podcast-detail-content]'?content:null,classList:{add(){}} },display);
assert.ok(content.innerHTML.includes('24 sæsoner · 12 vurderet af Podcastlisten'));
assert.equal((content.innerHTML.match(/data-label="Podcastlisten"><strong>—/g)||[]).length,12);
assert.equal((content.innerHTML.match(/data-podcast-season-rate=/g)||[]).length,24);
for (const [i,button] of rateButtons.entries()) { button.click(); assert.equal(context.getDisplayGroupSeasonNumber(opened),i+1); rated.set(context.getPodcastKey(opened),i%2?8:6); }
assert.equal(context.getDisplayGroupOwnRatingStats(members).average,7);
assert.equal(context.getDisplayGroupOwnRatingStats(members).count,24);
assert.doesNotMatch(app,/\$\{members.length\} (?:vurderede sæsoner|sæsoner vurderet)/);
assert.match(app,/displayGroups.flatMap\(getDisplayGroupSeasonIdentities\)/);
console.log('PASS: 24 seasons, unchanged editorial identities/scores, rating actions, missing-score UI, ranking isolation, aggregate hydration.');
