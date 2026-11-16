/* Embed code island: turns the stacked panels into tabs, lets the reader choose a variant, and loads the preview only on request. Without this script every panel is visible and a link opens the embedded page. */

/** Selector for the root (`data-embed-code` in `index.ts`). */
export const ROOT_SELECTOR = "[data-embed-code]";
export const PANEL_SELECTOR = "[data-embed-panel]";
export const TABLIST_SELECTOR = ".embed-code-tablist";
export const VARIANTS_SELECTOR = "[data-embed-variants]";
export const SELECT_SELECTOR = "[data-embed-variant-select]";
export const VARIANT_SELECTOR = "[data-embed-variant]";
export const PREVIEW_SELECTOR = "[data-embed-preview]";
export const PREVIEW_LOAD_SELECTOR = "[data-embed-preview-load]";
export const LINK_SELECTOR = ".embed-code-preview-link";

/** Class on the preview frame. */
export const FRAME_CLASS = "embed-code-frame";

/** An element the island touches. */
export interface El {
  hidden: boolean;
  id: string;
  className: string;
  value?: string;
  textContent: string | null;
  dataset: Record<string, string | undefined>;
  querySelector(selector: string): El | null;
  querySelectorAll(selector: string): Iterable<El>;
  appendChild(child: El): void;
  removeChild(child: El): void;
  setAttribute(name: string, value: string): void;
  addEventListener(type: string, listener: (event?: { key?: string; preventDefault?: () => void }) => void): void;
  focus?(): void;
}

/** The frame the preview inserts; the browser supplies an iframe, tests a fake. */
export interface Frame extends El {
  src: string;
  title: string;
  loading: string;
  height: string;
  width: string;
  sandbox: { value: string } | string;
}

/** What the island reads from the document. */
export interface Env {
  createElement(tag: string): El;
  createFrame(): Frame;
}

/** The state of one root: which format and which variant show, and the frame if the reader loaded one. */
interface State {
  tab: string;
  variant: number;
  frame: Frame | undefined;
}

function setTab(root: El, state: State, tabs: El[], panels: El[], id: string): void {
  state.tab = id;
  for (const panel of panels) panel.hidden = panel.dataset.embedPanel !== id;
  for (const tab of tabs) {
    const active = tab.dataset.tab === id;
    tab.setAttribute("aria-selected", active ? "true" : "false");
    tab.setAttribute("tabindex", active ? "0" : "-1");
  }
}

/** Shows one variant's frame code and, if a preview is loaded, points it at that variant. */
export function chooseVariant(root: El, state: State, index: number): void {
  state.variant = index;
  let chosen: El | undefined;
  for (const variant of root.querySelectorAll(VARIANT_SELECTOR)) {
    const here = variant.dataset.embedVariant === String(index);
    variant.hidden = !here;
    if (here) chosen = variant;
  }
  const frame = state.frame;
  if (frame !== undefined && chosen !== undefined) {
    frame.src = chosen.dataset.src ?? frame.src;
    frame.height = chosen.dataset.height ?? frame.height;
  }
  const link = root.querySelector(LINK_SELECTOR);
  if (link !== null && chosen?.dataset.src !== undefined) link.setAttribute("href", chosen.dataset.src);
}

/** Inserts the preview frame for the current variant. Does nothing if one is already there. */
export function loadPreview(root: El, state: State, env: Env): void {
  if (state.frame !== undefined) return;
  const preview = root.querySelector(PREVIEW_SELECTOR);
  if (preview === null) return;
  let chosen: El | undefined;
  for (const variant of root.querySelectorAll(VARIANT_SELECTOR)) {
    if (variant.dataset.embedVariant === String(state.variant)) chosen = variant;
  }
  const src = chosen?.dataset.src;
  if (src === undefined || !src.startsWith("https://")) return;
  const frame = env.createFrame();
  frame.className = FRAME_CLASS;
  frame.src = src;
  frame.title = preview.dataset.title ?? "";
  frame.width = "100%";
  frame.height = chosen?.dataset.height ?? "360";
  frame.loading = "lazy";
  frame.setAttribute("sandbox", root.dataset.sandbox ?? "");
  state.frame = frame;
  preview.appendChild(frame);
  const button = preview.querySelector(PREVIEW_LOAD_SELECTOR);
  if (button !== null) button.hidden = true;
}

/** Enhances one root: tabs, the variant choice, and the preview button. */
export function activate(root: El, env: Env): void {
  const state: State = { tab: "frame", variant: 0, frame: undefined };
  const list = root.querySelector(TABLIST_SELECTOR);
  const panels = [...root.querySelectorAll(PANEL_SELECTOR)];
  if (list !== null) {
    const tabs: El[] = [];
    for (const panel of panels) {
      const id = panel.dataset.embedPanel ?? "";
      const title = panel.querySelector("h3");
      const tab = env.createElement("button");
      tab.dataset.tab = id;
      tab.id = `embed-code-tab-${id}`;
      tab.textContent = title?.textContent ?? id;
      tab.setAttribute("type", "button");
      tab.setAttribute("role", "tab");
      tab.setAttribute("aria-controls", panel.id);
      panel.setAttribute("role", "tabpanel");
      panel.setAttribute("aria-labelledby", tab.id);
      if (title !== null) title.hidden = true;
      tab.addEventListener("click", () => setTab(root, state, tabs, panels, id));
      tab.addEventListener("keydown", (event) => {
        const step = event?.key === "ArrowRight" ? 1 : event?.key === "ArrowLeft" ? -1 : 0;
        if (step === 0) return;
        event?.preventDefault?.();
        const at = tabs.indexOf(tab);
        const next = tabs[(at + step + tabs.length) % tabs.length];
        if (next === undefined) return;
        setTab(root, state, tabs, panels, next.dataset.tab ?? id);
        next.focus?.();
      });
      tabs.push(tab);
      list.appendChild(tab);
    }
    list.hidden = false;
    setTab(root, state, tabs, panels, "frame");
  }

  const variants = root.querySelector(VARIANTS_SELECTOR);
  const select = root.querySelector(SELECT_SELECTOR);
  if (variants !== null && select !== null) {
    variants.hidden = false;
    select.addEventListener("change", () => chooseVariant(root, state, Number(select.value ?? "0")));
    chooseVariant(root, state, 0);
  }

  const button = root.querySelector(PREVIEW_LOAD_SELECTOR);
  if (button !== null) {
    button.hidden = false;
    button.addEventListener("click", () => loadPreview(root, state, env));
  }
}

/** Enhances every embed code on the page. */
export function activateAll(doc: { querySelectorAll(selector: string): Iterable<El> }, env: Env): void {
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) activate(root, env);
}

const globals = globalThis as unknown as {
  document?: { querySelectorAll(selector: string): Iterable<El>; createElement(tag: string): El & Frame };
};
const doc = globals.document;

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (doc !== undefined) {
  activateAll(doc, { createElement: (tag) => doc.createElement(tag), createFrame: () => doc.createElement("iframe") });
}
