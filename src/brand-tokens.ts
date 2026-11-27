import { accentTokens, tokenCssValue, type Accent, type BrandToken, type BrandTokens } from "./accent.ts";
import { contrast, ensureContrast, fromOklch, parseHex, toHex, toOklch } from "./color.ts";
import { withBase } from "./url.ts";

/** The corner-radius options, each a multiplier of the default scale. `none` squares every corner. */
export const RADII = ["none", "small", "medium", "large"] as const;
export type Radius = (typeof RADII)[number];

/** The density options, each a multiplier of the spacing scale. */
export const DENSITIES = ["compact", "comfortable"] as const;
export type Density = (typeof DENSITIES)[number];

/** One self-hosted font file: a root-relative path from the site root, and its descriptors. */
export interface FontFile {
  readonly src: string;
  readonly weight: string;
  readonly style: string;
}

/** One custom family and the files that carry it. */
export interface FontFamily {
  readonly family: string;
  readonly files: readonly FontFile[];
}

export type NeutralScheme = Readonly<Record<"canvas" | "surface" | "text", string>>;
export type Neutral = string | Readonly<Record<"light" | "dark", NeutralScheme>>;

/** The validated brand options. Every field is optional: absent keeps the theme's value. */
export interface Brand {
  readonly preset?: string;
  readonly accent?: Accent;
  readonly neutral?: Neutral;
  readonly sans?: FontFamily;
  readonly mono?: FontFamily;
  readonly radius?: Radius;
  readonly density?: Density;
  readonly showpiece?: Showpiece;
}

/** The showpiece look of a preset: the backdrop variant, the motif seed and the backdrop intensity. */
export const INTENSITIES = ["soft", "standard"] as const;
export type Intensity = (typeof INTENSITIES)[number];
export interface Showpiece {
  readonly backdrop?: string;
  readonly motif?: string;
  readonly intensity?: Intensity;
}

/** A token the brand may set, with a light and a dark value. */
const TEXT_RATIO = 4.5;

/**
 * The theme's own colours, repeated here because the brand derives from them. `test/brand.test.ts`
 * compares every value with `tokens/*.json`, so the copy cannot drift unnoticed.
 */
export const DEFAULT_COLORS = {
  light: {
    canvas: "#f4f4f9",
    surface: "#e7e7ed",
    "surface-raised": "#fbfbfd",
    text: "#23212c",
    heading: "#23212c",
    muted: "#4a4658",
    border: "#d5d3e3",
    "border-strong": "#8481c7",
    accent: "#23212c",
    "accent-hover": "#393743",
    "on-accent": "#dcd7eb",
    link: "#3f5f88",
    "link-hover": "#3f5f88",
    focus: "#4c6f9a",
    selection: "#d5d3e3",
  },
  dark: {
    canvas: "#23212c",
    surface: "#393743",
    "surface-raised": "#443f58",
    text: "#dcd7eb",
    heading: "#dcd7eb",
    muted: "#b7b2c9",
    border: "#4a4760",
    "border-strong": "#8f8cd8",
    accent: "#dcd7eb",
    "accent-hover": "#f4f4f9",
    "on-accent": "#23212c",
    link: "#b7d0ea",
    "link-hover": "#d4e4f5",
    focus: "#8fb0d4",
    selection: "#393743",
  },
} as const;

/** The theme's own code colours, repeated so the brand can re-check them on a tinted background. */
export const DEFAULT_CODE = {
  light: {
    bg: "#e7e7ed",
    fg: "#23212c",
    border: "#d5d3e3",
    "line-highlight": "#d5d3e3",
    comment: "#4a4658",
    keyword: "#5b3f99",
    string: "#285f58",
    number: "#6c407a",
    function: "#3f5f88",
    tag: "#425489",
    punctuation: "#4a4658",
  },
  dark: {
    bg: "#1b1a26",
    fg: "#e6e1f0",
    border: "#4a4760",
    "line-highlight": "#343047",
    comment: "#aaa2ba",
    keyword: "#d7bff4",
    string: "#a5d4ca",
    number: "#e4c8b5",
    function: "#b7d0ea",
    tag: "#bec4ef",
    punctuation: "#b7b2c9",
  },
} as const;

/** The theme's spacing scale, the base the compact density scales down. */
export const DEFAULT_SPACE: Readonly<Record<string, string>> = {
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "8": "2rem",
  "12": "3rem",
  "16": "4rem",
};

