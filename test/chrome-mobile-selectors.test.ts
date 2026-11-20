import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderToString } from "preact-render-to-string";
import type {
  ChromeProps,
  LanguageConfig,
  NetworkProject,
  Page,
  Pager,
  Site,
  SiteConfig,
  SiteNetwork,
  SourcePos,
  Trail,
} from "@velella/mizzen/contracts";
import { mobileSelectors } from "../chrome/mobile-selectors/index.ts";

const pos: SourcePos = { file: "guide/install.md", line: 1, column: 1, endLine: 1, endColumn: 1 };
const trail: Trail = [];
const pager: Pager = {};

const EN: LanguageConfig = { code: "en", name: "English", prefix: "" };
const FA: LanguageConfig = { code: "fa", name: "فارسی", prefix: "/fa" };
const JA: LanguageConfig = { code: "ja", name: "日本語", prefix: "/ja" };

function configWith(overrides: Partial<SiteConfig> = {}): SiteConfig {
  return {
    title: "Example",
    base: "",
    lang: "en",
    dir: "ltr",
    languages: [EN, FA],
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

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/guide/install/",
    source: pos,
    frontMatter: {
      versions: [
        { version: "v1", url: "/guide/install/" },
        { version: "v2", url: "/v2/guide/install/" },
      ],
    },
    title: "Install",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...overrides,
  };
}

function project(id: string, title: string, current = false): NetworkProject {
  return { id, path: id, title, current };
}

function network(projects: readonly NetworkProject[]): SiteNetwork {
  return { current: "alpha", lock: "0".repeat(64), projects };
}

function translations(page: Page): Page[] {
  return [
    page,
    { ...page, url: "/fa/guide/install/", lang: "fa", dir: "rtl" },
  ];
}

function props(
  config: SiteConfig = configWith(),
  page: Page = pageWith(),
  projects: SiteNetwork | undefined = network([
    project("alpha", "Alpha", true),
    project("beta", "Beta Docs"),
    project("gamma", "Gamma"),
  ]),
  pages: readonly Page[] = translations(page),
  data: Site["data"] = {},
): ChromeProps {
  const site: Site = {
    config,
    pages,
    nav: {},
    data,
    collections: {},
    ...(projects === undefined ? {} : { network: projects }),
  };
  return { site, page, trail, pager };
}

function render(value: ChromeProps): string {
  const node = mobileSelectors(value);
  return node === null ? "" : renderToString(node as never);
}

function documentFor(html: string, dir: "ltr" | "rtl" = "ltr"): Document {
  return new JSDOM(`<body dir="${dir}">${html}</body>`).window.document;
}

function summaryTexts(doc: Document): string[] {
  return [...doc.querySelectorAll("summary")].map((summary) => summary.textContent?.trim() ?? "");
}

test("all three selectors share one disclosure pattern and list only configured options", () => {
  const out = render(props());
  const doc = documentFor(out);
  const controls = [...doc.querySelectorAll<HTMLDetailsElement>("details.mobile-selector")];

  assert.equal(controls.length, 3);
  assert.deepEqual(
    controls.map((control) => control.dataset.mobileSelector),
    ["projects", "language", "versions"],
  );
  assert.deepEqual(summaryTexts(doc), ["Projects▾", "Language▾", "Versions▾"]);

  for (const control of controls) {
    assert.equal(control.open, false);
    assert.equal(control.querySelector(":scope > summary")?.classList.contains("mobile-selector-summary"), true);
    assert.equal(control.querySelector(":scope > ul")?.classList.contains("mobile-selector-list"), true);
  }

  assert.deepEqual(
    [...doc.querySelectorAll('[data-mobile-selector="projects"] a')].map((link) => link.getAttribute("href")),
    ["/alpha/", "/beta/", "/gamma/"],
  );
  assert.deepEqual(
    [...doc.querySelectorAll('[data-mobile-selector="language"] a')].map((link) => link.getAttribute("href")),
    ["/guide/install/", "/fa/guide/install/"],
  );
  assert.deepEqual(
    [...doc.querySelectorAll('[data-mobile-selector="versions"] a')].map((link) => link.getAttribute("href")),
    ["/guide/install/", "/v2/guide/install/"],
  );
  assert.equal(doc.querySelectorAll('[data-mobile-selector="projects"] [aria-current="true"]').length, 1);
  assert.equal(doc.querySelectorAll('[data-mobile-selector="language"] [aria-current="true"]').length, 1);
  assert.equal(doc.querySelectorAll('[data-mobile-selector="versions"] [aria-current="true"]').length, 1);

  const language = doc.querySelector('[data-mobile-selector="language"]')!;
  assert.equal(language.querySelector("summary")?.getAttribute("aria-label"), "Language: English");
  const options = [...language.querySelectorAll("li")].map((item) => ({
    text: item.textContent?.trim() ?? "",
    lang: item.querySelector("a, span")?.getAttribute("lang"),
  }));
  assert.deepEqual(options, [
    { text: "English (Current)", lang: "en" },
    { text: "فارسی", lang: "fa" },
  ]);
});

