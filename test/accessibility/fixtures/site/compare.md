---
title: Compare records
description: Two records side by side with a differing row marked.
layout: doc
permalink: /compare/
---

The comparison is built at build time: both records, every field, and the difference are in the HTML.

::compare{from=books ids="a,b" fields='[{"field": "pages", "label": "Pages", "kind": "number"}, {"field": "published", "label": "Published", "kind": "date"}]'}
