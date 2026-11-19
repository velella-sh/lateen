---
title: Visual gates
description: How the screenshot gate runs, how to read a diff, and how a site checks its own pages.
layout: doc
permalink: /visual-gates/
---

The visual gate answers one question: did the pixels of a page that did not mean to change, change?
It shoots every layout and every component gallery page in light and dark, left-to-right and
right-to-left, at mobile, tablet and desktop widths. Each shot is compared with a committed
baseline. The settings and the numbers are in
[`docs/design/visual-gates.md`](https://github.com/velella-sh/lateen/blob/main/docs/design/visual-gates.md).

## Run the checks

From a clean checkout on Node 24:

```bash
npm ci
npx playwright install chromium
npm run test:visual
npm run check:design
```

`test:visual` builds the fixture site, shoots the matrix and the gallery's interaction states, and
compares each image. `check:design` checks the tokens and layout independently of the pixels. The
CI `visual` job runs both on `ubuntu-24.04`.

The same run checks every page for horizontal overflow, clipped text and controls smaller than 24 by
24 CSS pixels, and fails with each finding's page, selector and matrix entry.

## Read a diff

A pass prints one `ok` line per case. A failure prints the case and the changed share, and writes
four images into `test/visual/out/review/`:

- `<case>.before.png` is the committed baseline.
- `<case>.after.png` is the new shot.
- `<case>.diff.png` paints the changed pixels red over a faded copy of the baseline.
- `<case>.side-by-side.png` puts before, after and diff in one image.

A case with no baseline fails and names the missing file. A shot that fails once is retaken; when
the second take passes, the run prints `flaky <case>: passed on the second take` and the CI summary
marks the row `flaky`. The tolerance is never raised to hide a flaky shot.

To look at one case while working:

```bash
node scripts/test-visual.ts --only gallery
```

`--only` keeps the cases whose name contains the text. `--out <folder>` writes the shots somewhere
other than `test/visual/out/`.

## Update the baselines

A baseline changes only in a pull request that says so. Record it with:

```bash
node scripts/test-visual.ts --update
```

Then commit the changed `test/visual/baselines/` images, add the `visual-change` label to the pull
request, and explain in the description what changed and why. A pull request that changes a baseline
without the label fails the `visual` job. Record baselines on the pinned CI image rather than a
developer machine: fonts and the rasteriser differ locally. Every image stays under 550 KiB and the
whole folder under 22 MiB; `node --test test/visual/baselines.test.ts` checks both.

## Check your own site

A site runs the same comparer and review flow at each release, after its build. Playwright is an
optional peer dependency:

```bash
npm i -D playwright
npx playwright install chromium
```

```ts
import { visualCheck } from "@velella/lateen/visual";

const result = await visualCheck({
  site: "dist",
  pages: [
    { name: "home", path: "/" },
    { name: "install", path: "/install/" },
    { name: "install-mobile", path: "/install/", viewport: "mobile" },
  ],
  baselines: "test/visual-baselines",
});

for (const line of result.lines) console.log(line);
if (!result.ok) process.exit(1);
```

`site` is the built folder, `pages` are the paths to shoot with a stable name and an optional
`desktop` or `mobile` viewport, and `baselines` is the folder of committed images. Set `update: true`
to write those images instead of comparing, and `out` to choose where the shots and review images
go. The call returns the review lines and the reports, so a release script can fail the build on the
result. The same label rule applies: a change to a site's baselines belongs in a pull request that
says what changed.
