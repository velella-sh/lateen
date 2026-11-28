# Styles

Sailcloth visuals are authored in `src/ui.css` with Tailwind CSS and the locked brand tokens. Run `npm run ui:build` to write `generated.css`. Do not edit `generated.css` by hand. Keep the Tailwind source under `src/` so Mizzen does not ship raw `@import` / `@apply` into the page bundle.

`src/ui.css` imports one module per owner, in cascade order. Author a visual in the module that owns it:

| Module | Owner (epic) |
| --- | --- |
| `theme.css`, `primitives.css`, `base.css`, `state.css` | design-system-v2 |
| `chrome.css`, `navigation.css`, `document.css`, `responsive.css` | layout-shell |
| `home.css` | home-landing |
| `search.css` | search-ui |
| `prose.css` (tables, math, article media) | prose |
| `code.css` | code-blocks |
| `components.css` (citations, callouts, tabs, steps, records, details, tags, changelog) | components-polish |
| `api.css` | api-reference-ui |
| `timeline.css` | timeline-progress |
| `progress.css` (empty) | timeline-progress |
| `tool-island.css` (empty) | tool-island-ui |
| `charts.css` | dashboard-charts |
| `list.css`, `overrides.css` | shared; change with care |

Site-wide keepers beside that build:

- `tokens.css` / `fonts.css` — shared custom properties and `@font-face`
- `print.css` / `rtl.css` / `forced-colors.css` — media and writing-mode gates

Per-unit `style.css` sheets are gone: new visuals go in `src/ui.css` (or a Lucide / Chart.js island).
