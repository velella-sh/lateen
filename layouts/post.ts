import { h } from "preact";
import { staleSlot } from "../src/stale.ts";
import { pageToolSlot } from "./shared/page-tool.ts";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import pageFooter from "../chrome/page-footer/index.ts";
import { highlightFences } from "../components/code/index.ts";
import { t } from "../i18n/index.ts";
import { codeBackgrounds } from "../src/brand.ts";
import { calendarDate, configuredCalendar } from "../src/dates.ts";
import { textOf } from "../src/guards.ts";
import { blogFeedHref, blogSubscribe, withBlogFeed } from "./blog/feed.ts";
import { archiveUrlOf, authorOf, authorPageOf, authorProfileOf } from "./blog/index.ts";
import { articleHtml } from "../src/article-html.ts";
import { articleShell, titleFromBody } from "./shared/index.ts";

/** The date line: a `<time>` in the page's calendar when the date is real, else the written text. */
function dateOf(props: LayoutProps, value: string | undefined): ComponentChildren {
  if (value === undefined) return null;
  const date = calendarDate(value, props.page.lang, configuredCalendar(props.site.config));
  return date === undefined ? h("span", null, value) : h("time", { datetime: date.datetime }, date.text);
}

/** The author line: the display name, linked to the author page when the site publishes one. */
function byline(
  props: LayoutProps,
  id: string,
  author: ReturnType<typeof authorProfileOf>,
): ComponentChildren {
  const page = authorPageOf(props.site, id);
  const label = h("span", { class: "post-by" }, t(props.page.lang, "post_by"));
  return h(
    "span",
    { class: "post-author" },
    author.image === undefined ? null : h("img", { src: author.image, alt: "", width: 24, height: 24 }),
    label,
    " ",
    page === undefined ? author.name : h("a", { href: page.url }, author.name),
  );
}

/**
 * A blog post: the docs shell with the archive link, title, date and author, the optional
 * description, the body with highlighted fences, and the page footer. The body's own `h1` wins,
 * as on every Lateen article layout, so a post never shows two titles.
 */
function article(props: LayoutProps, feed: string | undefined): ComponentChildren {
  const { page } = props;
  const front = page.frontMatter;
  const date = textOf(front.date);
  const authorId = textOf(front.author);
  const author = authorId === undefined ? undefined : authorProfileOf(props.site, authorOf(props.site, authorId), authorId);
  const description = textOf(front.description);
  const body = { __html: highlightFences(articleHtml(page.html, page.lang), codeBackgrounds(props.site.config.theme.options), page.lang, page.source.file) };
  return h(
    "article",
    { class: "doc post", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, page.title),
    h(
      "p",
      { class: "post-meta" },
      dateOf(props, date),
      date === undefined ? null : h("span", { "aria-hidden": "true" }, " · "),
      authorId === undefined || author === undefined ? null : byline(props, authorId, author),
      h("span", { "aria-hidden": "true" }, " · "),
      h("a", { class: "post-archive", href: archiveUrlOf(props.site) }, t(page.lang, "post_archive")),
      feed === undefined ? null : h("span", { "aria-hidden": "true" }, " · "),
      feed === undefined ? null : blogSubscribe(feed, page.lang),
    ),
    author?.image === undefined && author?.bio !== undefined
      ? h("p", { class: "post-author-bio", dir: "auto" }, author.bio)
      : null,
    description === undefined ? null : h("p", { class: "post-description" }, description),
    staleSlot(props),
    h("div", { class: "doc-body", dangerouslySetInnerHTML: body }),
    pageToolSlot(props),
    h("div", { class: "doc-actions" }, pageFooter(props) as ComponentChildren),
  );
}

/** The post page: the base shell, header, drawer, sidebar, article, and the on-this-page column. */
const post: Layout = (props) => {
  const feed = blogFeedHref(props);
  return articleShell(props, {
    base: { head: withBlogFeed(props.head, feed, props.site.config.url) },
    main: article(props, feed),
  });
};

export default post;
