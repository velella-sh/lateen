/*
 * Search dialog and command palette: loads the Pagefind index on first open, runs the query, groups
 * page results by section, groups the page's actions under "Actions", and keeps keyboard focus inside
 * the dialog. No index is fetched until the reader opens search, so a page that never searches
 * downloads no search JavaScript data.
 *
 * The field is a combobox and the list is the listbox it controls. Every row this module
 * produces puts its option role on its own control, so a keyboard, a pointer, and assistive tech all meet
 * one element, and the active option is the control the field names in `aria-activedescendant`: the arrow
 * keys, a pointer entering a row, and a redraw all move that one active option, and focus stays in the
 * field while the dialog is open. A redraw re-resolves the active option by key, so the field can never
 * point at a row the new query removed.
 *
 * The action list arrives as inert JSON from `chrome/command-palette/`; this module parses it,
 * filters it on the same query as the page results, and runs the chosen action. The module and its
 * client-only helper (`shortcut.ts`) import no server module, so they are safe to serve as an island.
 *
 * Module boundaries: the pure modules below own their own exports, and callers — tests included —
 * import them directly. `client.ts` keeps only the activation path and the browser bootstrap.
 *
 * - Option model (pure, `options.ts`): the row types (`OptionKind`, `SearchRecord`, `ResultGroup`,
 *   `OptionRow`, `OptionGroup`, `OptionList`, `OptionLabels`, `AskOption`), grouping (`sectionOf`,
 *   `groupBySection`), positional ids (`optionId`, `groupId`), duplicate-safe keys (`resultKey`,
 *   `actionKey`, `askKey`), the link guard `safeHref`, `wordCount`, and `optionList`, which assembles
 *   one query's rows. Active-row resolution is `activeIndexOf`, the key-to-index lookup `draw` runs
 *   after a redraw. Depends only on `src/search/merge.ts` and the palette's data types.
 * - DOM rendering (`render.ts`): `renderOptions` and the `*Node`/`*Content` helpers turn an
 *   `OptionList` into elements through the `SearchDocument`/`SearchElement` interfaces
 *   (`RenderedOption`, `OptionRender`); they make no query or identity decisions of their own.
 * - Palette validation (pure, `palette.ts`): `parsePalette`, `isPaletteRun`, and their private guards
 *   read the inert JSON, and `matchesAction`/`filterActions` filter it on the query; every malformed
 *   shape falls back to an empty palette.
 * - Localization (pure, `messages.ts`): `SearchMessages`, `MESSAGES`, `PLURAL_CATEGORIES`,
 *   `pluralCategory`, `emptyMessage`, `countMessage`, `fillMessage`, `messagesFrom`, `langFrom` —
 *   the page language's strings and CLDR plural rules, read from the dialog's `data-search-*`
 *   attributes.
 * - Loader (`loader.ts`): `indexUrl`, `loadIndex`, the `PagefindApi`/`SearchHit` types, and
 *   `createIndexLoader`, which owns the once-only load, its shared in-flight promise, and its retry;
 *   `begin` inside `activate` only decides what to announce.
 * - Activation: `activate`, `trap`, `liveHandlers`, the all-results link
 *   (`resultsHref`), and the browser bootstrap at the bottom wire the parts together; this is the
 *   only boundary that touches dialog state, focus, and event listeners. `activate` is idempotent
 *   per dialog and returns a teardown that removes every listener it attached.
 *
 * Dependencies point one way — activation → rendering / loader / localization → option model /
 * palette validation — and the pure modules never import back, so a split introduces no cycles.
 */

