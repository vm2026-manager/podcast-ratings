// Read existing identities; never invent catalogue rows or discard duplicates.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const root = path.resolve(process.argv[2] || '.');
const app = readFileSync(path.join(root, 'app.js'), 'utf8');
const name = 'LOCAL_CANONICAL_CATALOGUE_ROWS';
const start = app.indexOf(`const ${name} = Object.freeze([`);
const end = app.indexOf('\n}]);', start);
if (start < 0 || end < start) throw new Error('Review local catalogue declaration structure');
const local = vm.runInNewContext(`${app.slice(start, end + 5)}; ${name}`, {}, { timeout: 1000 });
const rows = JSON.parse(readFileSync(path.join(root, 'data/podcasts.json'), 'utf8')).rows;
if (!Array.isArray(rows) || !Array.isArray(local)) throw new Error('Invalid catalogue');
const aliasName = 'MEDIANO_LEGACY_CATALOGUE_CANONICAL_IDS';
const aliasStart = app.indexOf(`const ${aliasName} = Object.freeze({`);
const aliasEnd = app.indexOf('\n});', aliasStart);
if (aliasStart < 0 || aliasEnd < aliasStart) throw new Error('Review canonical alias declaration structure');
const aliases = vm.runInNewContext(`${app.slice(aliasStart, aliasEnd + 4)}; ${aliasName}`, {}, { timeout: 1000 });
const catalogue = [...rows, ...local];
const ids = new Set(catalogue.map(row => row['Podcast-ID']));
// Match the app's explicit historical-row suppression; no title inference.
process.stdout.write(JSON.stringify(catalogue.filter(row => {
  const target = aliases[row['Podcast-ID']];
  return !target || !ids.has(target);
})));
