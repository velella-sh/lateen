import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { DataRecord, LayoutProps, RecordPos } from "@velella/mizzen/contracts";
import { LINK_CLASS, reportHref } from "../chrome/report-issue/index.ts";
import { KEY_CLASS, LIST_CLASS, VALUE_CLASS } from "../components/key-value/index.ts";
import { t } from "../i18n/index.ts";
import { DERIVED_PREFIX, dataValue, fieldValueOf, formatField, kindOf, valueState } from "./fields.ts";
import { languageName } from "./language.ts";

/** Id of the facts panel; the record page's table of contents links to it. */
export const FACTS_ID = "record-facts";

/** Class on a fact's report link; `record.css` styles it. */
const FACT_REPORT_CLASS = "record-fact-report";

/** Class on a fact's value, the block source mode labels with the field's data position. */
export const FACT_CLASS = "record-fact";

/** Class on the muted label that names the language a fallback value is in. */
const LANGUAGE_CLASS = "field-language";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** One front matter fact: the field to read, the label in the page language, the value's kind, and its group. */
interface Fact {
  readonly field: string;
  readonly label: string;
  readonly kind: ReturnType<typeof kindOf>;
  /** The configured group label this fact belongs to; blank for an ungrouped fact. */
  readonly group: string;
}

/** True when the record can answer `field`: its own field, its id, or a value the engine derived. */
function knowsField(props: LayoutProps, field: string): boolean {
  const record = props.record;
  if (record === undefined) return false;
  if (field === "id") return true;
  if (field.startsWith(DERIVED_PREFIX)) {
    return record.derived !== undefined && Object.hasOwn(record.derived, field.slice(DERIVED_PREFIX.length));
  }
  return Object.hasOwn(record.fields, field);
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
    const group = typeof entry.group === "string" ? entry.group.trim() : "";
    if (field === "" || label === "" || !knowsField(props, field)) return [];
    return [{ field, label, kind: kindOf(entry.kind), group }];
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
  return field === "id" ? record.id : fieldValueOf(record, field);
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

/** The language tag in the form matching compares: trimmed, lower case, `_` read as `-`. */
function tagKey(tag: string): string {
  return tag.trim().toLowerCase().replace(/_/g, "-");
}

/** The default language's tag when the page's record says `field` fell back to it, else undefined. */
function fallbackLang(props: LayoutProps, field: string): string | undefined {
  if (props.page.record?.fallbacks.includes(field) !== true) return undefined;
  const tag = props.site.config.lang.trim();
  return tag === "" || tagKey(tag) === tagKey(props.page.lang) ? undefined : tag;
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

/** Id prefix of a named fact group's label, which the group's `aria-labelledby` points at. */
const FACT_GROUP_ID = "record-fact-group";

/** Facts by their configured group, in the order each group first appears; a blank label is the ungrouped set. */
function groupFacts(facts: readonly Fact[]): { readonly label: string; readonly facts: Fact[] }[] {
  const groups = new Map<string, Fact[]>();
  for (const fact of facts) {
    const group = groups.get(fact.group);
    if (group === undefined) groups.set(fact.group, [fact]);
    else group.push(fact);
  }
  return [...groups].map(([label, grouped]) => ({ label, facts: grouped }));
}

/** A fact's value, linked when the engine resolved the field as a reference to a record page. */
function factValue(props: LayoutProps, fact: Fact, value: ComponentChildren): ComponentChildren {
  const href = props.record?.links[fact.field];
  return href === undefined || href === "" ? value : h("a", { href }, value as never);
}

/** The key facts panel: labels and values from the page, with no empty row and no panel without facts. */
export function factsPanel(props: LayoutProps): ComponentChildren {
  const record = props.record;
  const facts = factsOf(props);
  if (record === undefined || facts.length === 0) return null;
  const row = (fact: Fact): ComponentChildren => {
    const value = fact.field === "id" ? record.id : fieldValueOf(record, fact.field);
    const state = valueState(value);
    const fallback = fallbackLang(props, fact.field);
    return h(
      Fragment,
      null,
      h("dt", { class: KEY_CLASS }, fact.label),
      h(
        "dd",
        {
          class: `${VALUE_CLASS} ${FACT_CLASS}`,
          "data-kind": fact.kind,
          ...(state === undefined ? {} : { "data-state": state }),
          ...(dataSrcOf(factPosition(props, fact)) === undefined
            ? {}
            : { "data-src": dataSrcOf(factPosition(props, fact)) }),
        },
        fallback === undefined
          ? null
          : h(
              "span",
              { class: LANGUAGE_CLASS },
              h("bdi", { lang: fallback }, languageName(fallback, props.page.lang)),
            ),
        factValue(
          props,
          fact,
          dataValue(
            fact.field,
            value,
            fact.kind,
            formatField(value, fact.kind, props.page.lang, props.site.config) as ComponentChildren,
          ),
        ),
        factReport(props, fact),
      ),
    );
  };
  return h(
    "dl",
    { class: LIST_CLASS, id: FACTS_ID },
    groupFacts(facts).map((group, index) => {
      const rows = group.facts.map(row);
      if (group.label === "") return rows;
      const id = `${FACT_GROUP_ID}-${index + 1}`;
      return h(
        "div",
        { class: "record-fact-group", role: "group", "aria-labelledby": id },
        h("p", { class: "record-fact-group-label", id }, group.label),
        rows,
      );
    }),
  );
}
