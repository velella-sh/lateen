---
title: Data explorer
description: The data explorer as the server draws it, with the search form fallback.
layout: doc
permalink: /explorer/
---

The data explorer reads the books collection as the reader types. Without JavaScript the same page
keeps its table and the form submits to the search results page.

::data-explorer{from=books columns='[{"field":"title","label":"Title"},{"field":"author","label":"Author"},{"field":"published","label":"Published","kind":"date"}]' filters=author sort=title,published}
