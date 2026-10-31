import type { ContentQr } from 'pdfmake/interfaces';

/**
 * SUNAT's QR rules: R.S. 097-2012 Annex 6 § 6.5, text from R.S. 357-2015 Annex C, and
 * R.S. 117-2017 Annex B (tribu docs/research/printed-representation-2026-11.md § 3).
 */
export const QR_RULES = {
  /** 6.5.2 a): error correction level Q. */
  eccLevel: 'Q',
  /** 6.5.2 b): module width at least 0.0075 in. */
  minModuleMm: 0.19,
  /** 6.5.4 f): at most 6 cm × 6 cm, the white space around it included. */
  maxSizeMm: 60,
  /** 6.5.4 g): a quiet zone of at least 1 mm. */
  quietZoneMm: 1,
  /** 6.5.4 h): black. */
  color: '#000000',
  background: '#ffffff',
} as const;

export const POINTS_PER_MM = 72 / 25.4;

/**
 * Data capacity in bytes of each QR version at level Q (ISO/IEC 18004, byte mode). The SUNAT
 * text is ASCII, so bytes and characters match.
 */
const CAPACITY_Q = [
  11, 20, 32, 46, 60, 74, 86, 108, 130, 151, 177, 203, 241, 258, 292, 322, 364, 394, 442, 482,
];

/** Modules per side of the smallest version that holds `text` at level Q (21 for version 1). */
export function qrModules(text: string): number {
  const bytes = Buffer.byteLength(text, 'utf8');
  const version = CAPACITY_Q.findIndex((capacity) => bytes <= capacity) + 1;
  if (version === 0)
    throw new RangeError(`The QR text has ${bytes} bytes: too long for SUNAT's QR.`);
  return 17 + 4 * version;
}

/** How pdfmake draws a QR node: whole-point modules, `padding` modules of quiet zone. */
export function qrGeometry(
  text: string,
  node: { readonly fit?: number | undefined; readonly padding?: number | undefined },
): { modulePt: number; quietPt: number; sizePt: number } {
  const modules = qrModules(text);
  // Without `fit`, pdfmake draws 5 points per module.
  const modulePt = Math.floor((node.fit ?? 5 * modules) / modules);
  const quietPt = modulePt * (node.padding ?? 0);
  return { modulePt, quietPt, sizePt: modules * modulePt + 2 * quietPt };
}

/**
 * SUNAT's QR as a pdfmake node, as large as fits in `sizePt` (quiet zone included) and never
 * above 6 cm. Black on white, level Q, byte mode, with its own quiet zone.
 */
export function sunatQr(text: string, sizePt: number): ContentQr {
  const modules = qrModules(text);
  const limit = Math.min(sizePt, QR_RULES.maxSizeMm * POINTS_PER_MM);
  const quiet = QR_RULES.quietZoneMm * POINTS_PER_MM;
  for (let modulePt = Math.floor(limit / modules); modulePt >= 1; modulePt -= 1) {
    const padding = Math.ceil(quiet / modulePt);
    if ((modules + 2 * padding) * modulePt <= limit) {
      return {
        qr: text,
        eccLevel: QR_RULES.eccLevel,
        mode: 'octet',
        fit: modules * modulePt,
        padding,
        foreground: QR_RULES.color,
        background: QR_RULES.background,
      };
    }
  }
  throw new RangeError(`A QR of ${modules} modules does not fit in ${sizePt.toFixed(1)} points.`);
}
