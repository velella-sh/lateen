# Styles

Sailcloth visuals live in `ui.css` (Tailwind CSS + Basecoat + locked brand tokens). Run `npm run ui:build` to write `generated.css`. Do not edit `generated.css` by hand.

`fonts.css` hosts the self-hosted Manrope, JetBrains Mono, and Vazirmatn faces.

Hand-authored per-component `style.css` sheets are not the design source of truth anymore; add new visuals in `ui.css` or with Lucide / Chart.js islands.
