/** Layouts can omit Source mode from both the page and the command palette. */
export interface SourceModeVisibility {
  readonly showSourceMode?: boolean;
}

/** The class source mode puts on the root element; the stylesheet shows the labels under it. */
export const SOURCE_MODE_CLASS = "source-mode";

/** The parts of `Storage` source mode uses (the editor folder), so tests can pass plain objects. */
export interface SourceModeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
