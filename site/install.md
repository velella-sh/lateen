---
title: Install and quickstart
description: "Install Lateen next to Mizzen and use it as the theme of a site."
layout: doc
permalink: /install/
---

Lateen is the default theme of [Mizzen](https://velella.sh/mizzen/): layouts, chrome, components, design tokens, and styles for a docs site that people and agents read. It needs Node 24 or later.

:::callout{type=tip title="Check the version first"}
The engine needs Node 24 or later. Run `node --version` before you install.
:::

## Install

:::install-tabs{package="@velella/mizzen @velella/lateen"}
:::

## Use it

Lateen is the theme Mizzen builds with unless the site names another, so a site with a `mizzen.yml` and some Markdown needs nothing more:

```sh
npx mizzen check .
npx mizzen dev .
npx mizzen build . --out dist
```

To name the theme and hand it options, set `theme` in `mizzen.yml`:

```yaml
theme:
  name: "@velella/lateen"
  options:
    logo:
      light: /brand/mark-light.svg
      dark: /brand/mark-dark.svg
```

Every option is in [Tokens and options](/tokens/). The pieces pages use in their content are in [Components](/components/), and the page shapes are in [Layouts](/layouts/).

## Start from a starter

Three complete sites ship with the theme, and each one installs with the same command:

```sh
npx mizzen init my-site --theme node_modules/@velella/lateen --starter docs
```

| Starter | What it is |
| --- | --- |
| `docs` | A documentation site for one tool: home page, getting started, two reference pages, a changelog and a not-found page. |
| `changelog` | A release notes site for one product: a home page that points at the latest release, a changelog, a versions page, a feed page and a guide to adding a release. |
| `data` | A data site for one invented catalogue: record pages, a list page, a timeline, a data explorer and a guide to changing the data. |

`mizzen init --list --theme node_modules/@velella/lateen` names the starters the installed theme ships. The command copies the starter's files into the folder and leaves `starter.json` behind, so the new site is ordinary Markdown and configuration.

## What the theme does not do

Lateen draws pages; it does not read files, parse Markdown, or write outputs. The engine does all of that and gives the theme a finished site model. The theme may only import types from `@velella/mizzen/contracts`.
