---
title: Edit the data
description: Where the records, the schema, the status map, and the page template live.
layout: doc
permalink: /guide/edit-the-data/
---

The site has one collection, `kits`, declared in `mizzen.yml`. Everything else is built from it.

## The records

`_data/kits.yml` holds one object per kit:

```yaml
- id: head-torch
  name: Head torch
  summary: A three-mode light with a strap that fits over a hat.
  category: Light
  status: in-service
  added: 2025-01-25
  updated: 2026-02-24
  weight_grams: 85
  pieces: 1
  tags: [battery, night]
```

`id` is the record's key and its place in the record page address: the record above builds
`/kits/head-torch/`. `added` and `updated` are dates the site reads as dates, listed under the
collection's `dates` key. `status` is a key into the status map, not the label a reader sees.

Add a record by adding one object to the list. Remove one by deleting it; its page follows.

## The schema

`_data/kits.schema.json` validates every record before a page is built. A record that fails the
schema stops the build with the file, line, and field named, so a typo never turns into a missing
page.

The schema lists each field's type and the allowed values. Change the schema and the data together:
a field the schema does not allow fails the build, and a field the schema requires cannot be left out.

## The status map

`theme.options.status.values` in `mizzen.yml` turns a status key into a label, a tone, and a
description:

```yaml
status:
  values:
    in-service:
      tone: positive
      label: In service
      description: Ready to pack and use.
```

A status the map does not name still renders with its neutral tone and its raw key, so check the map
when a new key appears.

## The page template

`_templates/kit.md` is the page every record gets. Its front matter names the fields the record header
shows, and its body uses `:field[name]` to place a value. Change the template to change every record
page at once.

## The rest of the site

`catalogue/` uses the list layout, `explore/` uses the data explorer, and `timeline/` uses the
timeline. Each directive names the collection and the fields it reads, so adding a field does not
change those pages until you name it there.