import type { PaletteAction, PalettePayload, PaletteRun, ThemeChoice } from "../command-palette/actions.ts";
import { THEME_KEY } from "../theme-toggle/key.ts";
import { withBase } from "../../src/url.ts";
import { fetchText, type Fetcher } from "../../src/fetch.ts";
import { activateShortcuts, type ShortcutEvent } from "./shortcut.ts";
import { activateAskAgent, parseAskConfig, type AskDocument, type AskElement, type AskResult } from "../ask-agent/client.ts";
import { browserFetch } from "../copy-markdown/island.ts";
import {
  activeIndexOf,
  optionList,
  wordCount,
  type SearchRecord,
} from "./options.ts";
import { filterActions, parsePalette } from "./palette.ts";
import {
  renderOptions,
  type RenderedOption,
  type SearchDocument,
  type SearchElement,
  type SearchNode,
  type SearchResults,
} from "./render.ts";
import {
  countMessage,
  emptyMessage,
  fillMessage,
  langFrom,
  MESSAGES,
  messagesFrom,
  type MessageSource,
  type SearchMessages,
} from "./messages.ts";
import { createIndexLoader, indexUrl, loadIndex, type PagefindApi } from "./loader.ts";

/** The path of the dedicated search page the all-results link opens. */
export const SEARCH_PAGE_PATH = "/search/";

/** The address of the search page for `query`, carrying the current `scope` when the page has one. */
export function resultsHref(query: string, scope?: string | null, base = ""): string {
  const params = new URLSearchParams({ q: query });
  if (scope !== undefined && scope !== null && scope !== "") params.set("scope", scope);
  return `${withBase(base, SEARCH_PAGE_PATH)}?${params.toString()}`;
}

export { THEME_KEY };

/** Most results shown for one query; Pagefind ranks them, and the top of the list is what a reader wants. */
export const RESULT_LIMIT = 20;

/** The header's search button: `client.ts` reveals it and returns focus to it when the dialog closes. */
export interface SearchButton {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  addEventListener(type: "click", listener: () => void): void;
  removeEventListener?(type: "click", listener: () => void): void;
  click(): void;
  focus(): void;
}

/** The dialog's close button; it has the same shape as the search button. */
export type SearchClose = SearchButton;

/** A control the dialog reveals only while it can act: the field's clear button and the retry action. */
export interface SearchAction {
  hidden: boolean;
  disabled: boolean;
  addEventListener(type: "click", listener: () => void): void;
  removeEventListener?(type: "click", listener: () => void): void;
}

/** The all-results link: hidden and without an href until the field holds a query. */
export interface SearchLink {
  hidden: boolean;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
}

/**
 * The query field. It is the combobox, so it carries the popup's state: `aria-expanded` while the
 * dialog is open, and the active option in `aria-activedescendant`. That attribute is removed rather
 * than emptied when no row is active, because a reference to a row that is not there would dangle.
 */
export interface SearchInput {
  value: string;
  focus(): void;
  setAttribute(name: string, value: string): void;
  removeAttribute?(name: string): void;
  addEventListener(type: "input", listener: () => void): void;
  removeEventListener?(type: "input", listener: () => void): void;
}

/** Anything in the dialog that can take keyboard focus, for the focus trap. */
export interface SearchFocusable {
  focus(): void;
}

/** The status region results and failures are announced on. */
export interface SearchStatus {
  textContent: string | null;
}

/** The inert JSON `chrome/command-palette/` writes into the dialog. */
export interface SearchPaletteSource {
  textContent: string | null;
}

/** What running one action does; the browser supplies working versions, tests inject spies. */
export interface PaletteHandlers {
  theme?(choice: ThemeChoice): void;
  copy?(url: string): void | Promise<void>;
  section?(id: string): void;
  source?(): void;
}

/** A keyboard or dialog event as the dialog reads it. */
export interface SearchEvent {
  readonly key?: string | undefined;
  readonly shiftKey?: boolean | undefined;
  readonly isComposing?: boolean | undefined;
  readonly target?: unknown;
  preventDefault(): void;
}

/** The `<dialog>` element as the script touches it. */
export interface SearchDialog {
  readonly open: boolean;
  hidden: boolean;
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  showModal(): void;
  close(): void;
  querySelectorAll(selector: string): Iterable<SearchFocusable>;
  addEventListener(type: string, listener: (event: SearchEvent) => void): void;
  removeEventListener?(type: string, listener: (event: SearchEvent) => void): void;
}

