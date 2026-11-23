// A preset preview is a build-time sample: its own scoped tokens, the theme's own markup, the options
// to copy, and no inline style attribute. The picker's island shares its ratios with the server render,
// so a reader without JavaScript sees the same numbers the first paint wrote.
import assert from "node:assert/strict";
import { test } from "node:test";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import { JSDOM } from "jsdom";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import presetPreview, { optionsText, scopedClass } from "../components/preset-preview/index.ts";
import { activate, update, type AccentPicker, type PreviewRoot } from "../components/preset-preview/client.ts";
import { contrastRatios, fill, formatRatio, parsePalette } from "../components/preset-preview/ratios.ts";
import { brandTokens, resolveBrand } from "../src/brand.ts";
import { accentTokens, tokenCssValue } from "../src/accent.ts";

const page = { lang: "en", dir: "ltr", url: "/presets/", title: "Presets", frontMatter: {}, headings: [], html: "", markdown: "", kind: "doc", source: { file: "site/presets.md", line: 1, column: 1, endLine: 1, endColumn: 1 } } as unknown as Page;
const site = { config: { base: "", theme: { options: {} } }, pages: [], nav: {}, data: {} } as unknown as Site;

const render = (props: Record<string, unknown> = { preset: "harbor" }): { html: string; document: Document } => {
  const html = renderToString(h(presetPreview, { props, page, site, html: "" } as unknown as ComponentProps));
  return { html, document: new JSDOM(html).window.document };
};

