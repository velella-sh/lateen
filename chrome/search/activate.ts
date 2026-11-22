/*
 * The search dialog's activation: the one boundary that touches dialog state, focus, and event
 * listeners. `activate` is idempotent per dialog and returns a teardown that removes every listener it
 * attached; `trap` keeps Tab inside the dialog; `resultsHref` builds the all-results link.
 */

import type { PaletteAction, PaletteRun } from "../command-palette/actions.ts";
import { withBase } from "../../src/url.ts";
import { activeIndexOf, optionList, wordCount, type SearchRecord } from "./options.ts";
import { filterActions, parsePalette } from "./palette.ts";
import { renderOptions, type RenderedOption } from "./render.ts";
import { fillMessage, MESSAGES, resultsMessage } from "./messages.ts";
import { createIndexLoader, indexUrl } from "./loader.ts";
import { liveHandlers } from "./handlers.ts";
import {
  RESULT_LIMIT,
  SEARCH_PAGE_PATH,
  type SearchDialog,
  type SearchEnv,
  type SearchEvent,
  type SearchFocusable,
  type SearchParts,
} from "./types.ts";

/** The address of the search page for `query`, carrying the current `scope` when the page has one. */
export function resultsHref(query: string, scope?: string | null, base = ""): string {
  const params = new URLSearchParams({ q: query });
  if (scope !== undefined && scope !== null && scope !== "") params.set("scope", scope);
  return `${withBase(base, SEARCH_PAGE_PATH)}?${params.toString()}`;
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
  const { dialog, button, close, input, results, status, clear, retry, all, scope } = parts;
  // A repeated initialization replaces the previous wiring rather than doubling every listener.
  activations.get(dialog)?.();
  const base = dialog.getAttribute("data-base") ?? "";
  const messages = env.messages ?? MESSAGES;
  const lang = env.lang ?? "en";
  const palette = env.palette ?? parsePalette(parts.palette?.textContent ?? null, messages.actions);
  const actions = palette.actions;
  const handlers = env.handlers ?? liveHandlers();
  const index = createIndexLoader(env.load);
  const network = env.network;
  const url = indexUrl(base, env.indexFolder);
  const chosenScope = (): string | null => scope?.value ?? env.scope ?? null;
  const scopedNetwork = () => chosenScope() === "all" ? network : undefined;
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
    all.setAttribute("href", resultsHref(input.value, chosenScope(), base));
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
    const valid = () => live && current === sequence;
    const api = index.api;
    const across = scopedNetwork();
    if (api === undefined && across === undefined) return;
    if (query === "") {
      status.textContent = "";
      return;
    }
    const showRecords = (records: readonly SearchRecord[], notice = ""): void => {
      draw(records, matched, previousKey);
      status.textContent = resultsMessage(records.length, matched.length > 0, query, lang, messages, notice);
    };
    status.textContent = messages.searching;
    const fail = () => { if (valid()) status.textContent = messages.failed; };
    if (across !== undefined) {
      offerRetry(false);
      void import("./network.ts").then(({ searchNetworkDialog }) => searchNetworkDialog(query, {
        base,
        network: across,
        current: () => index.load(url),
        load: env.load,
        valid,
        dialog,
        messages,
        showRecords,
      })).catch(fail);
      return;
    }
    api?.search(query)
      .then((page) => {
        // Pagefind resolves metadata separately for each hit. Only load it for the current query.
        if (!valid()) return [];
        return Promise.all(page.results.slice(0, RESULT_LIMIT).map((hit) => hit.data()));
      })
      .then((records) => {
        if (valid()) showRecords(records);
      }).catch(fail);
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
    if (index.api !== undefined || index.loading || scopedNetwork() !== undefined) return;
    offerRetry(false);
    status.textContent = messages.loading;
    index.load(url).then(
      () => {
        if (!live || !dialog.open || scopedNetwork() !== undefined) return;
        if (retried && input.value.trim() === "") {
          status.textContent = messages.ready;
          return;
        }
        run();
      },
      () => {
        if (!live || !dialog.open || scopedNetwork() !== undefined) return;
        status.textContent = retried ? messages.retryFailed : messages.failed;
        offerRetry(true);
      },
    );
  };

  const refresh = (): void => {
    run();
    begin(false);
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
    refresh();
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
  if (scope !== undefined) attach(scope as unknown as Listenable, "change", refresh);
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
