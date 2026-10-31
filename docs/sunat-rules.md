# SUNAT rules for the Printed Representation

`pdf()` checks every document against these rules before drawing it, whether the template is built-in or yours. A broken rule throws `PrintRulesError`; each issue carries the rule id, a message and its source. `verify(document, data)` runs the same checks without drawing, and `pdf(record, { verify: false })` skips them at your own risk.

Sources:
- the annexes of R.S. 097-2012/SUNAT, as replaced by R.S. 000123-2022 (Annex I, Invoice) and R.S. 114-2019 (Annexes II–IV: Receipt, Credit Note, Debit Note);
- Annex 6 § 6.5, from R.S. 357-2015 Annex C;
- art. 7.4 d), from R.S. 309-2018.

They are summarized, with what is *unconfirmed*, in tribu's [docs/research/printed-representation-2026-11.md](https://github.com/tribu-pe/tribu/blob/main/docs/research/printed-representation-2026-11.md).

## What is printed

| Rule | Applies to | Checks that the document shows |
|---|---|---|
| `issuer/name` | All | The Issuer's name or razón social |
| `issuer/trade-name` | All, when given | The nombre comercial (`issuer.tradeName`) |
| `issuer/ruc` | All | "RUC" followed by the Issuer's number |
| `document/title` | All | "Factura electrónica", "Boleta de venta electrónica", "Nota de crédito electrónica" or "Nota de débito electrónica" |
| `document/id` | All | The Series-Number |
| `document/issue-date` | All | The issue date |
| `document/currency` | All | The currency sign (S/, US$) or code |
| `document/total` | All | The document total |
| `document/subtotals` | All | Taxed, exempt and unaffected sales and IGV, when present. On a Receipt, also the total sales value and the subtotal |
| `document/legend` | All | "Representación impresa de la …" for its type, word for word |
| `item/description` | All | Each Item's description |
| `item/unit-price` | All | Each Item's Unit Price (with tax) |
| `item/quantity`, `item/unit` | Invoice, notes | Each Item's quantity and unit of measure. A Receipt may omit quantity 1 and units NIU or ZZ |
| `receipt/item-value`, `receipt/item-igv` | Receipt | Each Item's value and tax |
| `note/unit-value` | Notes | Each Item's Unit Value |
| `customer/name`, `customer/id` | Invoice, notes | The Customer's name and identity document |
| `note/affected`, `note/reason` | Notes | The Affected Document's Series-Number and the Reason |
| `detraccion/legend` | Invoice with a detracción | Legend 2006, "Operación sujeta a detracción" |

## The QR

| Rule | Checks | Source |
|---|---|---|
| `qr/one` | Exactly one QR | art. 7.4 d) |
| `qr/content` | It holds the Record's QR text, unchanged: `RUC\|TYPE\|SERIES\|NUMBER\|IGV\|TOTAL\|DATE\|CUSTOMER ID TYPE\|CUSTOMER ID\|` | 6.5.3 |
| `qr/level-q` | Error correction level Q | 6.5.2 a) |
| `qr/module` | Each module at least 0.19 mm wide | 6.5.2 b) |
| `qr/black`, `qr/white` | Black modules on a white background | 6.5.4 h) |
| `qr/quiet-zone` | At least 1 mm of white around it | 6.5.4 g) |
| `qr/size` | At most 6 cm × 6 cm, the white space included | 6.5.4 f) |
| `qr/bottom` | In the lower part: after the total | 6.5.4 e) |

`blocks.qr(data, size)` and `sunatQr(text, size)` always produce a QR that passes these rules: square modules, black on white, level Q, byte mode, with its own quiet zone (pdfmake's `padding`), as large as fits in `size` points and never above 6 cm. That is why there is no styled QR: rounded modules and colours fall outside QR Code 2005 (ISO/IEC 18004) and § 6.5.4 h).

## Not checked

These come from the same sources, but either can't be read from a document definition or are *unconfirmed*:

- **Thermal paper:** it must keep the print legible for at least one year (R.S. 097-2012 art. 2.19). That depends on your paper.
- **Description in Spanish:** a translation may be added. The words are yours.
- **Payment Terms, the amount pending and the Installments:** printed by the built-in templates. The Invoice annex doesn't mark them for the printed copy (*unconfirmed*).
- **The amount in words:** printed by the built-in templates. It is optional legend 1000.
- **The detracción code, rate, amount and account:** printed by the built-in templates. Only the legend is in the annex.
- **A Receipt to an identified Customer:** the built-in templates print the name and document. The annex leaves them out of the printed column (*unconfirmed*).
