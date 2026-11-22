---
title: Dated list
description: Records grouped by month in the site's calendar, with a range, a table of contents, and feed and calendar links.
layout: doc
permalink: /components/dated-list/
---

A dated list groups records by month, using the site's calendar. Each group has a heading,
each record gets a date, and records without a usable date are kept in a trailing section instead of
disappearing. The list can also show a fixed range of months, a table of contents, and links to a feed
or calendar of the same records.

## Syntax

```markdown
::dated-list{from=posts date=published status=state}
```

or give the rows directly:

```markdown
::dated-list{items='[{"date":"2026-01-05","label":"First entry","url":"/posts/first/"}]'}
```

## Options

| Option | What it does |
| --- | --- |
| `from` | The collection to read. Required unless `items` is given. |
| `items` | A JSON array of `{ date, label, url?, status? }`, for a list that is not a collection. |
| `date` | The field holding a record's date; `date` when omitted. |
| `status` | The field holding a record's status; omitted means no status is shown. |
| `order` | `asc` lists the oldest group first; `desc` lists the newest first. |
| `level` | Heading level for the groups, `2` by default; a level that would skip one falls back to `2`. |
| `group` | `year` adds a year heading above each year's months. |
| `toc` | `true` puts the groups in a table of contents above the list. |
| `start` | First day of a fixed range of months, such as `2026-01-01`. |
| `months` | How many months the range covers, counting the month of `start`; ignored without `start`. |
| `feed` | Address of a feed of the same records, shown as a Subscribe link. |
| `calendar` | Address of an iCalendar file, shown as an Add to calendar link. |

## Live example

::dated-list{items='[{"date":"2026-02-11","label":"A first entry","url":"/books/alpha/"},{"date":"2026-01-27","label":"A second entry"},{"date":"2025-12-18","label":"An older entry"},{"label":"An entry with no date"}]' toc=true}

## Without JavaScript

Every group, date, record, and the trailing undated section are in the HTML. The jump link is added
by the island and stays hidden until it runs; the feed and calendar links are plain links and work
without it.

## Accessibility

Groups are real headings in order, each date is text, and the status keeps its label. The undated
section is named rather than silently dropped. The jump link is hidden until the island runs, and
the date dot keeps its shape in forced colors.