/** The elements the island wires together. */
export interface SearchParts {
  dialog: SearchDialog;
  button: SearchButton;
  close: SearchClose;
  input: SearchInput;
  results: SearchResults;
  status: SearchStatus;
  /** The command palette's JSON script, when the page carries one. */
  palette?: SearchPaletteSource | undefined;
  /** The field's clear button; it appears only while the field holds text. */
  clear?: SearchAction | undefined;
  /** The retry action; it appears only after an index load failed, and only until one succeeds. */
  retry?: SearchAction | undefined;
  /** The link to the dedicated search page, which follows the field's query. */
  all?: SearchLink | undefined;
}

/** Everything the island reads from the world; tests pass fakes, the browser supplies its own. */
export interface SearchEnv {
  document: SearchDocument;
  load(url: string): Promise<PagefindApi>;
  /** The action payload; the island parses it from `parts.palette`, tests pass it directly. */
  palette?: PalettePayload | undefined;
  /** How actions run; the island uses `liveHandlers()`, tests inject spies. */
  handlers?: PaletteHandlers | undefined;
  /** The page language, which chooses the count's plural category. */
  lang?: string | undefined;
  /** The page language's messages; the island reads them from the dialog's attributes. */
  messages?: SearchMessages | undefined;
  /** The current `scope` query parameter, kept on the all-results link. */
  scope?: string | null | undefined;
  /** Opens the ask panel with the question and the results the dialog currently shows. */
  ask?: ((question: string, records: readonly SearchRecord[]) => void) | undefined;
}

/**
 * What can take keyboard focus inside the dialog. An option row is not on the list: a combobox keeps
 * focus in its own field and points at a row instead, and every row's control carries `tabindex="-1"`.
 */
