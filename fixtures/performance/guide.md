---
title: Install the widget
description: A guide page with the summary bar, steps, two code samples, a trap, and a check list.
layout: guide
permalink: /guide/
tags: [install]
guide:
  from: 0.1
  to: 0.2
  time: 10 minutes
  risk: done
---

A guide page with the layout's summary bar above the body and the related guides at its foot.

## Before you start

The fixture needs Node 24 or later and a checkout of the theme beside it. The script builds this site
into a temporary folder, measures the HTML it finds, and removes the folder.

:::steps
1. Install the dependencies.
2. Build the fixture.
3. Read the table the script prints.
:::

:::before-after{removed="1" added="1"}
```bash
npm ci --omit=dev
```

```bash
npm ci
```
:::

:::trap
Update the budget only when the change is intended, and say in the pull request what grew and why.
:::

:::check-list
- `node scripts/performance-budget.ts` — The routes pass their budget.
- `npm test` — The tests pass.
:::

```bash
npm ci
node node_modules/@velella/mizzen/bin/mizzen.js build fixtures/performance --theme .
```

The build writes one HTML file per page and the shared assets beside it.

:::details{summary="What changes the measurement"}
A new chrome island adds a module to every route. A component island adds a module to the routes
that use it. A stylesheet change grows the base bundle or the page bundle. Front matter and prose
change the HTML, but the budget measures only JavaScript and CSS.
:::
