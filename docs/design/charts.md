# Charts

How Lateen draws charts, and what a chart never does. This note is the source of the limits the chart tests use.

## Decision

A chart is **fixed SVG written at build time**, like `timeline`. It ships **no script**, uses **no chart
library**, and has **a data table under it**. The SVG reads fully without JavaScript, in print, and for an
agent that reads the HTML.

## Chart kinds

| Component | Draws |
| --- | --- |
| `bar-chart` | One value per category, as bars. |
| `stacked-bar` | Several series per category, stacked in one bar. |
| `line-chart` | One or more series over an ordered axis. |

All three are built from one collection or table of Mizzen data (`mizzen:data-sources-12`).

## Largest size

A chart handles up to:

- 24 categories (bars) or 60 points (line);
- 8 series, the number of categorical colours (`chart-cat-1` to `chart-cat-8`);
- 100 table rows are shown under it; more rows are paged by the data table, not drawn.

Past a limit the build reports an error instead of drawing a crowded chart.

## Labels

A chart shows a title (the figure caption), axis titles, tick labels on both axes, one value label per
bar or end-of-line point when there is room, and a legend for more than one series. Numbers and axes are
localized (Persian and Arabic digits, mirrored axes in RTL). The accessible name is the title; the table is the
text alternative.

## Colour

Series colours come from `tokens/chart.json`, never from `state`, `status`, or callout tokens. Every colour
reaches 3:1 on the canvas and stays distinguishable under protanopia, deuteranopia, and tritanopia. Each series
also has a pattern fill (`chart-pattern-*`) used in print and in forced colours.

## A chart never

- animates;
- fetches data on the reader's device;
- computes, sorts, or aggregates on the reader's device;
- needs JavaScript to be read, to show its data, or to download it.
