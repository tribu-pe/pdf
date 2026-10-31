import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import * as blocks from './blocks';
import type { PrintData } from './print-data';
import type { Theme } from './theme';

export interface TemplateContext {
  readonly theme: Theme;
}

/** A template lays out the data as a pdfmake document. Write your own with the same shape. */
export type Template = (data: PrintData, context: TemplateContext) => TDocumentDefinitions;

const present = (content: Content | null): content is Content => content !== null;

function base(theme: Theme): Pick<TDocumentDefinitions, 'defaultStyle' | 'info'> {
  return {
    defaultStyle: {
      font: theme.font,
      fontSize: theme.fontSize,
      color: theme.text,
      lineHeight: 1.25,
    },
  };
}

/** A4, the design of the reference: clean, with hairlines and plenty of white space. */
const a4: Template = (data, { theme }) => {
  const logo = blocks.logo(data, { width: 90, height: 70 });
  const left: Content[] = [
    blocks.amountInWords(data, theme),
    ...[blocks.payment(data, theme), blocks.detraccion(data, theme)]
      .filter(present)
      .map((content) => ({ ...(content as object), margin: [0, 10, 0, 0] }) as Content),
  ];
  return {
    ...base(theme),
    info: { title: `${data.title} ${data.id}`, author: data.issuer.name, creator: 'Tribu' },
    pageSize: 'A4',
    pageMargins: [48, 48, 48, 48],
    content: [
      {
        columns: [
          logo ?? {
            text: data.issuer.name,
            font: theme.headingFont,
            fontSize: theme.fontSize * 1.8,
          },
          blocks.heading(data, theme),
        ],
        margin: [0, 0, 0, 36],
      },
      {
        columns: [blocks.issuer(data, theme, { ruc: false }), blocks.customer(data, theme)],
        columnGap: 24,
        margin: [0, 0, 0, 24],
      },
      ...[blocks.affected(data, theme)].filter(present),
      blocks.items(data, theme),
      {
        columns: [
          { width: '*', stack: left },
          { width: 210, stack: [blocks.totals(data, theme)] },
        ],
        columnGap: 28,
        margin: [0, 18, 0, 0],
      },
      {
        columns: [
          { width: 'auto', stack: [blocks.qr(data, 30 * blocks.MM)] },
          { width: '*', stack: [blocks.legends(data, theme)], margin: [0, 8, 0, 0] },
        ],
        columnGap: 16,
        margin: [0, 28, 0, 0],
        unbreakable: true,
      },
      ...[blocks.note(data, theme)].filter(present),
    ],
  };
};

/** Thermal paper: one column, as long as the content. `width` in millimetres (80 or 58). */
function ticket(width: number): Template {
  return (data, { theme }) => {
    const points = width * blocks.MM;
    const margin = width >= 70 ? 12 : 8;
    const inner = points - 2 * margin;
    const small = { ...theme, fontSize: Math.min(theme.fontSize, width >= 70 ? 8 : 7) };
    // A new object each time: pdfmake moves the vectors of a node it lays out, so a shared
    // canvas would drift down the page.
    const rule = (): Content => ({
      canvas: [
        { type: 'line', x1: 0, y1: 0, x2: inner, y2: 0, lineWidth: 0.5, lineColor: theme.line },
      ],
      margin: [0, 6, 0, 6],
    });
    const row = (label: string, amount: string, strong = false): Content => ({
      columns: [
        { text: label, ...(strong ? { font: theme.headingFont } : { color: theme.muted }) },
        {
          text: amount,
          alignment: 'right',
          width: 'auto',
          ...(strong ? { font: theme.headingFont } : {}),
        },
      ],
    });
    const logo = blocks.logo(data, { width: inner * 0.6, height: 50 });
    return {
      ...base(small),
      info: { title: `${data.title} ${data.id}`, author: data.issuer.name, creator: 'Tribu' },
      pageSize: { width: points, height: 'auto' },
      pageMargins: [margin, margin, margin, margin],
      content: [
        ...(logo === null
          ? []
          : [{ ...(logo as object), alignment: 'center', margin: [0, 0, 0, 6] } as Content]),
        {
          alignment: 'center',
          stack: [
            { text: data.issuer.name, font: theme.headingFont },
            ...(data.issuer.tradeName === undefined ? [] : [{ text: data.issuer.tradeName }]),
            { text: `RUC ${data.issuer.ruc}` },
            ...[data.issuer.address, data.issuer.phone, data.issuer.email]
              .filter((text): text is string => text !== undefined)
              .map((text) => ({ text, color: theme.muted })),
          ],
        },
        rule(),
        blocks.heading(data, small, { alignment: 'center', ruc: false }),
        rule(),
        {
          stack: [
            { text: data.customer.name, font: theme.headingFont },
            ...(data.customer.anonymous
              ? []
              : [{ text: `${data.customer.idLabel} ${data.customer.idNumber}` }]),
            ...(data.customer.address === undefined
              ? []
              : [{ text: data.customer.address, color: theme.muted }]),
            ...(data.affected === undefined
              ? []
              : [
                  {
                    text: `Modifica: ${data.affected.type} ${data.affected.id}`,
                    margin: [0, 4, 0, 0],
                  },
                  { text: `Motivo: ${data.affected.reason}`, color: theme.muted },
                ]),
          ],
        } as Content,
        rule(),
        ...data.items.flatMap((item): Content[] => [
          { text: item.description },
          row(`${item.quantity} ${item.unit} x ${item.unitPrice}`, item.total),
          // A Receipt prints each Item's value and tax (R.S. 114-2019 Annex II, B29, B30).
          ...(data.kind === 'receipt' ? [row(`Valor ${item.value} · IGV ${item.igv}`, '')] : []),
        ]),
        rule(),
        ...data.subtotals.map((subtotal) => row(subtotal.label, subtotal.amount)),
        row('Importe total', data.total, true),
        rule(),
        blocks.amountInWords(data, small),
        ...[blocks.payment(data, small), blocks.detraccion(data, small)]
          .filter(present)
          .map((content) => ({ ...(content as object), margin: [0, 6, 0, 0] }) as Content),
        {
          ...(blocks.qr(data, Math.min(inner * 0.7, 30 * blocks.MM)) as object),
          alignment: 'center',
          margin: [0, 10, 0, 6],
        } as Content,
        { ...(blocks.legends(data, small) as object), alignment: 'center' } as Content,
        ...[blocks.note(data, small)]
          .filter(present)
          .map((content) => ({ ...(content as object), alignment: 'center' }) as Content),
      ],
    };
  };
}

export const templates = {
  a4,
  ticket80: ticket(80),
  ticket58: ticket(58),
  /** A thermal ticket of any width in millimetres, from 48 to 112. */
  ticket(width: number): Template {
    if (!(width >= 48 && width <= 112)) {
      throw new RangeError(`A ticket is 48 to 112 mm wide, not ${width}.`);
    }
    return ticket(width);
  },
};
