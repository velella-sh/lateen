# Documentation versions

One release answers at the unprefixed URLs; older releases stay reachable under `/vN/`. The engine
owns the snapshot, the routing, and the versioned URLs; the theme renders the notice and the switcher.

## Snapshot a release

Keep the current docs at the site root, then freeze them:

```bash
npx mizzen versions snapshot v1 . --dry-run   # list what it would write
npx mizzen versions snapshot v1 .
```

The command copies every current page and the navigation file into `v1/`, rewrites navigation links
that target a copied page to its versioned URL, and writes nothing else. It refuses an existing
folder or a name that is not newer than a release already present.

## Route the default

`_data/versions.yml` names the release served at the canonical URLs:

```yaml
default: v2   # a released folder such as v2, or `current`
old: [v1]     # releases the default replaced
```

| Page | Written at |
| --- | --- |
| default release | `/path/` and `/vN/path/` |
| old release | `/vN/path/` only |
| current docs | `/path/` only while `default: current` |

The versioned URL never moves when the default changes. The copy that owns the canonical URL carries
no `canonical_url`; a versioned copy names the default release, and the theme writes that canonical.

To promote a release, snapshot the current docs as the next `vN`, set `default: vN`, and list the
previous default under `old`. To retire the current docs instead, set `default: current` and list
every release under `old`.

## Feed the switcher

The switcher reads `_data/docsVersions.*`, never `_data/versions.yml` (that file is routing). The
engine writes `versions.json` after rendering, so build once, copy it in, and build again:

```bash
npx mizzen build . --theme <lateen-theme>
mkdir -p _data
cp dist/versions.json _data/docsVersions.json
npx mizzen build . --theme <lateen-theme>
```

`versions.json` keys pages by source path and lists each version's URL, which the switcher accepts.
A page the data does not list shows no switcher. The notice reads only the routing data and appears on
every page in a version folder: it says **Current version** for the default release, **Old version**
for the others, and links the same page in the other release. A page with no equivalent links that
release's home, or the site home, and always a built page.

## Base path

Set `base: /docs` in `mizzen.yml` when the site is served below a path. Canonicals, the notice,
navigation, and the switcher carry the base once; the output folder stays unprefixed.

## Check it

```bash
node --test test/docs-versions/acceptance.test.ts
node --test test/docs-versions-theme/version-notice.test.ts
node_modules/.bin/mizzen check fixtures/docs-versions-theme --theme .
```

The fixture is `fixtures/docs-versions-theme/`: `v2` is default, `v1` is old, `guide/install` exists
in both, and `v1/guide/legacy` exists only in the old release. The acceptance test builds it at the
root, under `/docs`, and with `v1` as the default, then reads the written HTML and `versions.json`.
