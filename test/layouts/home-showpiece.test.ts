import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { test } from "node:test";
import { Fragment, h } from "preact";
import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import home from "../../layouts/home.ts";

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

function layoutProps(frontMatter: Record<string, unknown>, body = ""): LayoutProps {
  const page: Page = {
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
  const site: Site = { config, pages: [page], nav: {}, data: {}, collections: {} };
  return { renderComponent: () => "", site, page, trail: [], pager: {}, head: { title: "Home · Example", meta: [], links: [], jsonLd: [] }, islands: [] };
}

type VNode = { type: unknown; props: { children?: unknown; dangerouslySetInnerHTML?: { __html: string }; [key: string]: unknown } };
const isVNode = (n: unknown): n is VNode => typeof n === "object" && n !== null && "type" in n && "props" in n;
const VOID = new Set(["meta", "link", "input"]);

/** Minimal Preact vnode → HTML string, so the output can be compared as text. */
function html(node: unknown): string {
  if (node == null || node === false || node === true) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(html).join("");
  if (!isVNode(node)) return "";
  if (node.type === Fragment) return html(node.props.children);
  if (typeof node.type === "function") return html((node.type as (p: object) => unknown)(node.props));
  const tag = node.type as string;
  const { children, dangerouslySetInnerHTML, ...rest } = node.props;
  const attrs = Object.entries(rest)
    .filter(([, v]) => v != null && v !== false)
    .map(([k, v]) => (v === true ? ` ${k}` : ` ${k}="${String(v)}"`))
    .join("");
  if (VOID.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${dangerouslySetInnerHTML ? dangerouslySetInnerHTML.__html : html(children)}</${tag}>`;
}

const out = (fm: Record<string, unknown>, body = "") => html(home(layoutProps(fm, body)));

/** The existing `home` fixture: every key a `home` page reads today. */
const CLASSIC = {
  hero: { eyebrow: "v0.3.0 · 12 pages", title: "Docs you can trust.", lead: "One line." },
  actions: [
    { label: "Get started", url: "/guide/", primary: true },
    { label: "Browse the API", url: "/reference/" },
  ],
  sections: [
    {
      title: "Guides",
      url: "/guide/",
      description: "Task-based pages.",
      icon: "M4 5h7a3 3 0 0 1 3 3v11",
      links: [{ title: "Install", url: "/guide/install/", meta: "3 min" }, { title: "Deploy", url: "/guide/deploy/" }],
    },
    { title: "Components", description: "Callouts, tabs, cards." },
  ],
};
const CLASSIC_BODY = "<p>More about the project.</p>";
const GOLDEN = new URL("../golden/home-classic.html", import.meta.url);

test("an existing home page renders byte for byte as before", () => {
  const page = out(CLASSIC, CLASSIC_BODY);
  if (process.env.UPDATE_GOLDEN === "1") writeFileSync(GOLDEN, page);
  assert.equal(page, readFileSync(GOLDEN, "utf8"));
});

const FULL = {
  home: { style: "showpiece", backdrop: "grid", motif: "docs" },
  hero: { eyebrow: "v0.3.0", title: "Docs you can trust.", lead: "One line." },
  actions: [{ label: "Get started", url: "/guide/", primary: true }],
  stats: [
    { value: "12", label: "Pages" },
    { value: "3", label: "Languages" },
    { value: "100%", label: "Checked" },
  ],
  features: [
    { title: "Fast", description: "Builds quickly." },
    { title: "Plain", url: "/guide/" },
  ],
  demo: { title: "Terminal", caption: "A short run." },
  cta: { title: "Start now", lead: "Two minutes.", actions: [{ label: "Install", url: "/guide/install/" }] },
};

const order = (page: string, marks: string[]) => marks.map((m) => page.indexOf(m));

test("without the option the keys for stats, features, demo and cta change nothing", () => {
  const base = out(CLASSIC, CLASSIC_BODY);
  const extra = out({ ...CLASSIC, stats: FULL.stats, features: FULL.features, demo: FULL.demo, cta: FULL.cta }, CLASSIC_BODY);
  assert.equal(extra, base);
  assert.equal(out({ ...CLASSIC, home: { style: "classic" } }, CLASSIC_BODY), base);
  assert.equal(out({ ...CLASSIC, home: "showpiece" }, CLASSIC_BODY), base);
});

test("a full showpiece page orders hero, stats, features, demo, then the call to action", () => {
  const page = out(FULL, "<p>Demo body.</p>");
  const at = order(page, ['class="hero ', 'class="stat-strip"', 'class="feature-grid ', 'class="frame"', 'class="cta-band"']);
  assert.ok(at.every((n) => n >= 0), `all sections render: ${at}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at);
  assert.match(page, /class="backdrop backdrop-grid"/);
  assert.match(page, /class="motif motif-contours"/);
  assert.equal((page.match(/<h1/g) ?? []).length, 1);
  assert.equal((page.match(/Demo body\./g) ?? []).length, 1, "the body is drawn once, inside the frame");
  assert.match(page, /<a class="cta-band-action" href="\/guide\/install\/">Install<\/a>/);
});

test("a partial showpiece page leaves out every section without data", () => {
  const page = out({ home: { style: "showpiece" }, hero: { lead: "Only a lead." }, cta: { title: "No action" } });
  assert.match(page, /<h1 class="hero-title">Home<\/h1>/);
  for (const gone of ["stat-strip", "feature-grid", 'class="frame"', "cta-band"]) assert.doesNotMatch(page, new RegExp(gone));
});

test("a title-only showpiece page is a hero then the body", () => {
  const page = out({ home: { style: "showpiece" } }, "<p>Body.</p>");
  assert.ok(order(page, ['class="hero ', "<p>Body.</p>"]).every((n, i, a) => n >= 0 && (i === 0 || n > a[i - 1]!)));
  assert.doesNotMatch(page, /frame|stat-strip|feature-grid|cta-band/);
});

test("a demo without a body draws no frame, and the sections of home fill the feature grid", () => {
  const page = out({ home: { style: "showpiece" }, demo: { title: "X" }, sections: [{ title: "Guides", url: "/guide/" }] });
  assert.doesNotMatch(page, /class="frame"/);
  assert.match(page, /class="feature-grid-title">Guides</);
});

test("malformed showpiece values are dropped without throwing", () => {
  const page = out({ home: { style: "showpiece" }, stats: "x", features: 3, demo: 1, cta: [], hero: "no", actions: 9 });
  assert.match(page, /<h1 class="hero-title">Home<\/h1>/);
});
