/*
 * Search dialog and command palette: loads the Pagefind index on first open, runs the query, groups
 * page results by section, groups the page's actions under "Actions", and keeps keyboard focus inside
 * the dialog. No index is fetched until the reader opens search, so a page that never searches
 * downloads no search JavaScript data.
 *
 * The field is a combobox and the list is the listbox it controls. Every row this module
 * produces puts its option role on its own control, so a keyboard, a pointer, and assistive tech all meet
 * one element, and the active option is the control the field names in `aria-activedescendant`: the arrow
 * keys, a pointer entering a row, and a redraw all move that one active option, and focus stays in the
 * field while the dialog is open. A redraw re-resolves the active option by key, so the field can never
 * point at a row the new query removed.
 *
 * The action list arrives as inert JSON from `chrome/command-palette/`; this module parses it,
 * filters it on the same query as the page results, and runs the chosen action. The module and its
 * client-only helper (`shortcut.ts`) import no server module, so they are safe to serve as an island.
 */

import type { PaletteAction, PalettePayload, PaletteRun, ThemeChoice } from "../command-palette/actions.ts";
import { activateShortcuts, type ShortcutEvent } from "./shortcut.ts";
import { activateAskAgent, parseAskConfig, type AskDocument, type AskElement, type AskResult } from "../ask-agent/client.ts";
import { browserFetch } from "../copy-markdown/island.ts";

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
 * occurrence of that identity it is; the active option is remembered by key and re-resolved to an id.
 */

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
export interface SearchRecord {
  readonly url: string;
  readonly excerpt: string;
  readonly meta?: { readonly title?: string | undefined };
  readonly filters?: Readonly<Record<string, readonly string[]>>;
}

/** One hit in a Pagefind result list. */
export interface SearchHit {
  data(): Promise<SearchRecord>;
}

