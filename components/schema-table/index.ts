import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { isJson, lookup, type SchemaRef } from "./resolve.ts";
import { copyValueOf, flatten, schemaRows, type SchemaRow } from "./rows.ts";
import { ancestorPaths, columnId, fieldId, idBase } from "./ids.ts";
import { fieldsJson, fieldsPayloadOf } from "./fields.ts";

// The pure boundaries stay importable from the component's entry point: resolution, row
// construction, ids, and the machine payload are separate modules, re-exported unchanged.
export { REF_STATES, lookup, type RefState, type SchemaRef } from "./resolve.ts";
export { copyValueOf, schemaRows, type SchemaRow } from "./rows.ts";
export { ancestorPaths, columnId, fieldId, idBase } from "./ids.ts";
export { fieldNodeOf, fieldsJson, fieldsPayloadOf, type SchemaFieldNode, type SchemaFieldsPayload } from "./fields.ts";

/** The Markdown directive this component handles: `::schema-table{data="widget"}`. */
export const directive = "schema-table";

/** Scroll region around the table, keyboard-focusable so wide tables can be scrolled without a pointer. */
export const WRAPPER_CLASS = "schema-table-scroll";

/** Class on the table element. `style.css` styles it. */
export const TABLE_CLASS = "schema-table";

/** Shown when the directive gives no `data` or the `_data` path holds no schema. */
export const MISSING_CLASS = "schema-table-missing";

/** Rows indented beyond this depth share the deepest indent class. */
const MAX_INDENT = 3;

/** Class on the visible marker for a reference that was not expanded. */
export const REF_CLASS = "schema-ref";

/** Class on the resolution state word inside a reference marker. */
export const REF_STATE_CLASS = "schema-ref-state";

export type SchemaTableProps = {
  /** Path of the schema in `_data`, without the extension: `widget` or `guides/steps`. */
  data?: string;
  /** Accessible name of the table. */
  label?: string;
  /** Id of the table's region. Give one when two tables read the same schema. */
  id?: string;
};

/** A value as the table shows it: JSON, so strings keep their quotes and `null` and numbers read as written. */
function show(value: unknown): string {
  return JSON.stringify(value) ?? String(value);
}

/** The visible marker for a reference that was not expanded: its authored value and how it ended. */
function refNode(ref: SchemaRef) {
  return h(
    "span",
    { class: REF_CLASS, dir: "ltr" },
    h("code", null, `$ref ${ref.value}`),
    " ",
    h("span", { class: REF_STATE_CLASS }, ref.state),
  );
}

function rowNode(row: SchemaRow, base: string, lang: string) {
  const indent = row.depth === 0 ? "schema-row" : `schema-row schema-depth-${Math.min(row.depth, MAX_INDENT)}`;
  const ownHeader = `${fieldId(base, row.path)}-name`;
  const ancestors = ancestorPaths(row.path).map((path) => `${fieldId(base, path)}-name`);
  // A nested row belongs to its parent's header and to its column's header, so `headers` names both.
  // A top-level row keeps the table's implicit association with the column headers.
  const headersOf = (column: string) =>
    ancestors.length === 0 ? {} : { headers: [...ancestors, ownHeader, columnId(base, column)].join(" ") };
  const headerHeaders = ancestors.length === 0 ? {} : { headers: [...ancestors, columnId(base, "name")].join(" ") };
  return h(
    "tr",
    {
      key: row.path,
      class: indent,
      id: fieldId(base, row.path),
      "data-field": row.path,
      "data-copy-value": copyValueOf(row),
      ...(row.ref === null ? {} : { "data-ref": row.ref.value, "data-ref-state": row.ref.state }),
    },
    h("th", { scope: "row", class: "schema-name", id: ownHeader, ...headerHeaders }, h("code", { dir: "ltr" }, row.name)),
    h(
      "td",
      { ...headersOf("type") },
      h("code", { class: "schema-type", dir: "ltr" }, row.type),
      row.ref !== null && row.ref.state !== "resolved" ? refNode(row.ref) : null,
    ),
    h("td", { class: "schema-required", ...headersOf("required") }, row.required ? t(lang, "required") : null),
    h(
      "td",
      { class: "schema-default", ...headersOf("default") },
      row.hasDefault ? h("code", { dir: "ltr" }, show(row.defaultValue)) : null,
    ),
    h(
      "td",
      { class: "schema-description", ...headersOf("description") },
      row.description === "" ? null : h("span", null, row.description),
      row.values.length === 0
        ? null
        : h(
            "ul",
            { class: "schema-values" },
            row.values.map((value) => h("li", null, h("code", { dir: "ltr" }, show(value)))),
          ),
    ),
  );
}

/**
 * `::schema-table{data="widget"}` renders a JSON Schema from `_data/widget.json` (or `.yml`) as a table of
 * properties: name, type, required, default, and description, with nested properties indented under their
 * parent. `data` is the file's path under `_data` without its extension; `guides/steps` reads
 * `_data/guides/steps.yml`. The table needs no JavaScript and reads the same in right-to-left text; its
 * headers and messages come from the page language's catalog. An inert JSON script publishes the same
 * fields — paths, types, required state, defaults, allowed values, descriptions, hierarchy, authored
 * references with their resolution state, and honest truncation marks — so agents read the evidence
 * without scraping formatted cells.
 */
export default function schemaTable({ props, site, page }: ComponentProps<SchemaTableProps>) {
  const lang = page.lang;
  const path = typeof props.data === "string" ? props.data.trim() : "";
  const label = typeof props.label === "string" && props.label.trim() !== "" ? props.label : t(lang, "schema_properties");

  if (path === "") {
    return h("p", { class: MISSING_CLASS, role: "note" }, t(lang, "schema_missing_data"));
  }
  const schema = lookup(site.data, path);
  if (!isJson(schema)) {
    return h("p", { class: MISSING_CLASS, role: "note" }, t(lang, "schema_missing_schema", { path }));
  }

  const tree = schemaRows(schema);
  const rows = flatten(tree);
  if (rows.length === 0) {
    return h("p", { class: MISSING_CLASS, role: "note" }, t(lang, "schema_empty", { path }));
  }

  const base = idBase(props.id, path);
  const payload = fieldsPayloadOf(path, base, tree);

  return h(
    "div",
    { class: WRAPPER_CLASS, id: base, tabIndex: 0, role: "region", "aria-label": label, "data-schema": path },
    h(
      "table",
      { class: TABLE_CLASS },
      h(
        "thead",
        null,
        h(
          "tr",
          null,
          h("th", { scope: "col", id: columnId(base, "name") }, t(lang, "name")),
          h("th", { scope: "col", id: columnId(base, "type") }, t(lang, "type")),
          h("th", { scope: "col", id: columnId(base, "required") }, t(lang, "required")),
          h("th", { scope: "col", id: columnId(base, "default") }, t(lang, "default")),
          h("th", { scope: "col", id: columnId(base, "description") }, t(lang, "description")),
        ),
      ),
      h("tbody", null, rows.map((row) => rowNode(row, base, lang))),
    ),
    h("script", {
      type: "application/json",
      "data-schema-fields": "",
      dangerouslySetInnerHTML: { __html: fieldsJson(payload) },
    }),
  );
}