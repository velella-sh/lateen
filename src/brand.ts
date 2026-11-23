/* The brand options: what a site may change and how it becomes CSS. `theme.options.preset` picks a
 * shipped set of options from `tokens/presets/`, and `theme.options.brand` overrides single values.
 * Everything here is deterministic and server-side: the values are derived once at render time and
 * written as one `<style>` element by the `base` layout. See `docs/design/brand.md` for the rules:
 * a colour that cannot reach its contrast is corrected, never shipped, and the set of token names
 * stays the one `tokens/names.json` freezes. */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DENSITIES, INTENSITIES, RADII, DEFAULT_CODE, brandTokens, tokensCss, type Brand, type Density, type FontFamily, type FontFile, type Intensity, type Radius, type Showpiece } from "./brand-tokens.ts";
import { isRecord } from "./guards.ts";
import { mix, parseHex, toHex } from "./color.ts";

export type { BrandToken, BrandTokens } from "./accent.ts";
export { DENSITIES, INTENSITIES, RADII, DEFAULT_CODE, DEFAULT_COLORS, DEFAULT_RADIUS, DEFAULT_SPACE, brandCss, brandTokens, fontFaces, tokensCss } from "./brand-tokens.ts";
export type { Brand, Density, FontFamily, FontFile, Intensity, Radius, Showpiece } from "./brand-tokens.ts";

/** The shipped presets, one JSON file of brand options per preset. */
export const PRESETS_DIR = new URL("../tokens/presets/", import.meta.url);

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

const isHex = (value: unknown): value is string => typeof value === "string" && parseHex(value) !== undefined;

const colour = (value: string): string => toHex(parseHex(value) ?? { r: 0, g: 0, b: 0 });

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

/** Validates one brand block and records every value it ignores. */
function brandOptions(value: unknown, option: string, problems: BrandProblem[]): Brand | undefined {
  if (!isRecord(value)) {
    problems.push({ option, message: "must be an object" });
    return undefined;
  }
  const brand: {
    accent?: string;
    neutral?: string;
    sans?: FontFamily;
    mono?: FontFamily;
    radius?: Radius;
    density?: Density;
    showpiece?: Showpiece;
  } = {};
  if (value.accent !== undefined) {
    if (isHex(value.accent)) brand.accent = colour(value.accent);
    else problems.push({ option: `${option}.accent`, message: "is not a #rgb or #rrggbb colour" });
  }
  if (value.neutral !== undefined) {
    if (isHex(value.neutral)) brand.neutral = colour(value.neutral);
    else problems.push({ option: `${option}.neutral`, message: "is not a #rgb or #rrggbb colour" });
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

/** A CSS comment for one ignored value, so the page itself says what was not used. */
export function problemComment(problem: BrandProblem): string {
  return `/* lateen: ignored ${problem.option.replace(/\*\//g, "* /")}: ${problem.message.replace(/\*\//g, "* /")} */`;
}

/** The tokens a preset gallery needs, without fonts: a preview block does not load another origin or face set. */
export function previewCss(brand: Brand, selector: string): string {
  return tokensCss(brandTokens(brand), selector);
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
