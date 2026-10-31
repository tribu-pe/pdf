import { describe, expect, test } from 'vitest';
import { amountInWords, inWords } from './words';

describe('inWords', () => {
  test.each([
    [0, 'CERO'],
    [1, 'UNO'],
    [15, 'QUINCE'],
    [16, 'DIECISÉIS'],
    [21, 'VEINTIUNO'],
    [22, 'VEINTIDÓS'],
    [30, 'TREINTA'],
    [31, 'TREINTA Y UNO'],
    [99, 'NOVENTA Y NUEVE'],
    [100, 'CIEN'],
    [101, 'CIENTO UNO'],
    [236, 'DOSCIENTOS TREINTA Y SEIS'],
    [500, 'QUINIENTOS'],
    [1000, 'MIL'],
    [1001, 'MIL UNO'],
    [1180, 'MIL CIENTO OCHENTA'],
    [21_000, 'VEINTIÚN MIL'],
    [31_000, 'TREINTA Y UN MIL'],
    [100_000, 'CIEN MIL'],
    [999_999, 'NOVECIENTOS NOVENTA Y NUEVE MIL NOVECIENTOS NOVENTA Y NUEVE'],
    [1_000_000, 'UN MILLÓN'],
    [2_500_000, 'DOS MILLONES QUINIENTOS MIL'],
    [21_000_000, 'VEINTIÚN MILLONES'],
    [1_000_000_000, 'MIL MILLONES'],
  ])('%i → %s', (value, words) => {
    expect(inWords(value)).toBe(words);
  });

  test('refuses what it cannot say', () => {
    expect(() => inWords(-1)).toThrow(RangeError);
    expect(() => inWords(1.5)).toThrow(RangeError);
  });
});

describe('amountInWords', () => {
  test('the total, its cents over 100 and the currency', () => {
    expect(amountInWords('236.00', 'SOLES')).toBe(
      'SON: DOSCIENTOS TREINTA Y SEIS CON 00/100 SOLES',
    );
    expect(amountInWords('1038.40', 'SOLES')).toBe('SON: MIL TREINTA Y OCHO CON 40/100 SOLES');
    expect(amountInWords('590.05', 'DÓLARES AMERICANOS')).toBe(
      'SON: QUINIENTOS NOVENTA CON 05/100 DÓLARES AMERICANOS',
    );
  });
});
