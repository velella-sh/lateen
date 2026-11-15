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
import { contrastRatios, fill, formatRatio } from "../components/preset-preview/ratios.ts";
import { ensureContrast } from "../src/color.ts";

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

test("a picker shows the accent, both canvases, and the preset's ratios without JavaScript", () => {
  const { document } = render({ preset: "orchard", picker: "true" });
  const input = document.querySelector<HTMLInputElement>("[data-preset-accent]");
  assert.ok(input);
  assert.equal(input.type, "color");
  assert.equal(input.value, "#3f7d4e");
  const canvasLight = input.getAttribute("data-canvas-light") ?? "";
  const canvasDark = input.getAttribute("data-canvas-dark") ?? "";
  const ratios = contrastRatios("#3f7d4e", { light: canvasLight, dark: canvasDark });
  assert.ok(ratios);
  assert.notEqual(canvasLight, "#e5e9f0", "the tint moves the preset's canvas");
  assert.equal(input.getAttribute("data-ratio-accent"), "{light} in light, {dark} in dark");
  const accent = document.querySelector("[data-preset-ratio='accent']")?.textContent;
  assert.equal(accent, `${formatRatio(ratios.accentLight)} in light, ${formatRatio(ratios.accentDark)} in dark`);
  const onAccent = document.querySelector("[data-preset-ratio='on-accent']")?.textContent;
  assert.equal(onAccent, `${formatRatio(ratios.onAccentLight)} in light, ${formatRatio(ratios.onAccentDark)} in dark`);
});

test("a false picker value leaves the control out", () => {
  assert.equal(render({ preset: "plum", picker: "false" }).document.querySelector("[data-preset-accent]"), null);
  assert.equal(render({ preset: "plum", picker: "0" }).document.querySelector("[data-preset-accent]"), null);
});

test("an unknown preset names itself instead of rendering an empty block", () => {
  const { document } = render({ preset: "midnight" });
  assert.equal(document.querySelector("style"), null);
  assert.equal(document.querySelector(".preset-preview-missing")?.textContent, "Unknown preset midnight.");
});

test("the island rewrites both ratio lines and the preview's accent", () => {
  const { document } = render({ preset: "harbor", picker: "true" });
  const input = document.querySelector("[data-preset-accent]");
  const root = document.querySelector("[data-preset-preview]");
  assert.ok(input && root);
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
  const light = input.getAttribute("data-canvas-light") ?? "";
  const dark = input.getAttribute("data-canvas-dark") ?? "";
  const ratios = contrastRatios("#ff0000", { light, dark });
  assert.ok(ratios);
  assert.equal(
    root.querySelector("[data-preset-ratio='accent']")?.textContent,
    fill("{light} in light, {dark} in dark", { light: formatRatio(ratios.accentLight), dark: formatRatio(ratios.accentDark) }),
  );
  assert.equal(
    properties.get("--color-accent"),
    `light-dark(${ensureContrast("#ff0000", light, 4.5)}, ${ensureContrast("#ff0000", dark, 4.5)})`,
  );
  listener();
});

test("the island ignores a value that is not a colour", () => {
  const picker = {
    value: "not-a-colour",
    getAttribute: (name: string) => ({ "data-ratio-accent": "{light}/{dark}", "data-ratio-on-accent": "{light}/{dark}", "data-canvas-light": "#ffffff", "data-canvas-dark": "#000000" })[name],
    addEventListener: () => {},
  } as AccentPicker;
  let touched = false;
  const root = {
    style: { setProperty: () => (touched = true), removeProperty: () => {} },
    querySelector: () => {
      touched = true;
      return null;
    },
  } as unknown as PreviewRoot;
  update(picker, root);
  assert.equal(touched, false);
});

test("two renders of the same preset are the same bytes", () => {
  assert.equal(render({ preset: "graphite", picker: "true" }).html, render({ preset: "graphite", picker: "true" }).html);
});
