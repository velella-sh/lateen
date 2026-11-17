/* Timeline today island: draws the reader's day on the axis and names it in the legend. The build
 * never reads the clock, so two builds of the same sources stay identical; without this script the
 * rows, bars and axis stay exactly as the build wrote them. */

/** The axis the island marks, with `data-from`, `data-to` and `data-label`. This module does not
 * import `index.ts`, because the island build cannot resolve that file's `preact` import. */
export const AXIS_SELECTOR = "[data-timeline-today]";

/** The legend that gets the line's name only when the line is drawn. */
export const LEGEND_SELECTOR = "[data-timeline-legend]";

/** The line on the axis and in every row's track. */
export const LINE_CLASS = "timeline-today";

/** The line's name inside the axis. */
export const LABEL_CLASS = "timeline-today-label";

/** The line's key in the legend. */
export const SAMPLE_CLASS = "timeline-today-sample";

/** Matches `TRACK_CLASS` in `index.ts`, which this module cannot import. */
export const TRACK_SELECTOR = ".timeline-track";

/** The parts of an element the island reads and writes. */
export interface TodayElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  append(...nodes: unknown[]): void;
  closest(selector: string): TodayElement | null;
  querySelector(selector: string): TodayElement | null;
  querySelectorAll(selector: string): Iterable<TodayElement>;
}

/** The document parts the island uses. */
export interface TodayDocument {
  createElement(tag: string): TodayElement;
  createTextNode(text: string): unknown;
  querySelectorAll(selector: string): Iterable<TodayElement>;
}

/** The browser globals the island starts from, so tests can leave out the document. */
export interface TodayGlobals {
  document?: TodayDocument;
}

/**
 * The day `now` on the axis, as a percentage, or undefined when the day is outside it. The axis end
 * is the first moment after it, as in `scale.ts`, so a day equal to `to` is outside.
 */
export function todayPosition(from: string, to: string, now: number): number | undefined {
  const start = Date.parse(from);
  const end = Date.parse(to);
  const day = Date.parse(new Date(now).toISOString().slice(0, 10));
  if (!Number.isFinite(start) || !Number.isFinite(end) || !(day >= start && day < end)) return undefined;
  return ((day - start) / (end - start)) * 100;
}

/** Where a marked element's axis puts `now`. */
function positionOf(element: TodayElement, now: number): number | undefined {
  return todayPosition(element.getAttribute("data-from") ?? "", element.getAttribute("data-to") ?? "", now);
}

/** One line at `position` percent of the axis. */
function line(doc: TodayDocument, position: number): TodayElement {
  const node = doc.createElement("span");
  node.setAttribute("class", LINE_CLASS);
  node.setAttribute("style", `inset-inline-start:${Math.round(position * 100) / 100}%`);
  return node;
}

/**
 * Draws today where the axis holds it and adds its key to the legend. A timeline whose axis is
 * before or after the reader's day is left exactly as the build wrote it.
 */
export function enhance(doc: TodayDocument, now: number): void {
  for (const axis of doc.querySelectorAll(AXIS_SELECTOR)) {
    const position = positionOf(axis, now);
    if (position === undefined) continue;

    const mark = line(doc, position);
    const name = axis.getAttribute("data-label") ?? "";
    if (name !== "") {
      const label = doc.createElement("span");
      label.setAttribute("class", LABEL_CLASS);
      label.append(doc.createTextNode(name));
      mark.append(label);
    }
    axis.append(mark);

    const table = axis.closest("table");
    if (table === null) continue;
    for (const track of table.querySelectorAll(TRACK_SELECTOR)) track.append(line(doc, position));
  }

  for (const legend of doc.querySelectorAll(LEGEND_SELECTOR)) {
    const position = positionOf(legend, now);
    const list = legend.querySelector("ul");
    const name = legend.getAttribute("data-label") ?? "";
    if (position === undefined || list === null || name === "") continue;

    const item = doc.createElement("li");
    const sample = doc.createElement("span");
    sample.setAttribute("class", SAMPLE_CLASS);
    sample.setAttribute("aria-hidden", "true");
    item.append(sample, doc.createTextNode(name));
    list.append(item);
  }
}

/** Marks every timeline on the page; a runtime without a document touches nothing. */
export function start(globals: TodayGlobals): void {
  const doc = globals.document;
  if (doc === undefined) return;
  enhance(doc, Date.now());
}

start(globalThis as unknown as TodayGlobals);
