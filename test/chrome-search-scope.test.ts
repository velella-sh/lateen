import assert from "node:assert/strict";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, NetworkProject, Pager, Site, SiteNetwork, SourcePos, Trail } from "@velella/mizzen/contracts";
import searchScope, { SCOPE_ALL, SCOPE_PARAMETER, SCOPE_PROJECT } from "../chrome/search-scope/index.ts";
import { siteConfig } from "./helpers/site.ts";
import { pageWith } from "./helpers/page.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = siteConfig({ title: "Alpha", base: "/alpha" });

const page = pageWith({ url: "/alpha/search/", source: pos, frontMatter: { title: "Search" }, title: "Search" });

const trail: Trail = [];
const pager: Pager = {};

function project(id: string, title: string, current = false): NetworkProject {
  return { id, path: id, title, current };
}

function props(network?: SiteNetwork): ChromeProps {
  const site: Site = {
    config,
    pages: [page],
    nav: {},
    data: {},
    collections: {},
    ...(network === undefined ? {} : { network }),
  };
  return { site, page, trail, pager };
}

const three = (): SiteNetwork => ({
  current: "alpha",
  lock: "0".repeat(64),
  projects: [project("alpha", "Alpha", true), project("beta", "Beta Docs"), project("gamma", "Gamma")],
});

function render(network?: SiteNetwork): string {
  const node = searchScope(props(network));
  return node === null ? "" : renderToString(node as never);
}

test("offers this project and all projects, with the engine's names and the project default", () => {
  const out = render(three());
  assert.match(out, /^<fieldset class="search-scope"><legend class="search-scope-legend">Search scope<\/legend>/);
  assert.match(out, new RegExp(`name="${SCOPE_PARAMETER}" value="${SCOPE_PROJECT}" checked`));
  assert.match(out, new RegExp(`name="${SCOPE_PARAMETER}" value="${SCOPE_ALL}"`));
  assert.equal([...out.matchAll(/name="scope"/g)].length, 2);
  assert.equal([...out.matchAll(/type="radio"/g)].length, 2);
  assert.match(out, /This project/);
  assert.match(out, /All projects/);
  assert.equal([...out.matchAll(/checked/g)].length, 1);
});

test("the choice is written to the results address on an ordinary form submission", () => {
  const dom = new JSDOM(`<body><form action="/alpha/search/" method="get">${render(three())}<input name="q" value="install"></form></body>`);
  const form = dom.window.document.querySelector("form")!;

  const first = new dom.window.URLSearchParams(new dom.window.FormData(form) as never);
  assert.equal(first.get(SCOPE_PARAMETER), SCOPE_PROJECT);
  assert.equal(first.get("q"), "install");

  const all = form.querySelector<HTMLInputElement>(`input[value="${SCOPE_ALL}"]`)!;
  all.checked = true;
  const second = new dom.window.URLSearchParams(new dom.window.FormData(form) as never);
  assert.equal(second.get(SCOPE_PARAMETER), SCOPE_ALL);
});

test("renders nothing when the site has no network or no other index", () => {
  assert.equal(render(), "");
  assert.equal(searchScope(props()), null);
  assert.equal(render({ current: "alpha", lock: "0".repeat(64), projects: [project("alpha", "Alpha", true)] }), "");
  assert.equal(searchScope(props({ current: "alpha", lock: "0".repeat(64), projects: [] })), null);
});
