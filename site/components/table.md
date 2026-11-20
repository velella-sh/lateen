---
title: Table
description: Markdown tables in an overflow-aware, keyboard-scrollable region, styled by the theme.
layout: doc
permalink: /components/table/
---

A table shows data in rows and columns. The theme wraps every Markdown table in a scroll region, so a wide table scrolls inside the article instead of widening the page. A table that fits gains no extra tab stop and no landmark when the theme's island runs; a wide table stays focusable and, when it has a caption, is named.

## Syntax

A GFM pipe table:

```markdown
| Environment | Target |
| --- | --- |
| staging | `s3://staging` |
| production | `s3://production` |
```

There is no directive.

## Options

Markdown tables take no options. GFM has no caption syntax, so a Markdown table has no region name and is not announced as a landmark; it still gets the focusable scroll region when it overflows. That keeps a page from collecting repeated generic "Table" landmarks.

When a component renders the table directly, it can pass:

| Name | Type | Default | Meaning |
| --- | --- | --- | --- |
| `caption` | string | none | The visible caption, and the region's name when `label` is absent. |
| `description` | string | none | A sentence after the table, referenced by the region's `aria-describedby`. |
| `label` | string | none | The region's accessible name; it wins over `caption`. |

A table with neither a caption nor a label stays keyboard-scrollable but unnamed. Empty strings emit nothing.

## Example

| Environment | Target | Hooks |
| --- | --- | --- |
| `staging` | `s3://beacon-staging` | none |
| `production` | `s3://beacon-prod` | `after` |

## Notes

- Keep the table narrow enough to scan. For two columns of prose, a definition list or two paragraphs may read better.
- The alignment row is required; `---` on its own is enough.
- Inline code in cells is the clearest way to name a field, a path, or a value.
- A table is never a layout tool; use [steps](../steps/) or a list for a sequence.
- Without JavaScript the wrapper stays focusable, so a wide table can still be scrolled with the arrow keys. With JavaScript it drops that tab stop whenever the table fits, and adds it back when the viewport, zoom, or text size makes the table overflow.
- One shared resize observer serves every table on the page, so a long page does not pay for an observer per table. When the browser has no observer API, one window resize listener stands in for it. Either one is released when the enhancement is torn down, and a teardown leaves each table showing the state it already had.
