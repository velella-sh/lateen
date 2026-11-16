# Tokens

Design tokens, one group per file: `tokens/<group>.json`, lowercase kebab-case. A group file is a JSON object of token names to values; the registry reads the groups in sorted path order.

A `tokens/<group>.light.json` file sets only the light values of a group. Its dark values and motion reduced values come from `names.json` or a plain `<group>.json` file. Example, `tokens/color.light.json` sets `canvas` and `text`; `color.dark.json` is not supported yet.

Example, `tokens/space.json`:

```json
{
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "1rem"
}
```

## State

`tokens/state.json` holds the interaction states every control shares. The values come from the
approved palette (`docs/design/decisions.md`) and the approved mockups:

| Token | Light | Dark | Source |
| --- | --- | --- | --- |
| `state-hover-bg` | `#d8dee98c` | `#3636468c` | `overlay`, at the mockups' 55% opacity |
| `state-active-bg` | `#c5cddc` | `#54546d` | `highlight` |
| `state-selected-bg` | `#d8dee9` | `#363646` | `overlay`, the mockups' active item |
| `state-selected-fg` | `#3f5f88` | `#7fb4ca` | `accent-text`, darkened on light to pass WCAG 2.2 AA |
| `state-disabled-fg` | `#8892a6` | `#727169` | `muted` |
| `state-focus-ring` | `#5e81ac` | `#7e9cd8` | `accent` |
| `state-overlay` | `#00000066` | `#000000b3` | modal scrim, unchanged |

`state-selected-fg` is the one deliberate departure from the raw palette: `accent-text` in day
(`#4c6f9a`) reaches only 3.84:1 on `state-selected-bg`, so its token task value is `#3f5f88`
(4.85:1), as `docs/design/decisions.md` allows. The focus ring keeps the accent: 3.50:1 on the day
canvas and 5.94:1 on the night canvas, above the 3:1 non-text minimum. `styles/base.css` names the
ring again as `Highlight` under `forced-colors: active` so it survives forced colors.

## Chart

`tokens/chart.json` holds the colours of build-time charts (`docs/design/charts.md`). They are separate
from `state` and `color`: no chart token references a status, callout, or state colour.

| Tokens | Meaning |
| --- | --- |
| `chart-cat-1` to `chart-cat-8` | Eight categorical colours, one per series, in light and dark. |
| `chart-seq-1` to `chart-seq-5` | One sequential scale, lightest-looking step to strongest, one hue. |
| `chart-pattern-1` to `chart-pattern-8` | The pattern fill of each category: `solid`, `diagonal`, `dots`, `crosshatch`, `vertical`, `horizontal`, `diagonal-reverse`, `grid`. A chart draws it in print and in forced colours, where colour alone is lost. The value is a name, the same in both themes. |

`test/tokens.test.ts` checks every colour: 3:1 against `color-canvas` and `color-surface` in both themes,
and a minimum OKLab distance between every pair (8 for categories, 5 for the sequential steps) in normal vision and under
simulated protanopia, deuteranopia, and tritanopia (`test/support-chart-colour.ts`).

## Status

`tokens/status.json` holds the colours of a record's status: five tones (`positive`, `caution`, `negative`, `neutral`, `info`), each with `fg`, `bg` and `border`, as `status-<tone>-<part>`, with light and dark values. They are their own values, not references to the callout colours, so a tone can change without touching callouts. `test/tokens.test.ts` requires every `fg` to reach 4.5:1 on its `bg` and every `border` 3:1 on the canvas, in both schemes.

## Border and elevation

`tokens/names.json` holds `border-subtle`, `border-default` and `border-strong`, each with a light and a dark value. `border-default` follows `color-border`, so a brand neutral still reaches it. `border-strong` reaches 3:1 against the canvas in both themes (`test/tokens.test.ts`), so it can mark a control's edge.

Three elevation levels, `low`, `mid` and `high`, each have three tokens: `elevation-<level>-shadow`, `-bg` and `-border`. In the light theme the shadow is two soft layers over a white surface. In the dark theme the shadow layers are transparent and the surface is lighter with a hairline border instead, because a shadow does not show on a dark canvas. A component sets all three together:

```css
box-shadow: var(--elevation-mid-shadow);
background-color: var(--elevation-mid-bg);
border: thin solid var(--elevation-mid-border);
```

## Radius

`tokens/radius.json` holds the corner scale (`sm`, `md`, `lg`, `full`, plus the `ctl` and `card` steps). `src/brand.ts` multiplies these same tokens for the brand `radius` option, so there is one mechanism.
