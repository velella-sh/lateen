# Working on Lateen

A docs theme for people and agents, built on Mizzen: layouts, chrome, components, design tokens, and styles. The engine lives in Mizzen, not here.

Read `README.md` and `CONTRIBUTING.md` first. Each unit folder has its own rules: `layouts/README.md`, `chrome/README.md`, `components/README.md`, `tokens/README.md`, `styles/README.md`.

## Setup

Node 24 or later. There is no build step; Node runs the TypeScript source directly.

Mizzen must be checked out beside this repository as `../mizzen`, because the tests and the docs site build with it.

```bash
npm ci
```

## Commands

```bash
npm run typecheck      # tsc --noEmit
npm test               # tokens:check + node --test
npm run tokens         # regenerate styles/tokens.css from tokens/*.json
npm run test:a11y      # axe gate; needs npx playwright install chromium
npm run test:performance
```

Before a pull request: `npm run typecheck && npm test`.

## Boundaries

- The theme may `import type` from `@velella/mizzen/contracts`, by package name and never by a relative path. It imports nothing else from the engine.
- Preact is a peer dependency: `jsx: react-jsx`, `jsxImportSource: preact`.
- A unit is one file or one folder. Adding a unit never edits a shared index; follow the folder's README.
- `styles/tokens.css` is generated. Never edit it by hand; change `tokens/*.json` and run `npm run tokens`.
- Never commit compiled output.

## Change rules

- Use only erasable TypeScript syntax (no `enum`, `namespace`, or parameter properties). Import local files with their `.ts` extension.
- A behavior change needs a test beside the others in `test/`.
- A docs site change must pass `node ../mizzen/bin/mizzen.ts check site` with 0 errors.
- Accessibility and RTL are gates. Run `npm run test:a11y` when you touch layouts, chrome, components, or styles.
- One pull request = one change. Say what it fixes and how you checked it.
