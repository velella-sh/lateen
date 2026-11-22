# Chart components

A family map, not a unit. Mizzen discovers components by listing the direct subfolders of
`components/`, and the folder name is the component name, so these folders stay flat. This file is a
plain file, so discovery ignores it.

| Folder | Role | Directive |
| --- | --- | --- |
| `chart-data/` | Shared base. `index.ts` renders the closed "data table" disclosure and download links; `input.ts` (validation, labels, series colours), `scale.ts` (extents, ticks, scales), `svg.ts` (marks, frame), `download.ts`, and `island.ts` (island helpers) are imported by the others. Not a directive. | none |
| `bar-chart/` | Horizontal bars from a data source. Exports `rowsOf`, `shortenLabel`, and the no-value texts that `stacked-bar` reuses. | `bar-chart` |
| `stacked-bar/` | Stacked bars. Imports row helpers from `bar-chart` and everything else from `chart-data`. | `stacked-bar` |
| `line-chart/` | Time or numeric series. Uses `chart-data` helpers plus `timeline/scale.ts`. | `line-chart` |
| `charts/` | Inline `:::charts` block with `rows` text. `data.ts` parses rows, `client.ts` is the island. Uses `chart-data` for the table. | `charts` |
| `performance-chart/` | Chart.js bundle-size chart, lazy-loaded by `client.ts`. Uses `chart-data` for the table. | `performance-chart` |

Relationships: `chart-data` is the leaf everything depends on. `stacked-bar` depends on `bar-chart`.
No other family member imports another. Chart.js islands live in `charts/` and `performance-chart/`;
the SVG charts (`bar-chart`, `stacked-bar`, `line-chart`) ship no chart library.

Rename or move a member only with a Mizzen change, because the folder name is the public component
name used by directives and site overrides.
