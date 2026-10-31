import type { Content, ContentTable, TableCell } from 'pdfmake/interfaces';
import type { PrintData } from './print-data';
import { sunatQr } from './qr';
import type { Theme } from './theme';

/**
 * Pieces a template combines. Each takes the data and the theme and returns pdfmake content,
 * so a custom template rearranges them without redoing what SUNAT requires.
 */

const MM = 72 / 25.4;

export type Alignment = 'left' | 'center' | 'right';

/** A logo as pdfmake content: PNG or JPEG bytes, a data URL, or an SVG string. */
export function logo(data: PrintData, size: { width: number; height: number }): Content | null {
  const source = data.issuer.logo;
  if (source === undefined) return null;
  if (typeof source === 'string') {
    if (source.trimStart().startsWith('<')) {
      // pdfmake's SVG engine opens <text> fonts from disk, outside the bundled fonts.
      if (/<text[\s>]/i.test(source)) {
        throw new TypeError(
          'issuer.logo is an SVG with <text>: convert its text to paths (outlines) in your design tool.',
        );
      }
      return { svg: source, fit: [size.width, size.height] };
    }
    return { image: source, fit: [size.width, size.height] };
  }
  const bytes = Buffer.from(source);
  const png = bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
  if (!png && !jpeg)
    throw new TypeError('issuer.logo must be PNG or JPEG bytes, or an SVG string.');
  const url = `data:image/${png ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`;
  return { image: url, fit: [size.width, size.height] };
}

/** Title, number and date, aligned right: the reference design's top-right corner. */
export function heading(
  data: PrintData,
  theme: Theme,
  { alignment = 'right', ruc = true }: { alignment?: Alignment; ruc?: boolean } = {},
): Content {
  return {
    alignment,
    stack: [
      ...(ruc
        ? [{ text: `RUC ${data.issuer.ruc}`, color: theme.muted, fontSize: theme.fontSize }]
        : []),
      {
        text: data.title,
        font: theme.headingFont,
        fontSize: theme.fontSize * 1.6,
        color: theme.accent,
        margin: [0, 2, 0, 0],
      },
      {
        text: data.id,
        font: theme.headingFont,
        fontSize: theme.fontSize * 1.3,
        margin: [0, 1, 0, 4],
      },
      { text: `Fecha de emisión: ${data.issueDate}`, color: theme.muted },
    ],
  };
}

function lines(values: readonly (string | undefined)[]): string[] {
  return values.filter((value): value is string => value !== undefined && value.length > 0);
}

/** The Issuer's details. */
export function issuer(
  data: PrintData,
  theme: Theme,
  { alignment = 'left', ruc = true }: { alignment?: Alignment; ruc?: boolean } = {},
): Content {
  return {
    alignment,
    stack: [
      { text: 'Datos del emisor', font: theme.headingFont, bold: true, margin: [0, 0, 0, 4] },
      { text: data.issuer.name },
      ...lines([data.issuer.tradeName]).map((text) => ({ text })),
      ...(ruc ? [{ text: `RUC ${data.issuer.ruc}` }] : []),
      ...lines([
        data.issuer.address,
        data.issuer.email,
        data.issuer.phone,
        data.issuer.website,
      ]).map((text) => ({ text })),
    ],
  };
}

/** The Customer's details; "CLIENTES VARIOS" for an Anonymous Customer. */
export function customer(
  data: PrintData,
  theme: Theme,
  { alignment = 'right' }: { alignment?: Alignment } = {},
): Content {
  const { customer: who } = data;
  return {
    alignment,
    stack: [
      { text: 'Datos del cliente', font: theme.headingFont, bold: true, margin: [0, 0, 0, 4] },
      { text: who.name },
      ...lines([who.anonymous ? undefined : `${who.idLabel} ${who.idNumber}`, who.address]).map(
        (text) => ({ text }),
      ),
      { text: `Moneda: ${data.currency.code}`, color: theme.muted, margin: [0, 2, 0, 0] },
    ],
  };
}

/** For a note: the document it modifies and why. */
export function affected(data: PrintData, theme: Theme): Content | null {
  if (data.affected === undefined) return null;
  return {
    margin: [0, 0, 0, 12],
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              {
                text: [
                  { text: 'Documento que modifica: ', font: theme.headingFont },
                  `${data.affected.type} ${data.affected.id}`,
                ],
              },
              { text: [{ text: 'Motivo: ', font: theme.headingFont }, data.affected.reason] },
            ],
          },
        ],
      ],
    },
    layout: hairlines(theme, { padding: 8 }),
  };
}

/** Horizontal hairlines only, as in the reference design. */
export function hairlines(
  theme: Theme,
  { padding = 6, header = false } = {},
): ContentTable['layout'] {
  return {
    hLineWidth: (index) => (header && index === 1 ? 0.8 : 0.6),
    vLineWidth: () => 0,
    hLineColor: () => theme.line,
    paddingLeft: () => padding,
    paddingRight: () => padding,
    paddingTop: () => padding,
    paddingBottom: () => padding,
  };
}

/**
 * The Items table: description, quantity and unit, unit price, value, IGV and amount. Notes also
 * show the Unit Value (R.S. 114-2019 Annexes III–IV, field 19).
 */
