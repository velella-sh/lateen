---
title: Explorer
description: Every record in one table, with a search field, filters, and a sort choice.
layout: doc
permalink: /explore/
---

The explorer draws the first records as a plain table, then the island takes over the same table to
search the collection's index, filter by a field, and sort. Without JavaScript the search field
submits to the site's search results page, so the page still answers a query.

::data-explorer{from=kits columns=name,category,status,updated,weight_grams filters=category,status sort=name,updated}

Change the columns, the filters, or the sort choices in the directive above. A field the directive
names must also appear under the collection's `index.fields` in `mizzen.yml`, or the island has no
value to show for it.
