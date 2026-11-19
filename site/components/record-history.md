---
title: Record history
description: A record's own change events, newest first, with the date, the event type, and the old and new values.
layout: doc
permalink: /components/record-history/
---

The record layout places the record's history after the body, as its own section. The engine keeps
the events in `data-changes/<collection>.jsonl`, and it supplies them to the page only when the
record template shows the `:::changes` marker. A record with no event renders nothing.

[Alpha](/books/alpha/) is the live example: the books collection has a short history file.

## What it shows

- The date of each event, in the page language's calendar.
- The event type: added, removed, changed, renamed, or imported, in the page language.
- For a changed field, the field's name and the old and new values, as `del` and `ins` so the change
  is readable without colour.
- For a rename, the earlier id; for an import, how many records the snapshot held.

The newest events stay in view and the rest go behind a native disclosure. The order is the order the
engine supplies: newest first.

## Option

One key, read from the site's theme options:

| Option | What it does |
| --- | --- |
| `limit` | How many events stay in view before the disclosure. A whole number of 1 or more; `5` by default. |

```yaml
theme:
  options:
    history:
      limit: 3
```

## Collection setup

Write one event per line in `data-changes/<collection>.jsonl`, at the site root. Each line follows
Mizzen's change-event schema: `id`, `type`, `record`, `date`, and the keys the type needs, such as
`field`, `old`, and `new` for a change.

```json
{"id":"8d1f0c2a4b6e1357","type":"changed","record":"alpha","field":"status","old":"draft","new":"shipped","date":"2026-02-01"}
```

Show the marker in the template body; the layout draws the section from the events the engine then
attaches to the page:

```markdown
# :field[title]

The body of the record.

:::changes
:::
```

The marker itself renders no visible list when it has no body; the layout's section is the view. A
collection without a history file, and a page whose record has no event, are unchanged. Both the
`:::changes` marker and `record.changes` need Mizzen 0.2.4 or later.

## Without JavaScript

The section, its dates, its labels, and the disclosure are HTML at build time. The disclosure is the
browser's own `details` element, so it opens and closes with no script.

## Notes

- The component composes each sentence from the event type and values because the engine's change
  event carries no summary text; it moves to the engine's summary when the contract gains one.
- The template marker is opt-in, so a site can keep the history in its data and show it only on the
  records whose template asks.
- The date is the snapshot's date, not the day the page was built.
