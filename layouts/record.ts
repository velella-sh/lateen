import { h } from "preact";
import { pageToolSlot } from "./shared/page-tool.ts";
import type { ComponentChildren } from "preact";
import type { DataRecord, Heading, Island, Layout, LayoutProps, RecordPos } from "@velella/mizzen/contracts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import lastUpdated from "../chrome/last-updated/index.ts";
import { docPageFooter } from "../chrome/page-footer/index.ts";
import sourceMode from "../chrome/source-mode/index.ts";
import toc, { tocFold } from "../chrome/toc/index.ts";
import addToCalendar from "../components/add-to-calendar/index.ts";
import { classNameOf, replacementOf } from "../components/page-status/index.ts";
import embedCode from "../components/embed-code/index.ts";
import recordHistory from "../components/record-history/index.ts";
import { collectionApi } from "../src/collection-api.ts";
import { collectionDownloads } from "../src/collection-downloads.ts";
import { t } from "../i18n/index.ts";
import { FACTS_ID, factsOf, factsPanel, recordHeader, relatedPanel, summaryOf } from "../src/record-parts.ts";
import { renderDoc } from "./shared/doc.ts";
import { articleShell } from "./shared/index.ts";
import { pageTools } from "./shared/page-tools.ts";
import { staleSlot } from "../src/stale.ts";
import { snapshotPanel } from "../src/snapshot-panel.ts";
import { baseOf, safeHref } from "../src/url.ts";
import { pageHtml } from "../src/article-html.ts";
import { collectionFeeds } from "../src/collection-feeds.ts";
import { fieldsOf } from "../components/record-history/index.ts";

/** Class on the embed code the record offers; `record.css` places it. */
const EMBED_CLASS = "record-embed";

/* The engine ships a component's island only when the page's Markdown names its directive, and the
   record layout draws the history itself. The client filters the events in place; without it the
   full history still reads. */
const HISTORY_ISLAND = "assets/theme/islands/components/record-history/client.js";

/** The page's own headings plus the facts panel first, on a copy so the page itself stays untouched. */
function tocFor(props: LayoutProps): LayoutProps {
  if (factsOf(props).length === 0) return props;
  const heading: Heading = { depth: 2, id: FACTS_ID, text: t(props.page.lang, "record_facts"), pos: props.page.source };
  return { ...props, page: { ...props.page, headings: [heading, ...props.page.headings] } };
}

/**
 * The embed code for the record's `embed` view, when the engine built one. The view is a second page
 * of the same record, so the snippet points at it and the copy links back to this page; a record
 * without the view shows nothing.
 */
function embedPanel(props: LayoutProps): ComponentChildren {
  const src = props.record?.views?.embed;
  if (typeof src !== "string" || src === "") return null;
  const label = t(props.page.lang, "record_embed");
  return h(
    "section",
    { class: EMBED_CLASS, "aria-labelledby": "record-embed" },
    h("h2", { id: "record-embed" }, label),
    embedCode({ props: { src, title: props.page.title }, page: props.page, site: props.site, html: "" }) as ComponentChildren,
  );
}

/** Named views other than the embed, which has its own snippet. */
function namedViews(props: LayoutProps): ComponentChildren {
  const links = Object.entries(props.record?.views ?? {}).flatMap(([name, url]) => {
    const href = safeHref(url);
    return name === "embed" || href === undefined
      ? []
      : [h("li", null, h("a", { href }, h("bdi", null, name)))];
  });
  return links.length === 0 ? null : h(
    "nav",
    { class: "record-views", "aria-label": t(props.page.lang, "record_views") },
    h("ul", { role: "list" }, links),
  );
}

/** A retained record links to the replacement the engine resolved. */
function replacementNotice(props: LayoutProps): ComponentChildren {
  const href = replacementOf(props.page.record?.replacementUrl);
  if (href === undefined) return null;
  const label = props.site.pages.find((page) => page.url === href)?.title ?? href;
  return h(
    "p",
    { class: classNameOf("deprecated"), role: "note" },
    h(
      "span",
      { class: "page-status-message" },
      t(props.page.lang, "record_replaced_by"),
      " ",
      h("a", { class: "page-status-replacement", href }, h("bdi", null, label)),
    ),
  );
}

/**
 * One record: breadcrumb, the title when the template does not carry it, the key facts the page asks
 * for, the template's rendered body, the embed code when the record has an embedded view, and the
 * same page actions a doc page keeps: last updated, copy Markdown, the page agent menu, and block actions.
 * The layout names no collection and no field: everything comes from the page and its data.
 */
function article(props: LayoutProps): ComponentChildren {
  return h(
    "article",
    { class: "record", "data-pagefind-body": true },
    h(
      "div",
      { class: "doc-context" },
      breadcrumb(props) as ComponentChildren,
      pageTools(
        props,
        sourceMode(props) as ComponentChildren,
        addToCalendar({
          props: {
            ...(props.record?.calendar === undefined ? {} : { calendar: props.record.calendar }),
            ...(props.record?.calendars === undefined ? {} : { calendars: props.record.calendars }),
          },
          page: props.page,
          site: props.site,
          html: "",
        }) as ComponentChildren,
        collectionFeeds(props),
        collectionDownloads(props, { inline: true }),
      ),
    ),
    recordHeader(props),
    tocFold(tocFor(props)) as ComponentChildren,
    staleSlot(props),
    replacementNotice(props),
    summaryOf(props),
    factsPanel(props),
    collectionApi(props),
    lastUpdated(props) as ComponentChildren,
    h("div", { class: "record-body", dangerouslySetInnerHTML: { __html: pageHtml(props.page.html, props.page.lang) } }),
    pageToolSlot(props),
    recordHistory({
      props: props.record?.changes === undefined ? {} : { changes: props.record.changes },
      page: props.page,
      site: props.site,
      html: "",
    }) as ComponentChildren,
    relatedPanel(props),
    namedViews(props),
    embedPanel(props),
    snapshotPanel(props),
    docPageFooter(props) as ComponentChildren,
  );
}

/**
 * The record page: the base shell with the header and the mobile drawer, the navigation sidebar and
 * the record article. A page that names this layout without record data renders exactly like the
 * `doc` layout, so a mistake in a template never produces a bare page.
 */
const record: Layout = (props) => {
  const historyIsland: Island = { name: "record-history", src: `${baseOf(props.site)}/${HISTORY_ISLAND}` };
  // shortcut: mutating `islands`, as the list layout does; upgrade when a layout can declare a client.
  const islands = props.islands as Island[];
  if (fieldsOf(props.record?.changes ?? []).length > 0 && !islands.some((island) => island.src === historyIsland.src)) {
    islands.push(historyIsland);
  }
  return props.record === undefined
    ? renderDoc(props)
    : articleShell(props, {
        base: { showSourceMode: false },
        main: article(props),
        aside: toc(tocFor(props)) as ComponentChildren,
      });
};

export default record;
