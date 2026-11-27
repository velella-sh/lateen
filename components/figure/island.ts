/*
 * The figure zoom island. The previous and next buttons of a multi-image figure carry `popovertarget`,
 * so they open the next panel without script. The platform then keeps the panel they sit in open
 * underneath (a popover opened from inside another counts as its child), and a previous button that
 * targets a panel already open closes both. This module closes the current panel first and then opens
 * the target, so exactly one panel of the figure is open and both directions work.
 */

/** The buttons that move between the panels of one figure. */
export const NAV_SELECTOR = ".figure-zoom-prev, .figure-zoom-next";

/** The part of a popover panel the island calls. */
export interface Panel {
  hidePopover(): void;
  showPopover(): void;
  querySelector(selector: string): { focus(): void } | null;
}

/** The part of a navigation button the island reads. */
export interface NavButton {
  closest(selector: string): Panel | null;
  getAttribute(name: string): string | null;
  className: string;
  ownerDocument: { getElementById(id: string): Panel | null };
}

/** The part of a click the island reads. */
export interface NavClick {
  target: unknown;
  preventDefault(): void;
}

/** The document the island listens on. */
export interface ZoomDocument {
  addEventListener(type: "click", listener: (event: NavClick) => void): void;
}

/** Handles one click: moves from the panel holding the button to the panel it names. */
export function move(event: NavClick): void {
  const target = event.target as { closest?(selector: string): NavButton | null } | null;
  const button = target?.closest?.(NAV_SELECTOR) ?? null;
  if (button === null) return;
  const from = button.closest(".figure-zoom-panel");
  const to = button.ownerDocument.getElementById(button.getAttribute("popovertarget") ?? "");
  if (from === null || to === null || from === to) return;
  event.preventDefault();
  from.hidePopover();
  to.showPopover();
  to.querySelector(/\bfigure-zoom-prev\b/.test(button.className) ? ".figure-zoom-prev" : ".figure-zoom-next")?.focus();
}

/** Listens once for navigation clicks anywhere in the document. */
export function activate(document: ZoomDocument): void {
  document.addEventListener("click", move);
}
