// Island teardown: the AbortSignal contract (issue #842).
//
// Inventory of browser listeners and their lifecycle, island by island. Every entry that wires a
// host the reader can leave (a dialog, a mount a fixture can repeat) carries one `AbortSignal`, so
// one abort detaches the whole wiring; islands whose listeners live on nodes they created die with
// those nodes and need none.
//
// Island                      Listeners                                Lifecycle
// chrome/search               button/close/clear/retry click, input,   activation returns a teardown;
//                             dialog click/close/keydown, popstate-less  abort + guarded continuations
//                             (see chrome-search.test.ts)                (WeakMap prevents a double wire)
// chrome/drawer               button/close click, dialog close/click/  `env.signal` aborts the wiring
//                             keydown, link click, viewport change
// chrome/copy-markdown        button click, document keydown           `env.signal` aborts the wiring
// chrome/code-copy            created button clicks, window hashchange listeners live on created nodes;
//                             (module scope)                           the hashchange mark lives for the page
// chrome/block-actions        created button clicks                    listeners live on created nodes
// chrome/ask-agent            panel button/link listeners              listeners live on the panel it builds
// chrome/toc                  IntersectionObserver only                `scrollspy()` returns a stop function
// components/data-explorer    input, keydown, filter change, more      `activate()` returns a teardown
//                             click, popstate                          (one abort per mount)
// components/gallery-filters  filter/clear/sort click, popstate        `activate()` returns a teardown
// components/record-table     button click, text/select/clear,         `activate()` returns a teardown
//                             popstate
// components/compare          toggle change, copy click, picker        `activate()` returns a teardown;
//                             button click                             `env.signal` covers the pickers
// components/tabs             tab click, list keydown (per group),     listeners live on the page's groups;
//                             window hashchange (module scope)         the boot guard keeps it once-only
// components/variables-form   input, reset click                       listeners live on the page's forms
//
// These tests prove the contract: after a teardown, no listener fires; a mount after a teardown
// leaves exactly one active listener where a duplicate would fire twice.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import dataExplorer from "../components/data-explorer/index.ts";
import { activate as activateExplorer, DEBOUNCE_MS, type ExplorerDocument, type ExplorerEnv } from "../components/data-explorer/client.ts";
import { activate as activateGallery, type GalleryDocument } from "../components/gallery-filters/island.ts";
import { activate as activateTable, type SortDocument } from "../components/record-table/client.ts";
import { activate as activateCompare, type CompareDocument, type CompareEnv } from "../components/compare/client.ts";
import { activate as activateDrawer, type DrawerControl, type DrawerDialog, type DrawerEnv } from "../chrome/drawer/client.ts";
import { activate as activateCopyMarkdown, type ActivateEnv, type CopyButton, type CopyStatus, type ShortcutHost } from "../chrome/copy-markdown/island.ts";
import { activate as activateCodeCopy, type CopyDocument } from "../chrome/code-copy/client.ts";

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

/** One abortable island leaves exactly one listener on a remount, and none after its teardown. */

// ---------------------------------------------------------------------------
// components/data-explorer
// ---------------------------------------------------------------------------

const record = (id: string, fields: Record<string, unknown>): DataRecord =>
  ({ id, fields, position: { line: 1, column: 1 }, fieldPositions: {} }) as unknown as DataRecord;

const books = Array.from({ length: 60 }, (_, index) => record(`b${index}`, { title: `Book ${index}`, pages: index }));

const explorerSite = {
  config: { base: "" },
  nav: {},
  data: {},
  pages: books.map((book) => ({ url: `/books/${book.id}/`, record: { collection: "books", id: book.id } })),
  collections: { books: { name: "books", source: "books.yml", records: books } },
} as unknown as Site;

const explorerPage = { lang: "en", url: "/books/", frontMatter: {} } as unknown as Page;

