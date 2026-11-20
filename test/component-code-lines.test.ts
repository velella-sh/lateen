import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { decorateLines, HIGHLIGHT_CLASS, isHighlighted, LINE_CLASS, LINE_LINK_CLASS, lineAnchorId } from "../components/code/lines.ts";
import { parseLineFragment, TARGET_CLASS } from "../components/code/line-fragment.ts";
import { targetLines, type CopyDocument, type CopyLine } from "../chrome/code-copy/client.ts";

/** Shiki's inner HTML for three lines, one `span.line` each, joined by `\n`. */
const SHIKI = '<span class="line"><span style="color:#111">a</span></span>\n<span class="line">b</span>\n<span class="line"></span>';

/** The visible text of an HTML fragment: characters outside tags, scanned one at a time. */
function textOf(html: string): string {
  let text = "";
  let inTag = false;
  for (const char of html) {
    if (char === "<") inTag = true;
    else if (char === ">" && inTag) inTag = false;
    else if (!inTag) text += char;
  }
  return text;
}

test("isHighlighted covers single lines and inclusive ranges", () => {
  const ranges = [
    { from: 1, to: 1 },
    { from: 3, to: 5 },
  ];
  assert.deepEqual([1, 2, 3, 4, 5, 6].map((n) => isHighlighted(n, ranges)), [true, false, true, true, true, false]);
  assert.equal(isHighlighted(1, []), false);
});

