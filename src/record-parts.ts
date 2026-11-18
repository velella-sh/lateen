import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { DataRecord, LayoutProps, RecordPos } from "@velella/mizzen/contracts";
import { LINK_CLASS, reportHref } from "../chrome/report-issue/index.ts";
import { KEY_CLASS, LIST_CLASS, VALUE_CLASS } from "../components/key-value/index.ts";
import { t } from "../i18n/index.ts";
import { formatField, kindOf } from "./fields.ts";

/** Id of the facts panel; the record page's table of contents links to it. */
export const FACTS_ID = "record-facts";

/** Class on a fact's report link; `record.css` styles it. */
const FACT_REPORT_CLASS = "record-fact-report";

/** Class on a fact's value, the block source mode labels with the field's data position. */
export const FACT_CLASS = "record-fact";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** One front matter fact: the field to read, the label in the page language, and the value's kind. */
interface Fact {
  readonly field: string;
  readonly label: string;
  readonly kind: ReturnType<typeof kindOf>;
}

/** The facts the page asks for and the record can answer, in the author's order. */
export function factsOf(props: LayoutProps): Fact[] {
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
export function recordHeader(props: LayoutProps): ComponentChildren {
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
export function summaryOf(props: LayoutProps): ComponentChildren {
  const summary = fieldValue(props, fieldName(props, "summary"));
  if (!given(summary)) return null;
  return h("p", { class: "record-summary" }, formatField(summary, "text", props.page.lang, props.site.config) as ComponentChildren);
}

/** The engine's record behind the page, where field positions come from; absent when the model lacks it. */
function dataRecordOf(props: LayoutProps): DataRecord | undefined {
  const pageRecord = props.page.record;
  if (pageRecord === undefined) return undefined;
  return props.site.collections[pageRecord.collection]?.records.find((record) => record.id === pageRecord.id);
}

/** The engine's position for one fact, or undefined when it gave none: no position is guessed. */
function factPosition(props: LayoutProps, fact: Fact): RecordPos | undefined {
  return dataRecordOf(props)?.fieldPositions[fact.field];
}

/** A position as the `data-src` value the source span reader parses. */
function dataSrcOf(position: RecordPos | undefined): string | undefined {
  if (position === undefined) return undefined;
  return `${position.file}:${position.startLine}:${position.startColumn}-${position.endLine}:${position.endColumn}`;
}

/** True when the page asks for a report link on every fact: absent or false by default. */
function reportsFacts(props: LayoutProps): boolean {
  const front = props.page.frontMatter.record;
  return isRecord(front) && front.report === true;
}

/** A fact's report link, the field named in the issue and in the link's own name. */
function factReport(props: LayoutProps, fact: Fact): ComponentChildren {
  if (!reportsFacts(props)) return null;
  const href = reportHref(props.site, props.page, fact.label);
  if (href === undefined) return null;
  const label = t(props.page.lang, "report_value");
  return h(
    "a",
    { class: `${LINK_CLASS} ${FACT_REPORT_CLASS}`, href, rel: "noopener", "aria-label": `${label}: ${fact.label}` },
    label,
  );
}

/** The key facts panel: labels and values from the page, with no empty row and no panel without facts. */
export function factsPanel(props: LayoutProps): ComponentChildren {
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
          {
            class: `${VALUE_CLASS} ${FACT_CLASS}`,
            ...(dataSrcOf(factPosition(props, fact)) === undefined
              ? {}
              : { "data-src": dataSrcOf(factPosition(props, fact)) }),
          },
          formatField(
            fact.field === "id" ? record.id : record.fields[fact.field],
            fact.kind,
            props.page.lang,
            props.site.config,
          ) as ComponentChildren,
          factReport(props, fact),
        ),
      ),
    ),
  );
}
