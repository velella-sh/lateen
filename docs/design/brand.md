# Brand options

A site changes its look with a few values instead of forking the theme: an accent colour, a neutral
tint, its own fonts, a corner radius, and a density. This note fixes what a site may set, how the
values reach the page, and the rule for a colour that cannot meet its contrast.

## What a site may set

| Option | Values | Effect |
| --- | --- | --- |
| `theme.options.preset` | a file name in `tokens/presets/` | A shipped set of the options below, as a starting point. |
| `theme.options.brand.accent` | `#rgb` or `#rrggbb` as a single colour or a `{ light, dark }` pair | The accent, link, focus ring, selection, and selected state, in light and dark. |
| `theme.options.brand.neutral` | `#rgb` or `#rrggbb` tint, or `{ light, dark }` with `{ canvas, surface, text }` per scheme | The hue and chroma of the canvas, surfaces, borders, text, muted text, and code background. |
| `theme.options.brand.fonts.sans` | a family and root-relative files with weights | The body, heading, and interface families, self-hosted and first in the stack. |
| `theme.options.brand.fonts.mono` | a family and root-relative files with weights | The code family, self-hosted and first in the stack. |
| `theme.options.brand.radius` | `none`, `small`, `medium`, `large` | A multiplier of the shipped corner scale. `full` stays a circle. |
| `theme.options.brand.density` | `compact`, `comfortable` | A multiplier of the spacing rhythm. `comfortable` is the shipped scale. |

Values the brand sets win over the preset's. Everything else is unchanged: a brand that sets only
`radius` touches only the radius tokens.

## What stays fixed

- The token names in `tokens/names.json`. The brand derives values for existing names and never adds one.
- The spacing scale, except for the density multiplier. A site cannot set a free-form length.
- The state tokens except the selected state and the focus ring, which follow the accent.
- The forced-colors rules. A brand colour never replaces a system colour in forced-colors mode.
- The colour themes. A brand changes values, not which theme is used.
- The theme's own fallback fonts. A custom family goes in front of the stack, not instead of it.

## How it reaches the page

The `base` layout reads `theme.options` while it renders the page, resolves the preset and the
`brand` overrides, derives every token once, and writes one `<style data-brand>` element in the head.
The values use `light-dark(light, dark)`, so they follow the same `color-scheme` as the theme's own
tokens and need no second rule for the dark theme. The selector is `:root:root`, which is more
specific than the single `:root` in `styles/tokens.css`; the order of the two stylesheets therefore
does not decide which value wins.

Nothing is written when neither `preset` nor `brand` is set, so a site without a brand produces the
same HTML as before. No element gets a `style` attribute.

## The contrast rule

Every colour is held to the ratio its role needs. Text, muted text, links, the accent as text, the
accent's own text, and the selected state reach 4.5:1; the focus ring and other non-text UI reach
3:1. A site's accent is not rejected for failing: its OKLCH lightness moves in fixed 0.01 steps away
from the background until the pair passes, keeping hue and chroma. The same input gives the same hex
on every machine, and the result is always rounded to six digits.

A neutral tint keeps the lightness steps of the shipped palette and changes only hue and chroma. Text
and muted text are then re-checked on the canvas, the surface, and the raised surface, in both
schemes. The code background follows the tint, and every syntax colour is re-checked on it: Shiki's
inline `--shiki-*` values are corrected at emit time, so a token never falls below 4.5:1 on the block
it sits on.

A value that cannot be used (a colour that is not a hex value, an unknown radius, a font from another
origin, an unknown preset name) is ignored rather than failing the build. The page carries a CSS
comment naming the option, so the mistake is visible in the output and in the page source.

## Font preloads

A shipped face declared with `font-display: optional` is preloaded, because it is used only when it is
there at the first paint. When a site replaces `Manrope` or `JetBrains Mono`, the `base` layout asks the
engine to leave that family out of this page's preload links through `LayoutProps.hints.skipFontPreload`.
The custom family goes first in the token stack and the shipped face stays behind it as a fallback, so
a missing glyph still reads; the reader simply does not download the replaced face before the page
needs it. Sans and mono are independent: replacing one leaves the other's preloads alone, and a site
without custom fonts keeps every preload it had. The hint is part of the render cache entry, so a
cached page suppresses the same families it did when it was rendered.
