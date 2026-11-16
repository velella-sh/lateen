/* steps island: adds an optional tick to every step and remembers the ticks in the browser's local
   storage, per page. Progress is text ("2 of 5"). Nothing leaves the browser. Without the island the steps
   are plain numbered content. */

export const ROOT_SELECTOR = "[data-steps]";
export const STEP_SELECTOR = "li[data-step]";

/** The key the ticks of a page are kept under. */
export function storageKey(path: string): string {
  return `lateen:steps:${path}`;
}

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface Node_ {
  className: string;
  textContent: string | null;
  checked?: boolean;
  type?: string;
  hidden?: boolean;
  dataset: Record<string, string | undefined>;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  append(...children: Node_[]): void;
  prepend(...children: Node_[]): void;
  addEventListener(type: "change", listener: () => void): void;
  querySelector(selector: string): Node_ | null;
  querySelectorAll(selector: string): Iterable<Node_>;
}

export type Root = Node_;

export interface Env {
  /** The page's local storage, or undefined when the browser has none. Reads and writes may still throw. */
  storage(): Store | undefined;
  path: string;
  create(tag: string): Node_;
}

/** The step numbers ticked before, or none when the store is missing, blocked, or holds something else. */
export function readTicks(env: Env): Set<number> {
  try {
    const raw = env.storage()?.getItem(storageKey(env.path));
    const parsed: unknown = raw === null || raw === undefined ? [] : JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((n): n is number => Number.isInteger(n)));
  } catch {
    return new Set();
  }
}

/** Saves the ticks; a blocked store changes nothing. */
export function writeTicks(env: Env, ticks: ReadonlySet<number>): void {
  try {
    env.storage()?.setItem(storageKey(env.path), JSON.stringify([...ticks].sort((a, b) => a - b)));
  } catch {
    // A blocked store: the ticks last for this visit only.
  }
}

function fill(template: string | undefined, values: Record<string, string>): string {
  return (template ?? "").replace(/\{(\w+)\}/g, (whole, key: string) => values[key] ?? whole);
}

/** Wires one step list: a checkbox per step and a progress line. */
export function activate(root: Root, env: Env): void {
  const items = [...root.querySelectorAll(STEP_SELECTOR)];
  if (items.length === 0) return;
  const ticks = readTicks(env);
  const total = items.length;

  const progress = env.create("p");
  progress.className = "steps-progress";
  progress.setAttribute("role", "status");
  root.prepend(progress);

  const show = (): void => {
    const done = items.filter((item) => item.dataset.step !== undefined && ticks.has(Number(item.dataset.step))).length;
    progress.textContent = fill(root.dataset.progress, { done: String(done), total: String(total) });
  };

  for (const item of items) {
    const n = Number(item.dataset.step);
    const box = env.create("input");
    box.type = "checkbox";
    box.checked = ticks.has(n);
    box.setAttribute("aria-label", fill(root.dataset.tick, { n: String(n) }));
    const label = env.create("label");
    label.className = "step-tick";
    label.append(box);
    const mark = (): void => {
      if (box.checked) item.setAttribute("data-done", "");
      else item.removeAttribute("data-done");
    };
    mark();
    box.addEventListener("change", () => {
      if (box.checked === true) ticks.add(n);
      else ticks.delete(n);
      mark();
      writeTicks(env, ticks);
      show();
    });
    const number = item.querySelector(".step-number");
    if (number === null) item.prepend(label);
    else number.append(label);
  }
  show();
}

export interface Doc {
  querySelectorAll(selector: string): Iterable<Root>;
  createElement(tag: string): Node_;
  readonly pathname: string;
  localStorage(): Store | undefined;
}

/** Wires every step list on the page. */
export function activateAll(doc: Doc): void {
  const env: Env = { storage: () => doc.localStorage(), path: doc.pathname, create: (tag) => doc.createElement(tag) };
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) activate(root, env);
}

const g = globalThis as unknown as {
  document?: { querySelectorAll(s: string): Iterable<Root>; createElement(t: string): Node_ };
  location?: { pathname: string };
  localStorage?: Store;
};

if (g.document !== undefined && g.location !== undefined) {
  const document = g.document;
  const location = g.location;
  activateAll({
    querySelectorAll: (s) => document.querySelectorAll(s),
    createElement: (t) => document.createElement(t),
    pathname: location.pathname,
    localStorage: () => {
      try {
        return g.localStorage;
      } catch {
        return undefined;
      }
    },
  });
}
