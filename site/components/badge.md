---
title: Badge
description: A small inline-style label for a version, a status, or a beta marker.
layout: doc
permalink: /components/badge/
redirect_from:
  - /blocks/badge/
---

A badge is a short label for a version, a status, or a beta marker. It uses `label` first, then inline Markdown, then `text`.

## Syntax

```markdown
::badge{label="New" variant=tip}
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `label` | string | empty | The text shown in the badge. |
| `text` | string | empty | Fallback text, including badges from the VitePress importer. |
| `variant` | `note`, `tip`, `important`, `warning`, or `caution` | `note` | The color and tone. An unknown value is a note. |

Quote a label that has spaces: `label="Requires 0.3"`.

## Example

::badge{label="Beta" variant=important}

::badge{label="New" variant=tip}

```markdown
::badge{label="Beta" variant=important}

::badge{label="New" variant=tip}
```

## Notes

- Use `::badge{label="New"}` on its own line or `:badge[New]{variant=tip}` in running text.
- A badge is a label, not a link. Link to the thing it names in the sentence around it.
