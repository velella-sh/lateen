---
title: Preset preview
description: One preset of the theme rendered at build time in its own scoped block, with the options to copy and an optional accent try-out.
layout: doc
permalink: /components/preset-preview/
---

A preset preview shows the theme under one [preset](/presets/) without changing the page around it. It
is a leaf directive: the preset name goes in `preset`, and the block renders a small sample, the
options to copy, and — with `picker` — an accent input and the contrast ratios it produces.

## Syntax

```markdown
::preset-preview{preset=harbor picker}
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `preset` | string | empty | The preset file name in `tokens/presets/`. An unknown name renders a short note instead of a sample. |
| `picker` | flag | absent | Adds the accent input and the two ratio lines. Any value except `false`, `no`, `0`, or `off` turns it on. |

## Example

::preset-preview{preset=harbor picker}

```markdown
::preset-preview{preset=harbor picker}
```

## How it stays scoped

The block's own `<style>` re-declares the theme's tokens under a class that only the block carries, so
the sample reads the preset's canvas, accent, selection, code, and radius while the page keeps its own
look. No element gets a `style` attribute.

## Without JavaScript

The sample, the options, the accent input, and the two ratio lines are in the HTML the build writes.
The input does nothing until the island runs; without it, the preset's own accent and its ratios
stay readable. The island only rewrites the ratios and the block's accent, and it sends nothing.
