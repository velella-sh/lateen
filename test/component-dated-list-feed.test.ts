// The feed and calendar links are written by the build only when the page gives a safe address:
// an https link or a root-relative path. A missing or unsafe address renders no link at all.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page, Site } from "@velella/mizzen/contracts";
import datedList, { ACTIONS_CLASS } from "../components/dated-list/index.ts";

const items = [{ date: "2026-06-13", label: "A release" }];

const site = { config: { base: "" }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;

function render(props: Record<string, unknown>): string {
  const page = { lang: "en", url: "/posts/", frontMatter: {} } as unknown as Page;
  const input = {
    props: { items: JSON.stringify(items), ...props },
    page,
    site,
    html: "",
  } as unknown as ComponentProps;
  return renderToString(datedList(input) as never);
}

const document = (html: string): Document => new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`).window.document;

const links = (html: string): HTMLAnchorElement[] => [
  ...document(html).querySelectorAll<HTMLAnchorElement>(`.${ACTIONS_CLASS} a`),
];

test("both links render above the list, in reading order", () => {
  const html = render({ feed: "/posts/feed.xml", calendar: "/posts/posts.ics" });
  const found = links(html);

  assert.deepEqual(found.map((link) => link.getAttribute("href")), ["/posts/feed.xml", "/posts/posts.ics"]);
  assert.deepEqual(found.map((link) => link.textContent), ["Subscribe", "Add to calendar"]);
  assert.ok(found[0]!.querySelector("svg") !== null, "the feed link carries the feed icon");
  assert.equal(found[1]!.querySelector("svg"), null, "the calendar link needs no icon");

  const actions = document(html).querySelector(`.${ACTIONS_CLASS}`)!;
  const list = document(html).querySelector(".dated-list-items")!;
  assert.ok(actions.compareDocumentPosition(list) & 4, "the links come before the list");
});

test("an https address is accepted for either link", () => {
  const found = links(
    render({ feed: "https://example.com/posts/feed.xml", calendar: "https://example.com/posts/posts.ics" }),
  );
  assert.deepEqual(found.map((link) => link.getAttribute("href")), [
    "https://example.com/posts/feed.xml",
    "https://example.com/posts/posts.ics",
  ]);
});

test("one link renders alone", () => {
  assert.deepEqual(links(render({ feed: "/posts/feed.xml" })).map((link) => link.textContent), ["Subscribe"]);
  assert.deepEqual(links(render({ calendar: "/posts/posts.ics" })).map((link) => link.textContent), ["Add to calendar"]);
});

test("no attribute renders no link and no line", () => {
  const html = render({});
  assert.equal(links(html).length, 0);
  assert.doesNotMatch(html, new RegExp(ACTIONS_CLASS));
});

test("an address that is not https or root-relative is dropped", () => {
  for (const address of ["http://example.com/feed.xml", "feed.xml", "javascript:alert(1)", "//evil.example/feed.xml", ""]) {
    const html = render({ feed: address, calendar: address });
    assert.equal(links(html).length, 0, address);
    assert.doesNotMatch(html, new RegExp(ACTIONS_CLASS), address);
  }
});

test("the links are written in the page language", () => {
  const page = { lang: "fa", url: "/posts/", frontMatter: {} } as unknown as Page;
  const input = {
    props: { items: JSON.stringify(items), feed: "/posts/feed.xml", calendar: "/posts/posts.ics" },
    page,
    site,
    html: "",
  } as unknown as ComponentProps;
  const html = renderToString(datedList(input) as never);
  assert.deepEqual(links(html).map((link) => link.textContent), ["اشتراک", "افزودن به تقویم"]);
});
