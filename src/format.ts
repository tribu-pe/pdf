import type { Amount, Identifier } from './record';

/** Rounds a decimal string half-up to `places`, without floating point. */
function rounded(text: string, places: number): string {
  const negative = text.startsWith('-');
  const [whole = '0', fraction = ''] = (negative ? text.slice(1) : text).split('.');
  const digits = `${whole}${fraction.padEnd(places + 1, '0').slice(0, places + 1)}`;
  let scaled = BigInt(digits.slice(0, -1) || '0');
  if (Number(digits.at(-1)) >= 5) scaled += 1n;
  const padded = scaled.toString().padStart(places + 1, '0');
  const result = places === 0 ? padded : `${padded.slice(0, -places)}.${padded.slice(-places)}`;
  return negative && scaled !== 0n ? `-${result}` : result;
}

/** A plain decimal string from whatever a Record holds: number, string or Decimal. */
export function decimal(value: Amount): string {
  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) throw new TypeError(`"${text}" is not a decimal amount.`);
  return text;
}

/** Fixed decimals, half-up: "1038.4" → "1038.40". */
export function fixed(value: Amount, places = 2): string {
  return rounded(decimal(value), places);
}

/** Peruvian display: thousands with commas, decimals with a point. "1180" → "1,180.00". */
export function money(value: Amount, places = 2): string {
  const [whole = '0', fraction] = fixed(value, places).split('.');
  const sign = whole.startsWith('-') ? '-' : '';
  const digits = whole.replace('-', '').replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction === undefined ? `${sign}${digits}` : `${sign}${digits}.${fraction}`;
}

/** A quantity without trailing zeros: "2.500" → "2.5", "1" → "1". */
export function quantity(value: Amount): string {
  const text = decimal(value);
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text;
}

/** "2026-10-31" → "31/10/2026". */
export function date(iso: string): string {
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
}

export function identifier(value: Identifier): string {
  return typeof value === 'string' ? value : value.value;
}

const CURRENCIES: Readonly<Record<string, { symbol: string; words: string }>> = {
  PEN: { symbol: 'S/', words: 'SOLES' },
  USD: { symbol: 'US$', words: 'DÓLARES AMERICANOS' },
};

export function currencyOf(code: string): { code: string; symbol: string; words: string } {
  return { code, ...(CURRENCIES[code] ?? { symbol: code, words: code }) };
}
