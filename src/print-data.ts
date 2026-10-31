import { currencyOf, date, fixed, identifier, money, quantity } from './format';
import type { PrintableDocument, PrintableRecord } from './record';
import { amountInWords } from './words';

/** What the Issuer adds that a Record doesn't carry. */
export interface IssuerDetails {
  /** Nombre comercial: SUNAT requires it when the Issuer has one. */
  readonly tradeName?: string;
  /** PNG or JPEG bytes, or an SVG string. */
  readonly logo?: Uint8Array | string;
  /** Domicilio fiscal or the establishment's address. */
  readonly address?: string;
  readonly phone?: string;
  readonly email?: string;
  readonly website?: string;
}

export interface PrintOptions {
  readonly issuer?: IssuerDetails;
  /** The Customer's address, when the Issuer has it. */
  readonly customerAddress?: string;
  /** A closing text: bank accounts, thanks, return policy. */
  readonly note?: string;
}

export type DocumentKind = 'invoice' | 'receipt' | 'credit-note' | 'debit-note';

export interface PrintItem {
  readonly description: string;
  readonly quantity: string;
  readonly unit: string;
  /** Unit Price, tax included. */
  readonly unitPrice: string;
  /** Unit Value, tax excluded. */
  readonly unitValue: string;
  readonly value: string;
  readonly igv: string;
  readonly total: string;
}

export interface PrintRow {
  readonly label: string;
  readonly amount: string;
}

/** A Record turned into text ready to print. Templates only lay it out. */
export interface PrintData {
  readonly kind: DocumentKind;
  /** "FACTURA ELECTRÓNICA", "BOLETA DE VENTA ELECTRÓNICA", … */
  readonly title: string;
  /** "F001-123". */
  readonly id: string;
  readonly issueDate: string;
  readonly currency: { readonly code: string; readonly symbol: string; readonly words: string };
  readonly issuer: {
    readonly name: string;
    readonly tradeName?: string;
    readonly ruc: string;
    readonly logo?: Uint8Array | string;
    readonly address?: string;
    readonly phone?: string;
    readonly email?: string;
    readonly website?: string;
  };
  readonly customer: {
    readonly name: string;
    /** "RUC", "DNI", … ; empty for an Anonymous Customer. */
    readonly idLabel: string;
    readonly idNumber: string;
    readonly anonymous: boolean;
    readonly address?: string;
  };
  readonly items: readonly PrintItem[];
  /** Taxed, exempt and unaffected values and IGV; only the lines that apply. */
  readonly subtotals: readonly PrintRow[];
  readonly total: string;
  /** "SON: DOSCIENTOS TREINTA Y SEIS CON 00/100 SOLES". */
  readonly amountInWords: string;
  readonly payment: {
    readonly terms: 'Contado' | 'Crédito';
    readonly pending?: string;
    readonly installments: readonly {
      readonly label: string;
      readonly due: string;
      readonly amount: string;
    }[];
  };
  readonly detraccion?: {
    readonly legend: string;
    readonly code: string;
    readonly name: string;
    readonly rate: string;
    readonly amount: string;
    readonly account: string;
  };
  /** For a note: the Affected Document and the Reason. */
  readonly affected?: { readonly id: string; readonly type: string; readonly reason: string };
  readonly qr: { readonly text: string };
  /** SUNAT's legends, in print order. */
  readonly legends: readonly string[];
  readonly note?: string;
}

const KINDS: Readonly<Record<string, { kind: DocumentKind; title: string; legend: string }>> = {
  '01': {
    kind: 'invoice',
    title: 'FACTURA ELECTRÓNICA',
    legend: 'Representación impresa de la factura electrónica',
  },
  '03': {
    kind: 'receipt',
    title: 'BOLETA DE VENTA ELECTRÓNICA',
    legend: 'Representación impresa de la boleta de venta electrónica',
  },
  '07': {
    kind: 'credit-note',
    title: 'NOTA DE CRÉDITO ELECTRÓNICA',
    legend: 'Representación impresa de la nota de crédito electrónica',
  },
  '08': {
    kind: 'debit-note',
    title: 'NOTA DE DÉBITO ELECTRÓNICA',
    legend: 'Representación impresa de la nota de débito electrónica',
  },
};

/** Catalog 06 short labels. */
const IDENTITY: Readonly<Record<string, string>> = {
  '0': 'DOC. TRIB. NO DOM.',
  '1': 'DNI',
  '4': 'CARNET EXT.',
  '6': 'RUC',
  '7': 'PASAPORTE',
};

/** Catalog 52, code 2006; catalog 52, code 1000 is the amount in words. */
const DETRACCION_LEGEND = 'Operación sujeta a detracción';

