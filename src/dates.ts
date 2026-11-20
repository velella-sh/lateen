/**
 * Calendar dates for the theme's "last updated" line. Persian pages show the Jalali (Persian) calendar,
 * Arabic pages the Hijri (Islamic) calendar, and English pages the Gregorian calendar. A BCP 47
 * `-u-ca-` or `-u-nu-` preference that the runtime supports overrides those defaults; other locales
 * keep their own month names on the Gregorian calendar. Formatting uses `Intl.DateTimeFormat`, so no
 * dependency is needed.
 */

/**
 * How a language writes its calendar date: the locale sets the month names, the calendar the system,
 * and the numbering system the digit shapes. The numbering system is explicit so a host whose ICU
 * defaults change cannot quietly swap Persian or Arabic-Indic digits for Latin ones.
 */
interface DateStyle {
  locale: string;
  calendar: string;
  numberingSystem: string;
}

const GREGORIAN: DateStyle = { locale: "en-US", calendar: "gregory", numberingSystem: "latn" };

const STYLES: Record<string, DateStyle> = {
  ar: { locale: "ar-SA", calendar: "islamic", numberingSystem: "arab" },
  en: GREGORIAN,
  fa: { locale: "fa-IR", calendar: "persian", numberingSystem: "arabext" },
};

/** Calendars and numbering systems this runtime can format; anything else is an unsupported preference. */
const CALENDARS: ReadonlySet<string> = new Set(Intl.supportedValuesOf("calendar"));
const NUMBERING_SYSTEMS: ReadonlySet<string> = new Set(Intl.supportedValuesOf("numberingSystem"));

/**
 * The style for `lang`, honoring `-u-ca-` and `-u-nu-` preferences that this runtime supports.
 * Malformed tags use the default style, and an unsupported preference falls back to the language's
 * safe default, so a bad tag never throws.
 */
function dateStyle(lang: string): DateStyle {
  let locale: Intl.Locale;
  try {
    locale = new Intl.Locale(lang);
  } catch {
    return GREGORIAN;
  }

  // An unknown but valid language keeps its own month names, on the deterministic Gregorian/Latin fallback.
  const base = STYLES[locale.language] ?? { locale: locale.baseName, calendar: "gregory", numberingSystem: "latn" };
  const calendar = locale.calendar;
  const numberingSystem = locale.numberingSystem;

  return {
    locale: base.locale,
    calendar: calendar !== undefined && CALENDARS.has(calendar) ? calendar : base.calendar,
    numberingSystem:
      numberingSystem !== undefined && NUMBERING_SYSTEMS.has(numberingSystem) ? numberingSystem : base.numberingSystem,
  };
}

/** Formatting is pinned to UTC, so the build machine's time zone cannot move a date a day. */
const TIME_ZONE = "UTC";

/** How much of a date its author wrote: a whole year, a month, or a day. */
type DatePrecision = "year" | "month" | "day";

/** The ISO calendar date at the start of a value: `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, optionally with a time. */
const ISO_DATE = /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T.*)?)?)?$/;

/** A written date, its midnight-UTC anchor, and how much of it was written. */
interface ParsedDate {
  readonly iso: string;
  readonly utc: Date;
  readonly precision: DatePrecision;
}

/** An ISO value's date part and its midnight UTC, or undefined when it is not a real calendar date. */
function utcOf(iso: string): ParsedDate | undefined {
  const match = ISO_DATE.exec(iso);
  if (match === null) return undefined;

  const year = Number(match[1]);
  const month = match[2] === undefined ? 1 : Number(match[2]);
  const day = match[3] === undefined ? 1 : Number(match[3]);
  const utc = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls over invalid months and days (2026-02-30 becomes 2026-03-02), so the parts must come back unchanged.
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) return undefined;

  return {
    iso: match[3] === undefined ? `${match[1]}${match[2] === undefined ? "" : `-${match[2]}`}` : `${match[1]}-${match[2]}-${match[3]}`,
    utc,
    precision: match[3] !== undefined ? "day" : match[2] !== undefined ? "month" : "year",
  };
}

