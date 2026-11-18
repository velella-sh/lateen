---
title: Glossary
description: An alphabetical list of a collection's terms, and an inline term whose definition opens in place.
layout: doc
permalink: /components/glossary/
---

The glossary turns the records of one collection into an alphabetical page. In running text, `:term[…]` shows one
term as a native disclosure: its definition and its entry link open without JavaScript.

## Syntax

```markdown
::glossary

A :term[Widget] is composed into a page. Write :term[control]{id=widget} when the visible text differs from the
term's id.
```

`::glossary` reads the collection named by `theme.options.glossary.collection` and renders nothing on a site with
no terms.

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `id` | string | the visible text | The term's record id. |

## Theme options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `theme.options.glossary.collection` | string | none | The collection that holds the terms. Without it neither the list nor a term renders. |
| `theme.options.glossary.page` | string or object | none | The page that carries `::glossary`, or a mapping keyed by language. A term links to its entry there; a term whose collection is built as pages links to its own record page instead. |

## Example

::glossary

A :term[Widget] is one example, and :term[pipeline] is another. Every term may carry other names, so a writer can
say :term[control] and still reach the Widget entry. An unknown term such as :term[nosuch] keeps its text and shows
a marker.

## Without JavaScript

The inline term is a native `<details>` element. Its summary is the term, and the definition and link are ordinary
content, so a reader without JavaScript opens it with a click, Enter, or Space. A term with no known definition is
plain text with a visible `?`; nothing is shown on hover alone.

## Notes

- Terms come from `site.collections`. The record fields are `term`, `definition`, and `aliases`, and each may be a
  mapping keyed by language.
- The lookup ignores case and the Arabic/Persian letter forms: `كتاب` and `کتاب` are the same term.
- The glossary sorts with the page language's collation, so Persian and Arabic pages keep their own alphabet.
- The definition is shown as the author wrote it; its Markdown is not rendered inside the panel.
- A record page already carries the site's base path; the glossary page option gets it when the theme builds the
  link.
