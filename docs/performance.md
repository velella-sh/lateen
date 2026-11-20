# Client, CSS, and font performance budgets

Lateen ships a stylesheet bundle, a set of client islands, and eight self-hosted webfont faces with
every page. This page explains how that weight is measured, where the numbers live, and when a budget
may change.

The budgets are **regression baselines**, not product requirements. Nothing here says a page should
weigh a particular number of bytes; the numbers record what the theme shipped when the baseline was
taken, so an unintended change shows up as a failure instead of passing quietly.

## Run the measurement

A clean checkout needs Node 24 or later and `npm ci`. The script builds the fixture with the
`@velella/mizzen` version the project installs, measures the output in a temporary folder, and deletes
it:

```bash
node scripts/performance-budget.ts
```

It prints one row per route and asset class, then one row per font file with the `@font-face` context
that loads it, then checks the result against `fixtures/performance/budget.json`. Add
`--report <file>` to write the same numbers as JSON, validated against
`schema/performance-report.schema.json`. Exit code 0 means
every route is within the budget. Exit code 1 lists each problem with the route and the asset class it
belongs to, and for a font the file itself, for example:

```text
route /reference/: js/components loads 6 assets, the baseline is 5
route /reference/: js/components is 4,600 B gzip, the baseline is 4,427 B (limit 4,491 B)
route /reference/: font/self-hosted loads assets/theme/fonts/geist/geist-sans-latin-600-normal-….woff2 (Geist 600 normal), which is not in the budget; run `node scripts/performance-budget.ts --update`
route /reference/: font/self-hosted assets/theme/fonts/geist/geist-sans-latin-400-normal-….woff2 is 24,900 B gzip, the baseline is 20,172 B (limit 20,236 B)
```

## Comparing a pull request with main

The `performance-compare` CI job checks out the pull request as `head` and its base branch as `base`,
installs both, and builds `scripts/asset-manifest.ts` on each. Both checkouts measure the same fixture
routes, so a difference belongs to the pull request rather than to different content:

```bash
node scripts/asset-manifest.ts --report asset-manifest.json          # in the base checkout
node scripts/asset-manifest.ts --report asset-manifest.json          # in the head checkout
node head/scripts/performance-compare.ts --base base/asset-manifest.json \
  --head head/asset-manifest.json --report reports/performance-compare.json
```

The report gives each route a CSS, JavaScript, font, and total gzip delta, then names every changed
asset with its own delta:

```text
route /reference/: css +0 B gzip, javascript +1,204 B gzip, font +0 B gzip, total +1,204 B gzip
route /reference/: js/components +1,204 B gzip (assets/theme/islands/components/foo/client.js +1,204 B)
```

`--tolerance <bytes>` allows that much gzip growth per existing asset; it defaults to `0`, so the two
checkouts must compress to the same number. The job fails when a route appears on only one side, when a
route lists the same path twice (two downloads of one file), when an asset is added — a new dependency,
whatever its size — or when an existing asset grows past the tolerance. Removed assets and shrinks pass.
A changed global CSS bundle is counted and named under `css/base` on every route that loads it.

The JSON report is validated against `schema/performance-compare.schema.json` and uploaded as the
`performance-compare` artifact, including when the comparison fails.

## The fixture

`fixtures/performance/` is a small Mizzen site built with this theme. It has three fixed routes:

| Route | What it represents |
| --- | --- |
| `/` | A short documentation page: prose, a list, a table, a code sample, and a callout. |
| `/guide/` | A typical guide: steps, two code samples, a callout, and a disclosure. |
| `/reference/` | The heavy end: code tabs, tabs, OS tabs, a terminal, a table, and a disclosure. |

The routes are deliberately stable. Changing their content changes the measurement, so a fixture
change belongs in the same pull request as a budget update, with an explanation.

## What is measured

For each route, the script reads the built HTML and assigns what the page loads to one of six asset
classes:

| Class | A route counts |
| --- | --- |
| `css/base` | The shared stylesheet bundle every page loads. |
| `css/page` | The bundle of the page's layout and component styles. |
| `js/chrome` | Chrome islands (theme chrome such as the header, sidebar, and table of contents) and the modules they import. |
| `js/components` | Islands of the components the page uses, and the modules they import. |
| `js/inline` | Inline JavaScript the page evaluates, such as the theme script in `<head>`. |
| `font/self-hosted` | The font files the stylesheets the page loads declare in an `@font-face`. |

For every class the run records:

- **raw** — bytes as written.
- **gzip** — bytes after gzip level 9, summed per asset because each stylesheet, module, and font is its
  own response. Inline JavaScript is compressed on its own for comparison; it travels inside the HTML
  document rather than as a separate request.
- **count** — stylesheets, module files the page loads at startup, inline scripts, or font files. A
  module a page does not reach is not counted, and a module imported by two islands is counted once.

Media is reserved before it downloads: a video or embed box holds its 16:9 frame with CSS, so the
poster or player fills the box instead of moving the page when it arrives, and an image keeps its
authored `width` and `height` so its space exists before the image is fetched.

The font class also records the files behind its totals, so `budget.json` lists every font response
with its URL, the stylesheet that declares it, and the family, weight, style, `font-display`, and
`format()` of the face that asked for it.

Scrolling a loaded record list changes no rows and starts no new index read or filter work. Filtering
runs only on input, after the typing pause.

### How fonts are counted

- A page preloads only its direction's primary family — Manrope on an LTR page, Vazirmatn on an RTL
  page — and the other script's face is fetched only when a glyph needs it. Mono stays shared by both
  directions.
