# Timeline

How Lateen draws a timeline, what a row looks like in the data, and what the component never does. This note
is the source of the choices the `timeline` epic (#380) builds on (#251). The later tasks (#252 to #261) follow
it and do not reopen it.

## Decision

A timeline is **a table with CSS bars**. Every row of the table is one dated segment, written as text: the
label, the start, the end, and the status. The bar is one decorative cell in the same row, placed by
`inset-inline-start` and `inline-size` in percent of the axis. The table reads without CSS and JavaScript, in
print, and for an agent that reads the HTML. The bars add the picture; they never carry information the text
lacks.

The component ships **no script for drawing**. The only script is the optional island that marks "today"
(#257), which hides without harm when it does not run.

## What was compared

| | Table with CSS bars | Inline SVG | Canvas |
| --- | --- | --- | --- |
| Text equivalent in the same markup | The table is the drawing | Needs a second table next to the drawing | Needs a second table; the drawing is pixels |
| Screen reader | Native table navigation, one reading | Table, plus a drawing to hide or label | Table, plus a bitmap with one label |
| RTL | Logical properties flip the axis with no code | Coordinates are absolute; the build must mirror every `x` and the text anchors | Same as SVG, and text must be drawn right-to-left by hand |
| Print | Bars need a border and a pattern, because browsers drop background colours | Fills print | Prints as a bitmap, blurry when scaled |
| Forced colors | System colours apply to borders and text; bars use `border` and `forced-color-adjust` stays default | Fills need explicit `CanvasText` or `Highlight` rules | Pixels ignore forced colors |
| Needs JavaScript | No | No | Yes |
| Text in the reader's language and font | Yes | Yes, but wrapping is manual | Drawn by script, no wrapping or selection |

The comparison of accessibility, RTL, print, and forced colors follows from how each technique works in the
browser. Only the bytes below were measured.

## Bytes

One prototype of each, written by a throwaway script with the same data (rows × segments per row), with
markup only (no CSS) and a text table in every case, since the rule below needs it. Raw / gzip bytes.

| Data | Table with CSS bars | SVG and table | Canvas, script and table |
| --- | --- | --- | --- |
| 6 rows × 1 segment | 1933 / 295 | 1988 / 398 | 2284 / 487 |
| 12 rows × 2 segments | 6802 / 413 | 6285 / 583 | 7036 / 621 |
| 40 rows × 3 segments | 32702 / 751 | 29008 / 1328 | 32188 / 980 |

Raw bytes are within about 12% of each other, because the table dominates in all three. Compressed, the table
with bars is the smallest at every size, since its rows repeat. It is also the only one that does not need the
table as a second copy of the data: the other two are the table plus a drawing. The CSS for the bars is one
small shared rule set and is not counted per timeline.

## Input shape

A timeline reads **rows**. A row has a label and one or more dated segments. A segment has a start, an end,
and a status.

```yaml
- label: Search rewrite
  segments:
    - label: Design        # optional; defaults to the row label
      start: 2026-01-12    # ISO date
      end: 2026-02-27      # ISO date, optional: a range with no end is open (#256)
      status: done         # a value from the site's status map
    - label: Build
      start: 2026-03-02
      status: active
```

- `label` is plain text, in the page's language.
- `start` and `end` are ISO dates (`YYYY-MM-DD`). The site's calendar sets the tick boundaries and labels
  (#259); it does not change how dates are stored.
- `end` can be missing. The segment then runs to the axis end and is marked open in text, not only in
  shape.
- `status` is a data value, shown with the `status` component's map (`theme.options.status.values`). The
  theme never computes it from the dates.
- The rows come from a collection or from a list inside the page, in the order written. The theme does not
  sort them.

The axis is the span from the earliest start to the latest end in the data, computed in the build (#253).
It never depends on the date of the build.

## Limits

A timeline handles up to 40 rows and 8 segments per row. Past a limit the build reports an error instead of
drawing a crowded chart. A segment whose end is before its start is a build error.

## The component will not

- read the clock at build time: only the browser island draws "today", so the build stays deterministic;
- compute a status from the dates;
- draw anything that has no text equivalent in the same markup;
- need JavaScript to be read, to show its rows, or to show its bars;
- carry meaning in colour alone: the status is always written as text;
- draw dependencies, arrows between segments, milestones as separate marks, or progress inside a bar;
- zoom, pan, drag, edit, or fetch data on the reader's device;
- sort or aggregate on the reader's device;
- animate.
