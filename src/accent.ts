/* The accent family, derived from one colour and shared by the build and the preset-preview island.
 * It depends only on the colour math, never on Node built-ins, so the island build can import it
 * without a package resolution the browser cannot do. The rule is the server's rule: hold the accent
 * to 4.5:1 as text on every surface, keep its hue, and derive the hover, on-accent, focus, selection,
 * and selected state from the corrected value. */
import { bestOn, contrast, ensureContrast, fromOklch, parseHex, toOklch } from "./color.ts";

/** A token the brand may set, with a light and a dark value. */
export interface BrandToken {
  readonly light: string;
  readonly dark: string;
}

/** The tokens a brand changes, by their frozen `tokens/names.json` name. */
export type BrandTokens = Readonly<Record<string, BrandToken>>;

/** One token's CSS value: the plain value when both schemes agree, `light-dark()` otherwise. */
export function tokenCssValue(token: BrandToken): string {
  return token.light === token.dark ? token.light : `light-dark(${token.light}, ${token.dark})`;
}

const ratio = { text: 4.5, ring: 3 } as const;

/** The surfaces the accent is read on, per scheme: the canvas, the surface, and the raised surface. */
export interface AccentSurfaces {
  readonly light: readonly string[];
  readonly dark: readonly string[];
}

/** The page text per scheme, which decides whether a selection is dark enough to read on. */
export interface AccentText {
  readonly light: string;
  readonly dark: string;
}

/** A selection background that keeps the page text readable, close to the canvas. */
function selection(accent: string, text: string, scheme: "light" | "dark"): string {
  const source = toOklch(accent) ?? { l: 0.6, c: 0, h: 0 };
  const step = scheme === "light" ? 0.005 : -0.005;
  let lightness = scheme === "light" ? 0.94 : 0.3;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = fromOklch({ l: lightness, c: Math.min(source.c, 0.05), h: source.h });
    const textRgb = parseHex(text);
    const background = parseHex(value);
    if (textRgb !== undefined && background !== undefined && contrast(textRgb, background) >= ratio.text) return value;
    lightness = Math.min(1, Math.max(0, lightness + step));
  }
  return scheme === "light" ? "#ffffff" : "#000000";
}

/** Moves a colour's lightness by `amount`, keeping hue and chroma. */
function shift(colourValue: string, amount: number): string {
  const source = toOklch(colourValue);
  if (source === undefined) return colourValue;
  return fromOklch({ l: Math.min(1, Math.max(0, source.l + amount)), c: source.c, h: source.h });
}

/** The accent family: accent, hover, on-accent, links, focus, selection, and the selected state. */
export function accentTokens(accent: string, surfaces: AccentSurfaces, text: AccentText): BrandTokens {
  const derived: Record<string, { light: string; dark: string }> = {};
  const against = (colour: string, scheme: "light" | "dark", wanted: number): string => {
    let value = colour;
    for (const surface of surfaces[scheme]) value = ensureContrast(value, surface, wanted);
    return value;
  };
  for (const scheme of ["light", "dark"] as const) {
    // The accent is read as text on the canvas, the surface, and the raised surface, so it is held
    // to the text ratio on all three; the last correction also covers the two before it.
    const base = against(accent, scheme, ratio.text);
    const hover = against(shift(base, scheme === "light" ? -0.06 : 0.06), scheme, ratio.text);
    const onAccent = ensureContrast(bestOn(base), base, ratio.text);
    const focus = against(base, scheme, ratio.ring);
    const selected = selection(accent, text[scheme], scheme);
    const selectedFg = ensureContrast(base, selected, ratio.text);
    const values: Record<string, string> = {
      accent: base,
      "accent-hover": hover,
      "on-accent": onAccent,
      link: base,
      "link-hover": hover,
      focus,
      selection: selected,
      "state-focus-ring": focus,
      "state-selected-bg": selected,
      "state-selected-fg": selectedFg,
    };
    for (const [name, value] of Object.entries(values)) {
      const token = name.startsWith("state-") ? name : `color-${name}`;
      derived[token] = { ...(derived[token] ?? { light: "", dark: "" }), [scheme]: value };
    }
  }
  return derived;
}
