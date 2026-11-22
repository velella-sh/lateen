# Layouts

A layout turns one page into a document. One file per layout: `layouts/<name>.ts`, with a lowercase kebab-case name that is unique here.

Layouts are `.ts`, not `.tsx`: Node's type stripping does not transform JSX, so write elements with `h()` from `preact`. The file's default export is the layout, typed by the engine's layout contract.

The engine registers every `.ts` file directly in this folder as a layout, so each one must default-export a layout function. Helpers the layouts share live in a folder instead, as `blog/index.ts` and `shared/index.ts` do.

A layout's tests live in `test/layouts/`, named for the layout (`test/layouts/<name>.test.ts`, with a suffix for a focused part).

Example, `layouts/doc.ts`:

```ts
import { h } from "preact";
import type { LayoutProps } from "../../engine/src/contracts/render.ts";

export default function doc({ page, children }: LayoutProps) {
  return h("main", null, h("h1", null, page.title), children);
}
```

## Site overrides

Mizzen 0.2.5 resolves `theme.overrides.layouts` for the page's declared layout and
`theme.overrides.components` for Markdown directives. Layouts share Lateen's
shell and article helpers internally. For example, overriding `doc` changes
pages with `layout: doc`. Quickstart and record still draw their own pages.
Overriding `page-tool` changes an explicit `::page-tool` directive, while the
layout slot for `tool:` front matter uses Lateen's shared renderer.

To make a site override reachable from a layout slot, Mizzen would need to
expose a named component renderer on the layout props that resolves the current
registry and tracks the component's styles and islands.
