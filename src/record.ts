/**
 * The part of a Tribu Record this package reads. It is structural on purpose: it accepts the
 * Record as Tribu returns it and as it comes back from a database through JSON.parse, where
 * amounts are strings and the RUC is `{ value }`.
 */
export type Amount = string | number | { toString(): string };

export interface Entry {
  readonly catalog?: string;
  readonly code: string;
  readonly name: string;
}

export interface PrintableItem {
  readonly description: string;
  readonly quantity: Amount;
  readonly unit: Entry;
  readonly affectation: Entry;
  readonly unitValue: Amount;
  readonly unitPrice: Amount;
  readonly value: Amount;
  readonly igv: Amount;
  readonly total: Amount;
}

export type Identifier = string | { readonly value: string };

export interface PrintableDocument {
  readonly type: Entry;
  readonly series: string;
  readonly number?: number;
  readonly issueDate: string;
  readonly currency: Entry;
  readonly customer:
    | { readonly identity: Entry; readonly number: Identifier; readonly name: string }
    | { readonly anonymous: true };
  readonly items: readonly PrintableItem[];
  readonly totals: {
    readonly taxed: Amount;
    readonly exempt: Amount;
    readonly unaffected: Amount;
    readonly igv: Amount;
    readonly value: Amount;
    readonly payable: Amount;
  };
  readonly payment:
    | { readonly terms: 'cash' }
    | {
        readonly terms: 'credit';
        readonly pending: Amount;
        readonly installments: readonly { readonly amount: Amount; readonly due: string }[];
      };
  readonly igvRate: Amount;
  readonly issuer: { readonly ruc: Identifier; readonly name: string };
  readonly modifies?: string;
  readonly reason?: Entry;
  readonly detraccion?: {
    readonly code: Entry;
    readonly rate: Amount;
    readonly amount: Amount;
    readonly account: string;
  };
}

export interface PrintableRecord {
  readonly id: string;
  readonly document?: PrintableDocument;
  readonly qr?: string;
  readonly hash?: string;
}
