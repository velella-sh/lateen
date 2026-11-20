# Sidebar

The left navigation column for the doc-like layouts. `index.ts` builds it from the engine navigation
tree, one `<details>` per group, and `client.ts` remembers which groups are open.

## Sibling pages

`theme.options.navigation.siblings: true` lists the current page's local sibling pages under the group
closest to it, using titles and URLs from the engine's page list. Only pages that the navigation does
not already list are added, so existing links, `aria-current`, group order, and collapse behavior stay
the same. Off by default; URLs already include the site base. See the [layouts guide](../../site/layouts.md#sidebar-sibling-pages).
