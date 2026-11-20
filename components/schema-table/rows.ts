/**
 * Pure property-row construction: turns a resolved JSON Schema into the tree of rows the table
 * shows, with the depth and cycle guards that keep recursive schemas finite. No rendering, no DOM.
 */

import { MAX_HOPS, isJson, resolve, view, type Json, type SchemaRef } from "./resolve.ts";

/** Rows nested deeper than this are not expanded, so a recursive schema cannot loop forever. */
const MAX_DEPTH = 8;

/** One row of the table: a property, with the rows nested under it. */
export interface SchemaRow {
  /** Dotted path from the root, unique within the table; used as the row key. */
  readonly path: string;
  /** The property name as written in the schema. */
  readonly name: string;
  /** Type as text: `string`, `string | null`, `string[]`, `enum`, `unknown`, or `any`. */
  readonly type: string;
  /** True when the parent schema lists the property in `required`. */
  readonly required: boolean;
  /** True when the schema has a `default` keyword. */
  readonly hasDefault: boolean;
  /** The `default` value; read only when `hasDefault` is true. */
  readonly defaultValue: unknown;
  /** The `description` text, or an empty string. */
  readonly description: string;
  /** Allowed values from `enum`, or the single `const` value. */
  readonly values: readonly unknown[];
  /** 0 for top-level properties, 1 for their properties, and so on. */
  readonly depth: number;
  /** The `$ref` the property authored and how it was treated, or null when it authored none. */
  readonly ref: SchemaRef | null;
  /** Properties of this property (object properties, or the properties of array `items`). */
  readonly children: readonly SchemaRow[];
  /**
   * Why expansion stopped while `children` is empty: `"cycle"` for a `$ref` already on the way down,
   * `"depth"` when the depth limit hid child properties that the schema still defines, `null` when
   * the children shown are all there are.
   */
  readonly truncated: "cycle" | "depth" | null;
}

/** The values a schema allows: its `enum`, or its single `const`. */
function valuesOf(schema: Json): readonly unknown[] {
  if (Array.isArray(schema.enum)) return schema.enum;
  if (Object.hasOwn(schema, "const")) return [schema.const];
  return [];
}

/**
 * The schema's type as text. Arrays read as `item[]`; unions join with `|`. A reference that did not
 * resolve reads `unknown`, never a bare `any` that would claim the field is unconstrained.
 */
function typeOf(schema: Json, root: Json, depth = 0): string {
  if (depth > MAX_HOPS) return "unknown";
  const resolved = resolve(schema, root);
  const own = resolved.schema;
  if (typeof own.type === "string") {
    if (own.type === "array" && isJson(own.items)) {
      return `${typeOf(own.items, root, depth + 1)}[]`;
    }
    return own.type;
  }
  if (Array.isArray(own.type)) return own.type.map(String).join(" | ");
  const members = [
    ...(Array.isArray(own.anyOf) ? own.anyOf : []),
    ...(Array.isArray(own.oneOf) ? own.oneOf : []),
  ];
  const memberTypes = members.filter(isJson).map((member) => typeOf(member, root, depth + 1));
  if (memberTypes.length > 0) return memberTypes.join(" | ");
  if (Object.hasOwn(own, "enum") || Object.hasOwn(own, "const")) return "enum";
  if (resolved.ref !== null && resolved.ref.state !== "resolved") return "unknown";
  return "any";
}

/** Rows for the properties of one schema object, in the order the schema lists them. */
function propertyRows(schema: Json, root: Json, depth: number, active: ReadonlySet<string>, prefix: string): SchemaRow[] {
  if (!isJson(schema.properties)) return [];
  const required = new Set(Array.isArray(schema.required) ? schema.required.map(String) : []);
  return Object.entries(schema.properties).flatMap(([name, child]) =>
    isJson(child) ? [rowOf(name, child, required.has(name), depth, root, active, prefix)] : [],
  );
}

/**
 * Rows for everything one schema describes: its own properties, then the properties of its array
 * `items` (so an array of objects shows the fields of each item).
 */
function childRows(schema: Json, root: Json, depth: number, active: ReadonlySet<string>, prefix: string): SchemaRow[] {
  const own = view(schema, root);
  const rows = propertyRows(own, root, depth, active, prefix);
  if (isJson(own.items)) {
    rows.push(...propertyRows(view(own.items, root), root, depth, active, prefix));
  }
  return rows;
}

/**
 * Whether a schema still defines child rows one level down (its own properties, or those of array
 * `items`). A shallow read: it never recurses, so it stays safe at the depth limit.
 */
function mayHaveChildren(schema: Json, root: Json): boolean {
  const listsProperties = (owner: Json): boolean =>
    isJson(owner.properties) && Object.values(owner.properties).some(isJson);
  if (listsProperties(schema)) return true;
  return isJson(schema.items) && listsProperties(view(schema.items, root));
}

function rowOf(
  name: string,
  prop: Json,
  required: boolean,
  depth: number,
  root: Json,
  active: ReadonlySet<string>,
  prefix: string,
): SchemaRow {
  const path = prefix === "" ? name : `${prefix}.${name}`;
  const authored = typeof prop.$ref === "string" ? prop.$ref : undefined;
  // A `$ref` already on the way down is a cycle: show the row, but do not expand it again.
  const cyclic = authored !== undefined && active.has(authored);
  const nested = authored === undefined ? active : new Set([...active, authored]);
  const resolution = resolve(prop, root);
  const resolved = resolution.schema;
  const atDepthLimit = depth + 1 > MAX_DEPTH;
  const truncated = cyclic ? "cycle" : atDepthLimit && mayHaveChildren(resolved, root) ? "depth" : null;
  // An unresolved reference keeps its own state; a resolved one says whether expansion was cut off.
  const ref: SchemaRef | null =
    resolution.ref === null
      ? null
      : {
          value: resolution.ref.value,
          state:
            cyclic
              ? "cycle"
              : resolution.ref.state !== "resolved"
                ? resolution.ref.state
                : truncated === "depth"
                  ? "depth"
                  : "resolved",
        };
  const children =
    cyclic || atDepthLimit ? [] : childRows(resolved, root, depth + 1, nested, path);

  return {
    path,
    name,
    type: typeOf(prop, root),
    required,
    hasDefault: Object.hasOwn(resolved, "default"),
    defaultValue: resolved.default,
    description: typeof resolved.description === "string" ? resolved.description : "",
    values: valuesOf(resolved),
    depth,
    ref,
    children,
    truncated,
  };
}

/** The rows of a whole schema: one per top-level property, with nested rows under each. */
export function schemaRows(schema: Json): SchemaRow[] {
  return childRows(schema, schema, 0, new Set(), "");
}

/** A row tree in table order: each row followed by its nested rows, outermost first. */
export function flatten(rows: readonly SchemaRow[]): SchemaRow[] {
  return rows.flatMap((row) => [row, ...flatten(row.children)]);
}

/** What a copy action takes for a field: its dotted path and its type, without the table's decoration. */
export function copyValueOf(row: SchemaRow): string {
  return `${row.path}: ${row.type}`;
}