import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import type { PrintData } from './print-data';
import { POINTS_PER_MM, QR_RULES, qrGeometry } from './qr';

/** One broken SUNAT rule in a Printed Representation. */
export interface PrintIssue {
  /** The rule id, as listed in docs/sunat-rules.md. */
  readonly rule: string;
  readonly message: string;
  readonly source: string;
}

/** Thrown by `pdf()` when a template leaves out something SUNAT requires. */
export class PrintRulesError extends Error {
  readonly issues: readonly PrintIssue[];
  constructor(issues: readonly PrintIssue[]) {
    super(
      `The Printed Representation breaks ${issues.length} SUNAT rule(s):\n${issues
        .map((issue) => `- ${issue.rule}: ${issue.message} (${issue.source})`)
        .join('\n')}`,
    );
    this.name = 'PrintRulesError';
    this.issues = issues;
  }
}

const ANNEXES = 'R.S. 000123-2022 Annex I; R.S. 114-2019 Annexes II–IV';
const QR_SOURCE = 'R.S. 097-2012 Annex 6 § 6.5 (R.S. 357-2015 Annex C)';

interface QrFound {
  readonly node: Record<string, unknown>;
  /** How much text came before it, to tell what is above the QR. */
  readonly textBefore: number;
}

/** Every text and QR in a pdfmake document, in reading order. */
function scan(document: TDocumentDefinitions): { text: string; qrs: QrFound[] } {
  const parts: string[] = [];
  const qrs: QrFound[] = [];
  const length = () => parts.join(' ').replace(/\s+/g, ' ').length;
  const text = (value: unknown): void => {
    if (typeof value === 'string') parts.push(value);
    else if (Array.isArray(value)) for (const item of value) text(item);
    else if (value !== null && typeof value === 'object') walk(value);
  };
  const walk = (node: unknown): void => {
    if (typeof node === 'string') {
      parts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    const object = node as Record<string, unknown>;
    if ('qr' in object) qrs.push({ node: object, textBefore: length() });
    if ('text' in object) text(object['text']);
    for (const key of ['stack', 'columns', 'ul', 'ol']) walk(object[key]);
    const table = object['table'] as { body?: unknown } | undefined;
    if (table !== undefined) walk(table.body);
  };
  walk(document.content);
  return { text: parts.join(' ').replace(/\s+/g, ' '), qrs };
}

/**
 * Checks a laid-out document against what SUNAT requires on a Printed Representation
 * (tribu docs/research/printed-representation-2026-11.md). `pdf()` runs it on every template,
 * built-in or yours, before drawing. docs/sunat-rules.md lists every rule.
 */
export function verify(document: TDocumentDefinitions, data: PrintData): PrintIssue[] {
  const issues: PrintIssue[] = [];
  const { text, qrs } = scan(document);
  const fail = (rule: string, message: string, source = ANNEXES) => {
    issues.push({ rule, message, source });
  };
  const required = (rule: string, value: string, what: string, source = ANNEXES) => {
    const shown = value.length === 0 || text.includes(value.replace(/\s+/g, ' '));
    if (!shown) fail(rule, `${what} must be printed: "${value}".`, source);
  };

  // Every Document.
  required('issuer/name', data.issuer.name, "The Issuer's name");
  if (data.issuer.tradeName !== undefined) {
    required('issuer/trade-name', data.issuer.tradeName, "The Issuer's nombre comercial");
  }
  if (!new RegExp(`RUC:?\\s*${data.issuer.ruc}`).test(text)) {
    fail(
      'issuer/ruc',
      `"RUC" followed by the Issuer's number must be printed (RUC ${data.issuer.ruc}).`,
    );
  }
  if (!text.toLowerCase().includes(data.title.toLowerCase())) {
    fail('document/title', `The title must be printed: "${data.title}".`);
  }
  required('document/id', data.id, 'The Series-Number');
  required('document/issue-date', data.issueDate, 'The issue date');
  if (!text.includes(data.currency.symbol) && !text.includes(data.currency.code)) {
    fail(
      'document/currency',
      `The currency sign or name must be printed (${data.currency.symbol}).`,
    );
  }
  required('document/total', data.total, 'The document total');
  for (const row of data.subtotals) required('document/subtotals', row.amount, row.label);
  data.items.forEach((item, index) => {
    const which = `Item ${index + 1}`;
    required('item/description', item.description, `${which}: its description`);
    required('item/unit-price', item.unitPrice, `${which}: its Unit Price`);
    if (data.kind === 'receipt') {
      // A Receipt may leave out quantity 1 and units NIU or ZZ (Annex II, B15, B16), and must
      // show each Item's value and tax (B29, B30).
      required('receipt/item-value', item.value, `${which}: its Item Value`);
      required('receipt/item-igv', item.igv, `${which}: its tax`);
    } else {
      required('item/quantity', item.quantity, `${which}: its quantity`);
      required('item/unit', item.unit, `${which}: its unit of measure`);
    }
    if (data.kind === 'credit-note' || data.kind === 'debit-note') {
      required('note/unit-value', item.unitValue, `${which}: its Unit Value`);
    }
  });
  for (const legend of data.legends) required('document/legend', legend, "SUNAT's legend");
  if (data.detraccion !== undefined) {
    required(
      'detraccion/legend',
      data.detraccion.legend,
      'Legend 2006',
      'Catalog 52; R.S. 183-2004 art. 19.1 b)',
    );
  }

  // Invoices and notes name the Customer.
  if (data.kind !== 'receipt') {
    required('customer/name', data.customer.name, "The Customer's name");
    required('customer/id', data.customer.idNumber, "The Customer's identity document");
  }
  // Notes name the Affected Document and the Reason.
  if (data.affected !== undefined) {
    required('note/affected', data.affected.id, 'The Affected Document');
    required('note/reason', data.affected.reason, 'The Reason');
  }

  // The QR.
  if (qrs.length !== 1) {
    fail(
      'qr/one',
      `The document must carry exactly one QR, not ${qrs.length}.`,
      'R.S. 097-2012 art. 7.4 d) (R.S. 309-2018)',
    );
  }
  for (const { node, textBefore } of qrs) {
    if (node['qr'] !== data.qr.text) {
      fail(
        'qr/content',
        "The QR must hold the Record's QR text, unchanged.",
        `${QR_SOURCE}, 6.5.3`,
      );
      continue;
    }
    if (node['eccLevel'] !== QR_RULES.eccLevel) {
      fail('qr/level-q', 'The QR must use error correction level Q.', `${QR_SOURCE}, 6.5.2 a)`);
    }
    const color = String(node['foreground'] ?? '#000').toLowerCase();
    const background = String(node['background'] ?? '#fff').toLowerCase();
    if (!['#000', '#000000', 'black'].includes(color)) {
      fail('qr/black', `The QR must be black, not ${color}.`, `${QR_SOURCE}, 6.5.4 h)`);
    }
    if (!['#fff', '#ffffff', 'white'].includes(background)) {
      fail(
        'qr/white',
        `The QR's background must be white, not ${background}.`,
        `${QR_SOURCE}, 6.5.4 g)`,
      );
    }
    const geometry = qrGeometry(data.qr.text, node as { fit?: number; padding?: number });
    const mm = (points: number) => points / POINTS_PER_MM;
    if (mm(geometry.modulePt) < QR_RULES.minModuleMm) {
      fail(
        'qr/module',
        `Each QR module must be at least ${QR_RULES.minModuleMm} mm wide.`,
        `${QR_SOURCE}, 6.5.2 b)`,
      );
    }
    if (mm(geometry.quietPt) < QR_RULES.quietZoneMm) {
      fail(
        'qr/quiet-zone',
        `The QR needs at least ${QR_RULES.quietZoneMm} mm of white around it: set "padding" (in modules), or use blocks.qr.`,
        `${QR_SOURCE}, 6.5.4 g)`,
      );
    }
    if (mm(geometry.sizePt) > QR_RULES.maxSizeMm + 1e-6) {
      fail(
        'qr/size',
        `The QR measures ${mm(geometry.sizePt).toFixed(1)} mm with its white space: at most ${QR_RULES.maxSizeMm} mm.`,
        `${QR_SOURCE}, 6.5.4 f)`,
      );
    }
    if (textBefore < text.indexOf(data.total)) {
      fail(
        'qr/bottom',
        'The QR goes in the lower part, after the total.',
        `${QR_SOURCE}, 6.5.4 e)`,
      );
    }
  }
  return issues;
}
