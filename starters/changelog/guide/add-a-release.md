---
title: Add a release
description: Add a new release to the changelog, the versions page, the feed and the home page.
layout: doc
permalink: /guide/add-a-release/
---

A release is written in four places. Do them in this order so the pages agree.

## 1. The changelog

Add a `changelog-entry` block at the top of `changelog.md`. The page lists releases newest first by version number, so the position does not matter, but the top is easiest to read.

```markdown
:::changelog-entry{version="1.5.0" date="2026-07-30" categories="added"}
- Add a short line for each change.
:::
```

`categories` is a comma list of `added`, `changed`, `fixed`, `removed`, and `security`.

## 2. The versions page

Add the version to `versions:` in `versions.md`, and give the new version `status: latest` and the one before it no status. Mark versions you no longer support as `deprecated`.

## 3. The feed

Add a heading with the version and date to `feed.md`, one sentence, and a link to the changelog. Remove the oldest item to keep three.

## 4. The home page

Change the "What is new" list in `index.md`, and point the primary button at the new entry. A release's link is `changelog/#v` followed by the version with dots as dashes, so `1.5.0` is `changelog/#v1-5-0`.

Run `mizzen check` before you publish. The anchors in the front matter of the home and versions pages are made by the theme, so check does not see them: open those links once to be sure.
