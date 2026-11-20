# Visual gates

The `visual-gates` epic (#493) tests how the theme looks, not only how it behaves. This note fixes
what is compared, how, and the numbers every later issue (#495 to #507) uses. A later issue that
needs a different number changes this note first.

## What is gated

A screenshot of each layout and each component in the gallery, in light and dark, left-to-right and
right-to-left, at a mobile, a tablet and a desktop width. The exact matrix is in
`test/visual/matrix.json`; this note fixes only the rules it follows. Behavior stays with `test:a11y`
and `test:performance`; the visual gate answers one question: did the pixels of a page that did not
mean to change, change?

## The component state matrix

The page cases come from `test/visual/matrix.json`. The interaction cases come from
`test/visual/states.json`: one entry per component with a `client.ts`, naming only the states its
control really has. `test/visual/inventory.json` names every component the gallery covers.

`node scripts/visual-matrix.ts` derives every `<component>-<state>` case from the inventory and the
state list, prints them, and fails when an interactive component has no entry, an entry names no
inventory component, or a component or state appears twice. The checked JSON is the source of truth,
so there is nothing to regenerate: add the entry for a new client component, do not rewrite the
others. `npm test` runs the same check (`test/visual/matrix.test.ts`), so the CI test job already
proves it from a clean checkout and needs no separate step.

## Runner

**Playwright, Chromium only**, using the `playwright` devDependency already in `package.json`.
Why: it is already installed and pinned for `test:a11y`, it drives the same fixture and docs sites,
and a second browser would double the baselines and the flakes without finding a different kind of
fault. Firefox and WebKit rendering differences are not a theme concern we can gate by pixels.

Shots are deterministic by construction:

- One pinned runner image for the visual job, `ubuntu-24.04`, never `ubuntu-latest`, and the
  Playwright version from `package-lock.json`. Raising either is a baseline change (see below).
- The bundled fonts in `fonts/` only; the page waits for `document.fonts.ready` before the shot.
- Viewports `375×844` (mobile), `768×900` (tablet) and `1280×900` (desktop), `deviceScaleFactor: 1`,
  fixed locale and time zone (`UTC`), no network.
- `prefers-reduced-motion: reduce`, animations and transitions disabled, caret hidden, scrollbars
  hidden, and no hover or focus unless the case is an interaction state (#502).
- Full-page shots, capped at 4000 px of height; a taller page is cropped and the case says so.

## Comparer

**A small function of our own**, in `scripts/visual-compare.ts`, with no new dependency. Why: the
job is narrow (two same-size PNGs, one threshold, one share), Node's built-in `node:zlib` decodes
and encodes PNG, and a dependency such as `pixelmatch` plus `pngjs` would add two packages to audit
and, because sites get the tool from the package (#505), to ship. The function is about a hundred
lines and is unit-tested with synthetic images.

Rules the function follows:

1. Images of different sizes fail without a pixel comparison; the report gives both sizes.
2. A pixel is **changed** when its colour distance exceeds the threshold. The distance is the
   perceptual YIQ delta that `pixelmatch` popularised (alpha blended onto white first), normalised to
   `0..1`, so the numbers carry over if the comparer is ever swapped.
3. The case fails when the share of changed pixels is above the limit.
4. Anti-aliasing is not special-cased. The pinned image and fonts make it stable, and a fuzzy rule
   would hide a one-pixel border change, which is exactly what this gate is for.
5. The output is a diff image (changed pixels in red over a dimmed copy of the baseline) and a
   JSON line with the size, the changed count and the share.

## The numbers

| Setting | Value |
| --- | --- |
| Per-pixel threshold | `0.1` (normalised YIQ delta) |
| Largest share of changed pixels | `0.1%` (0.001) of the image |
| Baseline location | `test/visual/baselines/<case>.png` |
| Baseline format | PNG, 8-bit RGB, no metadata chunks |
| Size of one baseline | 550 KiB at most |
| Size of all baselines | 22 MiB at most |
| Runs per case before a failure counts | 1 (a flaky case is fixed or removed, not retried; #506) |

The size caps are checked by the gate itself, so the repository cannot grow without a decision. A
case over its cap is cropped, shrunk to a smaller fixture, or dropped. Raising the total cap is a
change to this note.

## Where baselines come from

Baselines are recorded **only on CI**, on the pinned image, and committed from there. A baseline made
on a developer machine is never stored: fonts, rasteriser and OS differ, and a local baseline would
make CI red or, worse, hide a change. A developer who wants a local look runs the gate and reads the
diff images; to update, they ask CI to record (#498).

## What is masked

A masked region is painted a solid colour in the page before the shot, so the baseline never holds a
value that changes with the calendar or the release:

| Masked | Where it shows |
| --- | --- |
| Dates and times | The last-updated line, the page footer, the feedback and report-issue details, any `<time>` element |
| Version numbers | The version switcher, the footer's package and engine versions, the build commit |
| Counts that follow the content of the build | The search result count and the page's reading time |

Rules: the mask is applied by a fixed selector list kept in `scripts/test-visual.ts`, plus any
element with `data-visual-mask`; the mask keeps the element's box, so layout is still compared. A
fixture site uses fixed dates and versions where it can, and the mask covers the docs site, which
cannot. Nothing else is masked: a region that is hard to keep stable is fixed at its source, not
hidden.

## When a baseline may change

A baseline changes **only in a pull request that says so**: the pull request carries the
`visual-change` label, its description says what changed and why, and the changed baselines are
reviewed as images in the diff. A pull request that changes any file under `test/visual/baselines/`
without the label turns CI red, and a pull request that changes the rendering of any case without
changing its baseline and without the label turns CI red too (#504). Raising the runner image or the
Playwright version is such a change.

## What the later issues use

- #496 (runner) and #499 (matrix): the runner settings and the matrix rules above.
- #497 (comparer): the comparer rules and the `0.1` and `0.1%` numbers.
- #498 (update flow): CI-only recording and the label rule.
- #500, #501: the token and layout checks are independent of the pixels and follow the same pinned runner.
- #503 (first baselines): recorded from CI after `refinement` and `showpiece` finish, within the size caps.
- #504 (CI) and #505 (site tool): the label rule, and the same comparer and numbers exposed as a
  package export with Playwright optional.
