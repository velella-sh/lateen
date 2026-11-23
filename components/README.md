# Components

A component is a piece of content or interface used inside pages (a callout, a code tab). One folder per component: `components/<name>/`, lowercase kebab-case.

A folder holds `index.ts` (the Preact component, written with `h()`; its default export is the component), an optional `client.ts` (its island), and its tests. Visuals live in `styles/src/ui.css`.

Example, `components/callout/index.ts`:

```ts
import { h } from "preact";
import type { ComponentChildren } from "preact";

export default function callout({ children }: { children?: ComponentChildren }) {
  return h("aside", { class: "callout" }, children);
}
```

## Inline use

Mizzen turns an inline `:name[label]{key=value}` into the component `name`, with the label as its children,
in the middle of a paragraph. The engine does not tell the component it is inline, so a component that draws
a block (`div`, `ul`, `p`, `pre`, …) ends the paragraph and leaves invalid HTML (a block inside `<p>`).

These components return phrasing content and are meant for inline use: `badge`, `kbd`, `status`, `term`,
`symbol`, `symbol-popover`, `version-badge`, and `tested-chip`. Every other component is a block: write it as a
`::name` or `:::name` directive on its own lines. That includes `tags`, `cite` (a callout, like `info` and
`hint`), `citation`, and `reading-time`. `heading-anchor` is not a directive at all: headings get their anchor
automatically, and using it as one fails the build with a message that says so.

`test/inline-directives.test.ts` builds every component inline, English and Persian, and keeps this list true.
Knowing it was written inline needs a Mizzen change: an `inline` flag on `ComponentProps`.
