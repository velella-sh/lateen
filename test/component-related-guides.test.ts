import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import relatedGuides, { RELATED_LIMIT } from "../components/related-guides/index.ts";

const pos: SourcePos = { file: "guides/move.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = {
  title: "Example", base: "", lang: "en", dir: "ltr", languages: [], source: ".", include: [], exclude: [],
  navigation: "_data/navigation.yml", defaults: [], theme: { options: {} }, search: { text: 300 }, redirects: {},
  outputs: {}, collections: {},
} as unknown as SiteConfig;

function page(title: string, url: string, frontMatter: Readonly<Record<string, unknown>>): Page {
  return {
    url, source: pos, frontMatter, title, lang: "en", dir: "ltr", headings: [], html: "", markdown: "", kind: "doc",
  } as Page;
}

const guide = (title: string, url: string, tags: string[], order: number): Page =>
  page(title, url, { layout: "guide", tags, order });

const database = guide("Move the database", "/guides/database/", ["Migration"], 1);
const app = guide("Move the app", "/guides/app/", ["Migration", "Database"], 2);
const rollback = guide("Roll back", "/guides/rollback/", ["Migration"], 3);
const backup = guide("Back up", "/guides/backup/", ["Database"], 4);
const seed = guide("Seed data", "/guides/seed/", ["Database"], 5);
const docs = page("Database docs", "/docs/database/", { layout: "doc", tags: ["Database"], order: 0 });
const unbuilt = guide("Unbuilt guide", "/guides/unbuilt/", ["Database"], 0);
const lone = page("Solo guide", "/guides/solo/", { layout: "guide" });

function render(current: Page, pages: readonly Page[]): string {
  const site = { config, pages, nav: { main: [] }, data: {}, collections: {} } as unknown as Site;
  const node = relatedGuides({ props: {}, page: current, site, html: "" } as never);
  return node === null ? "" : renderToString(node as never);
}

/** Every href in the output, in reading order. */
function hrefsOf(html: string): string[] {
  return [...html.matchAll(/href="([^"]+)"/g)].map((match) => match[1] ?? "");
}

test("the first guide of a group has a next and no previous", () => {
  const html = render(database, [database, app, rollback]);
  assert.doesNotMatch(html, /pager-prev|rel="prev"/);
  assert.match(html, /href="\/guides\/app\/" rel="next"/);
  assert.match(html, /class="related-guides-heading">Related guides</);
  assert.match(html, /href="\/guides\/rollback\/"/);
});

test("the last guide of a group has a previous and no next", () => {
  const html = render(rollback, [database, app, rollback]);
  assert.doesNotMatch(html, /pager-next|rel="next"/);
  assert.match(html, /href="\/guides\/app\/" rel="prev"/);
  assert.match(html, /href="\/guides\/database\/"/);
});

test("related guides share any tag, even in another group, and never repeat a neighbour", () => {
  const html = render(app, [database, app, rollback, backup, seed, docs]);
  const hrefs = hrefsOf(html);
  assert.deepEqual(hrefs, ["/guides/database/", "/guides/rollback/", "/guides/backup/", "/guides/seed/"]);
  assert.equal(new Set(hrefs).size, hrefs.length, "no guide is linked twice");
  assert.doesNotMatch(html, /\/docs\/database\//);
  assert.equal(html.match(/class="related-guides-item"/g)?.length, 2);
});

test("the shared-tag list stops at four guides", () => {
  const guides = Array.from({ length: 8 }, (_, index) =>
    guide(`Guide ${index + 1}`, `/guides/${index + 1}/`, ["Migration"], index + 1),
  );
  const html = render(guides[0]!, guides);
  assert.equal(html.match(/class="related-guides-item"/g)?.length, RELATED_LIMIT);
  assert.doesNotMatch(html, /Guide 7|Guide 8/);
  assert.match(html, /Guide 3/);
});

test("no neighbours and no shared tag hide the block, and an unbuilt page is never linked", () => {
  assert.equal(render(lone, [lone, docs, unbuilt]), "");
  assert.equal(render(lone, [lone]), "");
});

test("a guide alone in its group still links shared tags but has no pager", () => {
  const html = render(backup, [backup, app]);
  assert.doesNotMatch(html, /class="pager"/);
  assert.match(html, /href="\/guides\/app\/"/);
  assert.doesNotMatch(html, /\/guides\/unbuilt\//);
});
