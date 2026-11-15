---
title: Reports
description: The accessibility and performance reports stored for each Lateen release.
layout: doc
permalink: /reports/
---

Each release keeps the two reports its gates produced, under the version number, so a later release
cannot quietly replace the evidence for an earlier one. The numbers on these pages are the ones the
release shipped with.

Nothing is stored yet: `0.3.0` is the first release in this series. At release time,
`scripts/archive-reports.ts` writes the two files under `site/_data/reports/<version>/` and updates the
table below; it refuses to write a version that already exists, and `test/reports-archive.test.ts`
fails when a stored report no longer matches the hash recorded beside it.

<!-- reports:start -->
| Version | Reports | JavaScript gzip | CSS gzip | Change |
| --- | --- | --- | --- | --- |
<!-- reports:end -->

The current commit's reports are on the [accessibility page](/accessibility/) and the
[performance page](/performance/).
