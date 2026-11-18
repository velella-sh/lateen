# Replace a theme component or layout

A site can replace one component and one layout of the theme it builds with and keep every other
Lateen unit. The replacement is site code, named in `mizzen.yml`; the theme package is never edited,
forked, or copied.

Mizzen 0.2.4 implements this key in the config schema and the theme registry. This page is the
contract. The sample under `test/overrides/fixtures/` is held to it by two tests:
`test/overrides-contract.test.ts` checks its shape, and `test/overrides/acceptance.test.ts` builds it
and inspects the output. The sample site replaces one navigation component (`related-guides`) and
one layout (`doc`); everything else comes from the default theme.

## What can be replaced

| Kind | Name | Theme unit | Replacement |
| --- | --- | --- | --- |
| component | `related-guides`, `callout`, … | `components/<name>/index.ts` | one `.ts` file under the site root |
| layout | `doc`, `guide`, … | `layouts/<name>.ts` | one `.ts` file under the site root |

The config key is the theme unit's name, not the replacement file's name. A page still says
`layout: doc` and still writes `<sl-component name="related-guides">`; the config decides which file
answers. Only an existing name can be replaced: an override never adds a unit, and a page cannot use
a name the theme does not have.

Chrome (`header`, `sidebar`, …), tokens, styles, i18n catalogs, and data are not replaceable in this
contract. A site that needs different navigation chrome replaces the layout that places it, as the
fixture's `doc` does.

## Configure an override

Put the map under `theme.overrides` in the site's `mizzen.yml`:

```yaml
theme:
  name: "@velella/lateen"
  overrides:
    components:
      related-guides: overrides/related-guides.ts
    layouts:
      doc: overrides/doc.ts
```

- The map has two optional keys, `components` and `layouts`, and each maps a theme unit name to a
  path.
- Paths are relative to the site root, the folder that holds `mizzen.yml`, and point at the unit's
  entry module. The module's default export must be a function with the theme unit's signature: a
  layout receives `LayoutProps`, a component receives `ComponentProps`.
- Sidecar files sit beside the entry module and use its file name: `<file>.css` for CSS. A
  replacement brings no client island.
- A resolved path must stay inside the site root. An absolute path, a `..` segment, or a symlink
  that leaves the root is an error, not a fallback.
- The engine reads this key. `mizzen.config.ts` code, a theme fork, a generated folder, and a build
  step are not involved.

The map is applied to the theme named by `theme.name`, after that theme is resolved. Changing the
theme changes which names exist; an override for a name the new theme lacks is an error.

## How Mizzen 0.2.4 applies the map

1. The config schema accepts two optional maps of non-empty strings under `theme.overrides`. An
   engine without this support rejects the key, so an old engine fails loudly instead of ignoring
   the setting.
2. Each path is resolved against the site root. An absolute path, a `..` escape, and a symlink that
   leaves the root are rejected before the module is imported.
3. After the theme registry is discovered, each listed name is checked against it. A listed name
   loads the site module like a theme unit: the engine imports it, requires a function default
   export, and registers it under the listed name in place of the theme's unit. The theme's
   same-name module is not imported.
4. CSS sidecars resolve relative to the override file, using the `<file>.css` name above.
5. The diagnostics below are errors, and each names the config key and the site-relative path.
6. Override files and sidecars are build inputs: the build cache is keyed on them, and every worker
   receives the same resolved map.

No other engine support is required. In particular, the loader does not need a theme manifest
change, a new CLI flag, a generated theme folder, per-page overrides, or override support for
chrome, tokens, or styles.

## Precedence and fallback

1. `theme.overrides.<kind>.<name>`, when listed.
2. The theme's unit with that name, when not listed.
3. Nothing else. There is no page-level override, no environment switch, and no default outside the
   theme.

Precedence is by name and all-or-nothing. When a name is listed, the theme's file is not loaded and
not kept as a fallback: a broken override fails the build instead of quietly rendering the theme
unit. There is no merge of props, markup, or CSS between a site unit and the theme's unit. A layout
replacement takes over the whole page shell, including the chrome it places; a component
replacement takes over that component's markup and CSS only.

| Situation | Result |
| --- | --- |
| Name is not listed | The theme unit is used, with no diagnostic. |
| Name is listed, the file loads, and its default export is a function | The site unit is used; the theme unit is not loaded; no duplicate-name diagnostic. |
| Name is listed, but the file is missing or unreadable | Error `overrides.missing-file`; the build fails. |
| Name is listed, but the default export is not a function | Error `overrides.invalid-export`; the build fails. |
| Name is not a component or layout in the theme | Error `overrides.unknown-unit`; the build fails; no unit is created. |
| The path is absolute or leaves the site root | Error `overrides.outside-site`; the build fails. |
| `theme.overrides` is not a map of `components`/`layouts` maps of non-empty strings | Error `overrides.invalid-config`; the build fails. |

Every diagnostic names the config key and the site-relative path, for example:

```text
theme.overrides.components.site-nav: "site-nav" is not a component in theme "lateen"; overrides replace an existing unit, they do not add one.
theme.overrides.layouts.doc: "overrides/doc.ts" does not exist in the site root.
```

## Fixture

`test/overrides/fixtures/site/` is the sample site described above: a valid config that replaces
`related-guides` and `doc`, each with a CSS sidecar. Its pages exercise both overrides and one unit
that stays with the theme:

- `index.md` picks `layout: doc`, so it renders the site's `site-shell` and `site-header`, and its
  callout is the theme's own component.
- `related.md` also picks the overridden layout, and its `::related-guides` directive renders the
  site's navigation in place of the theme's.

`test/overrides/fixtures/invalid/` holds three settings the rules above reject: a valid module under
a name the theme does not have (`overrides.unknown-unit`), a path that leaves the site root
(`overrides.outside-site`), and a layout override whose file is missing (`overrides.missing-file`).

`test/overrides-contract.test.ts` checks the names against the theme, the paths against the disk, the
default exports, and that this page keeps the diagnostic IDs. `test/overrides/acceptance.test.ts`
builds the sample site with `--theme`, checks the rendered markup and stylesheets, builds a copy with
`base: /docs` to check the prefix on links and assets, and builds the invalid fixture to check that
it exits 1 with the three diagnostics.
