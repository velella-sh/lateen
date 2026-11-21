import assert from "node:assert/strict";
import { test } from "node:test";
import scrollspy, {
  type TocDocument,
  type TocElement,
  type TocEntry,
  type TocEnv,
  type TocScroller,
} from "../chrome/toc/client.ts";

const LINK_SELECTOR = ".toc a[href^='#'], .toc-fold a[href^='#']";
const SCROLLER_SELECTOR = ".toc";
const HEADER_SELECTOR = "[data-site-header]";
const REDUCED = "(prefers-reduced-motion: reduce)";
const HEADER_HEIGHT = 68;

class FakeElement implements TocElement {
  id: string;
  readonly attrs = new Map<string, string>();
  /** Scrolls the real anchor would cause on its ancestors and the document; the spy must cause none. */
  readonly documentScrolls: { block?: string; behavior?: string }[] = [];
  top: number;
  height: number;

  constructor(id: string, top = 2000, height = 20) {
    this.id = id;
    this.top = top;
    this.height = height;
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  removeAttribute(name: string): void {
    this.attrs.delete(name);
  }

  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    return { top: this.top, bottom: this.top + this.height, height: this.height };
  }

  scrollIntoView(options?: { block?: string; behavior?: string }): void {
    this.documentScrolls.push(options ?? {});
  }
}

/** The sticky TOC column: it has its own scroll offset and never relays a scroll to the document. */
class FakeScroller implements TocScroller {
  readonly links: TocElement[] = [];
  readonly scrolls: { top: number; behavior?: string }[] = [];
  scrollTop = 0;
  top = 0;
  height = 300;

  getBoundingClientRect(): { top: number; bottom: number; height: number } {
    return { top: this.top, bottom: this.top + this.height, height: this.height };
  }

  contains(element: TocElement): boolean {
    return this.links.includes(element);
  }

  scrollTo(options: { top: number; behavior?: string }): void {
    this.scrolls.push(options);
    this.scrollTop = options.top;
  }
}

/** A link to a heading, as the TOC renders one in the aside and again in the fold. */
function linkTo(heading: string): FakeElement {
  const link = new FakeElement(`link-${heading}`);
  link.attrs.set("href", `#${heading}`);
  return link;
}

class FakeDocument implements TocDocument {
  readonly queries: string[] = [];
  readonly singleQueries: string[] = [];
  readonly ids: Map<string, FakeElement>;
  links: FakeElement[];
  scroller: FakeScroller | null;
  header: FakeScroller | null;
  location: { hash: string };

  constructor(
    links: FakeElement[],
    headings: FakeElement[],
    scroller: FakeScroller | null,
    header: FakeScroller | null,
    hash = "",
  ) {
    this.links = links;
    this.ids = new Map(headings.map((heading) => [heading.id, heading]));
    this.scroller = scroller;
    this.header = header;
    this.location = { hash };
  }

  querySelectorAll(selector: string): FakeElement[] {
    this.queries.push(selector);
    return this.links;
  }

  querySelector(selector: string): TocScroller | null {
    this.singleQueries.push(selector);
    return selector === HEADER_SELECTOR ? this.header : this.scroller;
  }

  getElementById(id: string): FakeElement | null {
    return this.ids.get(id) ?? null;
  }
}

class FakeObserver {
  static instances: FakeObserver[] = [];
  readonly observed: TocElement[] = [];
  disconnected = false;
  callback: (entries: readonly TocEntry[]) => void;
  options?: { rootMargin?: string; threshold?: number } | undefined;

  constructor(
    callback: (entries: readonly TocEntry[]) => void,
    options?: { rootMargin?: string; threshold?: number },
  ) {
    this.callback = callback;
    this.options = options;
    FakeObserver.instances.push(this);
  }

  observe(target: TocElement): void {
    this.observed.push(target);
  }

  disconnect(): void {
    this.disconnected = true;
  }

  /** The browser reports a heading's position and whether it is inside the band. */
  see(target: FakeElement, top: number, intersecting: boolean): void {
    target.top = top;
    this.report([{ isIntersecting: intersecting, target, boundingClientRect: { top } }]);
  }

