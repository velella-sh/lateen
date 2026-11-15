/* Preset preview island: the accent try-out. The server render already shows the preset's own
 * accent and its ratios; this script lets a reader pick another colour, derives the same accent
 * family the build would, applies every one of those tokens to the preview block only, and rewrites
 * the two ratio lines. Values stay in the browser: no request, no storage, and the rest of the page
 * keeps the site's own look. */

import { accentTokens, tokenCssValue } from "../../src/accent.ts";
import { contrastRatios, fill, formatRatio, parsePalette } from "./ratios.ts";

/** The accent input inside a preview that has the picker. */
export const PICKER_SELECTOR = "[data-preset-accent]";

/** One ratio line inside the preview. */
export const RATIO_SELECTOR = "[data-preset-ratio]";

/** The parts of the preview root the island reads and writes. */
export interface PreviewRoot {
  readonly style: { setProperty(name: string, value: string): void; removeProperty(name: string): void };
  querySelector(selector: string): RatioElement | null;
}

/** One ratio line, as the island writes it. */
export interface RatioElement {
  textContent: string | null;
}

/** The accent input, as the island reads it. */
export interface AccentPicker {
  readonly value: string;
  getAttribute(name: string): string | null;
  addEventListener(type: "input", listener: () => void): void;
}

/** Reads one `data-*` value, treating a missing or empty one as absent. */
const attribute = (picker: AccentPicker, name: string): string | undefined => {
  const value = picker.getAttribute(name);
  return value === null || value === "" ? undefined : value;
};

/**
 * Rewrites the two ratio lines and applies the whole accent family to the preview block: accent,
 * hover, on-accent, link, focus, selection, and the selected state, from the same derivation the
 * build uses. The block's custom properties get `light-dark()`, so both schemes follow the chosen
 * colour. A value that is not a colour, or a palette this version cannot read, leaves the preview
 * as the server rendered it.
 */
export function update(picker: AccentPicker, root: PreviewRoot): void {
  const template = attribute(picker, "data-ratio-accent");
  const onAccentTemplate = attribute(picker, "data-ratio-on-accent");
  const palette = parsePalette(attribute(picker, "data-palette"));
  if (template === undefined || onAccentTemplate === undefined || palette === undefined) return;
  const canvas = { light: palette.light.surfaces[0] ?? "", dark: palette.dark.surfaces[0] ?? "" };
  const ratios = contrastRatios(picker.value, canvas);
  if (ratios === undefined) return;
  const accent = root.querySelector(`${RATIO_SELECTOR}[data-preset-ratio="accent"]`);
  const onAccent = root.querySelector(`${RATIO_SELECTOR}[data-preset-ratio="on-accent"]`);
  if (accent !== null) {
    accent.textContent = fill(template, { light: formatRatio(ratios.accentLight), dark: formatRatio(ratios.accentDark) });
  }
  if (onAccent !== null) {
    onAccent.textContent = fill(onAccentTemplate, {
      light: formatRatio(ratios.onAccentLight),
      dark: formatRatio(ratios.onAccentDark),
    });
  }
  const tokens = accentTokens(picker.value, { light: palette.light.surfaces, dark: palette.dark.surfaces }, {
    light: palette.light.text,
    dark: palette.dark.text,
  });
  for (const [name, token] of Object.entries(tokens)) root.style.setProperty(`--${name}`, tokenCssValue(token));
}

/** Wires one picker: applies its current value, then updates on every input. */
export function activate(picker: AccentPicker, root: PreviewRoot): boolean {
  update(picker, root);
  picker.addEventListener("input", () => update(picker, root));
  return true;
}

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (typeof document !== "undefined") {
  for (const picker of document.querySelectorAll(PICKER_SELECTOR)) {
    const root = picker.closest("[data-preset-preview]");
    if (root !== null) activate(picker as unknown as AccentPicker, root as unknown as PreviewRoot);
  }
}
