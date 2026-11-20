/*
 * The search listbox's DOM rendering: turns one query's `OptionList` into elements, and makes no
 * query or identity decisions of its own — the option model (`options.ts`) owns those, and the
 * dialog controller (`client.ts`) owns selection, focus, and announcements.
 *
 * Every row puts its option role on its own control, so a keyboard, a pointer, and assistive tech
 * all meet one element. Text never passes through an HTML string: excerpts are split at Pagefind's
 * own `<mark>` boundaries and built from text nodes, so a highlighted excerpt stays safe and a page
 * title cannot inject an element. The returned rows keep the model's order and keys, so the
 * controller can re-resolve `aria-activedescendant` after every redraw.
 *
 * The DOM is touched only through the small `SearchDocument`/`SearchElement` interfaces, so tests
 * need no browser.
 */

import type { PaletteAction, PaletteRun } from "../command-palette/actions.ts";
import type { AskOption, OptionList, OptionRow, SearchRecord } from "./options.ts";

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

/** A result's section path, kept in its own bidi island so an RTL line does not reorder it. */
function pathNode(path: string, doc: SearchDocument): SearchElement {
  const span = doc.createElement("span");
  span.setAttribute("class", "search-result-path");
  const bdi = doc.createElement("bdi");
  bdi.append(doc.createTextNode(path));
  span.append(bdi);
  return span;
}

/** The heading a result's fragment points at, kept in its own bidi island. */
function headingNode(heading: string, doc: SearchDocument): SearchElement {
  const span = doc.createElement("span");
  span.setAttribute("class", "search-result-heading");
  const bdi = doc.createElement("bdi");
  bdi.append(doc.createTextNode(heading));
  span.append(bdi);
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
  if (row.path !== undefined && row.path !== "") link.append(pathNode(row.path, doc));
  link.append(titleNode(record, doc));
  if (row.heading !== undefined) link.append(headingNode(row.heading, doc));
  link.append(excerptNode(record.excerpt, doc));
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