/*
 * Details island: a fragment link can name an id inside a closed disclosure. The browser scrolls a
 * closed block's hidden content nowhere, so this opens the target's disclosure and every closed
 * disclosure around it, then focuses and scrolls to the target. Only the target's own ancestors
 * open; every other disclosure keeps the state the reader left it in. Without this script the page
 * keeps the native disclosure and plain fragment navigation.
 */

/** A disclosure, as the island opens it. */
export interface FragmentDetails {
  open: boolean;
  readonly parentElement: FragmentTarget | null;
  closest(selector: string): FragmentDetails | null;
}

/** One fragment target, as the island touches it. */
export interface FragmentTarget {
  readonly parentElement: FragmentTarget | null;
  closest(selector: string): FragmentDetails | null;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  focus(): void;
  addEventListener(type: "blur", listener: () => void): void;
  removeEventListener(type: "blur", listener: () => void): void;
  scrollIntoView?(): void;
}

/** The document the island reads: the element that holds focus, and targets by id. */
export interface FragmentDocument {
  readonly activeElement: unknown;
  getElementById(id: string): FragmentTarget | null;
}

/** The page address the island reads and listens to. */
export interface FragmentWindow {
  readonly location: { readonly hash: string };
  addEventListener(type: "hashchange", listener: () => void): void;
}

/** The id a fragment hash names, decoded, or undefined when it is empty or malformed. */
export function fragmentId(hash: string): string | undefined {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (raw === "") return undefined;
  try {
    const id = decodeURIComponent(raw).trim();
    return id === "" ? undefined : id;
  } catch {
    return undefined;
  }
}

/**
 * Move focus to `target`. A target the browser already focuses takes it as it is. Any other target
 * gets `tabindex="-1"` only while focus stays inside it, then the attribute goes back to what the
 * page sent, so focusing a heading does not change the page's tab order. A failed focus leaves the
 * target alone.
 */
function focusTarget(target: FragmentTarget, doc: FragmentDocument): void {
  try {
    target.focus();
  } catch {
    return;
  }
  if (doc.activeElement === target) return;

  const previous = target.getAttribute("tabindex");
  const onBlur = (): void => {
    target.removeEventListener("blur", onBlur);
    if (previous === null) target.removeAttribute("tabindex");
    else target.setAttribute("tabindex", previous);
  };
  target.setAttribute("tabindex", previous ?? "-1");
  target.addEventListener("blur", onBlur);
  try {
    target.focus();
  } catch {
    // The tag stays focusable for the next fragment; nothing else to undo.
  }
}

/**
 * Opens the closed disclosures around the id `hash` names, then focuses and scrolls to it. Returns
 * whether the hash named a target on the page. A missing or empty fragment changes nothing.
 */
export function reveal(doc: FragmentDocument, hash: string): boolean {
  const id = fragmentId(hash);
  if (id === undefined) return false;
  const target = doc.getElementById(id);
  if (target === null) return false;

  for (let node = target.closest("details"); node !== null; node = node.parentElement?.closest("details") ?? null) {
    node.open = true;
  }
  target.scrollIntoView?.();
  focusTarget(target, doc);
  return true;
}

/** Reveals the current fragment on load and on every hash change. */
export function watch(doc: FragmentDocument, win: FragmentWindow): void {
  const apply = (): void => {
    reveal(doc, win.location.hash);
  };
  apply();
  win.addEventListener("hashchange", apply);
}

/** The browser globals the island needs, without pulling DOM types into the theme's typecheck. */
const globals = globalThis as unknown as { document?: FragmentDocument; window?: FragmentWindow };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document !== undefined && globals.window !== undefined) {
  watch(globals.document, globals.window);
}
