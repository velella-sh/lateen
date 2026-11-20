/* The gallery's filter and sort behaviour: the links `index.ts` writes work on their own, and this
 * module only makes them filter in place and keep the choice in the address. It reads the values
 * each card carries in `data-gallery-values`, never the card text, so a value with punctuation or a
 * translated label filters the same way. The sort and filters live in the query string, the address
 * is replaced rather than pushed, and a shared link opens the same view. */

import { parseJson } from "../../src/guards.ts";
import { withParams } from "../../src/url.ts";

/** The shared address serializer, re-exported so this island's public surface stays as it was. */
export { withParams };

/** The root `index.ts` marks with `data-gallery`. */
export const ROOT_SELECTOR = "[data-gallery]";

/** One card's wrapper, with its filter values in `data-gallery-values`. */
export const ITEM_SELECTOR = "[data-gallery-item]";

/** The card grids inside the root; a gallery with groups has one per group. */
export const GRID_SELECTOR = ".cards";

/** One group section, hidden while every card in it is hidden. */
export const GROUP_SELECTOR = ".gallery-group";

/** A filter link, with `data-gallery-filter` naming its field and `data-gallery-value` its value. */
export const FILTER_LINK_SELECTOR = "[data-gallery-filter]";

/** The link that clears every filter. */
export const CLEAR_SELECTOR = "[data-gallery-clear]";

/** A sort link, with `data-gallery-sort` naming its field. */
export const SORT_LINK_SELECTOR = "[data-gallery-sort]";

/** The live region that shows and announces the count. */
export const COUNT_SELECTOR = ".gallery-count";

/** The note shown when no card matches. */
export const EMPTY_SELECTOR = ".gallery-empty";

/** The link inside one card, and the element focus lands on after a filter. */
export const CARD_SELECTOR = "a.card, a.gallery-card";

/** The query parameter prefix of one filter field. */
export const FILTER_PREFIX = "filter.";

/** The query parameter that names the sort field. */
export const SORT_PARAM = "sort";

/** The query parameter that names the sort direction. */
export const ORDER_PARAM = "order";

export type SortDirection = "asc" | "desc";

/** The sort the gallery shows: a field the collection declares and a direction. */
export interface GallerySort {
  readonly field: string;
  readonly direction: SortDirection;
}

/** The part of an element the island uses. */
export interface GalleryElement {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  addEventListener(
    type: "click" | "popstate",
    listener: (event: GalleryEvent) => void,
    options?: { signal?: AbortSignal | undefined },
  ): void;
  querySelector(selector: string): GalleryElement | null;
  querySelectorAll(selector: string): Iterable<GalleryElement>;
  closest(selector: string): GalleryElement | null;
  append(node: GalleryElement): void;
  parentNode?: { append(node: GalleryElement): void } | null;
  hidden: boolean;
  textContent: string | null;
  focus(): void;
}

/** A click, as the island reads it: a modified click keeps the browser's own meaning. */
export interface GalleryEvent {
  preventDefault(): void;
  metaKey?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  button?: number;
}

/** The page address, read without reloading it. */
export interface GalleryLocation {
  href: string;
  search: string;
}

/** The page history, written without adding an entry. */
export interface GalleryHistory {
  replaceState(data: unknown, unused: string, url?: string | null): void;
}

/** The part of the window the island uses. */
export interface GalleryWindow {
  location: GalleryLocation;
  history: GalleryHistory;
  addEventListener(type: "popstate", listener: () => void, options?: { signal?: AbortSignal | undefined }): void;
  /** The window realm's own `AbortController`, so the teardown signal matches the realm the page's nodes live in. */
  readonly AbortController?: typeof AbortController | undefined;
}

/** The part of the document the island uses. */
export interface GalleryDocument {
  querySelector(selector: string): GalleryElement | null;
  querySelectorAll(selector: string): Iterable<GalleryElement>;
  documentElement?: { getAttribute(name: string): string | null } | null;
  defaultView?: GalleryWindow | null;
}

