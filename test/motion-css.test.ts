// Motion is calm and token-driven (#472): keeper sheets take duration/easing from motion tokens.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname;
const cssFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => join(entry.parentPath, entry.name).slice(root.length));

/** Tailwind utilities and the compiled bundle are not held to the motion-token shorthand contract. */
const SKIP_MOTION = new Set([
  "styles/tokens.css",
  "styles/print.css",
  "styles/src/ui.css",
  "styles/generated.css",
  "styles/fonts.css",
]);
const files = [...cssFiles("styles"), ...cssFiles("components")].filter((file) => !SKIP_MOTION.has(file));
const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "");

function motionDeclarations(): { file: string; property: string; part: string }[] {
  const found: { file: string; property: string; part: string }[] = [];
  for (const file of files) {
    for (const match of strip(readFileSync(join(root, file), "utf8")).matchAll(/(?<![\w-])(transition|animation)\s*:\s*([^;{}]+);/g)) {
      const value = (match[2] ?? "").trim();
      if (value === "none" || value === "inherit") continue;
      let depth = 0;
      let start = 0;
      const parts: string[] = [];
      for (let i = 0; i < value.length; i += 1) {
        if (value[i] === "(") depth += 1;
        else if (value[i] === ")") depth -= 1;
        else if (value[i] === "," && depth === 0) {
          parts.push(value.slice(start, i));
          start = i + 1;
        }
      }
      parts.push(value.slice(start));
      for (const part of parts) found.push({ file, property: match[1] ?? "", part: part.trim() });
    }
  }
  return found;
}

test("every transition and animation in keeper sheets takes its duration and easing from the motion tokens", () => {
  const bad = motionDeclarations().filter(
    ({ part }) => !/var\(--motion-(fast|base|slow|press)\)/.test(part) || (!/var\(--motion-ease[a-z-]*\)/.test(part) && !/\blinear\b/.test(part)),
  );
  assert.deepEqual(
    bad.map((entry) => `${entry.file}: ${entry.property}: ${entry.part}`),
    [],
  );
});

test("every motion token has a reduced value, so reduced motion collapses all of them to zero", () => {
  const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
  const reduced = tokens.slice(tokens.indexOf("prefers-reduced-motion: reduce"));
  const names = [...tokens.slice(0, tokens.indexOf("@media (prefers-reduced-motion")).matchAll(/--(motion-[a-z-]+):/g)].map((m) => m[1] ?? "");
  assert.ok(names.includes("motion-press") && names.includes("motion-ease-out") && names.includes("motion-ease-in"), "the enter, exit and press tokens exist");
  for (const name of names) assert.match(reduced, new RegExp(`--${name}: (0ms|linear)`), `${name} has no reduced-motion value`);
});

test("no keeper transition or animation moves layout", () => {
  const layout = /\b(width|height|margin|padding|top|left|right|bottom|inset|inline-size|block-size|flex|grid|gap|font-size|all)\b/;
  const bad = motionDeclarations().filter(({ part }) => layout.test(part.replace(/var\([^)]*\)/g, "")));
  assert.deepEqual(
    bad.map((entry) => `${entry.file}: ${entry.part}`),
    [],
  );
});

test("sailcloth ui.css collapses motion under prefers-reduced-motion", () => {
  const ui = readFileSync(join(root, "styles/src/ui.css"), "utf8");
  assert.match(ui, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(ui, /transition:\s*none\s*!important/);
});