test("decorateLines wraps every line once, without nesting Shiki's wrapper", () => {
  const out = decorateLines(SHIKI);
  assert.equal((out.match(/<span class="line/g) ?? []).length, 3);
  assert.equal(out.split("\n").length, 3);
  assert.match(out, /^<span class="line"><span style="color:#111">a<\/span><\/span>\n/);
  assert.match(out, /<span class="line">b<\/span>\n/);
  assert.doesNotMatch(out, /class="line"><span class="line"/);
});

test("decorateLines marks only the lines a highlight range covers", () => {
  const out = decorateLines(SHIKI, { highlight: [{ from: 2, to: 3 }] }).split("\n");
  assert.equal(out[0], `<span class="${LINE_CLASS}"><span style="color:#111">a</span></span>`);
  assert.equal(out[1], `<span class="${LINE_CLASS} ${HIGHLIGHT_CLASS}">b</span>`);
  assert.equal(out[2], `<span class="${LINE_CLASS} ${HIGHLIGHT_CLASS}"></span>`);
});

test("decorateLines adds no line numbers unless asked", () => {
  assert.doesNotMatch(decorateLines(SHIKI), /data-line/);
  assert.doesNotMatch(decorateLines(SHIKI, { highlight: [{ from: 1, to: 1 }] }), /data-line/);
});

test("line numbers are attributes, so the text of the block is only the code", () => {
  const out = decorateLines(SHIKI, { numbers: true, highlight: [{ from: 1, to: 1 }] });
  assert.match(out, /data-line="1"/);
  assert.match(out, /data-line="2"/);
  assert.match(out, /data-line="3"/);
  assert.equal(textOf(out), "a\nb\n");
});

test("code text is kept exactly, entities and all", () => {
  const html = '<span class="line">a &lt; b &amp;&amp; c</span>';
  assert.equal(textOf(decorateLines(html, { numbers: true })), "a &lt; b &amp;&amp; c");
  assert.match(decorateLines(html), /a &lt; b &amp;&amp; c<\/span>$/);
});

test("a line without Shiki's wrapper is wrapped too", () => {
  assert.equal(decorateLines("plain"), `<span class="${LINE_CLASS}">plain</span>`);
});

test("the highlighted line marker is a logical inline border that keeps text in place", () => {
  const css = readFileSync(new URL("../styles/src/ui.css", import.meta.url), "utf8");
  const rule = /\.code \.highlighted,[\s\S]{0,120}\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(rule, /border-inline-start:\s*2px solid var\(--mist\)/);
  assert.match(rule, /padding-inline-start:/);
  assert.doesNotMatch(rule, /border-(left|right)\b/);
});

const BLOCK = "code-a-md-3";

/** A line element the targeting test can mark and count. */
function fakeLine(id: string) {
  const classes = new Set<string>();
  const line = {
    id,
    scrolled: 0,
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
      has: (name: string) => classes.has(name),
    },
    scrollIntoView: () => {
      line.scrolled += 1;
    },
    getAttribute: () => null,
    querySelector: () => null,
    before: () => {},
  };
  return line;
}

/** A document holding numbered lines `L1…Ln` of one block, enough for `targetLines`. */
function fakeDoc(count: number) {
  const lines = new Map<string, ReturnType<typeof fakeLine>>();
  for (let n = 1; n <= count; n += 1) lines.set(lineAnchorId(BLOCK, n), fakeLine(lineAnchorId(BLOCK, n)));
  const doc = {
    getElementById: (id: string) => lines.get(id) ?? null,
    querySelectorAll: (selector: string) =>
      selector === `.${TARGET_CLASS}` ? [...lines.values()].filter((line) => line.classList.has(TARGET_CLASS)) : [],
    createElement: () => ({ setAttribute() {}, append() {}, addEventListener() {}, textContent: "" }),
    createElementNS: () => ({ setAttribute() {}, append() {}, addEventListener() {}, textContent: "" }),
  } as unknown as CopyDocument;
  return { doc, lines };
}

test("a decorated line has a stable id and a keyboard-reachable link that adds no text", () => {
  const out = decorateLines(SHIKI, { block: BLOCK, lang: "en" });
  assert.match(out, new RegExp(`<span class="line" id="${BLOCK}-L1">`));
  assert.match(out, new RegExp(`<span class="line" id="${BLOCK}-L2">`));
  assert.match(out, new RegExp(`<span class="line" id="${BLOCK}-L3">`));
  assert.match(out, new RegExp(`<a class="${LINE_LINK_CLASS}" href="#${BLOCK}-L2" aria-label="Link to line 2"></a>`));
  assert.equal((out.match(new RegExp(`class="${LINE_LINK_CLASS}"`, "g")) ?? []).length, 3);
});

test("a one-line link targets the line itself and works without JavaScript", () => {
  const html = decorateLines(SHIKI, { block: BLOCK, lang: "en" });
  const target = `#${BLOCK}-L3`;
  assert.match(html, new RegExp(`id="${BLOCK}-L3"`));
  assert.match(html, new RegExp(`href="${target}"`));
  assert.doesNotMatch(html, /<script|targeted/);
});

test("a range link is the block id, then L from and L to", () => {
  assert.deepEqual(parseLineFragment(`#${BLOCK}-L3-L7`), { block: BLOCK, from: 3, to: 7 });
  assert.deepEqual(parseLineFragment(`#${BLOCK}-L3`), { block: BLOCK, from: 3, to: 3 });
  assert.equal(parseLineFragment("#L3"), undefined);
  assert.equal(parseLineFragment(`#${BLOCK}-L7-L3`), undefined);
  assert.equal(parseLineFragment(`#${BLOCK}-L0`), undefined);
});

test("fragment targeting marks a range, clears the last one, and scrolls its first line", () => {
  const { doc, lines } = fakeDoc(5);
  const ids = (items: CopyLine[]) => items.map((line) => (line as unknown as { id: string }).id);
  const marked = targetLines(doc, `#${BLOCK}-L2-L4`);
  assert.deepEqual(ids(marked), [`${BLOCK}-L2`, `${BLOCK}-L3`, `${BLOCK}-L4`]);
  assert.equal(lines.get(`${BLOCK}-L2`)!.scrolled, 1);
  assert.equal(lines.get(`${BLOCK}-L1`)!.scrolled, 0);
  assert.equal(lines.get(`${BLOCK}-L3`)!.scrolled, 0);
  const rerun = targetLines(doc, `#${BLOCK}-L5`);
  assert.deepEqual(ids(rerun), [`${BLOCK}-L5`]);
  assert.equal(lines.get(`${BLOCK}-L2`)!.classList.has(TARGET_CLASS), false);
  assert.equal(lines.get(`${BLOCK}-L5`)!.classList.has(TARGET_CLASS), true);
  // A single line has its own id, so the browser scrolls it; only a range needs the island's help.
  assert.equal(lines.get(`${BLOCK}-L5`)!.scrolled, 0);
});

test("the line link is RTL-safe and the target uses a logical edge", () => {
  const css = readFileSync(new URL("../styles/src/ui.css", import.meta.url), "utf8");
  const linkRule = /\.code \.line-link,\n\.code-frame \.line-link \{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(linkRule, /inline-size:/);
  assert.match(linkRule, /margin-inline-end:/);
  assert.doesNotMatch(linkRule, /\b(?:left|right|margin-left|margin-right)\b/);
  const targetRule = /\.code \.line:target,[\s\S]{0,400}?\{([^}]*)\}/.exec(css)?.[1] ?? "";
  assert.match(targetRule, /border-inline-start:\s*2px solid var\(--link\)/);
  assert.match(targetRule, /padding-inline-start:/);
  assert.doesNotMatch(targetRule, /\b(?:border-left|border-right)\b/);
});

test("the copied text stays the code, with no link or line ids in it", () => {
  const out = decorateLines(SHIKI, { block: BLOCK, numbers: true, lang: "en" });
  assert.equal(textOf(out), "a\nb\n");
  assert.doesNotMatch(textOf(out), /#|line-link/);
});

