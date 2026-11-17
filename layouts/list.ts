import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import recordTable, { type RecordColumn } from "../components/record-table/index.ts";

/** True when the body already supplies the page's `h1`, by the same rule as `doc` and `record`. */
function titleFromBody(props: LayoutProps): boolean {
  return props.page.headings.some((heading) => heading.depth === 1);
}

/** The columns the records name: their field order, with no field named in this file. */
function columnsOf(props: LayoutProps): RecordColumn[] {
  const first = props.list?.records[0];
  return Object.keys(first?.fields ?? {}).map((field) => ({ field }));
}

/**
 * A list page: the page title and body as the introduction, then the records the engine selected,
 * in the engine's order. A page that names this layout without list data renders its body alone.
 */
function article(props: LayoutProps): ComponentChildren {
  const list = props.list;
  const columns = list === undefined ? [] : columnsOf(props);
  return h(
    "article",
    { class: "list", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    h("div", { class: "list-intro", dangerouslySetInnerHTML: { __html: props.page.html } }),
    list !== undefined && list.records.length > 0 && columns.length > 0
      ? (recordTable({
          props: { records: list.records, columns },
          page: props.page,
          site: props.site,
          html: "",
        } as never) as ComponentChildren)
      : null,
  );
}

/** The list page: the base shell and the article, with the navigation sidebar and no on-this-page column. */
const list: Layout = (props) =>
  base({
    ...props,
    header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
    sidebar: sidebar(props) as ComponentChildren,
    main: article(props),
  });

export default list;
