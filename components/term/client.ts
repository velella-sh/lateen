/**
 * Term popover island: Escape closes the open definition and returns focus to its chip, and a click
 * outside closes it without moving focus. Only open disclosures are tracked, so a click or a key
 * costs work proportional to what is open, not to every term on the page. The disclosure is a
 * native `<details>`, so it already opens with Enter, Space, or a tap and closes with a tap on its
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

/** Selector of every term disclosure; the island finds them by it. Unknown terms are static text. */
export const PANEL_SELECTOR = "details[data-term]";

/** Selector of the chip inside a disclosure, which takes focus back when Escape closes it. */
export const SUMMARY_SELECTOR = "summary";

/** The chip as the island touches it. */
export interface TermChip {
  focus(): void;
}

/** A keyboard, toggle, or pointer event as the island reads it. */
export interface TermEvent {
  readonly key?: string;
  readonly target?: unknown;
  preventDefault(): void;
}

/** A disclosure as the island touches it: a `<details>` element. */
export interface TermNode {
  open: boolean;
  querySelector(selector: string): TermChip | null;
  contains(target: unknown): boolean;
  addEventListener(type: string, listener: (event: TermEvent) => void): void;
  removeEventListener(type: string, listener: (event: TermEvent) => void): void;
  /** The disclosure's panel; unset on a fake node. */
  readonly lastElementChild?: unknown;
}

/** What `activate` wires to one disclosure, so it can be unwired again. */
interface Wiring {
  readonly panel: TermNode;
  readonly keydown: (event: TermEvent) => void;
  readonly toggle: (event: TermEvent) => void;
  /** Whether the keydown listener is attached; it is only needed while the panel is open. */
  keys: boolean;
  /** The shared entry while the panel is open, so another unit can close it. */
  entry: PopoverEntry | undefined;
}

/** The disclosures that are open right now. Every document event walks only this set. */
const open = new Set<TermNode>();

/** The wiring of each activated disclosure, looked up without keeping closed panels alive. */
const wired = new WeakMap<TermNode, Wiring>();

/** The disclosures open right now, in the order they were activated. */
export function openPanels(): TermNode[] {
  return [...open];
}

/** The disclosure's panel, when this node is a real element with one; fake nodes have none. */
function panelBox(node: TermNode): PopoverBox | undefined {
  const child = node.lastElementChild;
  if (child === null || typeof child !== "object") return undefined;
  const box = child as Partial<PopoverBox>;
  return typeof box.getBoundingClientRect === "function" && box.style !== undefined ? (box as PopoverBox) : undefined;
}

/** What the shared popover module needs to close and measure this disclosure. */
function openEntry(panel: TermNode): OpenPopover {
  return {
    close: (focus) => closePanel(panel, focus),
    contains: (target) => panel.contains(target),
    panel: panelBox(panel),
  };
}

/**
 * Brings a panel's open set entry and its Escape listener in line with its `open` flag. The keydown
 * listener is attached only while the panel is open, so a page of closed disclosures carries none.
 * The shared module also learns about the open panel, so a symbol or footnote closes it.
 */
function sync(wiring: Wiring): void {
  const opened = wiring.panel.open;
  if (opened) {
    open.add(wiring.panel);
    if (wiring.entry === undefined) wiring.entry = openPopover("term", openEntry(wiring.panel));
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
export function closePanel(panel: TermNode, focusChip: boolean): void {
  if (!panel.open) return;
  panel.open = false;
  const wiring = wired.get(panel);
  if (wiring === undefined) open.delete(panel);
  else sync(wiring);
  if (focusChip) panel.querySelector(SUMMARY_SELECTOR)?.focus();
}

/** Closes `panel` and focuses its chip when `event` is Escape and the panel is open. */
export function closeOnEscape(panel: TermNode, event: TermEvent): void {
  if (event.key !== "Escape" || !panel.open) return;
  event.preventDefault();
  const entry = wired.get(panel)?.entry;
  if (entry === undefined) closePanel(panel, true);
  else escapePopover(event, entry);
}

/** Closes `panel` when a click lands outside it; a click inside leaves it open and focus alone. */
export function closeOutside(panel: TermNode, target: unknown): void {
  if (!panel.open || panel.contains(target)) return;
  const entry = wired.get(panel)?.entry;
  if (entry === undefined) closePanel(panel, false);
  else closePopover(entry, false);
}

/** Handles a document click against the open disclosures only. */
export function handleClick(target: unknown): void {
  clickPopover(target);
}

/** Wires one disclosure and returns a cleanup that unwires it. */
export function activate(panel: TermNode): () => void {
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

declare const document:
  | {
      querySelectorAll(selector: string): Iterable<unknown>;
      addEventListener(type: string, listener: (event: TermEvent) => void): void;
    }
  | undefined;

// The island runs when the browser loads it; importing it in a build or a test without a document does nothing.
if (typeof document !== "undefined") {
  const panels = [...document.querySelectorAll(PANEL_SELECTOR)] as TermNode[];
  for (const panel of panels) activate(panel);
  document.addEventListener("click", (event) => handleClick(event.target));
}
