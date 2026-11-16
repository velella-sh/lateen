import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { contrast, parseHex } from "../src/color.ts";
import cliDemo from "../components/cli-demo/index.ts";

const css = readFileSync(new URL("../components/cli-demo/style.css", import.meta.url), "utf8");
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

test("the roles differ by text: prompt marker, visible error label, comment mark", () => {
  const out = render("<p>$ run\nplain\n# note\n! failed</p>");
  assert.match(out, /cli-demo-prompt" aria-hidden="true">\$ </);
  assert.match(out, /cli-demo-label-visible">error</);
  assert.match(out, /<span class="cli-demo-text"># note<\/span>/);
  assert.match(out, /<span class="cli-demo-label">output<\/span>/);
  // Without colour: weight for commands, italics for comments, an underline for errors.
  assert.match(css, /\.cli-demo-comment\s*\{[^}]*font-style:\s*italic/);
  assert.match(css, /\.cli-demo-error \.cli-demo-text\s*\{[^}]*text-decoration/);
  assert.match(css, /\.cli-demo-command \.cli-demo-text\s*\{[^}]*font-weight/);
});

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

test("the roles use the tokens they were checked with", () => {
  assert.match(css, /\.cli-demo-comment\s*\{[^}]*color:\s*var\(--color-muted\)/);
  assert.match(css, /\.cli-demo-prompt\s*\{[^}]*color:\s*var\(--color-muted\)/);
  assert.match(css, /\.cli-demo-label-visible\s*\{[^}]*border:\s*1px solid var\(--color-danger\)[^}]*color:\s*var\(--code-fg\)/);
  assert.match(css, /\.cli-demo\s*\{[^}]*background-color:\s*var\(--code-bg\)[^}]*color:\s*var\(--code-fg\)/);
});

test("long lines scroll inside a focusable block", () => {
  assert.match(render("<p>$ a-very-long-command</p>"), /<pre class="cli-demo-body" tabindex="0">/);
  assert.match(css, /\.cli-demo-body\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /\.cli-demo-body:focus-visible/);
});
