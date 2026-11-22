---
title: List layout
description: A page that lists a collection's records as a record table, cards, or a dated list.
layout: list
permalink: /layouts/list/
list:
  collection: books
---

The `list` layout shows the records of a collection: an index a reader scans rather than a page they read top to bottom. This page is itself a list, so the table at its foot is the live example, built from a small invented `books` collection.

## When to use it

Use `list` for an index of records that share a shape: posts, releases, events, people. Use `doc` for a page that explains, and `guide` for a task with steps. The records come from a collection the engine selects; the layout only decides how they look.

## Options

A list page must name the collection it shows with `list.collection`; the engine's `list` block selects, filters, sorts, groups, and paginates those records. The layout itself reads two optional keys.

| Name | Type | What it does |
| --- | --- | --- |
| `list.view` | `table`, `cards`, or `dated` | The view that draws the records. Unset or unknown, the page uses the table. |
| `list.date` | string | The field the `dated` view reads for its dates. Unset, it reads `date`. |
| `list.columns` | list | The table's columns, in order: each names a `field`, an optional `label`, `kind`, and `filter`. Unset, the first record's fields name them. |

```yaml
title: Books
layout: list
list:
  collection: books
  view: cards
  date: published
```

The engine also reads `where`, `sort`, `group`, `perPage`, `splitGroups`, `fields`, and `expand` under `list`; they shape the records before this layout sees them. This page uses none of them.

## Views

### Table

The default view draws one table row per record. The columns are the fields the records name, in the order the first record lists them, so the same page changes shape when the collection's fields change. `list.columns` names them instead; an entry may read a derived value as `derived.<name>`, and `kind: days` shows the engine's signed day count. The first cell links to the record's page when the record has one. With no records the page says the list is empty instead of drawing an empty table.

### Cards

`view: cards` draws one card per record. A card reads `title`, `summary`, and `status` by name, then shows the first three other non-empty fields as a small definition list. A record with no `title` falls back to its id. A record with no page is a card without a link.

### Dated

`view: dated` draws the records as a dated list, grouped by the month of `date`'s field. The oldest month comes first, a record with that field empty goes to the undated section, and a paginated list names the page where the dates continue. A `status` field shows as a badge. When the archive spans more than three calendar months, the layout puts a table of contents above the list with one link per month. Those links are part of the built HTML, so each one reaches its month's heading without JavaScript.

### Changes

A changelog page the engine builds for a collection (a list page the site serves under the
collection's `.changes` route) shows the recorded events instead of the records: one row per event,
grouped by the engine's dates, with the event's type as a badge and the changed field, its old value,
and its new value beside it. An event whose `type` the theme has no tone for still renders with its
type as text. With no events the page says the history is empty.

The page also links the collection's Atom feed when the engine wrote one. Both the events and that
feed need Mizzen 0.2.5 or later.

## Calendars and feeds

The subscribe panel lists each published collection calendar and each calendar for the list’s group
field. Each row has a `webcal` link, a download link, and the full `https` address. A copy control
appears when JavaScript runs and announces the result in a live region. Dated lists use the same
panel.

## Groups and pagination

When the engine groups the records, the layout gives each group its own section, heading, and count, and adds those headings to the page's table of contents. A grouped page does not draw a table across groups. Pagination comes from the engine too: the layout adds the page links and, on page two onwards, says which page of how many the reader is on.

## Without JavaScript

The table and its cells, the cards, the dated and group headings, the count, and the pagination links are all built at build time. Without JavaScript the reader sees the same records and the same links. Sorting and filtering belong to the record table's browser client: their controls stay hidden until the script runs, so a reader without it sees the full table and no control that would do nothing.

## Notes

- The engine decides the order. Sorting in the browser reorders only the rows already on the page, so a paginated list keeps the engine's order.
- A field name the records do not carry shows a visible missing-field note in its cells rather than an empty cell.
