# @tribu-pe/pdf

The Printed Representation (representación impresa) of SUNAT electronic documents issued with [Tribu](https://github.com/tribu-pe/tribu): the PDF you hand or email to your Customer, with SUNAT's QR code.

[Leer en español](README.es.md)

> [!WARNING]
> **Experimental**, like Tribu itself. It covers what Tribu issues today: Invoices, Receipts, Credit and Debit Notes, Payment Terms with Installments, and detracciones.

| A4 | Ticket 80 mm |
|---|---|
| [Invoice](docs/examples/invoice.a4.pdf) · [with detracción, on credit](docs/examples/invoice-detraccion.a4.pdf) · [Credit Note](docs/examples/credit-note.a4.pdf) | [Receipt, Anonymous Customer](docs/examples/receipt-anonymous.ticket80.pdf) · [58 mm](docs/examples/receipt.ticket58.pdf) |

## Installation

```sh
npm install @tribu-pe/pdf@experimental
# or
pnpm add @tribu-pe/pdf@experimental
```

It draws with [pdfmake](https://pdfmake.github.io/docs/): pure JavaScript, no browser. Node.js 22.12 or later.

## Quick start

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { pdf } from '@tribu-pe/pdf';

const { record } = await sunat.invoice({ /* ... */ }); // or the Record you saved

const file = await pdf(record, {
  issuer: {
    logo: readFileSync('logo.png'),          // PNG, JPEG, or an SVG string
    address: 'Av. Javier Prado Este 123, San Isidro, Lima',
    phone: '(01) 234 5678',
    email: 'ventas@miempresa.pe',
  },
  note: 'Gracias por su compra.',
});

writeFileSync(`${record.id}.pdf`, file);
```

`pdf()` takes the Record as Tribu returns it, or as you load it back from your database after `JSON.parse`. The Record doesn't carry your address, phone or logo, so you pass them.

## Formats

```ts
import { pdf, templates } from '@tribu-pe/pdf';

await pdf(record, { template: templates.a4 });        // the default
await pdf(record, { template: templates.ticket80 });  // thermal printer, 80 mm
await pdf(record, { template: templates.ticket58 });  // thermal printer, 58 mm
await pdf(record, { template: templates.ticket(76) }); // any width from 48 to 112 mm
```

A ticket is as long as its content, never a whole page.

## Customizing

Two levels, from least to most work. Neither can break what SUNAT requires: see [SUNAT rules](#sunat-rules).

### 1. Theme

```ts
await pdf(record, {
  theme: { accent: '#0b5394', muted: '#5f6b7a', fontSize: 9.5 },
});
```

| Field | Default | |
|---|---|---|
| `font` | `'Montserrat'` | Body font family |
| `headingFont` | `'MontserratMedium'` | Titles and headings |
| `text` | `'#111111'` | Main text |
| `muted` | `'#6f6f6f'` | Item rows, labels, legends |
| `line` | `'#dcdcdc'` | Hairlines |
| `accent` | `'#111111'` | Title and total |
| `fontSize` | `9` | Base size in points (6–14) |

Your own font: register its bytes and name it in the theme.

```ts
await pdf(record, {
  fonts: { Inter: { normal: readFileSync('Inter-Regular.ttf'), bold: readFileSync('Inter-SemiBold.ttf') } },
  theme: { font: 'Inter', headingFont: 'Inter' },
});
```

### 2. Your own template

A template is a function that receives the data and returns a [pdfmake document](https://pdfmake.github.io/docs/0.3/document-definition-object/). Build it from the same blocks the built-in templates use, so you never redo what SUNAT requires:

```ts
import { blocks, pdf, type Template } from '@tribu-pe/pdf';

const mine: Template = (data, { theme }) => ({
  pageSize: 'A5',
  defaultStyle: { font: theme.font, fontSize: 8 },
  content: [
    blocks.heading(data, theme, { alignment: 'left' }),
    { columns: [blocks.issuer(data, theme), blocks.customer(data, theme)], columnGap: 24 },
    blocks.items(data, theme),
    blocks.totals(data, theme),
    blocks.amountInWords(data, theme),
    blocks.payment(data, theme),
    blocks.detraccion(data, theme),
    blocks.qr(data),
    blocks.legends(data, theme),
  ].filter((block) => block !== null),
});

await pdf(record, { template: mine });
```

| Block | Shows |
|---|---|
| `heading` | RUC, title, number and issue date |
| `issuer`, `customer` | Both parties; "CLIENTES VARIOS" for an Anonymous Customer |
| `affected` | For a note: the document it modifies and the Reason |
| `items` | The Items table |
| `totals` | Taxed, exempt and unaffected values, IGV, total |
| `amountInWords` | "SON: … CON 00/100 SOLES" |
| `payment` | Cash, or credit with the amount pending and each Installment (none on notes) |
| `detraccion` | Legend 2006, code, rate, amount and Banco de la Nación account |
| `qr` | SUNAT's QR: black, level Q, with its quiet zone, at most 6×6 cm |
| `legends` | SUNAT's legend: "Representación impresa de la factura electrónica", and so on |
| `note` | Your closing text |
| `logo` | Your logo, fitted to a box |

`prepare(record, options)` returns the exact `data` a template receives, so you can test your template without drawing a PDF.

## SUNAT rules

Every PDF is checked before it is drawn, whatever the template: the Issuer's RUC and name, the title, the Series-Number, the Items, the totals, the legend "Representación impresa de la …", and the QR (exactly one, the Record's text, black, level Q, a quiet zone of at least 1 mm, at most 6×6 cm, below the total). A template that leaves something out throws `PrintRulesError`, naming each rule and its source:

```
PrintRulesError: The Printed Representation breaks 1 SUNAT rule(s):
- qr/black: The QR must be black, not #0b5394. (R.S. 097-2012 Annex 6 § 6.5 (R.S. 357-2015 Annex C), 6.5.4 h))
```

Every rule, with its source: [docs/sunat-rules.md](docs/sunat-rules.md). `verify(document, data)` runs the checks without drawing; `pdf(record, { verify: false })` skips them, at your own risk.

## Safety

- A template can't reach the network or the disk. Images and fonts go in as bytes, so nothing in a Record or a template makes the server fetch anything.
- An SVG logo must have its text converted to paths (outlines). An SVG with `<text>` is refused, because pdfmake would look for its font on disk.

## License

[MIT](LICENSE). The bundled Montserrat font is under the [SIL Open Font License](fonts/OFL.txt).