  /** One callback may carry a whole fast scroll; browsers do not promise document order. */
  report(entries: readonly TocEntry[]): void {
    this.callback(entries);
  }
}

interface SpyOptions {
  reduced?: boolean;
  hash?: string;
  scroller?: FakeScroller | null;
  /** Header height in pixels; `null` means the page has no sticky header. */
  header?: number | null;
}

/** A scrollspy over a page with the given headings, each linked from the aside and the fold. */
function spy(ids: string[], options: SpyOptions = {}) {
  const headings = ids.map((id) => new FakeElement(id));
  const aside = ids.map((id, index) => {
    const link = linkTo(id);
    // Visible inside the column by default; tests move one link to force a reveal.
    link.top = 10 + index * 30;
    return link;
  });
  const fold = ids.map(linkTo);
  const links = [...aside, ...fold];
  const scroller = options.scroller === undefined ? new FakeScroller() : options.scroller;
  scroller?.links.push(...aside);
  const header = options.header === null ? null : new FakeScroller();
  if (header) header.height = options.header ?? HEADER_HEIGHT;
  const doc = new FakeDocument(links, headings, scroller, header, options.hash ?? "");
  FakeObserver.instances = [];
  const env: TocEnv = {
    document: doc,
    IntersectionObserver: FakeObserver,
    matchMedia: (query) => ({ matches: query === REDUCED && options.reduced === true }),
  };
  return {
    doc,
    env,
    scroller,
    header,
    stop: scrollspy(env),
    links,
    aside,
    fold,
    observer: FakeObserver.instances.at(-1)!,
    heading: (id: string) => headings.find((heading) => heading.id === id)!,
    link: (id: string) => links.filter((link) => link.getAttribute("href") === `#${id}`),
  };
}

/** Exactly the copies of one heading carry `aria-current="true"`; every other link carries none. */
function assertActive(links: readonly FakeElement[], id: string | null): void {
  for (const link of links) {
    const href = link.getAttribute("href")!;
    const expected = id !== null && href === `#${id}` ? "true" : null;
    assert.equal(link.getAttribute("aria-current"), expected, `state of ${href}`);
  }
}

/** The scrollspy must reveal links by scrolling the column, never by scrolling their ancestors. */
function assertDocumentUnscrolled(links: readonly FakeElement[]): void {
  for (const link of links) assert.deepEqual(link.documentScrolls, [], `document scrolled for ${link.getAttribute("href")}`);
}

test("asks for both TOC link sets, the scrolling column, and the sticky header, then observes each heading once", () => {
  const { doc, observer } = spy(["pick", "gem", "build"]);
  assert.deepEqual(doc.queries, [LINK_SELECTOR]);
  assert.deepEqual(doc.singleQueries, [SCROLLER_SELECTOR, HEADER_SELECTOR]);
  assert.deepEqual(
    observer.observed.map((heading) => heading.id),
    ["pick", "gem", "build"],
  );
});

test("marks the first heading once it is the one in view", () => {
  const { observer, heading, links } = spy(["pick", "gem", "build"]);
  assertActive(links, null);

  observer.see(heading("pick"), HEADER_HEIGHT + 60, true);
  assertActive(links, "pick");
});

test("moves the marker to the middle heading", () => {
  const { observer, heading, links } = spy(["pick", "gem", "build"]);

  observer.see(heading("pick"), HEADER_HEIGHT + 60, true);
  observer.see(heading("pick"), -20, false);
  observer.see(heading("gem"), HEADER_HEIGHT + 50, true);

  assertActive(links, "gem");
});

test("marks the last heading when it is the one in view", () => {
  const { observer, heading, links } = spy(["pick", "gem", "build"]);

  observer.see(heading("build"), HEADER_HEIGHT + 60, true);
  assertActive(links, "build");
});

test("keeps the last section active through long content and clears it above the first heading", () => {
  const { observer, heading, links } = spy(["pick", "gem"]);

  observer.see(heading("pick"), HEADER_HEIGHT + 60, true);
  assertActive(links, "pick");

  observer.see(heading("pick"), -40, false);
  observer.see(heading("gem"), 700, false);
  assertActive(links, "pick");

  observer.see(heading("pick"), 700, false);
  assertActive(links, null);
});

