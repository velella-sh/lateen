import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare from "../components/compare/index.ts";
import {
  activate,
  NARROW_ATTRIBUTE,
  NARROW_WIDTH,
  type CompareDocument,
  type CompareEnv,
} from "../components/compare/client.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = [
  record("a", { title: "Alpha", pages: 120, published: "2026-01-02" }),
  record("b", { title: "Beta", pages: 80, published: "2026-02-03" }),
  record("c", { title: "Gamma", pages: 200, published: "2026-03-04" }),
];

const site = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: books.map((book) => ({ url: `/books/${book.id}/`, record: { collection: "books", id: book.id } })),
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const page = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

const fields = JSON.stringify([
  { field: "pages", label: "Pages", kind: "number" },
  { field: "published", label: "Published", kind: "date" },
]);

function html(ids = "a,b,c"): string {
  const input = { props: { from: "books", ids, fields }, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

function docOf(ids = "a,b,c"): Document {
  return new JSDOM(`<!doctype html><html lang="en"><body>${html(ids)}</body></html>`).window.document;
}

function envOf(
  width: number | (() => number),
  watch?: (root: unknown, update: () => void) => () => void,
): CompareEnv {
  const env: CompareEnv = {
    search: () => "",
    hash: () => "",
    replaceUrl: () => {},
    width: typeof width === "function" ? width : () => width,
  };
  if (watch !== undefined) env.watch = watch as NonNullable<CompareEnv["watch"]>;
  return env;
}

const root = (document: Document): HTMLElement => document.querySelector("[data-compare]") as HTMLElement;
const tabs = (document: Document): HTMLElement => document.querySelector(".compare-tabs") as HTMLElement;
const buttons = (document: Document): HTMLButtonElement[] => [
  ...document.querySelectorAll<HTMLButtonElement>(".compare-tab"),
];
const columns = (document: Document, at: number): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>(`[data-compare-column="${at}"]`),
];

test("every record header and cell names its column, and the tab row starts hidden", () => {
  const out = html();
  assert.match(out, /class="compare-tabs" role="tablist" aria-label="Records" data-compare-tabs hidden/);
  assert.equal((out.match(/data-compare-column="0"/g) ?? []).length, 3, "one header and two page cells");
  assert.equal((out.match(/data-compare-column="2"/g) ?? []).length, 3);
  assert.doesNotMatch(out, /class="compare-tab"/, "no dead tab renders without the island");
});

test("a narrow container draws one tab per record and shows the first record only", () => {
  const document = docOf();
  activate(document as unknown as CompareDocument, envOf(NARROW_WIDTH - 1));

  assert.equal(tabs(document).hidden, false);
  assert.deepEqual(buttons(document).map((button) => button.textContent), ["Alpha", "Beta", "Gamma"]);
  assert.equal(buttons(document)[0]!.getAttribute("aria-selected"), "true");
  assert.equal(buttons(document)[1]!.getAttribute("aria-selected"), "false");
  assert.equal(buttons(document)[0]!.getAttribute("tabindex"), "0");
  assert.equal(buttons(document)[1]!.getAttribute("tabindex"), "-1");
  assert.ok(columns(document, 0).every((cell) => !cell.hidden));
  assert.ok(columns(document, 1).every((cell) => cell.hidden));
  assert.ok(columns(document, 2).every((cell) => cell.hidden));
  assert.ok(root(document).hasAttribute(NARROW_ATTRIBUTE));
});

test("choosing a tab shows its record and hides the others", () => {
  const document = docOf();
  activate(document as unknown as CompareDocument, envOf(NARROW_WIDTH - 1));

  buttons(document)[2]!.click();
  assert.equal(buttons(document)[2]!.getAttribute("aria-selected"), "true");
  assert.equal(buttons(document)[0]!.getAttribute("aria-selected"), "false");
  assert.ok(columns(document, 2).every((cell) => !cell.hidden));
  assert.ok(columns(document, 0).every((cell) => cell.hidden));
  assert.ok(columns(document, 1).every((cell) => cell.hidden));
});

test("the arrow keys walk the tabs and move focus with the choice", () => {
  const document = docOf();
  activate(document as unknown as CompareDocument, envOf(NARROW_WIDTH - 1));

  buttons(document)[0]!.dispatchEvent(new (document.defaultView as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent(
    "keydown",
    { key: "ArrowRight", bubbles: true },
  ));
  assert.equal(buttons(document)[1]!.getAttribute("aria-selected"), "true");
  assert.equal(document.activeElement, buttons(document)[1]);

  buttons(document)[1]!.dispatchEvent(new (document.defaultView as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent(
    "keydown",
    { key: "ArrowLeft", bubbles: true },
  ));
  assert.equal(buttons(document)[0]!.getAttribute("aria-selected"), "true");

  buttons(document)[0]!.dispatchEvent(new (document.defaultView as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent(
    "keydown",
    { key: "End", bubbles: true },
  ));
  assert.equal(buttons(document)[2]!.getAttribute("aria-selected"), "true");
  assert.ok(columns(document, 2).every((cell) => !cell.hidden));
});

test("a wide container keeps the full table and hides the tabs", () => {
  const document = docOf();
  activate(document as unknown as CompareDocument, envOf(1200));

  assert.equal(tabs(document).hidden, true);
  assert.equal(root(document).hasAttribute(NARROW_ATTRIBUTE), false);
  for (const at of [0, 1, 2]) {
    assert.ok(columns(document, at).every((cell) => !cell.hidden), `column ${at} stays in the table`);
  }
});

test("a resize toggles the narrow form and keeps the chosen record", () => {
  const document = docOf();
  let width = 1200;
  let resize: (() => void) | undefined;
  activate(
    document as unknown as CompareDocument,
    envOf(
      () => width,
      (_root, update) => {
        resize = update;
        return () => {};
      },
    ),
  );
  assert.equal(resize !== undefined, true, "the island watches the container");
  assert.equal(tabs(document).hidden, true);

  width = 400;
  resize!();
  assert.equal(tabs(document).hidden, false);
  buttons(document)[1]!.click();
  assert.ok(columns(document, 1).every((cell) => !cell.hidden));

  width = 1200;
  resize!();
  assert.equal(tabs(document).hidden, true);
  assert.ok(columns(document, 0).every((cell) => !cell.hidden));
  assert.ok(columns(document, 1).every((cell) => !cell.hidden));
  assert.equal(buttons(document)[1]!.getAttribute("aria-selected"), "true", "the choice survives the resize");
});

test("one record needs no tabs, even in a narrow container", () => {
  const document = docOf("a");
  activate(document as unknown as CompareDocument, envOf(300));

  assert.equal(tabs(document).hidden, true);
  assert.equal(buttons(document).length, 0);
  assert.ok(columns(document, 0).every((cell) => !cell.hidden));
});
