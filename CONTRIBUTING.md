# Contributing to Lateen

Thank you for helping. Most contributions are a bug report, a fix, a docs improvement, or a new test.

## Set up

Lateen supports Node 24 or later, which runs the TypeScript source directly. For development, use the Node version in `.node-version` and the npm version in `package.json` to match CI.

```bash
git clone https://github.com/velella-sh/lateen.git
cd lateen
npm ci
npm run ui:build
```

The tests and docs check use the published Mizzen installed by `npm ci`. To try a local engine change, clone Mizzen as `../mizzen`, run `npm ci` there, then run `node ../mizzen/bin/mizzen.ts check site --theme .` from Lateen.

## Before you open a pull request

```bash
npm run typecheck
npm test
```

A change to behavior needs a test beside the others in `test/`. A change to the docs site is checked with `npx mizzen check site --theme .` and must report 0 errors.

## Visual baselines

`npm run test:visual` takes the screenshots and compares each with `test/visual/baselines/<case>.png`. A failure writes the before, after, diff and a side-by-side image into `test/visual/out/review/` and prints their paths; a screenshot with no baseline fails and says how to create one. Baselines change only with `node scripts/test-visual.ts --update`, and only in a pull request labeled `visual-change` that says what changed. The CI `visual` job runs both checks on `ubuntu-24.04`, fails when a baseline changes without that label, and writes the page, matrix entry and changed share to the step summary. Record them on CI, not on your machine: fonts and the rasteriser differ locally, so run the `record-baselines` workflow on your branch and it commits them for you. The published page is [Visual gates](https://velella.sh/lateen/visual-gates/). See `docs/design/visual-gates.md`.

## Ground rules

- Use only erasable TypeScript syntax (no `enum`, `namespace`, or parameter properties) and import local files with their `.ts` extension.
- Never commit compiled output.
- Keep a pull request to one change, and describe what it fixes and how you checked it.
- Security problems go through the organization's security policy, not a public issue.

## Releasing

Maintainers release from a checkout; the reports of the release commit are archived before the tag
is created. The commands and the order are in [`docs/release.md`](./docs/release.md). Pushing the
tag publishes to npm and writes the GitHub Release; publishing uses npm trusted publishing (OIDC),
so there is no npm token in the repository. The one-time setup is in the same guide.
