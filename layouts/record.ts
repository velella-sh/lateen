import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import doc from "./doc.ts";

/**
 * True when the body already supplies the page's `h1`: a record template usually names the record
 * itself, and the layout must not add a second `h1` above it.
 */
function titleFromBody(props: LayoutProps): boolean {
  return props.page.headings.some((heading) => heading.depth === 1);
}

/**
 * One record: breadcrumb, the title when the template does not carry it, and the template's rendered
 * body. The layout names no collection and no field: everything comes from the page and its data.
 */
function article(props: LayoutProps): ComponentChildren {
  return h(
    "article",
    { class: "record", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    h("div", { class: "record-body", dangerouslySetInnerHTML: { __html: props.page.html } }),
  );
}

/**
 * The record page: the base shell with the header and the mobile drawer, the navigation sidebar and
 * the record article. A page that names this layout without record data renders exactly like the
 * `doc` layout, so a mistake in a template never produces a bare page.
 */
const record: Layout = (props) =>
  props.record === undefined
    ? doc(props)
    : base({
        ...props,
        header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
        sidebar: sidebar(props) as ComponentChildren,
        main: article(props),
      });

export default record;
