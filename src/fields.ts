import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { Page, SiteConfig } from "@velella/mizzen/contracts";
import status from "../components/status/index.ts";
import { resolveStatus } from "../components/status/values.ts";
import { t } from "../i18n/index.ts";
import { calendarDate } from "./dates.ts";
import { formatNumber } from "./report.ts";
import { withBase } from "./url.ts";

/** How a record field is shown. `status` reads the site's map; every other kind reads the value as written. */
export const FIELD_KINDS = ["text", "number", "boolean", "date", "url", "list", "status"] as const;

export type FieldKind = (typeof FIELD_KINDS)[number];

/** Class on the placeholder a field with no value renders. */
export const EMPTY_CLASS = "field-empty";

/** Class on the `<ul>` a list value renders. */
export const LIST_CLASS = "field-list";

/** Class on the wrapper a status value renders, which keeps the raw value in `data-value`. */
export const STATUS_CLASS = "field-status";

/** A path on this site (not protocol-relative) or an https link. Anything else is not a link. */
const SAFE_URL = /^(?:\/(?![/\\])|https:\/\/)[^\s"<>]*$/;

/** True when the value carries nothing: a missing value, a blank string, or an empty list. */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.trim() === "";
  return Array.isArray(value) && value.length === 0;
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
 * Formats one record field as render nodes for `lang`. The caller names the kind; a value with no
 * value renders {@link EMPTY_CLASS} with a localized text alternative, and a string always renders
 * as text, never as HTML.
 */
export function formatField(
  value: unknown,
  kind: unknown = "text",
  lang = "en",
  config?: SiteConfig,
): ComponentChildren {
  if (isEmpty(value)) return h("span", { class: EMPTY_CLASS }, t(lang, "field_empty"));
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
    default:
      return textOf(value);
  }
}
