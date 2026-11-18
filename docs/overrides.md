# Replace a theme component or layout

A site can replace one component and one layout of the theme it builds with and keep every other
Lateen unit. The replacement is site code, named in `mizzen.yml`; the theme package is never edited,
forked, or copied.

This page is the contract. Mizzen 0.2.4 applies it during the build, and the sample under
`test/overrides/fixtures/` is built by `test/overrides/acceptance.test.ts`. The sample site replaces
one navigation component (`related-guides`) and one layout (`doc`); everything else comes from the
default theme.

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
- A CSS sidecar may sit beside the module as `<file>.css`; it is bundled instead of the theme unit's
  own stylesheet. A replacement brings no client island: the site owns any script it needs, and the
  theme's island for that unit is not loaded.
- A resolved path must stay inside the site root. An absolute path, a `..` segment, or a symlink
  that leaves the root is an error, not a fallback.
- The engine reads this key. `mizzen.config.ts` code, a theme fork, a generated folder, and a build
  step are not involved.

## Precedence and fallback

1. `theme.overrides.<kind>.<name>`, when listed.
2. The theme's unit with that name, when not listed.
3. Nothing else. There is no page-level override, no environment switch, and no default outside the
   theme.

Precedence is by name and all-or-nothing. When a name is listed, the theme's file is not loaded and
not kept as a fallback: a broken override fails the build instead of quietly rendering the theme
unit. There is no merge of props, markup, or CSS between a site unit and the theme's unit. A layout
replacement takes over the whole page shell, including the chrome it places; a component replacement
takes over that component's markup and CSS only.

Fallback and error behavior:

| Situation | Result |
| --- | --- |
| Name is not listed | The theme unit is used, with no diagnostic. |
| Name is listed, the file loads, and its default export is a function | The site unit is used; the theme unit is not loaded; no duplicate-name diagnostic. |
| The file imports cleanly but its default export is not a function | Error `overrides.invalid-export`; the build fails. |
| Name is listed, but the file is missing or unreadable | Error `overrides.missing-file`; the build fails. |
| Name is not a component or layout in the theme | Error `overrides.unknown-unit`; the build fails; no unit is created. |
| The path is absolute, leaves the site root, or reaches outside it through a symbolic link | Error `overrides.outside-site`; the build fails. |

Every diagnostic names the config key and the site-relative path, for example:

```text
"theme.overrides.components.site-nav" names no component "site-nav" in theme "@velella/lateen".
"theme.overrides.layouts.doc" names "overrides/missing-doc.ts", which does not exist.
```

## Build behavior

The engine resolves the map against the site root after the theme registry is discovered. It checks
each listed name, loads the site module in place of the theme unit, imports the CSS sidecar when one
exists, and adds the module and sidecar to the build and render cache keys. Every render worker
receives the same resolved map, so a page renders the same unit whichever worker writes it.

The override applies to the theme named by `theme.name`. Changing the theme changes which names
exist; an override for a name the new theme lacks is an error.

## Fixture

`test/overrides/fixtures/site/` is the sample site described above: a valid config that replaces
`related-guides` and `doc`, each with a CSS sidecar. `test/overrides/fixtures/invalid/` holds two
settings the rules above reject: an existing module under a name the theme does not have, and a
layout override whose file is missing. `test/overrides-contract.test.ts` checks the names against the
theme, the paths against the disk, the default exports, and that this page keeps the diagnostic IDs.
