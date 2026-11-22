import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { renderBase, type BaseProps } from "./base.ts";
import breadcrumb from "../../chrome/breadcrumb/index.ts";
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

/** The optional slots of the shared article header. */
export interface ArticleHeaderOptions {
  /** Controls at the end of the breadcrumb row, such as the page tools disclosure. */
  readonly tools?: ComponentChildren;
  /** Notices between the breadcrumb row and the title, such as drift, status, or version notices. */
  readonly notices?: ComponentChildren;
  /** The title; `undefined` reads the page title and `null` leaves the body's own h1 in place. */
  readonly title?: string | null;
  /** The description; `undefined` reads front matter and `null` leaves it out. */
  readonly description?: string | null;
  /** The secondary facts under the description, such as trust, dates, and reading time. */
  readonly meta?: ComponentChildren;
}

/** The authored description, trimmed to nothing when the front matter has no usable text. */
function descriptionOf(page: LayoutProps["page"]): string | null {
  const description = page.frontMatter.description;
  return typeof description === "string" && description.trim() !== "" ? description : null;
}

/**
 * The header every article layout shares, from the breadcrumb to the secondary facts: the trail and
 * optional tools, the notices a page carries, the title unless the body supplies its own `h1`, the
 * authored description, and one quiet metadata row. Each piece is optional, so a quickstart without
 * metadata and a page with no description skip that slot instead of inventing content.
 *
 * The markup is the order the layouts already used; this only names the seam. `styles/src/document.css`
 * and `styles/src/content.css` own the visual hierarchy, so every consumer of the theme gets the
 * tightened spacing, wrapping title, and compact metadata without touching its own Markdown or CSS.
 */
export function articleHeader(props: LayoutProps, options: ArticleHeaderOptions = {}): ComponentChildren {
  const title = options.title === undefined ? props.page.title : options.title;
  const description = options.description === undefined ? descriptionOf(props.page) : options.description;
  return [
    options.tools === undefined
      ? (breadcrumb(props) as ComponentChildren)
      : h("div", { class: "doc-context" }, breadcrumb(props) as ComponentChildren, options.tools),
    options.notices ?? null,
    title === null || titleFromBody(props) ? null : h("h1", null, title),
    description === null ? null : h("p", { class: "doc-description dek" }, description),
    options.meta === undefined ? null : h("div", { class: "doc-meta" }, options.meta),
  ];
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
  return renderBase({
    ...props,
    ...slots.base,
    header: h(Fragment, null, shell(props) as ComponentChildren, drawer(props) as ComponentChildren),
    footer: shellFooter(props) as ComponentChildren,
    sidebar: sidebar(props) as ComponentChildren,
    main: slots.main,
    aside: slots.aside === undefined ? (toc(props) as ComponentChildren) : slots.aside,
  });
}
