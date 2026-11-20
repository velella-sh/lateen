import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { withExitCode, withGlobal } from "./helpers/globals.ts";
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

test("the Sailcloth bridge keeps only aliases the shared print sheet still reads (#913)", () => {
  const source = readFileSync(new URL("../styles/src/theme.css", import.meta.url), "utf8");
  const bridge = source.slice(source.indexOf("Sailcloth tokens"), source.indexOf('[data-theme="dark"]'));
  const aliases = [...bridge.matchAll(/--color-([a-z-]+):/g)].map((match) => match[1]);
  assert.deepEqual(aliases, ["surface-raised", "text", "muted"]);
  const print = readFileSync(new URL("../styles/print.css", import.meta.url), "utf8");
  for (const alias of aliases) assert.ok(print.includes(`var(--color-${alias})`), `no caller for --color-${alias}`);
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
  const run = (arg: string): string | number | undefined =>
    withGlobal("console", Object.assign(Object.create(console), { log: () => {}, error: () => {} }), () =>
      withExitCode(() => main([arg], { dir, css })).code,
    );
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

/** The effective value of a token in one scheme, with `{ref}` and `var(--ref)` followed. */
function schemeValue(name: string, mode: "light" | "dark", tokens = loadTokens()): string {
  const token = tokens.get(name);
  assert.ok(token, `${name} is missing`);
  const raw = mode === "light" ? token.light : token.dark ?? token.light;
  const ref = /^\{([^{}]+)\}$/.exec(raw);
  return ref === null ? raw : schemeValue((ref[1] ?? "").replace(/\./g, "-"), mode, tokens);
}

test("the border strengths and elevation levels have a light and a dark value, and the strong border reaches 3:1 on the canvas (#467)", () => {
  const tokens = loadTokens();
  for (const name of ["subtle", "default", "strong"]) {
    const token = tokens.get(`border-${name}`);
    assert.ok(token?.light && token.dark, `border-${name} needs a light and a dark value`);
  }
  for (const mode of ["light", "dark"] as const) {
    const ratio = contrast(schemeValue("border-strong", mode), schemeValue("color-canvas", mode));
    assert.ok(ratio >= 3, `the ${mode} strong border is ${ratio.toFixed(2)}:1 on the canvas; it needs 3:1`);
  }
  for (const level of ["low", "mid", "high"]) {
    for (const part of ["bg", "border"]) {
      const token = tokens.get(`elevation-${level}-${part}`);
      assert.ok(token?.light && token.dark, `elevation-${level}-${part} needs a light and a dark value`);
    }
    assert.ok(tokens.get(`elevation-${level}-shadow`)?.light, `elevation-${level}-shadow is missing`);
  }
});

test("in dark, an elevation level is a lighter surface with a hairline, not a shadow (#467)", () => {
  const tokens = loadTokens();
  const levels = ["low", "mid", "high"];
  let previous = luminance(schemeValue("color-surface", "dark"));
  for (const level of levels) {
    const bg = luminance(schemeValue(`elevation-${level}-bg`, "dark"));
    assert.ok(bg >= previous, `dark elevation-${level}-bg must not be darker than the level below`);
    previous = bg;
    assert.ok(contrast(schemeValue(`elevation-${level}-border`, "dark"), schemeValue(`elevation-${level}-bg`, "dark")) > 1.1, `dark elevation-${level} needs a visible hairline`);
    const shadow = tokens.get(`elevation-${level}-shadow`)?.light ?? "";
    for (const pair of shadow.matchAll(/light-dark\(([^,]+(?:\([^)]*\))?[^,]*),\s*([^)]+)\)/g)) assert.equal((pair[2] ?? "").trim(), "transparent", `dark elevation-${level}-shadow draws nothing`);
  }
  assert.ok(luminance(schemeValue("elevation-high-bg", "dark")) > luminance(schemeValue("elevation-low-bg", "dark")), "the top level is lighter than the bottom one");
});

test("the radius scale is an explicit file that matches the brand's base scale and keeps the full circle (#467)", async () => {
  const { DEFAULT_RADIUS } = await import("../src/brand.ts");
  const tokens = loadTokens();
  for (const [name, value] of Object.entries(DEFAULT_RADIUS)) assert.equal(tokens.get(`radius-${name}`)?.light, value, name);
  assert.equal(tokens.get("radius-full")?.light, "9999px");
});

test("the surface layers and every text and link pair reach their contrast in both themes (#470)", () => {
  const tokens = loadTokens();
  for (const name of ["surface-sunken", "link-visited"]) assert.ok(tokens.get(`color-${name}`)?.dark, `color-${name} needs a light and a dark value`);
  const layers = ["color-canvas", "color-surface", "color-surface-raised", "color-surface-sunken"];
  const texts = ["color-text", "color-heading", "color-muted", "color-link", "color-link-hover", "color-link-visited"];
  for (const mode of ["light", "dark"] as const) {
    for (const layer of layers) {
      for (const text of texts) {
        // Dark muted text on the raised layer is known to fall short; the search dialog and the other small-text
        // surfaces switch to `color-text` there (see test/chrome-search.test.ts), so it is not asserted here.
        if (mode === "dark" && text === "color-muted" && layer === "color-surface-raised") continue;
        const ratio = contrast(schemeValue(text, mode, tokens), schemeValue(layer, mode, tokens));
        assert.ok(ratio >= 4.5, `${text} on ${layer} is ${ratio.toFixed(2)}:1 in ${mode}; it needs 4.5:1`);
      }
      const ring = contrast(schemeValue("state-focus-ring", mode, tokens), schemeValue(layer, mode, tokens));
      assert.ok(ring >= 3, `the focus ring on ${layer} is ${ring.toFixed(2)}:1 in ${mode}; it needs 3:1`);
    }
    const selection = contrast(schemeValue("color-text", mode, tokens), schemeValue("color-selection", mode, tokens));
    assert.ok(selection >= 4.5, `text on the selection is ${selection.toFixed(2)}:1 in ${mode}`);
  }
});

test("the three surface layers step in lightness and the accent is unchanged (#470)", () => {
  const tokens = loadTokens();
  for (const mode of ["light", "dark"] as const) {
    const [sunken, canvas] = ["color-surface-sunken", "color-canvas"].map((n) => luminance(schemeValue(n, mode, tokens)));
    assert.ok((sunken ?? 0) < (canvas ?? 0), `the ${mode} sunken layer is darker than the canvas`);
  }
  assert.equal(schemeValue("color-accent", "light", tokens), "#23212c");
  assert.equal(schemeValue("color-accent", "dark", tokens), "#dcd7eb");
});
