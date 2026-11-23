// The shared media surface: a figure and a Mermaid diagram read as the same kind of block, sit on the
// same plate, and share one rhythm with the prose. A small image keeps its natural size; a narrow
// diagram keeps its drawn size; a diagram wider than the column scrolls inside its own frame instead
// of shrinking its labels away or widening the page. The Mermaid palette is repainted from tokens so
// it follows light and dark. These rules live in the shared stylesheet, so a consumer gets them by
// upgrading the theme and changing no YAML, Markdown, or CSS.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readUiCss } from "./ui-css-helpers.ts";

const css = readUiCss();

/** The declarations of the first rule whose selector matches `selector` as a regular expression. */
function declarations(selector: string): string {
  const match = new RegExp(`^[ \\t]*${selector}[ \\t]*\\{([^}]*)\\}`, "m").exec(css);
  assert.ok(match, `missing rule for ${selector}`);
  return match[1]!;
}

test("a figure and a diagram share one spacing rhythm with the prose", () => {
  const shared = declarations("\\.figure,\\s*\\n\\s*\\.mermaid");
  assert.match(shared, /margin-block:\s*var\(--space-6\)/);
});

test("an image keeps its natural size and never stretches", () => {
  const image = declarations("\\.figure-img");
  assert.match(image, /display:\s*block/);
  assert.match(image, /block-size:\s*auto/);
  assert.match(image, /max-inline-size:\s*100%/);
  assert.doesNotMatch(image, /(^|[;{\s])inline-size:\s*100%/, "a single image must not be forced to fill the column");
  // Only the multi-image grid stretches its members to a shared cell.
  assert.match(declarations("\\.figure-images \\.figure-img"), /inline-size:\s*100%/);
});

test("the caption and credit stay quiet and start-aligned", () => {
  const caption = declarations("\\.figure-caption");
  assert.match(caption, /color:\s*var\(--muted-foreground\)/);
  assert.match(caption, /font-size:\s*var\(--type-size-sm\)/);
  assert.match(caption, /margin-block-start:\s*var\(--space-2\)/);
  assert.match(caption, /overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(caption, /text-align:\s*center/, "the caption aligns with the prose, not under a centered image");
});

test("the diagram sits on the same plate as an image and scrolls inside it", () => {
  const plate = declarations("\\.mermaid-diagram");
  assert.match(plate, /overflow-x:\s*auto/);
  assert.match(plate, /background:\s*var\(--card\)/);
  assert.match(plate, /border:\s*1px solid var\(--border\)/);
  // The image uses --radius-xl too, so a branded scale that squares the card radius leaves both alone.
  assert.match(plate, /border-radius:\s*var\(--radius-xl\)/);
  assert.match(plate, /padding:\s*var\(--space-4\)/);
});

test("a wide diagram scales down only to a legible floor and then scrolls", () => {
  const svg = declarations("\\.mermaid-diagram > svg");
  // Inline size is min(natural, max(100%, natural * 0.7)): small keeps its width, wide stops at 70%.
  assert.match(
    svg,
    /inline-size:\s*min\(var\(--mermaid-natural,\s*100%\),\s*max\(100%,\s*calc\(var\(--mermaid-natural,\s*100%\)\s*\*\s*0\.7\)\)\)/,
  );
  assert.match(svg, /margin-inline:\s*auto/);
  assert.match(svg, /block-size:\s*auto/);
});

test("the diagram palette is repainted from tokens so it follows light and dark", () => {
  assert.match(declarations("\\.mermaid-diagram > svg :where\\(text,\\s*tspan\\)"), /fill:\s*var\(--foreground\)\s*!important/);
  assert.match(
    declarations("\\.mermaid-diagram > svg :where\\(rect,\\s*circle,\\s*ellipse,\\s*polygon\\)"),
    /fill:\s*var\(--background\)\s*!important/,
  );
  assert.match(
    declarations("\\.mermaid-diagram > svg :where\\(\\.flowchart-link,\\s*\\.edgePaths path\\)"),
    /stroke:\s*var\(--muted-foreground\)\s*!important/,
  );
  // Every repaint stays scoped to the diagram, so no other block is touched.
  for (const rule of css.matchAll(/^[ \t]*(\.mermaid-diagram[^{]*)\{/gm)) {
    assert.match(rule[1]!, /\.mermaid-diagram/, "a Mermaid rule is scoped to the diagram");
  }
});

test("the source disclosure keeps its existing markup and only gains spacing under the diagram", () => {
  assert.match(declarations("\\.mermaid-source"), /margin-block-start:\s*var\(--space-3\)/);
  // No rule restyles the summary or the code block: the disclosure's behavior is unchanged.
  assert.doesNotMatch(css, /\.mermaid-source (?:>|:where\()?\s*(?:summary|pre)\b[^{]*\{/);
  assert.doesNotMatch(css, /\.mermaid-fallback\b/);
});
