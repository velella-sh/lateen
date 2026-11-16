---
title: Configuration
description: The settings of sandbar.yml.
layout: doc
permalink: /reference/configuration/
order: 2
---

`sandbar.yml` holds one key, `tasks`, and an optional `settings` block.

## Tasks

| Key | Type | What it does |
| --- | --- | --- |
| `run` | string | The command the task runs. |
| `after` | list of task names | Tasks that run first. |
| `env` | map | Variables added to the command's environment. |

## Settings

| Key | Default | What it does |
| --- | --- | --- |
| `shell` | `sh` | The shell that runs each command. |
| `parallel` | `1` | The most tasks that run at once. |

```yaml
settings:
  shell: bash
  parallel: 2
```
