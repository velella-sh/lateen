# 0004. Vanilla islands with progressive enhancement, no client framework

Status: Accepted (in force; stated in `README.md`, `docs/design/sailcloth.md` and `docs/agent-ux.md`).

## Context

Documentation must be readable by people and agents without running scripts, in print, and when a
script fails. Pages are rendered on the server with Preact through Mizzen.

## Decision

Preact renders pages at build time only; the browser code is plain TypeScript. A component that needs
the browser adds `client.ts`, an island that ships only on pages using the component, and every
control it enhances starts `hidden` (`README.md`, "Add a component", step 4). The stack lists
"vanilla islands" (`AGENTS.md`, "Stack"). `docs/agent-ux.md` states that all content is in the
server-rendered HTML and every action stays hidden until its island runs. Other notes record the
same fallback: `docs/design/charts.md` (SVG plus a data table), `docs/design/timeline.md` (no script
for drawing) and `docs/design/data-explorer.md` (a no-JavaScript address answers a shared query).

## Consequences

- Without JavaScript a reader keeps the prose, code, recorded output and links.
- Each island is small and measured: `docs/performance.md` budgets client islands, CSS and fonts,
  and `test/island-*.test.ts` cover boot and teardown.
- Rich interaction must be written by hand and cannot rely on a framework's state or hydration.
- Embeds ship no islands at all (`docs/design/embedding.md`).
