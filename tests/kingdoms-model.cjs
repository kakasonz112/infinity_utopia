const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

// Load the pure TypeScript calculations without starting Next.js or contacting Firebase.
const filename = path.resolve(__dirname, '../src/app/kingdoms/model.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { summarize, remainingTicks, expiryDate, compareKingdoms, kingdomKey } = loaded.exports;
const validationPath = path.resolve(__dirname, '../src/app/kingdoms/validation.ts');
const validationModule = new Module(validationPath, module);
validationModule._compile(ts.transpileModule(fs.readFileSync(validationPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 },
}).outputText, validationPath);
const { parseKingdoms, parseCeasefires } = validationModule.exports;
const now = Date.UTC(2026, 0, 1);
const kingdom = (id, overrides = {}) => ({ kingdomNumber: id, kingdomIsland: '1', kingdomName: `Kingdom ${id}`, honor: 0, totalLand: 100, networth: 1000, provinceCount: 1, warsWon: 0, warsConcluded: 0, warScore: 0, provinces: [{ race: 'Elf' }], ...overrides });

test('empty selections have no fabricated medians, leaders, or race percentages', () => {
  const s = summarize([], {}, now);
  assert.equal(s.medianLand, null);
  assert.equal(s.medianNetworth, null);
  assert.equal(s.bestRate, null);
  assert.equal(s.largestLand, null);
  assert.equal(s.raceTotal, 0);
  assert.deepEqual(s.leaders, []);
});

test('statistics use the supplied selection, handle even medians, and retain war-record ties', () => {
  const a = kingdom(1, { totalLand: 100, networth: 1000, warsWon: 3, warsConcluded: 3 });
  const b = kingdom(2, { totalLand: 300, networth: 5000, warsWon: 4, warsConcluded: 4, provinces: [{ race: 'Orc' }] });
  const s = summarize([a, b], {}, now);
  assert.equal(s.medianLand, 200);
  assert.equal(s.medianNetworth, 3000);
  assert.equal(s.provinces, 2);
  assert.equal(s.raceTotal, 2);
  assert.deepEqual(s.races, [['Elf', 1], ['Orc', 1]]);
  assert.deepEqual(s.leaders.map(k => k.kingdomNumber), [1, 2]);
  assert.equal(s.largestLand.kingdomNumber, 2);
  assert.equal(summarize([kingdom(3, { warsWon: 2, warsConcluded: 2 })], {}, now).bestRate, null);
  assert.equal(summarize([kingdom(4, { warsConcluded: 3 })], {}, now).bestRate, 0);
});

test('ceasefire preserves the two-tick cushion and expires at the adjusted boundary', () => {
  const record = { isCeasefire: true, timestamp: now, warsConcluded: 1 };
  assert.equal(remainingTicks(record, now), 98);
  assert.equal(remainingTicks(record, now + 96 * 3600000), 2);
  assert.equal(remainingTicks(record, now + 98 * 3600000), 0);
  assert.equal(remainingTicks(undefined, now), 0);
  assert.equal(remainingTicks({ ...record, isCeasefire: false }, now), 0);
  assert.equal(expiryDate(record, '2026-01-01 00:00:00'), 'May 3 YR 0');
  assert.equal(expiryDate(record, 'invalid'), null);
});

test('ending-soon summary excludes expired records and includes the 12-tick boundary', () => {
  const kingdoms = [kingdom(1), kingdom(2), kingdom(3)];
  const cf = Object.fromEntries(kingdoms.map((k, i) => [kingdomKey(k), { isCeasefire: true, timestamp: now - [86, 97, 98][i] * 3600000, warsConcluded: 1 }]));
  const s = summarize(kingdoms, cf, now);
  assert.equal(s.endingSoon, 2);
  assert.deepEqual(s.active.map(r => r.kingdom.kingdomNumber), [2, 1]);
});

test('multi-column sorting uses priority, numeric locations, and original order when cleared', () => {
  const a = kingdom(2, { networth: 1000, totalLand: 200 });
  const b = kingdom(10, { networth: 1000, totalLand: 100 });
  assert.ok(compareKingdoms(a, b, [{ key: 'location', direction: 'ASC' }], {}, now) < 0);
  assert.ok(compareKingdoms(a, b, [{ key: 'networth', direction: 'DESC' }, { key: 'totalLand', direction: 'DESC' }], {}, now) < 0);
  assert.equal(compareKingdoms(a, b, [], {}, now), 0);
});

