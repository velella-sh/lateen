---
title: Tokens and options
description: "Change colors, type, and radius, and set the logo, footer, announcement bar, and agent menu from mizzen.yml."
layout: doc
permalink: /tokens/
---

Every visual decision is a design token, defined once and read from CSS. `tokens/names.json` freezes the names; one file per group (`color.json`, `type.json`, `space.json`, and the rest) sets the values. Run `npm run tokens` after editing a group: it writes `styles/tokens.css`, which `npm test` keeps current. Never edit that CSS by hand, and never put a raw color, length, or duration in a unit's stylesheet; use `var(--color-accent)`, `var(--space-4)`, and the other token variables.

A site does not edit a token file. It sets an accent colour, a neutral tint, its own fonts, a corner radius, and a density under `theme.options.brand`, or picks a shipped `theme.options.preset`; Lateen derives every dependent token at build time, corrects a colour that cannot reach its contrast, and writes the values into the page. The full list, the contrast rule, and what stays fixed are on [Brand options](/brand-options/), and the shipped starting points are on [Presets](/presets/).

## Color

<div class="swatches">
  <div class="swatch n">Night <span>#23212C</span></div>
  <div class="swatch s">Sail <span>#DCD7EB</span></div>
  <div class="swatch m">Mist <span>#8F8CD8</span></div>
  <div class="swatch f">Foam <span>#F4F4F9</span></div>
  <div class="swatch h">Shell <span>#EDE6D8</span></div>
  <div class="swatch b">Lateen Blue <span>#4C6F9A</span></div>
</div>

Night is text and dark grounds. Sail is light text on Night. Mist is an accent for tips and charts, never body text on Foam. Foam is the light page background, Shell is for status chips, and Lateen Blue is for identity, links, and focus. Night Raised (`#393743`) and Foam Sunk (`#E7E7ED`) provide inset surfaces; Mist Edge (`#8481C7`) keeps hairlines visible on Foam; Lateen Blue Lift (`#8FB0D4`) is the dark-theme link and focus color. Ink Soft (`#4A4658`) and Sail Soft (`#B7B2C9`) carry secondary text in light and dark themes.

## Public names and deprecations

The token names are a versioned public promise, listed with their types in the [token spec](https://github.com/velella-sh/lateen/blob/main/docs/spec/tokens/v1.md). A name there does not change inside spec v1. The old shadcn-style, Tailwind and sailcloth names (`--background`, `--primary`, `--night`, and the rest) are deprecated pointers that stay for one release and are removed in 0.2.7; the spec's table gives the token to use instead. `docs/spec/tokens/conformance.ts` checks an installed package against the spec.

## Contrast by preset

Every preset keeps the brand roles readable in both themes. The table is built from the token files and the presets, and a test keeps it current.

<!-- token-contrast:start -->
| Preset | brand on canvas (light) | brand on canvas (dark) | on-brand on brand (light) | on-brand on brand (dark) | text on brand-subtle (light) | text on brand-subtle (dark) | brand on brand-subtle (light) | brand on brand-subtle (dark) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| clay | 5.11:1 | 7.28:1 | 5.61:1 | 9.62:1 | 12.96:1 | 9.95:1 | 4.60:1 | 6.37:1 |
| ebb | 5.01:1 | 7.68:1 | 5.78:1 | 9.87:1 | 10.67:1 | 9.28:1 | 4.94:1 | 6.32:1 |
| graphite | 6.89:1 | 7.22:1 | 7.53:1 | 9.61:1 | 13.18:1 | 9.75:1 | 6.30:1 | 6.24:1 |
| harbor | 5.16:1 | 7.24:1 | 5.63:1 | 9.62:1 | 13.27:1 | 9.78:1 | 4.73:1 | 6.24:1 |
| lateen | 5.73:1 | 7.67:1 | 6.60:1 | 9.86:1 | 10.45:1 | 9.39:1 | 5.52:1 | 6.40:1 |
| mizzen | 4.95:1 | 9.73:1 | 5.70:1 | 12.50:1 | 10.43:1 | 9.40:1 | 4.76:1 | 8.12:1 |
| offing | 5.50:1 | 7.65:1 | 6.33:1 | 9.82:1 | 10.37:1 | 9.52:1 | 5.26:1 | 6.46:1 |
| orchard | 5.13:1 | 7.45:1 | 5.61:1 | 9.96:1 | 13.34:1 | 9.60:1 | 4.76:1 | 6.33:1 |
| plum | 5.91:1 | 7.27:1 | 6.49:1 | 9.62:1 | 13.06:1 | 9.91:1 | 5.37:1 | 6.35:1 |
<!-- token-contrast:end -->

## Type

<div class="item"><strong style="font-family:var(--type-font-heading);font-size:var(--type-size-3xl);line-height:var(--type-leading-heading);letter-spacing:var(--type-tracking-heading)">Title</strong><span>Manrope, the heading family</span></div>
<div class="item"><strong style="font-family:var(--type-font-body);font-weight:400">Body text stays easy to read.</strong><span>Manrope, the body and UI family</span></div>
<div class="item"><strong style="font-family:var(--type-font-mono);font-weight:400">npm run typecheck</strong><span>JetBrains Mono, the code family</span></div>
<div class="item"><strong lang="fa" dir="rtl" style="font-family:Vazirmatn,sans-serif;font-weight:400">خوانا است</strong><span>Vazirmatn, for Arabic and Persian</span></div>

Manrope, JetBrains Mono, and Vazirmatn are self-hosted. Arabic and Persian pages use Vazirmatn first, with line heights and letter spacing suited to the script.

## Options

The rest of `theme.options` is the theme's as well. Lateen reads these blocks:

```yaml
theme:
  options:
    announcement:
      id: v0-4
      text: Version 0.4 is out.
      href: /changelog/
    editPage:
      headingLinks: true
    logo:
      light: /assets/logo.svg
      dark: /assets/logo-dark.svg
    footer:
      copyright: © 2026 Example
      license: MIT
      links:
        - title: Source
          url: https://github.com/example/site
    pageAgent:
      providers:
        - title: Claude
          url: "https://claude.ai/new?q=Read+{markdown}"
```

| Option | What it changes |
| --- | --- |
| `announcement.id`, `announcement.text`, `announcement.href` | A dismissible bar above the header. `text` is required; the bar renders nothing without it. `href` links the text; `http`, `https`, `mailto`, and root-relative paths are shown. Dismissal is remembered per `id`. |
| `editPage.headingLinks` | `true` adds a per-heading "suggest an edit" issue link under the "Edit this page" link; absent or any other value leaves it out. |
| `logo.light`, `logo.dark` | The header mark. A root-relative path gets the site's `base`; an absolute URL is used as written. With both, the header swaps them with the theme; with one, it shows that one in both modes. |
| `footer.copyright`, `footer.license` | The two lines of the site footer. |
| `footer.links[]` | Footer links with `title` and `url`; only `http`, `https`, `mailto`, and root-relative paths are shown. |
| `pageAgent.providers[]` | The "Use with an agent" menu. Each provider has a `title` and a `url`; `{markdown}`, `{json}`, `{url}`, and `{title}` are filled per page; `{json}` only on a record page. Without the block the menu offers Claude, ChatGPT, and Cursor. |
