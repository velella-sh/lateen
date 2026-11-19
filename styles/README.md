# Styles

Sailcloth visuals are authored in `src/ui.css` (Tailwind CSS + Basecoat + locked brand tokens). Run `npm run ui:build` to write `generated.css`. Do not edit `generated.css` by hand. Keep the Tailwind source under `src/` so Mizzen does not ship raw `@import` / `@apply` into the page bundle.

Site-wide keepers beside that build:

- `tokens.css` / `fonts.css` — shared custom properties and `@font-face`
- `print.css` / `rtl.css` / `forced-colors.css` — media and writing-mode gates

Per-unit `style.css` sheets are gone: new visuals go in `src/ui.css` (or a Lucide / Chart.js island). The Chart.js performance chart keeps a small companion sheet next to its island.
