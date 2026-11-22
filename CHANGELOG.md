# Changelog: @velella/lateen

Releases of this package are tagged `v<version>`. Add a one-line fragment in `changelog.d/` in any pull request a user would notice; the release tool moves fragments here.

## Unreleased

## 0.2.4 — 2026-11-22

### Added

- Experimental `redesign/` theme foundation: Tailwind, Basecoat, Lucide, Chart.js, and locked sailcloth tokens (Night/Sail/Mist/Foam/Shell/Lateen Blue). (#703)
- A figure can hold several images through the `images` JSON prop, with one shared caption and real alt text per image. (#738)
- Lists: a dated archive of more than three months gets a table of contents whose links reach every month heading. (#745)
- A `quote` component: a quotation with an optional attribution name and safe source link, drawn as a semantic figure, with text that wraps instead of clipping on mobile. (#746)
- Article page footer: a localized Back to top link returns to the start of the page, with the arrow icon and no JavaScript. (#750)
- Record history: filter the events to one changed field. (#786)
- Code: long examples start in a native disclosure, with the full text and copy unchanged. (#791)
- RTL integration fixture with code, a table, a calendar action, and version controls, plus a test that directional arrows mirror while neutral icons keep their orientation. (#806)
- Screen-reader audit records the search, compare, and code-copy paths at desktop and mobile widths, with reproducible findings for the manual pass. (#814)
- Trust panel: link a reviewed commit to its exact repository revision. (#828)
- Citation: copy and print the title, address, and available source identity. (#830)
- Release: verify the exact candidate commit from a clean checkout. (#838)
- Deploy: smoke-test the public site after every release, and give the docs a search results page. (#839)

### Changed

- Redesign chrome: full-bleed transparent header that glasses on scroll, rail footer, ⌘K/`/` search, theme-color, and reading progress. (#704)
- Redesign layouts: sailcloth home stage with docs preview, quieter doc chrome, not-found layout, and expanded redesign site pages. (#705)
- Redesign core components: sailcloth callouts and code blocks, code-tabs island, and badge/status pills. (#706)
- Redesign remaining sailcloth components: steps, endpoint, file tree, terminal, charts with Chart.js, and the specimen gallery. (#707)
- Cut Lateen home and 404 over to the sailcloth shell; ship the redesign theme export and sailcloth stylesheet. (#708)
- Home layout now matches the sailcloth mockup: brand hero, docs preview pane, and section cards on the default theme. (#709)
- Replace the 0.2.x hand CSS design system with the sailcloth stack: Tailwind, Basecoat, Lucide, and Chart.js on the main theme. `styles/src/ui.css` builds to `styles/generated.css` as the visual source of truth; legacy per-unit sheets remain only as `@layer lateen-legacy` contract fallbacks. Gate scripts run `ui:build` first so CI has generated CSS and Chart.js; the performance budget records the larger shared `css/base` from that dual sheet. Visual baselines and the 24×24 target floor follow the sailcloth chrome; baseline size caps rise for denser gallery shots. (#710)
- - Table: accept an authored `caption` and `description`, name the scroll region from them, and keep both visible in print. (#731)
- Code tabs: an explicit `group` option switches only groups with the same name on the page, and leaves ungrouped groups on their remembered, page-wide behavior. (#742)
- Article: a multi-section page opens its local section list at the start of the article on narrow screens, using the same entries as the aside table of contents; the aside keeps it on wide screens and print. (#747)
- The sidebar scrolls the current page's branch into view after navigation without moving the article. (#748)
- - Article: remember the reader's position per path and restore it on browser Back without disturbing bfcache, reloads, or forward navigation. (#749)
- TOC: the active marker follows the heading below the sticky header and clears when no heading is in view. (#760)
- Search: an empty result names whether it searched this project or all projects, and links to the same query in the other scope. (#767)
- Search results remember the query and the result the reader followed: returning from a result restores the list and marks that item with `aria-current`, without moving focus into it. (#772)
- Search: the dialog follows the dynamic viewport and safe areas on mobile. (#774)
- Record facts can name a group, so related fields sit together under their configured label in the facts panel. A group with no rendered fact is left out. (#775)
- Record facts and record-table cells keep numbers in tabular figures with no wrapping, and both carry the field kind. (#776)
- Record facts and record-table cells now distinguish a missing value from an explicit `null` (not applicable), and keep zero as a real value for display, sorting, and filtering. (#777)
- Every code block now has a localized wrap toggle beside its copy button: long lines wrap in the view on demand, while the copied text keeps its original line breaks. (#787)
- Code blocks with line numbers keep one number per source line when a line wraps, so later numbers stay aligned with their code. (#792)
- Terminal: a mixed session copies only its marked `$` and `%` commands, while every recorded output line stays visible on the page. (#793)
- Output blocks now label the declared stream (`stdout`, `stderr`, or `combined`) in text with its own marker and weight, so the stream never relies on color alone. The label stays out of the recorded text and the copied output. (#794)
- - Code UI: long diffs wrap inside their block on narrow screens, and additions/removals keep their signs and text labels, so color is never the only signal. (#795)
- Annotated code tabs keep each note inside its own example and return focus to the tab when a focused panel hides. (#796)
- Result and comparison counters now follow the page language's plural rules and digits, including Persian and Arabic numerals. (#803)
- Search text follows its own direction, so Persian queries and Latin identifiers stay readable in one field. (#804)
- The compact language selector names each language in its own language and keeps the current one in its accessible name. (#805)
- Focus rings inside cards and tabs are painted inside the control and keep the system highlight color in forced-colors mode. (#807)
- Articles stay readable at an effective 320px width: tabs, code, tables, and long URLs scroll or wrap inside their own region, and the page no longer scrolls horizontally. (#808)
- CLI demo playback now stops and shows every line when `prefers-reduced-motion` turns on while the page is open. (#809)
- Record layout: document and test independent data and review dates. (#824)
- Compare: attach each value its own public evidence link. (#825)
- Tested chip: link the article marker to the page trust explanation when one exists. (#826)
- Search: document the client's module boundaries — option model, DOM rendering, palette validation, localization, loader, and activation — ahead of splitting the file; no behavior moves. (#841)
- Compare picker: derive the selection and row differences once per change. (#849)
- Trust panel: evidence, provenance, drift, reviewer, and action selection now live in a pure view-model module (`components/trust-panel/view-model.ts`); the markup only draws its result, with identical rendered output. (#850)
- - Schema table: split JSON Schema resolution, row construction, ids, and the machine payload into pure modules beside the rendering entry, with the same public exports and output. (#851)
- - Mermaid: source parsing and cache decisions are now pure boundaries, separate from SVG output and sanitization, with rendered output and public contracts unchanged. (#852)
- Version diff: move JSON parsing, change-kind guards, evidence selection, and version pairing into the pure `changes.ts` module, with the same markup, states, and ids. (#853)
- Timeline: date conversion, phase segments, overlaps, tick labels and range calculation move to a pure `ranges.ts`, leaving rendering in the component; output and public exports are unchanged. (#854)
- Drift banner: select evidence, finding rows, and link targets in pure helpers (`viewOf`, `linkTargetOf`) so the markup builder only renders; rendered output is unchanged. (#855)
- - Dated list: decide grouping, feed and calendar links, empty states, and range inputs in a pure view model, with the markup unchanged. (#856)
- Language switcher: locale normalization, alternate-page choice, labels, and base-aware destinations now live in a pure `model.ts`, with the markup reading that model and the public exports unchanged. (#857)
- Last updated: the date line's display choice (relative, absolute, or unavailable) is a pure model shared by the markup and the tests, and day reading reuses the calendar model in `src/dates.ts`. (#858)
- - API reference: select the operation, parameters, responses, schemas, and examples in a pure view model before rendering, with unchanged output. (#859)
- Bar, stacked-bar, line, and performance charts share one input-validation path for finite values, missing values, labels, ids, and series counts, so malformed rows read the same in every chart. (#860)
- Split the sailcloth source `styles/src/ui.css` into responsibility-named modules (theme tokens,
  primitives, base, chrome, home, document, code, content, charts, navigation, responsive, overrides)
  imported in order from `ui.css`. Tailwind compiles the same stylesheet byte-for-byte, so the cascade
  is unchanged. Source tests read the whole sheet through `test/ui-css-helpers.ts`, and the design,
  motion, and RTL gates treat `styles/src/` as Tailwind input the way they already treated `ui.css`. (#863)
- Remove the duplicated `.code .highlighted span, .code-frame .highlighted span` declaration from the
  sailcloth source (now `styles/src/overrides.css`); the highlight keeps its contrast in both themes
  and its print inset. A new source scan (`test/sailcloth-duplicates.test.ts`) fails when any rule
  repeats its exact declarations in the same cascade context, so the duplicate cannot return. (#864)
- `npm test` builds the UI once through its pretest hook instead of twice, so the gates start sooner while direct test scripts and packaging still build fresh assets. (#875)
- Packaging now builds and verifies every artifact the installed theme needs — compiled CSS, chart bundle, units, islands, fonts, tokens, translations, schemas, the redesign alias, the skill, and the starters — and the packed consumer build proves the sailcloth CSS ships. (#876)
- Every CI and site-deploy job now reuses setup-node's npm download cache keyed by
  package-lock.json (the comparison job keys on both the head and base lockfiles), matching the
  release workflow. `npm ci` remains the authoritative install and node_modules is never cached. (#877)
- The accessibility, smoke, acceptance, visual, and site-deploy jobs now share one Playwright
  browser cache keyed by the lockfile, with no restore-key fallback: a cache miss installs the
  pinned Chromium and a browser from an older lockfile is never restored as the test runtime. (#879)
- CI runs are now grouped per pull request (per ref for pushes and manual runs) and a new pull
  request push cancels only that PR's superseded run. Main pushes, manual runs, Pages deploys, and
  tagged releases keep their non-canceling concurrency and never cancel each other. (#880)
- The repeated Node-version, npm-version, and install steps in CI and the site deploy now live in
  one local composite action, .github/actions/setup, which keeps the lockfile-keyed npm cache and
  shows the same named steps in the logs. Checkouts stay in each job because they differ per job
  and a local action is only available after checkout; permissions remain job-scoped. (#881)
- The visual CI job's step-summary table now comes from scripts/visual-summary.ts, a tested script
  the workflow only invokes. Missing reports, null shares, flaky cases and malformed report rows
  each have a defined rendering, and the failure-evidence upload is unchanged. (#882)
- The acceptance, accessibility, visual, and performance runners now share one cleanup helper
  (scripts/runner-cleanup.ts): servers, browsers, and temporary outputs are released on success,
  failure, and SIGINT/SIGTERM interruption (exit 128 + signal), while reports and review images
  written outside the temporary folders survive for debugging. (#884)
- The GitHub Release is created only after the post-publish acceptance run passes, so a failed
  published case or digest check leaves the release uncreated instead of announcing a broken version. (#885)
- A release retry no longer skips acceptance: an already-published version is installed from npm and
  its digest is proved against fresh acceptance evidence from the tagged commit before the GitHub
  Release is created. (#886)
- Publishing and the post-publish digest check now require exactly one .tgz artifact and select the
  tarball the validated acceptance report names, refusing zero or several tarballs before npm publish. (#887)
- Search: the option model — grouping, positional ids, duplicate-safe keys, and active-row resolution — moves into the pure `chrome/search/options.ts`; the client re-exports it unchanged. (#901)
- Search: command-palette JSON parsing, validation, and query filtering move into the pure `chrome/search/palette.ts`, with direct tests for every fallback guard; the client re-exports it unchanged. (#902)
- Search: the dialog's messages, CLDR plural selection, and language detection move into the pure `chrome/search/messages.ts`, with direct tests for Persian, Arabic, English, and every fallback; the client re-exports it unchanged. (#903)
- Search: lazy Pagefind initialization moves into `chrome/search/loader.ts`, whose `createIndexLoader` shares one in-flight load promise across concurrent opens and forgets a rejection so a retry can succeed; the client re-exports it unchanged. (#904)
- Bar, stacked-bar, line, and timeline charts share one set of pure scale and tick helpers, so identical inputs produce identical domains, percentages, and tick positions across chart variants. (#908)
- Bar, stacked-bar, and line charts build their axes, bars, ticks, labels, and SVG frames from one set of shared marks, so the parts that must stay consistent are written once while each chart keeps its own semantics. (#909)
- Packaging drops the dead exclusions for the retired `chart.umd.min.js` bundles and the old `redesign/styles/generated.css`; no script generates those paths and nothing imports them. Every dependency, peer dependency, and package export was audited against real imports and packed-consumer usage and stays. (#922)
- Search: excerpt, title, action, ask-row, and option element construction move into `chrome/search/render.ts`, keeping highlighted excerpts safe and redraw keys stable for `aria-activedescendant`; the client re-exports it unchanged. (#927)
- Search: duplicate occurrence keys are counted with one map in a single pass, locked in by a large duplicate-heavy fixture that proves stable keys and linear work. (#928)
- Search: activating the dialog again replaces its previous wiring instead of stacking listeners, and `activate` returns an idempotent teardown that removes every keyboard, pointer, input, and dialog listener it attached. (#932)
- Search: one activation resolves its dialog, field, list, status, controls, and site base once; redraws reuse those references, proven by a selector-counting test with no per-row root queries. (#933)
- Search: the client keeps only the activation path; callers and tests import the option model, palette, messages, loader, and renderer directly, and the dead re-exports are gone (the bundled island shrinks by 567 bytes). (#934)
- Restore the main branch's test and accessibility gates: the back-to-top link keeps a 24px target,
  the search dialog only points at a search page the site builds, output stream labels are translated,
  and stale expectations follow the intended markup changes. (#1037)
- The performance comparison reads a reviewed new-dependency log (`fixtures/performance/reviewed-assets.json`), so an intentional island module split lands with its weight recorded instead of failing as an unreviewed addition. (#1048)
- Install tabs show one package-manager command at a time, a titled callout keeps its kind name, and changelog categories sit on one line with the date. (#1101)
- The changelog layout leads each release with a larger version and a bold date, marks release boundaries with a stronger rule and more space, lists the versions in one wrapping row, and wraps long versions instead of widening the page. (#1143)
- Visual baselines can be recorded on CI with the `record-baselines` workflow, and pull requests that change only prose skip the browser and size gates. (#1144)
- Adding the `record-baselines` label records visual baselines and starts the checks, `performance-compare` allows 256 B of gzip growth, and `npm run test:changed` and `npm run new:component` shorten the development loop. (#1147)
- CI is cheaper and less flaky: a timing test takes the best of several runs, the starters tests run in parallel, and acceptance runs inside the smoke job. (#1148)
- The search dialog drops the frame around its input in favor of an accent rule under the field row, gains a soft shadow and blurred backdrop, and shows result rows as rounded, inset shapes without hairlines. (#1159)
- Polish the doc chrome without changing its shape: callouts take one hairline frame with a colour per kind (note, tip, important, warning, caution); the sidebar, table of contents and header tabs mark the current item with a single bar instead of a filled pill, and a header section stays current on all of its pages; Page tools is a framed button that holds Copy and View Markdown, the agent links, Source mode and the report link, so the article ends with one quiet row (Edit this page, Back to top); code-block copy and wrap buttons are ghost controls; the header search shows its ⌘K / Ctrl+K hint and the search dialog shows an Esc close key and a quiet result count; the page background is one flat surface without the glow fields. The dark theme stays the default.
  
    The page feedback widget is removed: the "Was this page helpful?" vote, its island, and its strings are gone, and the article footer no longer links to "Give feedback". A `theme.options.feedback` block is still accepted by the options schema and ignored, so an existing config keeps validating. (#1163)
- The end of every article now leads with the page's next step: the previous/next links show their
  direction word and arrow on one line above a larger destination title, and a page with only one
  neighbour uses a single full-width card instead of a half-empty row. The end-of-article tools
  (Markdown, use with an agent, back to top) stay as quiet, compact chips above the pager,
  so they inform without competing with it. The change is in the shared page footer, pager, and
  navigation styles, so every site on the theme gets it with no Markdown, front-matter, or site CSS
  edits; the sidebar and the site footer are unchanged, and DOM and keyboard focus order are kept.
- Figures and Mermaid diagrams now share one surface: a small image keeps its natural size, a diagram sits on the same quiet plate as an image with the same spacing and corner radius, and a diagram wider than the column stays legible and scrolls inside its own frame instead of shrinking to an unreadable strip. The Mermaid palette is repainted from the theme tokens, so diagrams stay readable in light and dark. The changes live in the shared article styles, so a site gets them by upgrading Lateen without changing its YAML, Markdown, or CSS.
- CI runs the full suite once per main push: the `test` job measures coverage there and the `coverage`
  job only publishes the badge, so main no longer runs the suite twice. The accessibility and smoke
  jobs also stop rebuilding the UI a second time in a step that follows a build.
- The back-to-top link keeps a 24px target size, so the accessibility gate passes.
- List: the shared layout now styles its own rows. A record's title, description, date, status, and group count have a hierarchy and spacing tuned for scanning, and the page's links and keyboard focus are visible. Before, the legacy `<div class="list">` prose helper leaked a two-column grid onto every link in the article, stacking the footer, the subscribe line, and the table links; the helper is now scoped to `.doc-body` and the records sit in their own `.list-records` region.
- A page without a code block no longer preloads JetBrains Mono, so the first load of a prose, search, or home page skips two font requests (about 43 KB) while the stylesheet keeps the face for inline code.
- The tarball leaves out what a consumer never reads: the Tailwind sources under `styles/src` (build input for `npm run ui:css`), the per-unit READMEs, and the redesign tests. Same exports and runtime; 46 fewer files and about 54 KB smaller packed.
- Install commands use one stylesheet rule instead of a copy per package manager, so the shared CSS is smaller on every page.
- **Breaking:** `@velella/lateen/redesign`, the deprecated alias of the main theme, is removed; import and configure `@velella/lateen` instead. The sailcloth demo site (`redesign/site`) and its `dev:redesign`, `build:redesign` and `check:redesign` scripts are removed with it.
- Source mode now shows its state at a glance: the switch keeps a pressed, filled look while the mode is on, a small bar beside it gives the number of sourced blocks and one Exit control, and Escape leaves the mode from anywhere on the page. The file:line markers are a compact chip of an icon, the path, and an icon-only forge or editor link instead of a repeated word, so an active article reads as easily as an inactive one. Markers and the active bar stay out of the tab order while the mode is off, and turning the mode on opens the Page tools panel that holds the switch.
- The "On this page" column reads at a glance: a subsection sits one size down on its own rail, top-level rows breathe more, and the section in view is a filled, heavier marker.

### Fixed

- The deployed smoke test joins every route under the base path, so a site served from /lateen/ is checked at /lateen/ and not at the domain root. (#1043)

## 0.2.3 — 2026-11-19

This release needs `@velella/mizzen@^0.2.5`. It is additive: no existing option changes meaning or
default, and a site that only bumps the package renders the same pages. [Upgrade from
0.2.2](https://velella.sh/lateen/upgrade/) is the adoption guide.

### Added

- New layouts: `record` for one data record, `list` for a collection index, `post` for a blog post
  with its archive, author pages and feed, `api-reference` and `api-reference-index` for a pinned
  OpenAPI document, `gallery` for a faceted card grid, `guide` for a task page, and `embedded` for a
  chrome-free iframe view. A home page with `home: { style: showpiece }` is composed from the hero,
  backdrop, motif, stat strip, feature grid, frame and call-to-action band (#481–#492).
- Data views: `timeline`, `compare`, `data-explorer`, `dated-list`, `charts`, `gallery`,
  `record-history`, `stale-notice`, `add-to-calendar` and `related-guides` (#251, #270, #385, #535).
- A list page whose collection has a calendar shows a subscribe panel: a `webcal` link per calendar,
  the full `https` address, and a copy control that needs JavaScript; a collection with no calendar
  renders no panel. The dated view's Add to calendar link uses the first calendar (#535).
- A collection's changes page shows the engine's recorded events, grouped by date with a type badge,
  the changed field with its old and new value, and the collection's Atom feed (#539).
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
  directive come from the engine; see the Mizzen 0.2.5 release.

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
- The add-to-calendar link's accessible name now starts with its visible text, so it passes the
  label-in-name rule in every language.

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

