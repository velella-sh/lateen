import type { Page, SiteConfig } from "@velella/mizzen/contracts";

/** A SQLite file: Mizzen reads its locked query result, so the file is never a page of text to edit. */
const DATABASE = /\.(?:sqlite3?|db)$/i;

/** A URL or an `npm:` address; the collection's data is somewhere nobody edits through the repository. */
const ADDRESS = /^[a-z][a-z0-9+.-]*:/i;

/** The folder `mizzen data fetch` and `mizzen data extract` store pinned bytes in: named by hash, not committed. */
const STORE = /^\.mizzen\//;

/** A data file a reader could edit, with the lines of the record when those lines are in that file. */
export interface RecordFile {
  readonly file: string;
  readonly start?: number;
  readonly end?: number;
}

/**
 * The file a record page's data is written in, or `undefined` when there is none to edit. A record read from
 * a local YAML, JSON or CSV file is that file, at the record's lines. A record from an API, a SQLite query or
 * an NDJSON file is read from `.mizzen/data/<hash>`, a stored copy: the NDJSON source itself is editable but its
 * line numbers belong to the stored result, so it names the file alone; an API or a database has no file, so
 * the page offers no edit.
 */
export function recordFileOf(config: SiteConfig | undefined, page: Page): RecordFile | undefined {
  const record = page.record;
  if (record === undefined) return undefined;
  // A hand-built page model may omit the position; the engine always writes it.
  const { file = "", startLine, endLine } = (record.position ?? {}) as Partial<NonNullable<Page["record"]>["position"]>;
  if (file.trim() !== "" && !STORE.test(file) && !ADDRESS.test(file) && !DATABASE.test(file)) {
    const start = startLine !== undefined && Number.isInteger(startLine) && startLine >= 1 ? startLine : undefined;
    if (start === undefined) return { file };
    return { file, start, end: endLine !== undefined && Number.isInteger(endLine) && endLine >= start ? endLine : start };
  }
  const source = config?.collections?.[record.collection]?.source;
  if (source === undefined || ADDRESS.test(source) || DATABASE.test(source)) return undefined;
  return { file: source };
}

/**
 * Where a record's data came from, as plain text for a report: the editable file, or else the source the
 * collection's config names (a URL or a database path), and never the stored copy.
 */
export function recordOrigin(config: SiteConfig | undefined, page: Page): string | undefined {
  const file = recordFileOf(config, page);
  if (file !== undefined) return file.start === undefined ? file.file : `${file.file}:${file.start}`;
  const record = page.record;
  return record === undefined ? undefined : config?.collections?.[record.collection]?.source;
}
