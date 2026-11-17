import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Heading, Island, Layout, LayoutProps, RecordProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import recordTable, { type RecordColumn } from "../components/record-table/index.ts";
import { baseOf } from "../src/url.ts";

/* The engine ships a component's island only when the page's Markdown names its directive, and a list
   page names no directive: this layout draws the table itself. The island is the record-table client,
   so the same control the gallery shows also runs on a list.
   shortcut: the island path is the engine's convention; revisit when a layout can declare its client. */
const SORT_ISLAND = "assets/theme/islands/components/record-table/client.js";

/** A group as the page shows it: the engine's key, its heading anchor, and its records. */
interface ListGroupView {
  key: string;
  id: string;
  count: number;
  records: readonly RecordProps[];
}

/** True when the body already supplies the page's `h1`, by the same rule as `doc` and `record`. */
function titleFromBody(props: LayoutProps): boolean {
  return props.page.headings.some((heading) => heading.depth === 1);
}

/** A group key as an anchor id; a repeated or alike-slugged key takes a stable numeric suffix. */
function groupId(key: string, used: Set<string>): string {
  const base = key.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "group";
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/** The engine's groups in its order, each with the id its section and its TOC entry share. */
function groupsOf(props: LayoutProps): ListGroupView[] {
  const used = new Set<string>();
  return (props.list?.groups ?? []).map((group) => ({
    key: group.key,
    id: groupId(group.key, used),
    count: group.count ?? group.records.length,
    records: group.records,
  }));
}

/** The columns the records name: their field order, with no field named in this file. */
function columnsOf(records: readonly RecordProps[]): RecordColumn[] {
  const first = records[0];
  return Object.keys(first?.fields ?? {}).map((field) => ({ field }));
}

/** One record table, in the shape the record-table component reads. */
function table(props: LayoutProps, records: readonly RecordProps[]): ComponentChildren {
  const columns = columnsOf(records);
  if (records.length === 0 || columns.length === 0) return null;
  return recordTable({
    props: { records, columns },
    page: props.page,
    site: props.site,
    html: "",
  } as never) as ComponentChildren;
}

/**
 * A list page: the page title and body as the introduction, then the records the engine selected,
 * in the engine's order, one section per group when it grouped them. A page that names this layout
 * without list data renders its body alone.
 */
function article(props: LayoutProps): ComponentChildren {
  const list = props.list;
  const groups = groupsOf(props);
  const records: ComponentChildren =
    groups.length > 0
      ? groups.map((group) =>
          h(
            "section",
            { class: "list-group" },
            h(
              "h2",
              { id: group.id },
              group.key,
              " ",
              h("span", { class: "list-group-count" }, String(group.count)),
            ),
            table(props, group.records),
          ),
        )
      : list === undefined
        ? null
        : table(props, list.records);
  return h(
    "article",
    { class: "list", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    h("div", { class: "list-intro", dangerouslySetInnerHTML: { __html: props.page.html } }),
    records,
  );
}

/** The page's own headings plus one `h2` per group, on a copy so the page itself stays untouched. */
function tocFor(props: LayoutProps): LayoutProps {
  const groups = groupsOf(props);
  if (groups.length === 0) return props;
  const headings: Heading[] = [
    ...props.page.headings,
    ...groups.map((group) => ({ depth: 2 as const, id: group.id, text: group.key, pos: props.page.source })),
  ];
  return { ...props, page: { ...props.page, headings } };
}

/** The list page: the base shell and the article, with the navigation sidebar and the group headings on this page. */
const list: Layout = (props) => {
  const sortIsland: Island = { name: "record-table", src: `${baseOf(props.site)}/${SORT_ISLAND}` };
  return base({
    ...props,
    islands: [...props.islands.filter((island) => island.src !== sortIsland.src), sortIsland],
    header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
    sidebar: sidebar(props) as ComponentChildren,
    main: article(props),
    aside: toc(tocFor(props)) as ComponentChildren,
  });
};

export default list;
