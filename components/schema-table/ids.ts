/** Pure id and path helpers: deterministic anchors that keep every row and column unique. No DOM. */

/** A value reduced to letters, digits, `-` and `_`, so it can go in an id. */
function slugOf(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The id prefix of the table: the `id` prop, or the schema's `_data` path. */
export function idBase(raw: unknown, path: string): string {
  const given = slugOf(typeof raw === "string" ? raw : "");
  if (given !== "") return given;
  const data = slugOf(path);
  return data === "" ? "schema-table" : `schema-${data}`;
}

/** The id of one field row. The dotted path keeps every property in the table unique. */
export function fieldId(base: string, path: string): string {
  return `${base}-field-${slugOf(path) || "field"}`;
}

/** The id of a column's header cell. */
export function columnId(base: string, column: string): string {
  return `${base}-col-${column}`;
}

/** The paths of a field's ancestors, outermost first: `a.b.c` gives `a` and `a.b`. */
export function ancestorPaths(path: string): string[] {
  const parts = path.split(".");
  return parts.slice(0, -1).map((_part, index) => parts.slice(0, index + 1).join("."));
}