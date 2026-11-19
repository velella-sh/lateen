# Working on Lateen

A docs theme for people and agents, built on Mizzen: layouts, chrome, components, and the sailcloth design stack. The engine lives in Mizzen, not here.

Read `README.md` and `CONTRIBUTING.md` first. Visual contract: `docs/design/sailcloth.md`.

## Setup

Node 24 or later.

```bash
npm ci
npm run ui:build
```

`npm run ui:build` compiles Tailwind + Basecoat from `styles/ui.css` into `styles/generated.css` and copies the Chart.js asset. Do not edit `styles/generated.css` by hand.

`npm ci` installs the published `@velella/mizzen`, which is what the tests and the docs check run against. No sibling checkout is required.

To test against a local Mizzen instead, clone `velella-sh/mizzen` beside this repository as `../mizzen`, run `npm ci` there, and use `node ../mizzen/bin/mizzen.ts check site`.

## Commands

```bash
npm run typecheck      # tsc --noEmit
npm run ui:build       # Tailwind/Basecoat CSS + Chart.js asset
npm test               # ui:build + design check + node --test
npm run test:a11y      # axe gate; needs npx playwright install chromium
npm run test:performance
npm run test:visual
npm run dev:redesign   # sailcloth demo site on port 4173
```

Before a pull request: `npm run typecheck && npm test`.

## Stack (only design system)

Mizzen + Node + TypeScript + Preact + **Tailwind CSS** + **Basecoat** + vanilla islands + **Lucide** + **Chart.js**.

- Visuals: `styles/ui.css` → `styles/generated.css`
- Icons: Lucide via `src/icon.ts` (not hand SVG sheets for new work)
- Charts: Chart.js islands under `components/charts` and `components/performance-chart`
- `@velella/lateen/redesign` is a deprecated alias of the main theme

## Boundaries

- The theme may `import type` from `@velella/mizzen/contracts`, by package name and never by a relative path. It imports nothing else from the engine.
- Preact is a peer dependency: `jsx: react-jsx`, `jsxImportSource: preact`.
- A unit is one file or one folder. Adding a unit never edits a shared index; follow the folder's README.
- Never commit `styles/generated.css` or `components/performance-chart/chart.umd.min.js`.

## Change rules

- Use only erasable TypeScript syntax (no `enum`, `namespace`, or parameter properties). Import local files with their `.ts` extension.
- A behavior change needs a test beside the others in `test/`.
- A docs site change must pass `npx mizzen check site` with 0 errors (or `node ../mizzen/bin/mizzen.ts check site` when testing a local engine).
- Accessibility and RTL are gates. Run `npm run test:a11y` when you touch layouts, chrome, components, or styles.
- One pull request = one change. Say what it fixes and how you checked it.
