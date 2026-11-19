import type { LayoutProps, Page, Site, SiteConfig, SourcePos } from "@velella/mizzen/contracts";

const source: SourcePos = { file: "index.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

export function pageWith(frontMatter: Record<string, unknown> = {}, html = ""): Page {
  return {
    url: "/",
    source,
    frontMatter,
    title: typeof frontMatter.title === "string" ? frontMatter.title : "Lateen documentation",
    lang: "en",
    dir: "ltr",
    headings: [],
    html,
    markdown: "",
    kind: "doc",
  };
}

export function propsWith(frontMatter: Record<string, unknown> = {}, html = ""): LayoutProps {
  const page = pageWith(frontMatter, html);
  const config: SiteConfig = {
    title: "Lateen",
    description: "A docs theme for people and agents, built on Mizzen.",
    base: "/lateen",
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
  const site: Site = { config, pages: [page], nav: { main: [] }, data: {}, collections: {} };
  return {
    site,
    page,
    trail: [],
    pager: {},
    head: { title: "Lateen documentation", meta: [], links: [], jsonLd: [] },
    islands: [],
  };
}
