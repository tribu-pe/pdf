# @tribu-pe/pdf

La representación impresa de los comprobantes electrónicos emitidos con [Tribu](https://github.com/tribu-pe/tribu): el PDF que entregas o envías por correo a tu cliente, con el código QR de SUNAT.

[Read in English](README.md)

> [!WARNING]
> **Experimental**, igual que Tribu. Cubre lo que Tribu emite hoy: facturas, boletas, notas de crédito y débito, forma de pago con cuotas y detracciones.

| A4 | Ticket 80 mm |
|---|---|
| [Factura](docs/examples/invoice.a4.pdf) · [con detracción, al crédito](docs/examples/invoice-detraccion.a4.pdf) · [Nota de crédito](docs/examples/credit-note.a4.pdf) | [Boleta, cliente anónimo](docs/examples/receipt-anonymous.ticket80.pdf) · [58 mm](docs/examples/receipt.ticket58.pdf) |

## Instalación

```sh
npm install @tribu-pe/pdf@experimental
# o
pnpm add @tribu-pe/pdf@experimental
```

Dibuja con [pdfmake](https://pdfmake.github.io/docs/): JavaScript puro, sin navegador. Node.js 22.12 o superior.

## Inicio rápido

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { pdf } from '@tribu-pe/pdf';

const { record } = await sunat.invoice({ /* ... */ }); // o el Record que guardaste

const file = await pdf(record, {
  issuer: {
    logo: readFileSync('logo.png'),          // PNG, JPEG o un SVG como texto
    address: 'Av. Javier Prado Este 123, San Isidro, Lima',
    phone: '(01) 234 5678',
    email: 'ventas@miempresa.pe',
  },
  note: 'Gracias por su compra.',
});

writeFileSync(`${record.id}.pdf`, file);
```

`pdf()` recibe el Record tal como lo devuelve Tribu, o como lo recuperas de tu base de datos después de `JSON.parse`. El Record no trae tu dirección, teléfono ni logo, así que se los pasas tú.

## Formatos

```ts
import { pdf, templates } from '@tribu-pe/pdf';

await pdf(record, { template: templates.a4 });        // por defecto
await pdf(record, { template: templates.ticket80 });  // impresora térmica de 80 mm
await pdf(record, { template: templates.ticket58 });  // impresora térmica de 58 mm
await pdf(record, { template: templates.ticket(76) }); // cualquier ancho de 48 a 112 mm
```

Un ticket mide lo que mide su contenido, nunca una página entera.

## Personalizar

Dos niveles, de menos a más trabajo. Ninguno puede romper lo que exige SUNAT: mira [Reglas de SUNAT](#reglas-de-sunat).

### 1. Tema

```ts
await pdf(record, {
  theme: { accent: '#0b5394', muted: '#5f6b7a', fontSize: 9.5 },
});
```

| Campo | Por defecto | |
|---|---|---|
| `font` | `'Montserrat'` | Fuente del texto |
| `headingFont` | `'MontserratMedium'` | Títulos y encabezados |
| `text` | `'#111111'` | Texto principal |
| `muted` | `'#6f6f6f'` | Filas de ítems, etiquetas, leyendas |
| `line` | `'#dcdcdc'` | Líneas finas |
| `accent` | `'#111111'` | Título y total |
| `fontSize` | `9` | Tamaño base en puntos (6–14) |

Tu propia fuente: registra sus bytes y nómbrala en el tema.

```ts
await pdf(record, {
  fonts: { Inter: { normal: readFileSync('Inter-Regular.ttf'), bold: readFileSync('Inter-SemiBold.ttf') } },
  theme: { font: 'Inter', headingFont: 'Inter' },
});
```

### 2. Tu propia plantilla

Una plantilla es una función que recibe los datos y devuelve un [documento de pdfmake](https://pdfmake.github.io/docs/0.3/document-definition-object/). Ármala con los mismos bloques que usan las plantillas incluidas, así nunca rehaces lo que exige SUNAT:

```ts
import { blocks, pdf, type Template } from '@tribu-pe/pdf';

const mia: Template = (data, { theme }) => ({
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

await pdf(record, { template: mia });
```

| Bloque | Muestra |
|---|---|
| `heading` | RUC, título, número y fecha de emisión |
| `issuer`, `customer` | Emisor y cliente; "CLIENTES VARIOS" para un cliente anónimo |
| `affected` | En una nota: el comprobante que modifica y el motivo |
| `items` | La tabla de ítems |
| `totals` | Valores gravados, exonerados e inafectos, IGV y total |
| `amountInWords` | "SON: … CON 00/100 SOLES" |
| `payment` | Contado, o crédito con el monto pendiente y cada cuota (no aparece en notas) |
| `detraccion` | Leyenda 2006, código, porcentaje, monto y cuenta del Banco de la Nación |
| `qr` | El QR de SUNAT: negro, nivel Q, con su margen blanco, máximo 6×6 cm |
| `legends` | La leyenda de SUNAT: "Representación impresa de la factura electrónica", etc. |
| `note` | Tu texto final |
| `logo` | Tu logo, ajustado a un recuadro |

`prepare(record, options)` devuelve exactamente los `data` que recibe una plantilla, para que pruebes tu plantilla sin dibujar un PDF.

## Reglas de SUNAT

Cada PDF se revisa antes de dibujarse, sea cual sea la plantilla: el RUC y el nombre del emisor, el título, la serie y número, los ítems, los totales, la leyenda "Representación impresa de la …" y el QR (uno solo, con el texto del Record, negro, nivel Q, margen blanco de al menos 1 mm, máximo 6×6 cm, debajo del total). Una plantilla a la que le falte algo lanza `PrintRulesError`, con cada regla y su fuente:

```
PrintRulesError: The Printed Representation breaks 1 SUNAT rule(s):
- qr/black: The QR must be black, not #0b5394. (R.S. 097-2012 Annex 6 § 6.5 (R.S. 357-2015 Annex C), 6.5.4 h))
```

Cada regla, con su fuente: [docs/sunat-rules.md](docs/sunat-rules.md) (en inglés). `verify(document, data)` hace la revisión sin dibujar; `pdf(record, { verify: false })` la omite, bajo tu responsabilidad.

## Seguridad

- Una plantilla no puede acceder a internet ni al disco. Las imágenes y fuentes entran como bytes, así que nada en un Record o una plantilla hace que el servidor descargue algo.
- Un logo SVG debe tener su texto convertido a trazos (contornos). Se rechaza un SVG con `<text>`, porque pdfmake buscaría su fuente en el disco.

## Licencia

[MIT](LICENSE). La fuente Montserrat incluida está bajo la [SIL Open Font License](fonts/OFL.txt).
