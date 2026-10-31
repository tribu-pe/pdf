const UNITS = [
  '',
  'UNO',
  'DOS',
  'TRES',
  'CUATRO',
  'CINCO',
  'SEIS',
  'SIETE',
  'OCHO',
  'NUEVE',
  'DIEZ',
  'ONCE',
  'DOCE',
  'TRECE',
  'CATORCE',
  'QUINCE',
  'DIECISÉIS',
  'DIECISIETE',
  'DIECIOCHO',
  'DIECINUEVE',
  'VEINTE',
  'VEINTIUNO',
  'VEINTIDÓS',
  'VEINTITRÉS',
  'VEINTICUATRO',
  'VEINTICINCO',
  'VEINTISÉIS',
  'VEINTISIETE',
  'VEINTIOCHO',
  'VEINTINUEVE',
];
const TENS = [
  '',
  '',
  '',
  'TREINTA',
  'CUARENTA',
  'CINCUENTA',
  'SESENTA',
  'SETENTA',
  'OCHENTA',
  'NOVENTA',
];
const HUNDREDS = [
  '',
  'CIENTO',
  'DOSCIENTOS',
  'TRESCIENTOS',
  'CUATROCIENTOS',
  'QUINIENTOS',
  'SEISCIENTOS',
  'SETECIENTOS',
  'OCHOCIENTOS',
  'NOVECIENTOS',
];

/** 1–999 in words. */
function upTo999(value: number): string {
  if (value === 100) return 'CIEN';
  const hundreds = Math.floor(value / 100);
  const rest = value % 100;
  const parts = hundreds > 0 ? [HUNDREDS[hundreds] ?? ''] : [];
  if (rest > 0 && rest < 30) parts.push(UNITS[rest] ?? '');
  else if (rest >= 30) {
    const unit = rest % 10;
    parts.push(
      unit === 0 ? (TENS[rest / 10] ?? '') : `${TENS[Math.floor(rest / 10)]} Y ${UNITS[unit]}`,
    );
  }
  return parts.join(' ');
}

/** Before MIL or MILLÓN, "uno" shortens: VEINTIÚN MIL, TREINTA Y UN MILLONES. */
function shortened(words: string): string {
  if (words.endsWith('VEINTIUNO')) return `${words.slice(0, -'VEINTIUNO'.length)}VEINTIÚN`;
  return words.endsWith('UNO') ? words.slice(0, -1) : words;
}

/** A whole number from 0 to 999 999 999 999 in Spanish words, upper case. */
export function inWords(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 999_999_999_999) {
    throw new RangeError(`inWords takes a whole number from 0 to 999 999 999 999, not ${value}.`);
  }
  if (value === 0) return 'CERO';
  const millions = Math.floor(value / 1_000_000);
  const thousands = Math.floor((value % 1_000_000) / 1000);
  const units = value % 1000;
  const parts: string[] = [];
  if (millions === 1) parts.push('UN MILLÓN');
  else if (millions > 1) parts.push(`${shortened(inWords(millions))} MILLONES`);
  if (thousands === 1) parts.push('MIL');
  else if (thousands > 1) parts.push(`${shortened(upTo999(thousands))} MIL`);
  if (units > 0) parts.push(upTo999(units));
  return parts.join(' ');
}

/**
 * The amount in words as Peruvian documents print it: "SON: DOSCIENTOS TREINTA Y SEIS CON
 * 00/100 SOLES". `amount` is the document total with two decimals.
 */
export function amountInWords(amount: string, currency: string): string {
  const [whole = '0', cents = '00'] = amount.split('.');
  return `SON: ${inWords(Number(whole))} CON ${cents.padEnd(2, '0').slice(0, 2)}/100 ${currency}`;
}
