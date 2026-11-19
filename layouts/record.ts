import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { DataRecord, Heading, Layout, LayoutProps, RecordPos } from "@velella/mizzen/contracts";
import base from "./base.ts";
import blockActions from "../chrome/block-actions/index.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import copyMarkdown from "../chrome/copy-markdown/index.ts";
import drawer from "../chrome/drawer/index.ts";
import lastUpdated from "../chrome/last-updated/index.ts";
import pageAgentMenu from "../chrome/page-agent-menu/index.ts";
import pageFooter from "../chrome/page-footer/index.ts";
import shell, { footer as shellFooter } from "../chrome/shell/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import addToCalendar from "../components/add-to-calendar/index.ts";
import embedCode from "../components/embed-code/index.ts";
import recordHistory from "../components/record-history/index.ts";
import { t } from "../i18n/index.ts";
import { FACTS_ID, factsOf, factsPanel, recordHeader, summaryOf } from "../src/record-parts.ts";
import doc from "./doc.ts";
import { staleSlot } from "../src/stale.ts";

/** Class on the embed code the record offers; `record.css` places it. */
const EMBED_CLASS = "record-embed";

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
    breadcrumb(props) as ComponentChildren,
    recordHeader(props),
    staleSlot(props),
    summaryOf(props),
    addToCalendar({
      props: {
        ...(props.record?.calendar === undefined ? {} : { calendar: props.record.calendar }),
        ...(props.record?.calendars === undefined ? {} : { calendars: props.record.calendars }),
      },
      page: props.page,
      site: props.site,
      html: "",
    }) as ComponentChildren,
    factsPanel(props),
    lastUpdated(props) as ComponentChildren,
    h("div", { class: "record-body", dangerouslySetInnerHTML: { __html: props.page.html } }),
    recordHistory({
      props: props.record?.changes === undefined ? {} : { changes: props.record.changes },
      page: props.page,
      site: props.site,
      html: "",
    }) as ComponentChildren,
    embedPanel(props),
    h(
      "div",
      { class: "doc-actions" },
      pageFooter(props) as ComponentChildren,
      copyMarkdown(props) as ComponentChildren,
      pageAgentMenu(props) as ComponentChildren,
    ),
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
        header: h(Fragment, null, shell(props) as ComponentChildren, drawer(props) as ComponentChildren),
    footer: shellFooter(props) as ComponentChildren,
        sidebar: sidebar(props) as ComponentChildren,
        main: h(Fragment, null, article(props), blockActions(props) as ComponentChildren),
        aside: toc(tocFor(props)) as ComponentChildren,
      });

export default record;
