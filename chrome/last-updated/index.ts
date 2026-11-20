import { h } from "preact";
import { isRecord } from "../../src/guards.ts";
import type { Chrome, Page, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate, calendarDay, isoDate } from "../../src/dates.ts";

/** Class on the line. `style.css` styles it. */
export const CLASS = "last-updated";

/** Class on the date part of the line. */
export const DATE_CLASS = "last-updated-date";

/** Class on the contributors part of the line. */
export const CONTRIBUTORS_CLASS = "last-updated-contributors";

/** Class on a date part whose authored value could not be read. */
export const UNAVAILABLE_CLASS = "last-updated-date-unavailable";

/** How many contributor names the line shows. */
export const MAX_CONTRIBUTORS = 3;

/** What a page's date means: the source's last change, or a review recorded in the site's data. */
export type DateSource = "source" | "review";

/**
 * What one piece of date evidence says about the page:
 *
 * - `valid`: a real ISO calendar date on or before the build's as-of day;
 * - `future`: a real ISO calendar date after that day, which is not a recency the build can vouch for;
 * - `invalid`: the author wrote something, but it is not a real calendar date;
 * - `absent`: the author wrote nothing.
 *
 * `invalid` and `absent` are deliberately distinct, so a reader can tell rejected evidence from missing
 * evidence instead of guessing.
 */
export type DateStatus = "valid" | "future" | "invalid" | "absent";

/** One piece of date evidence the line can carry, with the kind of date it records. */
export interface PageDate {
  /** The strict ISO calendar date, or `undefined` when the evidence is invalid or absent. */
  readonly date: string | undefined;
  /** Whether the evidence reads as a date at all. */
  readonly status: DateStatus;
  /** Whether the date records a source change or a review. */
  readonly source: DateSource;
}

/** The string-table key for each kind of date. */
const LABELS: Readonly<Record<DateSource, string>> = { source: "updated", review: "reviewed" };

/**
 * What the line says when evidence was written but cannot be read. The catalog already carries this
 * neutral wording, and it claims nothing about how recent the page is.
 */
const UNAVAILABLE_LABEL = "changelog_date_unknown";

const DAY_MS = 86_400_000;

/**
 * The canonical form of `tag` when `Intl` can format it, else its language alone when that is supported.
 * `undefined` for a malformed or unsupported tag. Negotiation is a pure function of the tag, so a build's
 * text never depends on the runtime's default locale.
 */
function negotiate(tag: string): string | undefined {
  try {
    const canonical = Intl.getCanonicalLocales(tag)[0];
    if (canonical === undefined) return undefined;
    if (Intl.RelativeTimeFormat.supportedLocalesOf(canonical).length > 0) return canonical;

    const language = canonical.split("-")[0];
    return language !== undefined && Intl.RelativeTimeFormat.supportedLocalesOf(language).length > 0
      ? language
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The locale `Intl.RelativeTimeFormat` uses for a BCP 47 tag: regional tags keep their region
 * (`fa-IR`, `ar-EG`, `en-CA`), other languages `Intl` supports use their own wording (`de`), and an
 * invalid or unsupported tag falls back to English.
 */
export function localeOf(lang: string): string {
  return negotiate(lang.trim()) ?? "en";
}

/**
 * The ISO calendar day a value names, re-exported for callers of this chrome. Parsing lives in
 * `src/dates.ts`, so every component validates an authored date the same way.
 */
export { isoDate };

/**
 * "2 days ago" for `iso` relative to the build's `asOf` date, in `lang`, through
 * `Intl.RelativeTimeFormat`. Both values are calendar dates, so the answer never reads the clock: a build
 * with the same data gives the same text. A value that is not a real date reads as `undefined`, so the
 * caller can show the absolute date instead.
 */
export function relativeDate(iso: string, asOf: string, lang: string): string | undefined {
  const day = calendarDay(iso);
  const now = calendarDay(asOf);
  if (day === undefined || now === undefined) return undefined;

  const days = Math.round((Date.parse(day) - Date.parse(now)) / DAY_MS);
  try {
    return new Intl.RelativeTimeFormat(localeOf(lang), { numeric: "auto" }).format(days, "day");
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(days, "day");
  }
}

/** The page's entry in `site.data.reviewers`, keyed by page URL. */
function reviewOf(site: Site, url: string): Record<string, unknown> | undefined {
  const reviewers = site.data.reviewers;
  if (!isRecord(reviewers) || !Object.hasOwn(reviewers, url)) return undefined;
  const entry = reviewers[url];
  return isRecord(entry) ? entry : undefined;
}

/**
 * The build's as-of date from the site's data: `site.data.build.date` (or `site.data.build.asOf`) when a
 * site writes `_data/build.yml`, else `site.data.reviewers.asOf` on `_data/reviewers.yml`. Nothing else is
 * used: reading the clock would make two builds of the same source differ.
 */
export function asOfOf(site: Site): string | undefined {
  const build = site.data.build;
  if (typeof build === "string") return isoDate(build);
  if (isRecord(build)) {
    const fromBuild = isoDate(build.asOf) ?? isoDate(build.date);
    if (fromBuild !== undefined) return fromBuild;
  }

  return isRecord(site.data.reviewers) ? isoDate(site.data.reviewers.asOf) : undefined;
}

/**
 * The dates the line shows, each with what it records and whether it can be read at all: the source's
 * last change (`last_modified_at`, else `updated` in front matter) and the page's review date in
 * `site.data.reviewers`. A date that cannot be read stays in the list as `invalid` evidence so the page
 * says "the author wrote a date and it was rejected" rather than saying nothing; a kind with no value
 * written is `absent` and drops out. A review on the same day as the source change is left out as a
 * duplicate. The source date comes first, so {@link dateOf} and a one-date line keep reading the same way.
 */
export function datesOf(page: Page, site: Site): readonly PageDate[] {
  const [source, review] = evidenceOf(page, site);
  const dates: PageDate[] = [];
  if (source.status !== "absent") dates.push(source);
  // Only two readable dates on the same day are a duplicate; two rejected values are two kinds of evidence.
  const duplicate = review.date !== undefined && review.date === source.date;
  if (review.status !== "absent" && !duplicate) dates.push(review);
  return dates;
}

/**
 * Both kinds of date evidence for a page, source first, whether or not the line can show them: what the
 * front matter and the page's entry in `site.data.reviewers` actually supply, each `valid`, `future`,
 * `invalid`, or `absent`. Nothing here reads the clock, so two builds of the same data agree.
 */
export function evidenceOf(page: Page, site: Site): readonly [PageDate, PageDate] {
  const asOf = asOfOf(site);
  const { last_modified_at: lastModified, updated } = page.frontMatter;
  return [
    evidenceOfKind("source", [lastModified, updated], asOf),
    evidenceOfKind("review", [reviewOf(site, page.url)?.date], asOf),
  ];
}

/**
 * True when a value carries nothing an author wrote: a missing key, an empty YAML field (`null`), or a
 * blank string. Such a value is an omission; a value that is present but unreadable is bad data.
 */
function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === "string" && value.trim() === "");
}

