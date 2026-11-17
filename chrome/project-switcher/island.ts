/*
 * Project switcher island: the disclosure works without a script, so this module only adds the
 * conveniences a menu of links expects. Escape closes it and returns focus to the summary; the arrow
 * keys move through the links and wrap at either end; a click outside and a focus that leaves close
 * it. Focus is never trapped: Tab always takes the reader onward.
 */

/** The disclosure element as the island reads and writes it. */
export interface SwitcherDisclosure {
  open: boolean;
  contains(node: unknown): boolean;
  addEventListener(type: "keydown", listener: (event: SwitcherKeyEvent) => void): void;
  addEventListener(type: "focusout", listener: (event: SwitcherFocusEvent) => void): void;
}

/** A control the island moves focus to. */
export interface SwitcherFocusable {
  focus(): void;
}

/** A keyboard event as the switcher reads it. */
export interface SwitcherKeyEvent {
  key?: string;
  target: unknown;
  preventDefault(): void;
}

/** A focus event as the switcher reads it; `relatedTarget` is where focus went, when the browser says. */
export interface SwitcherFocusEvent {
  relatedTarget?: unknown;
}

/** A click as the switcher reads it. */
export interface SwitcherClickEvent {
  target: unknown;
}

/** The document the island listens on for a click outside the disclosure. */
export interface SwitcherDocument {
  addEventListener(type: "click", listener: (event: SwitcherClickEvent) => void): void;
}

/** The elements the island wires together. */
export interface SwitcherParts {
  /** The native `<details>` that holds the summary and the links. */
  disclosure: SwitcherDisclosure;
  /** The `<summary>`: the control Escape returns focus to. */
  summary: SwitcherFocusable;
  /** Every project link, in network order. */
  links: readonly SwitcherFocusable[];
}

/** Everything the island reads from the world; the browser passes its document, tests a fake. */
export interface SwitcherEnv {
  /** The document whose clicks decide whether a press landed outside the disclosure. */
  readonly document?: SwitcherDocument | undefined;
  /** Whether focus is still inside the disclosure, for browsers that report no `relatedTarget`. */
  readonly hasFocus?: ((node: unknown) => boolean) | undefined;
}

/** The link the arrow key moves to, wrapping at either end. A focus outside the links enters at the near end. */
function nextLink(links: readonly SwitcherFocusable[], target: unknown, step: number): SwitcherFocusable | undefined {
  if (links.length === 0) return undefined;
  const at = links.indexOf(target as SwitcherFocusable);
  if (at === -1) return step > 0 ? links[0] : links[links.length - 1];
  return links[(at + step + links.length) % links.length];
}

/** Wires the disclosure's keys, its focus loss, and clicks outside it. */
export function activate({ disclosure, summary, links }: SwitcherParts, env: SwitcherEnv = {}): void {
  disclosure.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!disclosure.open) return;
      event.preventDefault();
      disclosure.open = false;
      summary.focus();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    if (!disclosure.open) return;
    const next = nextLink(links, event.target, event.key === "ArrowDown" ? 1 : -1);
    if (next === undefined) return;
    event.preventDefault();
    next.focus();
  });

  disclosure.addEventListener("focusout", (event) => {
    const next = event.relatedTarget;
    if (next !== null && next !== undefined) {
      if (disclosure.contains(next)) return;
    } else if (env.hasFocus?.(disclosure) === true) {
      return;
    }
    if (disclosure.open) disclosure.open = false;
  });

  env.document?.addEventListener("click", (event) => {
    if (disclosure.open && !disclosure.contains(event.target)) disclosure.open = false;
  });
}
