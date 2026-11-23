---
title: Theme Studio
description: Tune a preset on a live sample, then copy the settings for your docs.
layout: doc
permalink: /theme-studio/
---

::brand-studio

## Apply the settings

Merge the generated `preset` and `brand` keys into `theme.options` in your `mizzen.yml`.
Keep any other options already in that file. If you chose a different font, download
the file and put it at the path shown beside the download link, relative to the site root.

The default example uses Harbor:

```yaml
theme:
  options:
    preset: harbor
```

Run `npx mizzen check` from the site folder. See [all five presets](../presets/) and the [brand options reference](../brand-options/).
