# 0002. A unit is one file or one folder, with no shared index

Status: Accepted (in force; stated in `AGENTS.md` and the folder guides).

## Context

The theme grows by adding layouts, chrome and components. A hand-edited index of every unit would
be touched by every change and would conflict between pull requests.

## Decision

A unit is one file or one folder (`AGENTS.md`, "Boundaries"). Adding a unit never edits a shared
index: the engine registry discovers units by listing the folder. `components/README.md` and
`chrome/README.md` define a component as `<name>/` holding `index.ts`, an optional `client.ts` and its
tests. `layouts/README.md` says every `.ts` file directly in `layouts/` is a layout, and helpers
shared by layouts go in a folder instead. The README's "Add a component" steps repeat the rule.
`src/index.ts` exports only the theme manifest (`name` and `folders`).

## Consequences

- Two pull requests that add different units do not touch the same file.
- The folder name is the unit's public name, so it must be lowercase kebab-case.
- A missing default export or an unknown directive surfaces as a diagnostic naming the file, not as
  a stale index.
- `npm run new:component <name>` scaffolds a folder and its test (`CONTRIBUTING.md`).
