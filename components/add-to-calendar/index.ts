import { h } from "preact";
import type { CalendarLink, Component } from "@velella/mizzen/contracts";
import { calendarPlus } from "../../icons/index.ts";
import { t } from "../../i18n/index.ts";
import { withBase } from "../link-card/index.ts";

/** Class on the line holding the calendar links. */
export const CLASS = "add-to-calendar";

/** Class on each link. */
export const LINK_CLASS = "add-to-calendar-link";

/** Class on the decorative calendar icon. */
export const ICON_CLASS = "add-to-calendar-icon";

/** The props the record layout passes; the control has no directive options. */
export const OPTIONS = ["calendar", "calendars"] as const;

/** Props from the record page: the `.ics` file and the calendars the record belongs to. */
export type AddToCalendarProps = {
  /** URL of the record's own `.ics` file, root-relative and already carrying the site base. */
  readonly calendar?: string;
  /** The calendars the record has events in, with absolute `https` and `webcal` addresses. */
  readonly calendars?: readonly CalendarLink[];
};

/** A root-relative path or an `https` address; `javascript:`, `http:`, and `//host` are refused. */
const SAFE_ADD = /^(?:\/(?![/\\])|https:\/\/)[^\s"'<>\\]*$/i;

/** A calendar app's absolute subscribe address; nothing else opens a subscribe dialog. */
const SAFE_WEBCAL = /^webcal:\/\/[^\s"'<>\\]+$/i;

/** The add address, trimmed, or undefined when it is missing, blank, or unsafe. */
function addAddressOf(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const address = value.trim();
  return SAFE_ADD.test(address) ? address : undefined;
}

/** The first safe calendar's webcal address: its https file and webcal address must both hold. */
function webcalOf(calendars: readonly CalendarLink[] | undefined): string | undefined {
  for (const link of calendars ?? []) {
    const url = typeof link?.url === "string" ? link.url.trim() : "";
    const webcal = typeof link?.webcal === "string" ? link.webcal.trim() : "";
    if (/^https:\/\//i.test(url) && SAFE_WEBCAL.test(webcal)) return webcal;
  }
  return undefined;
}

/**
 * Add to calendar: a download link for the record's `.ics` file and, when the record belongs to a
 * calendar, a subscribe link for its `webcal` address. A record with no safe address renders
 * nothing. The visible text stays short; the accessible name carries the record title, so a page
 * with several records never offers two links named the same thing.
 */
const addToCalendar: Component<AddToCalendarProps> = ({ props, page, site }) => {
  const add = addAddressOf(props.calendar);
  const webcal = webcalOf(props.calendars);
  if (add === undefined && webcal === undefined) return null;

  const lang = page?.lang ?? "en";
  const title = page?.title.trim() ?? "";
  const addName = title === "" ? t(lang, "record_calendar_add") : t(lang, "record_calendar_add_named", { title });
  const subscribeName =
    title === "" ? t(lang, "record_calendar_subscribe") : t(lang, "record_calendar_subscribe_named", { title });

  return h(
    "p",
    { class: CLASS },
    add === undefined
      ? null
      : h(
          "a",
          {
            class: LINK_CLASS,
            href: withBase(site?.config?.base ?? "", add),
            title: t(lang, "record_calendar_download"),
            "aria-label": addName,
          },
          h("span", {
            class: ICON_CLASS,
            "aria-hidden": "true",
            dangerouslySetInnerHTML: { __html: calendarPlus },
          }),
          t(lang, "record_calendar_add"),
        ),
    webcal === undefined
      ? null
      : h(
          "a",
          { class: LINK_CLASS, href: webcal, "aria-label": subscribeName },
          t(lang, "record_calendar_subscribe"),
        ),
  );
};

export default addToCalendar;
