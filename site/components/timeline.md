---
title: Timeline
description: Rows on a shared time axis, from a collection or an inline JSON array, with phases, status tones, and a readable table.
layout: doc
permalink: /components/timeline/
---

A timeline puts rows on one time axis, so the reader can compare when work started and ended. Each row is a table row with its label, start, end, and status as text, and a bar on the axis beside it. A row can also list phases: shorter bars inside the row, one per phase, with a legend that names each phase once.

The table is the timeline. The axis and the bars are decoration marked `aria-hidden`, so a reader with a screen reader, a printed page, or no JavaScript gets the same dates and the same statuses.

## Syntax

Rows come from a collection with `from`, or from a JSON array in `items`:

```markdown
::timeline{from=events}

::timeline{items='[{"label":"Research","start":"2026-01-05","end":"2026-02-13","status":"done"}]' caption="Example rollout"}
```

A collection row uses the fields `label`, `start`, `end`, and `status` by default, and its label links to the record's page when the collection has one. A row with a `phases` list draws those phases instead of one bar:

```json
[
  {
    "label": "Research",
    "start": "2026-01-05",
    "end": "2026-02-13",
    "status": "done",
    "phases": [
      { "label": "Interviews", "start": "2026-01-05", "end": "2026-01-30", "status": "done" },
      { "label": "Analysis", "start": "2026-01-26", "end": "2026-02-13", "status": "done" }
    ]
  }
]
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `from` | string | none | The collection to read. Required unless `items` is given. |
| `items` | string | none | A JSON array of row objects, each with the label, start, end, status, and optional phases fields. |
| `phases` | string | `phases` | The field holding a row's phases: a JSON list of objects with the same label, start, end, and status fields. |
| `label` | string | `label` | The field holding a row's label. |
| `start` | string | `start` | The field holding a row's start date. |
| `end` | string | `end` | The field holding a row's end date. |
| `status` | string | `status` | The field holding a row's status. The site's status options give it a tone. |
| `caption` | string | none | The table's caption, and the name of its scroll region. |

Field names apply to rows and phases alike, so `start=begins end=ends` reads a collection that names its dates differently. An empty name falls back to the default.

## Example

::timeline{items='[{"label":"Research","start":"2026-01-05","end":"2026-02-13","status":"done","phases":[{"label":"Interviews","start":"2026-01-05","end":"2026-01-30","status":"done"},{"label":"Analysis","start":"2026-01-26","end":"2026-02-13","status":"done"}]},{"label":"Pilot","start":"2026-02-16","end":"2026-04-10","status":"done","phases":[{"label":"Build","start":"2026-02-16","end":"2026-03-20","status":"done"},{"label":"Trial","start":"2026-03-16","end":"2026-04-10","status":"active"}]},{"label":"Rollout","start":"2026-04-13","end":"","status":"active","phases":[{"label":"Launch","start":"2026-04-13","end":"","status":"active"}]}]'}

The first two rows have overlapping phases, so the row says which phases overlap in text. The third row has no end date: its bar stays open to the end of the axis, and its end cell reads "Ongoing".

## Dates and missing data

A date must be ISO 8601, such as `2026-04-13` or `2026-04-13T09:00:00Z`. A value that is not a date shows a visible message naming the field and the value instead of a blank cell, so a typo is never read as a real date.

A row with a `start` key whose value is empty is ongoing: the cell says so and the bar has an open end. An absent key is a mistake, not an open end, and shows the missing-field message. A row with no usable date at all still appears in the table, with no bar, and the timeline draws no axis when no row has a date.

## Without JavaScript

The table, the bars, the axis ticks, the legend, and the overlap messages are built at page load. Without JavaScript the reader sees the same rows, dates, statuses, and phase names, and the table scrolls in its labelled region on a narrow screen.

The only addition from JavaScript is the "Today" marker on the axis, drawn from the reader's clock; the build never reads the clock and never marks a day on its own. A narrow timeline, measured by its container rather than the viewport, drops the axis column and keeps the table, so no information depends on the chart.

## Notes

- A status is shown as written. The theme's status options decide its tone, and an unmapped value keeps the neutral tone.
- Overlap is checked between the phases of one row only. Phases in different rows may share days freely.
- A phase's label is its legend entry; the same label in several rows appears in the legend once.
- A collection that does not exist, or a field name the records lack, shows a visible message instead of an empty timeline.
- The axis scales to the rows it has. Wide ranges get year ticks and shorter ranges get quarters, in the site's calendar and the page language's digits.
