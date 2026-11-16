/* install-tabs island: remembers the package manager the reader picked and applies it to every group on the site that offers it. The tabs already work without it; every storage call is wrapped, so a blocked store changes nothing. */

export const GROUP_SELECTOR = "[data-install-tabs]";
export const RADIO_SELECTOR = ".install-tabs-radio";

/** localStorage key the chosen package manager is remembered under. */
export const STORAGE_KEY = "lateen-install-tabs";

export interface Radio {
  checked: boolean;
  readonly dataset: { manager?: string };
  addEventListener(type: "change", listener: () => void): void;
}

export interface Group {
  querySelectorAll(selector: string): Iterable<Radio>;
}

export interface Store {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The remembered manager, or `undefined` when nothing is stored, the store is blocked, or it throws. */
export function readChoice(store: Store | undefined): string | undefined {
  try {
    const value = store?.getItem(STORAGE_KEY);
    return typeof value === "string" && value !== "" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** Remembers `name`. Best effort: a store that throws is ignored. */
export function saveChoice(store: Store | undefined, name: string): void {
  try {
    store?.setItem(STORAGE_KEY, name);
  } catch {
    // A blocked store only means the choice is not remembered.
  }
}

/** Checks the radio named `name` in every group that has one; a group without it keeps its own choice. */
export function select(groups: readonly Group[], name: string): void {
  for (const group of groups) {
    const radios = [...group.querySelectorAll(RADIO_SELECTOR)];
    const match = radios.find((radio) => radio.dataset.manager === name);
    if (match !== undefined) for (const radio of radios) radio.checked = radio === match;
  }
}

/** Applies the remembered choice and remembers every change. */
export function activateAll(doc: { querySelectorAll(selector: string): Iterable<Group> }, store: Store | undefined): void {
  const groups = [...doc.querySelectorAll(GROUP_SELECTOR)];
  const remembered = readChoice(store);
  if (remembered !== undefined) select(groups, remembered);
  for (const group of groups) {
    for (const radio of group.querySelectorAll(RADIO_SELECTOR)) {
      radio.addEventListener("change", () => {
        const name = radio.dataset.manager;
        if (!radio.checked || name === undefined) return;
        select(groups, name);
        saveChoice(store, name);
      });
    }
  }
}

const globals = globalThis as unknown as {
  document?: { querySelectorAll(selector: string): Iterable<Group> };
  localStorage?: Store;
};

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) {
  let store: Store | undefined;
  try {
    store = globals.localStorage;
  } catch {
    store = undefined;
  }
  activateAll(globals.document, store);
}
