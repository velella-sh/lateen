/* The data explorer's index loader: it never fetches on page load. The query field's first focus
 * reads `<base>/data/<collection>.index.json`; a head with `rows` is the whole index, and a head with
 * `chunks` lists the numbered files to read next, at most four at a time and in the listed order. The
 * rows are kept once, in the one array the loader hands to `ready`. A newer load aborts the request
 * in flight, and a failed one reports a retry that starts again from the head.
 *
 * The module is pure: it reads no page module and touches no DOM of its own, so the island build can
 * carry it and tests pass a fake field, fetch, and handlers. */

import { withBase } from "../../src/url.ts";

/** The folder the engine writes collection indexes under. */
export const INDEX_FOLDER = "data";

/** The most chunk files the loader requests at once. */
export const CHUNK_CONCURRENCY = 4;

/** The last column of every index row: the record's page URL. */
export const URL_COLUMN = "url";

/** A cell the engine writes: a scalar, null, or a list of scalars. */
export type IndexCell = string | number | boolean | null | readonly (string | number | boolean)[];

/** One row: one cell per column, the last being the record's page URL. */
export type IndexRow = readonly IndexCell[];

/** The loaded index: the columns once, and the rows in source order. */
export interface CollectionIndex {
  readonly columns: readonly string[];
  readonly rows: IndexRow[];
}

/** The query field; its first focus starts the load. */
export interface IndexField {
  addEventListener(type: "focus", listener: () => void): void;
  /** The document, so a field that already has focus when the loader starts loads at once. */
  readonly ownerDocument?: { readonly activeElement?: unknown } | null;
}

/** Everything the loader reads from the world; tests pass fakes, the browser supplies `fetch`. */
export interface IndexEnv {
  fetchText(url: string, signal: AbortSignal): Promise<string>;
}

/** Where the rows go, or the retry that starts the load again from the head. */
export interface IndexHandlers {
  ready(index: CollectionIndex): void;
  failed(retry: () => void): void;
}

/** One explorer's loader: the rows once loaded, and the load the field and a retry call. */
export interface IndexLoader {
  /** The whole index, or undefined until every file has arrived. */
  readonly index: CollectionIndex | undefined;
  /** Starts the load; a call while one is in flight aborts that request and starts again. */
  load(): Promise<void>;
}

/** The explorer whose index is loaded. */
export interface IndexInput {
  readonly field: IndexField;
  /** The site base path, from the explorer root's `data-base`. */
  readonly base: string;
  /** The collection to read, from the explorer root's `data-collection`. */
  readonly collection: string;
}

/** A head file's two shapes: the whole index, or the list of chunks that together are the index. */
type Head =
  | { readonly columns: string[]; readonly rows: IndexRow[] }
  | { readonly columns: string[]; readonly chunks: string[] };

/** True for a plain object, so a JSON array or `null` is not read as one. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The column names, or undefined when the list is empty or holds something other than a name. */
function columnsOf(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value.every((name) => typeof name === "string" && name !== "") ? (value as string[]) : undefined;
}

/** True for a value a cell may hold. */
function isCell(value: unknown): value is IndexCell {
  if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return true;
  }
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" || typeof item === "number" || typeof item === "boolean")
  );
}

