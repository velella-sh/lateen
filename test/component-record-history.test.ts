// The record history renders every event type the engine writes, keeps the newest events in view,
// and puts the rest behind a native disclosure. A record with no event keeps the page unchanged.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ChangeEvent, ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import recordHistory, {
  CLASS,
  DEFAULT_LIMIT,
  DETAILS_CLASS,
  LIST_CLASS,
} from "../components/record-history/index.ts";

function render(changes: ChangeEvent[], lang = "en", options: Record<string, unknown> = {}): string {
  const page = { lang, title: "Dated item", frontMatter: {} } as unknown as Page;
  const site = { config: { base: "", theme: { options } }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;
  return renderToString(recordHistory({ props: { changes }, page, site, html: "" } as unknown as ComponentProps) as never);
}

const document = (html: string): Document => new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`).window.document;

const event = (over: Partial<ChangeEvent> = {}): ChangeEvent =>
  ({ id: "a".repeat(16), type: "added", record: "dated", date: "2026-05-01", ...over }) as ChangeEvent;

test("the count label stays a template so the island can fill the filtered count", () => {
  const html = render([event()]);
  const count = document(html).querySelector("[data-history-count]");
  assert.equal(count?.getAttribute("data-history-label"), "{count} events");
  assert.equal(count?.textContent, "1 events");
});

test("each event type reads as what happened", () => {
  const events = [
    event({ id: "1".repeat(16), type: "changed", field: "status", old: "beta", new: "stable", date: "2026-05-15" }),
    event({ id: "2".repeat(16), type: "renamed", from: "old-dated", date: "2026-05-10" }),
    event({ id: "3".repeat(16), type: "imported", count: 3, date: "2026-05-05" }),
    event({ id: "4".repeat(16), type: "removed", date: "2026-05-03" }),
    event({ id: "5".repeat(16), type: "added", date: "2026-05-01" }),
  ];
  const html = render(events);
  const items = [...document(html).querySelectorAll(`.${LIST_CLASS} li`)];

  assert.deepEqual(items.map((item) => item.getAttribute("data-event-type")), [
    "changed",
    "renamed",
    "imported",
    "removed",
    "added",
  ]);
  assert.equal(items[0]!.querySelector("code")!.textContent, "status");
  assert.equal(items[0]!.querySelector("del")!.textContent, "Old value: beta");
  assert.equal(items[0]!.querySelector("ins")!.textContent, "New value: stable");
  assert.equal(items[0]!.querySelector(".record-history-arrow")!.textContent, "→");
  assert.match(items[1]!.textContent!, /Renamed from/);
  assert.match(items[2]!.textContent!, /Imported/);
  assert.match(items[2]!.textContent!, /3/);
  assert.match(items[3]!.textContent!, /Removed/);
  assert.match(items[4]!.textContent!, /Added/);

  for (const item of items) assert.ok(item.querySelector("time")?.getAttribute("datetime"), "every event has a date");
  assert.equal(items[0]!.querySelector("time")!.getAttribute("datetime"), "2026-05-15");
});

test("the newest five stay in view and the rest go behind a disclosure", () => {
  const events = Array.from({ length: 8 }, (_, index) =>
    event({ id: String(index).padStart(16, "0"), date: `2026-05-${String(18 - index).padStart(2, "0")}` }),
  );
  const page = document(render(events));

  assert.equal(page.querySelectorAll(`.${LIST_CLASS}`)[0]!.children.length, DEFAULT_LIMIT);
  const details = page.querySelector(`.${DETAILS_CLASS}`)!;
  assert.ok(details instanceof page.defaultView!.HTMLDetailsElement);
  assert.equal(details.querySelector("summary")!.textContent, "Earlier events (3)");
  assert.equal(details.querySelectorAll("li").length, 3);
});

test("theme.options.history.limit sets how many events stay in view", () => {
  const events = Array.from({ length: 4 }, (_, index) => event({ id: String(index).padStart(16, "0") }));
  const page = document(render(events, "en", { history: { limit: 2 } }));
  assert.equal(page.querySelectorAll(`.${LIST_CLASS}`)[0]!.children.length, 2);
  assert.equal(page.querySelector("summary")!.textContent, "Earlier events (2)");

  for (const limit of [0, -1, 1.5, "3", null]) {
    const fallback = document(render(events, "en", { history: { limit } }));
    assert.equal(fallback.querySelectorAll(`.${LIST_CLASS}`)[0]!.children.length, events.length, String(limit));
  }
});

test("an empty or missing history renders no section", () => {
  assert.equal(render([]), "");
  const page = { lang: "en", title: "T", frontMatter: {} } as unknown as Page;
  const site = { config: { base: "" }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;
  assert.equal(renderToString(recordHistory({ props: {}, page, site, html: "" } as unknown as ComponentProps) as never), "");
});

test("the three languages label the section, the types and the disclosure", () => {
  const events = Array.from({ length: 7 }, (_, index) => event({ id: String(index).padStart(16, "0") }));
  const labels = ["en", "fa", "ar"].map((lang) => {
    const page = document(render(events, lang));
    return {
      title: page.querySelector("h2")!.textContent!,
      first: page.querySelector(`.${LIST_CLASS} li .record-history-type`)!.textContent!,
      summary: page.querySelector("summary")!.textContent!,
    };
  });
  assert.equal(new Set(labels.map((label) => label.title)).size, 3);
  assert.equal(new Set(labels.map((label) => label.first)).size, 3);
  assert.equal(new Set(labels.map((label) => label.summary)).size, 3);
});

test("the field filter lists each changed field once, in the events' order", () => {
  const html = render([
    event({ id: "1".repeat(16), type: "changed", field: "status", old: "beta", new: "stable" }),
    event({ id: "2".repeat(16), type: "added" }),
    event({ id: "3".repeat(16), type: "changed", field: "title", old: "A", new: "B" }),
    event({ id: "4".repeat(16), type: "changed", field: "status", old: "stable", new: "done" }),
  ]);
  const doc = document(html);
  const links = [...doc.querySelectorAll(".record-history-filter")];

  assert.deepEqual(
    links.map((link) => [link.textContent, link.getAttribute("data-history-value")]),
    [
      ["All fields", ""],
      ["status", "status"],
      ["title", "title"],
    ],
  );
  assert.equal(links[0]!.getAttribute("href"), "?history-field=");
  assert.equal(links[1]!.getAttribute("href"), "?history-field=status");
  assert.equal(doc.querySelector(`.${CLASS}`)!.getAttribute("data-history-root"), "");

  const fields = [...doc.querySelectorAll("[data-history-event]")].map((item) => item.getAttribute("data-history-field"));
  assert.deepEqual(fields, ["status", "", "title", "status"]);
});

test("the visible count is localised and no filter appears without a changed field", () => {
  const changed = document(
    render([event({ id: "1".repeat(16), type: "changed", field: "status", old: "beta", new: "stable" })]),
  );
  assert.equal(changed.querySelector(".record-history-count")!.textContent, "1 events");

  const fa = new JSDOM(
    render(
      [
        event({ id: "1".repeat(16), type: "changed", field: "status", old: "beta", new: "stable" }),
        event({ id: "2".repeat(16), type: "added" }),
      ],
      "fa",
    ),
  ).window.document;
  assert.match(fa.querySelector(".record-history-count")!.textContent!, /رویداد/);
  assert.ok(fa.querySelector(".record-history-filters")!.getAttribute("aria-label"));

  const added = document(render([event({ id: "1".repeat(16), type: "added" })]));
  assert.equal(added.querySelector(".record-history-filters"), null);
});
