import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate, calendarMonth, calendarYear, type CalendarMonth } from "../../src/dates.ts";
import { formatField, isEmpty } from "../../src/fields.ts";
import { selectRecords } from "../../src/records.ts";

/** The Markdown directive this component handles: `::dated-list{from="posts"}`. */
export const directive = "dated-list";

/** Class on the wrapper the island finds. */
export const LIST_CLASS = "dated-list";

/** Marks the wrapper with the island attribute and the page language. */
export const LIST_ATTRIBUTE = "data-dated-list";

/** Class on the hidden paragraph the island turns into a jump link. */
export const JUMP_CLASS = "dated-list-jump";

/** Marks the jump paragraph for the island. */
export const JUMP_ATTRIBUTE = "data-dated-list-jump";

/** Class on the note shown when the collection cannot be read. */
export const ERROR_CLASS = "dated-list-error";

/** Class on the trailing section for rows without a usable date. */
export const INVALID_CLASS = "dated-list-invalid";

/** Class on one month's section. */
export const GROUP_CLASS = "dated-list-group";

/** Class on one year's section, when `group=year`. */
export const YEAR_CLASS = "dated-list-year";

/** Class on the list of the groups, when the page asks for a table of contents. */
export const TOC_CLASS = "dated-list-toc";

/** Class on a month's list and on the invalid section's list. */
export const ITEMS_CLASS = "dated-list-items";

/** Class on the note standing in for a month with no records, when the page asks for a range. */
export const EMPTY_CLASS = "dated-list-empty";

/** Class on the note counting the records the range leaves out. */
export const OUTSIDE_CLASS = "dated-list-outside";

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
  /** `asc` (default) lists the oldest group first; `desc` lists the newest first. */
  order?: string;
  /** Heading level for the groups; defaults to 2, and a level that would skip one falls back to 2. */
  level?: string | number;
  /** `year` adds a year heading above each year's months. */
  group?: string;
  /** `true` puts the groups in a table of contents above the list. */
  toc?: string | boolean;
  /** First day of a fixed range of months, such as `2026-01-01`; without it only months with records show. */
  start?: string;
  /** How many months the range covers, counting the month of `start`; ignored without `start`. */
  months?: string | number;
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

/** One month's section: the anchor id, the heading text in the page's calendar, and its rows. */
interface MonthGroup {
  readonly key: string;
  readonly id: string;
  readonly year: string;
  /** The first ISO day of the month, so its year reads right even when no record falls in it. */
  readonly iso: string;
  readonly text: string;
  readonly entries: Entry[];
}

/** One year's section, with the months that fall in it. */
interface YearGroup {
  readonly id: string;
  readonly text: string;
  readonly months: MonthGroup[];
}

type HeadingLevel = 2 | 3 | 4 | 5 | 6;

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

/** A prop as written: a trimmed, lower-cased string, or `""` when absent. */
const textOf = (value: unknown): string => (typeof value === "string" ? value.trim().toLowerCase() : "");

/**
 * The heading level the groups use. A level below 2 would repeat the page's title, and a level
 * whose months would land past 6 would skip one, so both fall back to 2.
 */
function headingLevel(value: unknown, withYear: boolean): HeadingLevel {
  const level = typeof value === "number" ? value : Number(textOf(value));
  const highest = withYear ? 5 : 6;
  return Number.isInteger(level) && level >= 2 && level <= highest ? (level as HeadingLevel) : 2;
}

/** A calendar month's anchor id: its key with the characters an id cannot hold replaced. */
const monthId = (month: CalendarMonth): string => `dated-list-${month.key.replace(/[^\p{L}\p{N}]+/gu, "-")}`;

/** The anchor id of a calendar year. */
const yearId = (year: string): string => `dated-list-${year}`;

/** A year's digits in the page's calendar, for grouping; its key. */
const yearKeyOf = (iso: string, lang: string): string =>
  (/[\p{Nd}]+/u.exec(calendarYear(iso, lang) ?? "")?.[0]) ?? iso.slice(0, 4);

/**
 * The first day of each month in a range of `count` months from `start`, oldest first. Walking a
 * day at a time keeps the months in the page's own calendar, whose months have other lengths.
 */
