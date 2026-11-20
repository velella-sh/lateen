---
title: Layouts
description: "The page layouts Lateen provides, and how a page picks one."
layout: doc
permalink: /layouts/
---

## Choosing one

A page picks a layout with `layout` in its front matter, or gets one from `defaults` in the site config. `mizzen build` uses `doc` when neither sets one.

## Reading

| Layout | What it renders |
| --- | --- |
| `doc` | The docs page: header, sidebar, breadcrumb, article, table of contents, pager, and page footer. Front matter `status`, `since`, and `replaced_by` add the page-status banner. |
| `home` | The docs home: a hero, action buttons, and section cards from `hero`, `actions`, and `sections` in front matter. |
| `guide` | The task page: the docs shell with a summary bar from `guide.from`, `guide.to`, `guide.time`, and `guide.risk`, reading time, and related guides. [Guide layout](/components/guide/) is a live example. |
| `base` | The document shell: `<head>`, skip link, theme script, and slots for the header, sidebar, main column, aside, and footer. The other layouts build on it; a page does not name it. |

### Sidebar sibling pages

Set `theme.options.navigation.siblings: true` to list the current page's local sibling pages under its
navigation group. The sidebar reads their titles and URLs from the engine's page list and adds only the
pages the navigation does not already show, so existing links, the current-page marker, and the groups'
open/closed behavior are unchanged. Off by default.

```yaml
theme:
  options:
    navigation:
      siblings: true
```

## Collections

| Layout | What it renders |
| --- | --- |
| `list` | The list page: a collection's records as a table, cards, or a dated list, with groups, a count, pagination, and an empty note. [List layout](/layouts/list/) is a live example. |
| `record` | One record from a data collection: title, summary, status, a facts panel, and the body's sections. [Record layout](/layouts/record/) is the reference and a live example. |
| `post` | A blog post: the docs shell with the date, author, description, highlighted body, and an archive link. The archive and author pages use `list`. [Blog layout](/layouts/post/) is the reference. |
| `gallery` | The collection page: one responsive card per record, with facet filters, a sort choice, a count, and an empty note. [Gallery layout](/components/gallery/) is a live example. |

## Reference

| Layout | What it renders |
| --- | --- |
| `api-reference` | One operation of a pinned OpenAPI document: method, path, parameters, request body, responses, schemas, and examples. [API reference layout](/layouts/api-reference/) explains the generated front matter. |
| `api-reference-index` | The generated reference index: the document title, version, description, and grouped operation links. |
| `versions` | The versions index: a page's versions from `site.data.docsVersions` or the `versions` front matter key, each row linked to the same page when it exists and marked with Latest, Deprecated, or Dev in text. |
| `search-results` | Search results, naming the active scope in an empty state and linking the same query in the other scope, plus the [ask your agent](/ask-agent/) section, which hands a question from search to the reader's own agent. |
| `not-found` | The 404 page, with base-aware home and documentation-search links that work without JavaScript. |

The `home` layout can also build a showpiece page from a hero, a stat strip, a feature grid, a framed demo, and a closing call to action. [Showpiece home](/showpiece/) is a live example, with every front-matter key and an adoption checklist.

Each layout is `layouts/<name>.ts`; the rules for adding one are in `layouts/README.md`.
