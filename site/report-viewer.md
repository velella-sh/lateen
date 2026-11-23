---
title: Check reports
description: Publish check results, run comparisons, and trends on a Lateen site.
---

Enable the Mizzen `check-report` output and put the public results in `_data/report-set.json`.

```yaml
outputs:
  check-report: true
```

Set the file's report title, route, runs, and the pairs of run IDs to compare. The `report` starter
contains a working example. Run `mizzen build`, then open the configured route. Each run and
comparison has a permanent link. The overview includes trend charts and their data tables.

Use the **Download report data (JSON)** link for the versioned machine-readable output. Include
only material you have approved for the public site. Give repeated findings stable IDs and
use the same scope for runs with comparable coverage and settings. A missing value or date
leaves a gap in the trend. Incomplete runs show their recorded evidence and its coverage.

The [release report archive](/reports/) lists Lateen's own accessibility and performance reports.
