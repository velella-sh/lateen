// The showpiece page is itself the live example, so every key it documents must be a key the
// layout reads (#492). The layout runs with a recording proxy, so the compared list comes from the
// reads and not from a second copy in the test.
import { noComponents } from "./helpers/render-component.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import home from "../layouts/home.ts";

const read = (path: string): string => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const page = read("site/showpiece.md");

const pos: SourcePos = { file: "index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

const config = {
  title: "Example",
  base: "",
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
} as SiteConfig;

function layoutProps(frontMatter: Record<string, unknown>, body: string): LayoutProps {
  const current: Page = {
    url: "/",
    source: pos,
    frontMatter,
    title: "Home",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: body,
    markdown: "",
    kind: "doc",
  };
  const site: Site = { config, pages: [current], nav: {}, data: {}, collections: {} };
  return { site, page: current, trail: [], pager: {}, head: { title: "Home · Example", meta: [], links: [], jsonLd: [] }, islands: [], renderComponent: noComponents };
}

/** The front-matter paths read while the layout runs, containers removed. */
function leavesRead(frontMatter: Record<string, unknown>): string[] {
  const reads = new Set<string>();
  const seen = new WeakMap<object, unknown>();
  const spy = (value: unknown, path: string): unknown => {
    if (typeof value !== "object" || value === null) return value;
    const known = seen.get(value);
    if (known !== undefined) return known;
    const proxy = new Proxy(value, {
      get(target, key, receiver) {
        const child = Reflect.get(target, key, receiver);
        if (typeof key !== "string") return child;
        if (Array.isArray(target)) return /^\d+$/.test(key) ? spy(child, `${path}[]`) : child;
        if (!Object.prototype.hasOwnProperty.call(target, key)) return child;
        const childPath = path === "" ? key : `${path}.${key}`;
        reads.add(childPath);
        return spy(child, childPath);
      },
    });
    seen.set(value, proxy);
    return proxy;
  };
  home(layoutProps(spy(frontMatter, "") as Record<string, unknown>, "<p>Demo body.</p>"));
  const all = [...reads];
  return all
    .filter((name) => !all.some((other) => other.startsWith(`${name}.`) || other.startsWith(`${name}[`)))
    .sort();
}

/** The backticked keys in the first column of the page's table, in page order. */
function documented(markdown: string): string[] {
  return [...markdown.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((match) => match[1] ?? "");
}

const BASE: Record<string, unknown> = {
  home: { style: "showpiece", backdrop: "glow", motif: "example" },
  hero: { eyebrow: "v0.3.0", title: "Docs you can trust.", lead: "One line." },
  actions: [
    { label: "Get started", url: "/install/", primary: true },
    { label: "Read the guide", url: "/layouts/" },
  ],
  stats: [
    { value: "12", label: "Pages", url: "/layouts/" },
    { value: "2", label: "Languages" },
    { value: "0", label: "Broken links" },
  ],
  demo: { title: "Demo", caption: "A short sample." },
  cta: { title: "Start now", lead: "Two minutes.", package: "example-package", actions: [{ label: "Install", url: "/install/" }] },
};

const FEATURE_GRID = {
  ...BASE,
  features: [{ title: "Fast", description: "Builds quickly.", icon: "check", url: "/layouts/", wide: true }],
};

const SECTION_FALLBACK = {
  ...BASE,
  sections: [{ title: "Guides", description: "Task-based pages.", icon: "file", url: "/layouts/", wide: true }],
};

test("the showpiece page documents exactly the front-matter keys the layout reads", () => {
  const keys = [...new Set([...leavesRead(FEATURE_GRID), ...leavesRead(SECTION_FALLBACK)])].sort();
  assert.deepEqual(documented(page).sort(), keys);
});

test("the page is the live example: it opts in with every section and is linked from the layouts index and the navigation", () => {
  assert.match(page, /^layout: home$/m);
  assert.match(page, /^  style: showpiece$/m);
  for (const key of ["stats", "features", "demo", "cta"]) assert.match(page, new RegExp(`^${key}:`, "m"), key);
  assert.match(read("site/layouts.md"), /\[Showpiece home\]\(\/showpiece\/\)/);
  assert.match(read("site/_data/navigation.yml"), /title: Showpiece home\n\s+url: \/showpiece\//);
});
