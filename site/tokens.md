---
title: Tokens and options
description: "Change colors, type, and radius, and set the logo, footer, announcement bar, and agent menu from mizzen.yml."
layout: doc
permalink: /tokens/
---

Every visual decision is a design token, defined once and read from CSS. `tokens/names.json` freezes the names; one file per group (`color.json`, `type.json`, `space.json`, and the rest) sets the values. Run `npm run tokens` after editing a group: it writes `styles/tokens.css`, which `npm test` keeps current. Never edit that CSS by hand, and never put a raw color, length, or duration in a unit's stylesheet; use `var(--color-accent)`, `var(--space-4)`, and the other token variables.

A site does not edit a token file. It sets an accent colour, a neutral tint, its own fonts, a corner radius, and a density under `theme.options.brand`, or picks a shipped `theme.options.preset`; Lateen derives every dependent token at build time, corrects a colour that cannot reach its contrast, and writes the values into the page. The full list, the contrast rule, and what stays fixed are on [Brand options](/brand-options/), and the shipped starting points are on [Presets](/presets/).

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
    feedback:
      endpoint: https://feedback.example.com/vote
```

| Option | What it changes |
| --- | --- |
| `announcement.id`, `announcement.text`, `announcement.href` | A dismissible bar above the header. `text` is required; the bar renders nothing without it. `href` links the text; `http`, `https`, `mailto`, and root-relative paths are shown. Dismissal is remembered per `id`. |
| `editPage.headingLinks` | `true` adds a per-heading "suggest an edit" issue link under the "Edit this page" link; absent or any other value leaves it out. |
| `logo.light`, `logo.dark` | The header mark. A root-relative path gets the site's `base`; an absolute URL is used as written. With both, the header swaps them with the theme; with one, it shows that one in both modes. |
| `footer.copyright`, `footer.license` | The two lines of the site footer. |
| `footer.links[]` | Footer links with `title` and `url`; only `http`, `https`, `mailto`, and root-relative paths are shown. |
| `pageAgent.providers[]` | The "Use with an agent" menu. Each provider has a `title` and a `url`; `{markdown}`, `{json}`, `{url}`, and `{title}` are filled per page; `{json}` only on a record page. Without the block the menu offers Claude, ChatGPT, and Cursor. |
| `feedback.endpoint` | The address the "Was this page helpful?" buttons POST `{url, helpful, source}` to; `source` is the page's source file. Without the block the feedback widget renders nothing. |
