---
title: "{name}"
description: "{summary}"
layout: record
record:
  summary: summary
  status: status
  facts:
    - field: category
      label: Category
    - field: added
      label: Added
      kind: date
    - field: updated
      label: Updated
      kind: date
    - field: weight_grams
      label: Weight
      kind: number
    - field: pieces
      label: Pieces
      kind: number
    - field: tags
      label: Tags
      kind: list
---
:field[summary]

Every value on this page is a field of the record in `_data/kits.yml`. The [catalogue](/catalogue/)
lists the whole collection.

Change the record and rebuild; the page and its row in the list, timeline, and explorer follow.
