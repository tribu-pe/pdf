import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { TDocumentDefinitions } from 'pdfmake/interfaces';

/** A font family: the bytes of each style. Missing styles fall back to `normal`. */
export interface FontFiles {
  readonly normal: Uint8Array;
  readonly bold?: Uint8Array;
  readonly italics?: Uint8Array;
  readonly bolditalics?: Uint8Array;
}

interface PdfMake {
  virtualfs: { writeFileSync(name: string, data: Uint8Array): void };
  setFonts(fonts: Record<string, Record<string, string>>): void;
  setUrlAccessPolicy(callback: (url: string) => boolean): void;
  setLocalAccessPolicy(callback: (path: string) => boolean): void;
  createPdf(document: TDocumentDefinitions): { getBuffer(): Promise<Buffer> };
}

// pdfmake 0.3 is CommonJS and exports one shared instance; Tribu builds its own, so its fonts
// and access policies never touch a pdfmake the application also uses.
const shared = createRequire(import.meta.url)('pdfmake') as PdfMake;
const PdfMakeClass = Object.getPrototypeOf(shared).constructor as new () => PdfMake;

const FONTS = new URL('../fonts/', import.meta.url);

/** Montserrat (SIL Open Font License, fonts/OFL.txt), the default look. */
function bundledFonts(): Record<string, FontFiles> {
  const read = (file: string) => readFileSync(new URL(file, FONTS));
  const regular = read('Montserrat-Regular.ttf');
  const medium = read('Montserrat-Medium.ttf');
  const semibold = read('Montserrat-SemiBold.ttf');
  return {
    Montserrat: { normal: regular, bold: semibold },
    MontserratMedium: { normal: medium, bold: semibold },
  };
}

let bundled: Record<string, FontFiles> | undefined;

/**
 * Draws a pdfmake document to PDF bytes. Templates can't reach the network or the disk: images
 * and fonts come only as bytes, so a template or a Record's text can't make the server fetch
 * anything.
 */
export async function render(
  document: TDocumentDefinitions,
  fonts: Readonly<Record<string, FontFiles>> = {},
): Promise<Buffer> {
  bundled ??= bundledFonts();
  const pdfmake = new PdfMakeClass();
  pdfmake.setUrlAccessPolicy(() => false);
  pdfmake.setLocalAccessPolicy(() => false);
  const descriptors: Record<string, Record<string, string>> = {};
  for (const [family, files] of Object.entries({ ...bundled, ...fonts })) {
    const styles: Record<string, string> = {};
    for (const style of ['normal', 'bold', 'italics', 'bolditalics'] as const) {
      const bytes = files[style] ?? files.normal;
      const name = `tribu-pdf/${family}-${style}.ttf`;
      pdfmake.virtualfs.writeFileSync(name, bytes);
      styles[style] = name;
    }
    descriptors[family] = styles;
  }
  pdfmake.setFonts(descriptors);
  // pdfmake's own default is Roboto, which this package doesn't bundle.
  const defaultStyle = { font: 'Montserrat', ...document.defaultStyle };
  return pdfmake.createPdf({ ...document, defaultStyle }).getBuffer();
}