const indexJson = JSON.stringify({
  collection: "books",
  columns: ["title", "pages", "url"],
  rows: books.map((book, at) => [book.fields.title, at, `/books/${book.id}/`]),
});

/** The server-rendered explorer, a fake fetch that records its calls, and a hand-run debounce clock. */
function explorerSetup() {
  const input = { props: { from: "books", columns: "title,pages" }, page: explorerPage, site: explorerSite, html: "" } as unknown as ComponentProps;
  const html = renderToString(dataExplorer(input) as never);
  const dom = new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`, {
    url: "https://example.com/books/",
  });
  const document = dom.window.document;

  let pending: (() => void) | undefined;
  let scheduled = 0;
  const fetched: string[] = [];
  const env: ExplorerEnv = {
    async fetchText(url) {
      fetched.push(url);
      if (url !== "/data/books.index.json") throw new Error(`no file at ${url}`);
      return indexJson;
    },
    schedule(listener, ms) {
      assert.equal(ms, DEBOUNCE_MS);
      scheduled += 1;
      pending = listener;
      return scheduled;
    },
    cancel() {
      pending = undefined;
    },
  };

  const flush = (): void => {
    const run = pending;
    pending = undefined;
    if (run === undefined) return; // after a teardown nothing listens, so nothing waits
    run();
  };

  const search = async (text: string): Promise<void> => {
    const query = document.querySelector(".data-explorer-input") as HTMLInputElement;
    query.focus();
    query.value = text;
    query.dispatchEvent(new dom.window.Event("input"));
    flush();
    await tick();
    await tick();
  };

  return { dom, document, env, fetched, scheduled: () => scheduled, activate: () => activateExplorer(document as unknown as ExplorerDocument, env), search, flush };
}

test("a torn-down explorer runs no query and loads no index", async () => {
  const fixture = explorerSetup();
  const teardown = fixture.activate();
  teardown();

  await fixture.search("book 5");

  assert.deepEqual(fixture.fetched, [], "the index is never fetched after teardown");
  assert.equal(fixture.scheduled(), 0, "no debounce is scheduled after teardown");
  assert.equal(fixture.document.querySelectorAll("tbody tr").length, 50, "the static rows stay as they were");
});

test("a mount after a teardown leaves exactly one wiring, not a duplicate", async () => {
  const fixture = explorerSetup();
  fixture.activate()();
  fixture.activate();

  await fixture.search("book 5");

  assert.equal(fixture.scheduled(), 1, "one input event schedules one debounce");
  assert.deepEqual([...new Set(fixture.fetched)], ["/data/books.index.json"], "only the index is read");
  assert.equal(fixture.document.querySelectorAll("tbody tr").length, 11);
});

test("a query still in the debounce when the explorer is torn down never runs", async () => {
  const fixture = explorerSetup();
  const teardown = fixture.activate();
  const query = fixture.document.querySelector(".data-explorer-input") as HTMLInputElement;
  query.value = "book 5";
  query.dispatchEvent(new fixture.dom.window.Event("input"));
  assert.equal(fixture.scheduled(), 1, "the input is waiting in the debounce");

  teardown();
  fixture.flush();
  await tick();

  assert.deepEqual(fixture.fetched, [], "the pending query fetches no index after teardown");
  assert.equal(fixture.document.querySelectorAll("tbody tr").length, 50, "the static rows stay as they were");
});

// ---------------------------------------------------------------------------
// components/gallery-filters
// ---------------------------------------------------------------------------

const galleryPage = `<html lang="en"><body>
<div data-gallery>
  <nav class="gallery-facets" aria-label="Filters">
    <a class="gallery-filter-value" data-gallery-filter="status" data-gallery-value="done" href="/gallery/?filter.status=done">done (1)</a>
    <a class="gallery-filter-value" data-gallery-filter="status" data-gallery-value="draft" href="/gallery/?filter.status=draft">draft (1)</a>
  </nav>
  <p class="gallery-count" role="status" data-gallery-count="Showing {n} of {total}">Showing 2 of 2</p>
  <div class="cards">
    <div data-gallery-item data-gallery-values='{"status":["done"]}'><a class="card" href="/books/beta/">Beta</a></div>
    <div data-gallery-item data-gallery-values='{"status":["draft"]}'><a class="card" href="/books/alpha/">Alpha</a></div>
  </div>
</div>
</body></html>`;

const galleryShown = (document: GalleryDocument): number =>
  [...document.querySelectorAll("[data-gallery-item]")].filter((item) => !item.hidden).length;

test("a torn-down gallery keeps its cards and its address untouched", () => {
  const dom = new JSDOM(galleryPage, { url: "http://localhost/gallery/" });
  const document = dom.window.document as unknown as GalleryDocument;
  activateGallery(document)();

  const link = document.querySelector('[data-gallery-value="done"]') as unknown as HTMLElement;
  link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));

  assert.equal(dom.window.location.search, "", "the address is not rewritten after teardown");
  assert.equal(galleryShown(document), 2, "no card is hidden after teardown");
});

test("a gallery mounted after a teardown filters once, not twice", () => {
  const dom = new JSDOM(galleryPage, { url: "http://localhost/gallery/" });
  const document = dom.window.document as unknown as GalleryDocument;
  activateGallery(document)();
  activateGallery(document);

  const link = document.querySelector('[data-gallery-value="done"]') as unknown as HTMLElement;
  link.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));

  assert.equal(dom.window.location.search, "?filter.status=done");
  assert.equal(galleryShown(document), 1);
});

// ---------------------------------------------------------------------------
// components/record-table
// ---------------------------------------------------------------------------

const tablePage = `<html lang="en"><body>
<div data-record-table-sort data-sort-ascending="Sorted by {column}, ascending." data-sort-descending="Sorted by {column}, descending.">
  <table>
    <thead><tr>
      <th data-field="title" data-kind="text" data-label="Title" aria-sort="none">
        <button class="record-table-sort" hidden>Title</button>
      </th>
      <th data-field="pages" data-kind="number" data-label="Pages" aria-sort="none">
        <button class="record-table-sort" hidden>Pages</button>
      </th>
    </tr></thead>
    <tbody>
      <tr><td class="record-table-cell" data-value="Beta">Beta</td><td class="record-table-cell" data-value="30">30</td></tr>
      <tr><td class="record-table-cell" data-value="Alpha">Alpha</td><td class="record-table-cell" data-value="5">5</td></tr>
    </tbody>
  </table>
  <p class="record-table-status" role="status"></p>
</div>
</body></html>`;

const tableOrder = (dom: JSDOM): string[] =>
  [...dom.window.document.querySelectorAll("tbody tr td:first-child")].map((cell) => cell.textContent ?? "");

test("a torn-down table sorts nothing and announces nothing", () => {
  const dom = new JSDOM(tablePage, { url: "http://localhost/records/" });
  activateTable(dom.window.document as unknown as SortDocument)();

  const button = dom.window.document.querySelector(".record-table-sort") as unknown as HTMLElement;
  button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));

  assert.deepEqual(tableOrder(dom), ["Beta", "Alpha"], "the rows keep the order the server sent");
  assert.equal(dom.window.document.querySelector(".record-table-status")?.textContent, "", "no announcement after teardown");
});

test("a table mounted after a teardown sorts once and announces once", () => {
  const dom = new JSDOM(tablePage, { url: "http://localhost/records/" });
  const document = dom.window.document as unknown as SortDocument;
  activateTable(document)();
  activateTable(document);

  const button = dom.window.document.querySelector(".record-table-sort") as unknown as HTMLElement;
  button.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true, cancelable: true }));

  assert.deepEqual(tableOrder(dom), ["Alpha", "Beta"]);
  assert.equal(dom.window.document.querySelectorAll("th[aria-sort='ascending']").length, 1);
  assert.match(dom.window.document.querySelector(".record-table-status")?.textContent ?? "", /Title/);
});

// ---------------------------------------------------------------------------
// components/compare
// ---------------------------------------------------------------------------

const comparePage = `<html lang="en"><body>
<div data-compare data-lang="en">
  <div data-compare-controls hidden>
    <label><input type="checkbox" data-compare-only-diff> Only differences</label>
    <button data-compare-copy hidden>Copy</button>
  </div>
  <p class="compare-status" role="status"></p>
  <table><tbody>
    <tr data-compare-row><th scope="row">title</th><td data-compare-column="0">same</td></tr>
    <tr data-compare-row><th scope="row">pages</th><td data-compare-column="0">3</td></tr>
  </tbody></table>
</div>
</body></html>`;

function compareSetup(signal?: AbortSignal) {
  const dom = new JSDOM(comparePage, { url: "http://localhost/compare/" });
  const document = dom.window.document as unknown as CompareDocument;
  const written: string[] = [];
  const env: CompareEnv = {
    search: () => dom.window.location.search,
    hash: () => "",
    replaceUrl: (url) => written.push(url),
    ...(signal === undefined ? {} : { signal }),
  };
  return { dom, document, env, written };
}

const compareVisible = (document: CompareDocument): number =>
  [...document.querySelectorAll("[data-compare-row]")].filter((row) => !row.hidden).length;

test("a torn-down comparison never rewrites the address or hides rows", () => {
  const fixture = compareSetup();
  activateCompare(fixture.document, fixture.env)();

  const toggle = fixture.document.querySelector("[data-compare-only-diff]") as unknown as HTMLInputElement;
  toggle.checked = true;
  toggle.dispatchEvent(new fixture.dom.window.Event("change", { bubbles: true }));

  assert.deepEqual(fixture.written, [], "the address is not rewritten after teardown");
  assert.equal(compareVisible(fixture.document), 2, "no row is hidden after teardown");
});

test("a comparison mounted after a teardown applies the toggle exactly once", () => {
  const fixture = compareSetup();
  activateCompare(fixture.document, fixture.env)();
  activateCompare(fixture.document, fixture.env);

  const toggle = fixture.document.querySelector("[data-compare-only-diff]") as unknown as HTMLInputElement;
  toggle.checked = true;
  toggle.dispatchEvent(new fixture.dom.window.Event("change", { bubbles: true }));

  assert.equal(compareVisible(fixture.document), 0, "the rows without a difference are hidden once");
  assert.deepEqual(fixture.written, ["?compare=diff"]);
});

// ---------------------------------------------------------------------------
// chrome/drawer
// ---------------------------------------------------------------------------

/** An EventTarget-shaped fake whose listeners detach when the options' signal aborts. */
function signalTarget() {
  const wired: Array<{ type: string; listener: (event?: unknown) => void }> = [];
  return {
    wired,
    addEventListener(type: string, listener: (event?: unknown) => void, options?: { signal?: AbortSignal }): void {
      const entry = { type, listener };
      wired.push(entry);
      options?.signal?.addEventListener("abort", () => {
        const at = wired.indexOf(entry);
        if (at !== -1) wired.splice(at, 1);
      });
    },
    fire(type: string, event?: unknown): void {
      for (const entry of [...wired]) if (entry.type === type) entry.listener(event);
    },
    count(type: string): number {
      return wired.filter((entry) => entry.type === type).length;
    },
  };
}

test("aborting the drawer's signal detaches every listener at once", () => {
  const controller = new AbortController();
  const button = {
    hidden: true,
    expanded: "",
    focus() {},
    setAttribute(name: string, value: string) {
      if (name === "aria-expanded") button.expanded = value;
    },
  };
  const buttonTarget = signalTarget();
  const clickButton = {
    ...button,
    addEventListener: buttonTarget.addEventListener,
  };
  const dialogTarget = signalTarget();
  const state = { open: false };
  const dialog = {
    get open() {
      return state.open;
    },
    setAttribute() {},
    showModal() {
      state.open = true;
    },
    close() {
      state.open = false;
      dialogTarget.fire("close");
    },
    querySelectorAll() {
      return [];
    },
    addEventListener: dialogTarget.addEventListener,
  } as unknown as DrawerDialog;

  const env: DrawerEnv = { signal: controller.signal };
  activateDrawer(
    { dialog, button: clickButton as unknown as DrawerControl },
    env,
  );

  assert.equal(buttonTarget.count("click"), 1);
  buttonTarget.fire("click");
  assert.equal(dialog.open, true, "the wiring opens the drawer before the abort");

  controller.abort();
  dialog.close();
  buttonTarget.fire("click");
  assert.equal(dialog.open, false, "the aborted wiring opens nothing");
  assert.equal(buttonTarget.count("click"), 0, "the abort detached the listener");
  assert.equal(dialogTarget.count("keydown"), 0, "the abort detached the dialog's wiring");
});

// ---------------------------------------------------------------------------
// chrome/copy-markdown
// ---------------------------------------------------------------------------

test("aborting the copy island's signal detaches the click and the m key", async () => {
  const controller = new AbortController();
  const buttonTarget = signalTarget();
  const button = {
    hidden: true,
    dataset: { markdown: "/index.md", copied: "Copied", copyFailed: "Copy failed" },
    click() {
      buttonTarget.fire("click");
    },
    addEventListener: buttonTarget.addEventListener,
  } as unknown as CopyButton;
  const keysTarget = signalTarget();
  const keys = { addEventListener: keysTarget.addEventListener.bind(keysTarget) } as unknown as ShortcutHost;
  const status: CopyStatus = { textContent: "" };
  const fetched: string[] = [];
  const env: ActivateEnv = {
    status,
    keys,
    signal: controller.signal,
    clipboard: { writeText: () => Promise.resolve() },
    fetchText: (url: string) => {
      fetched.push(url);
      return Promise.resolve("# Page\n");
    },
  };

  activateCopyMarkdown(button, env);
  assert.equal(button.hidden, false);

  controller.abort();
  button.click();
  keysTarget.fire("keydown", { key: "m", preventDefault() {} });
  await tick();

  assert.deepEqual(fetched, [], "nothing is fetched after the abort");
  assert.equal(status.textContent, "", "nothing is announced after the abort");
  assert.equal(buttonTarget.count("click"), 0);
  assert.equal(keysTarget.count("keydown"), 0);
});

// ---------------------------------------------------------------------------
// chrome/code-copy
// ---------------------------------------------------------------------------

test("tearing down the code-copy island cancels a pending status reset", async () => {
  const dom = new JSDOM('<html lang="en"><body><pre class="code" data-lang="ts"><code>const a = 1;</code></pre></body></html>');
  const page = dom.window.document;
  const document = page as unknown as CopyDocument;

  let runs = 0;
  const pending = new Set<{ callback: () => void }>();
  const teardown = activateCodeCopy(document, {
    clipboard: { writeText: () => Promise.resolve() },
    schedule(callback) {
      const handle = {
        callback: () => {
          runs += 1;
          callback();
        },
      };
      pending.add(handle);
      return handle;
    },
    cancel(handle) {
      pending.delete(handle as { callback: () => void });
    },
  });

  const button = page.querySelector(".code-copy") as HTMLButtonElement;
  const status = page.querySelector(".code-copy-status") as HTMLElement;
  button.click();
  await tick();
  assert.equal(status.textContent, "Copied", "the result is on screen before the teardown");
  assert.equal(pending.size, 1, "one reset is waiting on the fake clock");

  teardown();
  for (const handle of [...pending]) handle.callback();

  assert.equal(pending.size, 0, "the teardown cancelled the pending reset");
  assert.equal(runs, 0, "no reset callback runs after the teardown");
  assert.equal(status.textContent, "", "the control is back at rest");
});
