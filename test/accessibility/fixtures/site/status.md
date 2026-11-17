---
title: Status badge and legend
description: The status badge in each tone and the legend that explains the site's values.
layout: doc
permalink: /status/
---

A status badge is a small label with a tone's colour and icon. The icon is hidden from assistive
technology; the text carries the meaning, so every tone reads without colour.

::status[Done]{tone=positive} ::status[Needs a check]{tone=caution} ::status[Blocked]{tone=negative}
::status[Neutral]{tone=neutral} ::status[Informational]{tone=info}

The same badge comes from the site's value map when the directive names a value:

::status{value=done} ::status{value=late}

::status-legend

The legend lists every mapped value in map order; `::status-legend{values="late,done"}` lists a
subset in the given order.
