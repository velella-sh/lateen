---
title: Add to calendar
description: A download link for a record's .ics file and a subscribe link for the calendar it belongs to.
layout: doc
permalink: /components/add-to-calendar/
---

The record layout places this control under the title of a record page. It is not a directive: a
template never writes it, and a record with no calendar renders nothing, so a site that sets no
calendar keeps exactly the page it built before.

[Alpha](/books/alpha/) is the live example: the books calendar gives it an `.ics` file of its own
and a `webcal` subscribe address.

## What it shows

- **Add to calendar** downloads the record's own `.ics` file, when the engine wrote one.
- **Subscribe** opens the calendar that holds the record in the reader's calendar app, when the site
  configured one with both an `https` file and a `webcal` address.

Both are plain links in the HTML. The visible text stays short, and the accessible name carries the
record title, so a page that shows several records never offers two links named the same thing.

## Inputs

The layout fills these from the record; a template does not write them.

| Input | What it is |
| --- | --- |
| `calendar` | The record's own `.ics` file, root-relative. The control adds the site's base before linking it. |
| `calendars` | The calendars the record has events in, each with a name, a title, an `https` file, and a `webcal` address. The first safe one supplies the subscribe link. |

## Collection setup

The engine writes the files; the theme only links them. The collection names its date fields, and a
calendar lists the records of that collection. Both keys need Mizzen 0.2.3 or later.

```yaml
collections:
  books:
    source: _data/books.yml
    id: slug
    template: _templates/books.md
    permalink: /books/{id}/
    dates: [published]

calendars:
  books:
    collection: books
    events:
      - name: published
        field: published
        title: "{title} published"
```

A record with no date in the calendar's field gets no calendar file and no link. A calendar without a
`webcal` address keeps the download link and drops Subscribe.

## Theme options

None: the control reads no `theme.options` key. Its words come from the theme's translations in the
page language, and its address comes from the collection and the calendar.

## Without JavaScript

The download and subscribe links are plain HTML and work with no script. Nothing is copied,
remembered, or fetched in the browser.

## Notes

- Only a root-relative path or an `https` address is linked; `javascript:`, `http:`, protocol-relative
  addresses, and a `webcal` address that is not `webcal://` are refused.
- The icon is decorative and hidden from assistive technology; the link text and its accessible name
  carry the action.
- A record can belong to several calendars; the control offers Subscribe for the first one whose
  addresses are safe and does not repeat the link.
