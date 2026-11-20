/* Sidebar groups: each group is a native <details>. The group that holds the page stays open and its current link is scrolled into the column; the rest remember their open or closed state in localStorage. */

/** Legacy origin-wide key; newer states are namespaced by the published site base under it. */

import { parseJson } from "../../src/guards.ts";
export const STORAGE_KEY = "lateen-sidebar";

/** Entries past this many are ignored, and never written: stored state stays bounded. */
export const MAX_ENTRIES = 200;

const MAX_KEY_LENGTH = 300;
const MAX_SITE_LENGTH = 512;
const GROUP_SELECTOR = "details[data-sidebar-group]";
/* The sticky column that scrolls independently of the article. */
const SIDEBAR_SELECTOR = ".sidebar-nav";
/* The current page, or the section that covers it in a collapsed group. */
const CURRENT_SELECTOR = "a[aria-current]";

/** Open (`true`) or closed (`false`) per group key. */
export type GroupState = Map<string, boolean>;

/** The parts of `Storage` the sidebar uses, so tests can pass plain objects. */
export interface SidebarStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

/** A group `<details>` as the script touches it. */
export interface SidebarGroup {
  open: boolean;
  getAttribute(name: string): string | null;
  addEventListener(type: "toggle", listener: () => void): void;
}

/** A rectangle in viewport coordinates. */
export interface SidebarRect {
  top: number;
  bottom: number;
  height: number;
}

/** The current link, as the sidebar renders it. */
export interface SidebarLink {
  getBoundingClientRect(): SidebarRect;
}

/** The scrolling sidebar column; revealing the current link scrolls this element, never the document. */
export interface SidebarScroller {
  scrollTop: number;
  getBoundingClientRect(): SidebarRect;
  querySelector(selector: string): SidebarLink | null;
}

/** The root the groups are found in: the document in a browser. */
export interface SidebarRoot {
  querySelectorAll<T>(selector: string): Iterable<T>;
}

/** A `storage` event as cross-tab updates deliver it. */
export interface StorageEventLike {
  key: string | null;
  newValue: string | null;
}

/** The place cross-tab updates arrive: the window in a browser. */
export interface SidebarEvents {
  addEventListener(type: "storage", listener: (event: StorageEventLike) => void): void;
}

/** The environment the sidebar lives in; `live()` builds the browser's. APIs are absent when the browser refuses them. */
export interface SidebarEnv {
  storage?: SidebarStorage | undefined;
  root: SidebarRoot;
  events?: SidebarEvents | undefined;
}

// The theme's tsconfig has no DOM lib; these are the browser globals the sidebar needs, no more.
declare const document: SidebarRoot;
declare const localStorage: SidebarStorage;
declare const window: SidebarEvents;

/** The stored key for one published site: base paths are separate sites on a shared origin. */
export function storageKey(site: string): string {
  return `${STORAGE_KEY}:${site.slice(0, MAX_SITE_LENGTH)}`;
}

/** The saved states; anything unreadable, or storage refusing to open, reads as nothing saved. */
export function read(storage: SidebarStorage | undefined, site = ""): GroupState {
  return readKey(storage, storageKey(site));
}

/** The states saved under one key; malformed, oversized, and non-boolean entries are dropped. */
function readKey(storage: SidebarStorage | undefined, key: string): GroupState {
  const state: GroupState = new Map();
  try {
    const saved: unknown = parseJson(storage?.getItem(key) ?? "null");
    if (typeof saved !== "object" || saved === null || Array.isArray(saved)) return state;
    for (const [name, value] of Object.entries(saved)) {
      if (state.size >= MAX_ENTRIES) break;
      if (name.length > MAX_KEY_LENGTH) continue;
      if (typeof value === "boolean") state.set(name, value);
    }
  } catch {
    /* unreadable storage or saved data: nothing is remembered */
  }
  return state;
}

/** Remember the states. Storage may throw (private mode); the states still apply to this page view. */
export function save(storage: SidebarStorage | undefined, state: GroupState, site = ""): void {
  const saved: Record<string, boolean> = {};
  let count = 0;
  for (const [key, value] of state) {
    if (count >= MAX_ENTRIES) break;
    if (key.length > MAX_KEY_LENGTH) continue;
    saved[key] = value;
    count += 1;
  }
  try {
    storage?.setItem(storageKey(site), JSON.stringify(saved));
  } catch {
    /* storage is unavailable: apply the states without remembering them */
  }
}

