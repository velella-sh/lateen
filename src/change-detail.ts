import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ChangeEvent } from "@velella/mizzen/contracts";
import { t } from "../i18n/index.ts";
import { formatField } from "./fields.ts";

type ChangeDetail = Omit<Pick<ChangeEvent, "type" | "field" | "old" | "new" | "from" | "count">, "type"> & {
  readonly type: string;
};

/** Class on a changed field's name. */
export const FIELD_CLASS = "record-history-field";

/** Class on the old and new value wrapper. */
export const CHANGE_CLASS = "record-history-change";

/** Class on the arrow between the old and the new value. */
export const ARROW_CLASS = "record-history-arrow";

/** Class on the text only assistive technology reads. */
export const SR_CLASS = "record-history-sr";

function valueNode(value: unknown, label: string, lang: string): ComponentChildren {
  return h("span", null, h("span", { class: SR_CLASS }, `${label}: `), h("bdi", null, formatField(value, "text", lang)));
}

/** The extra detail one event type carries: a field, the old and new value, an earlier id, a count. */
export function changeDetail(
  event: ChangeDetail,
  lang: string,
  fieldClass = FIELD_CLASS,
): ComponentChildren {
  if (event.type === "changed" && event.field !== undefined) {
    const before = event.old === undefined ? null : h("del", null, valueNode(event.old, t(lang, "history_old_value"), lang));
    const after = event.new === undefined ? null : h("ins", null, valueNode(event.new, t(lang, "history_new_value"), lang));
    return h(
      "span",
      null,
      h("code", { class: fieldClass }, event.field),
      before === null && after === null
        ? null
        : h(
            "span",
            { class: CHANGE_CLASS },
            before,
            before === null || after === null ? null : h("span", { class: ARROW_CLASS, "aria-hidden": "true" }, t(lang, "history_change_arrow")),
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
