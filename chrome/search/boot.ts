/*
 * The browser bootstrap: finds the dialog and its parts in the page, builds the ask agent, activates
 * the dialog, and registers the keyboard shortcut. Nothing happens in a runtime without a document.
 */

import { activateShortcuts, type ShortcutEvent } from "./shortcut.ts";
import { activateAskAgent, parseAskConfig, type AskDocument, type AskElement, type AskResult } from "../ask-agent/client.ts";
import { browserFetch } from "../copy-markdown/island.ts";
import { parsePalette } from "./palette.ts";
import type { SearchElement, SearchNode, SearchResults } from "./render.ts";
import { langFrom, messagesFrom, type MessageSource } from "./messages.ts";
import { loadIndex } from "./loader.ts";
import { activate } from "./activate.ts";
import type {
  SearchButton,
  SearchClose,
  SearchDialog,
  SearchInput,
  SearchPaletteSource,
  SearchParts,
  SearchStatus,
} from "./types.ts";

// The island runs in a browser; the theme's tsconfig has no DOM lib, so these are the globals it needs.
interface BrowserDocument {
  querySelector(selector: string): unknown;
  createElement(tag: string): SearchElement;
  createTextNode(text: string): SearchNode;
  addEventListener(type: "keydown", listener: (event: ShortcutEvent) => void): void;
}
declare const document: BrowserDocument;
declare const navigator: {
  readonly platform: string;
  readonly clipboard?: { writeText(text: string): Promise<void> } | undefined;
};
declare const location: { readonly search: string };

/** Watches the results page's list for the rows its inline script draws. */
declare const MutationObserver: new (callback: () => void) => {
  observe(target: unknown, options: { readonly childList: boolean }): void;
};

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (typeof document !== "undefined") {
  const dialog = document.querySelector("[data-search]");
  const button = document.querySelector("[data-search-open]");
  // The results page carries the same attributes as the dialog; only the dialog's copies are ours.
  const within = (selector: string): unknown =>
    (dialog as { querySelector(selector: string): unknown } | null)?.querySelector(selector) ?? null;
  const close = within("[data-search-close]");
  const clear = within("[data-search-clear]");
  const retry = within("[data-search-retry]");
  const input = within("[data-search-input]");
  const results = within("[data-search-results]");
  const status = within("[data-search-status]");
  const all = within("[data-search-all]");
  const palette = within("[data-palette-actions]") as SearchPaletteSource | null;
  const askRoot = within("[data-ask-agent]");
  const askSource = within("[data-ask-agent-config]") as SearchPaletteSource | null;
  if (dialog && button && close && input && results && status) {
    const source = dialog as unknown as MessageSource;
    const messages = messagesFrom(source);
    const askAgent =
      askRoot === null || askRoot === undefined
        ? undefined
        : activateAskAgent({
            document: document as unknown as AskDocument,
            root: askRoot as AskElement,
            config: parseAskConfig(askSource?.textContent ?? null),
            clipboard: navigator.clipboard,
            fetchText: browserFetch,
            lang: langFrom(source),
          });
    activate(
      {
        dialog: dialog as SearchDialog,
        button: button as SearchButton,
        close: close as SearchClose,
        input: input as SearchInput,
        results: results as SearchResults,
        status: status as SearchStatus,
        clear: (clear ?? undefined) as SearchParts["clear"],
        retry: (retry ?? undefined) as SearchParts["retry"],
        all: (all ?? undefined) as SearchParts["all"],
      },
      {
        document,
        load: loadIndex,
        palette: parsePalette(palette?.textContent ?? null, messages.actions),
        lang: langFrom(source),
        messages,
        scope: new URLSearchParams(location.search).get("scope"),
        ask: askAgent?.open,
      },
    );
    if (askAgent !== undefined) {
      (dialog as SearchDialog).addEventListener("close", () => askAgent.hide());
    }
    // The search results page draws its own list; the ask section reads that list when the page has
    // one, so the dialog's empty list is not mistaken for it.
    const section = document.querySelector("[data-ask-agent-section]");
    const pageList =
      (document.querySelector("[data-search-page]") as { querySelector(selector: string): unknown } | null)
        ?.querySelector("[data-search-results]") ?? null;
    const askList = (pageList ?? results) as { querySelectorAll(selector: string): Iterable<unknown> };
    if (askAgent !== undefined && section !== null && section !== undefined) {
      const askResults = (): AskResult[] => {
        const links = askList.querySelectorAll("a");
        const found: AskResult[] = [];
        for (const link of links) {
          const anchor = link as {
            getAttribute(name: string): string | null;
            querySelector(selector: string): { textContent: string | null } | null;
          };
          const url = anchor.getAttribute("href");
          if (url === null || url === "") continue;
          const title = anchor.querySelector(".search-results-title")?.textContent ?? undefined;
          found.push({ url, ...(title === undefined ? {} : { title }) });
        }
        return found;
      };
      const fill = (): void => {
        const query = new URLSearchParams(location.search).get("q") ?? "";
        const found = askResults();
        if (query.trim() === "" || found.length === 0) return;
        askAgent.open(query, found, section as AskElement, false);
      };
      new MutationObserver(fill).observe(askList, { childList: true });
      fill();
    }
    // ⌘K/Ctrl+K presses this button from anywhere, exactly as a pointer would.
    activateShortcuts(
      { button: button as unknown as SearchButton },
      { platform: navigator.platform, addEventListener: (type, listener) => document.addEventListener(type, listener) },
    );
  }
}
