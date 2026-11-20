---
title: Quote
description: A quotation with an optional attribution name and source link.
layout: doc
permalink: /components/quote/
---

A quote sets words apart from the text around them. It can carry an attribution name and a source link, and the quoted text wraps inside its column instead of being clipped.

## Syntax

A container directive whose body is the quotation:

```markdown
:::quote{name="A reviewer" source="https://example.com/guide/"}
The smallest change that fully works.
:::
```

Or a leaf directive with `text`:

```markdown
::quote{name="A reviewer" source="https://example.com/guide/" text="The smallest change that fully works."}
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `text` | string | the body | The quoted words. The body is used when `text` is absent. |
| `name` | string | none | Who said or wrote it, rendered as text. |
| `source` | `http` or `https` URL | none | The source address. Only an absolute `http` or `https` address becomes a link; anything else is left out. |

## Example

:::quote{name="A reviewer" source="https://example.com/guide/"}
This paragraph should wrap inside its column instead of being clipped on a narrow screen.
:::

## Notes

- The name is always text: it is never turned into a link or invented from the source.
- With a name or a safe source the quote is a `figure` with a `blockquote` and a `figcaption`; without one it is a plain `blockquote`.
