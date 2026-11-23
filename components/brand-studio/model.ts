import { contrast, parseHex, toHex } from "../../src/color.ts";
import { DENSITIES, RADII, brandTokens, type Brand, type FontFamily } from "../../src/brand-tokens.ts";
import { SYNTAX_MODES, syntaxColor } from "../../src/syntax-contrast.ts";

export const DEFAULT_PRESET = "harbor";
export const STUDIO_PRESETS = ["clay", "graphite", DEFAULT_PRESET, "orchard", "plum"] as const;

// Latin variable faces from @fontsource-variable packages at 5.3.1. The site serves each OFL beside its file.
export const FONTS = {
  sans: {
    family: "Source Sans 3",
    files: [{ src: "/fonts/source-sans-3/source-sans-3-latin-wght-normal.woff2", weight: "200 900", style: "normal" }],
  },
  mono: {
    family: "Source Code Pro",
    files: [{ src: "/fonts/source-code-pro/source-code-pro-latin-wght-normal.woff2", weight: "200 900", style: "normal" }],
  },
} as const satisfies Readonly<Record<string, FontFamily>>;

type StudioFont = keyof typeof FONTS;

export type StudioPreset = Brand & { readonly accent: string; readonly neutral: string };

export interface StudioInput {
  readonly accent: string;
  readonly neutral: string;
  readonly radius: string;
  readonly density: string;
  readonly sans: string;
  readonly mono: string;
}

export function hex(value: string): string | undefined {
  const rgb = parseHex(value);
  return rgb === undefined ? undefined : toHex(rgb);
}

function known<T extends string>(value: string, choices: readonly T[]): T | undefined {
  return choices.find((choice) => choice === value);
}

export type Overrides = Partial<Pick<StudioPreset, "accent" | "neutral" | "radius" | "density">> & {
  readonly fonts?: Readonly<Partial<Record<StudioFont, FontFamily>>>;
};

export function overridesOf(preset: StudioPreset, input: StudioInput): Overrides | undefined {
  const accent = hex(input.accent);
  const neutral = hex(input.neutral);
  const radius = known(input.radius, RADII);
  const density = known(input.density, DENSITIES);
  const sans = known(input.sans, ["", FONTS.sans.family]);
  const mono = known(input.mono, ["", FONTS.mono.family]);
  if (accent === undefined || neutral === undefined || radius === undefined || density === undefined ||
      sans === undefined || mono === undefined) return undefined;

  return {
    ...(accent === preset.accent ? {} : { accent }),
    ...(neutral === preset.neutral ? {} : { neutral }),
    ...(radius === preset.radius ? {} : { radius }),
    ...(density === preset.density ? {} : { density }),
    ...(sans || mono ? { fonts: { ...(sans ? { sans: FONTS.sans } : {}), ...(mono ? { mono: FONTS.mono } : {}) } } : {}),
  };
}

export function optionsYaml(preset: string, { fonts, ...overrides }: Overrides = {}): string {
  const yaml = ["theme:", "  options:", `    preset: ${preset}`];
  if (Object.keys(overrides).length || fonts !== undefined) {
    yaml.push("    brand:");
    for (const [key, value] of Object.entries(overrides)) yaml.push(`      ${key}: ${JSON.stringify(value)}`);
  }
  if (fonts !== undefined) {
    yaml.push("      fonts:");
    for (const role of ["sans", "mono"] as const) {
      const font = fonts[role];
      if (font === undefined) continue;
      yaml.push(`        ${role}:`, `          family: ${JSON.stringify(font.family)}`, "          files:");
      for (const file of font.files) {
        yaml.push(`            - src: ${file.src}`, `              weight: "${file.weight}"`);
        if (file.style !== "normal") yaml.push(`              style: ${file.style}`);
      }
    }
  }
  return yaml.join("\n");
}

/** Checks the resulting colors at full precision, on the surfaces the preview uses. */
export function passesContrast(brand: Brand, syntax: readonly (readonly [string, string])[]): boolean {
  const tokens = brandTokens(brand);
  return SYNTAX_MODES.every((mode, index) => {
    const value = (name: string) => tokens[name]?.[mode] ?? "";
    const surfaceNames = ["color-canvas", "color-surface", "color-surface-raised"];
    const textNames = ["color-text", "color-heading", "color-muted", "color-link", "color-link-hover", "color-accent"];
    const passes = (color: string, background: string, minimum: number) => {
      const ink = parseHex(color);
      const paper = parseHex(background);
      return ink !== undefined && paper !== undefined && contrast(ink, paper) >= minimum;
    };
    return surfaceNames.every((surface) =>
      textNames.every((text) => passes(value(text), value(surface), 4.5)) &&
      passes(value("color-focus"), value(surface), 3)) &&
      ["color-accent", "color-accent-hover"].every((accent) => passes(value("color-on-accent"), value(accent), 4.5)) &&
      passes(value("color-text"), value("color-selection"), 4.5) &&
      passes(value("state-selected-fg"), value("state-selected-bg"), 4.5) &&
      passes(value("code-fg"), value("code-bg"), 4.5) &&
      syntax.every((pair) => {
        const original = pair[index] ?? "";
        return passes(syntaxColor(original, value("code-bg")), value("code-bg"), 4.5);
      });
  });
}
