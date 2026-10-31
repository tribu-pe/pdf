/** The look of the built-in templates. Every field has a default; pass only what changes. */
export interface Theme {
  /** Body font family: a bundled one ("Montserrat", "MontserratMedium") or one you register. */
  readonly font: string;
  /** Font family for titles and headings. */
  readonly headingFont: string;
  /** Main text colour. */
  readonly text: string;
  /** Secondary text: Item rows, labels, legends. */
  readonly muted: string;
  /** Hairlines between rows. */
  readonly line: string;
  /** Title and total. */
  readonly accent: string;
  /** Base size in points; the rest scales from it. */
  readonly fontSize: number;
}

export const DEFAULT_THEME: Theme = {
  font: 'Montserrat',
  headingFont: 'MontserratMedium',
  text: '#111111',
  muted: '#6f6f6f',
  line: '#dcdcdc',
  accent: '#111111',
  fontSize: 9,
};

const COLOR = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Merges a partial theme over the defaults, refusing values pdfmake would silently ignore. */
export function themeOf(partial: Partial<Theme> = {}): Theme {
  const theme = { ...DEFAULT_THEME, ...partial };
  for (const key of ['text', 'muted', 'line', 'accent'] as const) {
    if (!COLOR.test(theme[key])) {
      throw new TypeError(
        `theme.${key} must be a colour like #111 or #0b5394, not "${theme[key]}".`,
      );
    }
  }
  if (!(theme.fontSize >= 6 && theme.fontSize <= 14)) {
    throw new RangeError(`theme.fontSize must be between 6 and 14 points, not ${theme.fontSize}.`);
  }
  return theme;
}
