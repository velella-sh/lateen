import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { Fragment, h } from "preact";
import type { LayoutProps, NavTree, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";
import searchResults, { RESULT_LIMIT, scriptValue, SEARCH_RESULTS_INPUT_ID } from "../layouts/search-results.ts";
import { patternOf, stringsOf, t } from "../i18n/index.ts";

const pos: SourcePos = { file: "search.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

function configWith(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
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
    ...overrides,
  };
}

function layoutProps(config: Partial<SiteConfig> = {}, pageOverrides: Partial<Page> = {}, nav: NavTree = { main: [] }): LayoutProps {
  const page: Page = {
    url: "/search/",
    source: pos,
    frontMatter: {},
    title: "Search results",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...pageOverrides,
  };
  const site: Site = { config: configWith(config), pages: [page], nav, data: {}, collections: {} };
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Search results · Example", meta: [], links: [], jsonLd: [] },
    islands: [],
  };
}

type VNode = { type: unknown; props: { children?: unknown; dangerouslySetInnerHTML?: { __html: string }; [key: string]: unknown } };

function isVNode(node: unknown): node is VNode {
  return typeof node === "object" && node !== null && "type" in node && "props" in node;
}

const VOID = new Set(["meta", "link", "input"]);

/** Minimal Preact vnode → HTML string for assertions (no render-to-string dependency). */
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
    .filter(([, value]) => value != null && value !== false)
    .map(([key, value]) => (value === true ? ` ${key}` : ` ${key}="${String(value)}"`))
    .join("");
  if (VOID.has(tag)) return `<${tag}${attrs}>`;
  return `<${tag}${attrs}>${dangerouslySetInnerHTML ? dangerouslySetInnerHTML.__html : html(children)}</${tag}>`;
}

const out = (config: Partial<SiteConfig> = {}, page: Partial<Page> = {}, nav: NavTree = { main: [] }): string =>
  html(searchResults(layoutProps(config, page, nav)));

/** The text of the one inline module script the layout writes. */
function scriptOf(page: string): string {
  const match = /<script type="module">([\s\S]*?)<\/script>/.exec(page);
  assert.ok(match, "the layout writes an inline module script");
  return match[1] ?? "";
}

/** The language and messages the script serializes, parsed back as real JSON. */
function serializedMessages(page: string): Record<string, unknown> {
  const match = /\nconst messages = ([^\n]*);\n/.exec(scriptOf(page));
  assert.ok(match, "the script serializes its messages on one line");
  return JSON.parse(match[1]!) as Record<string, unknown>;
}

/** The count path the script carries, extracted and run against the runtime's real Intl data. */
interface CountPath {
  pluralCategory(count: number): string;
  visibleNumber(count: number): string;
  countMessage(count: number): string;
}

function countPathOf(page: string): CountPath {
  const script = scriptOf(page);
  const setup = /const lang = [^\n]*\nconst messages = [\s\S]*?\n(?=const input)/.exec(script);
  assert.ok(setup, "the script declares the page language and its messages before the count path");
  const block = /\/\* count-path:start[\s\S]*?count-path:end \*\//.exec(script);
  assert.ok(block, "the script keeps the count path in one self-contained block");
  return new Function(`${setup[0]}\n${block[0]}\nreturn { pluralCategory, visibleNumber, countMessage };`)() as CountPath;
}

/** The section path the script carries, extracted and run against the runtime's real URL parser. */
interface SectionPath {
  sectionPath(url: string): string;
  sectionPaths(urls: readonly string[]): readonly string[];
}

function sectionPathOf(page: string): SectionPath {
  const block = /\/\* section-path:start[\s\S]*?section-path:end \*\//.exec(scriptOf(page));
  assert.ok(block, "the script keeps the section path in one self-contained block");
  return new Function(`${block[0]}\nreturn { sectionPath, sectionPaths };`)() as SectionPath;
}

interface HeadingPath {
  fragmentOf(url: string): string | undefined;
  resultHeading(record: {
    url: string;
    sub_results?: readonly { url?: string; title?: string }[];
    anchors?: readonly { id?: string; text?: string }[];
  }): string | undefined;
}

