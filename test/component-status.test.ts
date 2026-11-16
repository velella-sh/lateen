import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import status, { DEFAULT_TONE, ICONS, TONES, classNameOf, directive, toneOf, type StatusProps } from "../components/status/index.ts";

function render(props: StatusProps, html = ""): string {
  const input = { props, html, page: { lang: "en" }, site: {} } as unknown as ComponentProps<StatusProps>;
  return renderToString(status(input) as never);
}

const css = readFileSync(new URL("../components/status/style.css", import.meta.url), "utf8");

test("the directive is status and there are five tones", () => {
  assert.equal(directive, "status");
  assert.deepEqual([...TONES], ["positive", "caution", "negative", "neutral", "info"]);
  assert.equal(DEFAULT_TONE, "neutral");
});

test("each tone renders its class, its text, and an icon of its own hidden from assistive technology", () => {
  for (const tone of TONES) {
    const out = render({ tone }, "Done");
    assert.match(out, new RegExp(`class="${classNameOf(tone)}"`));
    assert.match(out, new RegExp(`data-tone="${tone}"`));
    assert.match(out, /<span class="status-icon" aria-hidden="true"><svg/);
    assert.match(out, />Done<\/span>/);
  }
  assert.equal(new Set(TONES.map((tone) => ICONS[tone])).size, 5);
});

test("a missing, blank, or unknown tone is neutral", () => {
  for (const tone of [undefined, "", "  ", "bogus", "positive!"]) {
    assert.match(render({ tone } as StatusProps, "x"), /class="status status-neutral"/);
  }
  assert.equal(toneOf(" Positive "), "positive");
  assert.equal(toneOf(3), "neutral");
});

test("a label prop is escaped, and body html is kept", () => {
  assert.match(render({ label: "<b>&" }), />&lt;b>&amp;</);
  assert.match(render({}, "<em>ok</em>"), /<em>ok<\/em>/);
});

test("the source position is kept as data-src", () => {
  assert.match(render({ src: "a.md:3:1-3:20" }, "x"), /data-src="a\.md:3:1-3:20"/);
  assert.doesNotMatch(render({}, "x"), /data-src/);
});

test("the stylesheet colours every tone from status tokens only", () => {
  for (const tone of TONES) {
    for (const part of ["fg", "bg", "border"]) assert.ok(css.includes(`var(--status-${tone}-${part})`), `${tone} ${part}`);
  }
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|var\(--color-(success|info|warning|danger)/i);
});
