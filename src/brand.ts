/* The brand options: what a site may change and how it becomes CSS. `theme.options.preset` picks a
 * shipped set of options from `tokens/presets/`, and `theme.options.brand` overrides single values.
 * Everything here is deterministic and server-side: the values are derived once at render time and
 * written as one `<style>` element by the `base` layout. See `docs/design/brand.md` for the rules:
 * a colour that cannot reach its contrast is corrected, never shipped, and the set of token names
 * stays the one `tokens/names.json` freezes. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Accent, accentTokens, tokenCssValue, type BrandToken, type BrandTokens } from "./accent.ts";
import { isRecord } from "./guards.ts";
import { ensureContrast, fromOklch, mix, parseHex, toHex, toOklch } from "./color.ts";
import { withBase } from "./url.ts";

export type { BrandToken, BrandTokens } from "./accent.ts";

/** The shipped presets, one JSON file of brand options per preset. */
export const PRESETS_DIR = new URL("../tokens/presets/", import.meta.url);

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

type NeutralScheme = Readonly<Record<"canvas" | "surface" | "text", string>>;
type Neutral = string | Readonly<Record<"light" | "dark", NeutralScheme>>;

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

/** One value that was not usable. The layout renders it as a CSS comment naming the option. */
export interface BrandProblem {
  readonly option: string;
  readonly message: string;
}

/** The brand the options resolve to, and every value that was ignored. */
export interface BrandResult {
  readonly brand?: Brand;
  readonly problems: readonly BrandProblem[];
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
    "surface-raised": "#4a4760",
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

const isHex = (value: unknown): value is string => typeof value === "string" && parseHex(value) !== undefined;

const colour = (value: string): string => toHex(parseHex(value) ?? { r: 0, g: 0, b: 0 });

/** Rounds a token length to four decimals so two builds write the same text. */
const length = (value: number): string => `${Number(value.toFixed(4))}rem`;

/** The rem number of a token length, or `undefined` when it is not a simple rem value. */
function rem(value: string): number | undefined {
  const match = /^([\d.]+)rem$/.exec(value);
  return match?.[1] === undefined ? undefined : Number(match[1]);
}

/** The shipped preset options, by name, in file-name order. */
export function readPresets(dir: URL | string = PRESETS_DIR): ReadonlyMap<string, unknown> {
  const folder = typeof dir === "string" ? dir : fileURLToPath(dir);
  const presets = new Map<string, unknown>();
  for (const file of readdirSync(folder).filter((name) => name.endsWith(".json")).sort()) {
    const name = file.slice(0, -".json".length);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) throw new Error(`${file}: a preset name is lowercase kebab-case`);
    presets.set(name, JSON.parse(readFileSync(join(folder, file), "utf8")) as unknown);
  }
  return presets;
}

/** The names of the shipped presets, in file-name order. */
export function presetNames(dir: URL | string = PRESETS_DIR): string[] {
  return [...readPresets(dir).keys()];
}

/**
 * Every option path a site may set, in the order the documentation lists them. The release schema
 * and the documentation test both read this list, so an option cannot be documented or validated
 * without existing here.
 */
export const BRAND_OPTION_PATHS = [
  "theme.options.preset",
  "theme.options.brand",
  "theme.options.brand.accent",
  "theme.options.brand.neutral",
  "theme.options.brand.fonts",
  "theme.options.brand.fonts.sans",
  "theme.options.brand.fonts.sans.family",
  "theme.options.brand.fonts.sans.files",
  "theme.options.brand.fonts.mono",
  "theme.options.brand.fonts.mono.family",
  "theme.options.brand.fonts.mono.files",
  "theme.options.brand.radius",
  "theme.options.brand.density",
] as const;