/**
 * The evidence one kind of date gives, from the values its author can write for it in order of
 * preference: the first strict ISO calendar date wins, a value that was written but never reads as a
 * real date is `invalid`, and nothing written at all is `absent`. A readable date after the build's
 * as-of day is `future`, so the caller keeps it absolute instead of claiming an upcoming change.
 */
function evidenceOfKind(source: DateSource, values: readonly unknown[], asOf: string | undefined): PageDate {
  for (const value of values) {
    const date = isoDate(value);
    if (date !== undefined) {
      return { source, date, status: asOf === undefined || date <= asOf ? "valid" : "future" };
    }
  }
  return { source, date: undefined, status: values.some((value) => !isAbsent(value)) ? "invalid" : "absent" };
}

/** The page's first readable date: its source date, else its review date. Rejected evidence never counts. */
export function dateOf(page: Page, site: Site): string | undefined {
  return datesOf(page, site).find((entry) => entry.date !== undefined)?.date;
}

/**
 * Up to {@link MAX_CONTRIBUTORS} names for a page, sorted by code point and deduplicated, from the entry's
 * `author` and its `contributors` array in `site.data.reviewers`. Names are trimmed; empty and non-string
 * values are left out.
 */
export function contributorsOf(site: Site, url: string): string[] {
  const review = reviewOf(site, url);
  if (review === undefined) return [];

  const values: unknown[] = [];
  if (review.author !== undefined) values.push(review.author);
  if (Array.isArray(review.contributors)) values.push(...review.contributors);

  const seen = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (name !== "") seen.add(name);
  }

  return [...seen].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).slice(0, MAX_CONTRIBUTORS);
}

/**
 * What the line says for one piece of evidence, chosen without any markup: which words are visible,
 * which label precedes them, and which exact value machine readers and assistive technology get.
 * `undefined` for a value the calendar cannot format at all, so the caller shows nothing for it.
 */
export interface DateDisplay {
  /** `date` for readable evidence with its label and exact value; `unavailable` for rejected evidence. */
  readonly kind: "date" | "unavailable";
  /** Whether the evidence records a source change or a review. */
  readonly source: DateSource;
  /** What the evidence says, carried through from {@link PageDate}. */
  readonly status: DateStatus;
  /** The visible text: relative when vouched for, else absolute, else the neutral wording. */
  readonly text: string;
  /** The localized "Updated" or "Reviewed" label, or `undefined` for rejected evidence. */
  readonly label: string | undefined;
  /** The ISO date for the `datetime` attribute, or `undefined` when no provenance is claimed. */
  readonly datetime: string | undefined;
  /** The exact absolute date for `title` and `aria-label`, or `undefined` likewise. */
  readonly exact: string | undefined;
}