/** The theme's corner-radius scale, the base a radius option multiplies. `full` is a shape, not a corner. */
export const DEFAULT_RADIUS: Readonly<Record<string, string>> = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "1rem",
  ctl: "0.375rem",
  card: "0.625rem",
};

/** The colour roles a neutral tint touches, and how much of the tint's chroma each keeps. */
const NEUTRAL_ROLES: Readonly<Record<string, { readonly factor: number; readonly cap: number }>> = {
  canvas: { factor: 0.3, cap: 0.012 },
  surface: { factor: 0.35, cap: 0.014 },
  "surface-raised": { factor: 0.3, cap: 0.012 },
  border: { factor: 0.5, cap: 0.02 },
  "border-strong": { factor: 0.5, cap: 0.02 },
  text: { factor: 0.2, cap: 0.012 },
  heading: { factor: 0.2, cap: 0.012 },
  muted: { factor: 0.2, cap: 0.012 },
};

const RADIUS_SCALE: Readonly<Record<Radius, number>> = { none: 0, small: 0.5, medium: 1, large: 1.5 };
const DENSITY_SCALE: Readonly<Record<Density, number>> = { compact: 0.75, comfortable: 1 };

/** Rounds a token length to four decimals so two builds write the same text. */
const length = (value: number): string => `${Number(value.toFixed(4))}rem`;

