import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import motif, { MAX_BYTES, PATTERNS, type MotifProps } from "../components/motif/index.ts";

function render(props: MotifProps): string {
  const out = motif({ props, html: "" } as unknown as ComponentProps<MotifProps>);
  return out === null ? "" : renderToString(out as never);
}

const seeds = ["", "home", "a", "Lateen", "فارسی", "x".repeat(500), ...Array.from({ length: 40 }, (_, i) => `seed-${i}`)];

test("the same input gives the same bytes, and a different seed a different drawing", () => {
  for (const pattern of PATTERNS) {
    assert.equal(render({ seed: "home", pattern }), render({ seed: "home", pattern }));
    assert.notEqual(render({ seed: "home", pattern }), render({ seed: "docs", pattern }));
  }
});

test("every motif stays under 4 KB", () => {
  for (const pattern of PATTERNS) {
    for (const seed of seeds) {
      const bytes = Buffer.byteLength(render({ seed, pattern }));
      assert.ok(bytes > 0 && bytes < MAX_BYTES, `${pattern} ${seed.slice(0, 8)}: ${bytes} bytes`);
    }
  }
});

test("an unknown pattern or a missing seed falls back to the defaults", () => {
  assert.match(render({ pattern: "waves" }), /class="motif motif-contours"/);
  assert.equal(render({}), render({ seed: "motif", pattern: "contours" }));
});

test("it is decorative: hidden from assistive technology, with no text, image or script", () => {
  for (const pattern of PATTERNS) {
    const out = render({ seed: "home", pattern });
    assert.match(out, /^<svg [^>]*aria-hidden="true"/);
    assert.match(out, /focusable="false"/);
    assert.doesNotMatch(out, /<(title|desc|text|tspan|image|script|foreignObject|a)[ >]/);
    assert.doesNotMatch(out, /href|aria-label|role=|alt=|<img|https?:/i);
    // Removing the tags leaves no characters, so the motif carries no text.
    assert.equal(out.replace(/<[^>]*>/g, ""), "");
  }
});

test("colours come from theme tokens, so both themes are covered, with no raw colour in the markup", () => {
  const css = readFileSync(new URL("../components/motif/style.css", import.meta.url), "utf8");
  assert.match(css, /var\(--color-accent\)/);
  assert.match(css, /var\(--color-accent-hover\)/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
  assert.doesNotMatch(css, /url\(/);
  for (const pattern of PATTERNS) assert.doesNotMatch(render({ seed: "s", pattern }), /fill="|stroke="|style=|#[0-9a-f]{3,6}/i);
});

test("the stylesheet is print and forced-colors safe and uses no raster", () => {
  const css = readFileSync(new URL("../components/motif/style.css", import.meta.url), "utf8");
  assert.match(css, /@media print/);
  assert.match(css, /forced-colors: active/);
});

test("the source position is kept as data-src", () => {
  assert.match(render({ seed: "a", src: "1:2" }), /data-src="1:2"/);
});
