/* Table scroll island: keeps a wide table keyboard-scrollable and a table that fits free of an extra
 * tab stop and landmark. The server markup is always focusable, so the page still works without this
 * script; here the region is refreshed whenever the table or its container changes size. One watcher
 * serves every table on the page, and its cleanup releases the observer or listener it created. */

/** Selector for a table's scroll region. It matches `REGION_ATTRIBUTE` in `index.ts`; this module does
 * not import that file because the island build cannot resolve its `preact` import. */
export const REGION_SELECTOR = "[data-table-scroll]";

/** A difference of at most this many CSS pixels is rounding, not overflow. */
export const OVERFLOW_TOLERANCE = 1;

/** Marks the logical start edge while the table hides content before the viewport. */
export const OVERFLOW_START_ATTRIBUTE = "data-overflow-start";

/** Marks the logical end edge while the table hides content after the viewport. */
export const OVERFLOW_END_ATTRIBUTE = "data-overflow-end";

/** The parts of a scroll region the island reads and writes. */
export interface TableElement {
  scrollWidth: number;
  clientWidth: number;
  scrollLeft: number;
  readonly textContent: string | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  querySelector(selector: string): TableElement | null;
  addEventListener?(type: "scroll", listener: () => void): void;
  removeEventListener?(type: "scroll", listener: () => void): void;
}

/** Keeps every target of one enhancement watched with a single observer or window listener. */
export interface TableWatcher {
  /** Calls `update` when any watched target changes size. */
  watch(target: TableElement, update: () => void): void;
  /** Releases the observer or listener; the page keeps the overflow state it currently shows. */
  stop(): void;
}

/** Everything the island reads from the page, so tests can pass fakes instead of the browser. */
export interface TableEnv {
  /** All scroll regions on the page. */
  regions(): Iterable<TableElement>;
  /** The one watcher shared by every region in this enhancement. */
  watcher: TableWatcher;
}

/** Which logical edges of the region hide content, and whether it overflows at all. */
export interface OverflowState {
  overflow: boolean;
  start: boolean;
  end: boolean;
}

/**
 * Reads the region's overflow on its logical sides. `scrollLeft` is 0 at the start and grows negative
 * toward the end in RTL, so its distance from 0 is the distance from the start in either direction.
 */
export function overflowState(region: TableElement): OverflowState {
  const hidden = region.scrollWidth - region.clientWidth;
  if (hidden <= OVERFLOW_TOLERANCE) return { overflow: false, start: false, end: false };
  const offset = Math.abs(region.scrollLeft);
  return {
    overflow: true,
    start: offset > OVERFLOW_TOLERANCE,
    end: hidden - offset > OVERFLOW_TOLERANCE,
  };
}

/** True when the table is wider than the region, ignoring a subpixel rounding difference. */
export function isOverflowing(region: TableElement): boolean {
  return overflowState(region).overflow;
}

/** The region's name: the author's `data-label`, else the table's caption. Empty when it has neither. */
export function regionLabel(region: TableElement): string {
  const author = region.getAttribute("data-label")?.trim() ?? "";
  if (author !== "") return author;
  return region.querySelector("caption")?.textContent?.trim() ?? "";
}

/**
 * Applies the region's current overflow state: the logical edges with hidden content are marked for
 * the stylesheet, a table that fits loses its tab stop and landmark, and a wide table gets both back.
 * A table with no caption or author label gets the tab stop but no unnamed `region` landmark. Returns
 * whether the table overflows.
 */
export function sync(region: TableElement): boolean {
  const state = overflowState(region);
  setFlag(region, OVERFLOW_START_ATTRIBUTE, state.start);
  setFlag(region, OVERFLOW_END_ATTRIBUTE, state.end);

  if (!state.overflow) {
    region.removeAttribute("tabindex");
    region.removeAttribute("role");
    region.removeAttribute("aria-label");
    return false;
  }

  region.setAttribute("tabindex", "0");
  const label = regionLabel(region);
  if (label === "") {
    region.removeAttribute("role");
    region.removeAttribute("aria-label");
  } else {
    region.setAttribute("role", "region");
    region.setAttribute("aria-label", label);
  }
  return true;
}