/** The rem number of a token length, or `undefined` when it is not a simple rem value. */
function rem(value: string): number | undefined {
  const match = /^([\d.]+)rem$/.exec(value);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** Derives supporting colours from the tint, then applies any explicit neutral roles. */
function neutralTokens(neutral: Neutral, scheme: "light" | "dark"): Record<string, string> {
  const palette = typeof neutral === "string" ? undefined : neutral[scheme];
  const tint = toOklch(typeof neutral === "string" ? neutral : neutral[scheme].surface);
  const base = DEFAULT_COLORS[scheme];
  const tokens: Record<string, string> = {};
  if (tint === undefined) return { ...base };
  for (const [role, { factor, cap }] of Object.entries(NEUTRAL_ROLES)) {
    const original = toOklch(base[role as keyof typeof base]);
    if (original === undefined) continue;
    tokens[role] = fromOklch({ l: original.l, c: Math.min(tint.c * factor, cap), h: tint.h });
  }
  Object.assign(tokens, palette);
  // Text and muted text keep their contrast on every surface the tint moved.
  const surfaces = [tokens.canvas, tokens.surface, tokens["surface-raised"]].filter((value): value is string => value !== undefined);
  for (const role of ["text", "heading", "muted"]) {
    let value = tokens[role];
    if (value === undefined) continue;
    for (const surface of surfaces) value = ensureContrast(value, surface, TEXT_RATIO);
    tokens[role] = value;
  }
  tokens.heading = tokens.text ?? base.heading;
  if (palette !== undefined) {
    tokens["border-strong"] = ensureContrast(tokens["border-strong"] ?? base["border-strong"], palette.canvas, 3);
  }
  return tokens;
}

/** The code colours: the block background from the neutral surface, every syntax colour re-checked on it. */
function codeTokens(neutral: { light: Record<string, string>; dark: Record<string, string> }): BrandTokens {
  const derived: Record<string, { light: string; dark: string }> = {};
  for (const scheme of ["light", "dark"] as const) {
    const base = DEFAULT_CODE[scheme];
    const tint = toOklch(neutral[scheme].canvas ?? DEFAULT_COLORS[scheme].canvas);
    const original = toOklch(base.bg);
    const bg =
      tint === undefined || original === undefined
        ? base.bg
        : fromOklch({ l: original.l, c: Math.min(tint.c, 0.012), h: tint.h });
    const fg = neutral[scheme].text ?? base.fg;
    const border = neutral[scheme].border ?? base.border;
    const syntax: Readonly<Record<string, string>> = {
      comment: base.comment,
      keyword: base.keyword,
      string: base.string,
      number: base.number,
      function: base.function,
      tag: base.tag,
      punctuation: base.punctuation,
    };
    for (const [role, value] of Object.entries({ bg, fg, border, ...syntax })) {
      const adjusted = role === "bg" || role === "border" ? value : ensureContrast(value, bg, TEXT_RATIO);
      derived[`code-${role}`] = { ...(derived[`code-${role}`] ?? { light: "", dark: "" }), [scheme]: adjusted };
    }
    const highlight = "code-line-highlight";
    derived[highlight] = { ...(derived[highlight] ?? { light: "", dark: "" }), [scheme]: base["line-highlight"] };
  }
  return derived;
}

/** The corner radius and spacing a brand sets, as frozen token names. */
function shapeTokens(brand: Brand): BrandTokens {
  const tokens: Record<string, BrandToken> = {};
  if (brand.radius !== undefined) {
    const scale = RADIUS_SCALE[brand.radius];
    for (const [name, value] of Object.entries(DEFAULT_RADIUS)) {
      const number = rem(value);
      if (number === undefined) continue;
      tokens[`radius-${name}`] = { light: length(number * scale), dark: length(number * scale) };
    }
  }
  if (brand.density !== undefined) {
    const scale = DENSITY_SCALE[brand.density];
    for (const [name, value] of Object.entries(DEFAULT_SPACE)) {
      const number = rem(value);
      if (number === undefined) continue;
      tokens[`space-${name}`] = { light: length(number * scale), dark: length(number * scale) };
    }
    if (brand.density === "compact") tokens["type-leading-code"] = { light: "1.45", dark: "1.45" };
  }
  return tokens;
}

/**
 * The tokens a brand changes, by frozen name. A category the brand does not set is absent, so the
 * theme's own CSS stays in charge of it: no `neutral` means no tint, no `accent` means no accent
 * rewrite, and no `radius` or `density` means the shipped scale.
 */
export function brandTokens(brand: Brand): BrandTokens {
  const tokens: Record<string, BrandToken> = {};
  const neutral = {
    light: brand.neutral === undefined ? { ...DEFAULT_COLORS.light } : neutralTokens(brand.neutral, "light"),
    dark: brand.neutral === undefined ? { ...DEFAULT_COLORS.dark } : neutralTokens(brand.neutral, "dark"),
  };
  if (brand.neutral !== undefined) {
    for (const scheme of ["light", "dark"] as const) {
      for (const [role, value] of Object.entries(neutral[scheme])) {
        if (!(role in DEFAULT_COLORS.light)) continue;
        const token = `color-${role}`;
        tokens[token] = { ...(tokens[token] ?? { light: "", dark: "" }), [scheme]: value };
      }
    }
    Object.assign(tokens, codeTokens({ light: neutral.light, dark: neutral.dark }));
  }
  if (brand.accent !== undefined) {
    const surfaces = {
      light: [
        neutral.light.canvas ?? DEFAULT_COLORS.light.canvas,
        neutral.light.surface ?? DEFAULT_COLORS.light.surface,
        neutral.light["surface-raised"] ?? DEFAULT_COLORS.light["surface-raised"],
      ],
      dark: [
        neutral.dark.canvas ?? DEFAULT_COLORS.dark.canvas,
        neutral.dark.surface ?? DEFAULT_COLORS.dark.surface,
        neutral.dark["surface-raised"] ?? DEFAULT_COLORS.dark["surface-raised"],
      ],
    };
    const text = {
      light: neutral.light.text ?? DEFAULT_COLORS.light.text,
      dark: neutral.dark.text ?? DEFAULT_COLORS.dark.text,
    };
    Object.assign(tokens, accentTokens(brand.accent, surfaces, text));
  }
  Object.assign(tokens, shapeTokens(brand));
  return tokens;
}

const CSS_FONT_STACK = {
  body: 'Manrope, "Manrope Fallback", Vazirmatn, system-ui, sans-serif',
  rtl: 'Vazirmatn, Manrope, "Vazirmatn Fallback", "Manrope Fallback", system-ui, sans-serif',
  mono: 'JetBrains Mono, "JetBrains Mono Fallback", ui-monospace, monospace',
} as const;

const quote = (value: string): string => `"${value.replace(/["\\]/g, "\\$&").replace(/[\n\r\f]/g, " ")}"`;

/** The `@font-face` rules of the custom families, each file one face. */
export function fontFaces(brand: Brand, base = ""): string {
  const rules: string[] = [];
  for (const family of [brand.sans, brand.mono]) {
    if (family === undefined) continue;
    for (const file of family.files) {
      if (typeof file.src !== "string") continue;
      rules.push(
        `@font-face { font-family: ${quote(family.family)}; font-style: ${file.style || "normal"}; font-display: swap; ` +
          `font-weight: ${file.weight || "400"}; src: url("${withBase(base, file.src)}") format("woff2"); }`,
      );
    }
  }
  return rules.join("\n");
}

/** The font stacks of the custom families, each family first and the shipped fallbacks kept. */
function fontTokens(brand: Brand): BrandTokens {
  const tokens: Record<string, BrandToken> = {};
  const stacks = (family: FontFamily, fallback: string): string => [quote(family.family), fallback].join(", ");
  if (brand.sans !== undefined) {
    const body = stacks(brand.sans, CSS_FONT_STACK.body);
    const rtl = stacks(brand.sans, CSS_FONT_STACK.rtl);
    for (const name of ["font-body", "font-heading", "font-ui"]) tokens[`type-${name}`] = { light: body, dark: body };
    for (const name of ["font-body", "font-heading", "font-ui"]) tokens[`rtl-${name}`] = { light: rtl, dark: rtl };
  }
  if (brand.mono !== undefined) {
    const mono = stacks(brand.mono, CSS_FONT_STACK.mono);
    tokens["type-font-mono"] = { light: mono, dark: mono };
  }
  return tokens;
}

/** One `:root:root` block (or a scoped class) with a `light-dark()` value per token. */
export function tokensCss(tokens: BrandTokens, selector = ":root:root"): string {
  const lines = Object.entries(tokens).map(([name, value]) => `  --${name}: ${tokenCssValue(value)};`);
  return lines.length === 0 ? "" : `${selector} {\n${lines.join("\n")}\n}`;
}

/** Existing Sailcloth aliases still read by article components and chrome. */
const BRAND_ALIASES = {
  background: "color-canvas",
  foreground: "color-text",
  "card-foreground": "color-text",
  "popover-foreground": "color-text",
  primary: "color-accent",
  "primary-foreground": "color-on-accent",
  "muted-foreground": "color-muted",
  ring: "color-focus",
  link: "color-link",
} as const;

/** Keep the note label readable against its own six-percent sRGB wash. */
function noteColor(color: string, surface: string): string {
  const base = parseHex(surface);
  if (base === undefined) return color;
  let candidate = color;
  for (let step = 0; step < 8; step += 1) {
    const ink = parseHex(candidate);
    if (ink === undefined) break;
    const wash = { r: base.r * .94 + ink.r * .06, g: base.g * .94 + ink.g * .06, b: base.b * .94 + ink.b * .06 };
    if (contrast(ink, wash) >= 4.5) return candidate;
    candidate = ensureContrast(candidate, toHex(wash), 4.55);
  }
  return candidate;
}

/**
 * The CSS a brand adds to a page: its font faces and its token overrides, plus a comment for each
 * ignored value. The selector beats the `:root` block in `styles/tokens.css` on specificity, so the
 * order of the two stylesheets does not decide which value wins.
 */
export function brandCss(brand: Brand, { base = "", selector = ":root:root" }: { base?: string; selector?: string } = {}): string {
  const tokens = { ...brandTokens(brand), ...fontTokens(brand) };
  // A full palette explicitly names its panel surface. A tint keeps the raised-card role.
  const card = typeof brand.neutral === "object" ? "color-surface" : "color-surface-raised";
  const aliases = Object.entries({ ...BRAND_ALIASES, card })
    .filter(([, name]) => name in tokens)
    .map(([alias, name]) => `  --${alias}: var(--${name});`);
  const faces = fontFaces(brand, base);
  const block = tokensCss(tokens, selector);
  // The bridge connects the real article components to the preview palette. The shell keeps its aliases.
  const content = selector === ":root:root" ? `${selector} .doc-body` : selector;
  const bridge = aliases.length === 0 ? "" : `${content} {\n${aliases.join("\n")}\n}`;
  const code = brand.neutral === undefined ? "" : `${content} { --doc-code-bg: var(--code-bg); }`;
  const link = tokens["color-link"];
  const note = link === undefined ? "" : `${content} .callout-note { --callout-color: ${tokenCssValue({
    light: noteColor(link.light, tokens[card]?.light ?? DEFAULT_COLORS.light["surface-raised"]),
    dark: noteColor(link.dark, tokens[card]?.dark ?? DEFAULT_COLORS.dark["surface-raised"]),
  })}; }`;
  // The callout wash lowers contrast on its links. Use the stronger link shade inside it.
  const callout = link === undefined ? "" : `${content} .callout { --link: var(--color-link-hover); }`;
  return [faces, block, bridge, code, note, callout].filter((part) => part !== "").join("\n");
}
