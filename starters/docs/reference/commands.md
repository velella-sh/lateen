---
title: Commands
description: Every Sandbar command and its options.
layout: doc
permalink: /reference/commands/
order: 1
---

## `sandbar run <task>`

Runs a task and the tasks it runs after.

| Option | Default | What it does |
| --- | --- | --- |
| `--keep-going` | off | Keeps running tasks that do not depend on a failed one. |
| `--dry-run` | off | Prints the order without running anything. |

## `sandbar list`

Prints every task in `sandbar.yml`, one per line.

## `sandbar init`

Writes a starting `sandbar.yml` in the current folder. It never overwrites an existing file.

:::callout{type=warning title="Exit codes"}
`0` means every task passed, `1` means a task failed, and `2` means the task file is invalid.
:::
