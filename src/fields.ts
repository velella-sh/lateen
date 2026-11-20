import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Page, RecordProps, SiteConfig } from "@velella/mizzen/contracts";
import { formatCount, pluralCategory } from "../components/reading-time/index.ts";
import status from "../components/status/index.ts";
import { resolveStatus } from "../components/status/values.ts";
import { t } from "../i18n/index.ts";
import { calendarDate } from "./dates.ts";
import { formatNumber } from "./report.ts";
import { withBase } from "./url.ts";

/**
 * How a record field is shown. `status` reads the site's map, `days` reads the engine's signed day
 * count, and every other kind reads the value as written.
 */
export const FIELD_KINDS = ["text", "number", "boolean", "date", "url", "list", "status", "days"] as const;

export type FieldKind = (typeof FIELD_KINDS)[number];

/** Class on the placeholder a field with no value renders. */
export const EMPTY_CLASS = "field-empty";

/** Class on the placeholder an explicit `null` renders: the field does not apply to this record. */
export const NOT_APPLICABLE_CLASS = "field-na";

/** Class on the `<ul>` a list value renders. */
export const LIST_CLASS = "field-list";

/** Class on the wrapper a status value renders, which keeps the raw value in `data-value`. */
export const STATUS_CLASS = "field-status";

/** A path on this site (not protocol-relative) or an https link. Anything else is not a link. */
const SAFE_URL = /^(?:\/(?![/\\])|https:\/\/)[^\s"<>]*$/;

/**
 * Why a value shows no content: an explicit `null` says the field does not apply, while a missing
 * value, a blank string, and an empty list are missing. Anything else is a value, zero included.
 */
export type ValueState = "missing" | "not-applicable";

export function valueState(value: unknown): ValueState | undefined {
  if (value === null) return "not-applicable";
  if (value === undefined) return "missing";
  if (typeof value === "string") return value.trim() === "" ? "missing" : undefined;
  if (Array.isArray(value) && value.length === 0) return "missing";
  return undefined;
}

/** True when the value carries nothing, as {@link valueState} tells it. */
export function isEmpty(value: unknown): boolean {
  return valueState(value) !== undefined;
}

/** The prefix a page writes to read a value the engine derived instead of a field in the record. */
export const DERIVED_PREFIX = "derived.";

/**
 * The value a page names: a record field, or `derived.<name>` for the engine's computed value. A
 * record without `derived` and a name it does not carry read as `undefined`, so the caller renders
 * the empty placeholder; nothing here computes or compares a date.
 */
export function fieldValueOf(record: Pick<RecordProps, "fields" | "derived">, field: string): unknown {
  if (field.startsWith(DERIVED_PREFIX)) return record.derived?.[field.slice(DERIVED_PREFIX.length)];
  return record.fields[field];
}

/** The kind to render: one of {@link FIELD_KINDS}; anything else is text. */
export function kindOf(kind: unknown): FieldKind {
  return typeof kind === "string" && (FIELD_KINDS as readonly string[]).includes(kind) ? (kind as FieldKind) : "text";
}

/** A value as plain text, so markup in a field is escaped rather than rendered. */
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return JSON.stringify(value) ?? "";
}

/** A number in the page language's digits; a value that is not a number reads as text. */
function numberNode(value: unknown, lang: string): ComponentChildren {
  const number = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(number) ? formatNumber(lang, number) : textOf(value);
}

/** `true` and `false` in the page language; any other value reads as text. */
function booleanNode(value: unknown, lang: string): ComponentChildren {
  const flag = typeof value === "string" ? value.trim().toLowerCase() : value;
  if (flag === true || flag === "true") return t(lang, "field_true");
  if (flag === false || flag === "false") return t(lang, "field_false");
  return textOf(value);
}

/** A date in the page language's calendar, with its ISO form kept in `datetime`; an invalid date reads as text. */
function dateNode(value: unknown, lang: string): ComponentChildren {
  const date = typeof value === "string" ? calendarDate(value, lang) : undefined;
  return date === undefined ? textOf(value) : h("time", { datetime: date.datetime }, date.text);
}

/**
 * A signed day count as the engine derived it: a positive count is time left, a negative count is
 * time past, and zero is today. The number is only printed, never compared with a date; the plural
 * category and the digits come from the page language.
 */
function daysNode(value: unknown, lang: string): ComponentChildren {
  const days = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(days)) return textOf(value);

  const count = Math.trunc(days);
  if (count === 0) return t(lang, "field_today");
  const magnitude = Math.abs(count);
  const direction = count > 0 ? "field_days_left" : "field_days_ago";
  return t(lang, `${direction}_${pluralCategory(lang, magnitude)}`, { n: formatCount(lang, magnitude) });
}

/** A link for a safe URL, with the site's base path; anything else reads as text so a field cannot add a scheme. */
function urlNode(value: unknown, lang: string, config: SiteConfig | undefined): ComponentChildren {
  const url = typeof value === "string" ? value.trim() : textOf(value);
  if (typeof value !== "string" || !SAFE_URL.test(url)) return textOf(value);
  return h("a", { href: withBase(config?.base ?? "", url) }, url);
}

/** A list as an unordered list of formatted values; a value that is not a list reads as text. */
function listNode(value: unknown, lang: string, config: SiteConfig | undefined): ComponentChildren {
  if (!Array.isArray(value)) return textOf(value);
  return h(
    "ul",
    { class: LIST_CLASS },
    value.map((item) => h("li", null, formatField(item, "text", lang, config))),
  );
}

/** The label a status value shows in `lang`, which a status column sorts and filters by rather than by tone. */
export function statusLabel(value: unknown, lang = "en", config?: SiteConfig): string {
  return resolveStatus(textOf(value), lang, config).label;
}

/** A status through the site's map, keeping the raw value in `data-value` for scripts and sorting. */
function statusNode(value: unknown, lang: string, config: SiteConfig | undefined): ComponentChildren {
  const raw = textOf(value);
  return h(
    "span",
    { class: STATUS_CLASS, "data-value": raw },
    h(status as never, {
      props: { value: raw },
      html: "",
      page: { lang } as Page,
      site: { config } as never,
    } as never),
  );
}

/**
 * Formats one record field as render nodes for `lang`. The caller names the kind; a missing value
 * renders {@link EMPTY_CLASS}, an explicit `null` renders {@link NOT_APPLICABLE_CLASS}, each with a
 * localized text alternative, and a string always renders as text, never as HTML.
 */
export function formatField(
  value: unknown,
  kind: unknown = "text",
  lang = "en",
  config?: SiteConfig,
): ComponentChildren {
  const state = valueState(value);
  if (state !== undefined) {
    const notApplicable = state === "not-applicable";
    return h(
      "span",
      { class: notApplicable ? NOT_APPLICABLE_CLASS : EMPTY_CLASS, "data-state": state },
      t(lang, notApplicable ? "field_not_applicable" : "field_empty"),
    );
  }
  switch (kindOf(kind)) {
    case "number":
      return numberNode(value, lang);
    case "boolean":
      return booleanNode(value, lang);
    case "date":
      return dateNode(value, lang);
    case "url":
      return urlNode(value, lang, config);
    case "list":
      return listNode(value, lang, config);
    case "status":
      return statusNode(value, lang, config);
    case "days":
      return daysNode(value, lang);
    default:
      return textOf(value);
  }
}
