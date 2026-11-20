// Typed fixture factories for record models (#866): DataRecord, the record a page was built from,
// and the record props a layout receives. Only required fields, so a test names the fields it
// asserts on and every fixture carries a real `RecordPos` instead of a cast-away wrong shape.
import type { DataRecord, PageRecord, RecordPos, RecordProps } from "@velella/mizzen/contracts";

const pos: RecordPos = { file: "data/books.yml", startLine: 1, startColumn: 1, endLine: 2, endColumn: 12 };

/** A DataRecord with an id, empty fields and a real source position. */
export function dataRecord(overrides: Partial<DataRecord> = {}): DataRecord {
  return { id: "book-1", fields: {}, position: pos, fieldPositions: {}, ...overrides };
}

/** The PageRecord a record page carries: its collection, id, position and template. */
export function pageRecord(overrides: Partial<PageRecord> = {}): PageRecord {
  return { collection: "books", id: "book-1", position: pos, template: "record.md", templateLine: 1, fallbacks: [], ...overrides };
}

/** The RecordProps a record layout receives: identity, URL, fields and resolved links. */
export function recordProps(overrides: Partial<RecordProps> = {}): RecordProps {
  return { collection: "books", id: "book-1", url: "/books/book-1/", fields: {}, links: {}, ...overrides };
}
