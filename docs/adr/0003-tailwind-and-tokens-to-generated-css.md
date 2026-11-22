# 0003. Tailwind and tokens JSON compile to generated CSS

Status: Accepted (in force; stated in `AGENTS.md` and `styles/README.md`). One part differs from
the short rule, see Consequences.

## Context

Visuals need one source of truth that is checked for drift. `docs/design/sailcloth.md` fixes the
brand colors and names Tailwind CSS as part of the only design stack. Raw colors, font sizes,
shadows and z-index values in unit CSS are debt.

## Decision

- Visuals are authored in `styles/src/ui.css` (which imports the other files in `styles/src/`) and
  compiled with Tailwind to `styles/generated.css` (`npm run ui:css`).
- Design tokens are one W3C-style JSON file per group in `tokens/`. `scripts/tokens.ts` builds them
  into `styles/tokens.css`; `node scripts/tokens.ts --check` fails when that file is stale, and
  `npm test` runs it.
- `scripts/check-design.ts` scans unit CSS for raw values a token should carry.
- `styles/generated.css` and `components/performance-chart/chart.min.js` are never committed
  (`AGENTS.md`; both are listed in `.gitignore`). `npm run ui:build` makes them, and `npm test` runs it
  first (`pretest`).

## Consequences

- Generated files are never edited by hand and never reviewed in a diff.
- `scripts/check-ui-build.ts` proves two clean builds match each other, and `scripts/check-package.ts`
  lists both files as required artifacts, so `prepack` builds them before publishing.
- `styles/tokens.css` is generated but is committed (`git ls-files styles` lists it), and the
  `--check` gate keeps it fresh. The "never commit" rule names only the two files above.
- Changing a token means editing JSON and running `npm run tokens`, not editing CSS.
