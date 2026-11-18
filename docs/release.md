# Release

Lateen releases are tagged `v<version>` and published by the release workflow in
`.github/workflows/release.yml`. A tag starts the workflow; the acceptance job packs that commit,
installs the tarball with the exact Mizzen version into an empty project, builds the public
acceptance site with the installed CLI and runs the Playwright cases. Publishing needs that passing
report and publishes the same tarball. `docs/acceptance.md` describes the gate.

The two visual reports of a release are archived **after the release checks pass and before the tag
is created**, so the archived report names the commit that ships and cannot be rewritten later.

## 1. Prepare and check the release commit

```bash
npm ci
npm run typecheck
npm test
npm run test:performance
npm run test:a11y
npm run test:acceptance
node node_modules/@velella/mizzen/bin/mizzen.js check site --theme .
```

Move the changelog fragments and bump the version, then rerun `npm test`,
`npm run test:acceptance` and `node node_modules/@velella/mizzen/bin/mizzen.js check site --theme .`
on the final commit.

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

## 4. Tag and let the workflow publish

Push the tag for the release commit. The workflow checks that the tag names the version in
`package.json` and that the commit is on `main`, packs that commit, and runs the acceptance gate in
a clean project with the installed CLI. Publishing needs that passing report and publishes the same
tarball with npm provenance; a failed, missing or skipped case, a different engine version, a
different tarball digest, or a tag that does not name the version stops the release before npm sees
it. The workflow then installs the exact published version from npm and reruns the same cases, and
writes the GitHub Release for the tag.

A prerelease version such as `0.3.0-rc.1` goes to the `next` dist-tag and its GitHub Release is
marked as a prerelease. Running the workflow by hand with an existing tag is the retry path: a
version npm already serves is skipped, and an existing GitHub Release is left alone.

## 5. Trusted publishing (one-time setup)

There is no npm token in the repository. npm trusted publishing exchanges the `npm` environment's
OIDC identity for a short-lived credential, so the package must name this repository and workflow as
its trusted publisher:

1. On npmjs.com, open **@velella/lateen → Settings → Trusted publishing**.
2. Add a GitHub Actions publisher with organization `velella-sh`, repository `lateen`, workflow
   `release.yml`, and environment `npm`.
3. In the GitHub repository settings, create the `npm` environment. Required reviewers there make
   every publish wait for a manual approval.

Publishing fails with an authentication error when either side is missing or names a different
workflow or environment. The `id-token: write` permission in the workflow is what lets the job ask
for that identity.

The site deploy on `main` reruns the visual gates and writes the current commit's reports into
`site/_data/` before building, so `/accessibility/` and `/performance/` always show the deployed
commit; `/reports/` lists the archived releases.
