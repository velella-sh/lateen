---
title: Overrides fixture
description: A page from the overridden doc layout that still uses a theme component.
layout: doc
---

This page is written by the site's `doc` layout, and the callout below is the theme's own
`callout` component: only the units named in `theme.overrides` come from this site.

:::callout{type=note}
The theme's callout is not overridden, so it still renders here.
:::
