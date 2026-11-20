// The record history island improves the plain filter links: it hides other fields' events in place,
// keeps the count in the page's language, and writes the choice into the address.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ChangeEvent, ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import recordHistory from "../components/record-history/index.ts";
import { activate, type HistoryDocument } from "../components/record-history/island.ts";

const event = (over: Partial<ChangeEvent> = {}): ChangeEvent =>
  ({ id: "a".repeat(16), type: "added", record: "dated", date: "2026-05-01", ...over }) as ChangeEvent;

const EVENTS = [
  event({ id: "1".repeat(16), type: "changed", field: "status", old: "beta", new: "stable", date: "2026-05-15" }),
  event({ id: "2".repeat(16), type: "changed", field: "status", old: "alpha", new: "beta", date: "2026-05-10" }),
  event({ id: "3".repeat(16), type: "changed", field: "title", old: "A", new: "B", date: "2026-05-05" }),
];

function page(html: string, lang = "en", search = ""): Document {
  const url = `https://example.test/books/a/${search}`;
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body>${html}</body></html>`, { url });
  activate(dom.window.document as unknown as HistoryDocument);
  return dom.window.document;
}

function render(events: ChangeEvent[] = EVENTS, lang = "en"): string {
  const input = {
    props: { changes: events },
    page: { lang, title: "Dated item", frontMatter: {} } as unknown as Page,
    site: { config: { base: "", theme: { options: {} } }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site,
    html: "",
  } as unknown as ComponentProps;
  return renderToString(recordHistory(input) as never);
}

const visible = (doc: Document): string[] =>
  [...doc.querySelectorAll("[data-history-event]")]
    .filter((item) => !(item as HTMLElement).hidden)
    .map((item) => item.getAttribute("data-history-field") ?? "");

test("every event shows before a field is chosen", () => {
  const doc = page(render());
  assert.deepEqual(visible(doc), ["status", "status", "title"]);
  assert.equal(doc.querySelector(".record-history-count")?.textContent, "3 events");
  assert.equal(doc.querySelector('.record-history-filter[aria-current="true"]')?.textContent, "All fields");
});

test("choosing a field shows only its events, keeps their order, and writes the address", () => {
  const doc = page(render());
  const status = [...doc.querySelectorAll(".record-history-filter")].find((link) => link.textContent === "status");
  assert.ok(status instanceof doc.defaultView!.HTMLAnchorElement);

  status.click();

  assert.deepEqual(visible(doc), ["status", "status"]);
  assert.equal(doc.querySelector(".record-history-count")?.textContent, "2 events");
  assert.equal(status.getAttribute("aria-current"), "true");
  assert.match(doc.defaultView!.location.search, /history-field=status/);
});

test("a shared address opens the same field, and an unknown one falls back to all", () => {
  const status = page(render(), "en", "?history-field=status");
  assert.deepEqual(visible(status), ["status", "status"]);

  const unknown = page(render(), "en", "?history-field=nope");
  assert.deepEqual(visible(unknown), ["status", "status", "title"]);
});

test("the count follows the page language's digits and label", () => {
  const doc = page(render(EVENTS, "fa"), "fa", "?history-field=title");
  assert.deepEqual(visible(doc), ["title"]);
  assert.match(doc.querySelector(".record-history-count")?.textContent ?? "", /۱/);
  assert.match(doc.querySelector(".record-history-count")?.textContent ?? "", /رویداد/);
});

test("the filter links stay real links without the island", () => {
  const doc = new JSDOM(`<!doctype html><html lang="en"><body>${render()}</body></html>`).window.document;
  const links = [...doc.querySelectorAll(".record-history-filter")] as HTMLAnchorElement[];
  assert.equal(links.length, 3);
  for (const link of links) assert.match(link.getAttribute("href") ?? "", /^\?history-field=/);
  assert.equal(doc.querySelectorAll('[aria-current="true"]').length, 0);
});
