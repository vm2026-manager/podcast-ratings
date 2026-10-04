import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(path.join(root, name), 'utf8');
const app = read('app.js');
const manifest = JSON.parse(read('data/podcast-cover-manifest.json'));
const registrations = JSON.parse(read('data/manual-podcast-cover-registrations.json')).registrations;
const rows = JSON.parse(execFileSync(process.execPath, ['scripts/manual-cover-catalogue.mjs', root], { cwd: root, maxBuffer: 32 * 1024 * 1024 }));
assert.ok(rows.some(r => r['Podcast-ID'] === 'mediano special'));
assert.ok(!rows.some(r => r['Podcast-ID'] === 'mediano special hvad siger data om superligaen'), 'Historical episode ID is not a current cover destination');
function extract(name) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0, name);
  let depth = 0;
  for (let i = start; i < app.length; i++) {
    if (app[i] === '{') depth++;
    if (app[i] === '}' && --depth === 0) return app.slice(start, i+1);
  }
  throw new Error(name);
}
const context = { state: { coverMetaByPrimarySrc: {}, userRatingPersistedKeyByCanonical: {} } };
vm.createContext(context);
for (const name of ['MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS', 'LEGACY_PODCAST_RATING_KEY_ALIASES']) {
  const declaration = app.match(new RegExp(`const ${name} = Object\\.freeze\\([\\s\\S]*?\\n\\}\\);`));
  assert.ok(declaration, name);
  vm.runInContext(declaration[0], context);
}
vm.runInContext(`function normalizeText(v) { return String(v ?? '').trim(); }
function normalizeImageSource(v) { return normalizeText(v); }
function normalizeMatchKey(v) { return normalizeText(v).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/&/g, ' og ').replace(/[^a-z0-9æøå]+/g, ' ').trim(); }
${['getPodcastId','getLegacyPodcastKey','getPodcastKey','getCoverManifestSignature','getManifestVariantEntries','normalizeCoverManifestEntries','applyLocalCoverManifest','resolvePodcastByStoredKey','resolveCanonicalPodcastId','getPersistedUserRatingKey'].map(extract).join('\n')}`, context);
const podcasts = rows.map(r => ({ podcastId: r['Podcast-ID'], title: r.Titel, publisher: r.Udgiver, host: r['Vært'] || '', image: r.Billedlink || '', rating: r['Vuring (1-10)'] }));
context.state.podcastById = Object.fromEntries(podcasts.map(p => [p.podcastId, p]));
context.state.podcastByLegacyKey = {};
const identities = podcasts.map(p => [context.getPodcastKey(p), p.title, p.rating]);
const ratings = Object.fromEntries(registrations.map((r,i) => [r.podcastId, 7+i]));
const ratingsBefore = structuredClone(ratings);
context.state.userRatingsByKey = ratings;
for (const r of registrations) context.state.userRatingPersistedKeyByCanonical[r.podcastId] = `stored:${r.podcastId}`;
const targetIds = new Set(registrations.map(r => r.podcastId));
const baseline = structuredClone(podcasts);
context.applyLocalCoverManifest(baseline, context.normalizeCoverManifestEntries({ podcasts: manifest.podcasts.filter(e => !targetIds.has(e.podcastId)) }));
context.applyLocalCoverManifest(podcasts, context.normalizeCoverManifestEntries(manifest));
assert.deepEqual(podcasts.filter(p => !targetIds.has(p.podcastId)), baseline.filter(p => !targetIds.has(p.podcastId)), 'Unrelated catalogue and cover resolution unchanged');
for (const r of registrations) {
  const podcast = podcasts.find(p => p.podcastId === r.podcastId);
  const entry = manifest.podcasts.find(e => e.podcastId === r.podcastId);
  assert.equal(podcast.localCoverVariants[0].path, entry.variants['1400'].path);
  assert.equal(podcast.preferExternalCoverSource, false);
  assert.equal(context.getPersistedUserRatingKey(r.podcastId), `stored:${r.podcastId}`);
}
assert.deepEqual(podcasts.map(p => [context.getPodcastKey(p), p.title, p.rating]), identities);
assert.deepEqual(context.state.userRatingsByKey, ratingsBefore);
const jennings = podcasts.find(p => p.podcastId === 'magasinet jennings');
const sport = podcasts.find(p => p.podcastId === 'mediano sport og perspektiv');
assert.notEqual(jennings.localCoverVariants[0].path, sport.localCoverVariants[0].path);
assert.equal(registrations.find(r => r.sourcePath.endsWith('/mediano jennings.png')).podcastId, sport.podcastId);
assert.equal(registrations.find(r => r.sourcePath.endsWith('/Magasinet Jennings.png')).podcastId, jennings.podcastId);
for (const id of ['mediano special','bruchmann ringer til','der var engang et mal','amerikas kolde drom dr','bandeland sæson 1','bandeland sæson 2']) {
  assert.ok(!registrations.some(r => r.podcastId === id), `${id} remains unresolved`);
}
assert.doesNotMatch(read('scripts/publish-manual-podcast-covers.ps1'), /HEAD:main|Invoke-Git|git push/);
console.log('Manual intake frontend identity, ratings, Jennings separation and no-publication checks passed.');
