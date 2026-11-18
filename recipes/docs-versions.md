# Documentation versions: theme behavior

Lateen shows a reader which documentation release a page belongs to and links the same page in the
other release. The engine owns the lifecycle data and the versioned URLs; the theme only reads the
site model and renders it.

## Site data

The dispositions live in `_data/versions.yml` and reach the theme as `site.data.versions`:

```yaml
default: v2   # a released version folder, or `current`
old: [v1]     # releases the default replaced
```

A page's version is the first segment of its source path when it is a version folder (`v1`, `v1.2`,
`v1.2.3`), by the engine's rule. Pages outside every version are the current docs.

## The notice

`components/version-notice/` renders above the title on `doc`, `guide`, and `tutorial` pages:

- A page in the default release says **Current version** and links the same page in the first old
  release.
- A page in an old release says **Old version** and links the same page in the default release, or
  in the current docs when the default is `current`.
- A page the other release does not have links that release's home page when the site publishes one
  (`v2/index.md` at `/v2/`), else the site home. URLs come from `site.pages` only; the theme never
  builds one from a version name.
- A page outside the dispositions, or a site with no lifecycle data, renders no notice.

The notice is a named `note`, works without JavaScript, keeps version names left to right in RTL
text, and uses logical properties, so it mirrors with the page. Its label and hint carry the
meaning, so colour is not the only signal.

## What is not done here

Default routing is still engine work. The installed engine has `resolveVersionRouting`, but a 0.2.3
build writes current pages at `/` and versioned pages at `/v1/` and `/v2/`; it does not yet rewrite
a release to the canonical URL when `default` changes. The theme does not fake that behavior. The
end-to-end two-release acceptance test remains in #599.

## Check it

```bash
npm run typecheck
node --test test/docs-versions-theme/version-notice.test.ts
npx mizzen check site --theme .
```

The build fixture is `fixtures/docs-versions-theme/`: `v2` is default, `v1` is old, the install page
exists in both, and `v1/guide/legacy.md` exists only in the old release so its notice falls back to
the published `v2` home.
