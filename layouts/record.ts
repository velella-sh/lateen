import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Heading, Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import blockActions from "../chrome/block-actions/index.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import copyMarkdown from "../chrome/copy-markdown/index.ts";
import drawer from "../chrome/drawer/index.ts";
import lastUpdated from "../chrome/last-updated/index.ts";
import pageAgentMenu from "../chrome/page-agent-menu/index.ts";
import header from "../chrome/header/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import toc from "../chrome/toc/index.ts";
import { KEY_CLASS, LIST_CLASS, VALUE_CLASS } from "../components/key-value/index.ts";
import { t } from "../i18n/index.ts";
import { formatField, kindOf } from "../src/fields.ts";
import doc from "./doc.ts";

/** Id of the facts panel; the table of contents links to it. */
const FACTS_ID = "record-facts";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** One front matter fact: the field to read, the label in the page language, and the value's kind. */
interface Fact {
  readonly field: string;
  readonly label: string;
  readonly kind: ReturnType<typeof kindOf>;
}

/** The facts the page asks for and the record can answer, in the author's order. */
function factsOf(props: LayoutProps): Fact[] {
  const record = props.record;
  const front = props.page.frontMatter.record;
  if (record === undefined || !isRecord(front) || !Array.isArray(front.facts)) return [];
  return front.facts.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const field = typeof entry.field === "string" ? entry.field.trim() : "";
    const label = typeof entry.label === "string" ? entry.label.trim() : "";
    if (field === "" || label === "") return [];
    if (field !== "id" && !Object.hasOwn(record.fields, field)) return [];
    return [{ field, label, kind: kindOf(entry.kind) }];
  });
}

/**
 * True when the body already supplies the page's `h1`: a record template usually names the record
 * itself, and the layout must not add a second `h1` above it.
 */
function titleFromBody(props: LayoutProps): boolean {
  return props.page.headings.some((heading) => heading.depth === 1);
}

/** The record field a front matter key names: `record.summary` and `record.status` hold field names. */
function fieldName(props: LayoutProps, key: "summary" | "status"): string {
  const front = props.page.frontMatter.record;
  if (!isRecord(front) || typeof front[key] !== "string") return "";
  return (front[key] as string).trim();
}

/** A record field's value, the id included, or undefined when the record lacks the field. */
function fieldValue(props: LayoutProps, field: string): unknown {
  const record = props.record;
  if (record === undefined || field === "") return undefined;
  return field === "id" ? record.id : record.fields[field];
}

/** Empty values render nothing: the summary paragraph and the status chip are never blank. */
function given(value: unknown): boolean {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

/**
 * The title and the status beside it. When the template carries the title in its body, only the
 * status is drawn here, so the page keeps one `h1` and one heading order.
 */
function recordHeader(props: LayoutProps): ComponentChildren {
  const status = fieldValue(props, fieldName(props, "status"));
  const title = titleFromBody(props) ? null : h("h1", null, props.page.title);
  if (title === null && !given(status)) return null;
  return h(
    "div",
    { class: "record-header" },
    title,
    given(status)
      ? h("span", { class: "record-status" }, formatField(status, "status", props.page.lang, props.site.config) as ComponentChildren)
      : null,
  );
}

/** The lead paragraph under the title, which is the value of the field the page names. */
function summaryOf(props: LayoutProps): ComponentChildren {
  const summary = fieldValue(props, fieldName(props, "summary"));
  if (!given(summary)) return null;
  return h("p", { class: "record-summary" }, formatField(summary, "text", props.page.lang, props.site.config) as ComponentChildren);
}

/** The key facts panel: labels and values from the page, with no empty row and no panel without facts. */
function factsPanel(props: LayoutProps): ComponentChildren {
  const record = props.record;
  const facts = factsOf(props);
  if (record === undefined || facts.length === 0) return null;
  return h(
    "dl",
    { class: LIST_CLASS, id: FACTS_ID },
    facts.map((fact) =>
      h(
        Fragment,
        null,
        h("dt", { class: KEY_CLASS }, fact.label),
        h(
          "dd",
          { class: VALUE_CLASS },
          formatField(
            fact.field === "id" ? record.id : record.fields[fact.field],
            fact.kind,
            props.page.lang,
            props.site.config,
          ) as ComponentChildren,
        ),
      ),
    ),
  );
}

/** The page's own headings plus the facts panel first, on a copy so the page itself stays untouched. */
function tocFor(props: LayoutProps): LayoutProps {
  if (factsOf(props).length === 0) return props;
  const heading: Heading = { depth: 2, id: FACTS_ID, text: t(props.page.lang, "record_facts"), pos: props.page.source };
  return { ...props, page: { ...props.page, headings: [heading, ...props.page.headings] } };
}

/**
 * One record: breadcrumb, the title when the template does not carry it, the key facts the page asks
 * for, the template's rendered body, and the same page actions a doc page keeps: last updated,
 * copy Markdown, the page agent menu, and block actions. The layout names no collection and no field: everything
 * comes from the page and its data.
 */
function article(props: LayoutProps): ComponentChildren {
  return h(
    "article",
    { class: "record", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    recordHeader(props),
    summaryOf(props),
    factsPanel(props),
    lastUpdated(props) as ComponentChildren,
    h("div", { class: "record-body", dangerouslySetInnerHTML: { __html: props.page.html } }),
    h(
      "div",
      { class: "doc-actions" },
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
        header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
        sidebar: sidebar(props) as ComponentChildren,
        main: h(Fragment, null, article(props), blockActions(props) as ComponentChildren),
        aside: toc(tocFor(props)) as ComponentChildren,
      });

export default record;
