/*
 * The search combobox's option model: the rows one query produces, in the order the dialog shows them,
 * each carrying the identity assistive technology reads.
 *
 * A row is one option of one listbox whether it came from the Pagefind index or from the palette's
 * actions, so a reader arrowing through the list cannot tell the two kinds apart and a screen reader
 * announces both the same way. The model is pure: `client.ts` turns these rows into elements and keeps
 * the active one in step with them, so tests need no browser.
 *
 * Ids are positional (`search-option-1`, …) because identity alone cannot separate a duplicate: two
 * results for the same URL, or two actions sharing an id, must stay two options, and an
 * `aria-activedescendant` value they both claimed would highlight the wrong row. Position cannot follow
 * a row across a redraw, so a row also carries a `key` built from its own identity plus which
 * occurrence of that identity it is; the active option is remembered by key and re-resolved to an id
 * with `activeIndexOf`.
 */

import type { PaletteAction } from "../command-palette/actions.ts";
import { resultHeading, sectionPaths, type HeadingSource } from "../../src/search/merge.ts";
import { safeHref as safeUrl } from "../../src/url.ts";

/** The group heading when the server sends no label. */
export const ACTIONS_LABEL = "Actions";

/** The ask group's heading when the server sends no label. */
export const ASK_HEADING = "Ask your agent";

/** The filter the engine writes on every indexed page; its first value is the page's section. */
export const SECTION_FILTER = "section";

/** Where a result without a section lands, matching the engine's name for pages outside a group. */
export const OTHER_SECTION = "Other";

/** The id prefix of an option row; ids are positional, so a duplicate row still gets its own. */
export const OPTION_ID_PREFIX = "search-option-";

/** The id prefix of a group heading, which the group's `aria-labelledby` points at. */
export const GROUP_ID_PREFIX = "search-group-";

/** The three kinds of row the dialog shows: a page from the index, an action, or the ask-agent row. */
export type OptionKind = "result" | "action" | "ask";

/** One result Pagefind returns, as `data()` gives it. */
export interface SearchRecord extends HeadingSource {
  readonly url: string;
  readonly excerpt: string;
  readonly meta?: { readonly title?: string | undefined };
  readonly filters?: Readonly<Record<string, readonly string[]>>;
}

/** Results that share one section, in the order Pagefind ranked them. */
export interface ResultGroup {
  readonly section: string;
  readonly results: readonly SearchRecord[];
}

/** One option of the listbox: its element id, the key that survives a redraw, and what it shows. */
export interface OptionRow {
  /** The id `aria-activedescendant` and `role="option"` share. */
  readonly id: string;
  /** The row's identity, stable across redraws of the same query. */
  readonly key: string;
  readonly kind: OptionKind;
  /** The href a browser may follow; absent for an action and for an index URL that is not a link. */
  readonly href?: string | undefined;
  /** The Pagefind record behind a result row. */
  readonly record?: SearchRecord | undefined;
  /** The section path that tells this result apart; absent when no result needs one. */
  readonly path?: string | undefined;
  /** The real heading text for the fragment in the result's URL, when the index supplies it. */
  readonly heading?: string | undefined;
  /** The action behind an action row. */
  readonly action?: PaletteAction | undefined;
  /** The ask option behind the ask row. */
  readonly ask?: AskOption | undefined;
}

/** One heading and the rows under it: a section of results, or the actions. */
export interface OptionGroup {
  /** The id of the heading element, which the group names itself by. */
  readonly id: string;
  readonly kind: OptionKind;
  /** The heading text, already in the page language. */
  readonly heading: string;
  readonly rows: readonly OptionRow[];
}

/** Everything one query puts in the listbox. */
export interface OptionList {
  /** The groups, in the order the dialog shows them. */
  readonly groups: readonly OptionGroup[];
  /** Every row of every group, in the same order: the order the arrow keys walk. */
  readonly rows: readonly OptionRow[];
}

/** The page language's names for the two kinds of heading. */
export interface OptionLabels {
  readonly otherSection?: string | undefined;
  readonly actionsLabel?: string | undefined;
  readonly askHeading?: string | undefined;
}

/** The ask row: the reader's question, its label, and the hint that says what it does. */
export interface AskOption {
  readonly question: string;
  readonly label: string;
  readonly hint?: string | undefined;
}

/**
 * Only links the browser can follow: a root-relative path, a Pagefind-style `./` or `../` path, or
 * `http`/`https`. A `javascript:` or `data:` URL from the index is never a link.
 */
export function safeHref(url: string): string | undefined {
  return safeUrl(url, undefined, true);
}

/** The section a result belongs to, from the engine's `section` filter; a missing filter reads as `Other`. */
export function sectionOf(record: SearchRecord): string {
  const value = record.filters?.[SECTION_FILTER]?.[0]?.trim();
  return value === undefined || value === "" ? OTHER_SECTION : value;
}

