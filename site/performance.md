---
title: Performance
description: The JavaScript and CSS every Lateen route ships, measured on the deployed commit.
layout: doc
permalink: /performance/
---

Every page of a Lateen site carries one shared stylesheet, a bundle for its layout and components,
and the client islands it needs. This page shows what the deployed commit measured, route by route
and asset class by asset class.

The budgets are **regression baselines, not product targets**: each number records what the theme
shipped when the baseline was taken, so an unintended change fails the build instead of passing
quietly. Nothing here promises that a page weighs a particular number of bytes. The one public claim
is the rule the gate enforces: no route grows past its checked-in budget, with a 64-byte gzip
tolerance per asset class for differences between zlib builds.

## This site's report

The deploy runs the budget script on the commit it publishes and writes the report into the site's
data before the build. The script is also what fails the build, so a report that appears here passed
its budget.

::budget-report{from=performance-report}

## Reproduce it

From a checkout on Node 24:

```bash
npm ci
node scripts/performance-budget.ts
```

The script builds `fixtures/performance`, measures every route in a temporary folder, prints the
table above, and checks it against `fixtures/performance/budget.json`. Add `--report <file>` to write
the same numbers as JSON, validated against [`schema/performance-report.schema.json`](https://github.com/velella-sh/lateen/blob/main/schema/performance-report.schema.json).
[`docs/performance.md`](https://github.com/velella-sh/lateen/blob/main/docs/performance.md) explains
the six asset classes and the font measurement.
