// Generates examples/*.pdf: every document variation in every built-in format, from Records
// Tribu issues against an in-memory SUNAT. Run with `pnpm examples` (it builds first).
import { mkdirSync, writeFileSync } from 'node:fs';
import { pdf, templates } from '../dist/index.js';
import { records } from '../test/support/records.ts';

// A made-up monogram drawn with shapes: a real logo exported as SVG must have its text as paths.
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 80 80">
  <circle cx="40" cy="40" r="38" fill="none" stroke="#111" stroke-width="2"/>
  <path d="M22 24h22v5H28v8h14v5H28v9h16v5H22z" fill="#111"/>
  <path d="M48 24h8a10 10 0 0 1 0 20h-3v12h-5zm5 5v10h3a5 5 0 0 0 0-10z" fill="#111"/>
</svg>`;

const issuer = {
  logo: LOGO,
  address: 'Av. Javier Prado Este 123, San Isidro, Lima',
  email: 'ventas@empresadeprueba.pe',
  phone: '(01) 234 5678',
};
const note = 'Gracias por su compra. Cuenta BCP soles: 191-1234567-0-89.';

mkdirSync('examples', { recursive: true });
const all = await records();
const formats = { a4: templates.a4, ticket80: templates.ticket80, ticket58: templates.ticket58 };
for (const [name, record] of Object.entries(all)) {
  for (const [format, template] of Object.entries(formats)) {
    const file = `examples/${name}.${format}.pdf`;
    writeFileSync(file, await pdf(record, { issuer, note, template }));
    console.log(file);
  }
}
const branded = all['invoice'];
if (branded !== undefined) {
  // Colour goes on the design, never on the QR: SUNAT requires it black.
  writeFileSync(
    'examples/invoice.a4.branded.pdf',
    await pdf(branded, { issuer, note, theme: { accent: '#0b5394' } }),
  );
  console.log('examples/invoice.a4.branded.pdf');
}
