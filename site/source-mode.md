---
title: Source mode
description: Show where every block came from, with a file and line beside it, and open it in an editor or on the forge.
layout: doc
permalink: /source-mode/
---

Source mode puts a `file:line` label beside every block that has a known position: a code fence, a
status, a record fact, a component that keeps its source span. Each label copies the position, and,
when the site names a repository or an editor template, links the same lines there.

Use the Source mode switch above the page content or choose “Source mode” in the command palette.
The choice is remembered per browser. Labels appear beneath the blocks they describe.

## Live example

This page is the example. Turn on Source mode to see the file and line next to the code fence below. The switch is hidden until the island runs, so a reader without JavaScript never sees a
control that would do nothing.

```ts
export const answer = 42;
```

## Options

| Option | What it does |
| --- | --- |
| `theme.options.sourceMode.editor` | URL template for opening a block in a local editor. Must include `{path}`; `{line}` and `{column}` are optional. Only editor-handler schemes such as `vscode`, `cursor`, `zed`, `idea`, and `subl` are accepted; `http`, `https`, `javascript`, `data`, and `file` are rejected. |
| `repository.url` | The forge the labels link to. GitHub and GitLab URLs get line links; any other host gets no link. |
| `repository.branch` | The branch the forge links point at. |

The first time an editor link is used, the reader gives the folder of their checkout; it is kept in
local storage and never sent anywhere. Without a template, a repository, or that folder, the label is
still a copy button.

## Without JavaScript

The server hides the switch, adds no labels, and leaves the page exactly as it is. The `?source=<file>:<line>`
query turns the mode on and focuses the block at that position when the island runs; without it, the
page simply opens at the top.

## Accessibility

The switch is a button with `aria-pressed`, the label actions are buttons and links with their own
names, and every change is announced in a live region in the page language. The labels are decorative
for the article text and are neither focusable nor read until the mode is on.
