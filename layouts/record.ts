import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { Layout, LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";
import breadcrumb from "../chrome/breadcrumb/index.ts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import sidebar from "../chrome/sidebar/index.ts";
import { KEY_CLASS, LIST_CLASS, VALUE_CLASS } from "../components/key-value/index.ts";
import { formatField, kindOf } from "../src/fields.ts";
import doc from "./doc.ts";

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

/** The key facts panel: labels and values from the page, with no empty row and no panel without facts. */
function factsPanel(props: LayoutProps): ComponentChildren {
  const record = props.record;
  const facts = factsOf(props);
  if (record === undefined || facts.length === 0) return null;
  return h(
    "dl",
    { class: LIST_CLASS },
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

/**
 * One record: breadcrumb, the title when the template does not carry it, the key facts the page asks
 * for, and the template's rendered body. The layout names no collection and no field: everything
 * comes from the page and its data.
 */
function article(props: LayoutProps): ComponentChildren {
  return h(
    "article",
    { class: "record", "data-pagefind-body": true },
    breadcrumb(props) as ComponentChildren,
    titleFromBody(props) ? null : h("h1", null, props.page.title),
    factsPanel(props),
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
