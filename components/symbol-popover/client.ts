/**
 * Symbol popover island: Escape closes the open disclosure and returns focus to its chip, and a
 * click outside closes it without moving focus. Only open disclosures are tracked, so a click or a
 * key costs work proportional to what is open, not to every symbol on the page. The disclosure is a
 * native popover, so it already opens with Enter, Space, or a tap and closes with a tap on its
 * chip without this script; the island never traps focus or changes the tab order.
 */

import {
  clickPopover,
  closePopover,
  escapePopover,
  forgetPopover,
  openPopover,
  type OpenPopover,
  type PopoverBox,
  type PopoverEntry,
} from "../../src/popover.ts";

/** Selector of every symbol disclosure; the island finds them by it. Static chips have no panel. */
export const PANEL_SELECTOR = ".symbol-popover[data-symbol]:has(> [popover])";

/** Selector of the chip inside a disclosure, which takes focus back when Escape closes it. */
export const TRIGGER_SELECTOR = "button[popovertarget]";

/** The chip as the island touches it. */
export interface SymbolChip {
  focus(): void;
}

/** A keyboard, toggle, or pointer event as the island reads it. */
export interface SymbolEvent {
  readonly key?: string;
  readonly target?: unknown;
  preventDefault(): void;
}

/** A disclosure as the island touches it: a wrapper around a native popover. */
export interface SymbolNode {
  open: boolean;
  querySelector(selector: string): SymbolChip | null;
  contains(target: unknown): boolean;
  addEventListener(type: string, listener: (event: SymbolEvent) => void): void;
  removeEventListener(type: string, listener: (event: SymbolEvent) => void): void;
  /** The disclosure's panel; unset on a fake node and on a static chip. */
  readonly lastElementChild?: unknown;
}

/** What `activate` wires to one disclosure, so it can be unwired again. */
interface Wiring {
  readonly panel: SymbolNode;
  readonly keydown: (event: SymbolEvent) => void;
  readonly toggle: (event: SymbolEvent) => void;
  /** Whether the keydown listener is attached; it is only needed while the panel is open. */
  keys: boolean;
  /** The shared entry while the panel is open, so another unit can close it. */
  entry: PopoverEntry | undefined;
}

/** The disclosures that are open right now. Every document event walks only this set. */
const open = new Set<SymbolNode>();

/** The wiring of each activated disclosure, looked up without keeping closed panels alive. */
const wired = new WeakMap<SymbolNode, Wiring>();

/** The disclosures open right now, in the order they were activated. */
export function openPanels(): SymbolNode[] {
  return [...open];
}

/** The disclosure's panel, when this node is a real element with one; fake nodes and static chips have none. */
function panelBox(node: SymbolNode): PopoverBox | undefined {
  const child = node.lastElementChild;
  if (child === null || typeof child !== "object") return undefined;
  const box = child as Partial<PopoverBox>;
  return typeof box.getBoundingClientRect === "function" && box.style !== undefined ? (box as PopoverBox) : undefined;
}

/** What the shared popover module needs to close and measure this disclosure. */
function openEntry(panel: SymbolNode): OpenPopover {
  return {
    close: (focus) => closePanel(panel, focus),
    contains: (target) => panel.contains(target),
    panel: panelBox(panel),
  };
}

/**
 * Brings a panel's open set entry and its Escape listener in line with its `open` flag. The keydown
 * listener is attached only while the panel is open, so a page of closed disclosures carries none.
 * The shared module also learns about the open panel, so a footnote note closes it.
 */
function sync(wiring: Wiring): void {
  const opened = wiring.panel.open;
  if (opened) {
    open.add(wiring.panel);
    if (wiring.entry === undefined) wiring.entry = openPopover("symbol", openEntry(wiring.panel));
  } else {
    open.delete(wiring.panel);
    forgetPopover(wiring.entry);
    wiring.entry = undefined;
  }
  if (wiring.keys === opened) return;
  wiring.keys = opened;
  if (opened) wiring.panel.addEventListener("keydown", wiring.keydown);
  else wiring.panel.removeEventListener("keydown", wiring.keydown);
}

/**
 * Closes an open `panel`, forgets it, and focuses its chip when `focusChip` is set. A closed panel is
 * left alone. Focus is never trapped: outside clicks pass `false`, so the clicked element keeps it.
 */
export function closePanel(panel: SymbolNode, focusChip: boolean): void {
  if (!panel.open) return;
  panel.open = false;
  const wiring = wired.get(panel);
  if (wiring === undefined) open.delete(panel);
  else sync(wiring);
  if (focusChip) panel.querySelector(TRIGGER_SELECTOR)?.focus();
}

/**
 * Closes `panel` and focuses its chip when `event` is Escape and the panel is open. Every other key,
 * and Escape on a closed panel, is left to the browser.
 */
export function closeOnEscape(panel: SymbolNode, event: SymbolEvent): void {
  if (event.key !== "Escape" || !panel.open) return;
  event.preventDefault();
  const entry = wired.get(panel)?.entry;
  if (entry === undefined) closePanel(panel, true);
  else escapePopover(event, entry);
}

/**
 * Closes `panel` when a click lands outside it. The chip stays untouched, and a click inside the
 * panel or its chip leaves it open. Focus is not moved: the clicked element keeps it.
 */
export function closeOutside(panel: SymbolNode, target: unknown): void {
  if (!panel.open || panel.contains(target)) return;
  const entry = wired.get(panel)?.entry;
  if (entry === undefined) closePanel(panel, false);
  else closePopover(entry, false);
}

/**
 * Handles a document click against the open disclosures only: a page with none does no `contains`
 * checks, and one open panel costs one check. Exported so the island's cost is testable without a
 * browser.
 */
export function handleClick(target: unknown): void {
  clickPopover(target);
}

/**
 * Wires one disclosure. The native `toggle` event tracks its open state; Escape is heard only while
 * it is open. Returns a cleanup that unwires the panel, for a page that removes it.
 */
export function activate(panel: SymbolNode): () => void {
  const wiring: Wiring = {
    panel,
    keys: false,
    entry: undefined,
    keydown: (event) => closeOnEscape(panel, event),
    toggle: () => sync(wiring),
  };
  wired.set(panel, wiring);
  panel.addEventListener("toggle", wiring.toggle);
  sync(wiring);

  return () => {
    open.delete(panel);
    forgetPopover(wiring.entry);
    wiring.entry = undefined;
    panel.removeEventListener("toggle", wiring.toggle);
    if (wiring.keys) panel.removeEventListener("keydown", wiring.keydown);
    wiring.keys = false;
    wired.delete(panel);
  };
}

/** Adapt the native popover to the island's open state and dismissal handlers. */
function connect(root: HTMLElement): void {
  const panel = root.querySelector<HTMLElement>("[popover]");
  if (panel === null || typeof panel.hidePopover !== "function") return;
  activate({
    get open() { return panel.matches(":popover-open"); },
    set open(value) { if (!value) panel.hidePopover(); },
    lastElementChild: panel,
    querySelector: () => root.querySelector<HTMLButtonElement>(TRIGGER_SELECTOR),
    contains: (target) => target instanceof Node && root.contains(target),
    addEventListener: (type, listener) => root.addEventListener(type, listener, true),
    removeEventListener: (type, listener) => root.removeEventListener(type, listener, true),
  });
}

// The island runs only in the browser.
if (typeof document !== "undefined") {
  for (const root of document.querySelectorAll<HTMLElement>(PANEL_SELECTOR)) connect(root);
  document.addEventListener("click", (event) => handleClick(event.target));
}
