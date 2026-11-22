/*
 * The browser's action handlers for the command palette: theme, copy, source mode, and section jump.
 * Input/output only; the dialog's state and DOM stay in `activate.ts`.
 */

import { THEME_KEY } from "../theme-toggle/key.ts";
import { fetchText, type Fetcher } from "../../src/fetch.ts";
import type { PaletteHandlers } from "./types.ts";

/** What the page's `<html>` needs for a theme change. */
interface ThemeRoot {
  setAttribute(name: string, value: string): void;
}

/** The heading a section action scrolls to and focuses. */
interface SectionTarget {
  setAttribute?(name: string, value: string): void;
  scrollIntoView?(options: { readonly block: "start" }): void;
  focus?(): void;
}

/** The browser globals the action handlers use; tests never call these. */
interface PaletteGlobals {
  readonly document?: {
    readonly documentElement?: ThemeRoot;
    getElementById?(id: string): SectionTarget | null;
    querySelector?(selector: string): { click?(): void } | null;
  };
  readonly localStorage?: { setItem(key: string, value: string): void };
  readonly navigator?: { readonly clipboard?: { writeText(text: string): Promise<void> } };
  readonly fetch?: Fetcher;
}

/** The browser's handlers: the theme key, the clipboard and twin fetch, and the heading jump. */
export function liveHandlers(globals: PaletteGlobals = globalThis as unknown as PaletteGlobals): PaletteHandlers {
  return {
    theme(choice) {
      // Use the active toggle when it can make this change, so its icon and label update too.
      const toggle = globals.document?.querySelector?.(
        `[data-theme-toggle][data-choice]:not([data-choice="${choice}"]) .theme-toggle-button`,
      );
      if (toggle?.click) {
        toggle.click();
        return;
      }
      try {
        globals.localStorage?.setItem(THEME_KEY, choice);
      } catch {
        /* storage is unavailable: apply the choice to this page view only */
      }
      globals.document?.documentElement?.setAttribute("data-theme", choice);
    },
    copy(url) {
      const clipboard = globals.navigator?.clipboard;
      if (clipboard === undefined) return Promise.resolve();
      return fetchText(globals.fetch, url).then((markdown) => clipboard.writeText(markdown));
    },
    source() {
      globals.document?.querySelector?.("[data-source-mode] .source-mode-button")?.click?.();
    },
    section(id) {
      const heading = globals.document?.getElementById?.(id);
      if (heading === null || heading === undefined) return;
      heading.setAttribute?.("tabindex", "-1");
      heading.scrollIntoView?.({ block: "start" });
      heading.focus?.();
    },
  };
}
