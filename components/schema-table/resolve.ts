/**
 * Pure JSON Schema resolution: local `$ref` following, pointer decoding, and the recursion guards
 * that keep expansion deterministic. No rendering, no DOM, no I/O.
 */

/** A JSON value read from `_data`. Checked at runtime, so it is `unknown` rather than a fixed type. */
export type Json = Readonly<Record<string, unknown>>;

/** Hops allowed when following `$ref` chains, and when describing nested `items`. */
export const MAX_HOPS = 16;

/**
 * How expansion treated an authored `$ref`: `resolved` read the local target; `unresolved` found no
 * target; `external` pointed outside this document; `malformed` was not a usable local pointer;
 * `cycle` looped back on itself; `depth` hit a deterministic expansion limit.
 */
export const REF_STATES = ["resolved", "unresolved", "external", "malformed", "cycle", "depth"] as const;

export type RefState = (typeof REF_STATES)[number];

/** The `$ref` a schema authored, and what expansion did with it. */
export interface SchemaRef {
  /** The reference as authored; JSON text when the value is not a string. */
  readonly value: string;
  /** How expansion treated it. */
  readonly state: RefState;
}

export function isJson(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The reference as text: strings stay as written, any other JSON value becomes its JSON text. */
function authoredText(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
}

/** The tokens of a local JSON pointer, with `~1` and `~0` decoded; undefined when it is not one. */
function pointerParts(ref: string): string[] | undefined {
  if (!ref.startsWith("#")) return undefined;
  const fragment = ref.slice(1);
  if (fragment === "") return [];
  if (!fragment.startsWith("/")) return undefined;
  const parts = fragment.slice(1).split("/");
  // A `~` must be followed by `0` or `1`; anything else is not a JSON pointer.
  if (parts.some((part) => /~(?:[^01]|$)/.test(part))) return undefined;
  return parts.map((part) => part.replace(/~1/g, "/").replace(/~0/g, "~"));
}

/** True when a local reference uses pointer syntax but one of its `~` escapes is invalid. */
function malformedPointer(ref: string): boolean {
  const fragment = ref.slice(1);
  if (!fragment.startsWith("/")) return false;
  return fragment
    .slice(1)
    .split("/")
    .some((part) => /~(?:[^01]|$)/.test(part));
}

/** Follows the JSON pointer `#/$defs/name` (or `#/definitions/name`) inside the same document. */
function pointerTarget(root: Json, ref: string): unknown {
  const parts = pointerParts(ref);
  if (parts === undefined) return undefined;
  let node: unknown = root;
  for (const key of parts) {
    if (!isJson(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}

/** A schema with its `$ref` chain applied, and the reference the row authored. */
export interface Resolution {
  readonly schema: Json;
  readonly ref: SchemaRef | null;
}

/** The schema without its own `$ref`, keeping the keywords written next to it. */
function withoutRef(schema: Json): Json {
  if (!Object.hasOwn(schema, "$ref")) return schema;
  const { $ref: _ref, ...local } = schema;
  return local;
}

/**
 * Resolves a local `$ref` chain and reports exactly how it ended. The target's keywords are
 * overridden by any keyword the referring schema sets next to the `$ref`. External, malformed,
 * missing, cyclic, and limit-cut references are never fetched or guessed at.
 */
export function resolve(schema: Json, root: Json, hops = 0, seen: ReadonlySet<string> = new Set()): Resolution {
  if (!Object.hasOwn(schema, "$ref")) return { schema, ref: null };
  const authored = schema.$ref;
  const value = authoredText(authored);
  const ended = (state: RefState): Resolution => ({ schema: withoutRef(schema), ref: { value, state } });

  if (typeof authored !== "string") return ended("malformed");
  if (!authored.startsWith("#")) return ended("external");
  if (seen.has(authored)) return ended("cycle");
  if (hops > MAX_HOPS) return ended("depth");
  if (malformedPointer(authored)) return ended("malformed");
  // A plain-name fragment such as `#notes` is local but not a pointer this reader can follow.
  if (pointerParts(authored) === undefined) return ended("unresolved");
  const target = pointerTarget(root, authored);
  if (!isJson(target)) return ended("unresolved");

  const next = resolve(target, root, hops + 1, new Set([...seen, authored]));
  return {
    schema: { ...next.schema, ...withoutRef(schema) },
    ref: { value, state: next.ref?.state ?? "resolved" },
  };
}

/** The schema with its `$ref` applied. Non-resolving references contribute no keywords. */
export function view(schema: Json, root: Json, hops = 0): Json {
  return resolve(schema, root, hops).schema;
}

/** The value at a `_data` path such as `widget` or `guides/steps`, or undefined when there is none. */
export function lookup(data: Readonly<Record<string, unknown>>, path: string): unknown {
  let node: unknown = data;
  for (const key of path.split("/").filter((part) => part !== "")) {
    if (!isJson(node) || !Object.hasOwn(node, key)) return undefined;
    node = node[key];
  }
  return node;
}