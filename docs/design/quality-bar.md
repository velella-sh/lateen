# Quality bar

The redesign of 0.2.6 (epic `design-audit`, issue `design-audit-4`) must reach the patterns below.
Each pattern is turned into rules a check can measure. A rule that no check measures yet is marked
**manual**; the reviewer ticks it on the pull request. This note stays in `docs/design/`: it is not a
public page and it names no other product.

## What is not copied

The patterns are common to good docs sites. The theme copies no brand, logo, asset, code or exact
look from any other product, and a rule here never says "like site X". When a number is chosen, it
is chosen because it reads well, not because another site uses it.

## Patterns and rules

| # | Pattern | Rule | Check |
|---|---------|------|-------|
| 1 | Bold brand colour on primary actions and active navigation | Text on the brand colour has contrast of at least 4.5:1; the active nav item differs from an inactive one by more than colour (weight, marker or background) | `scripts/token-contrast.ts`; **manual** for the second half |
| 2 | Clear heading hierarchy | Each heading level is at least 1.15 times the size of the next one down; `h2` has more space above than below (at least 1.5 times) | **manual** until `prose-1` adds a computed-style test |
| 3 | Card groups | Cards in a group have equal height per row, a gap of at least 12px, and one hover and one focus recipe | **manual**; `components-polish-1` owns the recipe |
| 4 | A clean sidebar | The active item is visible without colour; the sidebar scrolls on its own; no item is shorter than 32px | **manual** |
| 5 | Two-column API reference with sticky examples | At 1280px and wider the examples sit beside the text and stay in view; `.api-page` has a grid; the method badge shows the method as text | `test:a11y` on the API layouts; **manual** for stickiness |
| 6 | Framed code blocks with tabs | A code block has a visible frame and a copy button; tab labels are real `tab` roles | `test:a11y` |
| 7 | A command palette | The dialog opens with Ctrl+K or ⌘K, traps focus and closes on Escape; results announce their count | `test:a11y`; `test/search-open-budget.test.ts` |
| 8 | A landing page that demonstrates the product | The home page uses the theme's own components, not a screenshot of them | **manual** |

## Rules that apply everywhere

| Rule | Value | Check |
|------|-------|-------|
| Text contrast | At least 4.5:1 for body text, 3:1 for large text and UI borders, in light and dark | `scripts/token-contrast.ts`, `test:a11y` |
| Sticky offsets | A sticky element never hides an anchor target; `scroll-margin-top` is at least the header height | **manual** until `layout-shell-1` |
| Target size | At least 24px by 24px for every control, 44px by 44px on touch widths | `test:a11y` (24px); **manual** (44px) |
| Line length | Prose is at most 75 characters (`max-width` near `75ch`) at every width | **manual** until `design-audit-5` |
| Header overflow | At 320px the header controls do not overflow or wrap over the page title | `design-audit-5` (browser check) |
| Unstyled elements | No element in a captured page has a class that no style rule uses | `design-audit-5` (browser check) |
| Colour is never the only signal | Forced-colours and print show state through borders, text or patterns | `styles/forced-colors.css`, `styles/print.css`; **manual** |
| Motion | No motion under `prefers-reduced-motion: reduce` | `test:a11y`; **manual** |

## How a rule changes

A pull request that changes a number edits this note in the same commit and says why. Moving a rule
from **manual** to a named check removes the word **manual** in the same pull request as the check.
