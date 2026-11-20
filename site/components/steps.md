---
title: Steps
description: A numbered sequence or tutorial, drawn from an ordered Markdown list.
layout: doc
permalink: /components/steps/
redirect_from:
  - /blocks/steps/
---

Steps turn an ordered list into a numbered sequence with a stable anchor and the number written as text on each step. It is for a procedure the reader follows in order: install, configure, build.

## Syntax

```markdown
:::steps
1. Install the package.
2. Add a `mizzen.yml`.
3. Run the build.
:::
```

## Options

None.

## Example

:::steps
1. Create the folder.
2. Add `mizzen.yml` with the site's title and language.
3. Run `npm create mizzen` or build the site with the engine.
4. Open the output folder and check the first page.
:::

A step can end with two next paths, written as a nested bulleted list of links:

:::steps
1. Install the package.
2. Choose where to go next:
   - [Install the theme](../../install/)
   - [Add a component](../../add-component/)
:::

The links are plain HTML, so both destinations read and work without JavaScript.

## Notes

- The body must be an ordered list. Each item is one step; each step gets an anchor from its title (`1. Install the package.` becomes `#step-install-the-package`) and its number as text, written with the digits of the page language. Inserting another step does not change the anchors of the steps around it; repeated titles get `-2`, `-3`, and a step without a title uses its number.
- The directive is for a sequence, not for a bulleted list. For options or features, a plain list reads better.
- A step can hold a paragraph, a code block, or a callout; keep each step to one action.
- When a step branches, end it with a nested bulleted list of links, one per next path. They are plain links: they read and work without JavaScript, and the step's title stays the text before the list.