test("a preset renders its own scoped tokens, the sample, and the options to copy", () => {
  const { html, document } = render();
  const root = document.querySelector("[data-preset-preview]");
  assert.ok(root);
  assert.ok(root.classList.contains("preset-preview"));
  assert.ok(root.classList.contains(scopedClass("harbor")));
  const style = root.querySelector("style");
  assert.ok(style);
  assert.match(style.textContent ?? "", new RegExp(`\\.${scopedClass("harbor")} \\{`));
  assert.match(style.textContent ?? "", /--color-accent: light-dark\(#[0-9a-f]{6}, #[0-9a-f]{6}\);/);
  assert.match(style.textContent ?? "", /--radius-md: 0\.5rem;/);
  assert.equal(document.querySelector(".preset-preview-options code")?.textContent, optionsText("harbor"));
  assert.equal(optionsText("harbor"), "theme:\n  options:\n    preset: harbor");
  assert.doesNotMatch(html, / style="/);
  assert.ok(document.querySelector(".preset-preview-action"));
  assert.ok(document.querySelector(".preset-preview-mono")?.textContent?.includes("const answer = 42"));
});

test("without a picker there is no input and no ratios", () => {
  const { document } = render({ preset: "clay" });
  assert.equal(document.querySelector("[data-preset-accent]"), null);
  assert.equal(document.querySelector("[data-preset-ratios]"), null);
});

test("a picker shows the accent, its palette, and the preset's ratios without JavaScript", () => {
  const { document } = render({ preset: "orchard", picker: "true" });
  const input = document.querySelector<HTMLInputElement>("[data-preset-accent]");
  assert.ok(input);
  assert.equal(input.type, "color");
  assert.equal(input.value, "#3f7d4e");
  const palette = parsePalette(input.getAttribute("data-palette"));
  assert.ok(palette);
  assert.equal(palette.light.surfaces.length, 3);
  assert.equal(palette.dark.surfaces.length, 3);
  assert.notEqual(palette.light.surfaces[0], "#e5e9f0", "the tint moves the preset's canvas");
  const brand = resolveBrand({ preset: "orchard" }).brand;
  assert.ok(brand);
  const ratios = contrastRatios(brandTokens(brand), palette);
  assert.ok(ratios);
  assert.equal(input.getAttribute("data-ratio-accent"), "{light} in light, {dark} in dark");
  const accent = document.querySelector("[data-preset-ratio='accent']")?.textContent;
  assert.equal(accent, `${formatRatio(ratios.accentLight)} in light, ${formatRatio(ratios.accentDark)} in dark`);
  const onAccent = document.querySelector("[data-preset-ratio='on-accent']")?.textContent;
  assert.equal(onAccent, `${formatRatio(ratios.onAccentLight)} in light, ${formatRatio(ratios.onAccentDark)} in dark`);
});

test("a false picker value leaves the control out", () => {
  for (const off of ["false", "no", "0", "off", " FALSE ", "\tOff\n"]) {
    assert.equal(
      render({ preset: "plum", picker: off }).document.querySelector("[data-preset-accent]"),
      null,
      `${JSON.stringify(off)} is off`,
    );
  }
  assert.equal(render({ preset: "plum", picker: "true" }).document.querySelector("[data-preset-accent]") !== null, true);
  assert.equal(render({ preset: "plum", picker: "" }).document.querySelector("[data-preset-accent]") !== null, true);
});

test("an unknown preset names itself instead of rendering an empty block", () => {
  const { document } = render({ preset: "midnight" });
  assert.equal(document.querySelector("style"), null);
  assert.equal(document.querySelector(".preset-preview-missing")?.textContent, "Unknown preset midnight.");
});

test("the island rewrites both ratio lines and applies the whole accent family", () => {
  const { document } = render({ preset: "lateen", picker: "true" });
  const input = document.querySelector("[data-preset-accent]");
  const root = document.querySelector("[data-preset-preview]");
  assert.ok(input && root);
  const palette = parsePalette(input.getAttribute("data-palette"));
  assert.ok(palette);
  let listener: (() => void) | undefined;
  const picker = {
    value: "#ff0000",
    getAttribute: (name: string) => input.getAttribute(name),
    addEventListener: (_type: "input", callback: () => void) => {
      listener = callback;
    },
  } as AccentPicker;
  const properties = new Map<string, string>();
  const preview = {
    style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    },
    querySelector: (selector: string) => root.querySelector(selector) as unknown as { textContent: string | null } | null,
  } as unknown as PreviewRoot;
  assert.equal(activate(picker, preview), true);
  assert.ok(listener);
  assert.equal(properties.size, 0, "initialising the picker preserves the two preset colours");
  listener();
  const expected = accentTokens(
    "#ff0000",
    { light: palette.light.surfaces, dark: palette.dark.surfaces },
    { light: palette.light.text, dark: palette.dark.text },
  );
  const ratios = contrastRatios(expected, palette);
  assert.ok(ratios);
  assert.equal(
    root.querySelector("[data-preset-ratio='accent']")?.textContent,
    fill("{light} in light, {dark} in dark", { light: formatRatio(ratios.accentLight), dark: formatRatio(ratios.accentDark) }),
  );
  for (const [name, token] of Object.entries(expected)) {
    assert.equal(properties.get(`--${name}`), tokenCssValue(token), `--${name} follows the chosen accent`);
  }
  for (const name of ["accent", "accent-hover", "on-accent", "link", "link-hover", "focus", "selection"]) {
    assert.ok(properties.has(`--color-${name}`), `--color-${name} is set`);
  }
  for (const name of ["state-focus-ring", "state-selected-bg", "state-selected-fg"]) {
    assert.ok(properties.has(`--${name}`), `--${name} is set`);
  }
  assert.notEqual(properties.get("--color-accent"), "light-dark(#ff0000, #ff0000)", "the chosen colour is corrected");
});

test("the island ignores a value that is not a colour or a palette it cannot read", () => {
  let touched = false;
  const root = {
    style: { setProperty: () => (touched = true), removeProperty: () => {} },
    querySelector: () => {
      touched = true;
      return null;
    },
  } as unknown as PreviewRoot;
  const palette = JSON.stringify({ light: { surfaces: ["#ffffff", "#ffffff", "#ffffff"], text: "#000000" }, dark: { surfaces: ["#000000", "#000000", "#000000"], text: "#ffffff" } });
  const picker = {
    value: "not-a-colour",
    getAttribute: (name: string) => ({ "data-ratio-accent": "{light}/{dark}", "data-ratio-on-accent": "{light}/{dark}", "data-palette": palette })[name],
    addEventListener: () => {},
  } as AccentPicker;
  update(picker, root);
  assert.equal(touched, false);
  const broken = { ...picker, getAttribute: () => "{not json" } as AccentPicker;
  update(broken, root);
  assert.equal(touched, false);
});

test("two renders of the same preset are the same bytes", () => {
  assert.equal(render({ preset: "graphite", picker: "true" }).html, render({ preset: "graphite", picker: "true" }).html);
});

test("the preview shows the preset's home look: its backdrop, intensity and motif", () => {
  for (const [name, variant, soft] of [["clay", "glow", true], ["graphite", "grid", false], ["harbor", "glow", false], ["orchard", "grid", true], ["plum", "glow", true]] as const) {
    const { document } = render({ preset: name });
    const hero = document.querySelector("[data-preset-hero]");
    assert.ok(hero, name);
    assert.ok(hero.querySelector(`.backdrop-${variant}`), `${name} backdrop`);
    assert.equal(hero.querySelector(".backdrop")?.classList.contains("backdrop-soft"), soft, `${name} intensity`);
    assert.ok(hero.querySelector("svg.motif"), `${name} motif`);
    assert.equal(hero.querySelector(".motif")?.getAttribute("aria-hidden"), "true");
  }
});
