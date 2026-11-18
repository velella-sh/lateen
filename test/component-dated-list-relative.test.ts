// The relative hints are an island addition: the build writes no hint, no past mark, and no jump
// link, and the island never reorders or hides a row. The clock is passed in, so the test is fixed.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import datedList, { JUMP_ATTRIBUTE } from "../components/dated-list/index.ts";
import {
  enhance,
  JUMP_ID,
  PAST_CLASS,
  RELATIVE_CLASS,
  type ListDocument,
} from "../components/dated-list/client.ts";

const items = [
  { date: "2026-06-13", label: "Past release" },
  { date: "2026-06-15", label: "Today release" },
  { date: "2026-06-18", label: "Next release" },
];

const site = { config: { base: "" }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;

/** The reader's clock: midday on the day of the middle item. */
const NOW = new Date(2026, 5, 15, 12, 0, 0).getTime();

function render(lang = "en"): string {
  const page = { lang, url: "/posts/", frontMatter: {} } as unknown as Page;
  const input = { props: { items: JSON.stringify(items) }, page, site, html: "" } as unknown as ComponentProps;
  return renderToString(datedList(input) as never);
}

function setup(lang = "en"): Document {
  const dom = new JSDOM(`<!doctype html><html lang="${lang}"><body>${render(lang)}</body></html>`);
  enhance(dom.window.document as unknown as ListDocument, NOW);
  return dom.window.document;
}

/** A row's label with the day and the hint the island writes taken back out. */
const labels = (document: Document): string[] =>
  [...document.querySelectorAll(".dated-list-item")].map((item) => {
    const copy = item.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(`.${RELATIVE_CLASS}, .dated-list-day`).forEach((node) => node.remove());
    return copy.querySelector("a")?.textContent ?? copy.textContent?.trim() ?? "";
  });

const hints = (document: Document): string[] =>
  [...document.querySelectorAll(`.${RELATIVE_CLASS}`)].map((hint) => hint.textContent ?? "");

test("the built HTML has no hint, no past mark, and a hidden jump line", () => {
  const html = render();
  assert.doesNotMatch(html, new RegExp(RELATIVE_CLASS));
  assert.doesNotMatch(html, new RegExp(PAST_CLASS));
  assert.match(html, new RegExp(`${JUMP_ATTRIBUTE}[^>]*hidden`));
  assert.doesNotMatch(html, new RegExp(`#${JUMP_ID}`));
});

test("English hints name the distance in days, and today reads as today", () => {
  const document = setup();
  assert.deepEqual(hints(document), ["2 days ago", "today", "in 3 days"]);
});

test("a past day is marked, and only the past day", () => {
  const document = setup();
  const rows = [...document.querySelectorAll(".dated-list-item")];
  assert.ok(rows[0]!.classList.contains(PAST_CLASS));
  assert.equal(rows[1]!.classList.contains(PAST_CLASS), false);
  assert.equal(rows[2]!.classList.contains(PAST_CLASS), false);
});

test("the jump link points at the first item still ahead and shows only after the island runs", () => {
  const document = setup();
  const jump = document.querySelector(`[${JUMP_ATTRIBUTE}]`) as HTMLElement;
  assert.equal(jump.hidden, false);
  const link = jump.querySelector("a")!;
  assert.equal(link.getAttribute("href"), `#${JUMP_ID}`);
  assert.equal(link.textContent, "Jump to the next dated item");
  const target = document.getElementById(JUMP_ID)!;
  assert.match(target.textContent ?? "", /Next release/);
});

test("Persian and Arabic hints come from their own language", () => {
  // ICU words days differently per locale ("۲ روز پیش", "أول أمس"), so the checks are the locale's
  // own output rather than one word that another ICU version may rewrite.
  const expected = (lang: string, value: number) =>
    new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(value, "day");
  const english = hints(setup());
  for (const lang of ["fa", "ar"]) {
    const localized = hints(setup(lang));
    assert.deepEqual(localized, [expected(lang, -2), expected(lang, 0), expected(lang, 3)]);
    assert.notDeepEqual(localized, english);
  }
});

test("no row changes order, leaves the page, or repeats its hint", () => {
  const before = labels(new JSDOM(`<body>${render()}</body>`).window.document);
  const after = setup();
  assert.deepEqual(labels(after), before);
  assert.equal(after.querySelectorAll("time[datetime]").length, items.length);
  assert.equal(after.querySelectorAll(`.${RELATIVE_CLASS}`).length, items.length);
});
