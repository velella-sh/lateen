---
title: Code
description: A code block highlighted at build time in light and dark, with a copy button when JavaScript runs.
layout: doc
permalink: /components/code/
redirect_from:
  - /blocks/annotations/
  - /blocks/diff/
---

A code block shows source with the theme's highlighting colors. Highlighting runs at build time and emits one set of colors for light and one for dark, so switching the theme needs no rebuild and no highlighting script in the browser.

## Syntax

Wrap a fenced block in the `code` directive and name its language:

````markdown
:::code{lang="ts"}
```ts
const answer: number = 42;
```
:::
````

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `lang` | string | the fence's language, else `text` | The Shiki language. An unknown language falls back to plain text. |

## Example

:::code{lang="ts"}
```ts
type Component = { name: string; options: Record<string, string> };

export function render(component: Component): string {
  return `${component.name}:${JSON.stringify(component.options)}`;
}
```
:::

:::code{lang="diff"}
```diff
- publish: build
+ publish: dist
```
:::

## Fence metadata

A plain fenced block can carry metadata after its language. The engine reads it and the theme renders it on every doc and guide page:

| Meta | What it renders |
| --- | --- |
| `title="answer.ts"` | A title bar above the block; its visible name also names the code region for assistive technology and never enters the copied text. |
| `{1,3-5}` | Highlighted lines. |
| `showLineNumbers` | A line number on every line, kept out of copied text. A numbered line is a two-column row, so the number never wraps or repeats and later numbers stay aligned. Long code wraps beside the number instead of scrolling under it. |
| `ins={2}` / `del={3-4}` | Added and removed lines, marked with CSS only. |
| `diff` | Strips the diff marker from the code and styles the lines. |
| `annotations={2: a note \| 3-4: another note}` | A disclosure of notes below the block, each linked to its line. |

```ts title="answer.ts" {3} showLineNumbers annotations={2: The exported constant | 3-4: A range of two lines}
export const answer = 42;
const doubled = answer * 2;
const tripled = answer * 3;
const quadrupled = answer * 4;
```

The notes are ordinary HTML: a `<details>` element with a summary and an ordered list, so they open without JavaScript and read in order. A note's link points at the line's `id`; the line gets no visible text, so copying and selecting the code stays clean.

## Notes

- An example longer than 20 lines starts inside a native disclosure, so the page stays scannable. The full code is still in the DOM, the copy control still copies all of it, and the disclosure opens without JavaScript.
- The copy button is made by JavaScript on every page and starts hidden. Without JavaScript the code still reads and selects by hand. A browser test with script turned off covers blocks, language tabs, diffs and long examples: each block is named, no dead control is shown, and the long example opens from the keyboard.
- Each copy control owns one status region, so copying one block updates only that block's message, even beside another block or the page-level Markdown copy. The button's accessible name stays `Copy` before and after, so the result is announced once.
- The wrap toggle beside the copy button changes only presentation: long lines break in the view, while the copied text keeps the original line breaks. Without JavaScript the toggle stays absent and the block scrolls as before.
- At an effective 320px width a long line scrolls inside its code block, or wraps when the toggle is on. The page itself does not scroll horizontally.
- A `console`, `shellsession`, or `terminal` fence is read as a recorded session: the copy takes only the `$`/`%` command lines and their `>` continuations, never the output. A `bash` fence is a script, so every line is copied with any prompt taken off.
- A `diff` fence keeps its `+` and `−` lines. Use it to show a change to a file.
- A long diff wraps inside its block on narrow screens, so the page never scrolls sideways. The `+` and `−` signs plus the added/removed text carry the meaning, so color is never the only signal.
- Metadata is rendered by the doc and guide layouts for ordinary fences; a block written through the `:::code` directive keeps the directive's own output.
- The block keeps its source span, so the page footer can edit the exact block with an agent.
- A language outside the default set is imported when a fence asks for it. Each grammar is imported once per build and shared by overlapping callers; an import that fails is retried on the next call instead of being remembered as loaded.
