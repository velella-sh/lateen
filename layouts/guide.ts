import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import blockActions from "../chrome/block-actions/index.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import copyMarkdown from "../chrome/copy-markdown/index.ts";
import drawer from "../chrome/drawer/index.ts";
import editPage from "../chrome/edit-page/index.ts";
import feedback from "../chrome/feedback/index.ts";
import header from "../chrome/header/index.ts";
import lastUpdated from "../chrome/last-updated/index.ts";
import pageFooter from "../chrome/page-footer/index.ts";
import pager from "../chrome/pager/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import { highlightFences } from "../components/code/index.ts";
import guideSummary from "../components/guide-summary/index.ts";
import pageStatus, { type PageStatusProps } from "../components/page-status/index.ts";
import readingTime from "../components/reading-time/index.ts";
import { codeBackgrounds } from "../src/brand.ts";

/** True when the body already supplies the page's `h1`, so the layout never renders a second one. */
function titleFromBody(props: LayoutProps): boolean {
  return props.page.headings.some((heading) => heading.depth === 1);
}

/** The banner's props from front matter: a key is passed only when it holds a usable value. */
function statusProps(page: LayoutProps["page"]): PageStatusProps {
  const { status, since, replaced_by } = page.frontMatter;
  return {
    ...(status === undefined ? {} : { status }),
    ...(typeof since === "string" ? { since } : {}),
    ...(typeof replaced_by === "string" ? { replaced_by } : {}),
  };
}

/**
 * The guide page: breadcrumb, status banner, title, the summary bar built from the `guide` front
 * matter (from, to, time, risk), the body, edit link, page footer, copy-Markdown control, feedback, and
 * pager, marked for Pagefind. The body holds the guide's `steps`, `before-after`, `trap`, and
 * `check-list` components. No product name appears here: the text comes from the page.
 */
function article(props: LayoutProps): ComponentChildren {
  const { page } = props;
  const backdrops = codeBackgrounds(props.site.config.theme.options);
  return h(
    "article",
    { class: "doc guide", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    pageStatus({ props: statusProps(page), page, site: props.site, html: "" }) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, page.title),
    guideSummary({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    lastUpdated(props) as ComponentChildren,
    readingTime({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    h("div", { class: "doc-body guide-body", dangerouslySetInnerHTML: { __html: highlightFences(page.html, backdrops) } }),
    editPage(props) as ComponentChildren,
    h("div", { class: "doc-actions" }, pageFooter(props) as ComponentChildren, copyMarkdown(props) as ComponentChildren),
    feedback(props) as ComponentChildren,
    pager(props) as ComponentChildren,
  );
}

/**
 * The guide page: the doc layout's shell, sidebar, and on-this-page aside, with an article that adds
 * the summary bar. `guide.css` holds the few rules the frame needs beyond `doc.css`.
 */
const guide: Layout = (props) =>
  base({
    ...props,
    header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
    sidebar: sidebar(props) as ComponentChildren,
    main: h(Fragment, null, article(props), blockActions(props) as ComponentChildren),
    aside: toc(props) as ComponentChildren,
  });

export default guide;
