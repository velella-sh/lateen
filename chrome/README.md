# Chrome

Chrome is everything around the content: header, sidebar, footer, table of contents. One folder per part: `chrome/<name>/`, lowercase kebab-case.

A folder holds `index.ts` (the Preact component, written with `h()`; its default export is the component), an optional `client.ts` (its island), and its tests. Visuals live in `styles/src/ui.css`.

Example, `chrome/footer/index.ts`:

```ts
import { h } from "preact";

export default function footer() {
  return h("footer", null, "Built with Lateen");
}
```
