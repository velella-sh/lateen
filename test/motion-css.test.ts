// Motion is calm and token-driven (#472): every `transition` and `animation` in the shipped styles takes its
// duration and easing from a motion token, so the reduced-motion block in `styles/tokens.css` (every motion
// token set to 0ms / linear) covers all of them, and none of them animates a property that moves layout.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const root = new URL("../", import.meta.url).pathname;
const cssFiles = (dir: string): string[] =>
  readdirSync(join(root, dir), { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".css"))
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name).slice(root.length));

const files = [...cssFiles("styles"), ...cssFiles("components"), ...cssFiles("chrome"), ...cssFiles("layouts")].filter((file) => file !== "styles/tokens.css" && file !== "styles/print.css");
const strip = (text: string): string => text.replace(/\/\*[\s\S]*?\*\//g, "");

/** Every `transition:` and `animation:` shorthand, split on top-level commas. */
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

test("every transition and animation takes its duration and easing from the motion tokens", () => {
  const all = motionDeclarations();
  assert.ok(all.length > 15, "the motion scan should find the shipped transitions");
  const bad = all.filter(({ part }) => !/var\(--motion-(fast|base|slow|press)\)/.test(part) || (!/var\(--motion-ease[a-z-]*\)/.test(part) && !/\blinear\b/.test(part)));
  assert.deepEqual(bad.map((entry) => `${entry.file}: ${entry.property}: ${entry.part}`), []);
});

test("every motion token has a reduced value, so reduced motion collapses all of them to zero", () => {
  const tokens = readFileSync(join(root, "styles/tokens.css"), "utf8");
  const reduced = tokens.slice(tokens.indexOf("prefers-reduced-motion: reduce"));
  const names = [...tokens.slice(0, tokens.indexOf("@media (prefers-reduced-motion")).matchAll(/--(motion-[a-z-]+):/g)].map((m) => m[1] ?? "");
  assert.ok(names.includes("motion-press") && names.includes("motion-ease-out") && names.includes("motion-ease-in"), "the enter, exit and press tokens exist");
  for (const name of names) assert.match(reduced, new RegExp(`--${name}: (0ms|linear)`), `${name} has no reduced-motion value`);
});

test("no transition or animation moves layout, and nothing animates on load", () => {
  const layout = /\b(width|height|margin|padding|top|left|right|bottom|inset|inline-size|block-size|flex|grid|gap|font-size|all)\b/;
  const bad = motionDeclarations().filter(({ part }) => layout.test(part.replace(/var\([^)]*\)/g, "")));
  assert.deepEqual(bad.map((entry) => `${entry.file}: ${entry.part}`), []);
});

test("the drawer slides, the menu fades and the theme crossfades, in CSS", () => {
  const drawer = readFileSync(join(root, "chrome/drawer/style.css"), "utf8");
  assert.match(drawer, /translate var\(--motion-base\)/);
  assert.match(drawer, /@starting-style/);
  assert.match(readFileSync(join(root, "chrome/page-agent-menu/style.css"), "utf8"), /animation: page-agent-menu-fade var\(--motion-fast\) var\(--motion-ease-out\)/);
  assert.match(readFileSync(join(root, "styles/base.css"), "utf8"), /var\(--motion-base\) var\(--motion-ease-in-out\)/);
});
