/* Dated list island: writes a relative hint beside every date in the page language, marks the rows
 * whose day has passed, and reveals a link to the first item still ahead. The build never reads the
 * clock, so two builds of the same sources stay identical; without this script every row keeps its
 * date, its order, and its place in the page. */

/** The wrapper around a dated list, with `data-lang` holding the page language. */
export const ROOT_SELECTOR = "[data-dated-list]";

/** The hidden paragraph that gets the link to the first item still ahead. */
export const JUMP_SELECTOR = "[data-dated-list-jump]";

/** Class on the relative hint the island writes beside a date. */
export const RELATIVE_CLASS = "dated-list-relative";

/** Class on a row whose day has passed. */
export const PAST_CLASS = "dated-list-past";

/** The id the island gives the first item still ahead, so the jump link can point at it. */
export const JUMP_ID = "dated-list-next";

const DAY_MS = 86400000;

/** The part of an element the island reads and writes. */
export interface ListElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  append(...nodes: unknown[]): void;
  after(node: ListElement): void;
  closest(selector: string): ListElement | null;
  querySelector(selector: string): ListElement | null;
  querySelectorAll(selector: string): Iterable<ListElement>;
  hidden: boolean;
  textContent: string | null;
}

/** The part of the document the island uses. */
export interface ListDocument {
  createElement(tag: string): ListElement;
  createTextNode(text: string): unknown;
  querySelectorAll(selector: string): Iterable<ListElement>;
}

/** The browser globals the island starts from, so tests can leave out the document. */
export interface ListGlobals {
  document?: ListDocument;
}

/** An ISO date's day number, or undefined when the text is not a date. */
export function dayNumber(iso: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (match === null) return undefined;
  const time = Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return Number.isFinite(time) ? Math.round(time / DAY_MS) : undefined;
}

/** The reader's calendar day as a day number, read in their own time zone. */
function todayNumber(now: number): number {
  const date = new Date(now);
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
}

/**
 * The days between the reader's day and an ISO date, and that distance as words in `lang`. Negative
 * days are in the past. Days are used within a month, months within a year, and years beyond it.
 */
export function relativeHint(
  iso: string,
  lang: string,
  now: number,
): { readonly days: number; readonly text: string } | undefined {
  const day = dayNumber(iso);
  if (day === undefined) return undefined;
  const days = day - todayNumber(now);
  const unit: Intl.RelativeTimeFormatUnit = Math.abs(days) < 30 ? "day" : Math.abs(days) < 365 ? "month" : "year";
  const value = unit === "day" ? days : Math.round(days / (unit === "month" ? 30 : 365));
  return { days, text: new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(value, unit) };
}

/**
 * Writes a hint beside every dated row, marks the rows already past, and points the hidden jump link
 * at the first row still ahead. The rows themselves keep their order and stay visible.
 */
export function enhance(doc: ListDocument, now: number): void {
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) {
    const lang = root.getAttribute("data-lang") ?? "en";
    let first: ListElement | undefined;

    for (const time of root.querySelectorAll("time[datetime]")) {
      const hint = relativeHint(time.getAttribute("datetime") ?? "", lang, now);
      if (hint === undefined) continue;

      const node = doc.createElement("span");
      node.setAttribute("class", RELATIVE_CLASS);
      node.textContent = hint.text;
      time.after(node);

      const row = time.closest("li") ?? time;
      if (hint.days < 0) row.setAttribute("class", `${row.getAttribute("class") ?? ""} ${PAST_CLASS}`.trim());
      if (hint.days > 0 && first === undefined) first = row;
    }

    const jump = root.querySelector(JUMP_SELECTOR);
    const label = jump?.getAttribute("data-label") ?? "";
    if (jump === null || first === undefined || label === "") continue;
    first.setAttribute("id", JUMP_ID);
    const link = doc.createElement("a");
    link.setAttribute("href", `#${JUMP_ID}`);
    link.textContent = label;
    jump.append(link);
    jump.hidden = false;
  }
}

/** Marks every dated list on the page; a runtime without a document touches nothing. */
export function start(globals: ListGlobals): void {
  const doc = globals.document;
  if (doc === undefined) return;
  enhance(doc, Date.now());
}

start(globalThis as unknown as ListGlobals);
