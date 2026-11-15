---
title: Presets
description: "Five starting points for a site's brand: accent, neutral, corner radius, and density, each shown live."
layout: doc
permalink: /presets/
---

A preset is one JSON file of brand options in `tokens/presets/`. Name it in `theme.options.preset`
and override single values under `theme.options.brand`. Every preset is held to the same contrast
test in both themes, so a preset never ships an unreadable pair.

The sample below every heading is the theme's own markup and tokens under that preset's values. The
blocked code under it is what you copy into `mizzen.yml`. None of the previews changes the page around
them.

## Clay

Warm, roomy, and rounded: an earth accent with large corners.

::preset-preview{preset=clay}

## Graphite

Grey, dense, and square: a neutral accent for reference-heavy sites.

::preset-preview{preset=graphite}

## Harbor

Cool and calm: a blue accent with the shipped corner scale.

::preset-preview{preset=harbor}

## Orchard

Green and compact-cornered: a calm accent for guides and handbooks.

::preset-preview{preset=orchard}

## Plum

A soft violet accent with the shipped corner scale.

::preset-preview{preset=plum}

## Write your own

A brand without a preset is just as valid; set only the values you want to change.

```yaml
theme:
  options:
    brand:
      accent: "#0b6e4f"
      radius: small
```

The full list of options, the contrast rule, and what stays fixed are on [Brand options](/brand-options/).
