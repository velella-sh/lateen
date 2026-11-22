import type { DataRecord, Page, Site } from "@velella/mizzen/contracts";
import { isPublicField, publicFieldsOf } from "./public-fields.ts";

/** One field compared to a value, or to a field of the page's own record so a record can list its children. */
export interface RecordFilter {
  /** The field on the queried collection. */
  readonly field: string;
  /** The value the field must equal. */
  readonly equals?: unknown;
  /** A field of the page's record whose value must equal {@link field}; used instead of {@link equals}. */
  readonly from?: string;
}

/** One field to sort by. Values are compared as numbers when both are numbers, and as text otherwise. */
export interface RecordSort {
  readonly field: string;
  /** `asc` (the default) or `desc`. */
  readonly order?: "asc" | "desc";
}

/** Which records to select: one named collection, at most one filter, at most one sort, and a limit. */
export interface RecordQuery {
  readonly collection: string;
  readonly filter?: RecordFilter;
  readonly sort?: RecordSort;
  readonly limit?: number;
}

/** A selected record: its id, its fields as the source holds them, its derived values, and the URL of its page when it has one. */
export interface SelectedRecord {
  readonly id: string;
  readonly fields: Readonly<Record<string, unknown>>;
  /** The engine's derived values, when the collection declares rules and the record has a date to derive from. */
  readonly derived?: Readonly<Record<string, unknown>>;
  /** Reference fields resolved to the URL of the record page they point at, as the engine wrote them. */
  readonly links?: Readonly<Record<string, string>>;
  readonly url?: string;
}

/** Why a selection failed: a collection the site does not declare, or a field the records do not have. */
export interface RecordError {
  readonly code: "unknown-collection" | "unknown-field";
  /** The collection or field the query named. */
  readonly name: string;
  readonly message: string;
}

/** A selection either carries its records or an error the caller shows, never both. */
export type RecordSelection =
  | { readonly ok: true; readonly records: readonly SelectedRecord[] }
  | { readonly ok: false; readonly error: RecordError };

/** Equality as a data file writes it: `"3"` in a CSV equals `3` in a filter written in Markdown. */
function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  return a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b);
}

/** The URL of every record page, keyed by collection and record id. */
function urlsOf(site: Site): Map<string, string> {
  const urls = new Map<string, string>();
  for (const page of site.pages) {
    const record = page.record;
    if (record !== undefined) urls.set(`${record.collection}\u0000${record.id}`, page.url);
  }
  return urls;
}

/** The page's own record, so a filter can point at one of its fields or at its id. */
function currentRecord(site: Site, page: Page): DataRecord | undefined {
  const current = page.record;
  if (current === undefined) return undefined;
  return site.collections[current.collection]?.records.find((record) => record.id === current.id);
}

/** Every field name the records carry, plus `id`. */
function fieldNamesOf(records: readonly DataRecord[]): Set<string> {
  const names = new Set<string>(["id"]);
  for (const record of records) for (const name of Object.keys(record.fields)) names.add(name);
  return names;
}

/** The value of `field` on a record, or its id for `id`. */
function valueOf(record: DataRecord, field: string): unknown {
  return field === "id" ? record.id : record.fields[field];
}

/** Numbers compare as numbers, everything else as text in the page's language. */
function compare(a: unknown, b: unknown, lang: string): number {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a ?? "").localeCompare(String(b ?? ""), lang, { numeric: true });
}

/**
 * Selects records from one collection: one field equal to a value (or to a field of the page's own
 * record), one sort, and a limit. An unknown collection or field returns an error the caller shows,
 * so a typo in a page never silently renders an empty table.
 */
export function selectRecords(site: Site, page: Page, query: RecordQuery): RecordSelection {
  const collection = site.collections[query.collection];
  if (collection === undefined) {
    return {
      ok: false,
      error: {
        code: "unknown-collection",
        name: query.collection,
        message: `The site has no collection named "${query.collection}".`,
      },
    };
  }

  const records = collection.records.map((record) => ({
    ...record, fields: publicFieldsOf(site, query.collection, record.fields),
  }));
  const names = fieldNamesOf(records);
  const { filter, sort } = query;
  const wanted = [filter?.field, sort?.field].find((field) => field !== undefined && !names.has(field));
  if (wanted !== undefined) {
    return {
      ok: false,
      error: {
        code: "unknown-field",
        name: wanted,
        message: `The collection "${query.collection}" has no field named "${wanted}".`,
      },
    };
  }
  let selected = records.slice();

  if (filter !== undefined) {
    const expected = filter.from === undefined ? filter.equals : (() => {
      const reference = page.record;
      if (reference === undefined || !isPublicField(site, reference.collection, filter.from)) return undefined;
      const current = currentRecord(site, page);
      return current === undefined ? undefined : valueOf(current, filter.from);
    })();
    if (filter.from !== undefined && expected === undefined) {
      return {
        ok: false,
        error: {
          code: "unknown-field",
          name: filter.from,
          message: `This page's record has no field named "${filter.from}".`,
        },
      };
    }
    selected = selected.filter((record) => same(valueOf(record, filter.field), expected));
  }

  if (sort !== undefined) {
    const direction = sort.order === "desc" ? -1 : 1;
    selected.sort((a, b) => direction * compare(valueOf(a, sort.field), valueOf(b, sort.field), page.lang));
  }

  if (query.limit !== undefined && query.limit >= 0) selected = selected.slice(0, query.limit);

  const urls = urlsOf(site);
  return {
    ok: true,
    records: selected.map((record) => {
      const url = urls.get(`${query.collection}\u0000${record.id}`);
      return {
        id: record.id,
        fields: record.fields,
        ...(record.derived === undefined ? {} : { derived: publicFieldsOf(site, query.collection, record.derived) }),
        ...(url === undefined ? {} : { url }),
      };
    }),
  };
}