const FOCUSABLE = [
  "a[href]:not([tabindex='-1'])",
  "button:not([disabled]):not([tabindex='-1'])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

/**
 * Keeps Tab and Shift+Tab inside the dialog: past the last control focus wraps to the first, and before
 * the first it wraps to the last. A focus that has left the dialog returns to its first control.
 */
export function trap(dialog: SearchDialog, event: SearchEvent): void {
  if (event.key !== "Tab") return;
  const items = [...dialog.querySelectorAll(FOCUSABLE)];
  const first = items[0];
  const last = items[items.length - 1];
  if (first === undefined || last === undefined) {
    event.preventDefault();
    return;
  }
  const inside = items.includes(event.target as SearchFocusable);
  if (event.shiftKey === true && (!inside || event.target === first)) {
    event.preventDefault();
    last.focus();
  } else if (event.shiftKey !== true && (!inside || event.target === last)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Anything the activation attaches a listener to. Removal is optional: in the browser every
 * attachment carries the activation's `AbortSignal`, so teardown is the abort, and a target without
 * `removeEventListener` still goes quiet; the explicit removal below stays as the fallback for hosts
 * whose listeners ignore options, and every listener also checks the activation's live flag before it
 * acts. The button, action, and field controls take no event argument; they are cast to this shape at
 * the call sites, and their listeners simply ignore it.
 */
interface Listenable {
  addEventListener(type: string, listener: (event: SearchEvent) => void, options?: { signal?: AbortSignal }): void;
  removeEventListener?(type: string, listener: (event: SearchEvent) => void): void;
}

/**
 * The row or control under a pointer or click. The list's one listener reads the selector the event
 * landed in, so no row carries a listener of its own.
 */
interface RowTarget {
  closest(selector: string): RowTarget | null;
  getAttribute(name: string): string | null;
}

/** The element under an event that matches `selector`, if any. */
function closestIn(event: SearchEvent, selector: string): RowTarget | null {
  const target = event.target as { closest?(selector: string): RowTarget | null } | undefined;
  return target?.closest?.(selector) ?? null;
}

/** Each dialog's current wiring, so initializing it again replaces the old one instead of stacking. */
const activations = new WeakMap<SearchDialog, () => void>();

/**
 * Reveals the search button and wires the dialog: the button opens it, the index loads on that first
 * open only, typing redraws the options, the arrow keys move the active option, Enter runs or opens it,
 * Escape closes, and Tab stays inside. Focus belongs to the field from the moment the dialog opens
 * until it closes, so the active option is the only thing that moves. The DOM is touched only through
 * the small interfaces above, so tests need no browser.
 *
 * Setup and teardown are idempotent: activating the same dialog again first tears down the previous
 * wiring, so no keyboard, pointer, input, or dialog listener is ever attached twice, and the returned
 * teardown removes every listener this activation attached (and may be called more than once).
 */
export function activate(parts: SearchParts, env: SearchEnv): () => void {
  // One activation resolves its dialog, field, list, status, and controls once; every redraw reuses
  // these references and the site base instead of querying the root or the dialog again.
  const { dialog, button, close, input, results, status, clear, retry, all } = parts;
  // A repeated initialization replaces the previous wiring rather than doubling every listener.
  activations.get(dialog)?.();
  const base = dialog.getAttribute("data-base") ?? "";
  const messages = env.messages ?? MESSAGES;
  const lang = env.lang ?? "en";
  const palette = env.palette ?? parsePalette(parts.palette?.textContent ?? null, messages.actions);
  const actions = palette.actions;
  const handlers = env.handlers ?? liveHandlers();
  const index = createIndexLoader(env.load);
  let sequence = 0;
  // A section jump is a move inside the page: the close must not pull focus back to the search button.
  let returnFocus = true;
  // The list as drawn now, and which of its rows the field points at. `-1` is no active option.
  let options: readonly RenderedOption[] = [];
  let active = -1;
  // The row the pointer last entered, so crossing a row's own children names it once.
  let hoveredRow: RowTarget | null = null;
  // The records behind the rows on screen, so the ask panel names the pages the reader is looking at.
  let lastRecords: readonly SearchRecord[] = [];
  // While false, every listener and continuation this activation owns is inert, even on a target
  // that cannot remove listeners; teardown flips it once.
  let live = true;
  // Teardown aborts this signal, which detaches every attachment the browser honors; the explicit
  // removals below cover targets that ignore options.
  const lifecycle = new AbortController();
  const removals: Array<() => void> = [];

  /** Attaches one listener that goes quiet at teardown, and remembers how to remove it. */
  const attach = (target: Listenable, type: string, listener: (event: SearchEvent) => void): void => {
    const guarded = (event: SearchEvent): void => {
      if (live) listener(event);
    };
    target.addEventListener(type, guarded, { signal: lifecycle.signal });
    removals.push(() => target.removeEventListener?.(type, guarded));
  };

  dialog.hidden = false;
  button.hidden = false;
  button.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-expanded", "false");

  /** Runs one action in the browser; a copy result is announced on the status region. */
  const execute = (command: PaletteRun): void => {
    if (!live) return;
    if (command.kind === "theme") {
      handlers.theme?.(command.choice);
      return;
    }
    if (command.kind === "copy") {
      const copied = handlers.copy?.(command.url);
      if (copied !== undefined && typeof copied.then === "function") {
        copied.then(
          () => {
            status.textContent = messages.copied;
          },
          () => {
            status.textContent = messages.copyFailed;
          },
        );
      }
      return;
    }
    if (command.kind === "source") {
      // Source mode is the switch's own: the palette presses it, so the button, class, storage, and
      // announcement stay one code path.
      dialog.close();
      handlers.source?.();
      return;
    }
    // The heading is where the reader is going, so it keeps focus: the close handler must not take it
    // back to the search button, whether the browser fires `close` during `close()` or after it.
    returnFocus = false;
    dialog.close();
    handlers.section?.(command.id);
  };

  /**
   * Makes the row at `index` the active option, or clears the active option when `index` has no row. A
   * key, a pointer, and a redraw all arrive here, so what a reader sees and what assistive tech reads
   * are the same row: one selection, one id reference.
   */
  const markActive = (index: number, scroll = true): void => {
    if (!live) return;
    const current = options[active];
    const next = options[index];
    if (current !== undefined && current !== next) current.element.setAttribute("aria-selected", "false");
    if (next === undefined) {
      active = -1;
      // Nothing is selected: the attribute goes rather than naming a row that is not there.
      input.removeAttribute?.("aria-activedescendant");
      return;
    }
    active = index;
    next.element.setAttribute("aria-selected", "true");
    input.setAttribute("aria-activedescendant", next.id);
    if (scroll) next.element.scrollIntoView?.({ block: "nearest" });
  };

  /** Draws the page results and the matched actions, then puts the active option back where it was. */
  const draw = (records: readonly SearchRecord[], matched: readonly PaletteAction[], previousKey?: string): void => {
    if (!live) return;
    const key = options[active]?.key ?? previousKey;
    lastRecords = records;
    const question = input.value.trim();
    const askHandler = env.ask;
    const ask =
      askHandler !== undefined && wordCount(question) >= 2
        ? { question, label: fillMessage(messages.askLabel, { query: question }), hint: messages.askHint }
        : undefined;
    const list = optionList(
      records,
      matched,
      { otherSection: messages.otherSection, actionsLabel: palette.label, askHeading: messages.askHeading },
      ask,
    );
    options = renderOptions(results, list, {
      doc: env.document,
      run: execute,
      ...(askHandler === undefined
        ? {}
        : {
            ask: (asked: string) => {
              markActive(-1);
              askHandler(asked, lastRecords);
            },
          }),
    });
    // The rows are new elements, so the pointer's memory of the old one goes with them.
    hoveredRow = null;
    // A row the new query dropped takes the active option with it; the field then names nothing.
    markActive(activeIndexOf(options, key));
  };

  /** Shows the clear button only while the field holds text, so an empty field offers nothing to press. */
  const syncClear = (): void => {
    if (clear === undefined) return;
    const filled = input.value !== "";
    clear.hidden = !filled;
    clear.disabled = !filled;
  };

  /** Points the all-results link at the field's query, hiding it while the field is empty. */
  const syncAll = (): void => {
    if (all === undefined) return;
    if (input.value.trim() === "") {
      all.hidden = true;
      all.removeAttribute("href");
      return;
    }
    all.hidden = false;
    all.setAttribute("href", resultsHref(input.value, env.scope ?? null, base));
  };

  /** Runs the field's current query: an empty field shows the actions and clears the status. */
  const run = (): void => {
    syncClear();
    syncAll();
    const query = input.value.trim();
    const matched = filterActions(actions, query);
    const current = ++sequence;
    const previousKey = options[active]?.key;
    // Replace stale page results immediately. Enter can only choose a row for this query.
    draw([], matched);
    if (query === "") {
      status.textContent = "";
      return;
    }
    const api = index.api;
    if (api === undefined) {
      if (index.loading) status.textContent = messages.loading;
      return;
    }
    status.textContent = messages.searching;
    api
      .search(query)
      .then((page) => {
        // Pagefind resolves metadata separately for each hit. Only load it for the current query.
        if (!live || current !== sequence) return [];
        return Promise.all(page.results.slice(0, RESULT_LIMIT).map((hit) => hit.data()));
      })
      .then(
        (records) => {
          if (!live || current !== sequence) return;
          draw(records, matched, previousKey);
          status.textContent =
            records.length === 0
              ? matched.length === 0
                ? emptyMessage(query, messages)
                : ""
              : countMessage(records.length, lang, messages);
        },
        () => {
          if (live && current === sequence) status.textContent = messages.failed;
        },
      );
  };

  /** Offers the retry action only while the index is missing and a press on it can start a load. */
  const offerRetry = (offered: boolean): void => {
    if (retry === undefined) return;
    retry.hidden = !offered;
    retry.disabled = !offered;
  };

  /**
   * Starts the once-only index load. `retried` marks the reader's own press, whose result the status
   * announces: the first load states the failure, a retried one says search is still down or that it
   * is back. The loader itself shares one in-flight promise and forgets a rejection so a retry works.
   */
  const begin = (retried: boolean): void => {
    if (index.api !== undefined || index.loading) return;
    offerRetry(false);
    if (input.value.trim() !== "") status.textContent = messages.loading;
    index.load(indexUrl(base)).then(
      () => {
        if (!live || !dialog.open) return;
        if (retried && input.value.trim() === "") {
          status.textContent = messages.ready;
          return;
        }
        run();
      },
      () => {
        if (!live || !dialog.open) return;
        status.textContent = retried ? messages.retryFailed : messages.failed;
        offerRetry(true);
      },
    );
  };

  /** Opens the dialog and, on the first open, loads the index; later opens reuse it. */
  const show = (): void => {
    returnFocus = true;
    if (!dialog.open) dialog.showModal();
    button.setAttribute("aria-expanded", "true");
    input.setAttribute("aria-expanded", "true");
    input.focus();
    // A fresh open starts at the field, not on the row the last query left selected.
    markActive(-1);
    run();
    begin(false);
  };

  attach(button as unknown as Listenable, "click", show);
  attach(close as unknown as Listenable, "click", () => dialog.close());
  if (retry !== undefined) {
    attach(retry as unknown as Listenable, "click", () => {
      // The field is the combobox: a retry ends with focus back where the typing happens.
      input.focus();
      begin(true);
    });
  }
  if (clear !== undefined) {
    attach(clear as unknown as Listenable, "click", () => {
      input.value = "";
      // One empty query redraws the palette's base rows and clears the status once; the dialog stays open.
      run();
      input.focus();
    });
  }
  attach(input as unknown as Listenable, "input", run);
  // One pointer listener for the whole list: a pointer entering a row, or any of its children, names
  // that row once. Rows are redrawn, so the handler reads the row's position rather than holding it.
  attach(results as unknown as Listenable, "pointerover", (event) => {
    const row = closestIn(event, "[data-search-row]");
    if (row === null || row === hoveredRow) return;
    hoveredRow = row;
    const index = Number(row.getAttribute("data-search-row"));
    if (!Number.isNaN(index)) markActive(index, false);
  });
  // One click listener for the whole list: an action or ask row runs from the row's own model entry,
  // so a click and Enter share one activation and no control registers a listener per row.
  attach(results as unknown as Listenable, "click", (event) => {
    const pressed = closestIn(event, "[data-palette-action], [data-ask-agent-open]");
    if (pressed === null) return;
    const key = pressed.getAttribute("data-search-option");
    if (key !== null) options.find((option) => option.key === key)?.press();
  });
  // A press on the modal backdrop lands on the dialog itself; a press on the panel or a row does not.
  attach(dialog, "click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  attach(dialog, "close", () => {
    if (dialog.open) return;
    ++sequence;
    button.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-expanded", "false");
    markActive(-1);
    // Focus stayed in the field the whole time the dialog was open, so closing has one place to go.
    if (returnFocus) button.focus();
    returnFocus = true;
  });
  attach(dialog, "keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      dialog.close();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (options.length === 0) return;
      event.preventDefault();
      // The field is the one thing that may hold an active option, so it takes focus back first.
      input.focus();
      markActive(
        event.key === "ArrowDown"
          ? active + 1 >= options.length
            ? 0
            : active + 1
          : active <= 0
            ? options.length - 1
            : active - 1,
      );
      return;
    }

    if (event.key === "Enter" && event.target === (input as unknown)) {
      // Enter runs the active option, or the first one when the reader has not moved off the field.
      const option = active >= 0 ? options[active] : options[0];
      if (option === undefined) return;
      event.preventDefault();
      option.activate();
      return;
    }

    trap(dialog, event);
  });

  /** Removes every listener this activation attached and quiets its continuations; safe to repeat. */
  const teardown = (): void => {
    if (!live) return;
    live = false;
    lifecycle.abort();
    for (const remove of removals) remove();
    removals.length = 0;
    if (activations.get(dialog) === teardown) activations.delete(dialog);
  };
  activations.set(dialog, teardown);
  return teardown;
}

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
