import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps, Page } from "@velella/mizzen/contracts";
import { factsOf } from "../components/guide-summary/index.ts";
import { t } from "../i18n/index.ts";
import { articleShell } from "./shared/index.ts";

/** One index group: a tag and its guides, or the untagged guides when `tag` is undefined. */
export interface GuideGroup {
  readonly tag: string | undefined;
  readonly guides: readonly Page[];
}

/** A guide is a page the `guide` layout renders. */
export function isGuide(page: Page): boolean {
  return page.frontMatter.layout === "guide";
}

/** The first usable tag in `tags` front matter; a guide without one is untagged. */
function tagOf(page: Page): string | undefined {
  const tags = page.frontMatter.tags;
  if (!Array.isArray(tags)) return undefined;
  for (const tag of tags) {
    if (typeof tag === "string" && tag.trim() !== "") return tag.trim();
  }
  return undefined;
}

/** Compares by code point, never by locale. */
function byCodePoint(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** `order` (missing last), then title, then URL: the order the nav uses for siblings. */
export function compareGuides(a: Page, b: Page): number {
  const ao = typeof a.frontMatter.order === "number" ? a.frontMatter.order : Infinity;
  const bo = typeof b.frontMatter.order === "number" ? b.frontMatter.order : Infinity;
  if (ao !== bo) return ao < bo ? -1 : 1;
  return byCodePoint(a.title, b.title) || byCodePoint(a.url, b.url);
}

/**
 * The guide index groups: every built guide under its first tag, sorted by `order` then title. Groups
 * sort by the same key of their first guide, with the untagged group last.
 */
export function groupsOf(pages: readonly Page[]): GuideGroup[] {
  const tagged = new Map<string, Page[]>();
  const untagged: Page[] = [];
  for (const page of pages) {
    if (!isGuide(page)) continue;
    const tag = tagOf(page);
    if (tag === undefined) untagged.push(page);
    else {
      const guides = tagged.get(tag);
      if (guides === undefined) tagged.set(tag, [page]);
      else guides.push(page);
    }
  }

  const groups: GuideGroup[] = [...tagged].map(([tag, guides]) => ({ tag, guides: guides.sort(compareGuides) }));
  groups.sort((a, b) => compareGuides(a.guides[0]!, b.guides[0]!) || byCodePoint(a.tag ?? "", b.tag ?? ""));
  if (untagged.length > 0) groups.push({ tag: undefined, guides: untagged.sort(compareGuides) });
  return groups;
}

/** A guide's time and risk, formatted by the summary bar's `factsOf`; nothing when neither is set. */
function facts(page: Page): ComponentChildren {
  const values = factsOf(page);
  const keys = (["time", "risk"] as const).filter((key) => values[key] !== undefined);
  if (keys.length === 0) return null;
  return h(
    "span",
    { class: "guide-index-facts" },
    ...keys.map((key) =>
      h(
        "span",
        { class: `guide-index-fact guide-index-${key}`, "data-fact": key },
        h("span", { class: "guide-index-label" }, t(page.lang, key === "time" ? "guide_time" : "guide_risk")),
        " ",
        values[key] as string,
      ),
    ),
  );
}

/** One group: its tag and count, then the guides. The untagged group takes the catalog's label. */
function group({ tag, guides }: GuideGroup, lang: string): ComponentChildren {
  return h(
    "section",
    { class: "guide-index-group", ...(tag === undefined ? { "data-untagged": true } : { "data-tag": tag }) },
    h(
      "h2",
      { class: "guide-index-heading" },
      tag ?? t(lang, "guide_untagged"),
      " ",
      h("span", { class: "guide-index-count" }, String(guides.length)),
    ),
    h(
      "ul",
      { class: "guide-index-list" },
      ...guides.map((page) =>
        h(
          "li",
          { class: "guide-index-item" },
          h("a", { class: "guide-index-link", href: page.url }, page.title),
          facts(page),
        ),
      ),
    ),
  );
}

/** The page's content: its title and one group per tag, the untagged guides last. */
function content(props: LayoutProps): ComponentChildren {
  return h(
    "article",
    { class: "guide-index", "data-pagefind-body": true },
    h("h1", { class: "guide-index-title" }, props.page.title),
    ...groupsOf(props.site.pages).map((guides) => group(guides, props.page.lang)),
  );
}

/**
 * The guide index: the base shell with the usual header, mobile drawer, and navigation sidebar,
 * listing every built guide under its first `tags` front-matter tag with the group's count, time, and
 * risk. Untagged guides come last. It reads `site.pages`, so nothing is fetched.
 */
const guideIndex: Layout = (props) =>
  articleShell(props, { main: content(props), aside: null });

export default guideIndex;
