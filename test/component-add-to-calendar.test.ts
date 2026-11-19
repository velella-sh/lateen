// The add-to-calendar control renders only links whose address is safe: a root-relative download
// and an https calendar's webcal subscribe address. A record with neither keeps the page unchanged.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { CalendarLink, ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import addToCalendar, { CLASS, ICON_CLASS } from "../components/add-to-calendar/index.ts";

const calendars: CalendarLink[] = [
  {
    name: "items",
    title: "Items",
    url: "https://example.com/calendars/items.ics",
    webcal: "webcal://example.com/calendars/items.ics",
  },
];

function render(props: Record<string, unknown>, lang = "en", base = "", title = "Dated item"): string {
  const page = { lang, title, frontMatter: {} } as unknown as Page;
  const site = { config: { base }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;
  return renderToString(addToCalendar({ props, page, site, html: "" } as unknown as ComponentProps) as never);
}

const document = (html: string): Document => new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`).window.document;

const links = (html: string): HTMLAnchorElement[] => [...document(html).querySelectorAll<HTMLAnchorElement>(`.${CLASS} a`)];

test("both links render, in reading order, and name the record", () => {
  const html = render({ calendar: "/items/dated/calendar.ics", calendars });
  const found = links(html);

  assert.deepEqual(found.map((link) => link.textContent), ["Add to calendar", "Subscribe"]);
  assert.deepEqual(found.map((link) => link.getAttribute("href")), [
    "/items/dated/calendar.ics",
    "webcal://example.com/calendars/items.ics",
  ]);
  assert.equal(found[0]!.getAttribute("aria-label"), "Add to calendar: Dated item");
  assert.equal(found[0]!.getAttribute("title"), "Download the .ics file");
  assert.equal(found[1]!.getAttribute("aria-label"), "Subscribe to Dated item in a calendar app");

  const icon = document(html).querySelector(`.${ICON_CLASS}`)!;
  assert.equal(icon.getAttribute("aria-hidden"), "true");
  assert.ok(icon.querySelector("svg") !== null);
});

test("one safe link renders on its own", () => {
  assert.deepEqual(links(render({ calendar: "/items/dated/calendar.ics" })).map((link) => link.textContent), [
    "Add to calendar",
  ]);
  assert.deepEqual(links(render({ calendars })).map((link) => link.textContent), ["Subscribe"]);
});

test("no address, or only unsafe addresses, renders nothing", () => {
  assert.equal(render({}), "");
  for (const calendar of ["javascript:alert(1)", "http://example.com/x.ics", "//example.com/x.ics", "data:text/calendar,x"]) {
    assert.equal(render({ calendar }), "", calendar);
  }
  const unsafe: CalendarLink[] = [
    { name: "http", title: "HTTP", url: "http://example.com/x.ics", webcal: "webcal://example.com/x.ics" },
    { name: "js", title: "JS", url: "https://example.com/x.ics", webcal: "javascript:alert(1)" },
  ];
  assert.equal(render({ calendars: unsafe }), "");
});

test("the site base is applied once", () => {
  assert.equal(links(render({ calendar: "/items/x.ics" }, "en", "/lateen"))[0]!.getAttribute("href"), "/lateen/items/x.ics");
  assert.equal(
    links(render({ calendar: "/lateen/items/x.ics" }, "en", "/lateen"))[0]!.getAttribute("href"),
    "/lateen/items/x.ics",
  );
});

test("the accessible names follow the page language", () => {
  const labels = ["en", "fa", "ar"].map(
    (lang) => links(render({ calendar: "/items/x.ics" }, lang))[0]!.getAttribute("aria-label")!,
  );
  for (const label of labels) assert.ok(label.includes("Dated item"), label);
  assert.equal(new Set(labels).size, 3, "each language names the link differently");
});

test("a record with no title keeps a usable accessible name", () => {
  const html = render({ calendar: "/items/x.ics", calendars }, "en", "", "");
  const found = links(html);
  assert.equal(found[0]!.getAttribute("aria-label"), "Add to calendar");
  assert.equal(found[1]!.getAttribute("aria-label"), "Subscribe");
});