/** Groups ranked results by section, keeping the order each section first appears in. */
export function groupBySection(records: readonly SearchRecord[]): readonly ResultGroup[] {
  const groups = new Map<string, SearchRecord[]>();
  for (const record of records) {
    const section = sectionOf(record);
    const group = groups.get(section);
    if (group === undefined) groups.set(section, [record]);
    else group.push(record);
  }
  return [...groups].map(([section, results]) => ({ section, results }));
}

/** The id of the row at `index`, counting from one: the first option is `search-option-1`. */
export function optionId(index: number): string {
  return `${OPTION_ID_PREFIX}${index + 1}`;
}

/** The heading id of the group at `index`, counting from one. */
export function groupId(index: number): string {
  return `${GROUP_ID_PREFIX}${index + 1}`;
}

/** The key of a result row: its URL and which page with that URL it is. */
export function resultKey(url: string, occurrence: number): string {
  return `result:${url}#${occurrence}`;
}

/** The key of an action row: its action id and which action with that id it is. */
export function actionKey(id: string, occurrence: number): string {
  return `action:${id}#${occurrence}`;
}

/** The key of the ask row: its question and which ask row with that question it is. */
export function askKey(question: string, occurrence: number): string {
  return `ask:${question}#${occurrence}`;
}

/** The words a reader typed: two of them make a question worth handing to an agent. */
export function wordCount(query: string): number {
  return query.trim().split(/\s+/).filter((word) => word !== "").length;
}

/**
 * The listbox's rows for one query: the page results first, grouped by section in rank order, then the
 * matched actions under one heading, then — when the query is a question — the ask row under its own
 * heading. Ids count every row in that order, so the row a reader reaches by arrowing down is the row
 * the pointer finds third, and both are `search-option-3`.
 */
export function optionList(
  records: readonly SearchRecord[],
  actions: readonly PaletteAction[],
  labels: OptionLabels = {},
  ask?: AskOption | undefined,
): OptionList {
  const otherSection = labels.otherSection ?? OTHER_SECTION;
  const actionsLabel = labels.actionsLabel ?? ACTIONS_LABEL;
  const askHeading = labels.askHeading ?? ASK_HEADING;
  // One map counts occurrences as rows are built, so a duplicate-heavy list costs a single pass:
  // no row ever rescans the rows before it to learn which occurrence of its identity it is.
  const seen = new Map<string, number>();

  /** The next occurrence of `base`, so two rows with the same identity still get different keys. */
  const occurrence = (base: string): number => {
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count;
  };

  const groups: { id: string; kind: OptionKind; heading: string; rows: OptionRow[] }[] = [];
  const rows: OptionRow[] = [];
  // One list-level decision, so a path every result shares is not repeated on every row.
  const paths = sectionPaths(records.map((record) => record.url));
  const pathOf = new Map(records.map((record, index) => [record.url, paths[index] ?? ""]));

  /** Opens the next group, whether it holds results or actions. */
  const open = (kind: OptionKind, heading: string): void => {
    groups.push({ id: groupId(groups.length), kind, heading, rows: [] });
  };
  /** Appends a row to the open group and to the flat list, giving it the next positional id. */
  const add = (row: OptionRow): void => {
    const group = groups.at(-1);
    if (group === undefined) return;
    group.rows.push(row);
    rows.push(row);
  };

  for (const section of groupBySection(records)) {
    open("result", section.section === OTHER_SECTION ? otherSection : section.section);
    for (const record of section.results) {
      add({
        id: optionId(rows.length),
        key: resultKey(record.url, occurrence(`result:${record.url}`)),
        kind: "result",
        href: safeHref(record.url),
        record,
        path: pathOf.get(record.url),
        heading: resultHeading(record.url, record),
      });
    }
  }

  if (actions.length > 0) {
    open("action", actionsLabel);
    for (const action of actions) {
      add({
        id: optionId(rows.length),
        key: actionKey(action.id, occurrence(`action:${action.id}`)),
        kind: "action",
        action,
      });
    }
  }

  if (ask !== undefined) {
    open("ask", askHeading);
    add({
      id: optionId(rows.length),
      key: askKey(ask.question, occurrence(`ask:${ask.question}`)),
      kind: "ask",
      ask,
    });
  }

  return { groups, rows };
}

/**
 * The row a remembered key names after a redraw: its index in `rows`, or -1 when there is no key or
 * the new query dropped the row, so the field then names nothing rather than a row that is not there.
 */
export function activeIndexOf(rows: readonly { readonly key: string }[], key: string | undefined): number {
  return key === undefined ? -1 : rows.findIndex((row) => row.key === key);
}