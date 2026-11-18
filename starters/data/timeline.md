---
title: Timeline
description: Every kit from the day it was added to the day it was last updated.
layout: doc
permalink: /timeline/
---

Each row starts on the record's `added` date and ends on its `updated` date. A record still in
service has a short bar; a record that has not changed for months has a long one.

::timeline{from=kits label=name start=added end=updated status=status caption="Every kit, from added to updated"}

The dates are fixed in `_data/kits.yml`; the timeline never reads the clock, so the page is the same
every time it builds.