/** True for the page URL a row ends with, as the search results page accepts one. */
function isUrl(value: unknown): value is string {
  return (
    typeof value === "string" &&
    (value.startsWith("/") || value.startsWith("./") || value.startsWith("../") || /^https?:\/\//i.test(value))
  );
}

/**
 * The rows of one file, each as wide as the columns and ending in a page URL. A bad row is a load
 * failure, never a row to skip. The input array is returned as it is, so nothing is copied twice.
 */
function rowsOf(value: unknown, width: number): IndexRow[] {
  if (!Array.isArray(value)) throw new Error("the index rows are not a list");
  for (const row of value) {
    if (!Array.isArray(row) || row.length !== width || !row.every(isCell) || !isUrl(row[width - 1])) {
      throw new Error("an index row does not match its columns");
    }
  }
  return value as IndexRow[];
}

/** The listed chunk paths, each a name under the site root. */
function chunkPathsOf(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("the index head lists no chunks");
  if (!value.every((path) => typeof path === "string" && path !== "")) {
    throw new Error("an index chunk path is not a name");
  }
  return value as string[];
}

/** Reads the head file: one collection, its columns, then either the rows or the chunk list. */
function readHead(text: string, collection: string): Head {
  const body: unknown = JSON.parse(text);
  if (!isRecord(body)) throw new Error("the index head is not an object");
  if (body.collection !== collection) throw new Error("the index head names another collection");
  const columns = columnsOf(body.columns);
  if (columns === undefined || columns[columns.length - 1] !== URL_COLUMN) {
    throw new Error("the index head has no url column");
  }
  const hasRows = body.rows !== undefined;
  const hasChunks = body.chunks !== undefined;
  if (hasRows === hasChunks) throw new Error("the index head has neither rows nor chunks, or both");
  if (hasRows) return { columns, rows: rowsOf(body.rows, columns.length) };
  return { columns, chunks: chunkPathsOf(body.chunks) };
}

/** Reads one chunk: it must name the same collection, carry the same columns, and hold valid rows. */
function readChunk(text: string, collection: string, columns: readonly string[]): IndexRow[] {
  const body: unknown = JSON.parse(text);
  if (!isRecord(body)) throw new Error("an index chunk is not an object");
  if (body.collection !== collection) throw new Error("an index chunk names another collection");
  const chunkColumns = columnsOf(body.columns);
  if (
    chunkColumns === undefined ||
    chunkColumns.length !== columns.length ||
    chunkColumns.some((name, at) => name !== columns[at])
  ) {
    throw new Error("an index chunk disagrees with the head's columns");
  }
  return rowsOf(body.rows, columns.length);
}

/**
 * Loads one explorer's index, starting on the query field's first focus. One load is in flight at a
 * time. A newer load aborts the old request; when a file is missing, malformed, or disagrees with the
 * head, `failed` receives a retry that starts again from the head. Rows live for the life of the page
 * and a load that already finished makes another focus free.
 */
export function createIndexLoader(input: IndexInput, env: IndexEnv, handlers: IndexHandlers): IndexLoader {
  let index: CollectionIndex | undefined;
  let current: AbortController | undefined;
  let attempt = 0;

  const headUrl = (): string => withBase(input.base, `/${INDEX_FOLDER}/${input.collection}.index.json`);
  const chunkUrl = (path: string): string => withBase(input.base, path.startsWith("/") ? path : `/${path}`);

  /** Reads the head and, when it lists them, every chunk; undefined when a newer load superseded this one. */
  async function fetchIndex(signal: AbortSignal, stale: () => boolean): Promise<CollectionIndex | undefined> {
    const head = readHead(await env.fetchText(headUrl(), signal), input.collection);
    if (stale()) return undefined;
    if ("rows" in head) return { columns: head.columns, rows: head.rows };

    // One array holds every chunk's rows as they arrive; a chunk's own list is never kept after its
    // rows move into it.
    const rows: IndexRow[] = [];
    for (let at = 0; at < head.chunks.length; at += CHUNK_CONCURRENCY) {
      const batch = head.chunks.slice(at, at + CHUNK_CONCURRENCY);
      const texts = await Promise.all(batch.map((path) => env.fetchText(chunkUrl(path), signal)));
      if (stale()) return undefined;
      for (const text of texts) {
        for (const row of readChunk(text, input.collection, head.columns)) rows.push(row);
      }
    }
    return { columns: head.columns, rows };
  }

  async function load(): Promise<void> {
    if (index !== undefined) return;

    current?.abort();
    const controller = new AbortController();
    current = controller;
    const mine = ++attempt;
    const stale = (): boolean => mine !== attempt;

    let loaded: CollectionIndex | undefined;
    try {
      loaded = await fetchIndex(controller.signal, stale);
    } catch {
      if (stale()) return;
      index = undefined;
      handlers.failed(() => void load());
      return;
    } finally {
      if (current === controller) current = undefined;
    }

    if (loaded === undefined || stale()) return;
    index = loaded;
    handlers.ready(loaded);
  }

  // A second focus while the first load is still running waits for it instead of downloading again.
  const startOnFocus = (): void => {
    if (index === undefined && current === undefined) void load();
  };
  input.field.addEventListener("focus", startOnFocus);
  if (input.field.ownerDocument?.activeElement === input.field) startOnFocus();

  return {
    get index(): CollectionIndex | undefined {
      return index;
    },
    load,
  };
}
