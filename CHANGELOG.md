# Changelog: @velella/lateen

Releases of this package are tagged `v<version>`. Add a one-line fragment in `changelog.d/` in any pull request a user would notice; the release tool moves fragments here.

## Unreleased

## 0.2.3 — 2026-11-19

This release needs `@velella/mizzen@^0.2.4`. It is additive: no existing option changes meaning or
default, and a site that only bumps the package renders the same pages. [Upgrade from
0.2.2](https://velella.sh/lateen/upgrade/) is the adoption guide.

### Added

- New layouts: `record` for one data record, `list` for a collection index, `post` for a blog post
  with its archive, author pages and feed, `api-reference` and `api-reference-index` for a pinned
  OpenAPI document, `gallery` for a faceted card grid, `guide` for a task page, and `embedded` for a
  chrome-free iframe view. A home page with `home: { style: showpiece }` is composed from the hero,
  backdrop, motif, stat strip, feature grid, frame and call-to-action band (#481–#492).
- Data views: `timeline`, `compare`, `data-explorer`, `dated-list`, `charts`, `gallery`,
  `record-history`, `stale-notice`, `add-to-calendar` and `related-guides` (#251, #270, #385).
- Evidence: `status`, `status-legend`, `trust-panel`, `drift-banner`, `tested-chip`, and components
  that render the accessibility, performance and WCAG reports. The accessibility gate and the
  performance budget can write a checked-in, schema-validated report (#392).
- Commands and embeds: `install-tabs` with `installTabs.managers`, `cli-demo`, `terminal`,
  `output-block`, `embed-code`, `embed`, `figure`, `video`, inline glossary terms and `::motif`
  (#385, #420, #487).
- Docs chrome: the announcement bar, footer, logo, favicon, the network project switcher, footer and
  search scope, the feedback vote, the prefilled report-issue link, edit-by-heading links, source
  mode, and the ask-your-agent row in search (#390, #391).
- `schema/options.schema.json` documents every `theme.options` block, and `optionOf` reads a path
  against that contract; a test checks the schema against the docs site and scans the units for
  reads the schema does not cover.
- Starters: a published `starters/` folder with the docs, data and changelog starters, and
  `npm run check:starters` builds and checks each one in CI (#336, #389).
- Theme overrides: a site replaces a component or layout by name under `theme.overrides`, with
  paths inside the site root, CSS sidecars, and fail-closed diagnostics (#589–#593).
- Visual gates: `test/visual/` builds one fixture, takes the light, dark, RTL, print and
  forced-colors screenshots, compares them with reviewed baselines, and runs layout checks for
  overflow, clipped text, small controls and prose measure (#494–#499, #501). A design-token gate
  fails on raw colours, sizes, shadows, times and z-index values outside the allowlist (#500).
- Blog and API reference routes, code annotations, text directives, docs versions and the `term`
  directive come from the engine; see the Mizzen 0.2.4 release.

### Changed

- Refinement pass over tokens, components and chrome: border strengths, three elevation levels,
  per-size heading tracking and leading, balanced text, tabular numerals, a sunken surface, a visited
  link colour, enter and exit easings, one shared focus ring, hairline code frames and table rows,
  a scroll-aware header, and a logical start-edge sidebar marker that mirrors in right-to-left
  (#466–#478). CSS only; markup is unchanged.
- Showpiece sections rise into view with scroll-driven CSS animation behind `@supports`, so an
  unsupported browser, reduced motion, print and forced colours show the finished page (#489,
  #491).
- Presets carry a showpiece backdrop, motif seed and intensity; accents are unchanged (#490).
- The changelog, status, glossary, feedback and error-page translations are complete in English,
  Persian and Arabic; keys no unit reads were removed.

### Fixed

- Size-adjusted fallback fonts now use measured metrics, so a first visit that paints before the web
  fonts arrive no longer shows an oversized, overlapping page.

The base stylesheet and the theme script grow in this release; a site with a byte budget should
rerun its own checks.


## 0.2.2 — 2026-11-14

### Changed

- The code block copy control is one small icon button inside the block's top-right corner, on the
  block's own background, with no header strip and no language label. It swaps to a check after a
  copy and its accessible name follows the page language; without JavaScript no control or wrapper
  is added.
- Reading time is quiet metadata under the title instead of a bordered pill that competed with the
  trust chip.

## 0.2.1 — 2026-11-14

### Fixed

- Components a layout renders directly now load their CSS on every page. The engine bundles a page's
  component styles from the components its Markdown used, so a layout-only `style.css` never loaded:
  the trust chip's unsized icon filled the viewport, and reading time, page status, the drift banner,
  changelog entries, and code blocks rendered unstyled. Their rules now live in `styles/parts-<name>.css`,
  which is always loaded.
- The same gap hid two behaviours: code blocks had no copy button on most pages, and Escape did not
  close an open trust panel. Both islands now ship as chrome parts, which load on every page.
- Loading the changelog styles exposed three contrast failures in its category labels; the label text
  now uses the body colour while the chip keeps its category colour on the icon and border.
- A repeated `version-diff` on one page keeps unique ids for its title, list, note, and changes.
- Root-relative images and media take the site base path: `figure` (`src`, `src_dark`, `srcset`) and
  `video` (poster, captions, transcript). A site served under `/lateen` no longer requests `/brand/...`
  from the domain root.

The base stylesheet grows by 1.3 KB gzip and the chrome script by the two islands; the performance
baseline was re-measured and updated.

## 0.2.0 — 2026-11-13

The first complete Lateen theme. Every layout, chrome unit, and component ships with its keyboard,
no-JavaScript, right-to-left, print, and agent path covered.

### Added

- **Complete layout set.** `doc`, `tutorial`, `home`, `api`, `changelog`, `versions`, `search-results`,
  and `not-found`, with one shared chrome: header, sidebar, table of contents, search, pager, footer,
  and page status. Each layout places the last-updated line and the edit link exactly once.
- **Search and command palette.** A Pagefind-backed dialog with grouped results, no-JavaScript fallback,
  and keyboard shortcuts: `⌘K`/`Ctrl+K` and `/` open search, `?` opens the shortcut reference.
- **Agent and block actions.** Copy the page as Markdown, open it in a configured agent, and copy one
  block's prompt with its exact `path:line:column` span, language, and declared version. Code, output,
  terminal, endpoint, and schema blocks publish their canonical values as inert data for agents.
  Contracts, clipboard limits, and security rules: `docs/agent-ux.md`.
- **Trust and freshness evidence.** Trust panel, drift banner, tested chip, page status, last updated,
  and version badge/diff share one vocabulary: `verified`, `unverified`, `stale`, `unknown`, and
  `unavailable`. Every state carries words and an icon, never colour alone, and survives forced colors
  and print.
- **Reproducible examples.** The variables form, terminal, and output block connect by an explicit
  `group`, so two forms with the same variable name keep independent values. Every variable stays a text
  input; the declared `url`, `number`, and `boolean` types validate with visible localized messages,
  `aria-invalid`, and a form-level invalid state that blocks terminal copy for that group. Recorded
  output turns stale when a value moves or is invalid, and reset restores that group's server-rendered
  defaults and announces itself. Nothing executes a command.
- **Internationalization and RTL.** English, Persian, and Arabic catalogs, a language switcher that
  names the language actually shown, localized chrome, bidi isolation for mixed text, and right-to-left
  styles. Fallback and bidi rules: `docs/internationalization.md`.
- **Accessibility gate.** axe-core over WCAG 2.2 A/AA on 44 page states in both themes and in English,
  Persian, and Arabic, including the open drawer and search dialog. Findings are reviewed against a
  checked-in baseline; the baseline is not expanded to make a run pass.
- **Performance gate.** Per-route gzip budgets for base/page CSS, chrome and component JavaScript, and
  self-hosted fonts in `fixtures/performance/budget.json`, run by `npm run test:performance` in CI.
  Policy: `docs/performance.md`.
- **Agent skill.** A portable skill in `skills/lateen` teaches a compatible coding agent the theme
  boundary, unit folders, and verification commands: `npx skills add velella-sh/lateen`.
- 2,092 `node:test` cases, `tsc --noEmit`, 97% line coverage, and a package smoke test that installs
  the packed tarball into an empty project and builds the docs site from `node_modules`.

### Changed

- Ships with `@velella/mizzen` 0.2.0; the theme and the engine are tested together at that version.
- Coverage no longer counts the engine's build subprocess, which duplicated every theme module in the
  report and halved the published percentage.
- `chrome/page-footer` now renders page actions only: copy the agent prompt and give feedback. The edit
  link and the last-updated line are the separate `edit-page` and `last-updated` chrome units, placed
  once by the doc and tutorial layouts. A custom layout that imports `page-footer` must add those two
  units itself to keep the edit link and date.
- Variables are validated by the declared type instead of the browser's input type, so the control stays
  a text input and a root-relative `url` is accepted. The type is exposed as `data-type`; existing forms
  keep their markup and defaults.
- Search option rendering moved into `chrome/search/client.ts`. The chrome asset count stays at 18 and
  no extra request is added.
- At 40rem and below the header wraps its actions onto a second line instead of overflowing the page at
  320px.
- Block actions are hidden in print, including the buttons cloned into blocks after load.

### Fixed

- Duplicate edit and last-updated controls on doc and tutorial pages.
- `placeholder.undefined` warnings in the output-block documentation; `mizzen check site` is back to
  0 errors and 0 warnings.
- Forced-colors and print rules for trust, drift, tested, version, and evidence surfaces.

## 0.1.0

First release: layouts, chrome, components, styles, tokens, fonts, i18n and icons for Mizzen sites. Ships as TypeScript source; Mizzen loads it directly from `node_modules`.

