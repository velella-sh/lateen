/* The contrast numbers of one accent, and the palette they are measured on, shared by the server
 * render and the island. Pure functions, no DOM and no Node built-ins, because the island build
 * imports this module too. */
import { parseJson } from "../../src/guards.ts";
import type { BrandTokens } from "../../src/accent.ts";
import { contrast, parseHex } from "../../src/color.ts";

/** The scheme surfaces a preview is drawn on, and the text that sits on them. */
export interface PreviewScheme {
  /** The canvas, the surface, and the raised surface, in that order. */
  readonly surfaces: readonly string[];
  readonly text: string;
}

/** Everything the island needs to derive the accent family exactly as the server did. */
export interface PreviewPalette {
  readonly light: PreviewScheme;
  readonly dark: PreviewScheme;
}

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

/** The palette as the JSON the picker's `data-palette` carries. */
export function paletteJson(palette: PreviewPalette): string {
  return JSON.stringify(palette);
}

/** Parses `data-palette`, or `undefined` when it is missing or not the shape the server writes. */
export function parsePalette(raw: string | null | undefined): PreviewPalette | undefined {
  if (raw === null || raw === undefined || raw === "") return undefined;
  const value = parseJson(raw);
  const scheme = (candidate: unknown): PreviewScheme | undefined => {
    if (candidate === null || typeof candidate !== "object") return undefined;
    const { surfaces, text } = candidate as { surfaces?: unknown; text?: unknown };
    if (!Array.isArray(surfaces) || surfaces.length !== 3 || surfaces.some((item) => typeof item !== "string")) return undefined;
    if (typeof text !== "string") return undefined;
    return { surfaces, text };
  };
  if (value === null || typeof value !== "object") return undefined;
  const light = scheme((value as { light?: unknown }).light);
  const dark = scheme((value as { dark?: unknown }).dark);
  return light === undefined || dark === undefined ? undefined : { light, dark };
}

/** Measures the actual accent and its text as rendered, after derivation against every surface. */
export function contrastRatios(tokens: BrandTokens, palette: PreviewPalette): ContrastRatios | undefined {
  const accent = tokens["color-accent"];
  const onAccent = tokens["color-on-accent"];
  if (accent === undefined || onAccent === undefined) return undefined;
  const accentLight = ratio(accent.light, palette.light.surfaces[0] ?? "");
  const accentDark = ratio(accent.dark, palette.dark.surfaces[0] ?? "");
  const onAccentLight = ratio(onAccent.light, accent.light);
  const onAccentDark = ratio(onAccent.dark, accent.dark);
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
