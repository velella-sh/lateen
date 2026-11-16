/** localStorage key for the reader's source-mode choice: `on` or `off`. One choice for the whole site. */
export const SOURCE_MODE_KEY = "lateen-source-mode";

/** The class source mode puts on the root element; the stylesheet shows the labels under it. */
export const SOURCE_MODE_CLASS = "source-mode";

/** The unmodified key that toggles source mode; unused by the browse-mode quick keys of NVDA and JAWS. */
export const SOURCE_MODE_KEY_CHAR = "y";

/** The parts of `Storage` source mode uses, so tests can pass plain objects. */
export interface SourceModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The saved choice; storage that is missing, refusing, or holding anything else reads as off. */
export function readSourceMode(storage: SourceModeStorage | undefined): boolean {
  try {
    return storage?.getItem(SOURCE_MODE_KEY) === "on";
  } catch {
    return false;
  }
}

/** Remembers the choice. Storage may throw (private mode); the choice still applies to this page view. */
export function saveSourceMode(storage: SourceModeStorage | undefined, on: boolean): void {
  try {
    storage?.setItem(SOURCE_MODE_KEY, on ? "on" : "off");
  } catch {
    /* storage is unavailable: the choice applies to this page view only */
  }
}