/** A date written for a page: the ISO date for the `datetime` attribute, and the text in the page's calendar. */
export interface CalendarDate {
  /** The ISO calendar date at the authored precision: `YYYY`, `YYYY-MM`, or `YYYY-MM-DD`. */
  datetime: string;
  /** The same date in the language's calendar and numerals, at the authored precision. */
  text: string;
}

/** The Intl fields for each precision, so a month is never written with a day it did not have. */
const OPTIONS: Record<DatePrecision, Intl.DateTimeFormatOptions> = {
  year: { year: "numeric" },
  month: { year: "numeric", month: "long" },
  day: { year: "numeric", month: "long", day: "numeric" },
};

/** Formatting in the language's calendar and digits, at midnight UTC. */
function formatter(style: DateStyle, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(style.locale, {
    calendar: style.calendar,
    numberingSystem: style.numberingSystem,
    timeZone: TIME_ZONE,
    ...options,
  });
}

/**
 * Formats an ISO date (`YYYY`, `YYYY-MM`, or `YYYY-MM-DD`, or a date-time whose date part is used) for a
 * page in `lang`, keeping the precision the author wrote. Returns `undefined` when the value is not a
 * real calendar date, so the caller can show no date.
 */
export function calendarDate(iso: string, lang: string): CalendarDate | undefined {
  const date = utcOf(iso);
  if (date === undefined) return undefined;

  const text = formatter(dateStyle(lang), OPTIONS[date.precision]).format(date.utc);
  return { datetime: date.iso, text };
}

/** The ISO day a value names, or undefined when it names a month or a year only, so a day is never invented. */
export function calendarDay(iso: string): string | undefined {
  const date = utcOf(iso);
  return date?.precision === "day" ? date.iso : undefined;
}

/** A day of a page's calendar, as numbers, so boundaries can be found and ordered. */
export interface CalendarParts {
  /** The year within the calendar. */
  year: number;
  /** The month within the calendar year, 1 to 12. */
  month: number;
  /** The day within the calendar month. */
  day: number;
}

/**
 * The year, month and day a complete ISO date falls on in the calendar `calendarDate` uses for `lang`,
 * in Latin digits so callers can compare and step through calendar boundaries. Returns `undefined`
 * when the value is not a complete calendar date, so a missing day is never filled in.
 */
export function calendarParts(iso: string, lang: string): CalendarParts | undefined {
  const date = utcOf(iso);
  if (date === undefined || date.precision !== "day") return undefined;

  const parts = formatter(dateStyle(lang), {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    numberingSystem: "latn",
  }).formatToParts(date.utc);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

/** A month of a page's calendar: the grouping key and the heading text. */
export interface CalendarMonth {
  /** The month within its calendar year, such as `1404/12`; days share it only in the same month. */
  key: string;
  /** The month and year in the language's calendar and numerals, for a group heading. */
  text: string;
}

/**
 * Formats the month an ISO date falls in, in the calendar and digits `calendarDate` uses for `lang`,
 * so a list can group by the month the page reads. Returns `undefined` when the value is not a real
 * calendar date or names only a year, so a missing month is never filled in.
 */
export function calendarMonth(iso: string, lang: string): CalendarMonth | undefined {
  const date = utcOf(iso);
  if (date === undefined || date.precision === "year") return undefined;

  const style = dateStyle(lang);
  return {
    key: formatter(style, { year: "numeric", month: "numeric" }).format(date.utc),
    text: formatter(style, { year: "numeric", month: "long" }).format(date.utc),
  };
}

/** The year an ISO date falls in, in the calendar and digits `calendarMonth` groups by. */
export function calendarYear(iso: string, lang: string): string | undefined {
  const date = utcOf(iso);
  if (date === undefined) return undefined;
  return formatter(dateStyle(lang), { year: "numeric" }).format(date.utc);
}
