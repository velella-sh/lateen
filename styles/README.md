# Styles

Sailcloth visuals are authored in `src/ui.css` (Tailwind CSS + Basecoat + locked brand tokens). Run `npm run ui:build` to write `generated.css`. Do not edit `generated.css` by hand. Keep the Tailwind source under `src/` so Mizzen does not ship raw `@import` / `@apply` into the page bundle.

`fonts.css` hosts the self-hosted Manrope, JetBrains Mono, and Vazirmatn faces.

Hand-authored per-unit `style.css` / layout / `parts-*.css` sheets stay in the tree for contract tests and behavioral fallbacks, but each is wrapped in `@layer lateen-legacy` so unlayered `generated.css` wins the cascade. Add new visuals in `src/ui.css` (or Lucide / Chart.js islands), not by extending the legacy sheets.
