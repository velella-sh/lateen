---
title: Charts
description: Bar, stacked bar, and line charts drawn as fixed SVG at build time, each with the same values in a table.
layout: doc
permalink: /components/charts/
---

Three directives draw a chart from a collection or a list in `_data`: `::bar-chart` for one number per category, `::stacked-bar` for parts of a whole, and `::line-chart` for values over time or along a number. The SVG is written at build time, so the chart needs no script, no fetch, and no work on the reader's device.

Every chart keeps the rows it plots in a table under the figure, so a reader, an agent, or a printer gets the numbers even when the drawing does not fit. The bar chart's table also offers the rows as CSV and JSON.

## Syntax

```markdown
::bar-chart{from="charts.signups" category="quarter" value="signups" title="Signups by quarter"}

::stacked-bar{from="charts.revenue" category="quarter" series="region" value="revenue" title="Revenue by quarter and region"}

::line-chart{from="charts.growth" category="date" value="free,paid" title="Active users by month"}
```

Each is a leaf directive: put it on its own line, with a blank line before and after. A quoted attribute can hold spaces and commas.

## Bar chart options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `from` | string | required | Collection name, or path in `_data` (dots or slashes) that holds the rows. Without one the chart says it has no source. |
| `category` | string | `id` | Field holding the category label. Nested fields use dots. |
| `value` | string | `value` | Field holding the number. A number or a numeric string counts; anything else is a gap. |
| `direction` | `horizontal` or `vertical` | `horizontal` | Which way the bars run. An unknown value is horizontal. |
| `title` | string | `Bar chart: <from>` | The chart's accessible name and its caption. |
| `id` | string | the source path | Id of the figure. It also names the downloaded files, so give one when two charts read the same source. |

## Stacked bar options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `from` | string | required | Collection name, or path in `_data` (dots or slashes) that holds the rows. Without one the chart says it has no source. |
| `category` | string | `id` | Field holding the bar's category label. Nested fields use dots. |
| `series` | string | `series` | Field holding the segment's series name. Each distinct name gets a colour and a legend item. |
| `value` | string | `value` | Field holding the segment's number. Nested fields use dots. |
| `title` | string | `Stacked bar chart: <from>` | The chart's accessible name and its caption. |
| `id` | string | the source path | Id of the figure. Give one when two charts read the same source. |

A stacked chart reads one row per segment: the category, the series, and the value. At most eight series are coloured; a source with more shows a visible note instead of a chart.

## Line chart options

| Option | Type | Default | What it does |
| --- | --- | --- | --- |
| `from` | string | required | Collection name, or path in `_data` (dots or slashes) that holds the rows. Without one the chart says it has no source. |
| `category` | string | `id` | Field holding the position on the axis: a date or a number. Nested fields use dots. |
| `value` | comma-separated fields | `value` | One or more fields holding the numbers; each field is a series. Nested fields use dots. |
| `title` | string | `Line chart: <from>` | The chart's accessible name and its caption. |
| `id` | string | the source path | Id of the figure. Give one when two charts read the same source. |

Dates are read as `YYYY-MM-DD`. A date axis uses the timeline's scale and ticks, labelled by quarter or year; a number axis fits the range of the data.

## Example

A bar chart from `_data/charts.json`, with the default horizontal bars:

::bar-chart{from="charts.signups" category="quarter" value="signups" title="Signups by quarter"}

The same source drawn vertically. The second chart takes an explicit `id`, so the two figures, their tables, and their downloads stay distinct:

::bar-chart{from="charts.signups" category="quarter" value="signups" direction="vertical" title="Signups by quarter, vertical" id="signups-vertical"}

One bar per category, one segment per series. The legend and the table use the order the series first appear:

::stacked-bar{from="charts.revenue" category="quarter" series="region" value="revenue" title="Revenue by quarter and region"}

Two series from one row per date. A missing value breaks the line instead of joining across it:

::line-chart{from="charts.growth" category="date" value="free,paid" title="Active users by month"}

## The data table

The bar chart's table is in a closed "View the data as a table" disclosure under the figure, with a sentence that says what the chart shows and links to download the same rows as CSV and JSON. Both files are serialized while the page is built and carried in the link, so no request is made to download them; they are named from the chart's `id` and hold the raw numbers, not the page's formatted text.

The stacked bar and line charts show their table under the chart instead of in a disclosure. Every table has a caption with the chart's accessible name, a header for the category column, and one header per series. A row with no value says "No value" rather than disappearing, so the table always accounts for every row the chart read.

## Without JavaScript

All three directives render plain SVG and plain HTML at build time. The bar chart's disclosure is a native `<details>`, and its download links carry their bytes in the `href`; nothing is drawn with canvas, fetched, or computed in the browser. A reader without JavaScript sees the same chart, the same table, and the same downloads. Print opens a closed disclosure, so the bar chart's numbers reach paper too.

## Notes

- A source that is absent or has no rows produces a visible note, never an empty frame.
- A value that is not a finite number is a gap: the bar has no bar, the line breaks, and the table says "No value".
- Colours come from the chart tokens, separate from the status and callout colours, and follow the theme in light and dark.
- Numbers use the page's number formatting, and labels follow its direction; a date axis keeps the calendar's order.
- A collection is read before `_data`, so the same name in both resolves to the collection.