test("a selector with fewer than two real options is left out, and a missing translation is not guessed", () => {
  const one = network([project("alpha", "Alpha", true)]);
  const out = render(
    props(
      configWith({ languages: [EN] }),
      pageWith(),
      one,
    ),
  );
  const doc = documentFor(out);

  assert.equal(doc.querySelector('[data-mobile-selector="projects"]'), null);
  assert.equal(doc.querySelector('[data-mobile-selector="language"]'), null);
  assert.notEqual(doc.querySelector('[data-mobile-selector="versions"]'), null);
  assert.equal(doc.querySelectorAll("details.mobile-selector").length, 1);

  const missing = doc.querySelector('[data-mobile-selector="versions"] [aria-current="true"]');
  assert.equal(missing?.textContent, "v1 (Current version)");
});

test("one configured language with no page stays a named, disabled option instead of a link", () => {
  const config = configWith({ languages: [EN, FA, JA] });
  const page = pageWith();
  const out = render(props(config, page, network([project("alpha", "Alpha", true), project("beta", "Beta")]), translations(page), {
    languages: { fallback: [] },
  }));
  const doc = documentFor(out);

  const language = doc.querySelector('[data-mobile-selector="language"]')!;
  assert.equal(language.querySelectorAll("a").length, 2);
  const unavailable = language.querySelector('[aria-disabled="true"]');
  assert.match(unavailable?.textContent ?? "", /^日本語/);
  assert.equal(unavailable?.getAttribute("href"), null);
  assert.match(unavailable?.textContent ?? "", /This page hasn't been translated yet/);
});

test("focus order follows projects, language, versions, and each summary is a real control", () => {
  const doc = documentFor(render(props()));
  const summaries = [...doc.querySelectorAll<HTMLElement>("summary")];

  assert.deepEqual(
    summaries.map((summary) => summary.parentElement?.getAttribute("data-mobile-selector")),
    ["projects", "language", "versions"],
  );
  for (const summary of summaries) assert.equal(summary.tabIndex, 0);

  for (const details of doc.querySelectorAll<HTMLDetailsElement>("details.mobile-selector")) details.open = true;
  const order = [...doc.querySelectorAll<HTMLElement>("summary, a[href]")].map((node) =>
    node.tagName === "SUMMARY" ? `summary:${node.parentElement?.getAttribute("data-mobile-selector")}` : node.textContent?.trim(),
  );
  assert.deepEqual(order, [
    "summary:projects",
    "Alpha",
    "Beta Docs",
    "Gamma",
    "summary:language",
    "English (Current)",
    "فارسی",
    "summary:versions",
    "v1 (Current version)",
    "v2",
  ]);
});

test("RTL uses the page labels and the shared CSS keeps direction in logical properties", () => {
  const config = configWith({ lang: "fa", dir: "rtl" });
  const page = pageWith({ url: "/fa/guide/install/", lang: "fa", dir: "rtl" });
  const out = render(props(config, page, network([project("alpha", "آلفا", true), project("beta", "بتا")])));
  const doc = documentFor(out, "rtl");

  assert.deepEqual(summaryTexts(doc), ["پروژه‌ها▾", "زبان▾", "نسخه‌ها▾"]);
  assert.equal(doc.body.dir, "rtl");

  const css = readFileSync("styles/src/ui.css", "utf8");
  const start = css.indexOf(".mobile-selectors {");
  const end = css.indexOf("/* Mobile drawer:", start);
  assert.ok(start >= 0 && end > start);
  const mobileCss = css.slice(start, end);
  assert.match(mobileCss, /padding-inline:/);
  assert.match(mobileCss, /text-align: start/);
  assert.doesNotMatch(mobileCss, /(?:margin|padding)-(?:left|right):/);
  assert.doesNotMatch(mobileCss, /(?:^|[;{\s])(?:left|right):/);
});

test("the markup works without JavaScript: native details, real links, no script-only state", () => {
  const out = render(props());
  const doc = documentFor(out);

  assert.equal(doc.querySelectorAll("details.mobile-selector").length, 3);
  assert.equal(doc.querySelectorAll("details.mobile-selector[open]").length, 0);
  assert.equal(doc.querySelectorAll("script").length, 0);
  assert.equal(doc.querySelectorAll("[hidden], [tabindex], [aria-expanded], [onclick]").length, 0);
  for (const link of doc.querySelectorAll<HTMLAnchorElement>("a")) {
    assert.match(link.getAttribute("href") ?? "", /^\//);
  }
  for (const summary of doc.querySelectorAll("summary")) {
    assert.equal(summary.firstElementChild?.classList.contains("mobile-selector-label"), true);
    assert.equal(summary.lastElementChild?.classList.contains("mobile-selector-marker"), true);
  }
});
