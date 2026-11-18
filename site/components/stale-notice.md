---
title: Stale notice
description: A caution note under the title of a page whose covered files changed since its last review.
layout: doc
permalink: /components/stale-notice/
---

A page becomes stale when the files it names in `covers` change after its last review. The engine
attaches that state to the page and the four article layouts show the notice; this site keeps no
`covers` on its own pages, so nothing here is marked.

The notice is not a directive: the `doc`, `tutorial`, `guide`, and `record` layouts place it under
the title whenever the engine marks the page stale. A page without `covers`, or one whose covered
files match the review lock, renders nothing extra.

## What it shows

- The review date in the page language's calendar, when the page was marked before.
- Each changed file, with whether it was added, changed, or removed. The first files stay in view and
  the rest go behind a native disclosure.
- **Update this page**, when the site names a repository, links to the page's source file.
- **Ask an agent**, when the site configures a page-agent provider that takes a `{prompt}`, opens it
  with the page, its address, and the changed files filled in.

## Options

Two keys under `theme.options.stale`:

| Option | What it does |
| --- | --- |
| `show` | `false` turns the notice off on every page. Anything else keeps it on. |
| `maxFiles` | How many files stay in view before the disclosure. A whole number of 1 or more; `5` by default. |

```yaml
theme:
  options:
    stale:
      maxFiles: 3
```

## Site setup

A page names the files it describes in its front matter, and the site keeps the review lock at its
root. Both are engine keys, so the theme only renders the result. Both need Mizzen 0.2.3 or later.

```yaml
---
title: Install
covers: [src/install.ts, src/config.ts]
---
```

`docs-review.lock.json` records, for each reviewed page, the date and the hash of every covered file.
A page with no entry has never been reviewed, so every covered file counts as added. `mizzen stale`
lists the pages and `mizzen stale mark <page>` writes the entry after a review.

## Without JavaScript

The notice, its review date, every file, and both actions are HTML at build time. The disclosure is
the browser's own `details` element. It is page content with a heading, not an alert or a live
region, so a screen reader meets it in reading order and nothing announces it twice.

## Notes

- The notice renders nothing when the page is current, and a site that sets no `covers` keeps its
  pages byte for byte.
- The review date is the date the page was marked, never the system clock; the files and their
  changes are what the stale report says.
- `mizzen check` reports a stale page as a warning by default; a site that wants a build to fail sets
  the severity itself.
