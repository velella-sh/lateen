---
title: Brand options
description: "Set one accent colour, a neutral tint, your own fonts, a corner radius, and a density, and keep every contrast promise."
layout: doc
permalink: /brand-options/
---

A site changes its look with a few values instead of forking the theme. Lateen reads them from
`theme.options` in `mizzen.yml`, derives every dependent token at build time, and writes them into the
page as one stylesheet. Nothing is sent anywhere and nothing needs JavaScript.

```yaml
theme:
  options:
    preset: harbor
    brand:
      accent: "#0b6e4f"
      neutral: "#8ea3b5"
      radius: medium
      density: comfortable
```

`preset` picks a starting point from [Presets](/presets/); `brand` overrides single values. A value
the brand sets wins over the preset's, and a value neither sets keeps the theme's own.

## Options

| Option | Values | What it does |
| --- | --- | --- |
| `theme.options.preset` | a preset name | A shipped set of the options below, as a starting point. |
| `theme.options.brand` | object | The overrides for this site. |
| `theme.options.brand.accent` | `#rgb` or `#rrggbb` | The accent, links, focus ring, selection, and selected state, in light and dark. |
| `theme.options.brand.neutral` | `#rgb` or `#rrggbb` | The hue of the canvas, surfaces, borders, text, muted text, and code background. |
| `theme.options.brand.fonts` | object | The site's own self-hosted families. |
| `theme.options.brand.fonts.sans` | object | The body, heading, and interface family. |
| `theme.options.brand.fonts.sans.family` | string | The family name written in `@font-face` and first in the stack. |
| `theme.options.brand.fonts.sans.files` | list | One entry per weight: `src` (a root-relative path), `weight`, and optionally `style`. |
| `theme.options.brand.fonts.mono` | object | The code family. |
| `theme.options.brand.fonts.mono.family` | string | The family name written in `@font-face` and first in the stack. |
| `theme.options.brand.fonts.mono.files` | list | One entry per weight: `src` (a root-relative path), `weight`, and optionally `style`. |
| `theme.options.brand.radius` | `none`, `small`, `medium`, `large` | A multiplier of the shipped corner scale. |
| `theme.options.brand.density` | `compact`, `comfortable` | A multiplier of the spacing rhythm; `comfortable` is the shipped scale. |

## Live example

The block below is the `harbor` preset with its accent picker. Choosing a colour rewrites the sample
and shows the contrast ratio the colour produces in both themes; the rest of this page keeps its own
look.

::preset-preview{preset=harbor picker}

Without JavaScript the sample keeps the preset's accent and the ratios the build wrote.

## Fonts

A custom family is self-hosted: the files live in your site and are requested through the site's base.
A font from another origin is refused instead of loaded.

```yaml
theme:
  options:
    brand:
      fonts:
        sans:
          family: "Example Sans"
          files:
            - src: /fonts/example-sans-400.woff2
              weight: 400
            - src: /fonts/example-sans-700.woff2
              weight: 700
```

The family goes first in the token stack and the theme's own fallbacks stay behind it, so a missing
glyph or a slow file still reads in the shipped fonts. A replaced family's preload is left out: a page
that brings its own sans or mono does not download the theme's face first, while a page without custom
fonts keeps every preload it had.

## Contrast

A colour that cannot reach its ratio is corrected instead of shipped. Text, links, and the accent as
text reach 4.5:1; the focus ring and other non-text UI reach 3:1. The correction moves the colour's
lightness in fixed steps, keeps hue and chroma, and gives the same result on every machine. The
neutral tint keeps the shipped lightness steps and is re-checked on the canvas, the surface, and the
raised surface in both themes.

## When a value is wrong

The build keeps going. A value that is not a colour, an unknown radius or density, a font from another
origin, or an unknown preset name is ignored, and the page carries a comment naming the option, for
example:

```html
<!-- inside the page's <style> -->
/* lateen: ignored theme.options.brand.accent: is not a #rgb or #rrggbb colour */
```

A site that sets no brand gets exactly the HTML it got before this option existed.
