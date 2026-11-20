# Public acceptance

A release is accepted when a site built the way a reader installs Lateen passes the cases in
`test/acceptance/`. The gate packs this checkout, installs the tarball and the exact Mizzen version
into an empty project, copies `test/acceptance/site/` into it, builds with that project's `mizzen`
command, serves the output and runs the Playwright cases from `test/acceptance/cases.ts`. Nothing
in the build reaches into the repository, so a case cannot pass on a repository-only shortcut.

```bash
npm run test:acceptance
```

Chromium must be installed (`npx playwright install chromium`). The run writes
`test/acceptance/out/report.json` and the tested tarball beside it, validated by
`schema/acceptance-report.schema.json`.

The component contract gate is `node --test test/contracts-optional.test.ts`: every directive unit
renders with its optional fields missing, an empty collection, and unknown values, and fails on a
throw or invented text.

## The ledger

`test/acceptance/features.json` lists every feature in the release scope as `shipped` or `deferred`:

- A shipped feature names issues and an acceptance case. The case must exist, and no two features
  may share it.
- A deferred feature has a reason and an issue. It cannot appear in a `CHANGELOG.md` bullet, because
  a reader would take that bullet as a shipped claim.

`test/acceptance/ledger.test.ts` holds both rules. The blog, API reference, code annotations, theme
overrides, version routing and the inline glossary term are deferred until the engine exposes them;
their reasons name the missing engine wiring. Add a case and move the entry to `shipped` in the pull
request that makes one externally usable.

## The release gate

The `release` workflow runs the same gate on the tagged commit and keeps its report and tarball.
Publishing needs that artifact, rechecks the commit, the tarball digest and the exact Mizzen version,
and publishes that tarball alone. After publishing, it installs `@velella/lateen@<version>` from npm,
reruns the cases, and compares the published bytes with the tested digest. A skipped case, a failed
assertion, a different engine, or a different tarball stops the release.

The unit tests for the rules are `test/acceptance/gate.test.ts`: a complete report passes, and a
failed run, a missing case, a failed case, a mismatched commit, digest or engine each block it.

## After deployment

The deploy workflow runs the public gate once GitHub Pages publishes:

```bash
node scripts/smoke-deployed.ts --base "$PAGE_URL" --commit "$GITHUB_SHA" --report test/smoke/out/deployed.json
```

It visits home, components, search, changelog, a record, and a missing page at desktop and mobile
widths in light and dark. A console error, an uncaught exception, a failed same-origin request, a
response of 400 or more (the deliberate 404 page excepted), or a same-origin URL outside the deployed
base fails the run. So does a broken Components link, a theme that does not change or persist across
a reload, a search for `install` with no results, or a copy control that does not confirm the copy.
The report records the deployed commit and is kept as a CI artifact, so a release names the commit
that was actually live.
