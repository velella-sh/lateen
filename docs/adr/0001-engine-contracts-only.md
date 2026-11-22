# 0001. The theme depends on the engine only through contract types

Status: Accepted (in force; stated in `AGENTS.md`, checked by `npm run typecheck`).

## Context

Lateen is a theme for the Mizzen engine. The tests and the docs check run against the published
`@velella/mizzen` that `npm ci` installs (`AGENTS.md`, "Setup"), and a maintainer may test against a
sibling checkout instead. Every theme unit receives engine data such as `Page`, `Site` and
`LayoutProps`.

## Decision

The theme may `import type` from `@velella/mizzen/contracts`, by package name and never by a relative
path. It imports nothing else from the engine (`AGENTS.md`, "Boundaries"). Source files under
`chrome/`, `components/` and `layouts/` import the types this way. `package.json` declares the
engine as a dependency, and Preact is a peer dependency.

## Consequences

- The engine can change internals freely; only the contract types are the theme's surface.
- `test/contracts-import.test.ts` asserts the shape of the record and list contracts at compile time,
  so `npm run typecheck` fails when the engine changes one and the theme must be revisited.
- Type-only imports leave no runtime link, so a theme unit cannot call engine code.
- A change that needs more of the engine must go through a new contract in Mizzen first.
