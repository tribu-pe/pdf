import { beforeAll, describe, expect, test } from 'vitest';
import { printData } from '../src/print-data';
import type { PrintableRecord } from '../src/record';
import { records } from './support/records';

let all: Record<string, PrintableRecord>;
beforeAll(async () => {
  all = await records();
});

const data = (name: string) => {
  const record = all[name];
  if (record === undefined) throw new Error(`no record ${name}`);
  return printData(record);
};

describe('printData: every variation', () => {
  test('an Invoice in cash', () => {
    const invoice = data('invoice');
    expect(invoice).toMatchObject({
      kind: 'invoice',
      title: 'FACTURA ELECTRÓNICA',
      id: 'F001-1',
      issueDate: '31/10/2026',
      issuer: { name: 'EMPRESA DE PRUEBA SAC', ruc: '20000000001' },
      customer: { name: 'CLIENTE SAC', idLabel: 'RUC', idNumber: '20123456786', anonymous: false },
      total: 'S/ 413.00',
      amountInWords: 'SON: CUATROCIENTOS TRECE CON 00/100 SOLES',
      payment: { terms: 'Contado', installments: [] },
    });
    expect(invoice.items[0]).toMatchObject({
      quantity: '2',
      unit: 'NIU',
      unitPrice: '118.00',
      total: '236.00',
    });
    expect(invoice.subtotals).toEqual([
      { label: 'Op. gravadas', amount: 'S/ 350.00' },
      { label: 'IGV (18%)', amount: 'S/ 63.00' },
    ]);
  });

  test("the QR text is the Record's, untouched", () => {
    expect(data('invoice').qr.text).toBe(all['invoice']?.qr);
  });

  test('an Invoice on credit lists the amount pending and the Installments', () => {
    expect(data('invoice-credit').payment).toEqual({
      terms: 'Crédito',
      pending: 'S/ 413.00',
      installments: [
        { label: 'Cuota 001', due: '30/11/2026', amount: 'S/ 206.50' },
        { label: 'Cuota 002', due: '31/12/2026', amount: 'S/ 206.50' },
      ],
    });
  });

  test('an Invoice with a detracción: legend, code, rate, amount in soles and account', () => {
    const invoice = data('invoice-detraccion');
    expect(invoice.detraccion).toEqual({
      legend: 'Operación sujeta a detracción',
      code: '020',
      name: 'Mantenimiento y reparación de bienes muebles',
      rate: '12%',
      amount: 'S/ 141.60',
      account: '00-000-123456',
    });
    expect(invoice.payment.pending).toBe('S/ 1,038.40');
  });

  test('an Invoice in US dollars', () => {
    const invoice = data('invoice-usd');
    expect(invoice.currency.code).toBe('USD');
    expect(invoice.total).toBe('US$ 590.00');
    expect(invoice.amountInWords).toBe('SON: QUINIENTOS NOVENTA CON 00/100 DÓLARES AMERICANOS');
  });

  test('a Receipt with a DNI', () => {
    expect(data('receipt')).toMatchObject({
      kind: 'receipt',
      title: 'BOLETA DE VENTA ELECTRÓNICA',
      customer: { idLabel: 'DNI', idNumber: '12345678', name: 'Juan Pérez Quispe' },
    });
  });

  test('a Receipt also prints the total sales value and the subtotal (Annex II, B46, B47)', () => {
    expect(data('receipt').subtotals.map((row) => row.label)).toEqual([
      'Valor de venta',
      'Op. gravadas',
      'IGV (18%)',
      'Subtotal',
    ]);
  });

  test("SUNAT's legend, word for word", () => {
    expect(data('invoice').legends).toEqual(['Representación impresa de la factura electrónica']);
    expect(data('credit-note').legends).toEqual([
      'Representación impresa de la nota de crédito electrónica',
    ]);
  });

  test('a Receipt to an Anonymous Customer', () => {
    expect(data('receipt-anonymous').customer).toEqual({
      name: 'CLIENTES VARIOS',
      idLabel: '',
      idNumber: '',
      anonymous: true,
    });
  });

  test('a Credit Note names the Affected Document and the Reason', () => {
    expect(data('credit-note')).toMatchObject({
      kind: 'credit-note',
      title: 'NOTA DE CRÉDITO ELECTRÓNICA',
      affected: { id: 'F001-1', type: 'Factura electrónica', reason: '07 - Devolución por ítem' },
    });
  });

  test('a Debit Note too', () => {
    expect(data('debit-note')).toMatchObject({
      kind: 'debit-note',
      title: 'NOTA DE DÉBITO ELECTRÓNICA',
      affected: { id: 'F001-1', reason: '01 - Intereses por mora' },
    });
  });

  test('every Document says it is a Printed Representation', () => {
    for (const name of Object.keys(all)) {
      expect(data(name).legends.join(' ')).toMatch(/Representación impresa/);
    }
  });
});

describe('printData: what the Issuer adds', () => {
  test('address, phone, email and note', () => {
    const record = all['invoice'];
    if (record === undefined) throw new Error('no invoice');
    const printed = printData(record, {
      issuer: {
        tradeName: 'MI TIENDA',
        address: 'Av. Lima 123',
        phone: '01 234 5678',
        email: 'a@b.pe',
      },
      customerAddress: 'Jr. Cusco 456',
      note: 'Gracias',
    });
    expect(printed.issuer).toMatchObject({
      tradeName: 'MI TIENDA',
      address: 'Av. Lima 123',
      phone: '01 234 5678',
      email: 'a@b.pe',
    });
    expect(printed.customer.address).toBe('Jr. Cusco 456');
    expect(printed.note).toBe('Gracias');
  });

  test('a Record without a document is refused with a clear message', () => {
    expect(() => printData({ id: 'F001-9' })).toThrow(/no document/);
  });
});
