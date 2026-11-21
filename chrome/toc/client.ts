/* TOC scrollspy: marks the heading in view in "On this page". IntersectionObserver only, no scroll listeners. */

/** A rectangle in viewport coordinates. */
export interface TocRect {
  top: number;
  bottom: number;
  height: number;
}

/** Smallest DOM surface the island touches, so hosts and tests can substitute their own. */
export interface TocElement {
  id: string;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getBoundingClientRect(): TocRect;
}

/** The scrolling TOC column; revealing a link scrolls this element, never the document. */
export interface TocScroller {
  scrollTop: number;
  getBoundingClientRect(): TocRect;
  contains(element: TocElement): boolean;
  scrollTo(options: { top: number; behavior?: string }): void;
}

export interface TocDocument {
  querySelectorAll(selector: string): TocElement[];
  querySelector(selector: string): TocScroller | null;
  getElementById(id: string): TocElement | null;
  location?: { hash: string } | undefined;
}

export interface TocEntry {
  isIntersecting: boolean;
  target: TocElement;
  boundingClientRect: { top: number };
}

export interface TocObserver {
  observe(target: TocElement): void;
  disconnect(): void;
}

export type TocObserverCtor = new (
  callback: (entries: readonly TocEntry[]) => void,
  options?: { rootMargin?: string; threshold?: number },
) => TocObserver;

export type MediaQuery = (query: string) => { matches: boolean };

/** Everything the island reads from the world; tests pass fakes, browsers resolve to globals. */
export interface TocEnv {
  document?: TocDocument;
  IntersectionObserver?: TocObserverCtor;
  matchMedia?: MediaQuery;
}

const LINK_SELECTOR = ".toc a[href^='#'], .toc-fold a[href^='#']";
/* The sticky column is the only part of the TOC that scrolls; the fold is never a reveal target. */
const SCROLLER_SELECTOR = ".toc";
const HEADER_SELECTOR = "[data-site-header]";
const REDUCED = "(prefers-reduced-motion: reduce)";
/* The band runs from below the sticky header to the top half of the viewport; a heading in it is in view. */
const BAND_BOTTOM = "-50%";

const globals = globalThis as unknown as {
  document?: TocDocument;
  IntersectionObserver?: TocObserverCtor;
  matchMedia?: MediaQuery;
};

/** Marks the heading in view in the table of contents; returns a stop function. */
export default function scrollspy(env: TocEnv = {}): () => void {
  const off = () => {};
  const document = env.document ?? globals.document;
  const Observer = env.IntersectionObserver ?? globals.IntersectionObserver;
  const matchMedia = env.matchMedia ?? globals.matchMedia;
  if (!document || !Observer) return off;

  const byId = new Map<string, TocElement[]>();
  for (const link of document.querySelectorAll(LINK_SELECTOR)) {
    const id = link.getAttribute("href")?.slice(1);
    if (!id) continue;
    const group = byId.get(id) ?? [];
    group.push(link);
    byId.set(id, group);
  }
  if (byId.size === 0) return off;

  const headings: TocElement[] = [];
  for (const id of byId.keys()) {
    const heading = document.getElementById(id);
    if (heading) headings.push(heading);
  }
  if (headings.length === 0) return off;

  const scroller = document.querySelector(SCROLLER_SELECTOR);
  const header = document.querySelector(HEADER_SELECTOR);
  const headerHeight = Math.max(0, Math.round(header?.getBoundingClientRect().height ?? 0));

  const inBand = new Set<string>();
  let active: string | null = null;
  let stopped = false;

  /** True unless a host or the reader asks for reduced motion; without matchMedia, no motion is assumed. */
  const reduced = () => matchMedia?.(REDUCED)?.matches ?? true;

  /** Keeps the active link visible by scrolling the TOC column alone; the document never moves. */
  const reveal = (link: TocElement) => {
    if (!scroller) return;
    const box = scroller.getBoundingClientRect();
    if (box.bottom <= box.top) return; // hidden or empty column
    const rect = link.getBoundingClientRect();
    let delta = 0;
    if (rect.top < box.top) delta = rect.top - box.top;
    else if (rect.bottom > box.bottom) delta = rect.bottom - box.bottom;
    if (delta === 0) return;
    scroller.scrollTo({ top: scroller.scrollTop + delta, behavior: reduced() ? "auto" : "smooth" });
  };

  const mark = (id: string | null) => {
    if (id === active) return;
    if (active !== null) {
      for (const link of byId.get(active) ?? []) link.removeAttribute("aria-current");
    }
    active = id;
    if (id === null) return;
    const group = byId.get(id);
    if (!group) return;
    for (const link of group) link.setAttribute("aria-current", "true");
    const target = group.find((link) => scroller?.contains(link) === true);
    if (target) reveal(target);
  };

  /** The id the reader asked for on arrival, so a deep link is marked before the first observation. */
  const fragment = (): string | null => {
    const hash = document.location?.hash ?? "";
    if (!hash.startsWith("#")) return null;
    let id = hash.slice(1);
    try {
      id = decodeURIComponent(id);
    } catch {
      /* a malformed escape keeps the raw fragment */
    }
    return byId.has(id) ? id : null;
  };
  const observer = new Observer((entries) => {
    if (stopped) return;
    for (const entry of entries) {
      if (entry.isIntersecting) inBand.add(entry.target.id);
      else inBand.delete(entry.target.id);
    }
    const visible = headings.findLast((heading) => inBand.has(heading.id));
    // During a long section, keep its heading active after it has scrolled past the header.
    mark((visible ?? headings.findLast((heading) => heading.getBoundingClientRect().bottom <= headerHeight))?.id ?? null);
  }, { rootMargin: `-${headerHeight}px 0px ${BAND_BOTTOM} 0px` });

  for (const heading of headings) observer.observe(heading);
  mark(fragment());

  return () => {
    stopped = true;
    observer.disconnect();
  };
}

/** Runs on import in a real browser; hosts without a document or IntersectionObserver stay inert. */
if (globals.document && globals.IntersectionObserver) scrollspy();
