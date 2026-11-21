import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import base, { type BaseProps } from "../base.ts";
import drawer from "../../chrome/drawer/index.ts";
import shell, { footer as shellFooter } from "../../chrome/shell/index.ts";
import sidebar from "../../chrome/sidebar/index.ts";
import toc from "../../chrome/toc/index.ts";
import type { PageStatusProps } from "../../components/page-status/index.ts";

/**
 * The render path the article layouts share: the document shell a page places its own main column
 * in, and the two front-matter readings those layouts repeat.
 *
 * It is a folder, not `layouts/shared.ts`, because the engine registers every file directly in
 * `layouts/` as a layout unit and requires each one to default-export a layout; `layouts/blog/`
 * holds the blog helpers the same way.
 */

/**
 * True when the body already supplies the page's `h1`, by the same rule as the engine's
 * `resolveTitle`: any top-level depth-1 heading counts, even when front matter wins the title,
 * so the layout never renders a second `h1` above it.
 */
export function titleFromBody(props: LayoutProps): boolean {
  return props.page.headings.some((heading) => heading.depth === 1);
}

/** The status banner's props from front matter: a key is passed only when it holds a usable value. */
export function statusProps(page: LayoutProps["page"]): PageStatusProps {
  const { status, since, replaced_by } = page.frontMatter;
  return {
    ...(status === undefined ? {} : { status }),
    ...(typeof since === "string" ? { since } : {}),
    ...(typeof replaced_by === "string" ? { replaced_by } : {}),
  };
}

/** The columns and base overrides a layout fills in the shared shell. */
export interface ArticleSlots {
  /** The page itself, between the sidebar and the aside. */
  readonly main: ComponentChildren;
  /**
   * The aside column beside the main one: the page's table of contents unless the layout puts its own
   * headings there, and `null` for a page that has no aside column at all.
   */
  readonly aside?: ComponentChildren;
  /**
   * Base-only props such as `head`, `islands`, or `showSourceMode`. They reach the document and never
   * the chrome, which keeps reading the layout's own props.
   */
  readonly base?: Partial<Pick<BaseProps, "head" | "islands" | "showSourceMode">>;
}

/**
 * The docs shell: the base document with the site header and the mobile drawer on top, the footer, the
 * navigation sidebar, the aside column, and the layout's own main column between them. The chrome units
 * keep their own landmarks, sticky offsets, and width breakpoints; this only places them.
 */
export function articleShell(props: LayoutProps, slots: ArticleSlots) {
  return base({
    ...props,
    ...slots.base,
    header: h(Fragment, null, shell(props) as ComponentChildren, drawer(props) as ComponentChildren),
    footer: shellFooter(props) as ComponentChildren,
    sidebar: sidebar(props) as ComponentChildren,
    main: slots.main,
    aside: slots.aside === undefined ? (toc(props) as ComponentChildren) : slots.aside,
  });
}
