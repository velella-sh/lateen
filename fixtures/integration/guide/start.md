---
title: Start the widget
description: A guide layout page with the summary bar and the guide components.
layout: guide
permalink: /guide/start/
tags: [install]
guide:
  from: 0.1
  to: 0.2
  time: 10 minutes
  risk: done
---

## Before you start

Keep the old output until the checks pass.

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
