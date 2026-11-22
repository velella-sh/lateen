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
 * import them directly. `client.ts` is the thin entry: it re-exports the public surface and loads the bootstrap.
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
 * - Types (`types.ts`): the element, part, and environment interfaces, `SEARCH_PAGE_PATH`, `RESULT_LIMIT`.
 * - Activation (`activate.ts`): `activate`, `trap`, and the all-results link (`resultsHref`) wire the
 *   parts together; this is the only boundary that touches dialog state, focus, and event listeners.
 *   `activate` is idempotent per dialog and returns a teardown that removes every listener it attached.
 * - Handlers (`handlers.ts`): `liveHandlers`, the browser's theme, copy, source, and section actions.
 * - Bootstrap (`boot.ts`): finds the page's parts and activates them when a document exists.
 * Dependencies point one way — activation → rendering / loader / localization → option model /
 * palette validation — and the pure modules never import back, so a split introduces no cycles.
 */

import { THEME_KEY } from "../theme-toggle/key.ts";
import "./boot.ts";

export { THEME_KEY };
export { activate, resultsHref, trap } from "./activate.ts";
export { liveHandlers } from "./handlers.ts";
export { RESULT_LIMIT, SEARCH_PAGE_PATH } from "./types.ts";
export type {
  PaletteHandlers,
  SearchAction,
  SearchButton,
  SearchClose,
  SearchDialog,
  SearchEnv,
  SearchEvent,
  SearchFocusable,
  SearchInput,
  SearchLink,
  SearchPaletteSource,
  SearchParts,
  SearchStatus,
} from "./types.ts";
