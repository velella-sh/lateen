---
title: Citation
description: A copyable citation with the work's title, address, and available source and date.
layout: doc
permalink: /components/citation/
---

A citation names the work a record or article comes from: its title, a visible address, and, when the page has them, the source's identifier and date. The reader can copy the whole citation, and the same parts stay in the printed page.

## Syntax

```markdown
::citation{source="alpha" date="2026-01-12"}
```

`citation` is a leaf directive: it has no body and takes every value from the page or its attributes.

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `title` | string | the page title | The work's title. |
| `url` | string | the page's absolute URL | The address shown and copied. An `http(s)` URL or a root-relative path; an unsafe value is left out. |
| `source` | string | the record id | The source's identifier, such as a record slug. |
| `date` | ISO date | the record's first configured date | The work's date, formatted in the page language's calendar. |

The page title and address fill `title` and `url`, so `::citation` alone already cites the page. On a record page the record's id and its collection's first readable date fill `source` and `date`; a part with no value is left out rather than shown empty.

## Example

::citation{source="alpha" date="2026-01-12"}

## What the reader sees

The citation is one sentence: the title, the address as visible text, `Source:` and the identifier, and the date. The address is isolated with `dir="ltr"`, so it stays readable inside an RTL sentence. A long address wraps inside the sentence instead of widening the page.

## Copying and printing

The copy button is added by the island, so it appears only when JavaScript runs; it copies the same text the reader sees and confirms with "Citation copied". Without JavaScript the citation is plain, selectable text. In print the copy button is hidden, the address stays visible, and the sentence does not split across pages.
