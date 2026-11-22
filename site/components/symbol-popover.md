---
title: Symbol popover
description: An inline symbol whose signature and reference open in a native disclosure.
layout: doc
permalink: /components/symbol-popover/
---

A symbol popover names a function, type, or option in running text. Tap or click the chip, or focus it and press Enter or Space, to open the signature and reference link. The button works without JavaScript in browsers that support native popovers.

## Syntax

```markdown
::symbol-popover{name="runExample" signature="runExample(input: Input): Promise<Result>" href="/reference/runner/"}
```

For running text, use the symbol name as the label.

```markdown
Call :symbol[runExample]{signature="runExample(input: Input): Promise<Result>" href="/reference/runner/"} to run the example.
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `name` | string | inline label | The symbol name shown on the chip. Supply it explicitly for the leaf directive. |
| `signature` | string | empty | The signature shown in the panel, as code text. |
| `href` | string | none | A reference page. Root-relative or `http`/`https`; any other URL renders no link. |

Quote a value that has spaces, braces, or angle brackets: `signature="run(input: Input): Result"`.

## Example

::symbol-popover{name="runExample" signature="runExample(input: Input): Promise<Result>" href="/reference/runner/"}

::symbol-popover{name="Result" signature="type Result = { ok: boolean; value: string }"}

## Notes

- Escape closes the open panel and returns focus to the chip when focus was inside the popover. Clicking outside dismisses it.
- The island coordinates open panels with other theme popovers. Browsers without native popovers show the signature and link inline.
