---
title: Build and check a Lateen site
description: The tutorial layout with numbered steps.
layout: tutorial
permalink: /tutorial/
---

Start with a Markdown site that Mizzen can build. In this tutorial, you’ll install Lateen, build the site, and check the generated pages before publishing.

## Install the theme

From your project directory, install Lateen alongside Mizzen.

```sh
npm install @velella/lateen
```

Keep the lockfile with your project so a local build and a CI build use the same theme version.

## Build the site locally and inspect the generated pages before publishing

Build the site into a temporary output directory so you can inspect it without replacing a previous build.

```sh
npx mizzen build site --theme @velella/lateen --out dist/tutorial-preview/site
```

Open the generated home page in a local preview. Follow a link to another page and check that the theme’s styles and navigation load there as well.

## Audit the result

Run the site check from the project directory. Check the rendered pages at a narrow width and use the keyboard to follow the links between steps.

```sh
npx mizzen check site --theme @velella/lateen
```
