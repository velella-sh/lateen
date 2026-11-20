import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { activate, type GalleryDocument } from "../components/gallery-filters/island.ts";

const page = `<html lang="en"><body>
<div data-gallery>
  <div class="gallery-filters">
    <nav class="gallery-facets" aria-label="Filters">
      <a class="gallery-filter-value" data-gallery-filter="status" data-gallery-value="done" href="/gallery/?filter.status=done">done (1)</a>
      <a class="gallery-filter-value" data-gallery-filter="status" data-gallery-value="draft" href="/gallery/?filter.status=draft">draft (1)</a>
      <a class="gallery-filter-value" data-gallery-filter="topic" data-gallery-value="api" href="/gallery/?filter.topic=api">api (1)</a>
      <form class="gallery-filter-reset" method="get" action="/gallery/">
        <input type="hidden" name="sort" value="title">
        <input type="hidden" name="order" value="asc">
        <button class="gallery-filter-clear" type="submit" data-gallery-clear>Clear filters</button>
      </form>
    </nav>
    <nav class="gallery-sort" aria-label="Sort by" data-sort-label="Sort by {column}" data-sort-ascending="Sorted by {column}, ascending." data-sort-descending="Sorted by {column}, descending.">
      <a class="gallery-sort-link" data-gallery-sort="title" data-order="asc" href="/gallery/?sort=title&amp;order=asc" aria-label="Sorted by title, ascending.">title</a>
    </nav>
  </div>
  <p class="gallery-count" role="status" aria-live="polite" tabindex="-1" data-gallery-count="Showing {n} of {total}">Showing 2 of 2</p>
  <p class="gallery-empty" tabindex="-1" hidden>No records match these filters.</p>
  <div class="cards">
    <div data-gallery-item data-gallery-values='{"status":["done"],"topic":["api"],"title":["Beta"]}'><a class="card" href="/books/beta/">Beta</a></div>
    <div data-gallery-item data-gallery-values='{"status":["draft"],"topic":["web"],"title":["Alpha"]}'><a class="card" href="/books/alpha/">Alpha</a></div>
  </div>
</div>
</body></html>`;

function open(url = "http://localhost/gallery/") {
  const dom = new JSDOM(page, { url });
  const document = dom.window.document as unknown as GalleryDocument;
  activate(document);
  return { dom, document, window: dom.window };
}

const shown = (document: GalleryDocument): string[] =>
  [...document.querySelectorAll("[data-gallery-item]")]
    .filter((item) => !item.hidden)
    .map((item) => item.querySelector("a.card")?.getAttribute("href") ?? "");

const count = (document: GalleryDocument): string =>
  document.querySelector(".gallery-count")?.textContent ?? "";

test("a shared address opens the same filtered cards", () => {
  const { document } = open("http://localhost/gallery/?filter.status=draft");
  assert.deepEqual(shown(document), ["/books/alpha/"]);
  assert.equal(count(document), "Showing 1 of 2");
  assert.equal(document.querySelector('[data-gallery-value="draft"]')?.getAttribute("aria-current"), "true");
  assert.equal(document.querySelector('[data-gallery-value="done"]')?.getAttribute("aria-current"), null);
});

test("a filter link filters in place, replaces the address, and moves focus to the first card", () => {
  const { document, window } = open();
  const before = window.history.length;
  const link = document.querySelector('[data-gallery-value="done"]') as unknown as HTMLElement;
  link.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(window.location.search, "?filter.status=done");
  assert.equal(window.history.length, before, "the island replaces the address, never pushes");
  assert.deepEqual(shown(document), ["/books/beta/"]);
  assert.equal(window.document.activeElement?.getAttribute("href"), "/books/beta/");
  assert.equal(document.querySelector(".gallery-empty")?.hidden, true);
});

test("back and forward restore the cards and move focus to the count", () => {
  const { document, window } = open();
  const done = document.querySelector('[data-gallery-value="done"]') as unknown as HTMLElement;
  done.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

  window.history.pushState({}, "", "/gallery/?filter.status=draft");
  window.dispatchEvent(new window.PopStateEvent("popstate"));
  assert.deepEqual(shown(document), ["/books/alpha/"]);
  assert.equal(count(document), "Showing 1 of 2");
  assert.equal(window.document.activeElement, window.document.querySelector(".gallery-count"));
});

test("a sort link orders the grid and records the direction in the address", () => {
  const { document, window } = open();
  const sort = document.querySelector('[data-gallery-sort="title"]') as unknown as HTMLElement;
  sort.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(window.location.search, "?sort=title&order=desc");
  assert.deepEqual(shown(document), ["/books/beta/", "/books/alpha/"]);
  assert.equal(document.querySelector('[data-gallery-sort="title"]')?.getAttribute("aria-current"), "true");
  assert.equal(document.querySelector('[data-gallery-sort="title"]')?.getAttribute("data-order"), "desc");
  assert.equal(document.querySelector('[data-gallery-sort="title"]')?.getAttribute("aria-label"), "Sorted by title, descending.");
});

test("the reset button clears every filter, keeps the sort, and moves focus to the first filter control", () => {
  const { document, window } = open("http://localhost/gallery/?filter.status=done&filter.topic=api&sort=title&order=desc");
  assert.deepEqual(shown(document), ["/books/beta/"]);
  const reset = document.querySelector("[data-gallery-clear]") as unknown as HTMLElement;
  assert.equal(reset.hidden, false);
  reset.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  assert.equal(window.location.search, "?sort=title&order=desc");
  assert.deepEqual(shown(document), ["/books/beta/", "/books/alpha/"]);
  assert.equal(document.querySelector(".gallery-empty")?.hidden, true);
  assert.equal(reset.hidden, true, "the reset hides once no filter is active");
  assert.equal(window.document.activeElement, document.querySelector('[data-gallery-filter="status"]'));
});

test("clearing filters announces the new count once", () => {
  const { document, window } = open("http://localhost/gallery/?filter.status=done&filter.topic=api");
  const status = window.document.querySelector(".gallery-count") as Node;
  const observer = new window.MutationObserver(() => {});
  observer.observe(status, { childList: true, characterData: true, subtree: true });
  const reset = document.querySelector("[data-gallery-clear]") as unknown as HTMLElement;
  reset.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
  const records = observer.takeRecords();
  observer.disconnect();
  assert.equal(records.length, 1);
  assert.equal([...document.querySelectorAll('[role="status"], [aria-live]')].length, 1);
  assert.equal(count(document), "Showing 2 of 2");
});

test("no card matches: the empty note shows, the count says zero, and focus lands on the note", () => {
  const { document, window } = open();
  window.history.replaceState({}, "", "/gallery/?filter.status=missing");
  window.dispatchEvent(new window.PopStateEvent("popstate"));
  assert.deepEqual(shown(document), []);
  assert.equal(count(document), "Showing 0 of 2");
  assert.equal(document.querySelector(".gallery-empty")?.hidden, false);
  assert.equal(window.document.activeElement, window.document.querySelector(".gallery-count"));
});

test("an unknown filter and sort are ignored without an error", () => {
  const { document } = open("http://localhost/gallery/?filter.nope=x&sort=nope&order=sideways");
  assert.deepEqual(shown(document), ["/books/alpha/", "/books/beta/"]);
  assert.equal(count(document), "Showing 2 of 2");
});
