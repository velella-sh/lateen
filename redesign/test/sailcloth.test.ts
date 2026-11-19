import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

test("ui.css locks sailcloth brand tokens for light and dark", () => {
  const css = readFileSync(new URL("../src/ui.css", import.meta.url), "utf8");
  assert.match(css, /--night:\s*#23212c/i);
  assert.match(css, /--foam:\s*#f4f4f9/i);
  assert.match(css, /--shell:\s*#ede6d8/i);
  assert.match(css, /--blue:\s*#4c6f9a/i);
  assert.match(css, /--blue-lift:\s*#8fb0d4/i);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /body::before/);
  assert.doesNotMatch(css, /mask-image:\s*linear-gradient/);
});

test("STANDARDS.md documents the sailcloth contract", () => {
  const md = readFileSync(new URL("../STANDARDS.md", import.meta.url), "utf8");
  assert.match(md, /#23212C/i);
  assert.match(md, /sailcloth/i);
  assert.match(md, /Tailwind/);
  assert.match(md, /Basecoat/);
});
