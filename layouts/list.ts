import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Heading, Island, Layout, LayoutProps, RecordProps } from "@velella/mizzen/contracts";
import { blogFeedHref, blogSubscribe, withBlogFeed } from "./blog/feed.ts";
import { authorNameOf, authorPageOf, blogAuthorOf, blogKindOf, blogOf, postsOf } from "./blog/index.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import pageFooter from "../chrome/page-footer/index.ts";
import pagination, { paginationLinks } from "../chrome/pagination/index.ts";
import toc from "../chrome/toc/index.ts";
import cards, { CARD_CLASS, hrefOf } from "../components/cards/index.ts";
import datedList from "../components/dated-list/index.ts";
import { subscribePanel } from "../components/add-to-calendar/index.ts";
import { formatCount, pluralCategory } from "../components/reading-time/index.ts";
import recordTable, { columnsOf as tableColumnsOf, type RecordColumn } from "../components/record-table/index.ts";
import status, { type StatusTone } from "../components/status/index.ts";
import { Rss } from "lucide";
import { icon } from "../src/icon.ts";
import { collectionDownloads } from "../src/collection-downloads.ts";
import { t } from "../i18n/index.ts";
import { collectionFeeds } from "../src/collection-feeds.ts";
import { calendarDate, calendarMonth, configuredCalendar } from "../src/dates.ts";
import { formatField, isEmpty } from "../src/fields.ts";
import { snapshotPanel } from "../src/snapshot-panel.ts";
import { baseOf } from "../src/url.ts";
import { pageHtml } from "../src/article-html.ts";
import { articleShell, titleFromBody } from "./shared/index.ts";

/** The keys under `list` front matter this layout reads. The engine reads the rest. */
export const OPTIONS = ["view", "date", "columns"] as const;

/* The engine ships a component's island only when the page's Markdown names its directive, and a list
   page names no directive: this layout draws the table itself. The island is the record-table client,
   so the same control the gallery shows also runs on a list.
   shortcut: the island path is the engine's convention; revisit when a layout can declare its client. */
const SORT_ISLAND = "assets/theme/islands/components/record-table/client.js";

/** The island that reveals the subscribe panel's copy buttons; a list with no calendar never loads it. */
const SUBSCRIBE_ISLAND = "assets/theme/islands/components/add-to-calendar/client.js";

/** A group as the page shows it: the engine's key, its heading anchor, its page, and its records. */
interface ListGroupView {
  key: string;
  id: string;
  count: number;
  records: readonly RecordProps[];
  url?: string;
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
    ...(group.url === undefined || group.url === "" ? {} : { url: group.url }),
  }));
}

/** Expanded list indexes carry links and counts instead of the groups' records. */
function expandedIndex(props: LayoutProps): boolean {
  const list = props.list;
  return list !== undefined && list.records.length === 0 && list.groups.length > 0 &&
    list.groups.every((group) => !!group.url && group.count !== undefined && group.records.length === 0);
}

/** The columns the page names with `list.columns`, else the first record's field order. */
function columnsOf(props: LayoutProps, records: readonly RecordProps[]): RecordColumn[] {
  const front = props.page.frontMatter.list;
  const named =
    front !== null && typeof front === "object" && !Array.isArray(front)
      ? tableColumnsOf((front as Record<string, unknown>).columns)
      : [];
  if (named.length > 0) return named;
  return Object.keys(records[0]?.fields ?? {}).map((field) => ({ field }));
}

