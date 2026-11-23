---
title: State
description: What a page shows when there is nothing to show — empty, error, or not found — with a way forward.
layout: doc
permalink: /components/state/
---

A state stands in for content that is not there. It says what happened and, when it can, where to go next. One unit draws all three situations, so the 404 page, an empty list, and a failed load read as the same kind of block.

## Kinds

| Kind | Use it when | Announced |
| --- | --- | --- |
| `empty` | A list, feed, or table has no rows yet. | As ordinary content. |
| `error` | Something failed and the reader may try again. | Politely, with `role="status"`. |
| `not-found` | The page or record does not exist. | As ordinary content. |

Without a `title` the state is a compact note, one line in a quiet panel. With a `title` it is a full block: a heading, the description, and links.

## Syntax

```markdown
::state{kind="empty" description="No posts yet."}
```

A full block with a code mark and links:

```markdown
::state{kind="not-found" code="404" title="Page not found" description="The address may be wrong, or the page has moved." actions='[{"href":"/","label":"Back to the docs"},{"href":"/search/","label":"Search the docs"}]'}
```

## Options

| Name | Type | Default | What it does |
| --- | --- | --- | --- |
| `kind` | `empty`, `error`, or `not-found` | `empty` | The situation. It sets the class and, for `error`, the live-region role. |
| `description` | string | the body | What happened and what to do. The body is used when it is absent. |
| `title` | string | none | Turns the note into a block with a heading. |
| `code` | string | none | A short mark above the heading, such as `404`. It is hidden from assistive technology because the title says the same. |
| `actions` | JSON list | none | Links as `{ "href", "label" }`. The first is the primary action. Only root-relative and `https` addresses are kept. |

## Examples

::state{kind="empty" description="No posts yet."}

::state{kind="error" description="The index did not load. Check the connection and try again."}

::state{kind="not-found" code="404" title="Page not found" description="The address may be wrong, or the page has moved." actions='[{"href":"/lateen/","label":"Back to the docs"},{"href":"/lateen/components/","label":"Browse components"}]'}

## Notes

- The text comes from the caller, in the page language. The unit never guesses a language and adds no strings of its own, so the 404 layout and the list layouts keep their existing keys.
- Colors, spacing, and type come from tokens. The block has no color of its own beyond the muted text and the primary action, so light, dark, print, and forced colors follow the theme.
- The 404 layout (`layouts/not-found.ts`) and the empty note in the list and blog layouts call this unit directly.
