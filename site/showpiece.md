---
title: Showpiece home
description: "A home page built from a hero, a stat strip, a feature grid, a framed demo, and a closing call to action, with every key and an adoption checklist."
layout: home
permalink: /showpiece/
home:
  style: showpiece
  backdrop: glow
  motif: showpiece
hero:
  eyebrow: Home layout
  title: A home page that shows the work
  lead: The showpiece style composes five sections from front matter and leaves out every one that has no data.
actions:
  - label: Layout rules
    url: /layouts/
    primary: true
  - label: Component reference
    url: /components/
stats:
  - value: "5"
    label: Sections
  - value: "7"
    label: Components
  - value: "0"
    label: Scripts
features:
  - title: Authored content
    description: Every word and number comes from front matter or the page body.
    icon: file
    url: /layouts/
    wide: true
  - title: Plain decoration
    description: The backdrop and the motif are CSS and build-time SVG, with no image request.
    icon: check
  - title: Same without JavaScript
    description: Every section renders at build time and every action is a link.
    icon: terminal
demo:
  title: This page body
  caption: The layout wraps the body in the frame and does not draw it a second time.
cta:
  title: Adopt it one key at a time
  lead: Start from the checklist below, then remove what the page does not need.
  package: example-package
  actions:
    - label: Install the theme
      url: /install/
---

## Front matter

A showpiece page is a `home` page with `home.style: showpiece`. These are the keys the `home`
layout reads; a value that does not match the shape is dropped, never a broken page. Without the
option, the same page renders as a [classic home page](/).

| Key | What it does |
| --- | --- |
| `home.style` | `showpiece` composes the page from the sections below. Any other value, or no `home` key, keeps the classic home. |
| `home.backdrop` | `glow` (the default), `grid`, or `none`: the decoration behind the hero. |
| `home.motif` | Any text; it seeds the brand-coloured illustration behind the hero. The same text always draws the same shape. |
| `hero.eyebrow` | A short line above the title. Optional. |
| `hero.title` | The page's one `h1`. Falls back to the page `title`. |
| `hero.lead` | One or two sentences under the title. Optional. |
| `actions[].label` | The button text. An action needs a label and a URL. |
| `actions[].url` | Where the button goes: a path on this site, or an `http`/`https` address. |
| `actions[].primary` | `true` fills the button and adds the arrow. Every other button is quiet. |
| `stats[].value` | The figure, exactly as written. |
| `stats[].label` | What the figure counts. |
| `stats[].url` | An optional link for the figure. Only a site path or an `http`/`https` address becomes a link. |
| `features[].title` | The card's heading. Required: an entry without one is dropped. |
| `features[].description` | One line under the heading. Optional. |
| `features[].icon` | The name of an icon in the theme's set, such as `check`. Decoration only. |
| `features[].url` | Makes the whole card one link. Optional. |
| `features[].wide` | `true` makes the card two columns wide. Only the first wide card counts. |
| `sections[].title` | Used in place of `features` when that key is absent. Required. |
| `sections[].description` | The same meaning as the `features` key. |
| `sections[].icon` | The same meaning as the `features` key. |
| `sections[].url` | The same meaning as the `features` key. |
| `sections[].wide` | The same meaning as the `features` key. |
| `demo.title` | The text in the frame's title bar. |
| `demo.caption` | The caption under the frame. |
| `cta.title` | The band's heading. |
| `cta.lead` | One line under the heading. |
| `cta.package` | A package name; the band shows its install command. |
| `cta.actions[].label` | The primary action's text. The first action with a label and a URL is the band's action. |
| `cta.actions[].url` | Where the band's action goes. |

A stat strip needs at least three figures and shows at most six; fewer draw nothing. The feature
grid draws nothing without a titled entry. The frame needs a page body: with nothing to wrap it is
not drawn as an empty window. The band is left out without an action or a package. The classic
`sections` link lists are not drawn in this style; a section becomes a feature card.

## Adoption checklist

1. **Turn it on.** Give the page `layout: home` and `home.style: showpiece`. Leave every other home page without `home`, so it renders as before.
2. **Write the hero.** A title is required; the eyebrow and the lead are optional. Keep one `h1` on the page.
3. **Add one primary action.** Set `primary: true` on the action a reader should take first.
4. **Count real things.** Use three to six `stats` entries, each with a value and a label. Do not fill a gap with a made-up number.
5. **List the features,** or reuse `sections`. Every entry needs a title; add a description, an icon name, and a URL only when they help.
6. **Show, do not describe.** Put the demo in the page body and name it with `demo`. Without a body, the frame is not drawn.
7. **Close with one action.** Add `cta.actions`; add `package` only when there is an install command to copy.
8. **Choose the decoration.** Set `home.backdrop` and `home.motif`, or leave them to the preset. Check both themes over the backdrop.
9. **Remove what you cannot fill.** Delete a section's data and confirm it disappears without an empty strip, heading, or gap.
10. **Check the page.** Run `mizzen check site`; then read the page in both themes, at a narrow width, right to left, and in print, and follow every action with JavaScript off.
