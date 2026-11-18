---
title: Compare records
description: Two records side by side with a differing row marked.
layout: doc
permalink: /compare/
---

The comparison is built at build time: both records, every field, and the difference are in the HTML.

::compare{from=books ids="alpha,beta,gamma" fields='[{"field": "author", "label": "Author"}, {"field": "published", "label": "Published", "kind": "date"}]'}
