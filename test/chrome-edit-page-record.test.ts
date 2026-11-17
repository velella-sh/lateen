import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type {
  ChromeProps,
  Page,
  PageRecord,
  RepositoryConfig,
  Site,
  SiteConfig,
  SourcePos,
} from "@velella/mizzen/contracts";
import editPage from "../chrome/edit-page/index.ts";

const template: SourcePos = { file: "templates/component.md", line: 3, column: 1, endLine: 9, endColumn: 1 };

const record: PageRecord = {
  collection: "components",
  id: "button",
  position: { file: "data/components.yml", startLine: 12, startColumn: 3, endLine: 20, endColumn: 9 },
  template: "templates/component.md",
  templateLine: 3,
  fallbacks: [],
};

const github: RepositoryConfig = { url: "https://github.com/acme/site" };
const gitlab: RepositoryConfig = { url: "https://gitlab.com/acme/site/" };

function configWith(repository: RepositoryConfig | undefined, lang = "en"): SiteConfig {
  return {
    title: "Example",
    base: "/example",
    lang,
    dir: lang === "fa" || lang === "ar" ? "rtl" : "ltr",
    languages: [],
    source: ".",
    include: [],
    exclude: [],
    navigation: "_data/navigation.yml",
    defaults: [],
    ...(repository === undefined ? {} : { repository }),
    theme: { options: {} },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
    feeds: {},
  };
}

function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/example/components/button/",
    source: template,
    frontMatter: { title: "Button" },
    title: "Button",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    record,
    ...overrides,
  };
}

function render(page: Page, repository: RepositoryConfig | null = github): string {
  const site: Site = {
    config: configWith(repository === null ? undefined : repository, page.lang),
    pages: [page],
    nav: {},
    data: {},
    collections: {},
  };
  const props: ChromeProps = { site, page, trail: [], pager: {} };
  const node = editPage(props);
  return node === null ? "" : renderToString(node as never);
}

test("GitHub: a record page links to its data file and line range, not its template", () => {
  const out = render(pageWith());

  assert.match(
    out,
    /<a class="edit-page-link" href="https:\/\/github\.com\/acme\/site\/edit\/main\/data\/components\.yml#L12-L20" rel="noopener">Edit this record<\/a>/,
  );
  assert.doesNotMatch(out, /templates\/component\.md/);
});

test("GitLab: a record page keeps the /-/edit path and gains the line range", () => {
  const out = render(pageWith(), gitlab);

  assert.match(
    out,
    /<a class="edit-page-link" href="https:\/\/gitlab\.com\/acme\/site\/-\/edit\/main\/data\/components\.yml#L12-L20" rel="noopener">Edit this record<\/a>/,
  );
});

test("a record on one line links to that line alone", () => {
  const oneLine: PageRecord = {
    ...record,
    position: { file: "data/components.yml", startLine: 7, startColumn: 1, endLine: 7, endColumn: 4 },
  };

  assert.match(render(pageWith({ record: oneLine })), /data\/components\.yml#L7" rel="noopener"/);
});

test("an ordinary page keeps its source file, its label, and no line anchor", () => {
  const source: SourcePos = { file: "docs/guide/install.md", line: 3, column: 1, endLine: 9, endColumn: 1 };
  const { record: _record, ...ordinary } = pageWith();
  const out = render({ ...ordinary, source, url: "/example/guide/install/" });

  assert.match(
    out,
    /<a class="edit-page-link" href="https:\/\/github\.com\/acme\/site\/edit\/main\/docs\/guide\/install\.md" rel="noopener">Edit this page<\/a>/,
  );
  assert.doesNotMatch(out, /#L/);
});

test("the record label reads in the page language", () => {
  assert.match(render(pageWith({ lang: "fa", dir: "rtl" })), />ویرایش این رکورد<\/a>/);
  assert.match(render(pageWith({ lang: "ar", dir: "rtl" })), />تحرير هذا السجل<\/a>/);
});