/** The heading lookup block, extracted and run against real Pagefind record shapes. */
function headingPathOf(page: string): HeadingPath {
  const block = /\/\* heading-path:start[\s\S]*?heading-path:end \*\//.exec(scriptOf(page));
  assert.ok(block, "the script keeps the heading lookup in one self-contained block");
  return new Function(`${block[0]}\nreturn { fragmentOf, resultHeading };`)() as HeadingPath;
}

interface MorePath {
  nextBatch(hits: readonly unknown[], shown: number, limit: number): readonly unknown[];
  hasMore(hits: readonly unknown[], shown: number): boolean;
  focusAfterAppend(items: readonly { querySelector(selector: string): { focus(): void } | null }[], control?: { focus(): void }): void;
}

/** The paging block, extracted and run against real batch sizes. */
function morePathOf(page: string): MorePath {
  const block = /\/\* more-path:start[\s\S]*?more-path:end \*\//.exec(scriptOf(page));
  assert.ok(block, "the script keeps the paging path in one self-contained block");
  return new Function(`${block[0]}\nreturn { nextBatch, hasMore, focusAfterAppend };`)() as MorePath;
}

interface ReturnPath {
  rememberResult(
    storage: { setItem(key: string, value: string): void } | undefined,
    query: string,
    url: string,
  ): void;
  rememberedResult(storage: { getItem(key: string): string | null } | undefined, query: string): string | undefined;
  markResult(
    list:
      | {
          querySelectorAll(selector: string): readonly {
            getAttribute(name: string): string | null;
            setAttribute(name: string, value: string): void;
            focus(): void;
          }[];
        }
      | undefined,
    url: string | undefined,
  ): void;
}

/** The return path, extracted and run against a fake session store and list. */
function returnPathOf(page: string): ReturnPath {
  const block = /\/\* return-path:start[\s\S]*?return-path:end \*\//.exec(scriptOf(page));
  assert.ok(block, "the script keeps the return path in one self-contained block");
  return new Function(`${block[0]}\nreturn { rememberResult, rememberedResult, markResult };`)() as ReturnPath;
}

