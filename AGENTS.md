# Working on Lateen

A docs theme for people and agents, built on Mizzen: layouts, chrome, components, design tokens, and styles. The engine lives in Mizzen, not here.

Read `README.md` and `CONTRIBUTING.md` first. Each unit folder has its own rules: `layouts/README.md`, `chrome/README.md`, `components/README.md`, `tokens/README.md`, `styles/README.md`.

## Setup

Node 24 or later. The theme has no build step; Node runs its TypeScript source directly. Visual contract: sailcloth (Velella Night/Sail/Mist/Foam/Shell/Lateen Blue) — see `docs/design/sailcloth.md`.

```bash
npm ci
```

`npm ci` installs the published `@velella/mizzen`, which is what the tests and the docs check run against. No sibling checkout is required.

To test against a local Mizzen instead, clone `velella-sh/mizzen` beside this repository as `../mizzen`, run `npm ci` there, and use `node ../mizzen/bin/mizzen.ts check site`.

## Commands

```bash
npm run typecheck      # tsc --noEmit
npm test               # tokens:check + design check + node --test
npm run tokens         # regenerate styles/tokens.css from tokens/*.json
npm run test:a11y      # axe gate; needs npx playwright install chromium
npm run test:performance
npm run test:visual
```

Before a pull request: `npm run typecheck && npm test`.

## Boundaries

- The theme may `import type` from `@velella/mizzen/contracts`, by package name and never by a relative path. It imports nothing else from the engine.
- Preact is a peer dependency: `jsx: react-jsx`, `jsxImportSource: preact`.
- A unit is one file or one folder. Adding a unit never edits a shared index; follow the folder's README.
- `styles/tokens.css` is generated. Never edit it by hand; change `tokens/*.json` and run `npm run tokens`.
- `@velella/lateen/redesign` is a deprecated alias of the main theme; do not add a second theme under `redesign/`.

## Change rules

- Use only erasable TypeScript syntax (no `enum`, `namespace`, or parameter properties). Import local files with their `.ts` extension.
- A behavior change needs a test beside the others in `test/`.
- A docs site change must pass `npx mizzen check site` with 0 errors (or `node ../mizzen/bin/mizzen.ts check site` when testing a local engine).
- Accessibility and RTL are gates. Run `npm run test:a11y` when you touch layouts, chrome, components, or styles.
- One pull request = one change. Say what it fixes and how you checked it.
