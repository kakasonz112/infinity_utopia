export class IntelInputError extends Error {}

export function integer(value: string | null, fallback: number, min: number, max: number, label: string): number {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new IntelInputError(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return Number(value);
}

export function intelParams(query: URLSearchParams) {
  const server = integer(query.get('server'), 1, 1, 1, 'World of Legends server');
  const value = query.get('location') ?? '5:11';
  if (!/^\d{1,3}:\d{1,3}$/.test(value)) throw new IntelInputError('Location must be kingdom:island, for example 5:11.');
  const [kingdom, island] = value.split(':').map(Number);
  if (kingdom < 1 || island < 1) throw new IntelInputError('Kingdom and island must be positive numbers.');
  return { server, location: `${kingdom}:${island}` };
}
