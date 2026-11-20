import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import { staleSlot } from "../src/stale.ts";
import blockActions from "../chrome/block-actions/index.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import copyMarkdown from "../chrome/copy-markdown/index.ts";
import drawer from "../chrome/drawer/index.ts";
import editPage from "../chrome/edit-page/index.ts";
import feedback from "../chrome/feedback/index.ts";
import shell, { footer as shellFooter } from "../chrome/shell/index.ts";
import lastUpdated from "../chrome/last-updated/index.ts";
import pageAgentMenu from "../chrome/page-agent-menu/index.ts";
import pageFooter from "../chrome/page-footer/index.ts";
import pager from "../chrome/pager/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import { highlightFences } from "../components/code/index.ts";
import driftBanner from "../components/drift-banner/index.ts";
import pageTool, { toolHref } from "../components/page-tool/index.ts";
import pageStatus, { type PageStatusProps } from "../components/page-status/index.ts";
import readingTime from "../components/reading-time/index.ts";
import versionNotice from "../components/version-notice/index.ts";
import trustPanel from "../components/trust-panel/index.ts";
import { codeBackgrounds } from "../src/brand.ts";

/**
 * True when the body already supplies the page's `h1`, by the same rule as the engine's
 * `resolveTitle`: any top-level depth-1 heading counts, even when front matter wins the title,
 * so the layout never renders a second `h1` above it.
 */
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
 * The page itself: breadcrumb, drift banner, status banner, title, trust chip, last updated line,
 * reading time, body, edit link, page footer, copy-Markdown control, feedback, and pager, marked for
 * Pagefind. The drift banner reads `site.data.drift` and keeps itself out of the page when the site
 * has no findings for this URL; the trust chip reads `site.data.trust` and stays out until the site
 * has an entry for this URL; the edit link is likewise left out when the repository gives no URL.
 */
function article(props: LayoutProps): ComponentChildren {
  const { page } = props;
  const backdrops = codeBackgrounds(props.site.config.theme.options);
  const tool = typeof page.frontMatter.tool === "string" ? page.frontMatter.tool : undefined;
  const toolUrl = toolHref(props.site.config.base, tool);
  return h(
    "article",
    { class: "doc", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    driftBanner({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    pageStatus({ props: statusProps(page), page, site: props.site, html: "" }) as ComponentChildren,
    versionNotice({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, page.title),
    staleSlot(props),
    trustPanel({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    lastUpdated(props) as ComponentChildren,
    readingTime({ props: {}, page, site: props.site, html: "" }) as ComponentChildren,
    h("div", { class: "doc-body", dangerouslySetInnerHTML: { __html: highlightFences(page.html, backdrops, page.lang) } }),
    toolUrl === undefined
      ? null
      : (pageTool({
          props: tool === undefined ? { base: props.site.config.base } : { base: props.site.config.base, tool },
          page,
          site: props.site,
          html: "",
        }) as ComponentChildren),
    editPage(props) as ComponentChildren,
    h(
      "div",
      { class: "doc-actions" },
      pageFooter(props) as ComponentChildren,
      copyMarkdown(props) as ComponentChildren,
      pageAgentMenu(props) as ComponentChildren,
    ),
    feedback(props) as ComponentChildren,
    pager(props) as ComponentChildren,
  );
}

/**
 * The docs page: the base shell with the header and the mobile drawer on top, the navigation
 * sidebar, the on-this-page aside, and the article between them. `styles/src/ui.css` places the
 * three columns; the chrome units keep their own sticky offsets and width breakpoints.
 */
const doc: Layout = (props) =>
  base({
    ...props,
    header: h(
      Fragment,
      null,
      shell(props) as ComponentChildren,
      drawer(props) as ComponentChildren,
    ),
    footer: shellFooter(props) as ComponentChildren,
    sidebar: sidebar(props) as ComponentChildren,
    main: h(Fragment, null, article(props), blockActions(props) as ComponentChildren),
    aside: toc(props) as ComponentChildren,
  });

export default doc;
