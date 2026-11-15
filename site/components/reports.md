---
title: Reports
description: Render an accessibility report, a performance budget, and the WCAG checklist from site data.
layout: doc
permalink: /components/reports/
---

The three report components turn the files the gates write into a page. They read one value from
`site.data`, render plain server-side HTML, and add no client script: the whole report is readable
without JavaScript.

Every component shows a visible note naming the missing file when the data is absent, so a page never
reads as a clean pass because a gate did not run. A report is checked field by field before it is
shown; a row with no usable value is left out.

## `a11y-report`

The accessibility gate's report: the matrix it audited, every finding by impact, the known findings
that are still open, and the keyboard and no-JavaScript journeys with their result.

::a11y-report{from=report-example/accessibility}

**Options**

- `from` — the `/`-separated path in `site.data` that holds the report, so a key with a dot in it stays one segment (`reports/0.3.0/a11y`). Default: `accessibility-report`.

## `budget-report`

The performance budget's report: measured bytes per route and asset class, the checked-in budget, and
the JavaScript and CSS totals per route.

::budget-report{from=report-example/performance}

**Options**

- `from` — the `/`-separated path in `site.data` that holds the report. Default: `performance-report`.
- `targets` — optional per-route limits in gzip bytes, as `{"js":20000,"css":15000}` or
  `js=20000,css=15000`. A route over a limit says so in words; no route is hidden.

## `wcag-checklist`

Every WCAG 2.2 level A and AA success criterion, grouped by principle, with how it is checked and the
evidence behind a manual check. Each row links to the W3C's Understanding page instead of copying the
criterion.

::wcag-checklist{from=wcag}

**Options**

- `from` — the `/`-separated path in `site.data` that holds the criteria. Default: `wcag`.

## Where the data comes from

`scripts/test-a11y.ts --report <file>` writes the accessibility report and
`scripts/performance-budget.ts --report <file>` writes the performance report; both validate their
file against a schema in `schema/` before writing it. The site deploy writes the current reports into
`site/_data/` before the build, and the repository keeps one copy per release under
`site/_data/reports/`; `docs/release.md` gives the archive command. The checklist is authored in `site/_data/wcag.yml`.
