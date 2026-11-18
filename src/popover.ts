/**
 * One behavior for the theme's popovers: a panel closes on Escape, closes when a panel from
 * another unit opens, and is nudged back inside the viewport. Each unit keeps its own markup,
 * its own open state, and its no-JavaScript fallback; this module only coordinates what is open
 * and where a measured panel sits.
 */

/** The rectangle a panel occupies, in viewport coordinates. */
export interface PopoverRect {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** An element the module can nudge, written structurally so a test needs no DOM. */
export interface PopoverBox {
  getBoundingClientRect(): PopoverRect;
  style: { translate: string };
}

/** The viewport a panel must stay inside; defaults to the browser's. */
export interface PopoverViewport {
  readonly width: number;
  readonly height: number;
}

/** What a unit gives the module while one panel is open. */
export interface OpenPopover {
  /** Closes the panel. `focus` returns focus to its trigger when the unit has one. */
  close(focus: boolean): void;
  /** Whether `target` is inside the panel or its trigger. */
  contains(target: unknown): boolean;
  /** The panel element, when the unit can measure one. */
  readonly panel: PopoverBox | undefined;
}

/** Which unit owns a panel: opening one closes panels of the other units. */
export type PopoverKind = "symbol" | "footnote" | "term";

/** One open panel as the module tracks it. */
export interface PopoverEntry extends OpenPopover {
  readonly kind: PopoverKind;
  /** Whether opening it also closed an earlier panel of its own kind. */
  readonly exclusive: boolean;
}

/** The parts of a pointer or keyboard event the module reads. */
export interface PopoverEvent {
  readonly key?: string | undefined;
  readonly target?: unknown;
}

/** Distance kept between a nudged panel and the viewport edge, in pixels. */
const MARGIN = 8;

/** Panels that are open right now, in the order they opened. */
const open: PopoverEntry[] = [];

/** The browser's viewport, or `undefined` in a runtime without one. */
function browserViewport(): PopoverViewport | undefined {
  const globals = globalThis as { innerWidth?: unknown; innerHeight?: unknown };
  if (typeof globals.innerWidth !== "number" || typeof globals.innerHeight !== "number") return undefined;
  return { width: globals.innerWidth, height: globals.innerHeight };
}

/**
 * Moves `panel` back inside `viewport` with its CSS `translate` property. A panel that already fits
 * keeps an empty translate, and a panel with no measurable box (a detached or hidden panel) is left
 * alone. Returns the shift applied, so a test can check it without a layout engine.
 */
export function fitToViewport(
  panel: PopoverBox,
  viewport: PopoverViewport | undefined = browserViewport(),
): { readonly x: number; readonly y: number } | undefined {
  if (viewport === undefined) return undefined;

  panel.style.translate = "";

  const rect = panel.getBoundingClientRect();
  const width = rect.right - rect.left;
  const height = rect.bottom - rect.top;
  if (width <= 0 && height <= 0) return undefined;

  let x = 0;
  if (rect.right > viewport.width - MARGIN) x = viewport.width - MARGIN - rect.right;
  if (rect.left + x < MARGIN) x = MARGIN - rect.left;

  let y = 0;
  // A panel taller than the viewport cannot fit; pinning its top keeps the start of it readable.
  if (height < viewport.height - 2 * MARGIN) {
    if (rect.bottom > viewport.height - MARGIN) y = viewport.height - MARGIN - rect.bottom;
    if (rect.top + y < MARGIN) y = MARGIN - rect.top;
  } else if (rect.top < MARGIN) {
    y = MARGIN - rect.top;
  }

  const shift = { x: Math.round(x), y: Math.round(y) };
  if (shift.x !== 0 || shift.y !== 0) panel.style.translate = `${shift.x}px ${shift.y}px`;
  return shift;
}

/** Removes `entry` from the open set. Returns whether it was open. */
export function forgetPopover(entry: PopoverEntry | undefined): boolean {
  if (entry === undefined) return false;
  const index = open.indexOf(entry);
  if (index === -1) return false;
  open.splice(index, 1);
  return true;
}

/**
 * Closes `entry` and forgets it. `focus` returns focus to the unit's trigger; a click outside
 * passes `false` so the clicked element keeps focus. An entry that is no longer open is left alone.
 */
export function closePopover(entry: PopoverEntry, focus = false): void {
  if (!forgetPopover(entry)) return;
  entry.close(focus);
}

/**
 * Registers a newly opened panel. Every open panel of another unit closes first, so a footnote
 * note never sits beside an open symbol; with `exclusive`, an earlier panel of the same unit
 * closes too. Returns the entry the unit keeps to close or forget the panel.
 */
export function openPopover(kind: PopoverKind, popover: OpenPopover, exclusive = false): PopoverEntry {
  for (const other of [...open]) {
    if (other.kind === kind && !exclusive) continue;
    closePopover(other);
  }

  const entry: PopoverEntry = { ...popover, kind, exclusive };
  open.push(entry);
  if (entry.panel !== undefined) fitToViewport(entry.panel);
  return entry;
}

/**
 * Closes `entry` when `event` is Escape and it is still open, returning whether it closed. Nothing
 * else is touched: the unit decides whether to prevent the key's own action, and focus is never
 * trapped.
 */
export function escapePopover(event: PopoverEvent, entry: PopoverEntry | undefined): boolean {
  if (event.key !== "Escape" || entry === undefined || !open.includes(entry)) return false;
  closePopover(entry, true);
  return true;
}

/**
 * Closes every open panel that does not contain `target`. A click inside one panel leaves it open
 * and closes the others; focus is never moved.
 */
export function clickPopover(target: unknown): void {
  for (const entry of [...open]) {
    if (!entry.contains(target)) closePopover(entry);
  }
}
