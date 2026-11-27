# Refinement

The `refinement` epic (#465) gives the theme the finish it lacks without changing its structure.
This note fixes the rules every later issue follows and lists the rough spots they fix. Each
later issue cites an entry of the audit by its id (`A1`, `A2`, ...).

## Rules

1. **One radius scale.** `radius-sm`, `radius-md`, `radius-lg` and `radius-full` are the corner scale;
   `radius-ctl` and `radius-card` stay as the control and card steps. A stylesheet never writes a
   corner length, and `src/brand.ts` keeps overriding these same tokens for the brand `radius` option.
2. **Hairline borders.** A border is one device pixel wide at its default strength (`thin`), drawn
   from the border tokens (`subtle`, `default`, `strong`). The strong border reaches 3:1 against the
   canvas, so it can mark a control's edge. A decorative divider uses `subtle` or `default`.
3. **Layered shadows.** A raised surface takes one of three elevation levels. In the light theme a level
   is a soft two-layer shadow; in the dark theme a shadow is invisible, so the level is a lighter
   surface plus a hairline border instead.
4. **Optical alignment.** Icons sit on the text baseline, numbers use tabular figures where they
   line up in columns, and large headings track and lead tighter than body text.
5. **Motion limits.** Motion is CSS only and comes from the `motion` tokens. It runs under 400 ms,
   never moves layout, never animates content on load, and every `transition` or `animation` is
   covered by the reduced-motion rule (it collapses to zero).
6. **Hover is never colour alone.** A hover changes a surface or a border, and every action stays
   reachable without hover. A focus ring has an offset and keeps 3:1 in both themes and in forced colours.
7. **Arabic script.** No letter-spacing on Persian or Arabic text: it breaks letter joining.
   Code stays left to right.
8. **Markup stays the same** unless an issue says so, so a `0.2.2` site renders the same except for CSS.
   An existing token is never renamed or changed in meaning; tokens are added.
9. **No layout redesign.** ~~No accent change.~~ The accent rule is replaced by [system-v2](system-v2.md) (2026-11-27); presets still derive from their accent.

## Audit

The audit reads the shipped stylesheets (`styles/`, `components/*/style.css`, `chrome/*/style.css`,
`layouts/*.css`). No screen captures are kept in the repository; the visual review is manual and the
automated visual gate arrives with `visual-gates`.

### Token

| Id | Finding | Where | Fixed by |
| --- | --- | --- | --- |
| A1 | `radius` and `shadow` tokens exist but there is no border-strength or elevation set; dark theme reuses the same shadow, which is invisible on a dark canvas. | every popover, card, menu | #467 |
| A2 | `color-border-strong` is 2.5:1 on the light canvas, so it cannot mark a control edge (3:1). | inputs, tabs, buttons | #467 |
| A3 | Headings share one leading and weight; no tracking per size; `text-wrap: pretty` is missing for paragraphs; no tabular numerals in tables, versions or the changelog. | docs pages, changelog layout, tables | #468 |
| A4 | Layouts spell their own gaps instead of taking one prose rhythm from the tokens. | `layouts/doc.css`, `tutorial.css`, `guide.css` | #469 |
| A5 | Neutrals are untinted greys; no explicit raised and sunken surface layers; visited link colour is not set. | all pages | #470 |
| A6 | The motion tokens hold no exit easing and no press duration. | menus, drawer | #472 |

### Component

| Id | Finding | Where | Fixed by |
| --- | --- | --- | --- |
| A7 | Hover, pressed and focus recipes differ per component; 55 stylesheets write `:hover`, 61 write `:focus-visible`, each in its own way. | tabs, cards, link cards | #471 |
| A8 | The code block has no header row, loud line highlights and numbers, no scrollbar styling and weak copy-button states. | `components/code`, `styles/parts-code.css` | #473 |
| A9 | Tables have no sticky header, no numeric alignment and no row hover. | `components/table`, `styles/base.css` | #474 |
| A10 | Callout, card and badge surfaces and hover are inconsistent. | `components/callout`, `cards`, `badge` | #474 |
| A11 | Persian and Arabic weights of Vazirmatn do not match Geist, and shadow offsets and active markers do not mirror. | RTL pages | #476 |

### Chrome

| Id | Finding | Where | Fixed by |
| --- | --- | --- | --- |
| A12 | The header has no scroll hairline or backdrop. | `chrome/header` | #475 |
| A13 | Sidebar and table-of-contents active markers and group spacing are not aligned; the collapsed state is plain. | `chrome/sidebar`, `chrome/toc` | #475 |
| A14 | Pager and footer columns do not align and use ad hoc borders. | `chrome/pager`, `chrome/site-footer` | #475 |
| A15 | Drawer, menu and theme change do not use the shared motion recipe. | `chrome/drawer`, `page-agent-menu`, `theme-toggle` | #472 |
