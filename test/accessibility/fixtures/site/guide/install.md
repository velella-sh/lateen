---
title: Install the widget
description: A guide page in the accessibility matrix, with every guide component.
layout: guide
permalink: /guide/install/
tags: [install]
guide:
  from: 0.1
  to: 0.2
  time: 10 minutes
  risk: done
---

A guide page with the summary bar above the body and the next guide at the foot.

## Before you start

The widget needs Node 24 or later. Keep the old output until the checks pass.

:::steps
1. Install the package.
2. Build the site.
3. Read the output.
:::

:::before-after{removed="1" added="1"}
```bash
widget build --out old
```

```bash
widget build --out dist
```
:::

:::trap
Keep the old output beside the new one until the check passes.
:::

:::check-list
- `npm run build` — The build finishes.
- `npm test` — The tests pass.
:::

:::callout{type=tip title="One command"}
Run `node scripts/performance-budget.ts` from the theme's root.

:::
