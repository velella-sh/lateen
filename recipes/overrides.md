# Recipe: replace a theme component and layout

A site can keep the theme and replace one component and one layout by name. The theme package is
not edited or forked. The full rules and diagnostics are in [docs/overrides.md](../docs/overrides.md);
this recipe runs the sample that the tests use.

## 1. Copy the sample site

Run from the theme checkout. The sample imports `preact`, so the copy borrows the checkout's
installed packages; a real site has its own install and needs no symlink.

```bash
work=$(mktemp -d)
cp -R test/overrides/fixtures/site "$work/site"
ln -s "$PWD/node_modules" "$work/node_modules"
printf '{"type": "module"}\n' > "$work/package.json"
```

The config is the whole setup:

```yaml
theme:
  name: "@velella/lateen"
  overrides:
    components:
      related-guides: overrides/related-guides.ts
    layouts:
      doc: overrides/doc.ts
```

## 2. Build with this theme

```bash
node_modules/.bin/mizzen build "$work/site" --theme . --out "$work/out"
```

`--theme .` builds with the checkout instead of the installed package. The build exits 0.

## 3. Inspect the output

```bash
grep -o 'class="site-shell"\|class="site-header"' "$work/out/index.html"
grep -o 'aria-label="Guides"' "$work/out/related/index.html"
grep -o 'class="callout callout-note"' "$work/out/index.html"
grep -l '\.site-shell{' "$work/out"/assets/theme/page-*.css
```

The first line is the site's `doc` layout, the second the site's `related-guides` component, and the
third the theme's own `callout`, which was not overridden. The last line finds the override CSS
sidecar in the page's stylesheet bundle.

## 4. Build under a base path

```bash
node --input-type=module -e 'import { readFileSync, writeFileSync } from "node:fs"; const file = process.argv[1]; writeFileSync(file, readFileSync(file, "utf8").replace(/^base: ""$/m, "base: /docs"));' "$work/site/mizzen.yml"
node_modules/.bin/mizzen build "$work/site" --theme . --out "$work/out-base"
grep -o 'href="/docs/[^"]*"' "$work/out-base/related/index.html"
```

Every local link and stylesheet starts with `/docs/`, including the links the site's own override
wrote from `site.config.base` and `page.url`.

## 5. Run the failing case

```bash
node_modules/.bin/mizzen build test/overrides/fixtures/invalid --theme . --out "$work/bad"
```

The build exits 1. Its diagnostics name all three settings:

```bash
node_modules/.bin/mizzen build test/overrides/fixtures/invalid --theme . --out "$work/bad" 2>&1 | grep -E 'overrides\.(unknown-unit|missing-file|outside-site)'
```

- `overrides.unknown-unit`: `site-nav` is not a theme component, even though its module exists.
- `overrides.outside-site`: `../outside/callout.ts` leaves the site root.
- `overrides.missing-file`: `overrides/missing-doc.ts` does not exist.

## 6. Use it in a real site

Put the override modules under the folder that holds `mizzen.yml`, name them in
`theme.overrides`, and build with the installed theme:

```bash
npx mizzen build site --out dist
```

A broken override fails the build; there is no fallback to the theme unit when the name is listed.

```bash
rm -rf "$work"
```