test('land and networth have independent kingdom and province medians, totals, and leaders', () => {
  const a = kingdom(1, { totalLand: 900, networth: 1000, provinces: [
    { name: 'Wide', land: 500, networth: 100 },
    { name: 'Small', land: 100, networth: 200 },
  ] });
  const b = kingdom(2, { totalLand: 300, networth: 9000, provinces: [
    { name: 'Rich', land: 200, networth: 900 },
  ] });
  const s = summarize([a, b], {}, now);
  assert.equal(s.totalLand, 1200);
  assert.equal(s.totalNetworth, 10000);
  assert.equal(s.medianLand, 600);
  assert.equal(s.medianNetworth, 5000);
  assert.equal(s.medianProvinceLand, 200);
  assert.equal(s.medianProvinceNetworth, 200);
  assert.equal(s.provinceLandCount, 3);
  assert.equal(s.provinceNetworthCount, 3);
  assert.equal(s.largestLand.kingdomNumber, 1);
  assert.equal(s.largestNetworth.kingdomNumber, 2);
  assert.equal(s.largestProvinceLand.province.name, 'Wide');
  assert.equal(s.largestProvinceNetworth.province.name, 'Rich');
  assert.equal(s.largestProvinceNetworth.kingdom.kingdomNumber, 2);
  const selected = summarize([b], {}, now);
  assert.equal(selected.totalLand, 300);
  assert.equal(selected.medianProvinceLand, 200);
  assert.equal(selected.largestProvinceLand.province.name, 'Rich');
});

test('province measurements exclude invalid values independently and preserve valid zero values', () => {
  const s = summarize([kingdom(1, { provinces: [
    { name: 'Land only', land: 100, networth: undefined },
    { name: 'NW only', land: null, networth: 800 },
    { name: 'Zero', land: 0, networth: 0 },
    { name: 'Invalid', land: NaN, networth: -1 },
    { name: 'Infinite', land: Infinity, networth: Infinity },
  ] })], {}, now);
  assert.equal(s.provinceLandCount, 2);
  assert.equal(s.provinceNetworthCount, 2);
  assert.equal(s.medianProvinceLand, 50);
  assert.equal(s.medianProvinceNetworth, 400);
  const empty = summarize([], {}, now);
  assert.equal(empty.medianProvinceLand, null);
  assert.equal(empty.medianProvinceNetworth, null);
  assert.equal(empty.largestProvinceLand, null);
  assert.equal(empty.largestProvinceNetworth, null);
});

test('ties are retained independently for each kingdom and province gauge', () => {
  const a = kingdom(1, { totalLand: 400, networth: 1000, provinces: [{ name: 'A', land: 200, networth: 100 }] });
  const b = kingdom(2, { totalLand: 400, networth: 2000, provinces: [{ name: 'B', land: 200, networth: 300 }] });
  const c = kingdom(3, { totalLand: 100, networth: 2000, provinces: [{ name: 'C', land: 100, networth: 300 }] });
  const s = summarize([a, b, c], {}, now);
  assert.deepEqual(s.landLeaders.map(k => k.kingdomNumber), [1, 2]);
  assert.deepEqual(s.networthLeaders.map(k => k.kingdomNumber), [2, 3]);
  assert.deepEqual(s.provinceLandLeaders.map(row => row.province.name), ['A', 'B']);
  assert.deepEqual(s.provinceNetworthLeaders.map(row => row.province.name), ['B', 'C']);
});

test('snapshot validation rejects malformed or duplicate records and normalizes province measurements separately', () => {
  const valid = kingdom(1, { provinces: [{ slot: 1, name: 'Test', protected: false, land: 120, networth: null }] });
  const payload = rows => ({ kingdoms: { kingdoms: rows, startDate: '2026-01-01 00:00:00' } });
  const parsed = parseKingdoms(payload([valid]));
  assert.equal(parsed.kingdoms[0].provinces[0].land, 120);
  assert.ok(Number.isNaN(parsed.kingdoms[0].provinces[0].networth));
  const s = summarize(parsed.kingdoms, {}, now);
  assert.equal(s.medianProvinceLand, 120);
  assert.equal(s.medianProvinceNetworth, null);
  assert.equal(s.largestProvinceNetworth, null);
  assert.throws(() => parseKingdoms(payload([valid, valid])), /Duplicate/);
  assert.throws(() => parseKingdoms(payload([{ ...valid, networth: '1000' }])), /Invalid/);
  assert.throws(() => parseKingdoms(payload([{ ...valid, provinces: null }])), /Invalid/);
  assert.throws(() => parseKingdoms(payload([{ ...valid, warsWon: 1, warsConcluded: 0 }])), /Invalid/);
});

test('ceasefire validation accepts an empty database but rejects invalid records', () => {
  assert.deepEqual(parseCeasefires({ data: {} }).data, {});
  const record = { timestamp: now, warsConcluded: 1, isCeasefire: true };
  assert.deepEqual(parseCeasefires({ data: { '1-1': record } }).data['1-1'], record);
  assert.throws(() => parseCeasefires({ data: { '1-1': { ...record, timestamp: 'invalid' } } }), /Invalid/);
  assert.throws(() => parseCeasefires({ data: [] }), /Invalid/);
});
