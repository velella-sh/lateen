// The stale notice names the review date and the files that changed, keeps a limited number in view
// and puts the rest behind a native disclosure. It is page content, not an alert.
import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps, Page, PageStale, Site } from "@velella/mizzen/contracts";
import staleNotice, {
  CLASS,
  DEFAULT_MAX_FILES,
  FILES_CLASS,
  MORE_CLASS,
  REVIEWED_CLASS,
} from "../components/stale-notice/index.ts";

const files: PageStale["files"] = [
  { path: "src/router.ts", change: "changed" },
  { path: "src/old.ts", change: "removed" },
  { path: "src/new.ts", change: "added" },
];

function render(stale: PageStale | undefined, lang = "en", options: Record<string, unknown> = {}): string {
  const page = { lang, title: "Install", frontMatter: {} } as unknown as Page;
  const site = { config: { base: "", theme: { options } }, nav: {}, data: {}, pages: [], collections: {} } as unknown as Site;
  return renderToString(
    staleNotice({ props: stale === undefined ? {} : { stale }, page, site, html: "" } as unknown as ComponentProps) as never,
  );
}

const document = (html: string): Document => new JSDOM(`<!doctype html><html lang="en"><body>${html}</body></html>`).window.document;

test("the notice names the review date and every change", () => {
  const page = document(render({ reviewed: "2026-01-05", files }));
  const html = page.body.innerHTML;

  assert.equal(page.querySelector("aside")!.getAttribute("aria-labelledby"), `${CLASS}-title`);
  assert.match(page.querySelector("h2")!.textContent!, /This page may be out of date/);
  assert.match(page.querySelector("p")!.textContent!, /Last reviewed on/);
  assert.ok(page.querySelector("time") === null, "the date is text, not a machine timestamp");

  const items = [...page.querySelectorAll(`.${FILES_CLASS} li`)];
  assert.deepEqual(items.map((item) => item.getAttribute("data-change")), ["changed", "removed", "added"]);
  assert.deepEqual(items.map((item) => item.querySelector("code")!.textContent), files.map((file) => file.path));
  assert.match(items[0]!.textContent!, /changed/);
  assert.match(items[1]!.textContent!, /removed/);
  assert.match(items[2]!.textContent!, /added/);
  assert.equal(page.querySelector(`.${MORE_CLASS}`), null);
  assert.equal(page.querySelector('[role="alert"]'), null);
  assert.equal(page.querySelector("[aria-live]"), null);
  assert.equal(html.includes("<script"), false);
});

test("a long file list keeps the first files in view and the rest in a disclosure", () => {
  const many: PageStale["files"] = Array.from({ length: 8 }, (_, index) => ({
    path: `src/file-${index}.ts`,
    change: "changed",
  }));
  const page = document(render({ files: many }));
  assert.equal(page.querySelectorAll(`.${FILES_CLASS}`)[0]!.children.length, DEFAULT_MAX_FILES);
  assert.equal(page.querySelector("summary")!.textContent, "More changed files (3)");
  assert.equal(page.querySelector(`.${MORE_CLASS}`)!.querySelectorAll("li").length, 3);

  const short = document(render({ files: many }, "en", { stale: { maxFiles: 2 } }));
  assert.equal(short.querySelectorAll(`.${FILES_CLASS}`)[0]!.children.length, 2);
  assert.equal(short.querySelector("summary")!.textContent, "More changed files (6)");
});

test("a site can turn the notice off", () => {
  assert.equal(render({ files }, "en", { stale: { show: false } }), "");
  assert.notEqual(render({ files }, "en", { stale: { show: true } }), "");
});

test("no stale page and an empty file list render nothing", () => {
  assert.equal(render(undefined), "");
  assert.equal(render({ files: [] }), "");
});

test("the three languages name the notice and the changes", () => {
  const pages = ["en", "fa", "ar"].map((lang) => document(render({ reviewed: "2026-01-05", files }, lang)));
  const titles = pages.map((page) => page.querySelector("h2")!.textContent!);
  assert.equal(new Set(titles).size, 3);
  const reviewed = pages.map((page) => page.querySelector(`.${REVIEWED_CLASS}`)!.textContent!);
  assert.equal(new Set(reviewed).size, 3, "each language writes the review date in its own calendar");
  for (const page of pages) assert.match(page.querySelector(`.${FILES_CLASS}`)!.textContent!, /src\/router\.ts/);
});
