import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, NetworkProject, Page, Pager, Site, SiteConfig, SiteNetwork, SourcePos, Trail } from "@velella/mizzen/contracts";
import projectSwitcher, { projectLinks } from "../chrome/project-switcher/index.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config: SiteConfig = {
  title: "Alpha",
  base: "/alpha",
  lang: "en",
  dir: "ltr",
  languages: [],
  source: ".",
  include: [],
  exclude: [],
  navigation: "_data/navigation.yml",
  defaults: [],
  theme: { options: {} },
  search: { text: 300 },
  redirects: {},
  outputs: {},
  collections: {},
  feeds: {},
};

const page: Page = {
  url: "/alpha/guide/install/",
  source: pos,
  frontMatter: { title: "Install" },
  title: "Install",
  lang: "en",
  dir: "ltr",
  headings: [],
  html: "",
  markdown: "",
  kind: "doc",
};

const trail: Trail = [];
const pager: Pager = {};

function project(id: string, title: string, current = false): NetworkProject {
  return { id, path: id, title, current };
}

function network(projects: readonly NetworkProject[], current = "alpha"): SiteNetwork {
  return { current, lock: "0".repeat(64), projects };
}

function props(networkValue?: SiteNetwork): ChromeProps {
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {}, ...(networkValue === undefined ? {} : { network: networkValue }) };
  return { site, page, trail, pager };
}

/** The rendered markup for a network; a missing network or a single project renders nothing at all. */
function render(networkValue?: SiteNetwork): string {
  const node = projectSwitcher(props(networkValue));
  return node === null ? "" : renderToString(node as never);
}

/** Count the non-overlapping matches of `pattern` in `text`. */
function count(text: string, pattern: RegExp): number {
  return [...text.matchAll(pattern)].length;
}

test("renders three projects in network order, with the current one marked", () => {
  const value = network([project("alpha", "Alpha", true), project("beta", "Beta Docs"), project("gamma", "Gamma")]);
  const out = render(value);

  assert.match(out, /^<nav class="project-switcher" aria-label="Site navigation"><ul class="project-switcher-list">/);
  assert.equal(count(out, /<li class="project-switcher-item">/g), 3);

  assert.match(out, /<a class="project-switcher-link project-switcher-current" href="\/alpha\/" aria-current="true"><bdi>Alpha<\/bdi><\/a>/);
  assert.match(out, /<a class="project-switcher-link" href="\/beta\/"><bdi>Beta Docs<\/bdi><\/a>/);
  assert.match(out, /<a class="project-switcher-link" href="\/gamma\/"><bdi>Gamma<\/bdi><\/a>/);

  assert.equal(count(out, /aria-current=/g), 1);
  assert.ok(out.indexOf("Alpha") < out.indexOf("Beta Docs"));
  assert.ok(out.indexOf("Beta Docs") < out.indexOf("Gamma"));

  assert.doesNotMatch(out, /<img|logo/);
  assert.equal(projectLinks(props(value).site).length, 3);
});

test("renders nothing when the network has one project", () => {
  assert.equal(render(network([project("alpha", "Alpha", true)])), "");
  assert.equal(projectSwitcher(props(network([project("alpha", "Alpha", true)]))), null);
  assert.deepEqual(projectLinks(props(network([project("alpha", "Alpha", true)])).site), []);
});

test("renders nothing when the site has no network", () => {
  assert.equal(render(), "");
  assert.equal(projectSwitcher(props()), null);
  assert.deepEqual(projectLinks(props().site), []);
});

test("takes every name and address from the network input", () => {
  const value = network([project("docs", "Handbook", true), project("notes", "Field Notes"), project("lab", "Workshop")], "docs");
  const out = render(value);

  assert.match(out, /href="\/docs\/"/);
  assert.match(out, /href="\/notes\/"/);
  assert.match(out, /href="\/lab\/"/);
  assert.match(out, /Handbook/);
  assert.match(out, /Field Notes/);
  assert.match(out, /Workshop/);
  assert.doesNotMatch(out, /https?:\/\//);
  assert.deepEqual(projectLinks(props(value).site), [
    { id: "docs", title: "Handbook", url: "/docs/", current: true },
    { id: "notes", title: "Field Notes", url: "/notes/", current: false },
    { id: "lab", title: "Workshop", url: "/lab/", current: false },
  ]);
});

test("a long title is kept in full and the stylesheet lets it wrap", () => {
  const long = "A very long project title that must stay readable on a narrow screen without being cut off";
  const out = render(network([project("alpha", "Alpha", true), project("long", long)]));

  assert.ok(out.includes(long));
  assert.doesNotMatch(out, /…|\.\.\./);

  const css = readFileSync(new URL("../chrome/project-switcher/style.css", import.meta.url), "utf8");
  assert.match(css, /\.project-switcher-link \{[^}]*overflow-wrap: anywhere;/);
  assert.doesNotMatch(css, /text-overflow|white-space: nowrap/);
});

test("style.css uses only token names from tokens/names.json for var(--*) references", () => {
  const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
    string,
    Record<string, unknown>
  >;
  const tokenNames = new Set(
    Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
  );
  const css = readFileSync(new URL("../chrome/project-switcher/style.css", import.meta.url), "utf8");
  const used = [...css.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((match) => match[1]!);
  assert.ok(used.length > 0);
  for (const name of used) assert.ok(tokenNames.has(name), `unknown token --${name}`);
});

test("style.css uses logical properties only", () => {
  const css = readFileSync(new URL("../chrome/project-switcher/style.css", import.meta.url), "utf8");
  assert.doesNotMatch(css, /(^|[;{\s])(left|right|top|bottom)\s*:/);
  assert.doesNotMatch(css, /(?<![\w-])(min-|max-)?(width|height)\s*:/);
  assert.match(css, /padding-inline:/);
});
