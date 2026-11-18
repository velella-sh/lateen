# Replace a theme component or layout

A project can replace one Lateen component and one layout with its own code. The theme stays a
dependency, unedited; every unit the config does not name keeps its theme file.

The full contract, precedence, and diagnostics are on [Replace a theme component or
layout](../docs/overrides.md). This recipe is the working copy.

## 1. Name the unit in `mizzen.yml`

```yaml
theme:
  name: "@velella/lateen"
  overrides:
    components:
      related-guides: overrides/related-guides.ts
    layouts:
      doc: overrides/doc.ts
```

The key is the theme unit's name, so a page still says `layout: doc` and still writes
`<sl-component name="related-guides">`. Paths are relative to the site root.

## 2. Write the site module

A layout default-exports `Layout`; a component default-exports `Component`.

```ts
import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

const relatedGuides: Component = ({ page }) =>
  h("nav", { class: "site-guides" }, h("a", { href: page.url }, "This page"));

export default relatedGuides;
```

## 3. Style it beside the module

A file with the module's name and a `.css` suffix is bundled instead of the theme unit's stylesheet:

```text
overrides/related-guides.ts
overrides/related-guides.css
```

Use the theme's tokens (`var(--space-4)`, `var(--color-border)`) and logical properties
(`margin-inline`, `padding-block`) so light, dark, and right-to-left pages keep working. The
replacement brings no client script.

## Check it

```bash
npx mizzen build site --out dist
```

A missing file, a path outside the site root, a name the theme does not have, or a module without a
function default export fails the build with an `overrides.*` error naming the config key.

Build under a base path once (`base: /docs`) and confirm the page's stylesheet URLs and the override's
links keep the prefix.
