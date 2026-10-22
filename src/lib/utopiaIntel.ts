import 'server-only';

const BASE = 'https://api.intel.utopia.site/';
let token: { value: string; expires: number } | undefined;
let loginPending: Promise<string> | undefined;

async function login(): Promise<string> {
  if (token && token.expires > Date.now()) return token.value;
  if (loginPending) return loginPending;
  loginPending = (async () => {
    const username = process.env.UTOPIA_INTEL_USERNAME;
    const password = process.env.UTOPIA_INTEL_PASSWORD;
    if (!username || !password) throw new Error('Kingdom intel credentials are not configured on the server.');
    const response = await fetch(`${BASE}auth/v1/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, isDev: false }),
      cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new Error('Kingdom intel login failed.');
    const data = await response.json();
    if (typeof data.token !== 'string' || !data.token) throw new Error('Kingdom intel login returned no token.');
    token = { value: data.token, expires: Date.now() + 10 * 60 * 1000 };
    return token.value;
  })();
  try { return await loginPending; } finally { loginPending = undefined; }
}

export type IntelProvince = {
  [key: string]: unknown;
  id: number; name: string; race: string;
  land: number | null; networth: number | null;
};
export type IntelKingdom = {
  [key: string]: unknown;
  kingdomName: string; location: string; war: boolean; eowcf: boolean;
  provinces: IntelProvince[];
};
export type IntelResponse = { kingdom: IntelKingdom; [key: string]: unknown };

export class IntelApiError extends Error {
  constructor(public status: number) { super('The intel service could not return this data.'); }
}

/** Only call with paths constructed by our own resource handlers. */
export async function requestIntel(path: string, body?: object): Promise<unknown> {
  const request = async () => fetch(`${BASE}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'Utopia-Token': await login(), Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store', signal: AbortSignal.timeout(15000),
  });
  let response = await request();
  if (response.status === 401 || response.status === 403) {
    token = undefined;
    response = await request();
  }
  if (!response.ok) throw new IntelApiError(response.status);
  return response.json();
}

export async function getIntelKingdom(enemy: boolean, server = 1, location = '5:11'): Promise<IntelResponse> {
  const query = new URLSearchParams({ server: String(server), ...(enemy ? { location } : {}) });
  const data = await requestIntel(`Kingdom/v1/${enemy ? 'EnemyKingdom' : 'OwnKingdom'}?${query}`) as IntelResponse;
  const { kingdom } = data;
  if (!kingdom || typeof kingdom.location !== 'string' || !Array.isArray(kingdom.provinces)) {
    throw new Error('The kingdom intel service returned an invalid response.');
  }
  // Preserve the complete kingdom endpoint response, including nested intel and
  // top-level metadata. The separate authentication response never leaves here.
  return data as IntelResponse;
}
