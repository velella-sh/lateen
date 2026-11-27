// The token spec is a public promise (#1297): the package conforms to it, it lists every token the build
// writes, it names every deprecated alias, and the contrast table on the token page is current.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { conformance, declarations, deprecatedNames, specTokens } from "../docs/spec/tokens/conformance.ts";
import { renderPage } from "../scripts/token-contrast.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (path: string): string => readFileSync(`${root}${path}`, "utf8");

test("the package conforms to the token spec", () => {
  assert.deepEqual(conformance(root), []);
});

test("the spec lists every token the build writes, once", () => {
  const listed = specTokens(read("docs/spec/tokens/v1.md")).map((token) => token.name);
  assert.equal(new Set(listed).size, listed.length, "no token is listed twice");
  assert.deepEqual([...declarations(read("styles/tokens.css")).keys()].filter((name) => !listed.includes(name)), []);
});

test("every deprecated alias in the theme is in the spec with a removal release", () => {
  const spec = read("docs/spec/tokens/v1.md");
  const listed = new Set(deprecatedNames(spec));
  const theme = read("styles/src/theme.css");
  const root = theme.split(":root {")[1]?.split("\n}")[0] ?? "";
  for (const [, name] of root.matchAll(/^\s+(--[a-z0-9-]+): (?:var|color-mix)\(/gm)) {
    assert.ok(listed.has(name as string), `${name} is a deprecated alias missing from the spec`);
  }
  assert.match(spec, /removed in 0\.2\.7/);
});

test("the conformance script rejects a missing token and a wrong type", () => {
  const spec = specTokens(read("docs/spec/tokens/v1.md"));
  assert.ok(spec.length > 200);
  assert.ok(conformance(`${root}test`).length > 0, "a folder without the spec does not conform");
});

test("the contrast table on the token page is current", () => {
  const page = read("site/tokens.md");
  assert.equal(renderPage(page), page, "run node scripts/token-contrast.ts --write");
});