/**
 * The display choice for one piece of evidence, as a pure function of the evidence, the build's as-of
 * date, and the page's language — no markup and no clock. Readable evidence gets its label, then
 * "2 days ago" when the build has an as-of date, else the absolute date; a date after the as-of date is
 * bad data, so it stays absolute rather than reading as impending. The absolute date, in the page's
 * calendar and at the authored precision, always fills `datetime` and `exact`.
 *
 * Rejected evidence gets the opposite treatment: the neutral, non-claiming word and no label, no
 * `datetime`, and no exact value, so a date the build could not read never becomes a freshness claim,
 * a review claim, or machine-readable provenance. The same model serves the markup and the tests.
 */
export function displayOf(entry: PageDate, asOf: string | undefined, lang: string): DateDisplay | undefined {
  if (entry.date === undefined) {
    return {
      kind: "unavailable",
      source: entry.source,
      status: entry.status,
      text: t(lang, UNAVAILABLE_LABEL),
      label: undefined,
      datetime: undefined,
      exact: undefined,
    };
  }

  const absolute = calendarDate(entry.date, lang);
  if (absolute === undefined) return undefined;

  // ISO calendar dates compare correctly as strings, so a later day sorts after the build's as-of day.
  const relative = asOf === undefined || entry.status === "future" ? undefined : relativeDate(entry.date, asOf, lang);
  return {
    kind: "date",
    source: entry.source,
    status: entry.status,
    text: relative ?? absolute.text,
    label: t(lang, LABELS[entry.source]),
    datetime: absolute.datetime,
    exact: absolute.text,
  };
}

/**
 * One date part: the markup for {@link displayOf}'s choice. Readable evidence is a labelled `<time>`
 * whose `title` and `aria-label` carry the exact date; rejected evidence is a neutral span marked with
 * `data-date-source` and `data-date-status`, and never a `<time>` element.
 */
function datePart(entry: PageDate, asOf: string | undefined, lang: string) {
  const display = displayOf(entry, asOf, lang);
  if (display === undefined) return null;

  if (display.kind === "unavailable") {
    return h(
      "span",
      {
        class: `${DATE_CLASS} ${UNAVAILABLE_CLASS}`,
        "data-date-source": display.source,
        "data-date-status": display.status,
      },
      display.text,
    );
  }

  return h(
    "span",
    { class: DATE_CLASS, "data-date-source": display.source, "data-date-status": display.status },
    display.label,
    " ",
    h(
      "time",
      { datetime: display.datetime, title: display.exact, "aria-label": display.exact },
      // Isolated so a Latin date inside an RTL sentence, or vice versa, keeps its own direction.
      h("bdi", {}, display.text),
    ),
  );
}

/**
 * The contributor parts of the line. Each name is isolated in `<bdi>`, with the localized comma between
 * names, so mixed-direction names keep their own order and the sentence keeps its separators.
 */
function contributorNodes(names: readonly string[], lang: string) {
  const comma = `${t(lang, "comma")} `;
  return names.flatMap((name, index) => (index === 0 ? [h("bdi", {}, name)] : [comma, h("bdi", {}, name)]));
}

/**
 * The line under a page title: when the page last changed and who last contributed to it. A source
 * date and a review date are labelled separately, so "Updated" always means the source changed and
 * "Reviewed" always means someone reviewed it. The date comes from front matter or the page's entry in
 * `site.data.reviewers`; the names come from the same entry. A relative date is used only when the
 * site's data supplies an as-of date, so the build never reads the clock; otherwise the absolute date
 * is shown. The absolute date always fills the `title` and `aria-label`.
 *
 * A date the author wrote that does not read as a real calendar date is kept visible as unavailable
 * evidence — the neutral "Date unknown" wording and nothing else, marked `data-date-status="invalid"`
 * — rather than erased, so a reader can tell rejected evidence from evidence that was never supplied.
 * Only a page with no date written and no contributors renders nothing, so a site without review data
 * still carries no empty element.
 */
const lastUpdated: Chrome = ({ site, page }) => {
  const dates = datesOf(page, site);
  const names = contributorsOf(site, page.url);

  if (dates.length === 0 && names.length === 0) return null;

  const asOf = asOfOf(site);
  const dateNodes = dates.map((entry) => datePart(entry, asOf, page.lang)).filter((node) => node !== null);
  if (dateNodes.length === 0 && names.length === 0) return null;

  return h(
    "p",
    { class: CLASS },
    ...dateNodes,
    names.length === 0
      ? null
      : h(
          "span",
          { class: CONTRIBUTORS_CLASS },
          t(page.lang, "contributors_label"),
          " ",
          ...contributorNodes(names, page.lang),
        ),
  );
};

export default lastUpdated;
