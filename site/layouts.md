---
title: Layouts
description: "The page layouts Lateen provides, and how a page picks one."
layout: doc
permalink: /layouts/
---

A page picks a layout with `layout` in its front matter, or gets one from `defaults` in the site config. `mizzen build` uses `doc` when neither sets one.

| Layout | What it renders |
| --- | --- |
| `base` | The document shell: `<head>`, skip link, theme script, and slots for the header, sidebar, main column, aside, and footer. The other layouts build on it; a page does not name it. |
| `doc` | The docs page: header, sidebar, breadcrumb, article, table of contents, pager, and page footer. Front matter `status`, `since`, and `replaced_by` add the page-status banner. |
| `gallery` | The collection page: one responsive card per record, with facet filters, a sort choice, a count, and an empty note. [Gallery layout](/components/gallery/) is a live example. |
| `guide` | The task page: the docs shell with a summary bar from `guide.from`, `guide.to`, `guide.time`, and `guide.risk`, reading time, and related guides. [Guide layout](/components/guide/) is a live example. |
| `home` | The docs home: a hero, action buttons, and section cards from `hero`, `actions`, and `sections` in front matter. |
| `list` | The list page: a collection's records as a table, cards, or a dated list, with groups, a count, pagination, and an empty note. [List layout](/layouts/list/) is a live example. |
| `not-found` | The 404 page, with a search form and links to the home page and the top-level sections. |
| `record` | One record from a data collection: title, summary, status, a facts panel, and the body's sections. [Record layout](/layouts/record/) is the reference and a live example. |
| `versions` | The versions index: a page's versions from `site.data.versions` or the `versions` front matter key, each row linked to the same page when it exists and marked with Latest, Deprecated, or Dev in text. |

The `home` layout can also build a showpiece page from a hero, a stat strip, a feature grid, a framed demo, and a closing call to action. [Showpiece home](/showpiece/) is a live example, with every front-matter key and an adoption checklist.

Each layout is `layouts/<name>.ts`; the rules for adding one are in `layouts/README.md`.

The `search-results` layout also carries the [ask your agent](/ask-agent/) section, which hands a
question from search to the reader's own agent.