/** The query string of a URL, including its `?`, or an empty string. */
export function searchOf(url: string): string {
  const at = url.indexOf("?");
  if (at === -1) return "";
  const hash = url.indexOf("#", at);
  return hash === -1 ? url.slice(at) : url.slice(at, hash);
}

/** The URL without its query string: the form action that still resets without script. */
export function actionOf(url: string): string {
  const at = url.indexOf("?");
  if (at === -1) return url;
  const hash = url.indexOf("#", at);
  return url.slice(0, at) + (hash === -1 ? "" : url.slice(hash));
}

/** The chosen values, one per filter field, read from the address; repeated or blank values are ignored. */
export function selectedOf(search: string): Map<string, string> {
  const params = new URLSearchParams(search);
  const selected = new Map<string, string>();
  for (const [key, value] of params) {
    if (!key.startsWith(FILTER_PREFIX) || key.length === FILTER_PREFIX.length || value === "") continue;
    selected.set(key.slice(FILTER_PREFIX.length), value);
  }
  return selected;
}

/** True when the card's value lists hold every chosen filter. */
export function matches(values: Readonly<Record<string, readonly string[]>>, selected: ReadonlyMap<string, string>): boolean {
  for (const [field, value] of selected) {
    if (!(values[field] ?? []).includes(value)) return false;
  }
  return true;
}

/** The sort the address names when the collection declares that field, else the first field ascending. */
export function sortOf(search: string, fields: readonly string[]): GallerySort | undefined {
  const first = fields[0];
  if (first === undefined) return undefined;
  const params = new URLSearchParams(search);
  const named = params.get(SORT_PARAM) ?? "";
  const known = fields.includes(named);
  const field = known ? named : first;
  return { field, direction: known && params.get(ORDER_PARAM) === "desc" ? "desc" : "asc" };
}

/** The address one filter link opens: the value removed when already chosen, else added. */
export function filterHref(url: string, field: string, value: string): string {
  const key = `${FILTER_PREFIX}${field}`;
  const current = new URLSearchParams(searchOf(url)).get(key);
  return withParams(url, { [key]: current === value ? null : value });
}

/** The address that clears every filter and keeps the sort. */
export function clearHref(url: string): string {
  const params = new URLSearchParams(searchOf(url));
  const changes: Record<string, string | null> = {};
  for (const key of params.keys()) if (key.startsWith(FILTER_PREFIX)) changes[key] = null;
  return withParams(url, changes);
}

/** The address one sort link opens; the active field flips its direction. */
export function sortHref(url: string, field: string, direction: SortDirection): string {
  return withParams(url, { [SORT_PARAM]: field, [ORDER_PARAM]: direction });
}

/** The values a card carries, parsed once; malformed data is treated as no values. */
function valuesOf(element: GalleryElement): Record<string, readonly string[]> {
  const parsed = parseJson(element.getAttribute("data-gallery-values") ?? "{}");
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: Record<string, readonly string[]> = {};
  for (const [field, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) out[field] = value.filter((item): item is string => typeof item === "string");
  }
  return out;
}

/** The first sort value of a card, or an empty string when it has none. */
function sortValue(values: Readonly<Record<string, readonly string[]>>, field: string): string {
  return values[field]?.[0] ?? "";
}

/** True for a click the island should leave to the browser: a new tab, window, or download. */
function modified(event: GalleryEvent): boolean {
  return event.metaKey === true || event.ctrlKey === true || event.shiftKey === true || event.altKey === true || (event.button ?? 0) !== 0;
}

/** The cards in one grid, each with its parsed values. */
interface Item {
  readonly element: GalleryElement;
  readonly values: Record<string, readonly string[]>;
}

