---
title: Publish a reporting run
description: Keep the latest report and preserve each previous run.
layout: doc
translation_key: report-guide
---

Save each run to a new dated file in `_data/`. Before moving the `current` collection to that file,
give the outgoing data file its own collection and list page, as shown in the [archive](../archive/).
Update the archive index and the title on the [latest report](../).

After committing the source file, run `mizzen data snapshot current` to record its commit and date.
When you add an archive collection, record its snapshot separately. Check the site with `mizzen check`.
