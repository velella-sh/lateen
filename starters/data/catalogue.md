---
title: Catalogue
description: Every kit in the collection, as a table and as a card.
layout: list
permalink: /catalogue/
list:
  collection: kits
---

The list layout reads the collection named in the page's front matter. Every field of a record is a
column, and the status column reads the status map from `mizzen.yml`.

A record with an `updated` date later than its neighbours appears in the same order the data file
writes. Change the order of the records in `_data/kits.yml` to change the list.