/** Puts the cards of one grid in the chosen order; empty values stay last, equal values keep their order. */
function orderGrid(grid: GalleryElement, items: readonly Item[], sort: GallerySort, lang: string): void {
  const ordered = items
    .map((item, index) => ({ item, index, raw: sortValue(item.values, sort.field) }))
    .sort((a, b) => {
      if (a.raw === "" && b.raw === "") return a.index - b.index;
      if (a.raw === "") return 1;
      if (b.raw === "") return -1;
      const compare = a.raw.localeCompare(b.raw, lang, { numeric: true });
      return (sort.direction === "desc" ? -compare : compare) || a.index - b.index;
    });
  for (const { item } of ordered) grid.append(item.element);
}

/** The number as the page language writes it. */
function formatted(lang: string, count: number): string {
  return new Intl.NumberFormat(lang).format(count);
}

/**
 * Applies the address to the gallery already in the page: hides the cards that do not match, puts
 * each grid in the chosen order, updates the count and the empty note, and marks the chosen links.
 * `focus` moves focus to the first visible card after a filter, or to the count after back/forward.
 */
export function apply(
  doc: GalleryDocument,
  root: GalleryElement,
  url: string,
  focus: "results" | "filters" | "count" | null,
): void {
  const lang = doc.documentElement?.getAttribute("lang") ?? "en";
  const selected = selectedOf(searchOf(url));
  const known = new Set(
    [...root.querySelectorAll(FILTER_LINK_SELECTOR)].map((link) => link.getAttribute("data-gallery-filter") ?? ""),
  );
  for (const field of [...selected.keys()]) if (!known.has(field)) selected.delete(field);
  const items: Item[] = [...root.querySelectorAll(ITEM_SELECTOR)].map((element) => ({
    element,
    values: valuesOf(element),
  }));

  let shown = 0;
  for (const item of items) {
    const visible = matches(item.values, selected);
    item.element.hidden = !visible;
    if (visible) shown += 1;
  }

  const fields = [...root.querySelectorAll(SORT_LINK_SELECTOR)].map(
    (link) => link.getAttribute("data-gallery-sort") ?? "",
  );
  const sort = sortOf(searchOf(url), fields.filter((field) => field !== ""));
  if (sort !== undefined) {
    const byElement = new Map(items.map((item) => [item.element, item]));
    for (const grid of root.querySelectorAll(GRID_SELECTOR)) {
      const inGrid = [...grid.querySelectorAll(ITEM_SELECTOR)].flatMap((element) => {
        const item = byElement.get(element);
        return item === undefined ? [] : [item];
      });
      orderGrid(grid, inGrid, sort, lang);
    }
  }

  const count = root.querySelector(COUNT_SELECTOR);
  if (count !== null) {
    const pattern = count.getAttribute("data-gallery-count") ?? "";
    count.textContent = pattern
      .replace("{n}", formatted(lang, shown))
      .replace("{total}", formatted(lang, items.length));
  }

  const empty = root.querySelector(EMPTY_SELECTOR);
  if (empty !== null) empty.hidden = shown > 0;

  for (const group of root.querySelectorAll(GROUP_SELECTOR)) {
    const visible = [...group.querySelectorAll(ITEM_SELECTOR)].some((element) => !element.hidden);
    group.hidden = !visible;
  }

  for (const link of root.querySelectorAll(FILTER_LINK_SELECTOR)) {
    const field = link.getAttribute("data-gallery-filter") ?? "";
    const value = link.getAttribute("data-gallery-value") ?? "";
    const active = selected.get(field) === value;
    if (active) {
      link.setAttribute("aria-current", "true");
      link.setAttribute("class", "gallery-filter-value gallery-filter-selected");
    } else {
      link.removeAttribute("aria-current");
      link.setAttribute("class", "gallery-filter-value");
    }
    link.setAttribute("href", filterHref(url, field, value));
  }

  const clear = root.querySelector(CLEAR_SELECTOR);
  if (clear !== null) clear.hidden = selected.size === 0;

  for (const link of root.querySelectorAll(SORT_LINK_SELECTOR)) {
    const field = link.getAttribute("data-gallery-sort") ?? "";
    const active = sort?.field === field;
    const direction: SortDirection = active ? sort?.direction ?? "asc" : "asc";
    if (active) {
      link.setAttribute("aria-current", "true");
      link.setAttribute("class", "gallery-sort-link gallery-sort-active");
    } else {
      link.removeAttribute("aria-current");
      link.setAttribute("class", "gallery-sort-link");
    }
    link.setAttribute("data-order", direction);
    link.setAttribute("href", sortHref(url, field, direction));
    const nav = root.querySelector(".gallery-sort");
    const pattern = nav?.getAttribute(active ? `data-sort-${direction === "asc" ? "ascending" : "descending"}` : "data-sort-label") ?? "";
    if (pattern !== "") link.setAttribute("aria-label", pattern.replace("{column}", field));
  }

  if (focus === "results") {
    const first = items.find((item) => !item.element.hidden)?.element.querySelector(CARD_SELECTOR);
    if (first !== null && first !== undefined) first.focus();
    else empty?.focus();
  }
  if (focus === "filters") {
    const first = root.querySelector(FILTER_LINK_SELECTOR);
    if (first !== null) first.focus();
    else count?.focus();
  }
  if (focus === "count") count?.focus();
}

