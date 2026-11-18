---
title: Source mode
description: A page with source positions, so the switch, the labels and their actions are part of the measured page.
---

Source mode shows where each block came from. The server ships the switch hidden, and the island
adds a label beside every block that carries a position.

```ts
export const answer = 42;
```

```ts
export function double(value: number): number {
  return value * 2;
}
```
