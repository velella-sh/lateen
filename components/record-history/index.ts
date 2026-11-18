import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ChangeEvent, Component } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { calendarDate } from "../../src/dates.ts";
import { formatField } from "../../src/fields.ts";

/**
 * The record's own events: newest first, with the date in the page's calendar, the event type, and
 * for a changed field the old and new values as `del` and `ins`. The newest `theme.options.history.limit`
 * stay in view and the rest go behind a native disclosure. A record with no event renders nothing.
 *
 * The engine supplies `record.changes` only when the record template shows `:::changes`, so a site
 * opts into this section from its template; the component never reads the history on its own.
 *
 * shortcut: `ChangeEvent` carries no summary text, so the type label and the field values make the
 * sentence; switch to `event.summary` when the engine adds one.
 */
export const OPTIONS = ["limit"] as const;

/** Class on the section. `styles/parts-record-history.css` styles it. */
export const CLASS = "record-history";

/** Class on the ordered list of events. */
export const LIST_CLASS = "record-history-events";

/** Class on one event. */
export const EVENT_CLASS = "record-history-event";

/** Class on the event's date. */
export const DATE_CLASS = "record-history-date";

/** Class on the event type's visible label. */
export const TYPE_CLASS = "record-history-type";

/** Class on a changed field's name. */
export const FIELD_CLASS = "record-history-field";

/** Class on the old and new value wrapper. */
export const CHANGE_CLASS = "record-history-change";

/** Class on the arrow between the old and the new value. */
export const ARROW_CLASS = "record-history-arrow";

/** Class on the text only assistive technology reads. */
export const SR_CLASS = "record-history-sr";

/** Class on the disclosure that holds the events beyond the limit. */
export const DETAILS_CLASS = "record-history-earlier";

/** The default number of events shown before the disclosure. */
export const DEFAULT_LIMIT = 5;

/** Props from the record page: the events the engine supplied, newest first. */
export type RecordHistoryProps = {
  readonly changes?: readonly ChangeEvent[];
};

/** The visible label of every event type. */
const TYPE_KEYS: Readonly<Record<ChangeEvent["type"], string>> = {
  added: "history_added",
  removed: "history_removed",
  changed: "history_changed",
  renamed: "history_renamed",
  imported: "history_imported",
};

/** The configured limit, falling back to the default for a missing, non-numeric or too-small value. */
export function limitOf(site: { config?: { theme?: { options?: Readonly<Record<string, unknown>> } } } | undefined): number {
  const history = site?.config?.theme?.options?.history;
  const value = typeof history === "object" && history !== null ? (history as { limit?: unknown }).limit : undefined;
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : DEFAULT_LIMIT;
}

function valueNode(value: unknown, label: string, lang: string): ComponentChildren {
  return h("span", null, h("span", { class: SR_CLASS }, `${label}: `), formatField(value, "text", lang));
}

/** The extra detail one event type carries: a field, the old and new value, an earlier id, a count. */
function detailOf(event: ChangeEvent, lang: string): ComponentChildren {
  if (event.type === "changed" && event.field !== undefined) {
    const before = event.old === undefined ? null : h("del", null, valueNode(event.old, t(lang, "history_old_value"), lang));
    const after = event.new === undefined ? null : h("ins", null, valueNode(event.new, t(lang, "history_new_value"), lang));
    return h(
      "span",
      null,
      h("code", { class: FIELD_CLASS }, event.field),
      before === null && after === null
        ? null
        : h(
            "span",
            { class: CHANGE_CLASS },
            before,
            before === null || after === null ? null : h("span", { class: ARROW_CLASS, "aria-hidden": "true" }, "→"),
            after,
          ),
    );
  }
  if (event.type === "renamed" && event.from !== undefined) {
    return h("span", null, t(lang, "history_renamed_from", { id: event.from }));
  }
  if (event.type === "imported" && event.count !== undefined) {
    return h("span", null, t(lang, "history_records", { count: event.count }));
  }
  return null;
}

function eventNode(event: ChangeEvent, lang: string): ComponentChildren {
  const label = t(lang, TYPE_KEYS[event.type]);
  const date = calendarDate(event.date, lang);
  return h(
    "li",
    { class: EVENT_CLASS, "data-event-type": event.type },
    h("time", { class: DATE_CLASS, datetime: date?.datetime ?? event.date }, date?.text ?? event.date),
    h("span", { class: TYPE_CLASS }, label),
    detailOf(event, lang),
  );
}

function listOf(events: readonly ChangeEvent[], lang: string): ComponentChildren {
  return h("ol", { class: LIST_CLASS }, events.map((event) => eventNode(event, lang)));
}

const recordHistory: Component<RecordHistoryProps> = ({ props, page, site }) => {
  const events = props.changes ?? [];
  if (events.length === 0) return null;

  const lang = page?.lang ?? "en";
  const limit = limitOf(site as never);
  const head = events.slice(0, limit);
  const rest = events.slice(limit);

  return h(
    "section",
    { class: CLASS, "aria-labelledby": `${CLASS}-title` },
    h("h2", { id: `${CLASS}-title` }, t(lang, "history_title")),
    listOf(head, lang),
    rest.length === 0
      ? null
      : h(
          "details",
          { class: DETAILS_CLASS },
          h("summary", null, t(lang, "history_earlier", { count: rest.length })),
          listOf(rest, lang),
        ),
  );
};

export default recordHistory;
