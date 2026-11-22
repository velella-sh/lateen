# Architecture decision records

Short records of decisions that are visible in this repository. Each cites the files that show the
decision. A record states what is true now; it does not give dates or history that the repository
does not show. Superseding a decision means a new record and a changed status here.

| Record | Decision | Status |
| --- | --- | --- |
| [0001](0001-engine-contracts-only.md) | The theme depends on the engine only through `@velella/mizzen/contracts` types | Accepted |
| [0002](0002-unit-is-file-or-folder.md) | A unit is one file or one folder; no shared index | Accepted |
| [0003](0003-tailwind-and-tokens-to-generated-css.md) | Tailwind and token JSON compile to generated CSS; generated assets are not committed | Accepted |
| [0004](0004-vanilla-islands-progressive-enhancement.md) | Vanilla islands with progressive enhancement, no client framework | Accepted |
| [0005](0005-gate-suite-as-release-criteria.md) | The gate suite (a11y, RTL, visual, performance) is the release criteria | Accepted |
