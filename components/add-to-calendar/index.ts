import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { CalendarLink, Component, ListProps } from "@velella/mizzen/contracts";
import { CalendarPlus } from "lucide";
import { icon } from "../../src/icon.ts";
import { t } from "../../i18n/index.ts";
import { safeHref, withBase } from "../../src/url.ts";

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

/** A calendar app's absolute subscribe address. */
const SAFE_WEBCAL = /^webcal:\/\/[^\s"'<>\\]+$/i;

/**
 * Add to calendar: the record's own file, followed by the collection calendars that contain its
 * events. Each calendar has a link for subscribing in an app and another for downloading its file.
 */
const addToCalendar: Component<AddToCalendarProps> = ({ props, page, site }) => {
  const add = safeHref(props.calendar, ["https:"]);
  const entries = subscribeEntries(props.calendars ?? []);
  if (add === undefined && entries.length === 0) return null;

  const lang = page?.lang ?? "en";
  const title = page?.title.trim() ?? "";
  const addName = title === "" ? t(lang, "record_calendar_add") : t(lang, "record_calendar_add_named", { title });
  return h(
    "div",
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
          h("span", { class: ICON_CLASS, "aria-hidden": "true" }, icon({ node: CalendarPlus })),
          t(lang, "record_calendar_add"),
        ),
    entries.length === 0 ? null : h(
      "ul",
      { class: "add-to-calendar-list", role: "list" },
      entries.map((entry) => h("li", null, calendarActions(entry, lang, LINK_CLASS))),
    ),
  );
};

/** Class on a list page's subscribe panel. */
export const SUBSCRIBE_CLASS = "list-subscribe";

/** Class on the panel's heading. */
export const SUBSCRIBE_HEADING_CLASS = "list-subscribe-heading";

/** Class on the list of calendars. */
export const SUBSCRIBE_LIST_CLASS = "list-subscribe-list";

/** Class on one calendar's row. */
export const SUBSCRIBE_ITEM_CLASS = "list-subscribe-item";

/** Class on the link that opens the subscribe dialog. */
export const SUBSCRIBE_LINK_CLASS = "list-subscribe-link";

/** Class on the visible address. */
export const SUBSCRIBE_ADDRESS_CLASS = "list-subscribe-address";

/** Class on the copy button; it starts `hidden`. */
export const SUBSCRIBE_COPY_CLASS = "list-subscribe-copy";

/** Class on the live region announcing a copy. */
export const SUBSCRIBE_STATUS_CLASS = "list-subscribe-status";

/** Props of the subscribe panel: the list's calendars and, when it groups, one set per group. */
export type SubscribeProps = Pick<ListProps, "calendars" | "groups">;

/** One calendar as the panel shows it: a title and a safe https address with its webcal twin. */
interface SubscribeEntry {
  readonly title: string;
  readonly url: string;
  readonly webcal: string;
}

/** A calendar as a panel row, or undefined when either address is missing or unsafe. */
function subscribeEntry(link: CalendarLink | undefined): SubscribeEntry | undefined {
  if (link == null) return undefined;
  const url = safeHref(link.url, ["https:"]);
  const webcal = typeof link.webcal === "string" ? link.webcal.trim() : "";
  if (url === undefined || !/^https:\/\//i.test(url) || !SAFE_WEBCAL.test(webcal)) return undefined;
  const title = typeof link.title === "string" && link.title.trim() !== "" ? link.title.trim() : link.name;
  return { title, url, webcal };
}

/** The calendars in the engine's order, with repeated URLs offered once. */
function subscribeEntries(links: readonly CalendarLink[]): SubscribeEntry[] {
  const seen = new Set<string>();
  const entries: SubscribeEntry[] = [];
  for (const link of links) {
    const entry = subscribeEntry(link);
    if (entry === undefined || seen.has(entry.url)) continue;
    seen.add(entry.url);
    entries.push(entry);
  }
  return entries;
}

function calendarActions(entry: SubscribeEntry, lang: string, linkClass: string): ComponentChildren {
  return h(
    "div",
    { class: "calendar-actions" },
    h(
      "a",
      { class: linkClass, href: entry.webcal },
      t(lang, "record_calendar_subscribe_named", { title: entry.title }),
    ),
    h(
      "a",
      {
        class: linkClass,
        href: entry.url,
        download: "",
        "aria-label": t(lang, "record_calendar_download_named", { title: entry.title }),
      },
      t(lang, "record_calendar_download"),
    ),
  );
}

/**
 * A list's subscribe panel: subscribe and download links, the address as selectable text, and a
 * copy button the island reveals. Calendars on each group also get their own rows.
 * Nothing renders for a list with no safe calendar.
 */
export function subscribePanel(props: SubscribeProps, lang: string): ComponentChildren {
  const entries = subscribeEntries([
    ...(props.calendars ?? []),
    ...props.groups.flatMap((group) => group.calendars ?? []),
  ]);
  if (entries.length === 0) return null;
  const heading = "list-subscribe-heading";
  return h(
    "section",
    {
      class: SUBSCRIBE_CLASS,
      "data-list-subscribe": "",
      "data-copied": t(lang, "copied"),
      "data-copy-failed": t(lang, "copy_failed"),
      "aria-labelledby": heading,
    },
    h("h2", { class: SUBSCRIBE_HEADING_CLASS, id: heading }, t(lang, "record_calendar_subscribe")),
    h(
      "ul",
      { class: SUBSCRIBE_LIST_CLASS },
      entries.map((entry) =>
        h(
          "li",
          { class: SUBSCRIBE_ITEM_CLASS },
          calendarActions(entry, lang, SUBSCRIBE_LINK_CLASS),
          h(
            "code",
            { class: SUBSCRIBE_ADDRESS_CLASS, dir: "ltr" },
            h("span", { class: "list-subscribe-sr" }, `${t(lang, "list_subscribe_address")}: `),
            entry.url,
          ),
          h(
            "button",
            {
              type: "button",
              class: SUBSCRIBE_COPY_CLASS,
              hidden: true,
              "data-calendar-copy": "",
              "data-text": entry.url,
              "aria-label": t(lang, "list_subscribe_copy"),
            },
            t(lang, "copy"),
          ),
        ),
      ),
    ),
    h("p", {
      class: SUBSCRIBE_STATUS_CLASS,
      role: "status",
      "aria-live": "polite",
      "aria-atomic": "true",
    }),
  );
}

export default addToCalendar;