/** Open the page's own group; open or close the others as they were left. Groups with no saved state keep the server's default. */
export function restore(groups: Iterable<SidebarGroup>, state: GroupState): void {
  for (const group of groups) {
    const key = group.getAttribute("data-sidebar-group");
    if (key === null) continue;
    if (group.getAttribute("data-current") === "true") group.open = true;
    else {
      const saved = state.get(key);
      if (saved !== undefined) group.open = saved;
    }
  }
}

/** The published site base of the groups, so separate base-path sites keep separate states. */
function siteOf(groups: readonly SidebarGroup[]): string {
  for (const group of groups) {
    const site = group.getAttribute("data-sidebar-site");
    if (site !== null) return site;
  }
  return "";
}

/**
 * Carry title-keyed state from older versions to stable keys, then drop it. A title that was translated
 * or renamed simply finds no match, so migration can only lose state, never attach it to a wrong group.
 */
function migrate(storage: SidebarStorage | undefined, groups: Iterable<SidebarGroup>): GroupState {
  const legacy = readKey(storage, STORAGE_KEY);
  const state: GroupState = new Map();
  for (const group of groups) {
    const key = group.getAttribute("data-sidebar-group");
    const old = group.getAttribute("data-sidebar-legacy");
    const saved = old === null ? undefined : legacy.get(old);
    if (key !== null && saved !== undefined) state.set(key, saved);
  }
  try {
    storage?.removeItem?.(STORAGE_KEY);
  } catch {
    /* storage is unavailable: nothing was migrated */
  }
  return state;
}

/** Keep only the groups this page has, so renamed sections cannot leave state behind. */
function forKeys(state: GroupState, keys: ReadonlySet<string>): GroupState {
  for (const key of [...state.keys()]) if (!keys.has(key)) state.delete(key);
  return state;
}

/** Scrolls a sidebar column just enough to show its current link; the document never moves. */
export function reveal(scroller: SidebarScroller): void {
  const box = scroller.getBoundingClientRect();
  if (box.bottom <= box.top) return; // hidden drawer or empty column
  const link = scroller.querySelector(CURRENT_SELECTOR);
  if (link === null) return;
  const rect = link.getBoundingClientRect();
  let delta = 0;
  if (rect.top < box.top) delta = rect.top - box.top;
  else if (rect.bottom > box.bottom) delta = rect.bottom - box.bottom;
  if (delta !== 0) scroller.scrollTop += delta;
}

/** Restore the saved states, remember every later toggle, and follow changes from other tabs. */
export function activate(env: SidebarEnv): void {
  const groups = [...env.root.querySelectorAll<SidebarGroup>(GROUP_SELECTOR)];
  const site = siteOf(groups);
  const keys = new Set<string>();
  for (const group of groups) {
    const key = group.getAttribute("data-sidebar-group");
    if (key !== null) keys.add(key);
  }

  let state = forKeys(read(env.storage, site), keys);
  if (state.size === 0) {
    state = forKeys(migrate(env.storage, groups), keys);
    if (state.size > 0) save(env.storage, state, site);
  }
  restore(groups, state);
  for (const scroller of env.root.querySelectorAll<SidebarScroller>(SIDEBAR_SELECTOR)) reveal(scroller);

  for (const group of groups) {
    group.addEventListener("toggle", () => {
      const key = group.getAttribute("data-sidebar-group");
      if (key === null) return;
      state.set(key, group.open);
      save(env.storage, state, site);
    });
  }

  env.events?.addEventListener("storage", (event) => {
    if (event.key !== storageKey(site)) return;
    state = forKeys(read(env.storage, site), keys);
    restore(groups, state);
  });
}

/** The browser's storage, or none when the browser refuses access to it. */
function liveStorage(): SidebarStorage | undefined {
  try {
    return localStorage;
  } catch {
    return undefined;
  }
}

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (typeof document !== "undefined") {
  activate({
    storage: liveStorage(),
    root: document,
    events: typeof window === "undefined" ? undefined : window,
  });
}