- A font is discovered from the stylesheets the route actually loads, never from the theme's font
  folder. A face declared in a stylesheet no page links is not measured.
- One file is one response per route, however many faces or stylesheets declare it. Two faces that name
  the same file count once, and so does a file both the base and the page bundle declare. A `<link
  rel="preload" as="font">` of a file the CSS already declares adds a reference, not a second transfer.
- A face with only a `local()` source — the size-adjusted fallbacks the theme ships — transfers nothing
  and is not counted, and neither is a face inside a CSS comment.
- URLs are read as the browser reads them: percent-escapes (`%20`) and CSS escapes (`\20 `) resolve to
  the file the build emitted, a query string or fragment is dropped, and a relative URL is resolved
  against the stylesheet that writes it. A site served under a base path writes `/docs/assets/…` URLs
  while the build emits `assets/…`; the leading segments that only carry the base are dropped.
- A font that cannot be resolved fails the run by name. An external URL (`https://…`, `//…`, or a
  `data:` URI) is outside this budget and also fails: the theme self-hosts, and a remote face is a
  privacy and availability question before it is a byte question.

Images and the HTML prose stay outside the budget. The measurement is a transfer-and-startup proxy: it
does not time a browser, a device, or a network. The font numbers are an upper bound on purpose: they
count every face the loaded CSS declares, including one a browser may skip because its `unicode-range`
(U+0600 and friends on a Latin page) or its `font-display: optional` timing keeps it out of the first
paint. What the budget guards is the weight the theme declares, which is what a typography change
controls.

## Asset manifest

`node scripts/asset-manifest.ts` builds the same fixture and writes `reports/asset-manifest.json`, or the
`--report <file>` path. The file records one row per route and response: stylesheets, the startup module
of each external script and the modules it imports, inline scripts as `inline:<n>`, and font files. Each
row has the output path, the asset class, and the raw and gzip size. Routes are ordered by URL and a
route's assets by path, so a diff names what changed. The file validates against
`schema/asset-manifest.schema.json`.

The manifest is the route's dependency list in one place. A simple article must have no `js/components`
response: a component island there is a new global dependency, and `test/asset-manifest.test.ts` fails
when one appears. The test also fails when a route names the same path twice, so a duplicate download
cannot enter the manifest quietly. Shared modules are allowed across routes; within one route they count
once. `test/island-assets-fixture.test.ts` builds the packaged performance fixture and checks the rule
on real pages: a simple article such as `/alpha/` requests no component island, while `/alpha/compare/`
requests its own island exactly once and another route never downloads it.

No content page statically references the Pagefind index. The search dialog fetches it on first open, and
the search results page starts it on load; `test/search-deferral-fixture.test.ts` holds both to that, so a
reader who never searches downloads no index.

## Adjustment policy

1. Run `node scripts/performance-budget.ts`. Treat a failure as a question, not a formality: find what
   grew and why, and prefer removing work over raising the budget.
2. If the growth is intended, record the new baseline:

   ```bash
   node scripts/performance-budget.ts --update
   ```

   Commit the changed `fixtures/performance/budget.json` with the change that caused it.
3. Say in the pull request which route and class moved, by how much, and why the new baseline is
   correct. A budget update without that explanation should not be merged.
4. A decrease is recorded the same way. The budget ratchets down so the saving is not lost later.

Each route is compared only with its own baseline, so a data page's cost cannot raise the budget of a simple
article, or the other way round. Separation skips no checks: a route the budget lists but the fixture no
longer builds, and a route the fixture builds with no budget entry, both still fail.

The check allows each class `256` bytes of gzip headroom, the `TOLERANCE_BYTES` constant in
`scripts/performance-budget.ts`. It absorbs small differences in gzip output between zlib builds, so a
clean checkout on another Node release does not fail for a byte; it is not a growth allowance.

Module counts are checked without that headroom: an island added to a route is a new request and a new
module to evaluate, whatever its size.

Fonts are checked twice: once as a class, against the totals above, and once file by file, with the same
`256` bytes of gzip headroom per file. The per-file pass is what makes a swapped or renamed face fail even
when the totals happen to stay level, and it also fails a baseline entry the route no longer loads, so a
shrink cannot leave a face in `budget.json` that nothing measures any more. `--update` rewrites the whole
list from the run, so the recorded files, URLs, and face context always match what the fixture builds.

## Mermaid build cache

Mermaid diagrams are rendered in child processes while the site builds. Set
`LATEEN_MERMAID_CACHE_DIR` to keep those renders between builds:

```bash
LATEEN_MERMAID_CACHE_DIR=.cache/mermaid node scripts/performance-budget.ts
```

Entries are keyed by normalized source, render options, and the cache-format version, and each is
written atomically, so parallel builds can share the directory safely. The cache changes build time
only: page output, page weight, and these budgets are unchanged. An unset directory, a read-only
directory, a cache miss, or a corrupt entry falls back to a normal render. Clear it by deleting the
directory, for example after changing the Mermaid version:

```bash
rm -rf .cache/mermaid
```

## Visual gate

`npm run test:visual` shoots the matrix and the gallery's interaction states in Chromium, compares
every shot with the committed baseline, and reports a failing shot with its before, after and diff
images. The local numbers on Chromium 158.0.8127.18 and macOS are **25 s for the 77 matrix shots** and
**11 s for the 72 interaction states**. A shot that fails is retaken once; a second take that passes is
reported by name as `flaky`, and the tolerance is not raised.

The CI `visual` job runs on `ubuntu-24.04` with a **10-minute cap**; the visual step itself stops at
8 minutes. See `docs/design/visual-gates.md` for the comparer, the baseline rules and the size caps.