test("keeps one heading active when several are in the band", () => {
  const { observer, heading, links } = spy(["pick", "gem", "build"]);

  observer.see(heading("pick"), HEADER_HEIGHT + 20, true);
  observer.see(heading("gem"), HEADER_HEIGHT + 80, true);
  assertActive(links, "gem");

  observer.see(heading("gem"), -10, false);
  assertActive(links, "pick");
});

test("resolves a fast-scroll batch in document order, not entry order", () => {
  const { observer, heading, links } = spy(["pick", "gem", "build"]);

  observer.report([
    { isIntersecting: false, target: heading("pick"), boundingClientRect: { top: -400 } },
    { isIntersecting: true, target: heading("build"), boundingClientRect: { top: HEADER_HEIGHT + 80 } },
    { isIntersecting: true, target: heading("gem"), boundingClientRect: { top: HEADER_HEIGHT + 20 } },
  ]);

  assertActive(links, "build");
});

test("starts the band below the sticky header", () => {
  const { observer, heading, links } = spy(["pick", "gem"]);
  assert.equal(observer.options?.rootMargin, `-${HEADER_HEIGHT}px 0px -50% 0px`);

  // A heading scrolled behind the sticky header is not in view, even though it is inside the viewport.
  observer.see(heading("pick"), HEADER_HEIGHT - 10, false);
  assertActive(links, null);

  // The heading just below the header is.
  observer.see(heading("gem"), HEADER_HEIGHT + 60, true);
  assertActive(links, "gem");
});

test("resolves a deep link before the first observation and decodes its fragment", () => {
  const { observer, heading, links } = spy(["pick", "gem"], { hash: "#gem" });
  assertActive(links, "gem");

  // The observer still takes over afterwards.
  observer.see(heading("pick"), HEADER_HEIGHT + 60, true);
  assertActive(links, "pick");

  const encoded = spy(["café", "tea"], { hash: "#caf%C3%A9" });
  assertActive(encoded.links, "café");
});

test("ignores a fragment that names no TOC entry and marks nothing", () => {
  const { links } = spy(["pick", "gem"], { hash: "#ghost" });
  assertActive(links, null);
});

test("reveals the active link by scrolling the TOC column only, and only once per activation", () => {
  const { observer, heading, link, fold, scroller, links } = spy(["pick", "gem", "build"]);
  const gem = link("gem")[0]!;
  gem.top = 400; // below the 300px column viewport

  observer.see(heading("gem"), HEADER_HEIGHT + 60, true);
  assert.deepEqual(scroller!.scrolls, [{ top: 120, behavior: "smooth" }]);
  assert.equal(scroller!.scrollTop, 120);
  assertActive(links, "gem");

  // Re-observing the active heading does not scroll the column again.
  observer.see(heading("gem"), HEADER_HEIGHT + 65, true);
  assert.equal(scroller!.scrolls.length, 1);

  // A fast scroll back up to a link above the column scrolls the column up, still inside it.
  const pick = link("pick")[0]!;
  pick.top = -20;
  observer.report([
    { isIntersecting: false, target: heading("build"), boundingClientRect: { top: 400 } },
    { isIntersecting: false, target: heading("gem"), boundingClientRect: { top: 500 } },
    { isIntersecting: true, target: heading("pick"), boundingClientRect: { top: HEADER_HEIGHT + 60 } },
  ]);
  assert.deepEqual(scroller!.scrolls.at(-1), { top: 100, behavior: "smooth" });
  assertActive([...link("pick"), ...link("gem"), ...link("build")], "pick");
  assert.deepEqual(fold[0]!.documentScrolls, []);
  assertDocumentUnscrolled([...link("pick"), ...link("gem"), ...link("build")]);
});

