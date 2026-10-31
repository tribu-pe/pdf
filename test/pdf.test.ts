import { deflateSync } from 'node:zlib';
import { beforeAll, describe, expect, test } from 'vitest';
import { blocks, pdf, prepare, type Template, templates } from '../src/index';
import type { PrintableRecord } from '../src/record';
import { records } from './support/records';

let all: Record<string, PrintableRecord>;
beforeAll(async () => {
  all = await records();
});

const record = (name = 'invoice') => {
  const found = all[name];
  if (found === undefined) throw new Error(`no record ${name}`);
  return found;
};

/** Pages in a PDF: each page object is "/Type /Page" (not "/Pages"). */
const pages = (bytes: Buffer) =>
  bytes.toString('latin1').match(/\/Type \/Page\b(?!s)/g)?.length ?? 0;

/** A 1×1 white PNG. */
function png(): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (const byte of body) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    const sum = Buffer.alloc(4);
    sum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([length, body, sum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(1, 0);
  header.writeUInt32BE(1, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 255, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

describe('pdf: the built-in templates', () => {
  test.each(['a4', 'ticket80', 'ticket58'] as const)('%s draws every variation', async (format) => {
    for (const name of Object.keys(all)) {
      const bytes = await pdf(record(name), { template: templates[format] });
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pages(bytes)).toBe(1);
    }
  });

  test('A4 is the default', async () => {
    const bytes = await pdf(record());
    expect(bytes.toString('latin1')).toMatch(/MediaBox \[0 0 595\.28 841\.89\]/);
  });

  test('a ticket is as long as its content, not a whole page', async () => {
    const bytes = await pdf(record('receipt-anonymous'), { template: templates.ticket80 });
    const [, height] = /MediaBox \[0 0 [\d.]+ ([\d.]+)\]/.exec(bytes.toString('latin1')) ?? [];
    expect(Number(height)).toBeLessThan(800);
  });

  test('a ticket width outside thermal paper is refused', () => {
    expect(() => templates.ticket(30)).toThrow(RangeError);
    expect(templates.ticket(76)).toBeTypeOf('function');
  });

  test('takes a PNG logo, and an SVG logo whose text is outlined', async () => {
    expect(pages(await pdf(record(), { issuer: { logo: png() } }))).toBe(1);
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>';
    expect(pages(await pdf(record(), { issuer: { logo: svg } }))).toBe(1);
  });

  test('refuses an SVG logo with <text>: its font would be read from disk', async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><text>Logo</text></svg>';
    await expect(pdf(record(), { issuer: { logo: svg } })).rejects.toThrow(
      /convert its text to paths/,
    );
  });

  test('refuses a theme colour pdfmake would ignore', async () => {
    await expect(pdf(record(), { theme: { accent: 'blue' } })).rejects.toThrow(/theme.accent/);
  });
});

describe('pdf: your own template', () => {
  test('a function of the data, built from the blocks', async () => {
    const minimal: Template = (data, { theme }) => ({
      defaultStyle: { font: theme.font },
      content: [
        blocks.heading(data, theme),
        { columns: [blocks.issuer(data, theme), blocks.customer(data, theme)] },
        blocks.items(data, theme),
        blocks.totals(data, theme),
        blocks.qr(data),
        blocks.legends(data, theme),
      ],
    });
    const bytes = await pdf(record(), { template: minimal });
    expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  });

  test('prepare() hands over the same data a template receives', async () => {
    const data = await prepare(record());
    expect(data.title).toBe('FACTURA ELECTRÓNICA');
  });
});
