---
title: Data explorer
description: The data explorer with a query, filters, ordering, and a no-script fallback.
layout: doc
permalink: /explorer/
---

The data explorer measures the collection loader, the matcher, the filter facets, the sort control,
and the record table it draws.

::data-explorer{from=books columns='[{"field":"title","label":"Title"},{"field":"author","label":"Author"},{"field":"published","label":"Published","kind":"date"}]' filters=author sort=title,published}
