import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

const tokens = readFileSync(new URL("../site/tokens.md", import.meta.url), "utf8");
const callout = readFileSync(new URL("../site/components/callout.md", import.meta.url), "utf8");
const navigation = readFileSync(new URL("../site/_data/navigation.yml", import.meta.url), "utf8");
const config = readFileSync(new URL("../site/mizzen.yml", import.meta.url), "utf8");
const styles = readUiCss();

test("tokens and callouts expose the mockup's visual examples", () => {
  assert.ok(tokens.includes('class="swatches"'));
  assert.ok(tokens.includes("## Type"));
  for (const [specimen, className] of [["night", "n"], ["sail", "s"], ["mist", "m"], ["foam", "f"], ["shell", "h"], ["blue", "b"]] as const) {
    assert.ok(tokens.includes(`swatch ${className}`), specimen);
    assert.match(styles, new RegExp(`\\.${className}\\s*\\{[^}]*var\\(--${specimen}\\)`));
  }
  for (const font of ["Manrope", "JetBrains Mono", "Vazirmatn"]) assert.ok(tokens.includes(font), font);

  const kinds = callout.indexOf("## Kinds");
  const syntax = callout.indexOf("## Syntax");
  assert.ok(kinds >= 0 && syntax > kinds);
  for (const kind of ["note", "tip", "important", "warning", "caution"]) {
    assert.ok(callout.includes(`:::callout{type=${kind}`), kind);
  }
});

test("the docs standard is a public Customize page", () => {
  const path = new URL("../site/standards.md", import.meta.url);
  assert.ok(existsSync(path));
  const standard = readFileSync(path, "utf8");
  assert.ok(standard.includes("permalink: /standards/"));
  for (const heading of ["Principles", "Page anatomy", "Writing", "Callouts", "Code", "Definition of done"]) {
    assert.ok(standard.includes(`## ${heading}`), heading);
  }
  assert.ok(navigation.includes("url: /standards/"));
  assert.match(config, /title: Docs standard\n\s+url: \/standards\//);
});

test("specimen styles use the responsive Sailcloth grid", () => {
  assert.match(styles, /\.swatches\s*\{[^}]*grid-template-columns:\s*repeat\(3,/);
  assert.match(styles, /@media \(max-width: 48rem\)[\s\S]*?\.swatches\s*\{[^}]*grid-template-columns:\s*1fr/);
});
