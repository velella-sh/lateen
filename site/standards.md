---
title: Docs standard
description: "The contract for Lateen documentation: page anatomy, writing, examples, and completion checks."
layout: doc
permalink: /standards/
---

Use this contract for every public documentation page. It keeps the Sailcloth reading experience consistent and makes each page useful to people and agents.

## Principles

- **Sailcloth.** Use quiet Foam and Night fields, Lateen Blue for identity and links, and Mist as a restrained accent. Beauty comes from type, space, and soft light.
- **Content first.** Keep chrome and decoration only when they help a reader understand or act. Separate surfaces with spacing, hairlines, and type rather than colored frames.
- **One promise.** The title names what the page delivers; the description states that promise in one or two sentences.
- **The same shape.** Predictable page anatomy lets readers learn the map once and find a section from the table of contents.
- **Tokens only.** Read visual values from the locked design tokens. Do not add raw colors, lengths, or durations to component styles, and never edit generated CSS by hand.
- **Accessible in every direction.** Keyboard use, contrast, right-to-left layout, and reduced motion are requirements, not finishing touches.

## Page anatomy

A doc page uses the `doc` layout: section navigation, the article, and an on-this-page table of contents on wide screens. The article keeps a readable measure and the navigation remains usable at narrow widths.

1. Set `title`, `description`, `layout: doc`, and a stable `permalink` in front matter.
2. Let the layout render the breadcrumb, one H1, and the description. The H1 names the outcome or object.
3. Organize the body into descriptive H2 sections. Keep their wording and generated ids stable so every section appears in the table of contents.
4. Put the primary example close to its explanation. Link related pages by their real names and let the section navigation provide the previous and next path.

## Writing

Use present tense, active voice, and short sentences. Name things as the reader sees them. Give the exact command a person can paste and say what changes after it runs.

| Use | Avoid |
| --- | --- |
| Install the theme with npm, pnpm, or yarn. | Getting started is easy and delightful. |
| `mizzen dev .` serves the site and rebuilds on change. | Run the development experience locally. |
| [Tokens and options](/tokens/) | Click here |

Define a technical term before relying on it. Keep examples minimal, valid, and consistent with the current options and directives.

## Callouts

Use the five [callout kinds](/components/callout/) only when they prevent a real failure or preserve useful context. Each callout has a visible kind label, a short title, and a concise Markdown body. Do not use color alone to carry its meaning.

- `note`: context worth keeping nearby.
- `tip`: a faster or safer path.
- `important`: a site-wide behavior or requirement.
- `warning`: a likely mistake with a cost.
- `caution`: a destructive or irreversible action.

:::callout{type=tip title="Check the version first"}
The engine needs the Node version in `.node-version`; the package supports Node 24 or later.
:::

## Code

Every fenced block gets the code component's copy action. Keep commands runnable and examples limited to the behavior being explained. When package-manager variants carry the same meaning, use `install-tabs`; its panels remain available without JavaScript.

:::install-tabs{package="@velella/lateen"}
:::

Use `npm ci` for a clean checkout. Run TypeScript directly with the repository's Node version; there is no separate source build step. Author visual changes in `styles/src/ui.css` and regenerate assets with `npm run ui:build`, but do not commit the generated CSS.

## Definition of done

- The title and description state one clear promise, and the page anatomy matches this standard.
- Every H2 has a stable place in the table of contents; commands are exact and copyable; related pages are linked by name.
- Existing documentation and option examples remain accurate.
- Light and dark themes, narrow widths, keyboard use, and right-to-left content have been checked when the change affects rendering.
- `npm run typecheck`, `npm test`, and `npx mizzen check site` pass. Run `npm run test:a11y` for layout, chrome, component, or style changes.
- Visual changes use the pinned CI baseline workflow and a pull request labeled `visual-change`; never create a local baseline.