/** Validates one font family, its files, and their root-relative sources. */
function fontFamily(value: unknown, option: string, problems: BrandProblem[]): FontFamily | undefined {
  if (!isRecord(value)) {
    problems.push({ option, message: "must be an object with a family and files" });
    return undefined;
  }
  const family = typeof value.family === "string" ? value.family.trim() : "";
  if (family === "") {
    problems.push({ option: `${option}.family`, message: "must name the font family" });
    return undefined;
  }
  if (!Array.isArray(value.files) || value.files.length === 0) {
    problems.push({ option: `${option}.files`, message: "must list at least one self-hosted file" });
    return undefined;
  }
  const files: FontFile[] = [];
  for (const [index, file] of value.files.entries()) {
    const at = `${option}.files[${index}]`;
    if (!isRecord(file)) {
      problems.push({ option: at, message: "must be an object with a src" });
      continue;
    }
    const src = typeof file.src === "string" ? file.src.trim() : "";
    if (!src.startsWith("/") || src.startsWith("//")) {
      problems.push({ option: `${at}.src`, message: "must be a root-relative path; a font from another origin is not allowed" });
      continue;
    }
    const weight = typeof file.weight === "string" || typeof file.weight === "number" ? String(file.weight).trim() : "400";
    if (!/^\d{1,3}(?:\s+\d{1,3})?$/.test(weight)) {
      problems.push({ option: `${at}.weight`, message: "must be a font weight such as 400 or \"100 900\"" });
      continue;
    }
    const style = typeof file.style === "string" ? file.style.trim().toLowerCase() : "normal";
    if (!["normal", "italic", "oblique"].includes(style)) {
      problems.push({ option: `${at}.style`, message: "must be normal, italic, or oblique" });
      continue;
    }
    files.push({ src, weight, style });
  }
  return files.length === 0 ? undefined : { family, files };
}

function colourPair(value: unknown): BrandToken | undefined {
  if (!isRecord(value) || !isHex(value.light) || !isHex(value.dark)) return undefined;
  return { light: colour(value.light), dark: colour(value.dark) };
}

function neutralScheme(value: unknown): NeutralScheme | undefined {
  if (!isRecord(value) || !isHex(value.canvas) || !isHex(value.surface) || !isHex(value.text)) return undefined;
  return { canvas: colour(value.canvas), surface: colour(value.surface), text: colour(value.text) };
}

function neutralPair(value: unknown): Exclude<Neutral, string> | undefined {
  if (!isRecord(value)) return undefined;
  const light = neutralScheme(value.light);
  const dark = neutralScheme(value.dark);
  return light === undefined || dark === undefined ? undefined : { light, dark };
}

/** Validates one brand block and records every value it ignores. */
function brandOptions(value: unknown, option: string, problems: BrandProblem[]): Brand | undefined {
  if (!isRecord(value)) {
    problems.push({ option, message: "must be an object" });
    return undefined;
  }
  const brand: {
    accent?: Accent;
    neutral?: Neutral;
    sans?: FontFamily;
    mono?: FontFamily;
    radius?: Radius;
    density?: Density;
    showpiece?: Showpiece;
  } = {};
  if (value.accent !== undefined) {
    const accent = isHex(value.accent) ? colour(value.accent) : colourPair(value.accent);
    if (accent !== undefined) brand.accent = accent;
    else problems.push({ option: `${option}.accent`, message: isRecord(value.accent) ? "must supply hex colours for light and dark" : "is not a #rgb or #rrggbb colour" });
  }
  if (value.neutral !== undefined) {
    const neutral = isHex(value.neutral) ? colour(value.neutral) : neutralPair(value.neutral);
    if (neutral !== undefined) brand.neutral = neutral;
    else problems.push({ option: `${option}.neutral`, message: isRecord(value.neutral) ? "must supply hex canvas, surface and text colours in light and dark" : "is not a #rgb or #rrggbb colour" });
  }
  if (value.fonts !== undefined) {
    if (!isRecord(value.fonts)) problems.push({ option: `${option}.fonts`, message: "must be an object" });
    else {
      if (value.fonts.sans !== undefined) {
        const family = fontFamily(value.fonts.sans, `${option}.fonts.sans`, problems);
        if (family !== undefined) brand.sans = family;
      }
      if (value.fonts.mono !== undefined) {
        const family = fontFamily(value.fonts.mono, `${option}.fonts.mono`, problems);
        if (family !== undefined) brand.mono = family;
      }
    }
  }
  if (value.radius !== undefined) {
    if (typeof value.radius === "string" && (RADII as readonly string[]).includes(value.radius)) {
      brand.radius = value.radius as Radius;
    } else problems.push({ option: `${option}.radius`, message: `must be one of ${RADII.join(", ")}` });
  }
  if (value.density !== undefined) {
    if (typeof value.density === "string" && (DENSITIES as readonly string[]).includes(value.density)) {
      brand.density = value.density as Density;
    } else problems.push({ option: `${option}.density`, message: `must be one of ${DENSITIES.join(", ")}` });
  }
  if (value.showpiece !== undefined) {
    if (!isRecord(value.showpiece)) problems.push({ option: `${option}.showpiece`, message: "must be an object" });
    else {
      const look: { backdrop?: string; motif?: string; intensity?: Intensity } = {};
      const { backdrop, motif, intensity } = value.showpiece;
      if (backdrop !== undefined) {
        if (typeof backdrop === "string" && ["glow", "grid", "none"].includes(backdrop)) look.backdrop = backdrop;
        else problems.push({ option: `${option}.showpiece.backdrop`, message: "must be one of glow, grid, none" });
      }
      if (motif !== undefined) {
        if (typeof motif === "string" && motif.trim() !== "") look.motif = motif.trim();
        else problems.push({ option: `${option}.showpiece.motif`, message: "must be a non-empty seed text" });
      }
      if (intensity !== undefined) {
        if (typeof intensity === "string" && (INTENSITIES as readonly string[]).includes(intensity)) look.intensity = intensity as Intensity;
        else problems.push({ option: `${option}.showpiece.intensity`, message: `must be one of ${INTENSITIES.join(", ")}` });
      }
      if (Object.keys(look).length > 0) brand.showpiece = look;
    }
  }
  return Object.keys(brand).length === 0 ? undefined : brand;
}

