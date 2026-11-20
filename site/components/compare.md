---
title: Compare
description: Records side by side, one field per row, with the differing rows marked.
layout: doc
permalink: /components/compare/
---

A comparison puts records of one collection side by side. Each record is a column, each field is a row, and a row whose values are not all equal is tinted and named in text, so the difference never rests on color alone.

The row headers stick to the start edge and the column headers stick to the top of the scroll region, so a wide or tall comparison keeps its labels in view. On a narrow screen each field becomes one block, and below its label every compared record gets its own line with the record's title and value; the same table and values stay in place, so the layout adapts without a script.

## Syntax

```markdown
::compare{from=books ids="alpha,beta" fields='[{"field": "pages", "label": "Pages", "kind": "number"}]'}
```

## Options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `from` | string | none | The collection. A missing or unknown collection shows a note. |
| `ids` | JSON array | none | The record ids, in column order. A missing id shows a note. |
| `fields` | JSON array | none | The rows: `field`, `label`, and `kind`. |

`ids` is a JSON array of strings; a comma list also works. `kind` is one of `text`, `number`, `boolean`, `date`, `url`, `list`, or `status` (`text` when omitted or unknown). `label` is the row header and falls back to the field name.

Every option is a directive attribute. The directive takes no body, so put it alone on its own line with a blank line before and after. A value the comparison cannot read shows a note; it never falls back to a table with missing columns.

## Example

::compare{from=books ids="alpha,beta,gamma" fields='[{"field": "pages", "label": "Pages", "kind": "number"}, {"field": "published", "label": "Published", "kind": "date"}, {"field": "format", "label": "Format"}]'}

## What the reader sees

The column header is the record's title, linked to the record's page. The row header names the field, and a row whose values differ gets a tint plus the word "differs" for a screen reader, so color is never the only signal. When the collection names an `evidence` field, each value keeps its own public claim links under it; a value with no claim gets no link, so sources never move between records. The comparison scrolls inside its own region once it is taller than the viewport, and a long value wraps inside its column instead of widening the table without bound.

## Without JavaScript

The built page is the comparison itself: every record, every field, and every difference is in the HTML, and the table scrolls and stays readable. The narrow row layout is CSS only, so every record title and value is already in place. The "Show only differences" toggle, the copy button, and the record pickers are added by the island, so no control appears that would do nothing without it. A saved `?compare=diff` link works once the island runs.
