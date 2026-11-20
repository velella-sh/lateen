/*
 * The search index's lazy loader: nothing is fetched until a reader opens search, concurrent opens
 * share one load promise, and a rejected load can be tried again.
 *
 * `createIndexLoader` owns the once-only state — the loaded API and the in-flight promise — so the
 * dialog controller only decides what to announce. It takes the load function as an argument, so
 * tests drive it with a controllable loader rather than a live Pagefind download; the browser passes
 * `loadIndex`, which imports the built index module.
 */

import type { SearchRecord } from "./options.ts";

/** One hit in a Pagefind result list. */
export interface SearchHit {
  data(): Promise<SearchRecord>;
}

/** The part of Pagefind's browser API the dialog uses. */
export interface PagefindApi {
  search(term: string): Promise<{ readonly results: readonly SearchHit[] }>;
}

/** The index URL for a site `base`: `/pagefind/pagefind.js` at the root, `<base>/pagefind/pagefind.js` below it. */
export function indexUrl(base: string): string {
  const root = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${root}/pagefind/pagefind.js`;
}

/** Imports the Pagefind module from the built index. */
export function loadIndex(url: string): Promise<PagefindApi> {
  return import(url) as Promise<PagefindApi>;
}

/** The once-only load state, readable without starting anything. */
export interface IndexLoader {
  /** The loaded API, or undefined until a load has succeeded. */
  readonly api: PagefindApi | undefined;
  /** Whether a load is in flight right now. */
  readonly loading: boolean;
  /**
   * The index, loading it at most once at a time: a loaded API resolves immediately, an in-flight
   * load is shared by every caller, and a rejection clears the way so the next call tries again.
   */
  load(url: string): Promise<PagefindApi>;
}

/** A lazy index load over `load`: no request happens until the first `load` call. */
export function createIndexLoader(load: (url: string) => Promise<PagefindApi>): IndexLoader {
  let api: PagefindApi | undefined;
  let pending: Promise<PagefindApi> | undefined;
  return {
    get api() {
      return api;
    },
    get loading() {
      return pending !== undefined;
    },
    load(url: string): Promise<PagefindApi> {
      if (api !== undefined) return Promise.resolve(api);
      if (pending !== undefined) return pending;
      pending = load(url).then(
        (loaded) => {
          api = loaded;
          pending = undefined;
          return loaded;
        },
        (error: unknown) => {
          // A failed load is not remembered: the next call starts a fresh one, so a retry can work.
          pending = undefined;
          throw error;
        },
      );
      return pending;
    },
  };
}