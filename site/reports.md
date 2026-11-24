---
title: Reports
description: The accessibility and performance reports stored for each Lateen release.
layout: doc
permalink: /reports/
---

Each release keeps the two reports its gates produced, under the version number, so a later release
cannot quietly replace the evidence for an earlier one. The numbers on these pages are the ones the
release shipped with.

Reports are stored by `scripts/archive-reports.ts` when a version is released; `docs/release.md`
gives the command and the point in the release. The script refuses to write a version that already
exists, and `test/reports-archive.test.ts` fails when a stored report no longer matches the hash
recorded beside it.

<!-- reports:start -->
| Version | Reports | JavaScript gzip | CSS gzip | Change |
| --- | --- | --- | --- | --- |
| [0.2.3](/reports/0.2.3/) | [accessibility and performance](/reports/0.2.3/) | 921,751 B | 482,144 B | — |
| [0.2.4](/reports/0.2.4/) | [accessibility and performance](/reports/0.2.4/) | 1,016,753 B | 797,520 B | +95,002 B JavaScript, +315,376 B CSS |
| [0.2.5](/reports/0.2.5/) | [accessibility and performance](/reports/0.2.5/) | 1,078,377 B | 848,820 B | +61,624 B JavaScript, +51,300 B CSS |
<!-- reports:end -->

The current commit's reports are on the [accessibility page](/accessibility/) and the
[performance page](/performance/).
