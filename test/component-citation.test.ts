import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import citation, {
  DATE_CLASS,
  ROOT_CLASS,
  SOURCE_CLASS,
  TEXT_CLASS,
  TITLE_CLASS,
  URL_CLASS,
  type CitationProps,
} from "../components/citation/index.ts";
import { activate, BUTTON_CLASS, labelAfterCopy, type CitationDocument, type CitationElement } from "../components/citation/client.ts";

const baseSite = (overrides: Record<string, unknown> = {}): Site =>
  ({
    config: { url: "https://example.com", base: "/lateen", collections: {} },
    data: {},
    nav: {},
    pages: [],
    collections: {},
    ...overrides,
  }) as unknown as Site;

const pageOf = (overrides: Partial<Page> = {}): Page =>
  ({
    url: "/lateen/components/button/",
    title: "Button",
    lang: "en",
    frontMatter: {},
    ...overrides,
  }) as unknown as Page;

function render(props: CitationProps = {}, page = pageOf(), site = baseSite()): string | null {
  const node = citation({ props, html: "", page, site } as unknown as ComponentProps<Readonly<Record<string, unknown>>>);
  return node === null ? null : renderToString(node as never);
}

test("the citation falls back to the page title and its absolute address", () => {
  const out = render();
  assert.ok(out);
  assert.match(out, new RegExp(`^<aside class="${ROOT_CLASS}" data-citation data-copy="Copy citation" data-copied="Citation copied">`));
  assert.ok(out.includes(`<span class="${TITLE_CLASS}">Button</span>`));
  assert.ok(out.includes(`<a class="${URL_CLASS}" href="https://example.com/lateen/components/button/" dir="ltr">https://example.com/lateen/components/button/</a>`));
  assert.ok(!out.includes(SOURCE_CLASS));
  assert.ok(!out.includes(DATE_CLASS));
});

test("a record adds its id and its configured date, each labelled", () => {
  const page = pageOf({
    record: { collection: "books", id: "alpha" },
  } as unknown as Partial<Page>);
  const site = baseSite({
    config: { url: "https://example.com", base: "/lateen", collections: { books: { dates: ["published"] } } },
    collections: { books: { name: "books", records: [{ id: "alpha", fields: { published: "2026-01-12" } }] } },
  });
  const out = render({}, page, site);
  assert.ok(out);
  assert.ok(out.includes(`<span class="${SOURCE_CLASS}">Source: <span dir="ltr">alpha</span></span>`));
  assert.ok(out.includes(`<time class="${DATE_CLASS}" datetime="2026-01-12">January 12, 2026</time>`));
});

test("explicit props override every part", () => {
  const out = render({ title: "The Handbook", url: "https://example.org/work", source: "handbook", date: "2026-02-03" });
  assert.ok(out);
  assert.ok(out.includes(`>The Handbook</span>`));
  assert.ok(out.includes(`href="https://example.org/work"`));
  assert.ok(out.includes(`>handbook</span>`));
  assert.ok(out.includes(`datetime="2026-02-03"`));
});

test("an unsafe address is left out, while the rest stays readable", () => {
  for (const url of ["javascript:alert(1)", "//evil.example/x", "../secret", "https://example.com/a b"]) {
    const out = render({ url, source: "handbook" });
    assert.ok(out, url);
    assert.ok(!out.includes(URL_CLASS), url);
    assert.ok(!out.includes("evil.example"), url);
    assert.ok(!out.includes("javascript:"), url);
    assert.ok(out.includes(`>handbook</span>`), url);
  }
});

test("unknown props and a value that is not a date never render", () => {
  const out = render({ note: "private", internal: "secret", date: "not-a-date" } as CitationProps);
  assert.ok(out);
  assert.ok(!out.includes("private") && !out.includes("secret"));
  assert.ok(!out.includes(DATE_CLASS));
});

test("without JavaScript the citation has no button, and print keeps its address", () => {
  const out = render();
  assert.ok(out);
  assert.ok(!out.includes(`${BUTTON_CLASS}`), "the island adds the control, so SSR has none");
  assert.ok(out.includes("https://example.com/lateen/components/button/"), "the address is visible text");

  const css = readFileSync(new URL("../styles/src/ui.css", import.meta.url), "utf8");
  const print = css.slice(css.indexOf("@media print"));
  assert.ok(print.includes(".citation-copy"));
  assert.ok(print.includes("break-inside: avoid"), "a citation does not split across printed pages");
  assert.ok(print.includes(".citation-url"));
});

test("a copy control copies the visible text and restores its label", async () => {
  class Element implements CitationElement {
    attrs = new Map<string, string>();
    textContent: string | null = null;
    children: Element[] = [];
    listeners: (() => void)[] = [];
    getAttribute(name: string): string | null {
      return this.attrs.get(name) ?? null;
    }
    setAttribute(name: string, value: string): void {
      this.attrs.set(name, value);
    }
    append(...nodes: unknown[]): void {
      this.children.push(...(nodes as Element[]));
    }
    addEventListener(_type: "click", listener: () => void): void {
      this.listeners.push(listener);
    }
    querySelector(): { textContent: string | null } | null {
      return null;
    }
    click(): void {
      for (const listener of this.listeners) listener();
    }
  }

  const root = new Element();
  root.setAttribute("data-copy", "Copy citation");
  root.setAttribute("data-copied", "Citation copied");
  root.querySelector = () => ({ textContent: "Button. https://example.com/guide/" });
  const button = new Element();
  const copied: string[] = [];
  const scheduled: (() => void)[] = [];

  const doc: CitationDocument = {
    querySelectorAll: () => [root],
    createElement: () => button,
  };
  activate(doc, {
    clipboard: { writeText: async (text) => void copied.push(text) },
    schedule: (callback) => void scheduled.push(callback),
  });

  assert.equal(button.getAttribute("type"), "button");
  assert.equal(button.getAttribute("class"), BUTTON_CLASS);
  assert.equal(button.textContent, "Copy citation");
  assert.deepEqual(root.children, [button]);

  button.click();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(copied, ["Button. https://example.com/guide/"]);
  assert.equal(button.textContent, "Citation copied");
  scheduled[0]?.();
  assert.equal(button.textContent, "Copy citation");
  assert.equal(labelAfterCopy(false, "Copy citation", "Citation copied"), "Copy citation");
});
