import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { buildCss, loadTokens, main, paths } from "../scripts/tokens.ts";
import { VISION, distance } from "./support-chart-colour.ts";

const names = { color: { canvas: { $value: "#fff", $extensions: { lateen: { dark: "#000" } } }, text: "#222" }, space: { "1": "0.25rem" } };

/** A temp tokens folder with `names.json` and the given group files. */
function folder(groups: Record<string, unknown> = {}, registry: unknown = names) {
  const dir = mkdtempSync(join(tmpdir(), "tokens-"));
  writeFileSync(join(dir, "names.json"), JSON.stringify(registry));
  for (const [group, body] of Object.entries(groups)) writeFileSync(join(dir, `${group}.json`), JSON.stringify(body));
  return dir;
}

test("the committed tokens.css is current and every semantic group is frozen in names.json", () => {
  const tokens = loadTokens();
  assert.equal(readFileSync(paths.css, "utf8"), buildCss(tokens));
  const groups = new Set([...tokens.keys()].map((n) => n.split("-")[0]));
  for (const group of ["color", "type", "space", "radius", "shadow", "motion", "state", "chart", "code"]) assert.ok(groups.has(group), group);
});

/** WCAG 2.2 relative luminance of a six-digit hex color. */
const luminance = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((index) => {
    const channel = parseInt(hex.slice(index, index + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** WCAG 2.2 contrast ratio of two opaque colors. */
const contrast = (a: string, b: string): number => {
  const [high = 0, low = 0] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

test("the state tokens cover every interaction state and the focus ring reads in both themes (#1094)", () => {
  const tokens = loadTokens();
  for (const name of ["hover-bg", "active-bg", "selected-bg", "selected-fg", "disabled-fg", "focus-ring", "overlay"]) {
    assert.ok(tokens.has(`state-${name}`), `state-${name} is missing`);
  }
  const value = (name: string, mode: "light" | "dark"): string => {
    const token = tokens.get(name);
    const found = mode === "light" ? token?.light : token?.dark ?? token?.light;
    assert.ok(found, `${name} has no ${mode} value`);
    return found;
  };
  for (const mode of ["light", "dark"] as const) {
    const ring = value("state-focus-ring", mode);
    for (const background of ["color-canvas", "color-surface"]) {
      const ratio = contrast(ring, value(background, mode));
      assert.ok(ratio >= 3, `the ${mode} focus ring is ${ratio.toFixed(2)}:1 on ${background}; it needs 3:1`);
    }
  }
});

test("the status tones keep text at 4.5:1 on their background and borders at 3:1 on the canvas, in both schemes", () => {
  const tokens = loadTokens();
  const value = (name: string, mode: "light" | "dark"): string => {
    const token = tokens.get(name);
    const found = mode === "light" ? token?.light : token?.dark ?? token?.light;
    assert.ok(found && /^#[0-9a-f]{6}$/i.test(found), `${name} has no ${mode} six-digit value`);
    return found;
  };
  let checked = 0;
  for (const tone of ["positive", "caution", "negative", "neutral", "info"]) {
    for (const part of ["fg", "bg", "border"]) {
      for (const mode of ["light", "dark"] as const) {
        assert.ok(tokens.get(`status-${tone}-${part}`)?.dark, `status-${tone}-${part} needs a dark value`);
        checked += 1;
      }
    }
    for (const mode of ["light", "dark"] as const) {
      const text = contrast(value(`status-${tone}-fg`, mode), value(`status-${tone}-bg`, mode));
      assert.ok(text >= 4.5, `${mode} status-${tone}-fg is ${text.toFixed(2)}:1 on its background; it needs 4.5:1`);
      const border = contrast(value(`status-${tone}-border`, mode), value("color-canvas", mode));
      assert.ok(border >= 3, `${mode} status-${tone}-border is ${border.toFixed(2)}:1 on the canvas; it needs 3:1`);
    }
  }
  assert.equal(checked, 30);
});

test("light and dark go through light-dark() and data-theme overrides", () => {
  const css = buildCss(loadTokens(folder()));
  assert.match(css, /--color-canvas: light-dark\(#fff, #000\);/);
  assert.match(css, /--color-text: #222;/);
  assert.match(css, /:root\[data-theme="dark"\] \{\n {2}color-scheme: dark;/);
  assert.match(css, /:root\[data-theme="light"\] \{\n {2}color-scheme: light;/);
});

test("a group file overrides values by name, and adding one needs no other edit", () => {
  const dir = folder({ space: { "1": { $value: "4px" } }, color: { text: { $value: "{color.canvas}" } } });
  const css = buildCss(loadTokens(dir));
  assert.match(css, /--space-1: 4px;/);
  assert.match(css, /--color-text: var\(--color-canvas\);/);
  assert.match(css, /--color-canvas: light-dark\(#fff, #000\);/);
});

test("a reduced value goes in a prefers-reduced-motion block", () => {
  const dir = folder({ motion: { fast: { $value: "150ms", $extensions: { lateen: { reduced: "0ms" } } } } }, { ...names, motion: { fast: "100ms" } });
  const css = buildCss(loadTokens(dir));
  assert.match(css, /--motion-fast: 150ms;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\n {2}:root \{\n {4}--motion-fast: 0ms;\n {2}\}\n\}\n/);
});

test("a light group file sets only the light values and keeps the dark ones", () => {
  const dir = folder({ "color.light": { canvas: "#eee" } });
  const css = buildCss(loadTokens(dir));
  assert.match(css, /--color-canvas: light-dark\(#eee, #000\);/);
  assert.match(css, /--color-text: #222;/);
});

test("a light group file rejects dark values, unknown names, and other variants", () => {
  assert.throws(() => loadTokens(folder({ "color.light": { canvas: { $value: "#eee", $extensions: { lateen: { dark: "#111" } } } } })), /sets only the light value/);
  assert.throws(() => loadTokens(folder({ "color.light": { nope: "#eee" } })), /"color\.nope" is not in names\.json/);
  assert.throws(() => loadTokens(folder({ "color.dark": { canvas: "#111" } })), /a group file is <group>\.json or <group>\.light\.json/);
});

test("the code component's Shiki theme files are not token groups (#1096)", () => {
  const dir = folder();
  writeFileSync(join(dir, "code.dark.json"), JSON.stringify({ name: "lateen-dark", type: "dark", colors: {}, settings: [{ settings: {} }] }));
  writeFileSync(join(dir, "code.light.json"), JSON.stringify({ name: "lateen-light", type: "light", colors: {}, settings: [{ settings: {} }] }));
  const css = buildCss(loadTokens(dir));
  assert.doesNotMatch(css, /--code-/);
  rmSync(dir, { recursive: true });
});

test("a name missing from names.json is an error", () => {
  assert.throws(() => loadTokens(folder({ space: { "99": "1px" } })), /"space\.99" is not in names\.json/);
  assert.throws(() => loadTokens(folder({ elevation: { a: "1" } })), /"elevation" is not a group/);
  assert.throws(() => buildCss(loadTokens(folder({ color: { text: "{color.nope}" } }))), /unknown reference/);
});

test("a dark value outside the color groups is an error", () => {
  const bad = { space: { "1": { $value: "1px", $extensions: { lateen: { dark: "2px" } } } } };
  assert.throws(() => loadTokens(folder({}, bad)), /dark value/);
});

test("--check fails when tokens.css is stale or missing and passes after a build", () => {
  const dir = folder();
  const css = join(dir, "tokens.css");
  const run = (arg: string) => {
    process.exitCode = undefined;
    const log = console.log;
    const err = console.error;
    console.log = console.error = () => {};
    try {
      main([arg], { dir, css });
    } finally {
      console.log = log;
      console.error = err;
    }
    const code = process.exitCode;
    process.exitCode = undefined;
    return code;
  };
  assert.equal(run("--check"), 1, "missing");
  run("--write");
  assert.equal(run("--check"), undefined, "current");
  writeFileSync(css, `${readFileSync(css, "utf8")}/* edited */\n`);
  assert.equal(run("--check"), 1, "stale");
  rmSync(dir, { recursive: true });
});

test("the chart colours reach 3:1 on the canvas and stay distinguishable under colour-vision types (#432)", () => {
  const tokens = loadTokens();
  const surfaces = ["color-canvas", "color-surface"];
  const pick = (name: string, mode: "light" | "dark"): string => {
    const token = tokens.get(name);
    const found = mode === "light" ? token?.light : token?.dark ?? token?.light;
    assert.ok(found && /^#[0-9a-f]{6}$/i.test(found), `${name} has no ${mode} hex value`);
    return found;
  };
  const categories = Array.from({ length: 8 }, (_, i) => `chart-cat-${i + 1}`);
  const scale = Array.from({ length: 5 }, (_, i) => `chart-seq-${i + 1}`);
  const patterns = Array.from({ length: 8 }, (_, i) => tokens.get(`chart-pattern-${i + 1}`)?.light);
  assert.equal(new Set(patterns).size, 8, "each category has its own pattern fill");
  for (const p of patterns) assert.ok(p && !p.startsWith("#"), "a pattern token names a pattern");
  const views = [undefined, ...Object.values(VISION)];
  for (const mode of ["light", "dark"] as const) {
    for (const name of [...categories, ...scale]) {
      for (const surface of surfaces) {
        const ratio = contrast(pick(name, mode), pick(surface, mode));
        assert.ok(ratio >= 3, `${name} is ${ratio.toFixed(2)}:1 on ${surface} in ${mode}; it needs 3:1`);
      }
    }
    for (const group of [categories, scale]) {
      const minimum = group === categories ? 8 : 5;
      group.forEach((a, i) => {
        for (const b of group.slice(i + 1)) {
          // Neighbours on the sequential scale only need to be told apart in lightness; categories in hue too.
          for (const view of views) {
            const gap = distance(pick(a, mode), pick(b, mode), view);
            assert.ok(gap >= minimum, `${a} and ${b} are ${gap.toFixed(1)} apart in ${mode} (${view ? "simulated" : "normal"} vision); they need ${minimum}`);
          }
        }
      });
    }
  }
});

test("the chart tokens do not reference the state, status, or callout colours (#432)", () => {
  for (const [name, value] of loadTokens()) {
    if (!name.startsWith("chart-")) continue;
    assert.ok(!/[{]|var\(/.test(`${value.light}${value.dark ?? ""}`), `${name} must hold its own value, not a reference`);
  }
});