/** One record table, in the shape the record-table component reads. */
function table(props: LayoutProps, records: readonly RecordProps[]): ComponentChildren {
  const columns = columnsOf(props, records);
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

/** A dated archive with more calendar months than this gets a table of contents above it. */
const TOC_AFTER_MONTHS = 3;

/** The distinct calendar months the dated records span; a date the language cannot read is not one. */
function monthCountOf(props: LayoutProps, records: readonly RecordProps[], dateField: string): number {
  const months = new Set<string>();
  for (const record of records) {
    const value = record.fields[dateField];
    const month = typeof value === "string" ? calendarMonth(value, props.page.lang, configuredCalendar(props.site.config)) : undefined;
    if (month !== undefined) months.add(month.key);
  }
  return months.size;
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
  const calendar = props.list?.calendars?.[0]?.url;
  const toc = monthCountOf(props, records, dateField) > TOC_AFTER_MONTHS;
  return datedList({
    props: { items, status: "status", ...(toc ? { toc: true } : {}), ...(calendar === undefined ? {} : { calendar }) },
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

/** The groups as links before the records: each group's page when it has one, else its section anchor. */
function groupSummary(props: LayoutProps): ComponentChildren {
  const groups = groupsOf(props).filter((group) => group.count > 0);
  if (groups.length === 0 || isChanges(props)) return null;
  return h(
    "nav",
    { class: "list-group-summary" },
    h(
      "ul",
      null,
      groups.map((group) =>
        h(
          "li",
          null,
          h(
            "a",
            { href: group.url ?? `#${group.id}` },
            group.key,
            " ",
            h("span", { class: "list-group-count" }, String(group.count)),
          ),
        ),
      ),
    ),
  );
}

/** The records in the view the page asks for: a table by default, cards or a dated list when `list.view` names it. */
function recordsView(props: LayoutProps, records: readonly RecordProps[]): ComponentChildren {
  if (records.length === 0) return null;
  const view = viewOf(props);
  if (view === "cards") return cardsView(props, records);
  if (view === "dated") return datedView(props, records);
  return table(props, records);
}

/** The tone of each event type's badge; an unknown type reads neutral. */
const EVENT_TONES: Readonly<Record<string, StatusTone>> = {
  added: "positive",
  removed: "negative",
  changed: "info",
  renamed: "caution",
  imported: "neutral",
};

/** A path on this site or an https address, as the engine's record links are written. */
const SAFE_HREF = /^(?:\/(?![/\\])|https:\/\/)[^\s"<>\\]*$/i;

/** True for the engine's generated changelog pages, whose collection is `<name>.changes`. */
function isChanges(props: LayoutProps): boolean {
  return props.list !== undefined && props.list.collection.endsWith(".changes");
}

/** The event type of a change record, as written. */
function eventTypeOf(record: RecordProps): string {
  const type = record.fields.type;
  return typeof type === "string" ? type.trim() : "";
}

/** One change row: the date, the event type as a status badge, the record's link, and a changed field. */
function changeRow(props: LayoutProps, record: RecordProps): ComponentChildren {
  const lang = props.page.lang;
  const type = eventTypeOf(record);
  const tone = EVENT_TONES[type] ?? "neutral";
  const label = type in EVENT_TONES ? t(lang, `history_${type}`) : type;
  const id = typeof record.fields.record === "string" && record.fields.record.trim() !== "" ? record.fields.record.trim() : record.id;
  const href = typeof record.links.record === "string" && SAFE_HREF.test(record.links.record) ? record.links.record : undefined;
  const day = typeof record.fields.date === "string" ? calendarDate(record.fields.date, lang, configuredCalendar(props.site.config)) : undefined;
  const field = typeof record.fields.field === "string" && record.fields.field.trim() !== "" ? record.fields.field.trim() : undefined;
  return h(
    "li",
    { class: "dated-list-item changes-item" },
    day === undefined ? null : h("time", { class: "dated-list-day", datetime: day.datetime }, day.text),
    status({ props: { tone, label }, html: "", page: props.page, site: props.site } as never) as ComponentChildren,
    href === undefined ? h("span", { class: "changes-record" }, id) : h("a", { class: "changes-record", href }, id),
    field === undefined ? null : h("code", { class: "changes-field" }, field),
  );
}

/**
 * A collection's changelog: the engine's change records, grouped by the snapshot date it already
 * grouped them by, each with the event type as a badge and a link to the record. The page's feed
 * link is drawn above by the article; an empty history is left to the list's empty note.
 */
function changesView(props: LayoutProps): ComponentChildren {
  const list = props.list;
  if (list === undefined || list.records.length === 0) return null;
  const groups = groupsOf(props);
  if (groups.length === 0) return h("ol", { class: "dated-list-items changes-list" }, list.records.map((record) => changeRow(props, record)));
  return groups.map((group) => {
    const day = calendarDate(group.key, props.page.lang, configuredCalendar(props.site.config));
    return h(
      "section",
      { class: "list-group changes-group" },
      h("h2", { id: group.id }, day === undefined ? group.key : day.text),
      h("ol", { class: "dated-list-items changes-list" }, group.records.map((record) => changeRow(props, record))),
    );
  });
}

/** The date in a blog row: a `<time>` when the engine wrote a real date, else the text as written. */
function blogDate(props: LayoutProps, iso: string): ComponentChildren {
  const date = calendarDate(iso, props.page.lang, configuredCalendar(props.site.config));
  return date === undefined ? h("span", null, iso) : h("time", { datetime: date.datetime }, date.text);
}

/** One post in a blog list: its title link, date, author, and description when it has one. */
function blogItem(props: LayoutProps, post: ReturnType<typeof postsOf>[number]): ComponentChildren {
  const lang = props.page.lang;
  const name = authorNameOf(props.site, post.author);
  const authorPage = authorPageOf(props.site, post.author);
  return h(
    "li",
    { class: "blog-item" },
    h("h2", { class: "blog-item-title" }, h("a", { href: post.url }, post.title)),
    h(
      "p",
      { class: "blog-meta" },
      blogDate(props, post.date),
      h("span", { "aria-hidden": "true" }, " · "),
      h(
        "span",
        { class: "blog-author" },
        h("span", { class: "post-by" }, t(lang, "post_by")),
        " ",
        authorPage === undefined ? name : h("a", { href: authorPage.url }, name),
      ),
    ),
    post.description === undefined ? null : h("p", { class: "blog-description" }, post.description),
  );
}

/** The localized heading of an archive or author page. */
function blogHeading(props: LayoutProps): ComponentChildren {
  const lang = props.page.lang;
  if (blogKindOf(props.page) !== "author") return h("h1", null, t(lang, "blog_archive"));
  const record = blogAuthorOf(props.page);
  const id = typeof record?.id === "string" ? record.id : "";
  return h("h1", null, t(lang, "blog_author_heading", { name: authorNameOf(props.site, id) }));
}

/**
 * A blog archive or author page: its localized heading and the public posts the engine planned,
 * in the engine's newest-first order. The engine gives these pages no records, so the record
 * table would be empty; the posts are the page.
 */
function blogArticle(props: LayoutProps, feed: string | undefined): ComponentChildren {
  const posts = postsOf(props.page);
  return h(
    "article",
    { class: "list blog", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : blogHeading(props),
    feed === undefined ? null : h("p", { class: "list-feed" }, blogSubscribe(feed, props.page.lang)),
    props.page.html === ""
      ? null
      : h("div", { class: "list-intro", dangerouslySetInnerHTML: { __html: pageHtml(props.page.html, props.page.lang) } }),
    posts.length === 0
      ? h("p", { class: "list-empty" }, t(props.page.lang, "blog_empty"))
      : h("ul", { class: "blog-list" }, posts.map((post) => blogItem(props, post))),
    h("div", { class: "doc-actions" }, pageFooter(props) as ComponentChildren),
  );
}

/**
 * A list page: the page title and body as the introduction, then the records the engine selected,
 * in the engine's order, one section per group when it grouped them. A page that names this layout
 * without list data renders its body alone. A blog archive or author page lists its posts instead.
 */
function article(props: LayoutProps, blogFeed: string | undefined): ComponentChildren {
  if (blogOf(props.page) !== undefined) return blogArticle(props, blogFeed);
  const list = props.list;
  const groups = groupsOf(props);
  const expanded = expandedIndex(props);
  const records: ComponentChildren = expanded
    ? null
    : isChanges(props)
      ? changesView(props)
      : groups.length > 0
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
  const count = expanded ? groups.reduce((total, group) => total + group.count, 0) : list?.records.length ?? 0;
  return h(
    "article",
    { class: "list", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    h("div", { class: "list-intro", dangerouslySetInnerHTML: { __html: pageHtml(props.page.html, props.page.lang) } }),
    list === undefined ? null : summaryOf(props, count),
    collectionDownloads(props),
    list === undefined
      ? null
      : subscribePanel(
          {
            ...(list.calendars === undefined ? {} : { calendars: list.calendars }),
            groups: list.groups,
          },
          props.page.lang,
        ),
    list?.feed === undefined
      ? null
      : h(
          "p",
          { class: "list-feed" },
          h(
            "a",
            { class: "list-feed-link", href: list.feed },
            h("span", { class: "list-feed-icon", "aria-hidden": "true" }, icon({ node: Rss })),
            t(props.page.lang, "dated_list_feed"),
          ),
        ),
    collectionFeeds(props),
    list !== undefined && list.pagination.next !== undefined && viewOf(props) === "dated"
      ? h(
          "p",
          { class: "list-dated-continues" },
          t(props.page.lang, "list_dated_continues", {
            page: formatCount(props.page.lang, list.pagination.page + 1),
          }),
        )
      : null,
    list !== undefined && !expanded && count === 0 ? h("p", { class: "list-empty" }, t(props.page.lang, "list_empty")) : null,
    groupSummary(props),
    records === null ? null : h("div", { class: "list-records" }, records),
    snapshotPanel(props),
    list === undefined
      ? null
      : (pagination({ url: props.page.url, lang: props.page.lang, pagination: list.pagination }) as ComponentChildren),
    h("div", { class: "doc-actions" }, pageFooter(props) as ComponentChildren),
  );
}

/** The page's own headings plus one `h2` per group, on a copy so the page itself stays untouched. */
function tocFor(props: LayoutProps): LayoutProps {
  const groups = groupsOf(props);
  if (groups.length === 0 || expandedIndex(props)) return props;
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
  const calendars =
    (props.list?.calendars?.length ?? 0) > 0 || (props.list?.groups.some((group) => (group.calendars?.length ?? 0) > 0) ?? false);
  const subscribeIsland: Island = { name: "add-to-calendar", src: `${baseOf(props.site)}/${SUBSCRIBE_ISLAND}` };
  if (calendars && !islands.some((island) => island.src === subscribeIsland.src)) islands.push(subscribeIsland);
  const head =
    props.list === undefined
      ? props.head
      : { ...props.head, links: [...props.head.links, ...paginationLinks(props.list.pagination)] };
  const blogFeed = blogFeedHref(props);
  return articleShell(props, {
    base: { head: withBlogFeed(head, blogFeed, props.site.config.url), islands },
    main: article(props, blogFeed),
    aside: toc(tocFor(props)) as ComponentChildren,
  });
};

export default list;
