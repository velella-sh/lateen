# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Teams who build documentation sites on Mizzen, and the readers of those sites. Readers are people and AI agents, and both are equal users: an agent reads and edits the docs as much as a person does. Readers look something up, follow a guide, or read an API reference.

## Product Purpose

Lateen is a docs theme: layouts, chrome, components, design tokens and styles that Mizzen reads from folders. It exists so a docs site is easy to read and safe to edit. Success means a reader finds an answer fast, an author changes one thing in one place, and the release gates (accessibility, contrast, visual, performance) stay green.

## Positioning

Agent-ready docs. Search, structure and the "ask an agent" path are built for agents as well as people. Neighbouring themes treat the agent as an afterthought.

## Operating Context

Sites are built with Mizzen (Node 24, TypeScript, Preact, Tailwind, vanilla islands). A unit is one file or one folder. Release is gated by the check suite (`npm test`, a11y, smoke, performance, visual).

## Capabilities and Constraints

- Layouts, chrome, components, nine presets, starters, charts, search, reports and an API reference.
- Every visual decision is a token in `tokens/*.json`; styles read tokens only (see `docs/design/system-v2.md`).
- The theme imports only types from `@velella/mizzen/contracts`.
- The user delegated the choice of further durable constraints ("whatever you see fit"). Inferred, not confirmed: keep the WCAG 2.2 AA gates, the tokens-only rule, and the existing RTL code and gates (add no new RTL or Persian work).

## Brand Commitments

The Lateen name and mark (`.github/assets`), and the three font families Manrope, JetBrains Mono and Vazirmatn. Brand colours are being reset in the design-system-v2 epic; do not treat the current accent as binding.

## Evidence on Hand

The live docs site (`site/`), the CHANGELOG, the ADRs in `docs/adr/` and the design notes in `docs/design/`. No customer quotes, case studies or benchmarks exist in the repo; do not invent them.

## Product Principles

- Reading comes first; chrome recedes.
- Safe to edit: one change, one place, one token.
- Agents and people are equal readers.
- Accessibility is a release gate, not a polish step.
- Add names, never silently rename or remove them.

## Accessibility & Inclusion

WCAG 2.2 AA with keyboard, contrast and axe gates. Existing RTL support stays in place.
