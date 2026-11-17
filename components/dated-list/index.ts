import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate, calendarMonth, type CalendarMonth } from "../../src/dates.ts";
import { formatField, isEmpty } from "../../src/fields.ts";
import { selectRecords } from "../../src/records.ts";

/** The Markdown directive this component handles: `::dated-list{from="posts"}`. */
export const directive = "dated-list";

/** Class on the note shown when the collection cannot be read. */
export const ERROR_CLASS = "dated-list-error";

/** Class on the trailing section for rows without a usable date. */
export const INVALID_CLASS = "dated-list-invalid";

/** Class on one month's section. */
export const GROUP_CLASS = "dated-list-group";

/** Class on a month's list and on the invalid section's list. */
export const ITEMS_CLASS = "dated-list-items";

/** Props from the directive or the page's front matter. */
export type DatedListProps = {
  /** The collection to read; required unless `items` is given. */
  from?: string;
  /** JSON array of `{ date, label, url?, status? }`, or the array front matter already holds. */
  items?: string | readonly unknown[];
  /** The field holding a record's date; defaults to `date`. */
  date?: string;
  /** The field holding a record's status; omitted means records show no status. */
  status?: string;
};

/** One row as the directive or a record writes it. */
interface Row {
  readonly date?: unknown;
  readonly label?: unknown;
  readonly url?: unknown;
  readonly status?: unknown;
}

/** A row with its date's ISO form and month, ready to group. */
interface Entry {
  readonly iso: string;
  readonly month: CalendarMonth;
  readonly row: Row;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/** A JSON string as data, or undefined when it is not valid JSON. */
function parse(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return undefined;
  }
}

/** A path on this site or an https link, as a field's `url` kind accepts. */
const SAFE_URL = /^(?:\/(?![/\\])|https:\/\/)[^\s"<>]*$/;

/** A row's label, linked to its page when the row has a safe link. */
function labelNode(row: Row, lang: string): ComponentChildren {
  const label = formatField(row.label, "text", lang);
  const url = typeof row.url === "string" ? row.url.trim() : "";
  return SAFE_URL.test(url) ? h("a", { class: "dated-list-link", href: url }, label as never) : label;
}

/** Midnight UTC of an ISO date, so formatting never reads the clock. */
const utcOf = (iso: string): Date => new Date(`${iso}T00:00:00Z`);

/**
 * Records of one collection, or the given rows, as a list grouped by month: each month a section
 * with a heading and an ordered list, each row a day, its label and an optional status. A row whose
 * date is missing or not a real calendar date goes to a trailing section with a visible note, so a
 * broken date is never dropped silently. Nothing is read from the clock, and an empty list renders
 * nothing.
 */
export default function datedList({ props, page, site }: ComponentProps<Readonly<Record<string, unknown>>>) {
  const input = props as DatedListProps;
  const lang = page?.lang ?? "en";
  const dateField = typeof input.date === "string" && input.date.trim() !== "" ? input.date.trim() : "date";
  const statusField = typeof input.status === "string" ? input.status.trim() : "";
  const from = typeof input.from === "string" ? input.from.trim() : "";

  let rows: Row[] | undefined;
  if (from !== "") {
    const selection = selectRecords(site, page, { collection: from });
    if (!selection.ok) {
      const key =
        selection.error.code === "unknown-collection" ? "record_table_unknown_collection" : "record_table_unknown_field";
      return h("p", { class: ERROR_CLASS, role: "note" }, t(lang, key, { name: selection.error.name }));
    }
    rows = selection.records.map((record) => ({
      date: record.fields[dateField],
      label: record.fields.label ?? record.id,
      ...(record.url === undefined ? {} : { url: record.url }),
      ...(statusField === "" || !Object.hasOwn(record.fields, statusField) ? {} : { status: record.fields[statusField] }),
    }));
  } else {
    const parsed = typeof input.items === "string" ? parse(input.items.trim()) : input.items;
    rows = Array.isArray(parsed) ? parsed.filter(isRecord) : undefined;
  }

  if (rows === undefined) return null;

  const dated: Entry[] = [];
  const invalid: Row[] = [];
  for (const row of rows) {
    const date = typeof row.date === "string" ? calendarDate(row.date, lang) : undefined;
    const month = date === undefined ? undefined : calendarMonth(date.datetime, lang);
    if (date === undefined || month === undefined) invalid.push(row);
    else dated.push({ iso: date.datetime, month, row });
  }
  // ISO dates sort as text; the sort is stable, so rows of one day keep the source order.
  dated.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));

  const dayFormat = new Intl.DateTimeFormat(lang, { day: "numeric", timeZone: "UTC" });
  // The key is the date's month in the page's calendar, so the heading and the boundaries match it.
  const groups = new Map<string, { readonly month: string; readonly entries: Entry[] }>();
  for (const entry of dated) {
    const group = groups.get(entry.month.key);
    if (group === undefined) groups.set(entry.month.key, { month: entry.month.text, entries: [entry] });
    else group.entries.push(entry);
  }

  const config = site?.config;
  const sections = [...groups.values()].map(({ month, entries }) =>
    h(
      "section",
      { class: GROUP_CLASS },
      h("h2", null, month),
      h(
        "ol",
        { class: ITEMS_CLASS },
        entries.map((entry) =>
          h(
            "li",
            { class: "dated-list-item" },
            h("time", { class: "dated-list-day", datetime: entry.iso }, dayFormat.format(utcOf(entry.iso))),
            labelNode(entry.row, lang),
            isEmpty(entry.row.status) ? null : (formatField(entry.row.status, "status", lang, config) as never),
          ),
        ),
      ),
    ),
  );

  if (invalid.length > 0) {
    sections.push(
      h(
        "section",
        { class: INVALID_CLASS },
        h("p", { class: "dated-list-note" }, t(lang, "dated_list_invalid")),
        h(
          "ul",
          { class: ITEMS_CLASS },
          invalid.map((row) => {
            const written =
              typeof row.date === "string" ? row.date.trim() : typeof row.date === "number" ? String(row.date) : "";
            return h(
              "li",
              { class: "dated-list-item" },
              written === "" ? null : h("span", { class: "dated-list-day" }, written),
              labelNode(row, lang),
            );
          }),
        ),
      ),
    );
  }

  return sections.length === 0 ? null : sections;
}
