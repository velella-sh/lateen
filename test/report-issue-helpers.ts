import assert from "node:assert/strict";
import { renderToString } from "preact-render-to-string";
import type { ChromeProps, Page, RepositoryConfig, Site, SiteConfig } from "@velella/mizzen/contracts";
import reportIssue from "../chrome/report-issue/index.ts";

export function configWith(
  options: Readonly<Record<string, unknown>> = {},
  repository?: RepositoryConfig,
  lang = "en",
): SiteConfig {
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
    theme: { options },
    search: { text: 300 },
    redirects: {},
    outputs: {},
    collections: {},
  };
}

export function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/example/guide/install/",
    source: { file: "docs/guide/install.md", line: 1, column: 1, endLine: 9, endColumn: 1 },
    frontMatter: { title: "Install", version: "2.1" },
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

export function props(
  page: Page = pageWith(),
  repository: RepositoryConfig | null = { url: "https://github.com/velella-sh/lateen/" },
  options: Readonly<Record<string, unknown>> = {},
): ChromeProps {
  const site: Site = {
    config: configWith(options, repository === null ? undefined : repository, page.lang),
    pages: [page],
    nav: {},
    data: {},
    collections: {},
  };
  return { site, page, trail: [], pager: {} };
}

export function render(input: ChromeProps = props()): string {
  const node = reportIssue(input);
  return node === null ? "" : renderToString(node as never);
}

export function hrefOf(html: string): URL {
  const match = /href="([^"]+)"/.exec(html);
  assert.ok(match, "has a link");
  return new URL((match[1] ?? "").replaceAll("&amp;", "&"));
}

