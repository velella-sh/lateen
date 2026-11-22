---
title: Gallery layout
description: A collection as a grid of cards, with facet filters, a sort choice, a count, and an empty note.
layout: gallery
permalink: /components/gallery/
list:
  collection: books
---

This page is the live example: the `gallery` layout turns the site's books into cards, draws the
filters its collection declares, and offers the sort keys it declares. The filters and the sort are
ordinary links, so the page still reads and navigates without JavaScript.

## Options

| Option | Type | What it does |
| --- | --- | --- |
| `list.collection` | string | The collection whose records become cards. Required; a page without list data renders its title and body alone. |
| `collection.search.filters` | string list | Fields offered as facet filters, with the number of records that hold each value. A field with no values draws no group. |
| `collection.search.sort` | string list | Fields offered as sort choices. The first is the default ascending order; the address can choose another and flip it. |
| `theme.options.gallery.addCard` | object | An optional closing card with a `label` and a `link`. |
| `reportArchive.latest` | string | The path of the latest report list for this collection. The layout locates a list ending in `/latest/` by default. |

The collection declares the filter and sort fields in the site config, so the gallery and the site
search offer the same vocabulary:

```yaml
collections:
  books:
    source: _data/books.yml
    id: slug
    search:
      filters: [format, published]
      sort: [title, published]

theme:
  options:
    gallery:
      addCard:
        label: Add your project
        link: /gallery/new/
```

## Front matter

```yaml
---
title: Book gallery
layout: gallery
list:
  collection: books
---
```

The page body is the introduction above the grid. Each record's `title`, `summary`, and `status`
become the card's parts, and its first other fields become facts; a record without a title is
titled by its id.

## Report archives

Use `layout: gallery` and a list over the report collection. Include `date` and `commit` in the gallery
and latest lists. The latest list should use `sort: date desc` and `perPage: 1`. Its first run gets a
Latest run badge in the gallery. If the latest page has another path, set `reportArchive.latest`
in the gallery’s front matter.

Each run card shows the date and abbreviated commit. It links to the full commit on a configured
GitHub or GitLab repository. Store that run’s snapshot with the record as `inputs` to show its
source, revision, capture time, tool, or schema. For a collection with a public-field policy, include
the specific input fields you want readers to see. Archived record pages link to the latest list.

The date controls filter the visible runs inclusively on the current page. The cards and their links
are available before the controls load.

## Without JavaScript

Every choice is a link to the same page with a query string: `?filter.format=hardcover` narrows the
facet, `?sort=published&order=desc` changes the order, and `?filter.format=hardcover&sort=title`
keeps both. The chosen value is marked with `aria-current`, and the clear link removes the filters
while keeping the sort.

The count above the grid says how many cards the current view shows, and a note appears when no
record matches. With a script, the gallery filters in place and replaces the address rather than
reloading; back and forward restore the shared view, and the count is announced. Without one, the
links still work and the whole collection stays readable.

## Notes

- The collection declares facet filters and sort keys. Report galleries also offer a date range.
- Filters combine across fields; within one field the chosen value replaces the previous one, and
  choosing it again clears it.
- The grid uses the list layout's cards and the shared focus ring.
- The filter and sort controls are hidden in print; the cards and the count print.
