---
title: Compare
description: Records side by side, one field per row, with the differing rows marked.
layout: doc
permalink: /components/compare/
---

A comparison puts records of one collection side by side. Each record is a column, each field is a row, and a row whose values are not all equal is tinted and named in text, so the difference never rests on color alone.

The row headers stick to the start edge and the column headers stick to the top of the scroll region, so a wide or tall comparison keeps its labels in view. On a narrow screen the island shows one record at a time as tabs; without JavaScript the whole table stays readable and scrolls.

## Syntax

```markdown
::compare{from=books ids="alpha,beta" fields='[{"field": "pages", "label": "Pages", "kind": "number"}]'}
```

## Options

- `from` (string, required): the collection to read.
- `ids` (string, required): a JSON array of record ids, or a comma list.
- `fields` (string, required): a JSON array of `{ field, label, kind }`; a bare comma list works too.

## Example

::compare{from=books ids="alpha,beta,gamma" fields='[{"field": "pages", "label": "Pages", "kind": "number"}, {"field": "published", "label": "Published", "kind": "date"}, {"field": "format", "label": "Format"}]'}

## Notes

- An id the collection lacks shows a visible note, so a typo never drops a column silently.
- The island adds a "Show only differences" toggle, and a saved `?compare=diff` link opens the same view.
- A long value wraps inside its column; it does not stretch the table without bound.
