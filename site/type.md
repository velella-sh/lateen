---
title: Type and rhythm
description: The one type scale, line heights, measure, and block spacing every Lateen page reads from, and what changed for sites that upgrade.
layout: doc
permalink: /type/
---

Every page reads its type and spacing from the same tokens. A heading, a table, a callout, and a timeline entry pick a step from one scale instead of carrying a size of their own, so two pages never disagree about how big a label is or how far apart two blocks sit. The values live in `tokens/type.json` and `tokens/space.json`; a unit's stylesheet uses `var(--type-size-sm)` and `var(--space-4)`, never a raw `rem`.

## The scale

| Token | Value | Used for |
| --- | --- | --- |
| `--type-size-xs` | 12px to 13px | Metadata, captions, table headers, nested contents links |
| `--type-size-sm` | 13px to 14px | Secondary text, callouts, table cells, code |
| `--type-size-base` | 17px | Body text, descriptions, list items |
| `--type-size-lg` | 19px to 20px | Third-level headings, lead text |
| `--type-size-xl` | 22px to 24px | Section headings |
| `--type-size-2xl` | 28px to 32px | Page headings on list and record layouts |
| `--type-size-3xl` | 36px to 40px | The article title |
| `--type-size-display` | 40px to 72px | The home page title |

Sizes below `base` and above it step with the viewport through `clamp()`; body text is fixed at 17px so a paragraph never reflows between widths.

## Line height and measure

| Token | Value | Used for |
| --- | --- | --- |
| `--type-leading-body` | 1.65 | Paragraphs and lists |
| `--type-leading-ui` | 1.5 | Descriptions, table cells, and chrome text |
| `--type-leading-snug` | 1.3 | Section headings |
| `--type-leading-heading` | 1.2 | Smaller headings |
| `--type-leading-display` | 1.1 | The article and home titles |
| `--type-leading-code` | 1.65 | Code blocks; 1.45 when `brand.density` is `compact` |
| `--type-measure` | 66ch | The width of a paragraph, list, and heading |

Prose, headings, and lead text share one measure, so a heading never sticks out past the paragraph beneath it. Tables, code, and figures use the full column.

## Block spacing

Blocks in the article column are separated by `--space-5` (20px). A heading sits closer to the text it introduces than to the block before it, and a heading directly after another heading takes a small gap instead of a full section break. `brand.density: compact` scales every `--space-*` step by 0.75, so the rhythm tightens as one system.

## Checks

`npm run type:ratchet` counts raw `font-size`, raw `line-height`, and `@apply text-*` in `styles/src/`. The count may only go down: a new raw value fails the check, and so does a fixed one that leaves the baseline stale, so the baseline in `test/type-ratchet.json` always tells the truth. `npm run test:type` builds this site and checks in Chromium that the article stays inside a 320px viewport at a 200% root font size, and that print keeps the body size and line height.

## Upgrading

The class names, the HTML, the Markdown, and `llms.txt` of every page are unchanged. Only the CSS moves, so a site that bumps the package gets the new rhythm without editing a file.

What reflows:

- Body text grows from 16px to 17px, and block spacing moves to the 20px step. Long pages get a little taller.
- Line height in tables, descriptions, and chrome text is a single 1.5 instead of a mix of fixed lengths.
- The measure is 66ch everywhere. Pages that used a narrower or wider reading column now match the article.
- `--type-measure-min` and `--type-measure-max` are removed; use `--type-measure`.

A site with visual baselines should refresh them once after the upgrade and review the diff for the points above. A site that overrides `--type-size-*` or `--space-*` keeps its values. A site that wants the old body size sets `--type-size-base: 1rem` in its own stylesheet.