function documentOf(record: PrintableRecord): PrintableDocument {
  if (record.document === undefined) {
    throw new TypeError(`The Record ${record.id} has no document: pass a Record Tribu issued.`);
  }
  if (record.qr === undefined) {
    throw new TypeError(`The Record ${record.id} has no QR text: pass a Record Tribu issued.`);
  }
  return record.document;
}

function nonZero(value: string): boolean {
  return Number(value) !== 0;
}

/** Turns a Tribu Record into the text a Printed Representation shows. */
export function printData(record: PrintableRecord, options: PrintOptions = {}): PrintData {
  const document = documentOf(record);
  const known = KINDS[document.type.code];
  if (known === undefined) {
    throw new TypeError(`Document type ${document.type.code} has no Printed Representation here.`);
  }
  const currency = currencyOf(document.currency.code);
  const symbol = (value: string) => `${currency.symbol} ${money(value)}`;
  const { totals } = document;

  const subtotals: PrintRow[] = [];
  if (nonZero(fixed(totals.taxed)))
    subtotals.push({ label: 'Op. gravadas', amount: symbol(fixed(totals.taxed)) });
  if (nonZero(fixed(totals.exempt)))
    subtotals.push({ label: 'Op. exoneradas', amount: symbol(fixed(totals.exempt)) });
  if (nonZero(fixed(totals.unaffected))) {
    subtotals.push({ label: 'Op. inafectas', amount: symbol(fixed(totals.unaffected)) });
  }
  subtotals.push({
    label: `IGV (${quantity(document.igvRate)}%)`,
    amount: symbol(fixed(totals.igv)),
  });
  // A Receipt prints the total sales value and the subtotal too (R.S. 114-2019 Annex II, B46, B47).
  if (known.kind === 'receipt') {
    subtotals.unshift({ label: 'Valor de venta', amount: symbol(fixed(totals.value)) });
    subtotals.push({ label: 'Subtotal', amount: symbol(fixed(totals.payable)) });
  }

  const customer =
    'anonymous' in document.customer
      ? { name: 'CLIENTES VARIOS', idLabel: '', idNumber: '', anonymous: true }
      : {
          name: document.customer.name,
          idLabel: IDENTITY[document.customer.identity.code] ?? document.customer.identity.name,
          idNumber: identifier(document.customer.number),
          anonymous: false,
        };

  const payment =
    document.payment.terms === 'cash'
      ? { terms: 'Contado' as const, installments: [] }
      : {
          terms: 'Crédito' as const,
          pending: symbol(fixed(document.payment.pending)),
          installments: document.payment.installments.map((installment, index) => ({
            label: `Cuota ${String(index + 1).padStart(3, '0')}`,
            due: date(installment.due),
            amount: symbol(fixed(installment.amount)),
          })),
        };

  const { detraccion, modifies, reason } = document;
  const issuer = options.issuer ?? {};
  return {
    kind: known.kind,
    title: known.title,
    id: record.id,
    issueDate: date(document.issueDate),
    currency,
    issuer: {
      name: document.issuer.name,
      ruc: identifier(document.issuer.ruc),
      ...(issuer.tradeName === undefined ? {} : { tradeName: issuer.tradeName }),
      ...(issuer.logo === undefined ? {} : { logo: issuer.logo }),
      ...(issuer.address === undefined ? {} : { address: issuer.address }),
      ...(issuer.phone === undefined ? {} : { phone: issuer.phone }),
      ...(issuer.email === undefined ? {} : { email: issuer.email }),
      ...(issuer.website === undefined ? {} : { website: issuer.website }),
    },
    customer: {
      ...customer,
      ...(options.customerAddress === undefined ? {} : { address: options.customerAddress }),
    },
    items: document.items.map((item) => ({
      description: item.description,
      quantity: quantity(item.quantity),
      unit: item.unit.code,
      unitPrice: money(item.unitPrice),
      unitValue: money(item.unitValue),
      value: money(item.value),
      igv: money(item.igv),
      total: money(item.total),
    })),
    subtotals,
    total: symbol(fixed(totals.payable)),
    amountInWords: amountInWords(fixed(totals.payable), currency.words),
    payment,
    ...(detraccion === undefined
      ? {}
      : {
          detraccion: {
            legend: DETRACCION_LEGEND,
            code: detraccion.code.code,
            name: detraccion.code.name,
            rate: `${quantity(detraccion.rate)}%`,
            amount: `S/ ${money(detraccion.amount)}`,
            account: detraccion.account,
          },
        }),
    ...(modifies === undefined
      ? {}
      : {
          affected: {
            id: modifies,
            type: modifies.startsWith('B') ? 'Boleta de venta electrónica' : 'Factura electrónica',
            reason: reason === undefined ? '' : `${reason.code} - ${reason.name}`,
          },
        }),
    qr: { text: record.qr ?? '' },
    legends: [known.legend],
    ...(options.note === undefined ? {} : { note: options.note }),
  };
}
