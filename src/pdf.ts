import { type PrintData, type PrintOptions, printData } from './print-data';
import type { PrintableRecord } from './record';
import { type FontFiles, render } from './render';
import { PrintRulesError, verify } from './rules';
import { type Template, templates } from './templates';
import { type Theme, themeOf } from './theme';

export interface PdfOptions extends PrintOptions {
  /** `templates.a4` by default; `templates.ticket80`, `templates.ticket58`, or your own. */
  readonly template?: Template;
  readonly theme?: Partial<Theme>;
  /** Extra font families, by name, to use in `theme` or in your template. */
  readonly fonts?: Readonly<Record<string, FontFiles>>;
  /**
   * Check the result against SUNAT's rules before drawing (docs/sunat-rules.md). On by default;
   * `false` draws whatever the template says, at your own risk.
   */
  readonly verify?: boolean;
}

/** The data a template receives: useful to test your own template without drawing. */
export function prepare(record: PrintableRecord, options: PrintOptions = {}): PrintData {
  return printData(record, options);
}

/** The Printed Representation of a Tribu Record, as PDF bytes. */
export async function pdf(record: PrintableRecord, options: PdfOptions = {}): Promise<Buffer> {
  const theme = themeOf(options.theme);
  const data = printData(record, options);
  const template = options.template ?? templates.a4;
  const document = template(data, { theme });
  if (options.verify !== false) {
    const issues = verify(document, data);
    if (issues.length > 0) throw new PrintRulesError(issues);
  }
  return render(document, options.fonts);
}
