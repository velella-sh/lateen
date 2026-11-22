import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { withBase } from "../link-card/index.ts";

/** Class on the tool's section. */
export const TOOL_CLASS = "page-tool";

/** Class on the section's heading. */
export const TITLE_CLASS = "page-tool-title";

/** Class on the element a tool fills; its children are the no-JavaScript fallback. */
export const SLOT_CLASS = "page-tool-slot";

/** Class on the fallback text that stays when the tool's module does not run. */
export const FALLBACK_CLASS = "page-tool-fallback";

/** Class on the fallback link to the tool's own file. */
export const LINK_CLASS = "page-tool-link";

/** The id the section is named by; one tool per page, so one id. */
export const TITLE_ID = "page-tool-title";

/** Props: the site base and the source-relative path from the page's `tool:` front matter. */
export type PageToolProps = {
  /** The site's `base`, so the module and the fallback link resolve under a nested path. */
  base?: string;
  /** The file the page named in `tool:`, relative to the site source. */
  tool?: string;
};

/**
 * The asset URL of a page tool, or `undefined` when the front matter holds no usable path.
 * The engine copies the file to the same site-relative path, so the URL is the site's base plus
 * that path. A value that names another scheme is refused rather than linked.
 */
export function toolHref(base: string, tool: unknown): string | undefined {
  if (typeof tool !== "string") return undefined;
  const path = tool.trim().replace(/^\/+/, "");
  if (path === "" || /^[a-z][a-z0-9+.-]*:/i.test(path)) return undefined;
  return withBase(base, `/${path}`);
}

/**
 * A page's interactive tool: a named section with an empty slot the tool's module fills, a
 * fallback that stays readable without JavaScript, and the module itself. The module finds the
 * slot by `data-page-tool` and replaces the fallback; without it the link still reaches the file.
 */
export function renderPageTool({ props, page }: ComponentProps<PageToolProps>) {
  const href = toolHref(props.base ?? "", props.tool);
  if (href === undefined) return null;
  const lang = page.lang;
  return h(
    "section",
    { class: TOOL_CLASS, "aria-labelledby": TITLE_ID },
    h("h2", { class: TITLE_CLASS, id: TITLE_ID }, t(lang, "page_tool_title")),
    h(
      "div",
      { class: SLOT_CLASS, "data-page-tool": true },
      h(
        "p",
        { class: FALLBACK_CLASS },
        `${t(lang, "page_tool_fallback")} `,
        h("a", { class: LINK_CLASS, href }, t(lang, "page_tool_open")),
      ),
    ),
    h("script", { type: "module", src: href }),
  );
}
