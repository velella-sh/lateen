---
title: "Book {title}"
layout: record
record:
  summary: summary
  status: status
  facts:
    - field: author
      label: Author
    - field: published
      label: Published
      kind: date
    - field: derived.daysLeft
      label: Days left
      kind: days
    - field: derived.state
      label: State
      kind: status
---
# :field[title]

:field[summary]

## History

:::changes
- :field[type] :field[record]
:::
