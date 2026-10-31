import { describe, expect, test } from 'vitest';
import { date, fixed, money, quantity } from './format';

describe('format', () => {
  test('fixed rounds half-up without floating point', () => {
    expect(fixed('1038.4')).toBe('1038.40');
    expect(fixed('8.475')).toBe('8.48'); // 8.475 as a float would give 8.47
    expect(fixed('8.4745762712')).toBe('8.47');
    expect(fixed('0.005')).toBe('0.01');
    expect(fixed(12)).toBe('12.00');
    expect(fixed('999.995')).toBe('1000.00');
  });

  test('money groups thousands', () => {
    expect(money('1180')).toBe('1,180.00');
    expect(money('1234567.891')).toBe('1,234,567.89');
    expect(money('59')).toBe('59.00');
  });

  test('quantity drops trailing zeros', () => {
    expect(quantity('2')).toBe('2');
    expect(quantity('2.500')).toBe('2.5');
  });

  test('date is day/month/year', () => {
    expect(date('2026-10-31')).toBe('31/10/2026');
  });

  test('refuses something that is not an amount', () => {
    expect(() => fixed('abc')).toThrow(TypeError);
  });
});