/**
 * Resolves `theme.options` to a brand. `preset` names a shipped file and `brand` overrides single
 * values. An unknown preset, a malformed family, or a value that is not a colour is ignored and
 * returned as a problem, so the build keeps going and the page says what was ignored.
 */
export function resolveBrand(options: unknown, dir: URL | string = PRESETS_DIR): BrandResult {
  const problems: BrandProblem[] = [];
  if (!isRecord(options)) return { problems };
  let preset: Brand | undefined;
  if (options.preset !== undefined) {
    if (typeof options.preset !== "string" || options.preset.trim() === "") {
      problems.push({ option: "theme.options.preset", message: "must be a preset name" });
    } else {
      const name = options.preset.trim();
      const file = readPresets(dir).get(name);
      if (file === undefined) problems.push({ option: "theme.options.preset", message: `unknown preset "${name}"` });
      else {
        preset = brandOptions(file, `tokens/presets/${name}.json`, problems);
        if (preset !== undefined) preset = { ...preset, preset: name };
      }
    }
  }
  const explicit = options.brand === undefined ? undefined : brandOptions(options.brand, "theme.options.brand", problems);
  if (preset === undefined && explicit === undefined) return { problems };
  return { brand: { ...preset, ...explicit }, problems };
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

/** A CSS comment for one ignored value, so the page itself says what was not used. */
export function problemComment(problem: BrandProblem): string {
  return `/* lateen: ignored ${problem.option.replace(/\*\//g, "* /")}: ${problem.message.replace(/\*\//g, "* /")} */`;
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

/**
 * The CSS a brand adds to a page: its font faces and its token overrides, plus a comment for each
 * ignored value. The selector beats the `:root` block in `styles/tokens.css` on specificity, so the
 * order of the two stylesheets does not decide which value wins.
 */
export function brandCss(brand: Brand, { base = "", selector = ":root:root" }: { base?: string; selector?: string } = {}): string {
  const tokens = { ...brandTokens(brand), ...fontTokens(brand) };
  const faces = fontFaces(brand, base);
  const block = tokensCss(tokens, selector);
  return [faces, block].filter((part) => part !== "").join("\n");
}

/** The two code-block backgrounds a site's brand produces, cached by the options object the engine hands every unit. */
const backdrops = new WeakMap<object, { readonly light: string; readonly dark: string } | null>();

/**
 * The code-block backgrounds for a site's options: the tinted surface when the brand sets a neutral,
 * and `undefined` when it does not. `undefined` means the page is unchanged: Shiki's own colours were
 * checked against its own background, so a site without a tint writes exactly the HTML it wrote before
 * this option existed.
 */
export function codeBackgrounds(options: unknown): { readonly light: string; readonly dark: string } | undefined {
  if (typeof options !== "object" || options === null) return undefined;
  const cached = backdrops.get(options);
  if (cached !== undefined) return cached ?? undefined;
  const { brand } = resolveBrand(options);
  if (brand?.neutral === undefined) {
    backdrops.set(options, null);
    return undefined;
  }
  const tokens = brandTokens(brand);
  const background = (scheme: "light" | "dark"): string => tokens["code-bg"]?.[scheme] ?? DEFAULT_CODE[scheme].bg;
  const resolved = { light: background("light"), dark: background("dark") };
  backdrops.set(options, resolved);
  return resolved;
}

/** Mixes two colours, exported for the preview island's ratio display and the tests. */
export { mix };
