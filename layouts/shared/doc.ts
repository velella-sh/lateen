import { h } from "preact";
import type { ComponentChildren } from "preact";
import { ChevronDown, Copy } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { staleSlot } from "../../src/stale.ts";
import lastUpdated from "../../chrome/last-updated/index.ts";
import { docPageFooter, docPageTools } from "../../chrome/page-footer/index.ts";
import sourceMode from "../../chrome/source-mode/index.ts";
import pager from "../../chrome/pager/index.ts";
import { tocFold } from "../../chrome/toc/index.ts";
import { highlightFences } from "../../components/code/index.ts";
import { renderDriftBanner } from "../../components/drift-banner/render.ts";
import { pageToolSlot } from "./page-tool.ts";
import { renderPageStatus } from "../../components/page-status/render.ts";
import reportViewer from "./report-viewer.ts";
import { renderReadingTime } from "../../components/reading-time/render.ts";
import { renderVersionNotice } from "../../components/version-notice/render.ts";
import { renderTrustPanel } from "../../components/trust-panel/render.ts";
import { codeBackgrounds } from "../../src/brand.ts";
import { articleHtml } from "../../src/article-html.ts";
import { articleHeader, articleShell, statusProps } from "./index.ts";

/**
 * The page itself: breadcrumb, drift banner, status banner, title, description, grouped trust,
 * freshness and reading-time metadata, body, edit link and Back to top, and pager, marked for
 * Pagefind. The drift banner reads `site.data.drift` and keeps itself out of the page when the site
 * has no findings for this URL; the trust chip reads `site.data.trust` and stays out until the site
 * has an entry for this URL; the edit link is likewise left out when the repository gives no URL.
 */
function article(props: LayoutProps): ComponentChildren {
  const { page } = props;
  const quickstart = page.frontMatter.quickstart === true;
  const backdrops = codeBackgrounds(props.site.config.theme.options);
  return h(
    "article",
    { class: "doc", "data-pagefind-body": true },
    articleHeader(props, {
      tools: h("details", { class: "doc-tools", "data-pagefind-ignore": true },
        h("summary", null, icon({ node: Copy }), t(page.lang, "article_page_tools"), icon({ node: ChevronDown, class: "doc-tools-chevron" })),
        h("div", { class: "article-tool-panel" }, ...docPageTools(props, sourceMode(props) as ComponentChildren)),
      ),
      notices: [
        renderDriftBanner({ inline: false, renderComponent: props.renderComponent, props: {}, page, site: props.site, html: "" }) as ComponentChildren,
        renderPageStatus({ inline: false, renderComponent: props.renderComponent, props: statusProps(page), page, site: props.site, html: "" }) as ComponentChildren,
        renderVersionNotice({ inline: false, renderComponent: props.renderComponent, props: {}, page, site: props.site, html: "" }) as ComponentChildren,
      ],
      meta: quickstart
        ? undefined
        : [
            renderTrustPanel({ inline: false, renderComponent: props.renderComponent, props: {}, page, site: props.site, html: "" }) as ComponentChildren,
            lastUpdated(props) as ComponentChildren,
            renderReadingTime({ inline: false, renderComponent: props.renderComponent, props: {}, page, site: props.site, html: "" }) as ComponentChildren,
          ],
    }),
    staleSlot(props),
    tocFold(props) as ComponentChildren,
    page.reportView === undefined
      ? h("div", { class: "doc-body", "data-quickstart": quickstart || undefined, dangerouslySetInnerHTML: { __html: highlightFences(articleHtml(page.html, page.lang), backdrops, page.lang, page.source.file) } })
      : h("div", { class: "doc-body" }, reportViewer(props)),
    pageToolSlot(props),
    docPageFooter(props) as ComponentChildren,
    pager(props) as ComponentChildren,
  );
}

/**
 * The docs page: the base shell with the header and the mobile drawer on top, the navigation
 * sidebar, the on-this-page aside, and the article between them. `styles/src/ui.css` places the
 * three columns; the chrome units keep their own sticky offsets and width breakpoints.
 */
export function renderDoc(props: LayoutProps) {
  return articleShell(props, {
    base: { showSourceMode: false },
    main: article(props),
  });
}