function monthRange(start: string, count: number, lang: string): { iso: string; month: CalendarMonth }[] {
  const first = calendarDate(start, lang);
  if (first === undefined) return [];

  const months: { iso: string; month: CalendarMonth }[] = [];
  const day = utcOf(first.datetime);
  let seen = "";
  for (let step = 0; step <= count * 32 && months.length < count; step++) {
    const iso = day.toISOString().slice(0, 10);
    const month = calendarMonth(iso, lang);
    if (month !== undefined && month.key !== seen) {
      seen = month.key;
      months.push({ iso, month });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return months;
}

/** One month's rows: a day, its label, and an optional status. */
function items(
  entries: readonly Entry[],
  dayFormat: Intl.DateTimeFormat,
  lang: string,
  config: Parameters<typeof formatField>[3],
): ComponentChildren {
  return h(
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
  );
}

/** The table of contents: one link per group, year links wrapping their months. */
function contents(months: readonly MonthGroup[], years: readonly YearGroup[]): ComponentChildren {
  const link = (group: { readonly id: string; readonly text: string }) =>
    h("li", null, h("a", { href: `#${group.id}` }, group.text));
  return h(
    "ul",
    null,
    years.length === 0
      ? months.map(link)
      : years.map((year) => h("li", null, h("a", { href: `#${year.id}` }, year.text), h("ul", null, year.months.map(link)))),
  );
}

/**
 * Records of one collection, or the given rows, as a list grouped by month: each month a section
 * with a heading and an ordered list, each row a day, its label and an optional status. The newest
 * group comes first with `order=desc`; `group=year` adds a year heading above each year's months;
 * `toc` puts the groups in a table of contents above the list, and `level` sets the outline without
 * skipping a level. A row whose date is missing or not a real calendar date goes to a trailing
 * section with a visible note, so a broken date is never dropped silently. With `start` and
 * `months`, a fixed range of months is listed, empty months say so, and records outside it are
 * left out with a count. Nothing is read from the clock, and an empty list renders nothing.
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

  const start = typeof input.start === "string" ? input.start.trim() : "";
  const monthCount = typeof input.months === "number" ? input.months : Number(textOf(input.months));
  const range = start !== "" && Number.isInteger(monthCount) && monthCount > 0 ? monthRange(start, monthCount, lang) : [];
  const inRange = range.length === 0 ? undefined : new Set(range.map(({ month }) => month.key));

  let dated: Entry[] = [];
  const invalid: Row[] = [];
  for (const row of rows) {
    const date = typeof row.date === "string" ? calendarDate(row.date, lang) : undefined;
    const month = date === undefined ? undefined : calendarMonth(date.datetime, lang);
    if (date === undefined || month === undefined) invalid.push(row);
    else dated.push({ iso: date.datetime, month, row });
  }
  const outside = inRange === undefined ? 0 : dated.filter((entry) => !inRange.has(entry.month.key)).length;
  if (inRange !== undefined) dated = dated.filter((entry) => inRange.has(entry.month.key));

  // ISO dates sort as text; the sort is stable, so rows of one day keep the source order.
  dated.sort((a, b) => (a.iso < b.iso ? -1 : a.iso > b.iso ? 1 : 0));

  const newestFirst = textOf(input.order) === "desc";
  if (newestFirst) dated.reverse();

  // The key is the date's month in the page's calendar, so the heading and the boundaries match it.
  const months: MonthGroup[] = [];
  if (range.length > 0) {
    const byKey = new Map<string, Entry[]>();
    for (const entry of dated) {
      const same = byKey.get(entry.month.key);
      if (same === undefined) byKey.set(entry.month.key, [entry]);
      else same.push(entry);
    }
    for (const { iso, month } of range) {
      months.push({
        key: month.key,
        id: monthId(month),
        year: yearKeyOf(iso, lang),
        iso,
        text: month.text,
        entries: byKey.get(month.key) ?? [],
      });
    }
    if (newestFirst) months.reverse();
  } else {
    for (const entry of dated) {
      const last = months.at(-1);
      if (last?.key === entry.month.key) last.entries.push(entry);
      else
        months.push({
          key: entry.month.key,
          id: monthId(entry.month),
          year: yearKeyOf(entry.iso, lang),
          iso: entry.iso,
          text: entry.month.text,
          entries: [entry],
        });
    }
  }

  const wantToc = months.length > 0 && (input.toc === true || input.toc === "" || textOf(input.toc) === "true");

  const withYear = textOf(input.group) === "year";
  const level = headingLevel(input.level, withYear);
  const monthLevel = (withYear ? level + 1 : level) as HeadingLevel;
  const dayFormat = new Intl.DateTimeFormat(lang, { day: "numeric", timeZone: "UTC" });
  const config = site?.config;

  const monthsOf = (groups: readonly MonthGroup[]): ComponentChildren =>
    groups.map((month) =>
      h(
        "section",
        { class: GROUP_CLASS },
        h(`h${monthLevel}`, wantToc ? { id: month.id } : null, month.text),
        month.entries.length === 0
          ? h("p", { class: `dated-list-note ${EMPTY_CLASS}` }, t(lang, "dated_list_nothing"))
          : items(month.entries, dayFormat, lang, config),
      ),
    );

  const years: YearGroup[] = [];
  if (withYear) {
    for (const month of months) {
      const last = years.at(-1);
      if (last?.id === yearId(month.year)) last.months.push(month);
      else {
        years.push({ id: yearId(month.year), text: calendarYear(month.iso, lang) ?? month.year, months: [month] });
      }
    }
  }

  const sections = withYear
    ? years.map((year) =>
        h(
          "section",
          { class: YEAR_CLASS },
          h(`h${level}`, wantToc ? { id: year.id } : null, year.text),
          monthsOf(year.months),
        ),
      )
    : monthsOf(months);

  const output: ComponentChildren[] = [];
  if (wantToc) {
    output.push(h("nav", { class: TOC_CLASS, "aria-label": t(lang, "on_this_page") }, contents(months, years)));
  }
  output.push(...(sections as ComponentChildren[]));

  if (outside > 0) {
    output.push(h("p", { class: `dated-list-note ${OUTSIDE_CLASS}` }, t(lang, "dated_list_outside", { n: outside })));
  }

  if (invalid.length > 0) {
    output.push(
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

  if (output.length === 0) return null;
  return h(
    "div",
    { class: LIST_CLASS, [LIST_ATTRIBUTE]: "", "data-lang": lang },
    h("p", { class: JUMP_CLASS, [JUMP_ATTRIBUTE]: "", "data-label": t(lang, "dated_list_jump"), hidden: true }),
    ...output,
  );
}
