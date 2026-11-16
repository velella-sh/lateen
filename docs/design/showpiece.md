# Showpiece

The `showpiece` epic (#479) lets a site's home page be a showpiece: a hero, a stat strip, a feature
grid, a framed demo and a closing call to action, with decoration built from the brand colour. This
note fixes the sections, their order, the fallback for a missing section, and the limits every later
issue (#481 to #492) follows. Component names and the `home.style` key are proposals; a later issue
may rename them, and then updates this note.

A showpiece page is the `home` layout behind an option (`home.style: showpiece`, proposed). A `home`
page without the option renders byte for byte as before.

## Sections

A showpiece page has up to five sections, always in this order. The page body renders after the
last section, as it does on `home` today.

| # | Section | Component (proposed) | Front matter (proposed) | When it has no data |
| --- | --- | --- | --- | --- |
| 1 | Hero | `hero` | `hero` and `actions`, as on `home` | The `h1` falls back to the page title, and the eyebrow, lead and buttons are left out. The hero always renders, so the page always has one `h1`. |
| 2 | Stat strip | `stat-strip` | `stats: [{ value, label }]` | Nothing renders: no empty strip, no heading, no gap. An entry without a `value` or a `label` is dropped. |
| 3 | Feature grid | `feature-grid` | `features: [{ title, description, icon, url }]`, or the `sections` of `home` | Nothing renders. An entry without a `title` is dropped; `description`, `icon` and `url` are each optional and left out alone. |
| 4 | Framed demo | `frame` | `demo: { title, caption }` plus the page body or an embed in the frame | Nothing renders. A frame with no content is never drawn as an empty window; with no `title` the frame has no title bar text. |
| 5 | Call to action | `cta-band` | `cta: { title, lead, actions }` | Nothing renders. The band needs at least one action with a label and a URL; otherwise the whole band is left out. |

Two more units are not sections but decoration, so they never need data:

- `backdrop` sits behind the hero and takes its colours from the brand colour. With no brand colour it
  uses the preset's accent. It has no content and no fallback beyond a plain canvas.
- `motif` is brand-coloured illustration used inside the sections. When it is absent the section
  looks the same without it.

Values that do not match the shapes above are dropped, never a broken page, the same rule `home`
follows. A page with only a title still renders: a hero with the `h1`, then the body.

## Limits

1. **Real content only.** Every word and number on the page comes from the page's front matter or
   body. The theme invents no statistic, no feature, no quote and no placeholder copy. A section
   with nothing to show is omitted, not filled.
2. **No stock photo, no external font, no external image.** The page makes no request to another
   origin. Fonts are the ones the theme already ships.
3. **Decoration is CSS or build-time SVG.** Backdrops and motifs are CSS gradients and shapes, or SVG
   written into the HTML at build time from the brand colour. No client script draws or animates
   decoration, and no image file is added.
4. **Prints well in black and white.** The print stylesheet drops the backdrop and motif, turns
   coloured bands to plain text on white, keeps borders so the stat strip, grid and frame stay
   readable, and shows link targets where the page's print rules already do.
5. **Same rules as the rest of the theme.** Colours come from tokens (the brand colour is the one
   input), logical properties keep the page right to left ready, text keeps 4.5:1 and non-text
   parts 3:1 over every backdrop in both themes, and motion follows rule 5 of
   [Refinement](./refinement.md). Content is readable and every action works with no JavaScript.
6. **Existing pages do not change.** No new option is read unless `home.style` asks for it, and no
   existing token is renamed or changed.

## Neutral theme files

No theme file names a project or uses a maritime word: not in code, comments, tests, fixtures,
front matter examples or docs. The theme holds no project name; consumers supply their own content
through front matter, and this note does not specify any project's copy. The only exception is the
package and engine names the repository already carries.