function setFlag(region: TableElement, name: string, on: boolean): void {
  if (on) region.setAttribute(name, "true");
  else region.removeAttribute(name);
}

/**
 * Syncs every region on the page, re-syncs it on resize, and moves the edge markers as it scrolls. The
 * container and the table are both watched through one shared watcher: the first changes with the
 * viewport, the second with zoom or a font that reflows the cells. The returned cleanup stops that
 * watcher and the scroll listeners, so a late callback no longer touches the page and the overflow
 * state on screen stays as it is.
 */
export function enhance(env: TableEnv): () => void {
  let active = true;
  const unlisten: Array<() => void> = [];
  for (const region of env.regions()) {
    const update = () => {
      if (active) sync(region);
    };
    sync(region);
    env.watcher.watch(region, update);
    const table = region.querySelector("table");
    if (table !== null) env.watcher.watch(table, update);
    if (region.addEventListener === undefined) continue;
    region.addEventListener("scroll", update);
    unlisten.push(() => region.removeEventListener?.("scroll", update));
  }
  return () => {
    active = false;
    for (const remove of unlisten) remove();
    env.watcher.stop();
  };
}

/** The part of the document the island uses. */
export interface TableDocument {
  querySelectorAll(selector: string): Iterable<TableElement>;
}

/** The window event methods the fallback needs; a runtime without them gets no listener. */
export interface ResizeWindow {
  addEventListener?(type: "resize", listener: () => void): void;
  removeEventListener?(type: "resize", listener: () => void): void;
}

/** An observer instance, as the browser supplies one. */
interface ResizeObserverLike {
  observe(target: TableElement): void;
  disconnect(): void;
}

/** A `ResizeObserver` constructor, as the browser supplies one. */
type ResizeObserverConstructor = new (callback: () => void) => ResizeObserverLike;

/**
 * One watcher for a whole enhancement: a single `ResizeObserver` holding every target, or, when the
 * browser has no observer API, one window `resize` listener that is added with the first target and
 * removed by `stop`. Watching more targets never adds a second observer or listener.
 */
export function createWatcher(
  Observer: ResizeObserverConstructor | undefined,
  win: ResizeWindow = globalThis as unknown as ResizeWindow,
): TableWatcher {
  const updates = new Set<() => void>();
  const run = () => {
    for (const update of updates) update();
  };

  if (Observer === undefined) {
    const listener = () => {
      run();
    };
    let listening = false;
    return {
      watch(_target, update) {
        updates.add(update);
        if (listening) return;
        listening = true;
        win.addEventListener?.("resize", listener);
      },
      stop() {
        updates.clear();
        if (!listening) return;
        listening = false;
        win.removeEventListener?.("resize", listener);
      },
    };
  }

  const observer = new Observer(run);
  return {
    watch(target, update) {
      updates.add(update);
      observer.observe(target);
    },
    stop() {
      updates.clear();
      observer.disconnect();
    },
  };
}

/** The browser globals the island starts from, so tests can leave out the document. */
export interface TableGlobals extends ResizeWindow {
  document?: TableDocument;
  ResizeObserver?: ResizeObserverConstructor;
}

/**
 * Enhances every region the page already rendered and returns its cleanup. A runtime without a
 * document gets a no-op, so importing this module outside the browser touches nothing.
 */
export function start(globals: TableGlobals): () => void {
  const doc = globals.document;
  if (doc === undefined) return () => {};
  return enhance({
    regions: () => doc.querySelectorAll(REGION_SELECTOR),
    watcher: createWatcher(globals.ResizeObserver, globals),
  });
}

// The island runs when the browser loads it; nothing happens in a runtime without a document.
start(globalThis as unknown as TableGlobals);
