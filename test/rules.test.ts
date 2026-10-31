import type { Content } from 'pdfmake/interfaces';
import { beforeAll, describe, expect, test } from 'vitest';
import {
  blocks,
  type PrintData,
  PrintRulesError,
  pdf,
  prepare,
  QR_RULES,
  qrModules,
  sunatQr,
  type Template,
  templates,
  verify,
} from '../src/index';
import { POINTS_PER_MM, qrGeometry } from '../src/qr';
import type { PrintableRecord } from '../src/record';
import { DEFAULT_THEME } from '../src/theme';
import { records } from './support/records';

// docs/sunat-rules.md; tribu docs/research/printed-representation-2026-11.md.
let all: Record<string, PrintableRecord>;
beforeAll(async () => {
  all = await records();
});

const dataOf = (name: string): PrintData => {
  const record = all[name];
  if (record === undefined) throw new Error(`no record ${name}`);
  return prepare(record);
};
const theme = DEFAULT_THEME;
const rules = (template: Template, data: PrintData) =>
  verify(template(data, { theme }), data).map((issue) => issue.rule);

/** A complete template, so each test can break exactly one thing. */
const complete =
  (qr: (data: PrintData) => Content = (data) => blocks.qr(data)): Template =>
  (data) => ({
    content: [
      blocks.heading(data, theme),
      blocks.issuer(data, theme),
      blocks.customer(data, theme),
      ...[blocks.affected(data, theme)].filter((block) => block !== null),
      blocks.items(data, theme),
      blocks.totals(data, theme),
      ...[blocks.detraccion(data, theme)].filter((block) => block !== null),
      qr(data),
      blocks.legends(data, theme),
    ],
  });

describe('the built-in templates follow every rule', () => {
  test.each(['a4', 'ticket80', 'ticket58'] as const)('%s, every variation', (format) => {
    for (const name of Object.keys(all)) {
      expect(rules(templates[format], dataOf(name)), `${name} in ${format}`).toEqual([]);
    }
  });

  test('a ticket of any allowed width too', () => {
    for (const width of [48, 112])
      expect(rules(templates.ticket(width), dataOf('receipt'))).toEqual([]);
  });

  test('the complete test template is valid, so each test below breaks one rule', () => {
    for (const name of Object.keys(all)) expect(rules(complete(), dataOf(name)), name).toEqual([]);
  });
});

describe('what every Printed Representation shows', () => {
  test("SUNAT's legend (Annexes I–IV, field 62)", () => {
    const template: Template = (data, context) => {
      const document = complete()(data, context);
      return { ...document, content: (document.content as Content[]).slice(0, -1) };
    };
    expect(rules(template, dataOf('invoice'))).toContain('document/legend');
  });

  test('"RUC" before the Issuer\'s number, the title, Series-Number, date and total', () => {
    const empty: Template = (data) => ({ content: [blocks.qr(data)] });
    expect(rules(empty, dataOf('invoice'))).toEqual(
      expect.arrayContaining([
        'issuer/name',
        'issuer/ruc',
        'document/title',
        'document/id',
        'document/issue-date',
        'document/total',
        'item/description',
        'item/unit-price',
        'customer/name',
        'customer/id',
      ]),
    );
  });

  test('a Receipt: each Item Value and tax, the total sales value and the subtotal', () => {
    const noValues: Template = (data) => ({
      content: [
        blocks.heading(data, theme),
        blocks.issuer(data, theme),
        ...data.items.map((item) => `${item.description} ${item.unitPrice}`),
        data.total,
        blocks.qr(data),
        blocks.legends(data, theme),
      ],
    });
    expect(rules(noValues, dataOf('receipt'))).toEqual(
      expect.arrayContaining(['receipt/item-value', 'receipt/item-igv', 'document/subtotals']),
    );
  });

  test('a note: the Affected Document, the Reason and the Unit Value', () => {
    const noAffected: Template = (data, context) => {
      const document = complete()(data, context);
      const content = (document.content as Content[]).filter(
        (block) =>
          block !== blocks.affected(data, theme) && !JSON.stringify(block).includes('Motivo'),
      );
      return { ...document, content };
    };
    expect(rules(noAffected, dataOf('credit-note'))).toEqual(
      expect.arrayContaining(['note/affected', 'note/reason']),
    );
  });

  test('legend 2006 on an Invoice with a detracción', () => {
    const noDetraccion: Template = (data, context) => {
      const document = complete()(data, context);
      const content = (document.content as Content[]).filter(
        (block) => !JSON.stringify(block).includes('Operación sujeta'),
      );
      return { ...document, content };
    };
    expect(rules(noDetraccion, dataOf('invoice-detraccion'))).toContain('detraccion/legend');
  });
});

