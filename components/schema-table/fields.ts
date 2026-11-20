/**
 * The machine payload one table publishes for automation: every visible field as JSON evidence,
 * built from rows alone. No rendering, no DOM.
 */

import { fieldId } from "./ids.ts";
import { copyValueOf, type SchemaRow } from "./rows.ts";
import type { SchemaRef } from "./resolve.ts";

/** One visible field as published evidence: everything the row shows, in a machine-readable shape. */
export interface SchemaFieldNode {
  /** Dotted path from the root, unique within the table. */
  readonly path: string;
  /** The property name as written in the schema. */
  readonly name: string;
  /** The id of the field's row in the table, so the JSON and the DOM point at each other. */
  readonly anchor: string;
  /** 0 for top-level properties, 1 for their properties, and so on. */
  readonly depth: number;
  /** Type as text, exactly the table shows it: `string`, `string | null`, `string[]`, `enum`, `unknown`, `any`. */
  readonly type: string;
  /** The row's current copy value, `path: type`, unchanged. */
  readonly copyValue: string;
  /** True when the parent schema lists the property in `required`. */
  readonly required: boolean;
  /** The default: `present` is the `default` keyword, `hasValue` separates an explicit null from absent. */
  readonly default: {
    readonly present: boolean;
    readonly hasValue: boolean;
    readonly value?: unknown;
  };
  /** Allowed values from `enum`, or the single `const` value; empty when the schema lists none. */
  readonly values: readonly unknown[];
  /** The `description` text, or an empty string. */
  readonly description: string;
  /** The `$ref` the field authored and how it was treated, or null when it authored none. */
  readonly ref: SchemaRef | null;
  /** `"cycle"` or `"depth"` when expansion stopped early; `null` when `children` is the full story. */
  readonly truncated: "cycle" | "depth" | null;
  /** Fields nested under this one, in schema order; empty when `truncated` explains why. */
  readonly children: readonly SchemaFieldNode[];
}

/** The whole payload one table publishes for automation: the schema's path and its visible fields. */
export interface SchemaFieldsPayload {
  /** Names the component, so a consumer knows how to read the rest. */
  readonly component: "schema-table";
  /** Shape version; bumped when the meaning of a field changes. Version 2 adds `ref` and `unknown` types. */
  readonly version: 2;
  /** The schema's path under `_data`, as the directive wrote it. */
  readonly data: string;
  /** Top-level fields in table order, nested fields under each as `children`. */
  readonly fields: readonly SchemaFieldNode[];
}

/** One row's evidence, ready for JSON: the SchemaRow's facts with the row's anchor and copy value. */
export function fieldNodeOf(row: SchemaRow, base: string): SchemaFieldNode {
  return {
    path: row.path,
    name: row.name,
    anchor: fieldId(base, row.path),
    depth: row.depth,
    type: row.type,
    copyValue: copyValueOf(row),
    required: row.required,
    default: {
      present: row.hasDefault,
      hasValue: row.hasDefault && row.defaultValue !== undefined,
      value: row.defaultValue,
    },
    values: [...row.values],
    description: row.description,
    ref: row.ref,
    truncated: row.truncated,
    children: row.children.map((child) => fieldNodeOf(child, base)),
  };
}

/** The payload for one table: every visible field, with nesting and order kept as the table shows them. */
export function fieldsPayloadOf(data: string, base: string, rows: readonly SchemaRow[]): SchemaFieldsPayload {
  return { component: "schema-table", version: 2, data, fields: rows.map((row) => fieldNodeOf(row, base)) };
}

/** JSON safe inside a `<script>` element: a `<` can never close the tag early. */
export function fieldsJson(payload: SchemaFieldsPayload): string {
  return JSON.stringify(payload).replace(/</g, "\\u003c");
}