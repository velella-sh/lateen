// The date formatting the theme ships, as one JSON line for the timezone test (#869). The parent
// test runs this file under several pinned host timezones and compares the output byte for byte.
// Not named `*.test.ts`: the suite never runs it on its own.
import { calendarDate, calendarMonth, calendarParts } from "../src/dates.ts";
import { isoDate, relativeDate } from "../chrome/last-updated/index.ts";

const DAY = "2026-03-04";

const output = {
  zone: new Intl.DateTimeFormat().resolvedOptions().timeZone,
  gregorian: calendarDate(DAY, "en")?.text,
  persian: calendarDate(DAY, "fa")?.text,
  hijri: calendarDate(DAY, "ar")?.text,
  month: calendarMonth("2026-11", "en")?.text,
  parts: calendarParts(DAY, "en"),
  yearOnly: calendarDate("2026", "en")?.text,
  // A Date just before and just after a UTC midnight: the calendar date is the UTC one, never the
  // host wall clock's.
  beforeUtcMidnight: isoDate(new Date("2026-03-04T23:30:00Z")),
  afterUtcMidnight: isoDate(new Date("2026-03-05T00:30:00Z")),
  instant: isoDate("2026-03-04T23:30:00+14:00"),
  // Relative day names around the as-of day: yesterday, today, tomorrow.
  relativeYesterday: relativeDate("2026-03-03", "2026-03-04", "en"),
  relativeToday: relativeDate("2026-03-04", "2026-03-04", "en"),
  relativeTomorrow: relativeDate("2026-03-05", "2026-03-04", "en"),
  impossible: isoDate("2026-02-30"),
};

process.stdout.write(JSON.stringify(output));