/** Serializing a page whose language has no catalog warns once; tests keep the output clean. */
function quietOut(config: Partial<SiteConfig> = {}, page: Partial<Page> = {}): string {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    return out(config, page);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

test("renders a labelled GET search form, a status region, and a results container", () => {
  const page = out();

  assert.match(page, /<form class="search-results-form" role="search" action="\/search\/" method="get" data-search-form="">/);
  assert.match(page, new RegExp(`<label class="search-results-label" for="${SEARCH_RESULTS_INPUT_ID}">Search<\\/label>`));
  assert.match(
    page,
    new RegExp(`<input class="search-results-input" id="${SEARCH_RESULTS_INPUT_ID}" type="search" name="q" autocomplete="off" data-search-input="">`),
  );
  assert.match(page, /<button class="search-results-submit" type="submit">Search<\/button>/);
  assert.match(page, /<p class="search-results-status" role="status" data-search-status=""><\/p>/);
  assert.match(page, /<ol class="search-results-list" data-search-results=""><\/ol>/);
  assert.match(
    page,
    /<button class="search-results-more" type="button" data-search-more="" hidden>Show more<\/button>/,
  );
});

test("the form submits to this page, base included, as a plain GET request", () => {
  const page = out({ base: "/docs" }, { url: "/docs/search/" });

  assert.match(page, /action="\/docs\/search\/"/);
  assert.match(page, /method="get"/);
  assert.match(page, /<h1 class="search-results-title-page">Search results<\/h1>/);
});

test("the inline module reads the query from location.search and handles an empty one", () => {
  const script = scriptOf(out());

  assert.match(script, /new URLSearchParams\(location\.search\)\.get\("q"\)/);
  assert.match(script, /if \(input\) input\.value = query;/);
  assert.match(script, /query\.trim\(\) !== ""/);
});

test("the module loads the Pagefind index from the site base, at the root and under a subfolder", () => {
  const atRoot = scriptOf(out());
  assert.match(atRoot, /const base = "";/);
  assert.match(atRoot, /import\(base\.replace\(\/\\\/\$\/, ""\) \+ "\/pagefind\/pagefind\.js"\)/);

  const under = scriptOf(out({ base: "/docs" }, { url: "/docs/search/" }));
  assert.match(under, /const base = "\/docs";/);
});

test("the module prints the count and renders links with Pagefind excerpts", () => {
  const script = scriptOf(out());

  assert.match(script, /status\.textContent = messages\.loading;/);
  assert.match(script, /messages\.empty\.replace\("\{query\}"/);
  assert.match(script, /status\.textContent = messages\.failed;/);
  assert.match(script, /hits\.length === 1\n\s+\? messages\.one\n\s+: countMessage\(hits\.length\);/);
  assert.match(script, /link\.setAttribute\("href", href\)/);
  assert.match(script, /record\.excerpt/);
  assert.match(script, /document\.createElement\("mark"\)/);
  assert.match(script, /copyExcerpt\(template\.content, excerpt\)/);
});

test("result links are ordinary anchors, so the keyboard reaches them", () => {
  const script = scriptOf(out());

  assert.match(script, /document\.createElement\(href === undefined \? "span" : "a"\)/);
  assert.doesNotMatch(script, /tabIndex|tabindex/);
  assert.match(script, /safeHref\(record\.url\)/);
});

test("the module reads the heading a result's fragment names, and invents none", () => {
  const path = headingPathOf(out());
  const subsections = [
    { url: "/guide/install/", title: "Install" },
    { url: "/guide/install/#deploy", title: "Deploy" },
  ];

  assert.equal(path.resultHeading({ url: "/guide/install/#deploy", sub_results: subsections }), "Deploy");
  assert.equal(path.resultHeading({ url: "/guide/install/", sub_results: subsections }), undefined);
  assert.equal(path.resultHeading({ url: "/guide/install/#missing", sub_results: subsections }), undefined);
  assert.equal(
    path.resultHeading({
      url: "/reference/#errors",
      anchors: [
        { id: "install", text: "Install" },
        { id: "errors", text: "Errors" },
      ],
    }),
    "Errors",
  );

  const script = scriptOf(out());
  assert.match(script, /className = "search-results-heading"/);
  assert.match(script, /createElement\("bdi"\)/);
  assert.match(script, /const headingText = resultHeading\(record\)/);
});

test("the module keeps a localized heading from a right-to-left result", () => {
  const page = out({ lang: "fa" }, { lang: "fa", dir: "rtl" });
  const path = headingPathOf(page);

  assert.equal(path.fragmentOf("/راهنما/نصب/#نشر"), "نشر");
  assert.equal(
    path.resultHeading({ url: "/راهنما/نصب/#نشر", anchors: [{ id: "نشر", text: "انتشار" }] }),
    "انتشار",
  );
  assert.match(scriptOf(page), /const headingText = resultHeading\(record\)/);
});

test("a visitor without JavaScript gets a note and the form still submits", () => {
  const page = out();

  assert.match(page, /<noscript><p class="search-results-nojs">JavaScript is needed to show results on this page\. Submit the form to carry your query in the address\.<\/p><\/noscript>/);
  assert.match(page, /<form class="search-results-form"/);
  assert.doesNotMatch(page, /<form[^>]* hidden/);
});

/** The markup the browser shows when scripts do not run. */
function noscriptOf(page: string): string {
  const fallback = /<noscript>([\s\S]*?)<\/noscript>/.exec(page);
  assert.ok(fallback, "the page carries its no-JavaScript fallback in noscript");
  return fallback[1]!;
}

/** The fallback's links as [href, label], in document order. */
function fallbackLinks(page: string): string[][] {
  return [...noscriptOf(page).matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((match) => [match[1]!, match[2]!]);
}

const NAV: NavTree = {
  main: [
    { title: "Guide", url: "/guide/" },
    { title: "Reference", children: [{ title: "API", url: "/reference/api/" }, { title: "CLI", url: "/reference/cli/" }] },
    { title: "Blog", url: "/blog/" },
  ],
};

test("without JavaScript, the page links to the browsable sections from the navigation model, in order", () => {
  assert.deepEqual(fallbackLinks(out({}, {}, NAV)), [
    ["/guide/", "Guide"],
    ["/reference/api/", "Reference"],
    ["/blog/", "Blog"],
  ]);
});

test("the section links keep the site base, mark the current section, and follow the page direction", () => {
  const nav: NavTree = {
    main: [
      { title: "خانه", url: "/docs/" },
      { title: "راهنما", url: "/docs/guide/" },
      { title: "جستجو", url: "/docs/search/" },
    ],
  };
  const page = out({ base: "/docs", lang: "fa" }, { url: "/docs/search/", lang: "fa", dir: "rtl" }, nav);

  assert.match(page, /<html lang="fa" dir="rtl"/);
  assert.match(noscriptOf(page), /<nav class="search-results-sections" aria-label="Sections">/);
  assert.match(noscriptOf(page), /<a href="\/docs\/guide\/">راهنما<\/a>/);
  assert.match(noscriptOf(page), /<a href="\/docs\/search\/" aria-current="page">جستجو<\/a>/);
  assert.doesNotMatch(noscriptOf(page), /<a href="\/docs\/" aria-current/);
});

test("a site with no navigation keeps the note and shows no empty section list", () => {
  const page = out();

  assert.match(page, /search-results-nojs/);
  assert.doesNotMatch(page, /search-results-sections/);
});

test("the island keeps today's behavior and builds no second section list", () => {
  const page = out({}, {}, NAV);
  const script = scriptOf(page);

  assert.doesNotMatch(script, /search-results-sections|sectionLinks/);
  assert.equal(page.match(/class="search-results-sections"/g)?.length, 1);
  assert.ok(page.indexOf('<nav class="search-results-sections"') > page.indexOf("<noscript>"));
});

test("values written into the script are escaped so a base cannot close the tag", () => {
  const page = out({ base: '/docs<"x' });
  const script = scriptOf(page);

  assert.match(script, /const base = "\/docs\\u003c\\"x";/);
  assert.doesNotMatch(script, /<\/script/i);
  assert.equal(scriptValue("/docs<"), '"/docs\\u003c"');
});

test("every message comes from the i18n table", () => {
  const english = scriptOf(out());
  assert.match(english, /"empty":"No results for “\{query\}”\."/);
  assert.match(english, /"one":"1 result"/);
  assert.match(english, /"counts":\{"zero":/);

  const persian = scriptOf(out({ lang: "fa" }, { lang: "fa", dir: "rtl" }));
  assert.match(persian, /"one":"۱ نتیجه"/);
});

test("the results page tells same-titled pages apart by their real section path", () => {
  const paths = sectionPathOf(out());

  assert.equal(paths.sectionPath("/guide/install/"), "/guide/");
  assert.equal(paths.sectionPath("/install/"), "", "a page at the root has no section path");
  assert.deepEqual(paths.sectionPaths(["/api/install/", "/guide/install/"]), ["/api/", "/guide/"]);
  assert.deepEqual(paths.sectionPaths(["/guide/one/", "/guide/two/"]), ["", ""], "a shared path is omitted");
  assert.match(scriptOf(out()), /search-results-path/);
});

test("the first page shows the twenty highest-ranked hits", () => {
  const path = morePathOf(out());
  const hits = Array.from({ length: 45 }, (_, index) => index + 1);

  assert.equal(RESULT_LIMIT, 20);
  assert.deepEqual(path.nextBatch(hits, 0, RESULT_LIMIT), hits.slice(0, 20));
  assert.match(scriptOf(out()), /nextBatch\(hits, 0, 20\)/);
  assert.match(scriptOf(out()), /shown = records\.length/);
});

test("show more appends the next twenty without clearing the list", () => {
  const path = morePathOf(out());
  const hits = Array.from({ length: 45 }, (_, index) => index + 1);
  const script = scriptOf(out());

  assert.deepEqual(path.nextBatch(hits, 20, RESULT_LIMIT), hits.slice(20, 40));
  assert.match(script, /list\.append\(\.\.\.items\)/);
  assert.doesNotMatch(script, /list\.replaceChildren\(\.\.\.items\)[\s\S]*more\.addEventListener/);
  assert.match(script, /shown \+= batch\.length/);
});

test("the control hides when the last real hit is shown", () => {
  const path = morePathOf(out());
  const hits = Array.from({ length: 40 }, (_, index) => index + 1);
  const script = scriptOf(out());

  assert.equal(path.hasMore(hits, 0), true);
  assert.equal(path.hasMore(hits, 20), true);
  assert.equal(path.hasMore(hits, 40), false);
  assert.equal(path.hasMore(hits, 60), false);
  assert.match(script, /more\.hidden = !hasMore\(hits, shown\)/);
  assert.match(script, /more\.hidden = !remaining/);
});

test("focus moves to the first new result, with the control as the fallback", () => {
  const path = morePathOf(out());
  const focused: string[] = [];
  const first = { focus: () => focused.push("first") };
  const control = { focus: () => focused.push("control") };

  path.focusAfterAppend([{ querySelector: (selector) => (selector === "a" ? first : null) }], control);
  assert.deepEqual(focused, ["first"]);

  path.focusAfterAppend([{ querySelector: () => null }], control);
  assert.deepEqual(focused, ["first", "control"]);
  assert.match(scriptOf(out()), /focusAfterAppend\(items, remaining \? more : undefined\)/);
});

test("the next batch keeps the same query and scope without navigating", () => {
  const script = scriptOf(out());

  assert.equal(script.match(/api\.search\(query\)/g)?.length, 1);
  assert.match(script, /new URLSearchParams\(location\.search\)\.get\("q"\)/);
  assert.doesNotMatch(script, /history\.|location\.(href|search|assign|replace)\s*=|\.submit\(|scope/i);
  assert.match(out(), /data-search-more="" hidden/);
});

test("a right-to-left page keeps the same list and a translated show-more control", () => {
  const page = out({ lang: "fa" }, { lang: "fa", dir: "rtl" });

  assert.match(page, /^<html lang="fa" dir="rtl"/);
  assert.match(
    page,
    /<button class="search-results-more" type="button" data-search-more="" hidden>نمایش بیشتر<\/button>/,
  );
  assert.equal(morePathOf(page).hasMore([1, 2, 3], 2), true);
});

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

test("the script serializes all six search_count plural-category messages of every language", () => {
  for (const lang of ["en", "fa", "ar"] as const) {
    const messages = serializedMessages(out({ lang }, { lang }));
    const counts = messages.counts as Record<string, string>;
    assert.deepEqual(Object.keys(counts).sort(), [...PLURAL_CATEGORIES].sort());
    for (const category of PLURAL_CATEGORIES) {
      const key = `search_count_${category}`;
      assert.ok(key in stringsOf(lang), `the ${lang} catalog already ships ${key}`);
      assert.equal(counts[category], patternOf(lang, key), `${lang}.${key} is serialized intact`);
    }
    assert.equal(messages.empty, patternOf(lang, "search_results_empty"));
    assert.equal(messages.loading, t(lang, "search_results_loading"));
    assert.equal(messages.failed, t(lang, "search_results_failed"));
    assert.equal(messages.one, t(lang, "search_results_one"));
  }
});

test("Arabic selects zero/one/two/few/many/other at the CLDR boundaries", () => {
  const path = countPathOf(out({ lang: "ar" }, { lang: "ar", dir: "rtl" }));
  const categories = [0, 1, 2, 3, 10, 11, 99, 100, 101].map((count) => path.pluralCategory(count));
  assert.deepEqual(categories, ["zero", "one", "two", "few", "few", "many", "many", "other", "other"]);
});

test("Persian and English select their own plural categories", () => {
  const persian = countPathOf(out({ lang: "fa" }, { lang: "fa", dir: "rtl" }));
  assert.equal(persian.pluralCategory(1), "one");
  assert.equal(persian.pluralCategory(2), "other");
  assert.equal(persian.countMessage(2), "۲ نتیجه.");
  const english = countPathOf(out());
  assert.deepEqual([0, 1, 2].map((count) => english.pluralCategory(count)), ["other", "one", "other"]);
});

test("each count reads the category's own message with the locale's number", () => {
  const arabic = countPathOf(out({ lang: "ar" }, { lang: "ar", dir: "rtl" }));
  assert.equal(arabic.countMessage(2), `${new Intl.NumberFormat("ar").format(2)} نتيجتان.`);
  assert.equal(arabic.countMessage(3), `${new Intl.NumberFormat("ar").format(3)} نتائج.`);
  assert.equal(arabic.countMessage(11), `${new Intl.NumberFormat("ar").format(11)} نتيجة.`);

  const english = countPathOf(out());
  assert.equal(english.countMessage(1), "1 result.");
  assert.equal(english.countMessage(3), "3 results.");
  assert.equal(english.countMessage(0), "0 results.");
});

test("the visible number follows the locale's numbering system, including a regional tag", () => {
  const persian = countPathOf(out({ lang: "fa" }, { lang: "fa", dir: "rtl" }));
  assert.equal(persian.visibleNumber(5), "۵");
  assert.equal(persian.countMessage(5), "۵ نتیجه.");

  const regional = countPathOf(out({ lang: "fa-IR" }, { lang: "fa-IR", dir: "rtl" }));
  assert.equal(regional.countMessage(5), "۵ نتیجه.");
});

test("tags the Intl runtime cannot use fall back without throwing", () => {
  const malformed = countPathOf(out({ lang: "en_US" }, { lang: "en_US" }));
  assert.equal(malformed.pluralCategory(3), "other");
  assert.equal(malformed.visibleNumber(3), "3");
  assert.equal(malformed.countMessage(3), "3 results.");

  const unknown = countPathOf(quietOut({ lang: "xx" }, { lang: "xx" }));
  assert.equal(unknown.countMessage(3), "3 results.");
});

test("the count path stays safe inside the script and keeps the page markup intact", () => {
  const page = out({ base: '/docs<"x' });
  const script = scriptOf(page);

  assert.match(script, /const base = "\/docs\\u003c\\"x";/);
  assert.doesNotMatch(script, /<\/script/i);
  assert.match(script, /const lang = "en";/);
});

const css = "" /* lateen-legacy removed: layouts/search-results.css */;

/** A physical property: the ones the theme's logical-CSS rule rejects. */
const PHYSICAL = [
  /\b(margin|padding|border|scroll-margin|scroll-padding)-(left|right|top|bottom)\b/,
  /\bborder-(top|bottom)-(left|right)-radius\b/,
  /(^|[;{\s])(left|right|top|bottom)\s*:/,
  /\btext-align\s*:\s*(left|right)\b/,
  /\bfloat\s*:\s*(left|right)\b/,
  /\bclear\s*:\s*(left|right)\b/,
  /(?<![\w-])(min-|max-)?(width|height)\s*:/,
];

test("the results page carries the ask section and the site's llms.txt", () => {
  const page = out({ base: "/example", url: "https://example.com" });
  assert.match(page, /<section class="ask-agent-section" data-ask-agent-section(?:="")?>/);
  assert.match(page, /<a href="\/example\/llms\.txt">Read llms\.txt<\/a>/);
  assert.match(page, /Pick an agent you already use, or copy the prompt\./);
});

test("the ask section stays out when the site publishes no Markdown twins", () => {
  assert.doesNotMatch(out({ outputs: { twins: false } }), /data-ask-agent-section/);
});

test("returning from a result restores the query and marks the followed result without moving focus", () => {
  const memory = new Map<string, string>();
  const storage = {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => void memory.set(key, value),
  };
  const path = returnPathOf(out());

  assert.equal(path.rememberedResult(storage, "install"), undefined);
  path.rememberResult(storage, "install", "/guide/install/");
  assert.equal(path.rememberedResult(storage, "install"), "/guide/install/");
  assert.equal(path.rememberedResult(storage, "upgrade"), undefined, "another query does not restore this result");

  let focused = 0;
  const link = (href: string) => {
    const attrs = new Map<string, string>([["href", href]]);
    return {
      getAttribute: (name: string) => attrs.get(name) ?? null,
      setAttribute: (name: string, value: string) => void attrs.set(name, value),
      focus: () => void (focused += 1),
    };
  };
  const first = link("/guide/start/");
  const followed = link("/guide/install/");
  path.markResult({ querySelectorAll: () => [first, followed] }, path.rememberedResult(storage, "install"));

  assert.equal(followed.getAttribute("aria-current"), "true");
  assert.equal(first.getAttribute("aria-current"), null);
  assert.equal(focused, 0, "marking does not move focus");
  assert.equal(path.rememberedResult(undefined, "install"), undefined, "blocked storage does not throw");

  const page = out();
  assert.match(page, /data-search-results=""/, "the list stays reachable on the page");
  const script = scriptOf(page);
  assert.match(script, /new URLSearchParams\(location\.search\)\.get\("q"\)/, "the query comes back from the address");
  assert.match(script, /list\.addEventListener\("click"/);
  assert.match(script, /addEventListener\("pageshow"/);
});
