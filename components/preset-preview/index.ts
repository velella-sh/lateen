import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t, patternOf } from "../../i18n/index.ts";
import { brandTokens, DEFAULT_COLORS, previewCss, resolveBrand, type Brand } from "../../src/brand.ts";
import { contrastRatios, formatRatio } from "./ratios.ts";

/** The Markdown directive this component handles: `::preset-preview{preset=harbor picker}`. */
export const directive = "preset-preview";

/** The options the component reads, in the order the documentation lists them. */
export const OPTIONS = ["preset", "picker"] as const;

/** Words that turn a bare attribute off, matching the other components. */
const FALSE_WORDS = new Set(["false", "no", "0", "off"]);

export type PresetPreviewProps = {
  /** The preset name: a JSON file in `tokens/presets/`. */
  readonly preset?: string;
  /** Present (any value except a false word) to show the accent try-out beside the sample. */
  readonly picker?: string | number | boolean;
};

/** The class that scopes one preview, so a preset never changes the rest of the page. */
export function scopedClass(preset: string): string {
  return `preset-preview-${preset}`;
}

/** The canvas and text of the preview, from the preset's own neutral palette or the theme's. */
function surfaces(brand: Brand): { light: { canvas: string; text: string }; dark: { canvas: string; text: string } } {
  const tokens = brandTokens(brand);
  const value = (name: string, scheme: "light" | "dark", fallback: string): string => {
    const token = tokens[name];
    if (token === undefined) return fallback;
    return scheme === "light" ? token.light : token.dark;
  };
  return {
    light: {
      canvas: value("color-canvas", "light", DEFAULT_COLORS.light.canvas),
      text: value("color-text", "light", DEFAULT_COLORS.light.text),
    },
    dark: {
      canvas: value("color-canvas", "dark", DEFAULT_COLORS.dark.canvas),
      text: value("color-text", "dark", DEFAULT_COLORS.dark.text),
    },
  };
}

/** The options a site copies for this preset. */
export function optionsText(preset: string): string {
  return `theme:\n  options:\n    preset: ${preset}`;
}

/**
 * One preset of the theme, rendered at build time in its own scoped block: the sample markup reads
 * the theme's tokens, and the block's `<style>` re-declares them under its own class, so the page's
 * own look never changes. With `picker`, it also shows an accent input and the contrast ratios the
 * chosen colour produces in both schemes; the island updates them, and the server render already
 * shows the preset's own accent for a reader without JavaScript.
 */
export default function presetPreview({ props, page }: ComponentProps<PresetPreviewProps>) {
  const name = typeof props.preset === "string" ? props.preset.trim() : "";
  const { brand } = resolveBrand({ preset: name });
  if (brand === undefined) {
    return h("p", { class: "preset-preview preset-preview-missing" }, t(page.lang, "preset_preview_unknown", { name: name || "?" }));
  }
  const scope = scopedClass(name);
  const surfacesOfBrand = surfaces(brand);
  const accent = brand.accent ?? DEFAULT_COLORS.light.accent;
  const ratios = contrastRatios(accent, { light: surfacesOfBrand.light.canvas, dark: surfacesOfBrand.dark.canvas });
  const picker = props.picker !== undefined && !(typeof props.picker === "string" && FALSE_WORDS.has(props.picker.toLowerCase()));
  return h(
    "div",
    { class: `preset-preview ${scope}`, "data-preset-preview": name },
    h("style", { dangerouslySetInnerHTML: { __html: previewCss(brand, `.${scope}`) } }),
    h(
      "div",
      { class: "preset-preview-sample" },
      h("p", { class: "preset-preview-body" }, t(page.lang, "preset_preview_sample_body")),
      h("p", { class: "preset-preview-muted" }, t(page.lang, "preset_preview_sample_muted")),
      h("span", { class: "preset-preview-link" }, t(page.lang, "preset_preview_sample_link")),
      h("span", { class: "preset-preview-action" }, t(page.lang, "preset_preview_sample_action")),
      h("span", { class: "preset-preview-chip" }, t(page.lang, "preset_preview_sample_chip")),
      h("span", { class: "preset-preview-mono" }, "const answer = 42;"),
    ),
    picker
      ? h(
          "div",
          { class: "preset-preview-picker" },
          h("label", { class: "preset-preview-label", for: `${scope}-accent` }, t(page.lang, "preset_preview_accent")),
          h("input", {
            class: "preset-preview-input",
            id: `${scope}-accent`,
            type: "color",
            value: accent.toLowerCase(),
            "data-preset-accent": true,
            "data-canvas-light": surfacesOfBrand.light.canvas,
            "data-canvas-dark": surfacesOfBrand.dark.canvas,
            "data-ratio-accent": patternOf(page.lang, "preset_preview_ratio_accent"),
            "data-ratio-on-accent": patternOf(page.lang, "preset_preview_ratio_on_accent"),
          }),
          h(
            "dl",
            { class: "preset-preview-ratios", "data-preset-ratios": true, "aria-live": "polite" },
            h(
              "div",
              null,
              h("dt", null, t(page.lang, "preset_preview_accent_text")),
              h(
                "dd",
                null,
                h(
                  "output",
                  { "data-preset-ratio": "accent" },
                  ratios === undefined
                    ? "—"
                    : t(page.lang, "preset_preview_ratio_accent", {
                        light: formatRatio(ratios.accentLight),
                        dark: formatRatio(ratios.accentDark),
                      }),
                ),
              ),
            ),
            h(
              "div",
              null,
              h("dt", null, t(page.lang, "preset_preview_on_accent")),
              h(
                "dd",
                null,
                h(
                  "output",
                  { "data-preset-ratio": "on-accent" },
                  ratios === undefined
                    ? "—"
                    : t(page.lang, "preset_preview_ratio_on_accent", {
                        light: formatRatio(ratios.onAccentLight),
                        dark: formatRatio(ratios.onAccentDark),
                      }),
                ),
              ),
            ),
          ),
        )
      : null,
    h("p", { class: "preset-preview-copy" }, t(page.lang, "preset_preview_options")),
    h("pre", { class: "preset-preview-options" }, h("code", null, optionsText(name))),
  );
}
