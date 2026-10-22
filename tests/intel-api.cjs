const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function load(file, overrides = {}) {
  const source = fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const m = { exports: {} };
  new Function('require', 'module', 'exports', compiled)(name => Object.hasOwn(overrides, name) ? overrides[name] : require(name), m, m.exports);
  return m.exports;
}
const params = load('src/lib/intelParams.ts');
class ApiError extends Error { constructor(status) { super('upstream'); this.status = status; } }
const own = { kingdom: { location: '4:8', provinces: [{ land: 500, networth: 100000 }, { land: 700, networth: 150000 }] }, currentTick: { tickNumber: 100 } };
function route(service = {}) {
  const calls = [];
  const api = {
    IntelApiError: ApiError,
    getIntelKingdom: async (...args) => { calls.push(['kingdom', ...args]); return own; },
    requestIntel: async (...args) => { calls.push(args); return [{ sample: true }]; },
    ...service,
  };
  const { GET } = load('src/app/api/intel-data/route.ts', {
    '@/lib/intelParams': params, '@/lib/utopiaIntel': api,
    'next/server': { NextResponse: { json: (data, options) => new Response(JSON.stringify(data), options) } },
  });
  return { calls, get: query => GET(new Request(`http://localhost/api/intel-data?${query}`)) };
}
test('location validation normalizes and rejects injected paths, zero coordinates and unsupported servers', () => {
  assert.deepEqual(params.intelParams(new URLSearchParams('server=1&location=005:011')), { server: 1, location: '5:11' });
  for (const q of ['location=0:11','location=5:0','location=https://example.com','location=5:11%26admin=true','server=2','server=3','server=1.5']) assert.throws(() => params.intelParams(new URLSearchParams(q)), params.IntelInputError);
});
test('unknown and excluded resources cannot reach upstream', async () => {
  const r = route();
  for (const name of ['ops','users','news','https://example.com','WarPlan/v1/Post']) assert.equal((await r.get(`resource=${name}`)).status, 400);
  assert.equal(r.calls.length, 0);
});
test('invalid ranges are rejected before any data is fetched', async () => {
  const r = route();
  for (const q of ['resource=archive&slot=0','resource=archive&slot=26','resource=history&numberTicks=289','resource=history&tickId=-1','resource=search&provinces=26','resource=search&acres=NaN']) assert.equal((await r.get(q)).status, 400);
  assert.equal(r.calls.length, 0);
});
test('archive uses selected server, enemy coordinates and province slot', async () => {
  const r = route(); const res = await r.get('resource=archive&side=enemy&server=1&location=6:7&slot=12');
  assert.equal(res.status, 200); assert.equal(res.headers.get('Cache-Control'), 'private, no-store');
  assert.equal(r.calls[0][0], 'Province/v1/SotArchive?server=1&location=6%3A7&slot=12');
});
test('own plan resolves the current own kingdom instead of enemy coordinates', async () => {
  const r = route(); await r.get('resource=war-plan&side=own&server=1&location=6:7');
  assert.deepEqual(r.calls[0], ['kingdom', false, 1]);
  assert.equal(r.calls[1][0], 'WarPlan/v1/Get?server=1&location=4%3A8');
});
test('missing plans are empty results but denied access remains an error', async () => {
  let r = route({ requestIntel: async () => { throw new ApiError(404); } });
  const res = await r.get('resource=war-plan'); assert.equal(res.status, 200); assert.equal((await res.json()).data, null);
  r = route({ requestIntel: async () => { throw new ApiError(403); } });
  const denied = await r.get('resource=war-plan'); assert.equal(denied.status, 403); assert.match((await denied.json()).error, /does not have access/);
});
test('search defaults to current own kingdom totals and permits explicit targets', async () => {
  const r = route(); await r.get('resource=search');
  assert.deepEqual(r.calls[1], ['Kingdom/v1/Search', { server: 1, acres: 1200, networth: 250000, provinces: 2 }]);
  r.calls.length = 0; await r.get('resource=search&server=1&acres=5000&networth=900000&provinces=20');
  assert.deepEqual(r.calls, [['Kingdom/v1/Search', { server: 1, acres: 5000, networth: 900000, provinces: 20 }]]);
});
test('history derives a recent window and passes the selected enemy', async () => {
  const r = route(); await r.get('resource=history&location=6:7&numberTicks=24');
  assert.deepEqual(r.calls[1], ['Kingdom/v1/Ticks', { server: 1, numberTicks: 24, locations: ['4:8', '6:7'], tickId: 77 }]);
  await r.get('resource=history&location=4:8&numberTicks=10&tickId=0');
  assert.deepEqual(r.calls.at(-1)[1], { server: 1, numberTicks: 10, locations: ['4:8'], tickId: 0 });
});
test('recent and reference routes dispatch only known read endpoints on every invocation', async () => {
  const r = route();
  for (const resource of ['recent','races','ticks','recent']) assert.equal((await r.get(`resource=${resource}&server=1`)).status, 200);
  assert.deepEqual(r.calls.map(c => c[0]), ['Kingdom/v1/Recent?server=1','Data/v1/RaceCombos/1','Data/v1/Ticks','Kingdom/v1/Recent?server=1']);
});
test('upstream diagnostics and secrets are never returned in route errors', async () => {
  const r = route({ requestIntel: async () => { throw new Error('sensitive token or password'); } });
  const res = await r.get('resource=recent'); assert.equal(res.status, 502); assert.doesNotMatch(await res.text(), /sensitive|password|token/);
});
test('shared API client renews tokens and never caches data requests', async t => {
  const previous = { username: process.env.UTOPIA_INTEL_USERNAME, password: process.env.UTOPIA_INTEL_PASSWORD };
  process.env.UTOPIA_INTEL_USERNAME = 'test'; process.env.UTOPIA_INTEL_PASSWORD = 'test-only';
  t.after(() => { for (const [key, value] of Object.entries({UTOPIA_INTEL_USERNAME:previous.username,UTOPIA_INTEL_PASSWORD:previous.password})) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } });
  const calls = []; let logins = 0, requests = 0;
  const payload = { kingdom: { location:'6:7', provinces:[{sot:{money:42}}] }, currentTick:{tickNumber:5} };
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('auth/v1/login')) return Response.json({ token: `token-${++logins}` });
    if (++requests === 1) return new Response(null, { status: 401 });
    return Response.json(payload);
  });
  const client = load('src/lib/utopiaIntel.ts', { 'server-only': {} });
  assert.deepEqual(await client.getIntelKingdom(true,1,'6:7'), payload);
  assert.deepEqual(await client.getIntelKingdom(true,1,'6:7'), payload);
  assert.equal(logins,2); assert.equal(requests,3);
  assert.ok(calls.every(c => c.options.cache === 'no-store'));
  assert.match(calls.at(-1).url, /EnemyKingdom\?server=1&location=6%3A7$/);
  assert.equal(calls.at(-1).options.headers['Utopia-Token'],'token-2');
});