export function items(data: PrintData, theme: Theme): Content {
  const note = data.kind === 'credit-note' || data.kind === 'debit-note';
  const head = (text: string, alignment: 'left' | 'right' = 'right'): TableCell => ({
    text,
    font: theme.headingFont,
    alignment,
  });
  const cell = (text: string): TableCell => ({ text, alignment: 'right', color: theme.muted });
  return {
    table: {
      headerRows: 1,
      widths: ['*', 'auto', ...(note ? ['auto'] : []), 'auto', 'auto', 'auto', 'auto'],
      body: [
        [
          head('Descripción', 'left'),
          head('Cant.'),
          ...(note ? [head('V. unitario')] : []),
          head('P. unitario'),
          head('Valor venta'),
          head('IGV'),
          head('Importe'),
        ],
        ...data.items.map((item) => [
          { text: item.description, color: theme.muted },
          cell(`${item.quantity} ${item.unit}`),
          ...(note ? [cell(item.unitValue)] : []),
          cell(item.unitPrice),
          cell(item.value),
          cell(item.igv),
          cell(item.total),
        ]),
      ],
    },
    layout: hairlines(theme, { padding: 7, header: true }),
  };
}

/** Subtotals and the total, right-hand side. */
export function totals(data: PrintData, theme: Theme): Content {
  return {
    table: {
      widths: ['*', 'auto'],
      body: [
        ...data.subtotals.map((row) => [
          { text: row.label, color: theme.muted },
          { text: row.amount, alignment: 'right' as const, color: theme.muted },
        ]),
        [
          { text: 'Importe total', font: theme.headingFont, color: theme.accent },
          {
            text: data.total,
            font: theme.headingFont,
            color: theme.accent,
            alignment: 'right' as const,
          },
        ],
      ],
    },
    layout: hairlines(theme, { padding: 6 }),
  };
}

/** The total in words (catalog 52, legend 1000). */
export function amountInWords(data: PrintData, theme: Theme): Content {
  return { text: data.amountInWords, font: theme.headingFont, fontSize: theme.fontSize * 0.95 };
}

/**
 * Cash or credit; on credit, the amount pending and each Installment. Notes carry no Payment
 * Terms (tribu: nota-credito-2.0.csv ERR 3246), so they print none.
 */
export function payment(data: PrintData, theme: Theme): Content | null {
  if (data.kind === 'credit-note' || data.kind === 'debit-note') return null;
  const terms: Content = {
    text: [{ text: 'Forma de pago: ', font: theme.headingFont }, data.payment.terms],
  };
  if (data.payment.terms === 'Contado') return terms;
  return {
    stack: [
      terms,
      {
        text: [
          { text: 'Monto neto pendiente de pago: ', font: theme.headingFont },
          data.payment.pending ?? '',
        ],
        margin: [0, 2, 0, 4],
      },
      {
        table: {
          widths: ['auto', 'auto', '*'],
          body: [
            [
              { text: 'Cuota', font: theme.headingFont },
              { text: 'Vencimiento', font: theme.headingFont },
              { text: 'Monto', font: theme.headingFont, alignment: 'right' },
            ],
            ...data.payment.installments.map((installment) => [
              { text: installment.label, color: theme.muted },
              { text: installment.due, color: theme.muted },
              { text: installment.amount, color: theme.muted, alignment: 'right' as const },
            ]),
          ],
        },
        layout: hairlines(theme, { padding: 4, header: true }),
      },
    ],
  };
}

/** Legend 2006 and the detracción data. */
export function detraccion(data: PrintData, theme: Theme): Content | null {
  const info = data.detraccion;
  if (info === undefined) return null;
  return {
    table: {
      widths: ['*'],
      body: [
        [
          {
            stack: [
              { text: info.legend, font: theme.headingFont, margin: [0, 0, 0, 3] },
              { text: `Bien o servicio: ${info.code} - ${info.name}`, color: theme.muted },
              { text: `Porcentaje: ${info.rate}  ·  Monto: ${info.amount}`, color: theme.muted },
              { text: `Cta. Banco de la Nación: ${info.account}`, color: theme.muted },
            ],
          },
        ],
      ],
    },
    layout: hairlines(theme, { padding: 6 }),
  };
}

/**
 * SUNAT's QR: black on white, level Q, with its 1 mm quiet zone, at most 6×6 cm all included
 * (src/qr.ts). `size` in points is the most it may take, quiet zone included.
 */
export function qr(data: PrintData, size = 30 * MM): Content {
  return sunatQr(data.qr.text, size);
}

/**
 * "Representación impresa de la …" (R.S. 000123-2022 Annex I F62; R.S. 114-2019 Annexes II–IV).
 * No hash: since 2020 the QR replaces it (R.S. 309-2018).
 */
export function legends(data: PrintData, theme: Theme): Content {
  return {
    stack: data.legends.map((text) => ({
      text,
      color: theme.muted,
      fontSize: theme.fontSize * 0.85,
    })),
  };
}

/** The Issuer's closing text. */
export function note(data: PrintData, theme: Theme): Content | null {
  if (data.note === undefined) return null;
  return { text: data.note, color: theme.text, margin: [0, 10, 0, 0] };
}

export { MM };
