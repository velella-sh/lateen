# Release

Lateen releases are tagged `v<version>` and published manually from a maintainer's checkout; there
is no release workflow in this repository. The release tool moves `changelog.d/` fragments into
`CHANGELOG.md` and bumps `package.json`.

The two reports of a release are archived **after the release checks pass and before the tag is
created**, so the archived report names the commit that ships and cannot be rewritten later.

## 1. Prepare and check the release commit

```bash
npm ci
npm run typecheck
npm test
npm run test:performance
npm run test:a11y
node node_modules/@velella/mizzen/bin/mizzen.js check site --theme .
```

Move the changelog fragments and bump the version, then rerun `npm test` and
`node node_modules/@velella/mizzen/bin/mizzen.js check site --theme .` on the final commit.

## 2. Write the two reports for that commit

```bash
mkdir -p .mizzen/release-reports
node scripts/test-a11y.ts --report .mizzen/release-reports/a11y.json
node scripts/performance-budget.ts --report .mizzen/release-reports/performance.json
```

Both scripts validate their file against the schema in `schema/` before writing it. `.mizzen/` is
ignored by git; the archived copies are the ones that are committed.

## 3. Archive the reports once

Run this with the version from `package.json`, on the release commit, **before tagging**:

```bash
node scripts/archive-reports.ts <version> \
  --a11y .mizzen/release-reports/a11y.json \
  --performance .mizzen/release-reports/performance.json
```

This writes `site/_data/reports/<version>/a11y.json` and `performance.json`, records each file's
SHA-256 and its JavaScript and CSS gzip totals in `site/_data/reports/index.yml`, adds
`site/reports/<version>/index.md`, and updates the table on `site/reports.md`. Commit all of those in
the release commit.

The script refuses a version that is already stored: an archived report is evidence and is never
rewritten. If a release report is wrong, fix the gate and cut the next version; do not edit the
archive.

## 4. Tag and publish

Tag the release commit and publish the package. The site deploy on `main` reruns both gates and writes
the current commit's reports into `site/_data/` before building, so `/accessibility/` and
`/performance/` always show the deployed commit; `/reports/` lists the archived releases.
