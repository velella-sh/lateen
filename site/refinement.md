---
title: Refinement
description: "The rules behind Lateen's finish, the tokens that carry them, and how a site tunes corners and density."
layout: doc
permalink: /refinement/
---

Refinement is the finish on top of the design tokens: how thin a line is, how high a surface sits,
how text is set, and how a control answers a hover or a press. It is CSS and tokens only; a site
built on an earlier release renders the same markup.

## The rules

- A line is one hairline (`thin`), and its strength is a token, never a colour picked per component.
- A surface sits at one of three elevations. Dark mode lifts a surface with a lighter fill and a
  border, not a shadow.
- Hover and press change the surface and the border, never the colour alone.
- Every control shares one focus ring. Nothing removes a browser outline without a replacement.
- Motion is a short fade or slide that uses the motion tokens and collapses to nothing under
  reduced motion. A hover never moves layout.
- Code stays left to right inside right-to-left text; active markers and arrows follow the reading
  direction.

## Tokens

These tokens carry the rules. Each name exists in `tokens/names.json`, and `test/refinement-docs.test.ts`
fails when this page names one that the token files do not hold.

| Token | Role |
| --- | --- |
| `--border-subtle` | The quietest line: dividers inside a surface. |
| `--border-default` | The ordinary line around a control or a card. |
| `--border-strong` | A hovered or emphasised line. |
| `--elevation-low-shadow`, `--elevation-low-bg`, `--elevation-low-border` | A card or a badge at rest. |
| `--elevation-mid-shadow`, `--elevation-mid-bg`, `--elevation-mid-border` | A hovered card, a menu. |
| `--elevation-high-shadow`, `--elevation-high-bg`, `--elevation-high-border` | A popover or a dialog. |
| `--color-surface-sunken` | A recessed area, such as a well. |
| `--color-link-visited` | A visited link. |
| `--space-page` | The page gutter, fluid between a phone and a wide screen. |
| `--type-tracking-display`, `--type-tracking-heading` | Letter spacing of large text. |
| `--motion-fast`, `--motion-base`, `--motion-slow`, `--motion-press` | Durations. |
| `--motion-ease`, `--motion-ease-in-out`, `--motion-ease-out`, `--motion-ease-in` | Easings. |

## Tune corners and density

A site changes the finish with two brand options, and never edits a token file:

```yaml
theme:
  options:
    brand:
      radius: small
      density: compact
```

`radius` is `none`, `small`, `medium` or `large` and multiplies the corner scale (`--radius-sm`,
`--radius-md` and the rest), so every card, code block, table and badge follows. `density` is
`compact` or `comfortable` and multiplies the spacing scale (`--space-1` to `--space-16`). Hairlines,
elevation and motion do not change with either option. See [Brand options](/brand-options/) for the
full list.
