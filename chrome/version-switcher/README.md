# Version switcher

A native disclosure in the header that lists the same page in every documentation version and links to each. It
works without JavaScript: `<details>` and `<summary>` are keyboard operable on their own, and `style.css` only
positions the open list.

The current version is marked with `aria-current="true"` and the visible "Current version" badge, so the mark is
not color alone. When the page does not exist in another version, that version's entry links its home page, found
from the version's URL folder (`/v1/guide/install/` gives `/v1/`) unless the data sets `home`. That entry carries
`data-version-target="home"` and a visible "Not in this version" note in the page's language; a link to the same page
carries `data-version-target="page"`, so a client can tell the two apart without reading the text.

The unit renders nothing when it finds fewer than two versions, and nothing on a page the version data does not
list.

## Where the data comes from

It reads `site.data.docsVersions` first (`_data/docsVersions.json`, `_data/docsVersions.yml`, or
`_data/docsVersions.yaml`), in either of two shapes. `_data/versions.yml` is the engine's routing file
(`default` and `old`), so keep the switcher data in its own file.

The N17 `versions.json` shape, with an optional `byUrl` lookup that is used when present:

```json
{
  "pages": [
    {
      "path": "guide/install.md",
      "versions": [
        { "version": "v1", "url": "/v1/guide/install/" },
        { "version": "v2", "url": "/v2/guide/install/" }
      ]
    }
  ],
  "byUrl": { "/v1/guide/install/": "guide/install.md", "/v2/guide/install/": "guide/install.md" }
}
```

A simple page-to-versions map, keyed by page URL (with or without `base`) or page path, where a value is a list of
entries or a terse `version: url` map:

```json
{
  "/guide/install/": [
    { "version": "v1", "url": "/v1/guide/install/" },
    { "version": "v2", "url": "/v2/guide/install/" }
  ]
}
```

A bare array is one page's list. URLs may omit `base`; the switcher adds it once, and never twice.

Without `site.data.docsVersions`, it falls back to the page's `versions` front matter:

```yaml
versions:
  - version: v1
    url: /v1/guide/install/
  - version: v2
    url: /v2/guide/install/
```

The engine writes `versions.json` at the build root, after rendering, so a site copies it into
`_data/docsVersions.json` before the build that renders the switcher, or writes the front matter above. With
neither, the switcher stays hidden.

## Placement

`chrome/header/index.ts` places it in `header-actions` before the search button.