/**
 * Wires every gallery in the document, and reads the address the browser opened. Every listener
 * carries the returned teardown's signal, so a host that mounts and unmounts the gallery detaches
 * the wiring with one abort and a remount starts with no duplicate listener.
 */
export function activate(doc: GalleryDocument): () => void {
  const roots = [...doc.querySelectorAll(ROOT_SELECTOR)];
  if (roots.length === 0) return () => {};
  const view = doc.defaultView ?? null;
  const lifecycle = new (view?.AbortController ?? AbortController)();
  const signal = lifecycle.signal;

  const applyAll = (focus: "results" | "filters" | "count" | null): void => {
    for (const root of roots) apply(doc, root, view?.location.href ?? "", focus);
  };

  for (const root of roots) {
    for (const link of root.querySelectorAll(FILTER_LINK_SELECTOR)) {
      link.addEventListener("click", (event) => {
        if (modified(event)) return;
        event.preventDefault();
        const field = link.getAttribute("data-gallery-filter") ?? "";
        const value = link.getAttribute("data-gallery-value") ?? "";
        const next = filterHref(view?.location.href ?? "", field, value);
        view?.history.replaceState(null, "", next);
        applyAll("results");
      }, { signal });
    }

    const clear = root.querySelector(CLEAR_SELECTOR);
    clear?.addEventListener("click", (event) => {
      if (modified(event)) return;
      event.preventDefault();
      const next = clearHref(view?.location.href ?? "");
      view?.history.replaceState(null, "", next);
      applyAll("filters");
    }, { signal });

    for (const link of root.querySelectorAll(SORT_LINK_SELECTOR)) {
      link.addEventListener("click", (event) => {
        if (modified(event)) return;
        event.preventDefault();
        const field = link.getAttribute("data-gallery-sort") ?? "";
        const fields = [...root.querySelectorAll(SORT_LINK_SELECTOR)].map(
          (entry) => entry.getAttribute("data-gallery-sort") ?? "",
        );
        const sort = sortOf(searchOf(view?.location.href ?? ""), fields.filter((entry) => entry !== ""));
        const direction: SortDirection = sort?.field === field && sort.direction === "asc" ? "desc" : "asc";
        view?.history.replaceState(null, "", sortHref(view?.location.href ?? "", field, direction));
        applyAll(null);
      }, { signal });
    }
  }

  view?.addEventListener("popstate", () => applyAll("count"), { signal });
  applyAll(null);
  return () => lifecycle.abort();
}
