import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadTokens } from "../scripts/tokens.ts";

const theme = readFileSync(new URL("../styles/src/theme.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const declarations = [...theme.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;{}]+);/g)].map((match) => ({ name: match[1] ?? "", value: (match[2] ?? "").trim() }));

test("theme.css holds no raw colour (#1288)", () => {
  for (const { name, value } of declarations) {
    assert.doesNotMatch(value, /#[0-9a-f]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb)\(/i, `${name}: ${value} is a raw colour`);
  }
});

test("theme.css names no font family of its own (#1288)", () => {
  for (const { name, value } of declarations.filter(({ name }) => name.startsWith("--font-"))) {
    assert.match(value, /^var\(--type-font-[a-z]+\)$/, `${name}: ${value} is not a font token`);
  }
  assert.doesNotMatch(theme, /Geist/);
});

test("every var() in theme.css names a token or another name in the file (#1288)", () => {
  const tokens = loadTokens();
  const local = new Set(declarations.map(({ name }) => name));
  for (const { name, value } of declarations) {
    for (const ref of value.matchAll(/var\((--[a-z0-9-]+)/g)) {
      const target = (ref[1] ?? "").slice(2);
      assert.ok(tokens.has(target) || local.has(`--${target}`), `${name} points at --${target}, which does not exist`);
    }
  }
});

test("a raw colour added to theme.css would be caught (#1288)", () => {
  assert.match("--night: #23212c", /#[0-9a-f]{3,8}\b/i);
});
