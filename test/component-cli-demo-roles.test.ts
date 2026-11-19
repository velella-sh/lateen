import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { contrast, parseHex } from "../src/color.ts";
import cliDemo from "../components/cli-demo/index.ts";

const css = "" /* lateen-legacy removed: components/cli-demo/style.css */;
const tokens = readFileSync(new URL("../styles/tokens.css", import.meta.url), "utf8");

/** The light and dark value of a `light-dark(a, b)` token. */
function pair(name: string): { light: string; dark: string } {
  const m = new RegExp(`--${name}:\\s*light-dark\\((#[0-9a-fA-F]{3,6}),\\s*(#[0-9a-fA-F]{3,6})\\)`).exec(tokens);
  assert.ok(m, `token ${name}`);
  return { light: m[1]!, dark: m[2]! };
}

function render(html: string): string {
  const input = { props: {}, html, page: { lang: "en", source: { file: "a.md", line: 1 } }, site: {} } as unknown as ComponentProps;
  return renderToString(cliDemo(input as never) as never);
}

test("every role meets 4.5:1 on the code background in light and dark", () => {
  const bg = pair("code-bg");
  const roles: Record<string, { light: string; dark: string }> = {
    command: pair("code-fg"),
    output: pair("code-fg"),
    prompt: pair("color-muted"),
    comment: pair("color-muted"),
    "error label and text": pair("code-fg"),
  };
  for (const [role, c] of Object.entries(roles)) {
    for (const scheme of ["light", "dark"] as const) {
      const fg = parseHex(c[scheme]);
      const back = parseHex(bg[scheme]);
      assert.ok(fg && back);
      const ratio = contrast(fg, back);
      assert.ok(ratio >= 4.5, `${role} in ${scheme}: ${ratio.toFixed(2)}`);
    }
  }
});

test("the error border meets 3:1 as a graphic in light and dark", () => {
  const bg = pair("code-bg");
  const border = pair("color-danger");
  for (const scheme of ["light", "dark"] as const) {
    const ratio = contrast(parseHex(border[scheme])!, parseHex(bg[scheme])!);
    assert.ok(ratio >= 3, `${scheme}: ${ratio.toFixed(2)}`);
  }
});

