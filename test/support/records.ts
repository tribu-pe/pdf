import { generateKeyPairSync } from 'node:crypto';
import forge from 'node-forge';
import tribu, { Currency, Detraccion, Unit } from 'tribu';
import { Reason as CreditReason } from 'tribu/catalogs/credit-note';
import { Reason as DebitReason } from 'tribu/catalogs/debit-note';
import { fakeSunat } from 'tribu/testing';
import type { PrintableRecord } from '../../src/record';

/** A self-signed certificate made in memory: real certificates never enter the repository. */
function testCertificate(): { pfx: Buffer; passphrase: string } {
  const passphrase = 'test-passphrase';
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const certificate = forge.pki.createCertificate();
  certificate.publicKey = forge.pki.publicKeyFromPem(publicKey);
  certificate.serialNumber = '01';
  certificate.validity.notBefore = new Date('2026-01-01T00:00:00Z');
  certificate.validity.notAfter = new Date('2028-12-31T23:59:59Z');
  const subject = [{ name: 'commonName', value: 'EMPRESA DE PRUEBA SAC' }];
  certificate.setSubject(subject);
  certificate.setIssuer(subject);
  const key = forge.pki.privateKeyFromPem(privateKey);
  certificate.sign(key, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(key, [certificate], passphrase, { algorithm: '3des' });
  return { pfx: Buffer.from(forge.asn1.toDer(p12).getBytes(), 'binary'), passphrase };
}

let certificate: ReturnType<typeof testCertificate> | undefined;

function client() {
  certificate ??= testCertificate();
  return tribu.create({
    env: 'beta',
    issuer: {
      ruc: '20000000001',
      name: 'EMPRESA DE PRUEBA SAC',
      ubigeo: '150101',
      detraccionAccount: '00-000-123456',
    },
    sol: { user: 'MODDATOS', password: 'MODDATOS' },
    certificate,
    transport: fakeSunat(),
  });
}

/** Plain JSON, as the Issuer keeps it in a database (ADR 0008 in tribu). */
const stored = (record: unknown): PrintableRecord => JSON.parse(JSON.stringify(record));

const CUSTOMER = { ruc: '20123456786', name: 'CLIENTE SAC' };
const ITEMS = [
  { description: 'Teclado mecánico', quantity: 2, price: 118 },
  { description: 'Mouse inalámbrico', quantity: 1, price: 59 },
  { description: 'Instalación y configuración', quantity: 1, value: 100, unit: Unit.Service },
];

/** One Record of every variation the templates must print. */
export async function records(): Promise<Record<string, PrintableRecord>> {
  const sunat = client();
  const date = '2026-10-31';
  const invoice = await sunat.invoice({
    customer: CUSTOMER,
    items: ITEMS,
    number: 1,
    issueDate: date,
  });
  const credit = await sunat.invoice({
    customer: CUSTOMER,
    items: ITEMS,
    number: 2,
    issueDate: date,
    payment: {
      installments: [
        { amount: '206.50', due: '2026-11-30' },
        { amount: '206.50', due: '2026-12-31' },
      ],
    },
  });
  const detraccion = await sunat.invoice({
    customer: CUSTOMER,
    items: [
      { description: 'Mantenimiento de equipos', quantity: 1, price: 1180, unit: Unit.Service },
    ],
    detraccion: Detraccion.Maintenance,
    payment: { installments: [{ amount: '1038.40', due: '2026-11-30' }] },
    number: 3,
    issueDate: date,
  });
  const dollars = await sunat.invoice({
    customer: CUSTOMER,
    currency: Currency.Usd,
    items: [{ description: 'Licencia anual de software', quantity: 1, price: 590 }],
    number: 4,
    issueDate: date,
  });
  const receipt = await sunat.receipt({
    customer: { dni: '12345678', name: 'Juan Pérez Quispe' },
    items: [{ description: 'Audífonos', quantity: 1, price: 89.9 }],
    number: 1,
    issueDate: date,
  });
  const anonymous = await sunat.receipt({
    items: [
      { description: 'Café americano', quantity: 2, price: 8 },
      { description: 'Sándwich de pollo', quantity: 1, price: 14.5 },
    ],
    number: 2,
    issueDate: date,
  });
  const creditNote = await sunat.creditNote({
    modifies: stored(invoice.record) as never,
    reason: CreditReason.Item.Return,
    items: [{ description: 'Mouse inalámbrico', quantity: 1, price: 59 }],
    number: 1,
    issueDate: date,
  });
  const debitNote = await sunat.debitNote({
    modifies: stored(invoice.record) as never,
    reason: DebitReason.Interest,
    items: [{ description: 'Intereses por mora', quantity: 1, price: 11.8 }],
    number: 1,
    issueDate: date,
  });
  return {
    invoice: stored(invoice.record),
    'invoice-credit': stored(credit.record),
    'invoice-detraccion': stored(detraccion.record),
    'invoice-usd': stored(dollars.record),
    receipt: stored(receipt.record),
    'receipt-anonymous': stored(anonymous.record),
    'credit-note': stored(creditNote.record),
    'debit-note': stored(debitNote.record),
  };
}
