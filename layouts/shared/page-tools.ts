import { h } from "preact";
import type { ComponentChildren } from "preact";
import { ChevronDown, Copy } from "lucide";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";
import { docPageTools } from "../../chrome/page-footer/index.ts";

/**
 * The one Page tools disclosure an article layout puts at the end of its breadcrumb row: the page's
 * Markdown and agent actions, the report link, and whatever else the layout offers about the page
 * itself (Source mode, calendar links, downloads). It is a native `<details>`, so it opens and
 * closes without JavaScript and keeps every one of those controls out of the reading flow until
 * the reader asks for them.
 */
export function pageTools(props: LayoutProps, ...extra: ComponentChildren[]): ComponentChildren {
  const { page } = props;
  return h(
    "details",
    { class: "doc-tools", "data-pagefind-ignore": true },
    h("summary", null, icon({ node: Copy }), t(page.lang, "article_page_tools"), icon({ node: ChevronDown, class: "doc-tools-chevron" })),
    h("div", { class: "article-tool-panel" }, ...docPageTools(props, ...extra)),
  );
}
