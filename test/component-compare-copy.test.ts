// The copy button is written hidden and revealed by the island. It copies the visible rows as a
// Markdown table with the record pages under it; a differences-only view copies only the differences.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import compare from "../components/compare/index.ts";
import {
  activate,
  type Clipboard,
  type CompareDocument,
  type CompareEnv,
} from "../components/compare/client.ts";
import { dataRecord } from "./helpers/record.ts";

const record = (id: string, fields: Record<string, unknown>): DataRecord => dataRecord({ id, fields });

const books = [
  record("a", { title: "Alpha", pages: 120, draft: false }),
  record("c", { title: "Gamma", pages: 120, draft: true }),
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
  { field: "draft", label: "Draft", kind: "boolean" },
]);

function html(): string {
  const input = { props: { from: "books", ids: "a,c", fields }, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(compare(input) as never);
}

function envOf(search: string, writes: string[]): CompareEnv {
  const clipboard: Clipboard = {
    writeText(text: string) {
      writes.push(text);
      return Promise.resolve();
    },
  };
  return {
    search: () => search,
    hash: () => "",
    replaceUrl: () => {},
    clipboard,
    url: () => "https://example.com/books/",
  };
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

test("the copy button is written hidden, so no control shows before the island runs", () => {
  const out = html();
  assert.match(out, /<button type="button" class="compare-copy" data-compare-copy hidden>Copy comparison as Markdown<\/button>/);
  assert.match(out, /<span class="compare-copy-status" role="status"/);
});

test("the island reveals the button and copies the visible rows with their page addresses", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html()}</body></html>`);
  const document = dom.window.document;
  const writes: string[] = [];
  activate(document as unknown as CompareDocument, envOf("", writes));

  const button = document.querySelector(".compare-copy") as HTMLButtonElement;
  assert.equal(button.hidden, false, "the island reveals the button");
  button.click();
  await tick();

  assert.deepEqual(writes, [
    [
      "|  | Alpha | Gamma |",
      "| --- | --- | --- |",
      "| Pages | 120 | 120 |",
      "| Draft | No | Yes |",
      "",
      "- [Alpha](https://example.com/books/a/)",
      "- [Gamma](https://example.com/books/c/)",
    ].join("\n"),
  ]);
  assert.equal(document.querySelector(".compare-copy-status")!.textContent, "Copied");
});

test("a differences-only view copies only the visible rows", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html()}</body></html>`);
  const document = dom.window.document;
  const writes: string[] = [];
  activate(document as unknown as CompareDocument, envOf("?compare=diff", writes));

  (document.querySelector(".compare-copy") as HTMLButtonElement).click();
  await tick();

  const copied = writes[0] ?? "";
  assert.match(copied, /\|\s*Draft\s*\|\s*No\s*\|\s*Yes\s*\|/);
  assert.doesNotMatch(copied, /Pages/, "the equal row stays out of the copy");
  assert.match(copied, /^- \[Alpha\]\(https:\/\/example\.com\/books\/a\/\)$/m);
});

test("a refused clipboard reports the failure instead of claiming a copy", async () => {
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html()}</body></html>`);
  const document = dom.window.document;
  const env = envOf("", []);
  activate(document as unknown as CompareDocument, {
    ...env,
    clipboard: { writeText: () => Promise.reject(new Error("denied")) },
  });

  (document.querySelector(".compare-copy") as HTMLButtonElement).click();
  await tick();

  assert.equal(
    document.querySelector(".compare-copy-status")!.textContent,
    "Copy failed. Select the text and copy it by hand.",
  );
});