describe('the QR (Annex 6 § 6.5)', () => {
  const qrText = () => dataOf('invoice').qr.text;

  test("exactly one, holding the Record's text", () => {
    expect(
      rules(
        complete(() => ''),
        dataOf('invoice'),
      ),
    ).toContain('qr/one');
    expect(
      rules(
        complete((data) => [blocks.qr(data), blocks.qr(data)] as Content),
        dataOf('invoice'),
      ),
    ).toContain('qr/one');
    expect(
      rules(
        complete(() => sunatQr('https://example.com', 80)),
        dataOf('invoice'),
      ),
    ).toContain('qr/content');
  });

  test('level Q', () => {
    const levelL = complete((data) => ({ ...sunatQr(data.qr.text, 80), eccLevel: 'L' }));
    expect(rules(levelL, dataOf('invoice'))).toContain('qr/level-q');
  });

  test('black on white', () => {
    const blue = complete((data) => ({ ...sunatQr(data.qr.text, 80), foreground: '#0b5394' }));
    expect(rules(blue, dataOf('invoice'))).toContain('qr/black');
    const grey = complete((data) => ({ ...sunatQr(data.qr.text, 80), background: '#eeeeee' }));
    expect(rules(grey, dataOf('invoice'))).toContain('qr/white');
  });

  test('a quiet zone of at least 1 mm', () => {
    const tight = complete((data) => ({ ...sunatQr(data.qr.text, 80), padding: 0 }));
    expect(rules(tight, dataOf('invoice'))).toContain('qr/quiet-zone');
  });

  test('at most 6 cm with its white space', () => {
    const huge = complete((data) => ({ qr: data.qr.text, eccLevel: 'Q', fit: 200, padding: 4 }));
    expect(rules(huge, dataOf('invoice'))).toContain('qr/size');
  });

  test('in the lower part, after the total', () => {
    const top: Template = (data, context) => {
      const document = complete()(data, context);
      return { ...document, content: [blocks.qr(data), ...(document.content as Content[])] };
    };
    const issues = rules(top, dataOf('invoice'));
    expect(issues).toContain('qr/bottom');
  });

  test('sunatQr never breaks a rule, whatever size is asked', () => {
    const text = qrText();
    for (const size of [50, 60, 85, 120, 170, 400]) {
      const node = sunatQr(text, size);
      const { modulePt, quietPt, sizePt } = qrGeometry(text, node);
      expect(modulePt / POINTS_PER_MM).toBeGreaterThanOrEqual(QR_RULES.minModuleMm);
      expect(quietPt / POINTS_PER_MM).toBeGreaterThanOrEqual(QR_RULES.quietZoneMm);
      expect(sizePt / POINTS_PER_MM).toBeLessThanOrEqual(QR_RULES.maxSizeMm);
      expect(sizePt).toBeLessThanOrEqual(size);
      expect(node).toMatchObject({ eccLevel: 'Q', foreground: '#000000', background: '#ffffff' });
    }
  });

  test('refuses a size where the modules and the quiet zone cannot fit', () => {
    expect(() => sunatQr(qrText(), 40)).toThrow(RangeError);
  });

  test('the version matches the text length at level Q', () => {
    expect(qrModules('a'.repeat(11))).toBe(21);
    expect(qrModules('a'.repeat(12))).toBe(25);
    expect(qrModules(qrText())).toBeGreaterThanOrEqual(29);
  });
});

describe('pdf() enforces the rules', () => {
  test('a template that breaks one throws PrintRulesError, naming rule and source', async () => {
    const record = all['invoice'];
    if (record === undefined) throw new Error('no invoice');
    const blue = complete((data) => ({ ...sunatQr(data.qr.text, 80), foreground: '#0b5394' }));
    const error = await pdf(record, { template: blue }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PrintRulesError);
    expect((error as PrintRulesError).issues[0]).toMatchObject({ rule: 'qr/black' });
    expect((error as PrintRulesError).message).toMatch(/6\.5\.4 h\)/);
  });

  test('verify: false draws it anyway, at your own risk', async () => {
    const record = all['invoice'];
    if (record === undefined) throw new Error('no invoice');
    const blue = complete((data) => ({ ...sunatQr(data.qr.text, 80), foreground: '#0b5394' }));
    const bytes = await pdf(record, { template: blue, verify: false });
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
