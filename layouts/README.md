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
