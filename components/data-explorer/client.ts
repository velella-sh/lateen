/* The data explorer's island: typing filters the collection's index into the table the page already
 * shows, and clearing brings the static rows back. The merged loader starts the index on the field's
 * first focus, never on page load, and a query is matched once the reader pauses (see `DEBOUNCE_MS`),
 * so a fast typist matches once. At most `ROW_LIMIT` rows show; the button `index.ts` writes hidden
 * reveals the next page. Every word the island says comes from a `data-` attribute in the page
 * language.
 *
 * Filtering, sorting, pagination, the address, and the active-row transitions live in `state.ts`;
 * this module reads the controls and applies that state to the DOM through `view.ts`. `contract.ts` holds
 * the selectors and interfaces, `env.ts` the browser's fetch and timers; both are re-exported here. */

import { createIndexLoader, type IndexField, type IndexRow } from "./index-loader.ts";
import {
  columnsOf,
  createModel,
  enterTarget,
  facetCounts,
  fieldsOf,
  formatNumber,
  hasMore,
  hasState,
  matchingRows,
  nextActive,
  pageRows,
  readAddress,
  sortablesOf,
  sortOf,
  sortValue,
  writeAddress,
  type ExplorerModel,
  type Facet,
  type Selection,
} from "./state.ts";
import {
  ACTIVE_ROW_CLASS,
  BODY_SELECTOR,
  CHIPS_SELECTOR,
  DEBOUNCE_MS,
  EMPTY_SELECTOR,
  FILTERS_SELECTOR,
  INPUT_SELECTOR,
  MORE_SELECTOR,
  optionId,
  ROOT_SELECTOR,
  ROW_LIMIT,
  SORT_FIELD_SELECTOR,
  SORT_SELECTOR,
  STATUS_SELECTOR,
  TABLE_SELECTOR,
  type ExplorerDocument,
  type ExplorerElement,
  type ExplorerEnv,
} from "./contract.ts";
import { browserEnv } from "./env.ts";
import { countText, drawFacets, rowOf, type FacetWidget } from "./view.ts";

export { FILTER_PARAM, ORDER_PARAM, QUERY_PARAM, SORT_PARAM } from "./state.ts";
export * from "./contract.ts";
export { browserEnv } from "./env.ts";
export { countText } from "./view.ts";

/**
 * One explorer: the index, the selection in hand, and the rows the table currently shows. Every
 * listener carries the returned teardown's signal, so a host that mounts and unmounts the explorer
 * detaches the wiring with one abort.
 */