test("reduced motion jumps the TOC column instead of smooth scrolling", () => {
  const { observer, heading, link, scroller } = spy(["pick", "gem"], { reduced: true });
  link("gem")[0]!.top = 400;

  observer.see(heading("gem"), HEADER_HEIGHT + 60, true);
  assert.deepEqual(scroller!.scrolls, [{ top: 120, behavior: "auto" }]);
  assertDocumentUnscrolled([...link("pick"), ...link("gem")]);
});

test("assumes reduced motion when the host has no matchMedia", () => {
  const headings = [new FakeElement("pick"), new FakeElement("gem")];
  const aside = [linkTo("pick"), linkTo("gem")];
  aside[0]!.top = 10;
  aside[1]!.top = 400;
  const fold = [linkTo("pick"), linkTo("gem")];
  const scroller = new FakeScroller();
  scroller.links.push(...aside);
  const header = new FakeScroller();
  header.height = HEADER_HEIGHT;
  const doc = new FakeDocument([...aside, ...fold], headings, scroller, header);
  FakeObserver.instances = [];
  scrollspy({
    document: doc,
    IntersectionObserver: FakeObserver,
  });
  FakeObserver.instances.at(-1)!.see(headings[1]!, HEADER_HEIGHT + 60, true);
  assert.deepEqual(scroller.scrolls, [{ top: 120, behavior: "auto" }]);
});

test("marks without scrolling when the TOC column is hidden or absent", () => {
  const hidden = new FakeScroller();
  hidden.height = 0;
  const hiddenSpy = spy(["pick", "gem"], { scroller: hidden });
  hiddenSpy.link("gem")[0]!.top = 400;
  hiddenSpy.observer.see(hiddenSpy.heading("gem"), HEADER_HEIGHT + 60, true);
  assertActive(hiddenSpy.links, "gem");
  assert.deepEqual(hidden.scrolls, []);

  const absent = spy(["pick", "gem"], { scroller: null });
  assert.equal(absent.scroller, null);
  absent.observer.see(absent.heading("gem"), HEADER_HEIGHT + 60, true);
  assertActive(absent.links, "gem");
  assertDocumentUnscrolled(absent.links);
});

test("stays inert without IntersectionObserver and leaves the anchors usable", () => {
  const links = [linkTo("pick")];
  const scroller = new FakeScroller();
  scroller.links.push(links[0]!);
  const doc = new FakeDocument(links, [new FakeElement("pick")], scroller, new FakeScroller());
  FakeObserver.instances = [];

  const noObserver = scrollspy({ document: doc });
  assert.equal(typeof noObserver, "function");
  noObserver();

  assert.equal(FakeObserver.instances.length, 0);
  assert.deepEqual(scroller.scrolls, []);
  for (const link of links) {
    assert.equal(link.getAttribute("href"), "#pick");
    assert.equal(link.getAttribute("aria-current"), null);
  }
  assertDocumentUnscrolled(links);
});

test("stays inert without a document or without TOC links", () => {
  FakeObserver.instances = [];
  scrollspy({ IntersectionObserver: FakeObserver })();
  assert.equal(FakeObserver.instances.length, 0);

  const empty = scrollspy({
    document: new FakeDocument([], [], new FakeScroller(), new FakeScroller()),
    IntersectionObserver: FakeObserver,
  });
  empty();
  assert.equal(FakeObserver.instances.length, 0);
});

test("ignores TOC links whose heading is missing from the page", () => {
  const links = [linkTo("ghost")];
  const doc = new FakeDocument(links, [], new FakeScroller(), new FakeScroller());
  FakeObserver.instances = [];
  scrollspy({ document: doc, IntersectionObserver: FakeObserver });
  assert.equal(FakeObserver.instances.length, 0);
  for (const l of links) assert.equal(l.getAttribute("aria-current"), null);
});

test("stop disconnects the observer and ignores queued entries", () => {
  const { observer, heading, links, stop } = spy(["pick", "gem"]);
  observer.see(heading("pick"), HEADER_HEIGHT + 60, true);
  assertActive(links, "pick");

  stop();
  assert.equal(observer.disconnected, true);

  observer.see(heading("gem"), HEADER_HEIGHT + 60, true);
  assertActive(links, "pick");
});
