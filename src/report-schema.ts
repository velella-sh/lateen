/**
 * A small JSON Schema reader for the checked-in report schemas. It covers the keywords those schemas
 * use and nothing else: `type`, `required`, `properties`, `additionalProperties`, `items`, `enum`,
 * `minimum`, `minItems`, `maxItems`, and `pattern`. A schema keyword outside this set is a failure
 * rather than a check that silently passes, so a schema cannot promise more than this reader proves.
 */
export type JsonSchema = {
  readonly type?: string | readonly string[];
  readonly required?: readonly string[];
  readonly properties?: Readonly<Record<string, JsonSchema>>;
  readonly additionalProperties?: boolean | JsonSchema;
  readonly items?: JsonSchema;
  readonly enum?: readonly unknown[];
  readonly minimum?: number;
  readonly minItems?: number;
  readonly maxItems?: number;
  readonly pattern?: string;
};

const KEYWORDS = new Set([
  "$schema",
  "$id",
  "$comment",
  "title",
  "description",
  "type",
  "required",
  "properties",
  "additionalProperties",
  "items",
  "enum",
  "minimum",
  "minItems",
  "maxItems",
  "pattern",
]);

type Kind = "object" | "array" | "string" | "number" | "integer" | "boolean" | "null";

function kindOf(value: unknown): Kind {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "number";
  if (typeof value === "object") return "object";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  return "null";
}

function matchesType(value: unknown, type: string): boolean {
  const kind = kindOf(value);
  if (type === "number") return kind === "number" || kind === "integer";
  return kind === type;
}

function label(path: string): string {
  return path === "" ? "the report" : path;
}

/** Every reason `value` does not satisfy `schema`, as readable sentences; empty when it does. */
export function validate(schema: JsonSchema, value: unknown, path = ""): string[] {
  const errors: string[] = [];
  const where = label(path);
  for (const keyword of Object.keys(schema)) {
    if (!KEYWORDS.has(keyword)) errors.push(`${where}: the schema uses the unsupported keyword ${JSON.stringify(keyword)}`);
  }

  const types = schema.type === undefined ? [] : typeof schema.type === "string" ? [schema.type] : schema.type;
  if (types.length > 0 && !types.some((type) => matchesType(value, type))) {
    errors.push(`${where}: expected ${types.join(" or ")}, got ${kindOf(value)}`);
    return errors;
  }

  if (schema.enum !== undefined && !schema.enum.some((option) => JSON.stringify(option) === JSON.stringify(value))) {
    errors.push(`${where}: ${JSON.stringify(value)} is not one of ${JSON.stringify(schema.enum)}`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${where}: ${value} is below the minimum ${schema.minimum}`);
  }
  if (typeof value === "string" && schema.pattern !== undefined && !new RegExp(`^(?:${schema.pattern})$`).test(value)) {
    errors.push(`${where}: ${JSON.stringify(value)} does not match ${schema.pattern}`);
  }

  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) {
      errors.push(`${where}: ${value.length} items, wants at least ${schema.minItems}`);
    }
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push(`${where}: ${value.length} items, wants at most ${schema.maxItems}`);
    }
    if (schema.items !== undefined) {
      value.forEach((item, index) => errors.push(...validate(schema.items as JsonSchema, item, `${path}[${index}]`)));
    }
  }

  if (kindOf(value) === "object" && schema.properties !== undefined) {
    const record = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!Object.prototype.hasOwnProperty.call(record, key)) errors.push(`${where}: ${key} is missing`);
    }
    for (const [key, child] of Object.entries(schema.properties)) {
      if (Object.prototype.hasOwnProperty.call(record, key)) {
        errors.push(...validate(child, record[key], path === "" ? key : `${path}.${key}`));
      }
    }
    const allowed = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(record)) {
      if (allowed.has(key)) continue;
      if (schema.additionalProperties === false) {
        errors.push(`${where}: ${key} is not a documented field`);
      } else if (typeof schema.additionalProperties === "object") {
        errors.push(...validate(schema.additionalProperties, record[key], path === "" ? key : `${path}.${key}`));
      }
    }
  }

  return errors;
}
