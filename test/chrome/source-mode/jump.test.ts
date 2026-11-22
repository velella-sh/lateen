import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { activate, findJump, stamp, type SourceBlock, type SwitchPart, type SwitchRoot } from "../../../chrome/source-mode/client.ts";

const HTML = `<p data-src="docs/a.md:3:1-5:10">one</p><p data-src="docs/a.md:9:1-9:20">two</p>`;

function page(search: string) {
  const document = new JSDOM(`<body>${HTML}</body>`).window.document;
  const blocks = [...document.querySelectorAll("[data-src]")] as unknown as SourceBlock[];
  const classes = new Set<string>();
  const status: SwitchPart = { textContent: "", setAttribute() {} };
  const button: SwitchPart = { textContent: "", setAttribute() {} };
  const root: SwitchRoot = {
    hidden: true,
    getAttribute: () => null,
    querySelector: (selector) => (selector === ".source-mode-button" ? button : selector === ".source-mode-status" ? status : null),
  };
  const focused: string[] = [];
  const scrolled: string[] = [];
  for (const block of blocks) {
    const el = block as unknown as { scrollIntoView(): void; textContent: string };
    el.scrollIntoView = () => scrolled.push(el.textContent);
  }
  activate(root, {
    root: { classList: { toggle: (n, f) => (f ? classes.add(n) : classes.delete(n)), contains: (n) => classes.has(n) } },
    blocks,
    storage: undefined,
    search,
    createLabel: () => {
      const el = document.createElement("span");
      (el as unknown as { focus(): void }).focus = () => focused.push(el.parentElement?.textContent ?? "");
      return el as never;
    },
    actions: {
      storage: undefined,
      messages: (name) =>
        ({ "jump-nearest": "Nearest to {line}.", "jump-other": "{file} is not this page.", "jump-none": "Nothing at {line}." })[name] ?? "",
      createElement: (tag) => {
        const el = document.createElement(tag);
        (el as unknown as { focus(): void }).focus = () => focused.push(el.closest("p")?.textContent ?? "");
        return el as never;
      },
      copy: async () => true,
      announce: () => {},
    },
  });
  return { classes, status, focused, scrolled };
}

test("an exact line turns the mode on, scrolls to the block, and focuses its label", () => {
  const p = page("?source=docs/a.md:4");
  assert.equal(p.classes.has("source-mode"), true);
  assert.equal(p.scrolled.length, 1);
  assert.match(p.scrolled[0] ?? "", /^one/);
  assert.match(p.focused[0] ?? "", /^one/);
  assert.equal(p.status.textContent, "", "an exact hit needs no message");
});

test("a line between blocks falls back to the nearest block before it, and says so", () => {
  const entries = stamp({
    blocks: [...new JSDOM(`<body>${HTML}</body>`).window.document.querySelectorAll("[data-src]")] as unknown as SourceBlock[],
    createLabel: () => new JSDOM("").window.document.createElement("span") as never,
  });
  const jump = findJump(entries, "docs/a.md:7");
  assert.equal(jump.kind === "block" && jump.exact, false);
  assert.equal(jump.kind === "block" && jump.target.span.line, 3);
  const p = page("?source=docs/a.md:7");
  assert.match(p.scrolled[0] ?? "", /^one/);
  assert.equal(p.status.textContent, "Nearest to 7.");
});

test("another page's file is announced, and nothing is selected", () => {
  const p = page("?source=docs/other.md:4");
  assert.equal(p.scrolled.length, 0);
  assert.equal(p.focused.length, 0);
  assert.equal(p.status.textContent, "docs/other.md is not this page.", "an unknown file is never silent");
  assert.equal(p.classes.has("source-mode"), false, "no jump, so the mode stays as saved");
});

test("a line above every block, or no ?source=, does not fail", () => {
  assert.equal(findJump([], "docs/a.md:1").kind, "other-file");
  const above = page("?source=docs/a.md:1");
  assert.equal(above.scrolled.length, 0);
  assert.equal(above.status.textContent, "Nothing at 1.");
  assert.equal(page("").scrolled.length, 0);
  assert.equal(page("?source=garbage").classes.has("source-mode"), false);
});
