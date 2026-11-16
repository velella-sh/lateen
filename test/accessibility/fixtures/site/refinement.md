---
title: Refinement
description: Every refined component and state, in the accessibility matrix.
layout: doc
permalink: /refinement/
---

This page shows the refined components in one place: a code block with a title, a highlighted line
and numbers, a table with a numeric column, callouts, badges, link cards, tabs and inline `code`.

## Code

```ts {2} title="answer.ts" showLineNumbers
const question = "life";
export const answer = 42;
```

## Table

| Name | Count |
| --- | ---: |
| alpha | 12 |
| beta | 1,204 |

## Callouts

:::callout{type=note title="Note"}
A note with an accent bar and an aligned icon.
:::

:::callout{type=caution title="Caution"}
A caution callout.
:::

## Badges and cards

::badge{label="New" variant=tip}
::badge{label="Beta" variant=important}

::link-card{href="/doc/" title="Document" description="A card that lifts on hover."}

## Tabs

:::tabs{group="refinement-fixture"}
### One

The first tab.

### Two

The second tab.
:::
