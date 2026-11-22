import { h } from "preact";
import { pageToolSlot } from "./shared/page-tool.ts";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import { staleSlot } from "../src/stale.ts";
import copyMarkdown from "../chrome/copy-markdown/index.ts";
import editPage from "../chrome/edit-page/index.ts";
import lastUpdated from "../chrome/last-updated/index.ts";
import pageFooter from "../chrome/page-footer/index.ts";
import { tocFold } from "../chrome/toc/index.ts";
import { highlightFences } from "../components/code/index.ts";
import guidePrerequisites from "../components/guide-prerequisites/index.ts";
import guideSummary from "../components/guide-summary/index.ts";
import { renderPageStatus } from "../components/page-status/render.ts";
import { renderReadingTime } from "../components/reading-time/render.ts";
import relatedGuides from "../components/related-guides/index.ts";
import { renderVersionNotice } from "../components/version-notice/render.ts";
import { codeBackgrounds } from "../src/brand.ts";
import { articleHtml } from "../src/article-html.ts";
import { articleHeader, articleShell, statusProps } from "./shared/index.ts";

/**
 * The guide page: breadcrumb, status banner, title, the summary bar built from the `guide` front
 * matter (from, to, time, risk), the body, edit link, page footer, copy-Markdown control, and
 * related guides, marked for Pagefind. The body holds the guide's `steps`, `before-after`, `trap`, and
 * `check-list` components. No product name appears here: the text comes from the page.
 */
function article(props: LayoutProps): ComponentChildren {
  const { page } = props;
  const backdrops = codeBackgrounds(props.site.config.theme.options);
  return h(
    "article",
    { class: "doc guide", "data-pagefind-body": true },
    articleHeader(props, {
      notices: [
        renderPageStatus({ props: statusProps(page), page, site: props.site, html: "" }) as ComponentChildren,
        renderVersionNotice({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
      ],
      description: null,
      meta: [
        lastUpdated(props) as ComponentChildren,
        renderReadingTime({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
      ],
    }),
    staleSlot(props),
    guideSummary({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    tocFold(props) as ComponentChildren,
    guidePrerequisites({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    h("div", { class: "doc-body guide-body", dangerouslySetInnerHTML: { __html: highlightFences(articleHtml(page.html, page.lang), backdrops, page.lang, page.source.file) } }),
    pageToolSlot(props),
    editPage(props) as ComponentChildren,
    h("div", { class: "doc-actions" }, pageFooter(props) as ComponentChildren, copyMarkdown(props) as ComponentChildren),
    relatedGuides({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
  );
}

/**
 * The guide page: the doc layout's shell, sidebar, and on-this-page aside, with an article that adds
 * the summary bar. `guide.css` holds the few rules the frame needs beyond `doc.css`.
 */
const guide: Layout = (props) =>
  articleShell(props, { main: article(props) });

export default guide;
