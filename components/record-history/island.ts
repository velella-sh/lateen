/* The record history's field filter: the links `index.ts` writes work on their own, and this module
 * only hides the events of other fields in place, keeps the choice in the address, and keeps the
 * count in the page language. It reads each event's `data-history-field`, never its text. */

/** The section `index.ts` marks with `data-history-root`. */
export const ROOT_SELECTOR = "[data-history-root]";

/** One filter link, with its field in `data-history-value`. */
export const LINK_SELECTOR = "[data-history-link]";

/** One event, with its field in `data-history-field`. */
export const EVENT_SELECTOR = "[data-history-event]";

/** The visible count, with its label in `data-history-label`. */
export const COUNT_SELECTOR = "[data-history-count]";

/** The disclosure that holds the events beyond the limit. */
export const DETAILS_SELECTOR = ".record-history-earlier";

/** The query parameter that names the chosen field. */
export const FIELD_PARAM = "history-field";

/** The part of an element the island uses. */
export interface HistoryElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(type: "click" | "popstate", listener: (event: HistoryEvent) => void): void;
  querySelector(selector: string): HistoryElement | null;
  querySelectorAll(selector: string): Iterable<HistoryElement>;
  closest(selector: string): HistoryElement | null;
  textContent: string | null;
  hidden: boolean;
}

/** A click as the island reads it; a modified click keeps the browser's meaning. */
export interface HistoryEvent {
  preventDefault(): void;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
}

/** The page address and history the island writes. */
export interface HistoryWindow {
  location: { href: string };
  history: { replaceState(data: unknown, unused: string, url?: string | null): void };
  addEventListener(type: "popstate", listener: () => void): void;
}

/** The part of the document the island uses. */
export interface HistoryDocument {
  querySelector(selector: string): HistoryElement | null;
  querySelectorAll(selector: string): Iterable<HistoryElement>;
  documentElement?: { getAttribute(name: string): string | null } | null;
  defaultView?: HistoryWindow | null;
}

/** The chosen field, when the address names one the page offers; otherwise every field. */
export function fieldOf(url: string, known: ReadonlySet<string>): string {
  const at = url.indexOf("?");
  if (at === -1) return "";
  const value = new URLSearchParams(url.slice(at)).get(FIELD_PARAM) ?? "";
  return known.has(value) ? value : "";
}

/** The address one filter link opens. */
export function filterHref(url: string, field: string): string {
  const parsed = new URL(url, "https://history.invalid");
  if (field === "") parsed.searchParams.delete(FIELD_PARAM);
  else parsed.searchParams.set(FIELD_PARAM, field);
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

function formatted(lang: string, count: number): string {
  return new Intl.NumberFormat(lang).format(count);
}

/** Applies the address to one history section: hides the other fields' events and updates the count. */
export function apply(doc: HistoryDocument, root: HistoryElement, url: string): void {
  const lang = doc.documentElement?.getAttribute("lang") ?? "en";
  const links = [...root.querySelectorAll(LINK_SELECTOR)];
  const known = new Set(links.map((link) => link.getAttribute("data-history-value") ?? ""));
  const field = fieldOf(url, known);
  let shown = 0;
  for (const event of root.querySelectorAll(EVENT_SELECTOR)) {
    const visible = field === "" || event.getAttribute("data-history-field") === field;
    event.hidden = !visible;
    if (visible) shown += 1;
  }
  const count = root.querySelector(COUNT_SELECTOR);
  if (count !== null) {
    const label = count.getAttribute("data-history-label") ?? "{count}";
    count.textContent = label.replace("{count}", formatted(lang, shown));
  }
  const details = root.querySelector(DETAILS_SELECTOR);
  if (details !== null) {
    details.hidden = ![...details.querySelectorAll(EVENT_SELECTOR)].some((event) => !event.hidden);
  }
  for (const link of links) {
    const active = (link.getAttribute("data-history-value") ?? "") === field;
    if (active) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  }
}

/** Wires every history section, and applies the address the browser opened. */
export function activate(doc: HistoryDocument): void {
  const roots = [...doc.querySelectorAll(ROOT_SELECTOR)];
  if (roots.length === 0) return;
  const view = doc.defaultView ?? null;
  const applyAll = (): void => {
    for (const root of roots) apply(doc, root, view?.location.href ?? "");
  };

  for (const root of roots) {
    for (const link of root.querySelectorAll(LINK_SELECTOR)) {
      link.addEventListener("click", (event) => {
        if (
          event.metaKey === true ||
          event.ctrlKey === true ||
          event.shiftKey === true ||
          event.altKey === true ||
          (event.button ?? 0) !== 0
        ) {
          return;
        }
        event.preventDefault();
        const field = link.getAttribute("data-history-value") ?? "";
        view?.history.replaceState(null, "", filterHref(view.location.href, field));
        applyAll();
      });
    }
  }
  view?.addEventListener("popstate", applyAll);
  applyAll();
}
