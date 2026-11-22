# Status components

A family map, not a unit. Folders stay flat under `components/` because Mizzen discovers components
from direct subfolders and uses the folder name as the component name. This file is ignored by
discovery.

| Folder | Role | Directive |
| --- | --- | --- |
| `status/` | Inline status chip with an icon and text, such as `:status[Done]{tone=positive}`. `values.ts` resolves a value to a tone and label, from `theme.options.status`. | `status` |
| `status-legend/` | Lists the configured status values. Imports `status/index.ts` and `status/values.ts`. | `status-legend` |
| `status-banner/` | Page banner for deprecated, experimental, or old-version pages, with severity, since, and replacement link. See its README. | `status-banner` |
| `page-status/` | Page banner driven by front matter `status`, `since`, `replaced_by` (experimental, beta, deprecated). | none (front matter, or props) |

Relationships: `status-legend` depends on `status`. `status-banner` and `page-status` both render
page-level banners from different inputs and different status sets (`status-banner`: deprecated,
experimental, old-version; `page-status`: experimental, beta, deprecated). They share no code today;
check both before changing banner wording or ids. Documentation for the inline pair is
`site/components/status.md`.

Rename or move a member only with a Mizzen change, because the folder name is the public component
name.
