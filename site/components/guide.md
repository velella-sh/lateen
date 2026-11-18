---
title: Guide layout
description: A layout for step-by-step guides, with a summary bar, a status banner, and related guides.
layout: guide
permalink: /components/guide/
tags: [guides]
order: 10
guide:
  from: 0.1
  to: 0.2
  time: 10 minutes
  risk: shipped
---

A guide is a page the reader follows to finish a task: install, upgrade, migrate. The `guide` layout adds a summary bar under the title, an optional status banner, the page's reading time, and a list of related guides at the foot. This page is itself a guide, so the bar above and the components below are the live example.

## When to use it

Use the guide layout for a task with an order and a result, and the `doc` layout for a page the reader moves around in. A guide is one page; a task with several stages is several guides that share a tag, so the pager and the related list connect them.

## Guide facts

The `guide` front-matter table fills the summary bar. Each key is optional, and a missing key leaves its fact out rather than showing an empty one.

| Name | Type | What it shows |
| --- | --- | --- |
| `from` | string | The version or state the reader starts from. |
| `to` | string | The version or state the reader ends at. |
| `time` | string | How long the guide takes, as written. |
| `risk` | string | A value from the site's status options; it renders as a status badge. |

```yaml
guide:
  from: 0.1
  to: 0.2
  time: 10 minutes
  risk: shipped
```

## Page front matter

The layout also reads the front matter every docs page shares, plus the keys the guide index groups by.

| Name | Type | What it does |
| --- | --- | --- |
| `title` | string | The page's `h1`; an `h1` in the body replaces it. |
| `status` | string | Adds the page-status banner: `experimental`, `beta`, or `deprecated`. |
| `since` | string | The version the status started at, shown in the banner. |
| `replaced_by` | string | The URL of the page that replaces a deprecated guide. |
| `tags` | string list | The first tag groups the guide in the guide index; shared tags drive the related list. |
| `order` | number | Position among the guides of its tag, before the title comparison. |

## Components in the body

The layout places these components in its article; the body supplies the task itself.

:::steps
1. Install the package.
2. Run the build.
3. Read the output.
:::

A step list numbers the work and marks progress in the browser; the numbers are real text, so they read in every language.

:::before-after
```bash
example build --out old
```

```bash
example build --out dist
```
:::

The before-and-after block shows one change as two panes with copy controls. A `trap` names the mistake that is easy to make:

:::trap
Keep the old output beside the new one until the check passes.
:::

And a `check-list` pairs each command with the result to expect:

:::check-list
- `example build` — The build finishes.
- `example test` — The tests pass.
:::

## Without JavaScript

The summary bar, the status banner, the reading time, the related guides, and every component's text render at build time. Without JavaScript the reader sees the same facts and the same commands. The copy buttons, the step ticks, and the reading-progress count are additions: they appear only when a script runs, and nothing on the page depends on them.

## Notes

- Do not repeat in the body what the summary bar already says. The bar is for the task's shape, the body for the work.
- A guide with no `tags` is grouped under the untagged heading in the guide index and gets no shared-tag list.
- The risk value must be one the site maps in `theme.options.status.values`; an unmapped value still shows, as written.
