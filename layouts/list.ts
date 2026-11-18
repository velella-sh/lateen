import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Heading, Island, Layout, LayoutProps, RecordProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import pageFooter from "../chrome/page-footer/index.ts";
import pagination, { paginationLinks } from "../chrome/pagination/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import cards, { CARD_CLASS, hrefOf } from "../components/cards/index.ts";
import datedList from "../components/dated-list/index.ts";
import { formatCount, pluralCategory } from "../components/reading-time/index.ts";
import recordTable, { type RecordColumn } from "../components/record-table/index.ts";
import { t } from "../i18n/index.ts";
import { formatField, isEmpty } from "../src/fields.ts";
import { baseOf } from "../src/url.ts";

/** The keys under `list` front matter this layout reads. The engine reads the rest. */
export const OPTIONS = ["view", "date"] as const;

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
export function titleFromBody(props: LayoutProps): boolean {
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
export function groupsOf(props: LayoutProps): ListGroupView[] {
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

/** The fields a card reads by name; every other field is a fact, up to {@link FACT_LIMIT}. */
const TITLE_FIELD = "title";
const SUMMARY_FIELD = "summary";
const STATUS_FIELD = "status";
const FACT_LIMIT = 3;

/** The view the page asks for: `cards` and `dated` opt in; a missing or malformed `list` keeps the table. */
function viewOf(props: LayoutProps): "table" | "cards" | "dated" {
  const front = props.page.frontMatter.list;
  if (front === null || typeof front !== "object" || Array.isArray(front)) return "table";
  const view = (front as Record<string, unknown>).view;
  return view === "cards" || view === "dated" ? view : "table";
}

/** The field a dated view reads for its dates: `list.date`, or `date`. */
function dateFieldOf(props: LayoutProps): string {
  const front = props.page.frontMatter.list;
  if (front === null || typeof front !== "object" || Array.isArray(front)) return "date";
  const date = (front as Record<string, unknown>).date;
  return typeof date === "string" && date.trim() !== "" ? date.trim() : "date";
}

/** One record as a card: its title, summary, status, and its first few other fields as facts. */
export function cardOf(props: LayoutProps, record: RecordProps): ComponentChildren {
  const fields = record.fields;
  const title = isEmpty(fields[TITLE_FIELD]) ? record.id : String(fields[TITLE_FIELD]);
  const summary = isEmpty(fields[SUMMARY_FIELD]) ? null : String(fields[SUMMARY_FIELD]);
  const status = isEmpty(fields[STATUS_FIELD]) ? null : fields[STATUS_FIELD];
  const facts = Object.keys(fields)
    .filter(
      (field) =>
        field !== TITLE_FIELD && field !== SUMMARY_FIELD && field !== STATUS_FIELD && !isEmpty(fields[field]),
    )
    .slice(0, FACT_LIMIT);
  const parts: ComponentChildren[] = [
    h("span", { class: "card-title" }, title),
    summary === null ? null : h("span", { class: "card-description" }, summary),
    status === null ? null : h("span", { class: "list-card-status" }, String(status)),
    facts.length === 0
      ? null
      : h(
          "dl",
          { class: "list-card-facts" },
          facts.map((field) =>
            h(
              "div",
              { class: "list-card-fact" },
              h("dt", null, field),
              h(
                "dd",
                null,
                formatField(fields[field], "text", props.page.lang, props.site.config) as ComponentChildren,
              ),
            ),
          ),
        ),
  ];
  const href = hrefOf(record.url);
  return href === undefined
    ? h("div", { class: CARD_CLASS }, ...parts)
    : h("a", { class: CARD_CLASS, href }, ...parts);
}

/** The records as a card grid, the view a gallery always shows and a list asks for with `list.view: cards`. */
export function cardsView(props: LayoutProps, records: readonly RecordProps[]): ComponentChildren {
  if (records.length === 0) return null;
  return cards({ children: records.map((record) => cardOf(props, record)) }) as ComponentChildren;
}

/**
 * The records as a dated list, the view a list asks for with `list.view: dated`: the same records, with
 * `list.date` naming the field the months come from, rendered by the dated-list component.
 */
export function datedView(props: LayoutProps, records: readonly RecordProps[]): ComponentChildren {
  if (records.length === 0) return null;
  const dateField = dateFieldOf(props);
  const items = records.map((record) => {
    const fields = record.fields;
    const label = isEmpty(fields[TITLE_FIELD]) ? record.id : fields[TITLE_FIELD];
    return {
      date: fields[dateField],
      label,
      url: record.url,
      ...(isEmpty(fields[STATUS_FIELD]) ? {} : { status: fields[STATUS_FIELD] }),
    };
  });
  return datedList({
    props: { items, status: "status" },
    page: props.page,
    site: props.site,
    html: "",
  } as never) as ComponentChildren;
}

/** How many records the page shows, in the page's digits and plural form. */
function countOf(props: LayoutProps, count: number): string {
  const lang = props.page.lang;
  return t(lang, `list_count_${pluralCategory(lang, count)}`, { n: formatCount(lang, count) });
}

/** The country line above the records: the count, and the page when the engine split the list. */
function summaryOf(props: LayoutProps, count: number): ComponentChildren {
  const pagination = props.list?.pagination;
  const page = pagination === undefined || pagination.total <= 1
    ? null
    : h("span", { class: "list-page" }, t(props.page.lang, "list_page_of", {
        page: formatCount(props.page.lang, pagination.page),
        total: formatCount(props.page.lang, pagination.total),
      }));
  return h("p", { class: "list-summary" }, h("span", { class: "list-count" }, countOf(props, count)), page);
}

/** The records in the view the page asks for: a table by default, cards or a dated list when `list.view` names it. */
function recordsView(props: LayoutProps, records: readonly RecordProps[]): ComponentChildren {
  if (records.length === 0) return null;
  const view = viewOf(props);
  if (view === "cards") return cardsView(props, records);
  if (view === "dated") return datedView(props, records);
  return table(props, records);
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
            recordsView(props, group.records),
          ),
        )
      : list === undefined
        ? null
        : recordsView(props, list.records);
  const count = list?.records.length ?? 0;
  return h(
    "article",
    { class: "list", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    h("div", { class: "list-intro", dangerouslySetInnerHTML: { __html: props.page.html } }),
    list === undefined ? null : summaryOf(props, count),
    list !== undefined && list.pagination.next !== undefined && viewOf(props) === "dated"
      ? h(
          "p",
          { class: "list-dated-continues" },
          t(props.page.lang, "list_dated_continues", {
            page: formatCount(props.page.lang, list.pagination.page + 1),
          }),
        )
      : null,
    list !== undefined && count === 0 ? h("p", { class: "list-empty" }, t(props.page.lang, "list_empty")) : null,
    records,
    list === undefined
      ? null
      : (pagination({ url: props.page.url, lang: props.page.lang, pagination: list.pagination }) as ComponentChildren),
    h("div", { class: "doc-actions" }, pageFooter(props) as ComponentChildren),
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
  // The engine writes only the islands its own props name, and reads that list back after the layout
  // runs; appending here is how the layout asks for its client.
  // shortcut: mutating `islands`; upgrade when a layout can declare a client island.
  const islands = props.islands as Island[];
  if (!islands.some((island) => island.src === sortIsland.src)) islands.push(sortIsland);
  const head =
    props.list === undefined
      ? props.head
      : { ...props.head, links: [...props.head.links, ...paginationLinks(props.list.pagination)] };
  return base({
    ...props,
    head,
    islands,
    header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
    sidebar: sidebar(props) as ComponentChildren,
    main: article(props),
    aside: toc(tocFor(props)) as ComponentChildren,
  });
};

export default list;