function attach(root: ExplorerElement, doc: ExplorerDocument, env: ExplorerEnv): () => void {
  const view = doc.defaultView ?? null;
  const lifecycle = new (view?.AbortController ?? AbortController)();
  const signal = lifecycle.signal;
  const field = root.querySelector(INPUT_SELECTOR);
  const table = root.querySelector(TABLE_SELECTOR);
  const body = table?.querySelector(BODY_SELECTOR) ?? null;
  if (field === null || body === null) return () => {};
  const status = root.querySelector(STATUS_SELECTOR);
  const empty = root.querySelector(EMPTY_SELECTOR);
  const more = root.querySelector(MORE_SELECTOR);
  const filtersBox = root.querySelector(FILTERS_SELECTOR);
  const chips = root.querySelector(CHIPS_SELECTOR);
  const sortBox = root.querySelector(SORT_SELECTOR);
  const sortSelect = root.querySelector(SORT_FIELD_SELECTOR);

  // The field is the combobox: the result rows are its list, and the keys never leave the field. The
  // static markup stays a plain search field until the island runs.
  field.setAttribute("role", "combobox");
  field.setAttribute("aria-expanded", "false");

  const base = root.getAttribute("data-base") ?? "";
  const collection = root.getAttribute("data-collection") ?? "";
  const lang = root.getAttribute("data-lang") ?? "en";
  const noValue = root.getAttribute("data-explorer-no-value") ?? "";
  const loadingText = root.getAttribute("data-explorer-loading") ?? "";
  const failedText = root.getAttribute("data-explorer-failed") ?? "";
  const emptyPattern = root.getAttribute("data-explorer-empty") ?? "";
  const filterEmpty = root.getAttribute("data-explorer-filter-empty") ?? "";
  const filterPattern = root.getAttribute("data-explorer-filter-column") ?? "{column}";
  const removePattern = root.getAttribute("data-explorer-remove") ?? "{filter}";
  const filterFields = fieldsOf(root.getAttribute("data-filters"));
  const sortables = sortablesOf(root.getAttribute("data-sort"));

  // The rows the page was rendered with, so clearing puts them back as they were.
  const original = body.innerHTML;

  let columns = columnsOf(root.getAttribute("data-columns"));
  let model: ExplorerModel | undefined;
  let selection: Selection = { query: "", filters: new Map(), sort: undefined };
  let widgets: FacetWidget[] = [];
  let matches: readonly IndexRow[] = [];
  let limit = ROW_LIMIT;
  let timer: unknown;
  let failed = false;
  // The rows on screen, and which of them the field names. `-1` is no active row.
  let drawn: ExplorerElement[] = [];
  let active = -1;

  const facets = (): readonly Facet[] => model?.facets ?? [];

  /**
   * Makes the row at `index` the active one, or clears the mark when `index` has no row. The class is
   * what a reader sees, `aria-selected` what assistive tech reads, and `aria-activedescendant` the row
   * the field names; all three move together.
   */
  const markActive = (index: number): void => {
    const current = drawn[active];
    const next = drawn[index];
    if (current !== undefined && current !== next) {
      current.removeAttribute("class");
      current.removeAttribute("aria-selected");
    }
    if (next === undefined) {
      active = -1;
      // A reference to a row that is not there would dangle, so the attribute goes entirely.
      field.removeAttribute("aria-activedescendant");
      return;
    }
    active = index;
    next.setAttribute("class", ACTIVE_ROW_CLASS);
    next.setAttribute("aria-selected", "true");
    field.setAttribute("aria-activedescendant", optionId(index));
    next.scrollIntoView?.({ block: "nearest" });
  };

  const restore = (): void => {
    // The static rows are not options, so nothing stays active across the swap.
    markActive(-1);
    drawn = [];
    body.innerHTML = original;
    matches = [];
    limit = ROW_LIMIT;
    selection = { query: selection.query, filters: new Map(), sort: undefined };
    field.setAttribute("aria-expanded", "false");
    if (sortSelect !== null) sortSelect.value = "";
    if (table !== null) table.hidden = false;
    if (empty !== null) {
      empty.hidden = true;
      empty.textContent = "";
    }
    if (more !== null) more.hidden = true;
    if (chips !== null) {
      chips.replaceChildren();
      chips.hidden = true;
    }
    if (status !== null) status.textContent = "";
  };

  const drawRows = (): void => {
    if (model === undefined) return;
    // The rows are replaced, so the mark goes with them and the field names nothing until a key
    // moves it again.
    markActive(-1);
    drawn = pageRows(matches, limit).map((row, at) => {
      const tr = rowOf(doc, row, columns, model!.index, base, lang, noValue);
      tr.setAttribute("id", optionId(at));
      return tr;
    });
    body.replaceChildren(...drawn);
    // Expanded only while there is a list to move through: with no matches the table is hidden.
    field.setAttribute("aria-expanded", matches.length > 0 ? "true" : "false");
    if (table !== null) table.hidden = matches.length === 0;
    if (more !== null) more.hidden = !hasMore(matches, limit);
  };

  /** The filters the drawn checkboxes name, in facet order. */
  const checkedFilters = (): Map<string, string[]> => {
    const filters = new Map<string, string[]>();
    for (const widget of widgets) {
      if (widget.input.checked !== true) continue;
      filters.set(widget.field, [...(filters.get(widget.field) ?? []), widget.raw]);
    }
    return filters;
  };

  /** Checks the boxes the selection names, and no others. */
  const applyFilters = (): void => {
    for (const widget of widgets) {
      widget.input.checked = selection.filters.get(widget.field)?.includes(widget.raw) ?? false;
    }
    if (sortSelect !== null) sortSelect.value = sortValue(selection.sort);
  };

  /**
   * Replaces this explorer's keys in the address, keeping every other parameter and the fragment.
   * The names are the search results contract's, so the no-script form and a shared link agree.
   */
  const write = (): void => {
    if (view === null) return;
    view.history.replaceState(null, "", writeAddress(view.location.href, selection, facets()));
  };

  const drawChips = (): void => {
    if (chips === null) return;
    const buttons: ExplorerElement[] = [];
    for (const widget of widgets) {
      if (selection.filters.get(widget.field)?.includes(widget.raw) !== true) continue;
      const text = `${widget.label}: ${widget.raw}`;
      const button = doc.createElement("button");
      button.setAttribute("class", "data-explorer-chip");
      button.setAttribute("type", "button");
      button.setAttribute("aria-label", removePattern.replace("{filter}", text));
      button.textContent = `${text} ×`;
      button.addEventListener("click", () => {
        widget.input.checked = false;
        selection = { ...selection, filters: checkedFilters() };
        run();
        // The chip is gone, so focus moves to the checkbox that replaced it rather than the body.
        widget.input.focus?.();
      }, { signal });
      buttons.push(button);
    }
    chips.replaceChildren(...buttons);
    chips.hidden = buttons.length === 0;
  };

  const render = (): void => {
    if (model === undefined) return;
    matches = matchingRows(model, selection);
    limit = ROW_LIMIT;
    drawRows();
    if (status !== null) status.textContent = countText(root, lang, matches.length);
    if (empty !== null) {
      const none = matches.length === 0;
      const text = selection.query.trim();
      empty.hidden = !none;
      empty.textContent = none ? (text === "" ? filterEmpty : emptyPattern.replace("{query}", text)) : "";
    }
    // Every value says how many rows the query and the other fields leave; its own field is ignored.
    for (const facet of facetCounts(model, selection)) {
      for (const value of facet.values) {
        const widget = widgets.find((entry) => entry.field === facet.field && entry.raw === value.raw);
        if (widget !== undefined) widget.count.textContent = `(${formatNumber(lang, value.count)})`;
      }
    }
    drawChips();
  };

  /** Offers relevance and both directions of every field named in `sort`, once the index is known. */
  const drawSort = (): void => {
    if (sortBox === null || sortSelect === null || sortables.length === 0) return;
    if (sortSelect.querySelector("option") !== null) return;

    const relevance = doc.createElement("option");
    relevance.setAttribute("value", "");
    relevance.textContent = root.getAttribute("data-explorer-relevance") ?? "";
    sortSelect.append(relevance);

    for (const sortable of sortables) {
      for (const direction of ["ascending", "descending"] as const) {
        const option = doc.createElement("option");
        option.setAttribute("value", `${sortable.field}:${direction}`);
        option.textContent = `${sortable.label} — ${root.getAttribute(`data-explorer-${direction}`) ?? direction}`;
        sortSelect.append(option);
      }
    }
    sortSelect.value = sortValue(selection.sort);
    sortSelect.addEventListener("change", () => {
      selection = { ...selection, sort: sortOf(sortSelect.value ?? "", sortables) };
      if (model !== undefined) {
        if (hasState(selection, model.facets)) render();
        else restore();
      }
      write();
    }, { signal });
    sortBox.hidden = false;
  };

  const loader = createIndexLoader(
    { field: field as unknown as IndexField, base, collection, signal },
    { fetchJson: env.fetchJson },
    {
      ready(loaded) {
        if (columns.length === 0) columns = columnsOf(null, loaded);
        model = createModel(loaded, columns, filterFields, lang);
        widgets =
          filtersBox === null ? [] : drawFacets(doc, filtersBox, model.facets, filterPattern, lang);
        if (filtersBox !== null) filtersBox.hidden = model.facets.length === 0;
        applyFilters();
        drawSort();
        if (hasState(selection, model.facets)) render();
      },
      failed() {
        failed = true;
        if (status !== null) status.textContent = failedText;
      },
    },
  );

  /** Puts the address's query, filters and sort into the controls and the table. */
  const applyAddress = (): void => {
    selection = readAddress(view?.location.search ?? "", sortables);
    field.value = selection.query;
    applyFilters();

    if (model === undefined) {
      if (hasState(selection, [])) void loader.load();
      return;
    }
    if (hasState(selection, model.facets)) render();
    else restore();
  };

  function run(): void {
    timer = undefined;
    if (!hasState(selection, facets())) {
      restore();
    } else if (model !== undefined) {
      render();
    } else {
      if (status !== null) status.textContent = loadingText;
      if (failed) {
        failed = false;
        void loader.load();
      }
    }
    write();
  }

  /** Reads the field, resets the sort, and runs the query once typing rests. */
  const typed = (): void => {
    selection = { query: field.value ?? "", filters: selection.filters, sort: undefined };
    if (sortSelect !== null) sortSelect.value = "";
    if (timer !== undefined) env.cancel(timer);
    timer = undefined;
    if (selection.query.trim() === "") {
      run();
      return;
    }
    timer = env.schedule(run, DEBOUNCE_MS);
  };

  field.addEventListener("input", typed, { signal });

  // The field owns the keys and the rows never take focus, so Tab keeps the page's own order. Only
  // ArrowDown, ArrowUp, Enter, and Escape are handled; anything else, Tab included, is the browser's.
  field.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (drawn.length === 0) return;
      event.preventDefault();
      markActive(nextActive(active, drawn.length, event.key));
      return;
    }

    if (event.key === "Enter") {
      // No drawn row keeps the form's own Enter, which submits to the search results page.
      const row = drawn[enterTarget(active, drawn.length)];
      const link = row?.querySelector("a");
      if (link === undefined || link === null) return;
      event.preventDefault();
      link.click?.();
      return;
    }

    if (event.key === "Escape") {
      // An empty field has nothing to clear, so the key is left to the browser.
      if ((field.value ?? "") === "") return;
      event.preventDefault();
      field.value = "";
      typed();
    }
  }, { signal });

  filtersBox?.addEventListener("change", () => {
    selection = { ...selection, filters: checkedFilters() };
    run();
  }, { signal });

  more?.addEventListener("click", () => {
    limit += ROW_LIMIT;
    drawRows();
  }, { signal });

  // Back and forward restore the controls without writing the address again.
  view?.addEventListener("popstate", applyAddress, { signal });
  applyAddress();
  // A query typed just before teardown still waits in the debounce; drop it with the listeners so
  // nothing renders after the host has detached the explorer.
  return () => {
    lifecycle.abort();
    if (timer !== undefined) env.cancel(timer);
    timer = undefined;
  };
}

/**
 * Wires every explorer in the document; a page without one does nothing. The returned teardown
 * detaches every listener on every explorer this call wired, so a host that mounts the island again
 * after it starts over with no duplicate wiring left behind.
 */
export function activate(doc: ExplorerDocument, env: ExplorerEnv = browserEnv): () => void {
  const teardowns = [...doc.querySelectorAll(ROOT_SELECTOR)].map((root) => attach(root, doc, env));
  return () => {
    for (const teardown of teardowns) teardown();
  };
}

/** The browser environment: the page's document. */
const globals = globalThis as unknown as { document?: ExplorerDocument };

// The island runs when the browser loads it; nothing happens in a runtime without a document.
if (globals.document) activate(globals.document);
