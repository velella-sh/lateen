import type { SiteConfig } from "@velella/mizzen/contracts";

export type DateCalendar = NonNullable<NonNullable<SiteConfig["dates"]>["calendar"]>;

/** Mizzen uses Gregorian for every language unless the site sets a calendar. */
export function configuredCalendar(config: SiteConfig | undefined): DateCalendar | undefined {
  return config === undefined ? undefined : config.dates?.calendar ?? "gregorian";
}

const GREGORIAN_MONTHS = {
  en: "January February March April May June July August September October November December",
  fa: "ژانویه فوریه مارس آوریل مه ژوئن ژوئیه اوت سپتامبر اکتبر نوامبر دسامبر",
  ar: "يناير فبراير مارس أبريل مايو يونيو يوليو أغسطس سبتمبر أكتوبر نوفمبر ديسمبر",
};

const JALALI_MONTHS = {
  en: "Farvardin Ordibehesht Khordad Tir Mordad Shahrivar Mehr Aban Azar Dey Bahman Esfand",
  fa: "فروردین اردیبهشت خرداد تیر مرداد شهریور مهر آبان آذر دی بهمن اسفند",
  ar: "فروردين أرديبهشت خرداد تير مرداد شهريور مهر آبان آذر دي بهمن إسفند",
};

const DIGITS = { en: "0123456789", fa: "۰۱۲۳۴۵۶۷۸۹", ar: "٠١٢٣٤٥٦٧٨٩" };
const BREAK_YEARS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
const DAY_MS = 86_400_000;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;

function languageOf(tag: string): keyof typeof DIGITS {
  const language = tag.toLowerCase().split(/[-_]/, 1)[0];
  return language === "fa" || language === "ar" ? language : "en";
}

export function dateDigits(value: number, lang: string): string {
  const digits = DIGITS[languageOf(lang)];
  return String(value).replace(/\d/g, (digit) => digits[Number(digit)]!);
}

export function calendarMonthName(month: number, lang: string, calendar: DateCalendar): string {
  const months = calendar === "jalali" ? JALALI_MONTHS : GREGORIAN_MONTHS;
  return months[languageOf(lang)].split(" ")[month - 1] ?? "";
}

/** March boundary of a Solar Hijri year, using the published Jalali break years Mizzen uses. */
function nowruz(year: number): { time: number; leapPosition: number } {
  const gregorian = year + 621;
  let leaps = -14;
  let start = BREAK_YEARS[0]!;
  let cycle = 0;
  for (const end of BREAK_YEARS.slice(1)) {
    cycle = end - start;
    if (year < end) break;
    leaps += 8 * Math.trunc(cycle / 33) + Math.trunc((cycle % 33) / 4);
    start = end;
  }
  let elapsed = year - start;
  leaps += 8 * Math.trunc(elapsed / 33) + Math.trunc((elapsed % 33 + 3) / 4);
  if (cycle % 33 === 4 && cycle - elapsed === 4) leaps++;
  const gregorianLeaps = Math.trunc(gregorian / 4) - Math.trunc(3 * (Math.trunc(gregorian / 100) + 1) / 4) - 150;
  const date = new Date(0);
  date.setUTCFullYear(gregorian, 2, 20 + leaps - gregorianLeaps);
  if (cycle - elapsed < 6) elapsed += 33 * Math.trunc((cycle + 4) / 33) - cycle;
  return { time: date.getTime(), leapPosition: ((elapsed + 1) % 33 - 1) % 4 };
}

export function configuredParts(date: Date, calendar: DateCalendar): { year: number; month: number; day: number } {
  const year = date.getUTCFullYear();
  if (calendar === "gregorian") return { year, month: date.getUTCMonth() + 1, day: date.getUTCDate() };

  const jalali = year - 621;
  const boundary = nowruz(jalali);
  const days = (date.getTime() - boundary.time) / DAY_MS;
  if (days >= 0 && days < 186) {
    return { year: jalali, month: Math.trunc(days / 31) + 1, day: days % 31 + 1 };
  }
  const secondHalf = days >= 0 ? days - 186 : days + 179 + Number(boundary.leapPosition === 1);
  return { year: days < 0 ? jalali - 1 : jalali, month: Math.trunc(secondHalf / 30) + 7, day: secondHalf % 30 + 1 };
}

/** The engine's long date format with localized digits and month names. */
export function configuredDate(
  value: string,
  date: { readonly iso: string; readonly utc: Date; readonly precision: "year" | "month" | "day" },
  lang: string,
  calendar: DateCalendar,
): { datetime: string; text: string } | undefined {
  if (calendar === "jalali" && date.precision !== "day") return undefined;
  let datetime = date.iso;
  let utc = date.utc;
  if (value.includes("T")) {
    if (!ISO_INSTANT.test(value)) return undefined;
    utc = new Date(value);
    if (!(utc.getUTCFullYear() >= 1 && utc.getUTCFullYear() <= 9999)) return undefined;
    datetime = utc.toISOString().slice(0, 10);
    utc.setUTCHours(0, 0, 0, 0);
  }
  const { year, month, day } = configuredParts(utc, calendar);
  const number = (value: number) => dateDigits(value, lang);
  const name = calendarMonthName(month, lang, calendar);
  const parts = date.precision === "day" ? [number(day), name, number(year)]
    : date.precision === "month" ? [name, number(year)]
    : [number(year)];
  return { datetime, text: parts.join(" ") };
}