/** The part of Pagefind's browser API the dialog uses. */
export interface PagefindApi {
  search(term: string): Promise<{ readonly results: readonly SearchHit[] }>;
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

/** Only links the browser can follow: a `javascript:` or `data:` URL from the index is never a link. */
export function safeHref(url: string): string | undefined {
  return url.startsWith("/") || url.startsWith("./") || url.startsWith("../") || /^https?:\/\//i.test(url)
    ? url
    : undefined;
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
  const seen = new Map<string, number>();

  /** The next occurrence of `base`, so two rows with the same identity still get different keys. */
  const occurrence = (base: string): number => {
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count;
  };

  const groups: { id: string; kind: OptionKind; heading: string; rows: OptionRow[] }[] = [];
  const rows: OptionRow[] = [];

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

/** localStorage key for the visitor's theme choice; keep in step with `layouts/base.ts`. */
export const THEME_KEY = "lateen-theme";

/** Most results shown for one query; Pagefind ranks them, and the top of the list is what a reader wants. */
export const RESULT_LIMIT = 20;

/** The CLDR plural categories a count message can have, matching `i18n/*.json`. */
export const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"] as const;

export type PluralCategory = (typeof PLURAL_CATEGORIES)[number];

/**
 * Every message the dialog shows, in the page language. `chrome/search/index.ts` writes them into
 * `data-search-*` attributes; these English values are the fallback when a page carries none. The
 * empty message takes `{query}` and each count takes `{n}`.
 */
export interface SearchMessages {
  readonly loading: string;
  readonly searching: string;
  readonly failed: string;
  readonly copied: string;
  readonly copyFailed: string;
  readonly empty: string;
  readonly counts: Readonly<Record<PluralCategory, string>>;
  readonly otherSection: string;
  readonly actions: string;
  readonly askHeading: string;
  readonly askLabel: string;
  readonly askHint: string;
}

export const MESSAGES: SearchMessages = {
  loading: "Loading search…",
  searching: "Searching…",
  failed: "Search is unavailable right now.",
  copied: "Copied",
  copyFailed: "Copy failed.",
  empty: "No results for “{query}”.",
  counts: {
    zero: "{n} results.",
    one: "{n} result.",
    two: "{n} results.",
    few: "{n} results.",
    many: "{n} results.",
    other: "{n} results.",
  },
  otherSection: "Other",
  actions: "Actions",
  askHeading: "Ask your agent",
  askLabel: "Ask your agent about “{query}”",
  askHint: "Copy a prompt for your own agent",
};


/** The header's search button: `client.ts` reveals it and returns focus to it when the dialog closes. */
export interface SearchButton {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", listener: () => void): void;
  click(): void;
  focus(): void;
}

/** The dialog's close button; it has the same shape as the search button. */
export type SearchClose = SearchButton;

/**
 * The query field. It is the combobox, so it carries the popup's state: `aria-expanded` while the
 * dialog is open, and the active option in `aria-activedescendant`. That attribute is removed rather
 * than emptied when no row is active, because a reference to a row that is not there would dangle.
 */
export interface SearchInput {
  value: string;
  focus(): void;
  setAttribute(name: string, value: string): void;
  removeAttribute?(name: string): void;
  addEventListener(type: "input", listener: () => void): void;
}

/** Anything in the dialog that can take keyboard focus, for the focus trap. */
export interface SearchFocusable {
  focus(): void;
}

/** A node in the result list; the browser supplies real nodes, tests a small tree. */
export interface SearchNode {}

/** An element the option renderer builds. */
export interface SearchElement extends SearchNode {
  setAttribute(name: string, value: string): void;
  append(...nodes: SearchNode[]): void;
  /** A row listens for a pointer entering it; its own control listens for a click. */
  addEventListener?(type: string, listener: () => void): void;
  /** Follows a result link or presses an action button, as the browser would. */
  click?(): void;
  /** Brings a row into view, so the active option is visible wherever the list is scrolled. */
  scrollIntoView?(options: { readonly block: "nearest" }): void;
}

/** The part of `document` the option renderer uses. */
export interface SearchDocument {
  createElement(tag: string): SearchElement;
  createTextNode(text: string): SearchNode;
}

/** The container `client.ts` fills with option nodes. */
export interface SearchResults {
  replaceChildren(...nodes: SearchNode[]): void;
}

/** The status region results and failures are announced on. */
export interface SearchStatus {
  textContent: string | null;
}

/** The inert JSON `chrome/command-palette/` writes into the dialog. */
export interface SearchPaletteSource {
  textContent: string | null;
}

/** What running one action does; the browser supplies working versions, tests inject spies. */
export interface PaletteHandlers {
  theme?(choice: ThemeChoice): void;
  copy?(url: string): void | Promise<void>;
  section?(id: string): void;
  source?(): void;
}

/** A keyboard or dialog event as the dialog reads it. */
export interface SearchEvent {
  readonly key?: string | undefined;
  readonly shiftKey?: boolean | undefined;
  readonly target?: unknown;
  preventDefault(): void;
}

/** The `<dialog>` element as the script touches it. */
export interface SearchDialog {
  readonly open: boolean;
  hidden: boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  showModal(): void;
  close(): void;
  querySelectorAll(selector: string): Iterable<SearchFocusable>;
  addEventListener(type: string, listener: (event: SearchEvent) => void): void;
}

/** The elements the island wires together. */
export interface SearchParts {
  dialog: SearchDialog;
  button: SearchButton;
  close: SearchClose;
  input: SearchInput;
  results: SearchResults;
  status: SearchStatus;
  /** The command palette's JSON script, when the page carries one. */
  palette?: SearchPaletteSource | undefined;
  /** The field's clear button; it appears only while the field holds text. */
  clear?: {
    hidden: boolean;
    disabled: boolean;
    addEventListener(type: "click", listener: () => void): void;
  } | undefined;
}

/** Everything the island reads from the world; tests pass fakes, the browser supplies its own. */
export interface SearchEnv {
  document: SearchDocument;
  load(url: string): Promise<PagefindApi>;
  /** The action payload; the island parses it from `parts.palette`, tests pass it directly. */
  palette?: PalettePayload | undefined;
  /** How actions run; the island uses `liveHandlers()`, tests inject spies. */
  handlers?: PaletteHandlers | undefined;
  /** The page language, which chooses the count's plural category. */
  lang?: string | undefined;
  /** The page language's messages; the island reads them from the dialog's attributes. */
  messages?: SearchMessages | undefined;
  /** Opens the ask panel with the question and the results the dialog currently shows. */
  ask?: ((question: string, records: readonly SearchRecord[]) => void) | undefined;
}

/**
 * What can take keyboard focus inside the dialog. An option row is not on the list: a combobox keeps
 * focus in its own field and points at a row instead, and every row's control carries `tabindex="-1"`.
 */
const FOCUSABLE = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/** The five entities Pagefind writes when it escapes page text, plus the apostrophe forms. */
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  "#x27": "'",
};

/** Reads one excerpt fragment back to the text a reader should see. */
function textOf(fragment: string): string {
  return fragment.replace(/&(amp|lt|gt|quot|apos|#39|#x27);/gi, (entity, name: string) => ENTITIES[name.toLowerCase()] ?? entity);
}

/** One run of an excerpt and whether Pagefind marked it as a match. */
interface Segment {
  readonly text: string;
  readonly marked: boolean;
}

/** Pagefind's own emphasis tags; page content is escaped, so these are the only tags an excerpt carries. */
const MARK_TAG = /<mark\b[^>]*>|<\/mark\s*>/gi;

/** Splits an excerpt at its `<mark>` boundaries, leaving every other character as text. */
function segmentsOf(excerpt: string): readonly Segment[] {
  const segments: Segment[] = [];
  let marked = false;
  let last = 0;
  for (const match of excerpt.matchAll(MARK_TAG)) {
    if (match.index > last) segments.push({ text: excerpt.slice(last, match.index), marked });
    marked = !match[0].startsWith("</");
    last = match.index + match[0].length;
  }
  if (last < excerpt.length) segments.push({ text: excerpt.slice(last), marked });
  return segments;
}

/** The excerpt as text nodes, with Pagefind's matches wrapped in plain `<mark>` elements. */
function excerptNode(excerpt: string, doc: SearchDocument): SearchElement {
  const span = doc.createElement("span");
  span.setAttribute("class", "search-result-excerpt");
  for (const segment of segmentsOf(excerpt)) {
    if (!segment.marked) {
      span.append(doc.createTextNode(textOf(segment.text)));
      continue;
    }
    const mark = doc.createElement("mark");
    mark.append(doc.createTextNode(textOf(segment.text)));
    span.append(mark);
  }
  return span;
}

/** A result's title: the index's own, or the page URL when the index carries none. */
function titleNode(record: SearchRecord, doc: SearchDocument): SearchElement {
  const title = record.meta?.title?.trim();
  const element = doc.createElement("span");
  element.setAttribute("class", "search-result-title");
  element.append(doc.createTextNode(title === undefined || title === "" ? record.url : title));
  return element;
}

/**
 * The attributes that make one control the option the listbox owns: the id `aria-activedescendant`
 * names, the selection assistive tech reads, and the key the dialog re-resolves after a redraw. A
 * control is in the tab order for a pointer only: a combobox keeps keyboard focus in its own field.
 */
function optionAttributes(element: SearchElement, row: OptionRow): void {
  element.setAttribute("role", "option");
  element.setAttribute("id", row.id);
  element.setAttribute("aria-selected", "false");
  element.setAttribute("tabindex", "-1");
  element.setAttribute("data-search-option", row.key);
}

/** A result's option: title and excerpt inside a link, or inside plain text when the URL is unsafe. */
function resultContent(row: OptionRow, record: SearchRecord, doc: SearchDocument): SearchElement {
  const link = doc.createElement(row.href === undefined ? "span" : "a");
  link.setAttribute("class", "search-result-link");
  if (row.href !== undefined) link.setAttribute("href", row.href);
  // The control is the option, so a pointer, a keyboard, and assistive tech all meet the same element.
  optionAttributes(link, row);
  link.append(titleNode(record, doc), excerptNode(record.excerpt, doc));
  return link;
}

/** An action's option: its label and hint, its descriptor, and the click that runs it. */
function actionContent(
  row: OptionRow,
  action: PaletteAction,
  doc: SearchDocument,
  run: (run: PaletteRun) => void,
): SearchElement {
  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("class", "search-action-button");
  button.setAttribute("data-palette-action", action.id);
  optionAttributes(button, row);
  if (action.run !== undefined) {
    const command = action.run;
    button.addEventListener?.("click", () => run(command));
  }

  const label = doc.createElement("span");
  label.setAttribute("class", "search-action-label");
  label.append(doc.createTextNode(action.label));
  button.append(label);

  if (action.hint !== undefined && action.hint !== "") {
    const hint = doc.createElement("span");
    hint.setAttribute("class", "search-action-hint");
    hint.append(doc.createTextNode(action.hint));
    button.append(hint);
  }
  return button;
}

/** The ask row's option: its question as the label, the hint that says what happens, and the click. */
function askContent(row: OptionRow, ask: AskOption, doc: SearchDocument, open: (question: string) => void): SearchElement {
  const button = doc.createElement("button");
  button.setAttribute("type", "button");
  button.setAttribute("class", "search-ask-button");
  button.setAttribute("data-ask-agent-open", "");
  optionAttributes(button, row);
  button.addEventListener?.("click", () => open(ask.question));

  const label = doc.createElement("span");
  label.setAttribute("class", "search-action-label");
  label.append(doc.createTextNode(ask.label));
  button.append(label);

  if (ask.hint !== undefined && ask.hint !== "") {
    const hint = doc.createElement("span");
    hint.setAttribute("class", "search-action-hint");
    hint.append(doc.createTextNode(ask.hint));
    button.append(hint);
  }
  return button;
}

/** A drawn row: the shape the list shows, and the option inside it that a reader chooses. */
interface DrawnRow {
  readonly item: SearchElement;
  readonly option: SearchElement;
}

/**
 * One row, of any kind. The `li` is the list's shape rather than a choice of its own, so it carries
 * no role: a row is never counted twice, and a pointer entering anywhere in it names its option.
 */
function optionNode(row: OptionRow, index: number, render: OptionRender): DrawnRow {
  const item = render.doc.createElement("li");
  item.setAttribute("class", row.kind === "action" ? "search-result search-action" : "search-result");
  item.addEventListener?.("pointerenter", () => render.hover?.(index));

  let option: SearchElement | undefined;
  const action = row.action;
  if (row.kind === "action" && action !== undefined) option = actionContent(row, action, render.doc, render.run);
  const ask = row.ask;
  if (row.kind === "ask" && ask !== undefined && render.ask !== undefined) {
    const open = render.ask;
    option = askContent(row, ask, render.doc, open);
  }
  const record = row.record;
  if (record !== undefined) option = resultContent(row, record, render.doc);
  if (option === undefined) {
    // The model gives every row a control, so this only happens for a hand-built row: it is still an
    // option a reader can hear, and pressing it does nothing.
    item.setAttribute("role", "option");
    item.setAttribute("id", row.id);
    item.setAttribute("aria-selected", "false");
    item.setAttribute("data-search-option", row.key);
    return { item, option: item };
  }
  item.setAttribute("role", "presentation");
  item.append(option);
  return { item, option };
}

/** One drawn option: its element, and the two things the dialog can do with it. */
export interface RenderedOption {
  /** The id `aria-activedescendant` names while this row is the active option. */
  readonly id: string;
  /** The identity that survives a redraw, so the active row can be found again. */
  readonly key: string;
  /** The option element itself: the row's link or button, which is what a reader chooses. */
  readonly element: SearchElement;
  /** Runs the option as a pointer click on it would; one with no safe target does nothing. */
  activate(): void;
}

/** What drawing the list needs: a document, how to run an action, and how to follow a pointer. */
export interface OptionRender {
  readonly doc: SearchDocument;
  readonly run: (run: PaletteRun) => void;
  /** Called with the ask row's question; absent leaves the ask row inert. */
  readonly ask?: ((question: string) => void) | undefined;
  /** Called with the row's position when a pointer enters it, so the active option follows. */
  readonly hover?: ((index: number) => void) | undefined;
}

/**
 * Replaces the dialog's list with `list`'s groups, page results first and matched actions last, and
 * returns its rows in the order of `list.rows` so row 4 of the model is row 4 of the DOM. A group is
 * `role="group"`, naming itself by its heading: a heading is never an option, and every option it owns
 * is one choice a reader can reach. Text never passes through an HTML string.
 */
export function renderOptions(
  results: SearchResults,
  list: OptionList,
  render: OptionRender,
): readonly RenderedOption[] {
  const { doc } = render;
  const drawn: RenderedOption[] = [];
  const sections: SearchElement[] = [];

  for (const group of list.groups) {
    const heading = doc.createElement("h2");
    heading.setAttribute("class", "search-group-title");
    heading.setAttribute("id", group.id);
    // Inside a listbox a heading is content the list may not own, and the group is named by it anyway:
    // it stays the section's visible title and lends its text, without becoming a choice of its own.
    heading.setAttribute("role", "presentation");
    heading.append(doc.createTextNode(group.heading));

    const rows = doc.createElement("ul");
    rows.setAttribute("class", "search-list");
    rows.setAttribute("role", "presentation");

    const section = doc.createElement("section");
    section.setAttribute("class", group.kind === "action" ? "search-group search-actions-group" : "search-group");
    section.setAttribute("role", "group");
    section.setAttribute("aria-labelledby", group.id);

    for (const row of group.rows) {
      const index = drawn.length;
      const drawnRow = optionNode(row, index, render);
      rows.append(drawnRow.item);
      const option = drawnRow.option;
      drawn.push({
        id: row.id,
        key: row.key,
        element: option,
        activate() {
          option.click?.();
          option.scrollIntoView?.({ block: "nearest" });
        },
      });
    }

    section.append(heading, rows);
    sections.push(section);
  }

  results.replaceChildren(...sections);
  return drawn;
}

/** A whole-word test for a hint, so a single typed letter does not match every hint. */
function containsWord(text: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
}

/** Whether an action matches `query`; the pure counterpart of `chrome/command-palette/actions.ts`. */
export function matchesAction(action: PaletteAction, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  if (action.label.toLowerCase().includes(needle)) return true;
  return action.hint !== undefined && containsWord(action.hint, needle);
}

/** The actions that match `query`, in their original order. */
export function filterActions(actions: readonly PaletteAction[], query: string): readonly PaletteAction[] {
  return actions.filter((action) => matchesAction(action, query));
}

/** Whether `value` is one of the theme choices the palette can apply. */
function isThemeChoice(value: unknown): value is ThemeChoice {
  return value === "light" || value === "dark" || value === "system";
}

/** Whether `value` is an action descriptor this module knows how to run. */
export function isPaletteRun(value: unknown): value is PaletteRun {
  if (value === null || typeof value !== "object") return false;
  const run = value as { kind?: unknown; choice?: unknown; url?: unknown; id?: unknown };
  if (run.kind === "theme") return isThemeChoice(run.choice);
  if (run.kind === "copy") return typeof run.url === "string" && run.url !== "";
  if (run.kind === "source") return true;
  if (run.kind === "section") return typeof run.id === "string" && run.id !== "";
  return false;
}

/** Whether `value` is an action this module can show and run. */
function isPaletteAction(value: unknown): value is PaletteAction {
  if (value === null || typeof value !== "object") return false;
  const action = value as { id?: unknown; label?: unknown; hint?: unknown; run?: unknown };
  if (typeof action.id !== "string" || action.id === "") return false;
  if (typeof action.label !== "string" || action.label === "") return false;
  if (action.hint !== undefined && typeof action.hint !== "string") return false;
  return action.run === undefined || isPaletteRun(action.run);
}

/**
 * Reads the server's JSON. Anything missing, malformed, or shaped differently yields an empty
 * palette, so a bad build cannot stop search from working.
 */
export function parsePalette(text: string | null, fallbackLabel: string = ACTIONS_LABEL): PalettePayload {
  if (text === null || text.trim() === "") return { label: fallbackLabel, actions: [] };
  try {
    const value = JSON.parse(text) as unknown;
    if (value === null || typeof value !== "object") return { label: fallbackLabel, actions: [] };
    const payload = value as { label?: unknown; actions?: unknown };
    const label = typeof payload.label === "string" && payload.label !== "" ? payload.label : fallbackLabel;
    const actions = Array.isArray(payload.actions) ? payload.actions.filter(isPaletteAction) : [];
    return { label, actions };
  } catch {
    return { label: fallbackLabel, actions: [] };
  }
}

/** The index URL for a site `base`: `/pagefind/pagefind.js` at the root, `<base>/pagefind/pagefind.js` below it. */
export function indexUrl(base: string): string {
  const root = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${root}/pagefind/pagefind.js`;
}

/** Fills one message's placeholders from already-escaped text values. */
function fill(pattern: string, values: Readonly<Record<string, string | number>>): string {
  return pattern.replace(/\{(\w+)\}/g, (_placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : "",
  );
}

/**
 * The plural category of `count` in `lang`, chosen by the browser's CLDR rules. A language tag the
 * runtime does not know reads as English, and an unknown category falls back to `other`.
 *
 * shortcut: this repeats `components/reading-time`'s rules because that module imports the
 * server-only catalog; move both into a client-safe module when a third caller needs them.
 */
export function pluralCategory(lang: string, count: number): PluralCategory {
  let category: string;
  try {
    category = new Intl.PluralRules(lang).select(Math.abs(Math.trunc(count)));
  } catch {
    return "other";
  }
  return (PLURAL_CATEGORIES as readonly string[]).includes(category) ? (category as PluralCategory) : "other";
}

/** The text announced when a query finds nothing. */
export function emptyMessage(query: string, messages: SearchMessages = MESSAGES): string {
  return fill(messages.empty, { query });
}

/** The text announced for a result count, in the page language's plural form. */
export function countMessage(count: number, lang = "en", messages: SearchMessages = MESSAGES): string {
  const pattern = messages.counts[pluralCategory(lang, count)] ?? messages.counts.other;
  return fill(pattern, { n: count });
}

/**
 * Keeps Tab and Shift+Tab inside the dialog: past the last control focus wraps to the first, and before
 * the first it wraps to the last. A focus that has left the dialog returns to its first control.
 */
export function trap(dialog: SearchDialog, event: SearchEvent): void {
  if (event.key !== "Tab") return;
  const items = [...dialog.querySelectorAll(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  const inside = items.includes(event.target as SearchFocusable);
  if (event.shiftKey === true && (!inside || event.target === first)) {
    event.preventDefault();
    last.focus();
  } else if (event.shiftKey !== true && (!inside || event.target === last)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Reveals the search button and wires the dialog: the button opens it, the index loads on that first
 * open only, typing redraws the options, the arrow keys move the active option, Enter runs or opens it,
 * Escape closes, and Tab stays inside. Focus belongs to the field from the moment the dialog opens
 * until it closes, so the active option is the only thing that moves. The DOM is touched only through
 * the small interfaces above, so tests need no browser.
 */
export function activate(parts: SearchParts, env: SearchEnv): void {
  const { dialog, button, close, input, results, status } = parts;
  const messages = env.messages ?? MESSAGES;
  const lang = env.lang ?? "en";
  const palette = env.palette ?? parsePalette(parts.palette?.textContent ?? null, messages.actions);
  const actions = palette.actions;
  const handlers = env.handlers ?? liveHandlers();
  let api: PagefindApi | undefined;
  let loading = false;
  let sequence = 0;
  // A section jump is a move inside the page: the close must not pull focus back to the search button.
  let returnFocus = true;
  // The list as drawn now, and which of its rows the field points at. `-1` is no active option.
  let options: readonly RenderedOption[] = [];
  let active = -1;
  // The records behind the rows on screen, so the ask panel names the pages the reader is looking at.
  let lastRecords: readonly SearchRecord[] = [];

  dialog.hidden = false;
  button.hidden = false;
  button.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-expanded", "false");

  /** Runs one action in the browser; a copy result is announced on the status region. */
  const execute = (command: PaletteRun): void => {
    if (command.kind === "theme") {
      handlers.theme?.(command.choice);
      return;
    }
    if (command.kind === "copy") {
      const copied = handlers.copy?.(command.url);
      if (copied !== undefined && typeof copied.then === "function") {
        copied.then(
          () => {
            status.textContent = messages.copied;
          },
          () => {
            status.textContent = messages.copyFailed;
          },
        );
      }
      return;
    }
    if (command.kind === "source") {
      // Source mode is the switch's own: the palette presses it, so the button, class, storage, and
      // announcement stay one code path.
      dialog.close();
      handlers.source?.();
      return;
    }
    // The heading is where the reader is going, so it keeps focus: the close handler must not take it
    // back to the search button, whether the browser fires `close` during `close()` or after it.
    returnFocus = false;
    dialog.close();
    handlers.section?.(command.id);
  };

  /**
   * Makes the row at `index` the active option, or clears the active option when `index` has no row. A
   * key, a pointer, and a redraw all arrive here, so what a reader sees and what assistive tech reads
   * are the same row: one selection, one id reference.
   */
  const markActive = (index: number): void => {
    const current = options[active];
    const next = options[index];
    if (current !== undefined && current !== next) current.element.setAttribute("aria-selected", "false");
    if (next === undefined) {
      active = -1;
      // Nothing is selected: the attribute goes rather than naming a row that is not there.
      input.removeAttribute?.("aria-activedescendant");
      return;
    }
    active = index;
    next.element.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", next.id);
    next.element.scrollIntoView?.({ block: "nearest" });
  };

  /** Draws the page results and the matched actions, then puts the active option back where it was. */
  const draw = (records: readonly SearchRecord[], matched: readonly PaletteAction[]): void => {
    const key = options[active]?.key;
    lastRecords = records;
    const question = input.value.trim();
    const askHandler = env.ask;
    const ask =
      askHandler !== undefined && wordCount(question) >= 2
        ? { question, label: fill(messages.askLabel, { query: question }), hint: messages.askHint }
        : undefined;
    const list = optionList(
      records,
      matched,
      { otherSection: messages.otherSection, actionsLabel: palette.label, askHeading: messages.askHeading },
      ask,
    );
    options = renderOptions(results, list, {
      doc: env.document,
      run: execute,
      hover: (index) => markActive(index),
      ...(askHandler === undefined
        ? {}
        : {
            ask: (asked: string) => {
              markActive(-1);
              askHandler(asked, lastRecords);
            },
          }),
    });
    // A row the new query dropped takes the active option with it; the field then names nothing.
    markActive(key === undefined ? -1 : options.findIndex((option) => option.key === key));
  };

  /** Shows the clear button only while the field holds text, so an empty field offers nothing to press. */
  const syncClear = (): void => {
    const clear = parts.clear;
    if (clear === undefined) return;
    const filled = input.value !== "";
    clear.hidden = !filled;
    clear.disabled = !filled;
  };

  /** Runs the field's current query: an empty field shows the actions and clears the status. */
  const run = (): void => {
    syncClear();
    const query = input.value.trim();
    const matched = filterActions(actions, query);
    const current = ++sequence;
    if (query === "") {
      draw([], matched);
      status.textContent = "";
      return;
    }
    if (api === undefined) {
      draw([], matched);
      return;
    }
    status.textContent = matched.length === 0 ? messages.searching : "";
    api
      .search(query)
      .then((page) => {
        // Pagefind resolves metadata separately for each hit. Only load it for the current query.
        if (current !== sequence) return [];
        return Promise.all(page.results.slice(0, RESULT_LIMIT).map((hit) => hit.data()));
      })
      .then(
        (records) => {
          if (current !== sequence) return;
          draw(records, matched);
          status.textContent =
            records.length === 0
              ? matched.length === 0
                ? emptyMessage(query, messages)
                : ""
              : countMessage(records.length, lang, messages);
        },
        () => {
          if (current === sequence) status.textContent = messages.failed;
        },
      );
  };

  /** Opens the dialog and, on the first open, loads the index; later opens reuse it. */
  const show = (): void => {
    returnFocus = true;
    if (!dialog.open) dialog.showModal();
    button.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
    input.focus();
    // A fresh open starts at the field, not on the row the last query left selected.
    markActive(-1);
    if (input.value.trim() === "") run();
    if (api !== undefined || loading) {
      if (input.value.trim() !== "") run();
      return;
    }
    loading = true;
    if (input.value.trim() !== "") status.textContent = messages.loading;
    env.load(indexUrl(dialog.getAttribute("data-base") ?? "")).then(
      (loaded) => {
        api = loaded;
        loading = false;
        if (!dialog.open) return;
        if (input.value.trim() === "") status.textContent = "";
        run();
      },
      () => {
        loading = false;
        if (dialog.open) status.textContent = messages.failed;
      },
    );
  };

  button.addEventListener("click", show);
  close.addEventListener("click", () => dialog.close());
  parts.clear?.addEventListener("click", () => {
    input.value = "";
    // One empty query redraws the palette's base rows and clears the status once; the dialog stays open.
    run();
    input.focus();
  });
  input.addEventListener("input", run);
  // A press on the modal backdrop lands on the dialog itself; a press on the panel or a row does not.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", () => {
    ++sequence;
    button.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-expanded", "false");
    markActive(-1);
    // Focus stayed in the field the whole time the dialog was open, so closing has one place to go.
    if (returnFocus) button.focus();
    returnFocus = true;
  });
  dialog.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      // The field is the one thing that may hold an active option, so it takes focus back first.
      input.focus();
      markActive(
        event.key === "ArrowDown"
          ? active + 1 >= options.length
            ? 0
            : active + 1
          : active <= 0
            ? options.length - 1
            : active - 1,
      );
      return;
    }

    if (event.key === "Enter" && event.target === (input as unknown)) {
      // Enter runs the active option, or the first one when the reader has not moved off the field.
      const option = active >= 0 ? options[active] : options[0];
      if (option === undefined) return;
      event.preventDefault();
      option.activate();
      return;
    }

    trap(dialog, event);
  });
}

/** What the page's `<html>` needs for a theme change. */
interface ThemeRoot {
  setAttribute(name: string, value: string): void;
}

/** The heading a section action scrolls to and focuses. */
interface SectionTarget {
  setAttribute?(name: string, value: string): void;
  scrollIntoView?(options: { readonly block: "start" }): void;
  focus?(): void;
}

/** The browser globals the action handlers use; tests never call these. */
interface PaletteGlobals {
  readonly document?: {
    readonly documentElement?: ThemeRoot;
    getElementById?(id: string): SectionTarget | null;
    querySelector?(selector: string): { click?(): void } | null;
  };
  readonly localStorage?: { setItem(key: string, value: string): void };
  readonly navigator?: { readonly clipboard?: { writeText(text: string): Promise<void> } };
  readonly fetch?: (url: string) => Promise<{ readonly ok: boolean; text(): Promise<string> }>;
  readonly matchMedia?: (query: string) => { readonly matches: boolean };
}

/** The theme a choice puts on the page; `system` follows the OS preference. */
export function resolveTheme(choice: ThemeChoice, prefersLight: boolean): "light" | "dark" {
  return choice === "system" ? (prefersLight ? "light" : "dark") : choice;
}

/** The browser's handlers: the theme key, the clipboard and twin fetch, and the heading jump. */
export function liveHandlers(globals: PaletteGlobals = globalThis as unknown as PaletteGlobals): PaletteHandlers {
  return {
    theme(choice) {
      try {
        globals.localStorage?.setItem(THEME_KEY, choice);
      } catch {
        /* storage is unavailable: apply the choice to this page view only */
      }
      const prefersLight = globals.matchMedia?.("(prefers-color-scheme: light)").matches === true;
      globals.document?.documentElement?.setAttribute("data-theme", resolveTheme(choice, prefersLight));
    },
    copy(url) {
      const clipboard = globals.navigator?.clipboard;
      const fetchText = globals.fetch;
      if (clipboard === undefined || fetchText === undefined) return Promise.resolve();
      return fetchText(url).then((response) =>
        response.ok ? response.text() : Promise.reject(new Error("The page's Markdown is unavailable.")),
      ).then((markdown) => clipboard.writeText(markdown));
    },
    source() {
      globals.document?.querySelector?.("[data-source-mode] .source-mode-button")?.click?.();
    },
    section(id) {
      const heading = globals.document?.getElementById?.(id);
      if (heading === null || heading === undefined) return;
      heading.setAttribute?.("tabindex", "-1");
      heading.scrollIntoView?.({ block: "start" });
      heading.focus?.();
    },
  };
}

// The island runs in a browser; the theme's tsconfig has no DOM lib, so these are the globals it needs.
interface BrowserDocument {
  querySelector(selector: string): unknown;
  createElement(tag: string): SearchElement;
  createTextNode(text: string): SearchNode;
  addEventListener(type: "keydown", listener: (event: ShortcutEvent) => void): void;
}
declare const document: BrowserDocument;
declare const navigator: {
  readonly platform: string;
  readonly clipboard?: { writeText(text: string): Promise<void> } | undefined;
};
declare const location: { readonly search: string };

/** Watches the results page's list for the rows its inline script draws. */
declare const MutationObserver: new (callback: () => void) => {
  observe(target: unknown, options: { readonly childList: boolean }): void;
};

/** The dialog as the island reads its translated messages from. */
export interface MessageSource {
  getAttribute(name: string): string | null;
}

/** One data attribute's non-empty value, or undefined when the page does not carry it. */
function attributeOf(element: MessageSource, name: string): string | undefined {
  const value = element.getAttribute(name);
  return value === null || value === "" ? undefined : value;
}

/** The dialog's messages in the page language, with the English defaults for anything missing. */
export function messagesFrom(element: MessageSource): SearchMessages {
  return {
    loading: attributeOf(element, "data-search-loading") ?? MESSAGES.loading,
    searching: attributeOf(element, "data-search-searching") ?? MESSAGES.searching,
    failed: attributeOf(element, "data-search-failed") ?? MESSAGES.failed,
    copied: attributeOf(element, "data-search-copied") ?? MESSAGES.copied,
    copyFailed: attributeOf(element, "data-search-copy-failed") ?? MESSAGES.copyFailed,
    empty: attributeOf(element, "data-search-empty") ?? MESSAGES.empty,
    otherSection: attributeOf(element, "data-search-other-section") ?? MESSAGES.otherSection,
    actions: attributeOf(element, "data-search-actions") ?? MESSAGES.actions,
    askHeading: attributeOf(element, "data-search-ask-heading") ?? MESSAGES.askHeading,
    askLabel: attributeOf(element, "data-search-ask-label") ?? MESSAGES.askLabel,
    askHint: attributeOf(element, "data-search-ask-hint") ?? MESSAGES.askHint,
    counts: {
      zero: attributeOf(element, "data-search-count-zero") ?? MESSAGES.counts.zero,
      one: attributeOf(element, "data-search-count-one") ?? MESSAGES.counts.one,
      two: attributeOf(element, "data-search-count-two") ?? MESSAGES.counts.two,
      few: attributeOf(element, "data-search-count-few") ?? MESSAGES.counts.few,
      many: attributeOf(element, "data-search-count-many") ?? MESSAGES.counts.many,
      other: attributeOf(element, "data-search-count-other") ?? MESSAGES.counts.other,
    },
  };
}

/** The page language the dialog carries, which picks the plural rules. */
export function langFrom(element: MessageSource): string {
  return attributeOf(element, "data-search-lang") ?? "en";
}

/** Imports the Pagefind module from the built index. */
function loadIndex(url: string): Promise<PagefindApi> {
  return import(url) as Promise<PagefindApi>;
}

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (typeof document !== "undefined") {
  const dialog = document.querySelector("[data-search]");
  const button = document.querySelector("[data-search-open]");
  const close = document.querySelector("[data-search-close]");
  const clear = document.querySelector("[data-search-clear]");
  const input = document.querySelector("[data-search-input]");
  const results = document.querySelector("[data-search-results]");
  const status = document.querySelector("[data-search-status]");
  const palette = document.querySelector("[data-palette-actions]") as SearchPaletteSource | null;
  const askRoot = document.querySelector("[data-ask-agent]");
  const askSource = document.querySelector("[data-ask-agent-config]") as SearchPaletteSource | null;
  if (dialog && button && close && input && results && status) {
    const source = dialog as unknown as MessageSource;
    const messages = messagesFrom(source);
    const askAgent =
      askRoot === null || askRoot === undefined
        ? undefined
        : activateAskAgent({
            document: document as unknown as AskDocument,
            root: askRoot as AskElement,
            config: parseAskConfig(askSource?.textContent ?? null),
            clipboard: navigator.clipboard,
            fetchText: browserFetch,
            lang: langFrom(source),
          });
    activate(
      {
        dialog: dialog as SearchDialog,
        button: button as SearchButton,
        close: close as SearchClose,
        input: input as SearchInput,
        results: results as SearchResults,
        status: status as SearchStatus,
        ...(clear === null || clear === undefined ? {} : { clear: clear as NonNullable<SearchParts["clear"]> }),
        ...(palette === null ? {} : { palette }),
      },
      {
        document,
        load: loadIndex,
        palette: parsePalette(palette?.textContent ?? null, messages.actions),
        lang: langFrom(source),
        messages,
        ...(askAgent === undefined ? {} : { ask: askAgent.open }),
      },
    );
    if (askAgent !== undefined) {
      (dialog as SearchDialog).addEventListener("close", () => askAgent.hide());
    }
    // The search results page draws its own list; the ask section fills in when it has rows.
    const section = document.querySelector("[data-ask-agent-section]");
    const pageList = document.querySelector("[data-search-results]");
    if (askAgent !== undefined && section !== null && section !== undefined && pageList !== null && pageList !== undefined) {
      const askResults = (): AskResult[] => {
        const links = (pageList as { querySelectorAll(selector: string): Iterable<unknown> }).querySelectorAll("a");
        const found: AskResult[] = [];
        for (const link of links) {
          const anchor = link as {
            getAttribute(name: string): string | null;
            querySelector(selector: string): { textContent: string | null } | null;
          };
          const url = anchor.getAttribute("href");
          if (url === null || url === "") continue;
          const title = anchor.querySelector(".search-results-title")?.textContent ?? undefined;
          found.push({ url, ...(title === undefined ? {} : { title }) });
        }
        return found;
      };
      const fill = (): void => {
        const query = new URLSearchParams(location.search).get("q") ?? "";
        const found = askResults();
        if (query.trim() === "" || found.length === 0) return;
        askAgent.open(query, found, section as AskElement, false);
      };
      new MutationObserver(fill).observe(pageList, { childList: true });
      fill();
    }
    // ⌘K/Ctrl+K and `/` press this button from anywhere, exactly as a pointer would.
    activateShortcuts(
      { button: button as unknown as SearchButton },
      { platform: navigator.platform, addEventListener: (type, listener) => document.addEventListener(type, listener) },
    );
  }
}
