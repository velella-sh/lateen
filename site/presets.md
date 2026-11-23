---
title: Presets
description: "Starting points for a site's brand: accent, neutral, corner radius, and density, each shown live."
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

## Velella family

These presets share the same page, panel and text colours and give each product its own accent in light and dark mode. Any site can select one.

### Mizzen

::preset-preview{preset=mizzen}

### Lateen

::preset-preview{preset=lateen}

### Offing

::preset-preview{preset=offing}

### Ebb

::preset-preview{preset=ebb}

## Family site settings

The preset changes the colours. To give a family site the shared navigation and footer signature, use the network lock for the four public Velella projects and add these options. Set the network project and preset to the id of your site.

~~~yaml
network:
  source: https://velella.sh/lateen/brand/network.json
  project: lateen
theme:
  options:
    preset: lateen
    network:
      search: false
    footer:
      links:
        - title: a Velella project
          url: https://velella.sh/
~~~

The Lateen docs use a membership-only lock to pin the public project list. The project switcher and network footer use those entries, and each search uses its own site's index. Mizzen's manifest-based lock refresh requires every listed project to publish its page manifest.

## README badges

These examples use Shields flat badges with the shared dark label and each product's light accent. Keep the badge text descriptive and link it to the destination the badge represents.

~~~markdown
[![Documentation: Mizzen](https://img.shields.io/badge/docs-Mizzen-8A6220?style=flat&labelColor=1F1F28)](https://velella.sh/mizzen/)
[![Documentation: Lateen](https://img.shields.io/badge/docs-Lateen-4C6F9A?style=flat&labelColor=1F1F28)](https://velella.sh/lateen/)
[![Documentation: Offing](https://img.shields.io/badge/docs-Offing-6A5590?style=flat&labelColor=1F1F28)](https://velella.sh/offing/)
[![Documentation: Ebb](https://img.shields.io/badge/docs-Ebb-3F6E66?style=flat&labelColor=1F1F28)](https://velella.sh/ebb/)
~~~

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
