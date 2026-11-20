import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps, DataRecord, Page, Site } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate } from "../../src/dates.ts";
import { fieldValueOf } from "../../src/fields.ts";
import { textOf as trimmed } from "../../src/guards.ts";
import { baseOf, withBase } from "../../src/url.ts";

/** The Markdown directive this component handles: `::citation{source="handbook"}`. */
export const directive = "citation";

/** Class on the citation aside the island finds. */
export const ROOT_CLASS = "citation";

/** Class on the paragraph holding the citation's parts. */
export const TEXT_CLASS = "citation-text";

/** Class on the title. */
export const TITLE_CLASS = "citation-title";

/** Class on the visible address. */
export const URL_CLASS = "citation-url";

/** Class on the source label and id. */
export const SOURCE_CLASS = "citation-source";

/** Class on the date. */
export const DATE_CLASS = "citation-date";

/** Props from the directive: every part falls back to the page or its record. */
export type CitationProps = {
  /** The work's title; defaults to the page title. */
  title?: string;
  /** The address shown and copied; defaults to the page's absolute URL. */
  url?: string;
  /** The source's identifier; defaults to the page record's id. */
  source?: string;
  /** An ISO date; defaults to the first readable date field of the record's collection. */
  date?: string;
};

/** An `http(s)` link or a root-relative site path, with no backslash, quote, angle bracket, or space. */
const SAFE_URL = /^(?:https?:\/\/[^\s"'<>\\]+|\/(?![/\\])[^\s"'<>\\]*)$/i;

/** A written value as trimmed text, or `""` when it is absent or not a string. */
const textOf = (value: unknown): string => trimmed(value) ?? "";

/** The page's record as the site model holds it, so its fields and configured dates can be read. */
function recordOf(site: Site | undefined, page: Page | undefined): DataRecord | undefined {
  const reference = page?.record;
  return reference === undefined ? undefined : site?.collections[reference.collection]?.records.find((record) => record.id === reference.id);
}

/**
 * The page's own address: absolute when the site names a `url`, else its site path. `page.url`
 * already carries the site's base, so the base is never added twice.
 */
function pageUrl(site: Site | undefined, page: Page | undefined): string {
  const path = textOf(page?.url);
  if (!/^\/(?![/\\])/.test(path)) return "";
  const origin = textOf(site?.config.url).replace(/\/+$/, "");
  return /^https?:\/\/[^/]+$/i.test(origin) ? `${origin}${path}` : path;
}

/**
 * The address to show: the directive's own when it writes one, else the page's. A root-relative
 * path from the directive gets the site's base; anything unsafe is left out entirely.
 */
function urlOf(written: string, site: Site | undefined, page: Page | undefined): string {
  if (written === "") return pageUrl(site, page);
  if (!SAFE_URL.test(written)) return "";
  return written.startsWith("/") ? withBase(baseOf(site), written) : written;
}

/** The first date field the record's collection configures whose value is a real calendar date. */
function recordDate(record: DataRecord | undefined, collection: string, site: Site | undefined, lang: string): string {
  if (record === undefined) return "";
  const fields = site?.config.collections[collection]?.dates ?? [];
  for (const field of fields) {
    const value = record.normalizedDates?.[field] ?? fieldValueOf(record, field);
    const written = value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === "string" ? value.trim() : "";
    if (written !== "" && calendarDate(written, lang) !== undefined) return written;
  }
  return "";
}

/**
 * A copyable citation: the title, a visible address, the source's identifier, and a date, each only
 * when it exists, joined into one sentence. The island adds a copy control; the printed and no-JS
 * pages keep the same parts in their HTML. An unsafe address is left out rather than linked.
 */
export default function citation({ props, page, site }: ComponentProps<Readonly<Record<string, unknown>>>) {
  const input = props as CitationProps;
  const lang = page?.lang ?? "en";
  const title = textOf(input.title) || textOf(page?.title);
  const url = urlOf(textOf(input.url), site, page);
  const source = textOf(input.source) || textOf(page?.record?.id);
  const written = textOf(input.date) || recordDate(recordOf(site, page), textOf(page?.record?.collection), site, lang);
  const date = written === "" ? undefined : calendarDate(written, lang);

  const parts: ComponentChildren[] = [];
  if (title !== "") parts.push(h("span", { class: TITLE_CLASS }, title));
  if (url !== "") parts.push(h("a", { class: URL_CLASS, href: url, dir: "ltr" }, url));
  if (source !== "") {
    parts.push(
      h("span", { class: SOURCE_CLASS }, `${t(lang, "citation_source")}: `, h("span", { dir: "ltr" }, source)),
    );
  }
  if (date !== undefined) parts.push(h("time", { class: DATE_CLASS, datetime: date.datetime }, date.text));

  if (parts.length === 0) return null;

  const text: ComponentChildren[] = [];
  parts.forEach((part, index) => {
    if (index > 0) text.push(". ");
    text.push(part);
  });

  return h(
    "aside",
    {
      class: ROOT_CLASS,
      "data-citation": "",
      "data-copy": t(lang, "citation_copy"),
      "data-copied": t(lang, "citation_copied"),
    },
    h("p", { class: TEXT_CLASS }, ...text),
  );
}
