---
title: Data explorer
description: Filter and sort the books collection as you type, with a search page fallback.
layout: doc
permalink: /explorer/
---

The data explorer reads the books collection as the reader types. Without JavaScript the same page
keeps its table and the form submits to the search results page.

::data-explorer{from=books columns='[{"field":"title","label":"Title"},{"field":"pages","label":"Pages","kind":"number"},{"field":"published","label":"Published","kind":"date"}]' filters=published sort=title,pages}
