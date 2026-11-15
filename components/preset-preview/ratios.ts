/* The contrast numbers of one accent, shared by the server render and the island: the accent text
 * that will actually be written on the canvas (after the contrast correction), and the text colour
 * on top of the accent. Both schemes are shown, so the reader does not have to switch the theme to
 * see whether the colour survives. Pure functions, no DOM and no Node built-ins, because the island
 * build imports this module too. */
import { bestOn, contrast, ensureContrast, parseHex } from "../../src/color.ts";

/** The four ratios one accent produces. */
export interface ContrastRatios {
  readonly accentLight: number;
  readonly accentDark: number;
  readonly onAccentLight: number;
  readonly onAccentDark: number;
}

/** The ratio of two hex colours, or `undefined` when a value is not a colour. */
function ratio(a: string, b: string): number | undefined {
  const first = parseHex(a);
  const second = parseHex(b);
  return first === undefined || second === undefined ? undefined : contrast(first, second);
}

/** The accent the page writes on a canvas: the chosen colour lifted until it reaches 4.5:1. */
export function adjustedAccent(accent: string, canvas: string): string {
  return ensureContrast(accent, canvas, 4.5);
}

/** The contrast ratios of an accent on both canvases, or `undefined` when the input is not a colour. */
export function contrastRatios(accent: string, canvas: { readonly light: string; readonly dark: string }): ContrastRatios | undefined {
  if (parseHex(accent) === undefined) return undefined;
  const light = adjustedAccent(accent, canvas.light);
  const dark = adjustedAccent(accent, canvas.dark);
  const accentLight = ratio(light, canvas.light);
  const accentDark = ratio(dark, canvas.dark);
  const onAccentLight = ratio(ensureContrast(bestOn(light), light, 4.5), light);
  const onAccentDark = ratio(ensureContrast(bestOn(dark), dark, 4.5), dark);
  if (accentLight === undefined || accentDark === undefined || onAccentLight === undefined || onAccentDark === undefined) return undefined;
  return { accentLight, accentDark, onAccentLight, onAccentDark };
}

/** A ratio as the page writes it: two decimals and the `:1` WCAG uses. */
export function formatRatio(value: number): string {
  return `${value.toFixed(2)}:1`;
}

/** Fills `{name}` placeholders from text values; a missing value keeps its placeholder. */
export function fill(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(/\{(\w+)\}/g, (placeholder, name: string) => values[name] ?? placeholder);
}
