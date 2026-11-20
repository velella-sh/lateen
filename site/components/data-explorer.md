---
title: Data explorer
description: Search, filter, and sort a collection in the browser, with a search page fallback.
layout: doc
permalink: /components/data-explorer/
---

A data explorer turns a collection's records into a table the reader can search, filter, and sort
without a server. The engine writes the collection's index at build time; the island reads it on the
query field's first focus, so a page no one searches costs no download.

## Syntax

```markdown
::data-explorer{from=books columns=title,pages,published filters=format sort=title,pages}
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `from` | string | none | The collection to read, as the site config names it. A missing collection shows the same note as the record table. |
| `columns` | string | none | The fields the table shows, in order, as `title,pages` or a JSON array with `field`, `label`, and `kind`. |
| `filters` | string | none | The fields the island offers as checkboxes, such as `format,year`. A field with fewer than two values is skipped. |
| `sort` | string | none | The fields the island offers as sort choices, such as `title,pages`. Relevance comes first. |

Every column and sort field must exist in the collection. The table shows the first 50 records before
the island runs, and the button the island reveals continues past them.

Each chosen filter appears as a chip beside the filters. Removing a chip unchecks its filter, moves
focus to that filter's checkbox instead of losing it, and announces the new result count once.

## Example

:::data-explorer{from=books columns='[{"field":"title","label":"Title"},{"field":"pages","label":"Pages","kind":"number"},{"field":"published","label":"Published","kind":"date"},{"field":"format","label":"Format"}]' filters=format sort=title,pages}

## Without JavaScript

The page still shows a table of the collection's first records, and the query form is a plain `GET`
form that submits to the site's search results page with the collection as a filter. The sort control
and the filter box stay hidden, because they would do nothing. With JavaScript, the explorer writes the
query, the chosen filters, and the sort to the address, using the same parameter names as the search
results page, so a shared link restores the same view without adding a history entry per keystroke.
