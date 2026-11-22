import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps, RecordProps } from "@velella/mizzen/contracts";
import { CARD_CLASS, hrefOf } from "../../components/cards/index.ts";
import { formatField, isEmpty } from "../../src/fields.ts";

export const TITLE_FIELD = "title";
export const STATUS_FIELD = "status";
const SUMMARY_FIELD = "summary";
const FACT_LIMIT = 3;

/** A group as the page shows it: the engine's key, its heading anchor, its page, and its records. */
interface ListGroupView {
  key: string;
  id: string;
  count: number;
  records: readonly RecordProps[];
  url?: string;
}

/** A group key as an anchor id; a repeated or alike-slugged key takes a stable numeric suffix. */
function groupId(key: string, used: Set<string>): string {
  const base = key.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "group";
  let id = base;
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/** The engine's groups in its order, each with the id its section and its TOC entry share. */
export function groupsOf(props: LayoutProps): ListGroupView[] {
  const used = new Set<string>();
  return (props.list?.groups ?? []).map((group) => ({
    key: group.key,
    id: groupId(group.key, used),
    count: group.count ?? group.records.length,
    records: group.records,
    ...(group.url === undefined || group.url === "" ? {} : { url: group.url }),
  }));
}

/** One record as a card: its title, summary, status, and its first few other fields as facts. */
export function cardOf(props: LayoutProps, record: RecordProps): ComponentChildren {
  const fields = record.fields;
  const title = isEmpty(fields[TITLE_FIELD]) ? record.id : String(fields[TITLE_FIELD]);
  const summary = isEmpty(fields[SUMMARY_FIELD]) ? null : String(fields[SUMMARY_FIELD]);
  const status = isEmpty(fields[STATUS_FIELD]) ? null : fields[STATUS_FIELD];
  const facts = Object.keys(fields)
    .filter(
      (field) =>
        field !== TITLE_FIELD && field !== SUMMARY_FIELD && field !== STATUS_FIELD && !isEmpty(fields[field]),
    )
    .slice(0, FACT_LIMIT);
  const parts: ComponentChildren[] = [
    h("span", { class: "card-title" }, title),
    summary === null ? null : h("span", { class: "card-description" }, summary),
    status === null ? null : h("span", { class: "list-card-status" }, String(status)),
    facts.length === 0
      ? null
      : h(
          "dl",
          { class: "list-card-facts" },
          facts.map((field) =>
            h(
              "div",
              { class: "list-card-fact" },
              h("dt", null, field),
              h(
                "dd",
                null,
                formatField(fields[field], "text", props.page.lang, props.site.config) as ComponentChildren,
              ),
            ),
          ),
        ),
  ];
  const href = hrefOf(record.url);
  return href === undefined
    ? h("div", { class: CARD_CLASS }, ...parts)
    : h("a", { class: CARD_CLASS, href }, ...parts);
}
