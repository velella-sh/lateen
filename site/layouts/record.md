---
title: Record layout
description: A page for one record of a data collection, with its title, summary, status, facts, and body.
layout: doc
permalink: /layouts/record/
---

A record page shows one row of a collection: a book, a person, a release. The `record` layout draws the record's title and status, an optional summary, a panel of the fields the page asks for, and the body under them. [Alpha](/books/alpha/) is the live example, built from the site's own books collection.

## When to use it

Use the record layout when a page is one record and its front matter can name the fields to show. Use the `doc` layout for a page written by hand, and a table or list component when the reader compares many records. A page that names this layout without record data renders exactly like the `doc` layout, so a missing collection never leaves a bare page.

## Collection setup

The page is built from a collection: the engine reads the data file and renders one page per record from a Markdown template. The layout needs the record, so the collection names a template and a permalink.

```yaml
collections:
  books:
    source: _data/books.yml
    id: slug
    template: _templates/books.md
    permalink: /books/{id}/
```

```yaml
---
title: "{title}"
layout: record
record:
  summary: summary
  status: status
  facts:
    - field: pages
      label: Pages
      kind: number
---
```

The template's `record` front matter names the parts the layout draws; `title` is the page title. A template that writes its own `h1` in the body keeps it and the layout adds no second one.

## Record options

Every key is optional. A key whose value is missing or blank draws nothing rather than an empty box.

| Name | Type | What it does |
| --- | --- | --- |
| `facts` | list | The fields to show in the facts panel, in the order written. An entry names a field, its label, and its kind. |
| `summary` | string | The record field to show as the lead paragraph under the title. |
| `status` | string | The record field to show as a status badge beside the title. |
| `report` | boolean | `true` adds a report link beside every fact, when the site has a report address configured. |

```yaml
record:
  summary: summary
  status: status
  report: true
  facts:
    - field: pages
      label: Pages
      kind: number
    - field: published
      label: Published
      kind: date
```

## Fact entries

Each item under `facts` is one row of the panel.

| Name | Type | What it does |
| --- | --- | --- |
| `field` | string | The record field to read: the collection's id field, or a field the record has. |
| `label` | string | The term in the panel; it is also the name in the fact's report link. |
| `kind` | string | How the value is shown. Absent or unknown values read as text. |

An entry with no field, no label, or a field the record does not have is skipped, so a stale template loses one row rather than breaking the page.

## Fact kinds

A field is shown by its kind. The default is `text`; `status` reads the site's status map and keeps the raw value.

| Kind | What it shows |
| --- | --- |
| `text` | The value as text, with markup escaped. |
| `number` | A number in the page language's digits. |
| `boolean` | `true` or `false` in the page language. |
| `date` | A date in the page language's calendar, with its ISO form in `datetime`. |
| `url` | A site path or an `https` link; anything else reads as text. |
| `list` | A list of values. |
| `status` | A badge from the site's `theme.options.status.values` map. |

## The facts panel

The panel is a description list with one term and one value per fact. It sits after the summary and gets a "Key facts" heading in the table of contents, so a long page can jump to it. When no entry survives, the panel and its heading are left out.

## Without JavaScript

The title, summary, status, facts panel, report links, and body are HTML at build time. Without JavaScript the reader sees the same record and the same values. The copy-Markdown button and the page agent menu are additions that appear when a script runs; nothing on the page depends on them.

## Notes

- A status value must be one the site maps in `theme.options.status.values`; an unmapped value still shows, as written.
- A `summary` or `status` field with no value draws nothing, while a fact with no value shows the localized empty text.
- The layout adds no pager; a record page ends with the body and the page actions.
