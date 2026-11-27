# Design system v2

The `design-system-v2` epic (#1257) gives the theme one token vocabulary. Every colour, size,
space, radius, shadow and duration a stylesheet uses comes from `tokens/*.json` through the
generated `styles/tokens.css`. Tailwind reads the same tokens. A preset recolours the whole page.

This note is the contract for the tasks `design-system-v2-2` to `-11`. Each later issue cites a
section by its heading. It replaces the sailcloth rules named under "Decisions".

## Decisions

Dated 2026-11-27, by the maintainers.

1. **Coloured frames are allowed.** The sailcloth rule "no coloured frames" is replaced. A surface
   may carry a brand-tinted border or wash, if the pair still passes the contrast rules below.
2. **The accent changes.** The sailcloth rule "no accent change" and refinement rule 9
   ("no accent change") are replaced. The `lateen` preset gets a bold brand colour; presets
   derive their roles from their own accent.
3. **One vocabulary.** `styles/src/` modules read `var(--color-*)`, `var(--type-*)`,
   `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`, `var(--elevation-*)` and
   `var(--motion-*)` only. The shadcn-style names (`--background`, `--primary`, ...) and the
   sailcloth names (`--night`, `--foam`, ...) become one-line deprecated pointers.
4. **No removal in this release.** A token name stays for at least one release after its
   deprecation. Names are added; none is renamed or changed in meaning (refinement rule 8).
5. **Fonts.** The three families stay: Manrope, JetBrains Mono, and Vazirmatn for Persian and
   Arabic. Geist is dropped because the package does not ship it.
6. **No competitor brand.** No competitor's colour or font is used or copied.

## Scales

### Colour roles

Colour tokens are `--color-<role>`, each with a light and a dark value (`light-dark()`).

| Group | Tokens | Use |
| --- | --- | --- |
| Surface layers | `color-canvas`, `color-surface`, `color-surface-card`, `color-surface-raised`, `color-surface-sunken` | Page, panel, raised panel (menu, dialog), inset area (code, input well). Neutrals are tinted toward the brand hue. |
| Text | `color-text`, `color-heading`, `color-muted` | Body, headings, secondary text. |
| Border | `color-border`, `color-border-strong`; `border-subtle`, `border-default`, `border-strong` | Divider, control edge (3:1 on the canvas). |
| **Brand** (new, `-5`) | `color-brand`, `color-brand-hover`, `color-brand-subtle`, `color-on-brand` | The bold brand colour, its hover, its soft wash and the text on it. |
| Link and focus | `color-link`, `color-link-hover`, `color-link-visited`, `color-focus` | Links take the brand colour; focus keeps 3:1 in both themes. |
| Status | `color-success`, `color-warning`, `color-danger`, `color-info`; `status-<tone>-<part>` | State of a record or a callout. Colour is never the only signal. |
| Method (new, `-5`) | `state-method-<get|post|put|patch|delete>` with `-fg` | HTTP method badges in the API reference. |

The bold brand colour is used for the primary button, the active sidebar and page-list item,
the focus ring and links. Its exact value is set in `-5` by measuring contrast; the Lateen
brand sources are `#7E9CD8`, Lateen Blue `#4C6F9A` and Lift `#8FB0D4`.

`color-accent` stays as an alias of `color-brand` after `-5`. It was the same as Night.

### Surface layers

Four layers, lowest to highest: **sunken** (inset), **canvas** (page), **surface** (panels in
the page) and **raised** (menus, dialogs, popovers). In dark, a higher layer is lighter and a
raised layer also takes a hairline border (see Elevation).

### Type

`type-font-*` (body, heading, ui, mono), `type-size-xs` to `type-size-display`,
`type-leading-*`, `type-tracking-*`, `type-weight-*`, `type-measure`. `-3` adds a heading ladder
(display, h1 to h4, each step at least 1.2 times the next), per-level space above and below, and
a smaller muted size for descriptions. `rtl-*` tokens set Vazirmatn sizes and keep letter-spacing
at zero.

### Space and layout

`space-1` to `space-16` is one increasing ladder. `-4` adds layout tokens (header height,
sidebar width, table-of-contents width, content measure, wide measure, gutter per breakpoint)
and the breakpoints used by container queries. A layout reads them; this epic changes no layout.

### Radius

`radius-sm`, `radius-md`, `radius-lg`, `radius-full`, `radius-ctl`, `radius-card` (`-6` adds any
step this note needs). A stylesheet never writes a corner length. `src/brand.ts` scales these
tokens for the brand `radius` option.

### Elevation

`elevation-low`, `-mid` and `-high`, each as `-shadow`, `-bg` and `-border`. Light: a soft
two-layer shadow. Dark: a lighter surface plus a hairline border, because a shadow does not show
on a dark canvas. `shadow-sm` to `shadow-dialog` stay as the single-value shadows. No shadow is
drawn in forced colours.

### Motion

`motion-fast`, `-base`, `-slow`, `-press` and the `motion-ease*` curves. `-7` adds enter and exit
durations and easings for menus, dialogs and the theme switch, all under 400 ms. Every duration
is zero under `prefers-reduced-motion`. No layout property is animated.

## Contrast

Every text and background pair reaches 4.5:1, and every control border reaches 3:1 against its
surface, in light and dark, for every preset. `scripts/tokens.ts` fails the build otherwise (`-5`).

## Old names to new tokens

The old names stay as pointers with a deprecation comment (`-2`). A module written in this epic
or later uses the new token.

### shadcn-style names (`styles/src/theme.css`)

| Old | New |
| --- | --- |
| `--background` | `--color-canvas` |
| `--foreground` | `--color-text` |
| `--card`, `--popover` | `--color-surface-card` (a card keeps its own surface: in dark it sits just above the canvas, below `surface`) |
| `--card-foreground`, `--popover-foreground` | `--color-text` |
| `--primary` | `--color-brand`, through `--color-accent` until `-9` makes the `lateen` accent the brand colour |
| `--primary-foreground` | `--color-on-brand` |
| `--secondary`, `--muted` | `--color-surface` |
| `--secondary-foreground` | `--color-text` |
| `--muted-foreground` | `--color-muted` |
| `--accent` | `--color-brand-subtle` |
| `--accent-foreground` | `--color-text` |
| `--border`, `--input` | `--color-border` |
| `--ring` | `--color-focus` |
| `--link` | `--color-link` |
| `--radius` | `--radius-lg` |
| `--chart-1`, `--chart-2`, `--chart-3` | `--chart-cat-1`, `--chart-cat-2`, `--chart-cat-3` |
| `--field-a`, `--field-b`, `--glow` | `--color-brand-subtle` (mixed with `transparent` where a wash is needed) |
| `--space-2` ... `--space-8` | unchanged: the same names come from `tokens/space.json` |

### Tailwind `@theme` names

| Old | New |
| --- | --- |
| `--font-sans` | `--type-font-body` |
| `--font-mono` | `--type-font-mono` |
| `--radius-sm`, `--radius-md`, `--radius-lg` | `--radius-sm`, `--radius-md`, `--radius-lg` (tokens, no `calc` on `--radius`) |
| `--radius-xl` | `--radius-card` |
| `--color-background` | `--color-canvas` |
| `--color-foreground`, `--color-card-foreground`, `--color-secondary-foreground` | `--color-text` |
| `--color-card` | `--color-surface-card` |
| `--color-primary` | `--color-brand`, through `--color-accent` until `-9` |
| `--color-primary-foreground` | `--color-on-brand` |
| `--color-secondary`, `--color-muted` | `--color-surface` |
| `--color-muted-foreground` | `--color-muted` |
| `--color-border` | `--color-border` (already the token) |
| `--color-ring` | `--color-focus` |

`--color-muted` is the text colour in `tokens/color.json` but a surface in the Tailwind theme. The
Tailwind name becomes `--color-surface` so `bg-muted` keeps its look; `-2` keeps `muted` as an
alias only where a utility class needs it.

### Sailcloth names

The sailcloth names are scheme-independent constants, so they point at the new `palette` group
(`palette-night`, `palette-foam`, ...) added in `-2`, not at the scheme-dependent roles. Use a role
in new code; the table shows the role each constant usually stands for.

| Old | Hex | New |
| --- | --- | --- |
| `--night` | `#23212C` | `--color-canvas` (dark), `--color-text` (light) |
| `--night-raised` | `#393743` | `--color-surface` (dark) |
| `--sail` | `#DCD7EB` | `--color-text` (dark), `--color-on-brand` |
| `--mist` | `#8F8CD8` | `--color-border-strong` (dark) |
| `--mist-edge` | `#8481C7` | `--color-border-strong` (light) |
| `--foam` | `#F4F4F9` | `--color-canvas` (light) |
| `--foam-sunk` | `#E7E7ED` | `--color-surface-sunken` (light) |
| `--shell` | `#EDE6D8` | `--status-neutral-bg` |
| `--blue` | `#4C6F9A` | `--color-focus` (light), `--color-link` |
| `--blue-lift` | `#8FB0D4` | `--color-focus` (dark), `--color-link` |
| `--ink` | `#4A4658` | `--color-muted` (light) |
| `--sail-soft` | `#B7B2C9` | `--color-muted` (dark) |

### Other names

| Old | New |
| --- | --- |
| `--color-text`, `--color-surface-raised` declared in `theme.css` | the token files (`-2` removes the duplicate declaration) |
| `--space-2` ... `--space-8` declared in `theme.css` | `tokens/space.json` (`-2` removes the duplicate declaration) |
| `BRAND_ALIASES` in `src/brand-tokens.ts` | each alias points at a token above; the `.doc-body` scope is removed in `-8` |

## Rules for the later tasks

- Add a token in `tokens/*.json`, never by hand in `styles/tokens.css` (`node scripts/tokens.ts --check`).
- `scripts/check-design.ts` finds raw colours, sizes, shadows, durations and z-index values in a
  unit's CSS; `-2` extends the check to `styles/src/theme.css`.
- A change here may add a token. It may not remove or rename one.
- Persian and Arabic text keeps zero letter-spacing; code stays left to right.
