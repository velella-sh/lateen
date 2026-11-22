# 0005. The gate suite is the release criteria

Status: Accepted (in force; stated in `docs/release.md`, `docs/acceptance.md` and `AGENTS.md`).

## Context

A theme can regress without a unit test failing: contrast, right-to-left layout, pixels and page
weight all change silently. `AGENTS.md` already says accessibility and RTL are gates.

## Decision

A release is a commit that passes every gate. `npm run release:candidate` refuses a dirty tree, checks
out `HEAD` in a detached worktree, installs from scratch and runs, in order: typecheck, unit and
documentation tests (including the design and token checks), accessibility, performance, visual, the
public acceptance gate and `mizzen check site` (`docs/release.md`). A failed, skipped or missing gate
leaves `status: "failed"` in the report, and that commit is not tagged.

- Accessibility: axe over the layouts, both themes, English and right-to-left locales
  (`scripts/test-a11y.ts`).
- RTL: part of the same matrix, plus `test/rtl-css.test.ts` and `styles/rtl.css`.
- Visual: screenshots in light and dark, LTR and RTL, three widths, on a pinned runner
  (`docs/design/visual-gates.md`, `test/visual/matrix.json`).
- Performance: byte budgets treated as regression baselines (`docs/performance.md`).
- Acceptance: the packed tarball built into an empty project (`docs/acceptance.md`).

## Consequences

- The a11y and performance reports of a release are archived before the tag (`docs/release.md`).
- Visual baselines change only in a pull request labeled `visual-change` (`CONTRIBUTING.md`).
- The suite is slow and needs Chromium, so day-to-day work uses `npm run test:changed` and
  `npm test`; the full suite runs in CI and at release.
