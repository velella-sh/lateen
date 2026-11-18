---
title: Upgrade from 0.2.2
description: What changes when a site moves from Lateen 0.2.2 to 0.2.3, what stays the same, and which new pages, components, and options it can adopt.
layout: doc
permalink: /upgrade/
---

Lateen 0.2.3 is additive. Every layout, component, option, translation key, and default that a 0.2.2 site uses still works, and a site that only bumps the package renders the same pages.

```sh
npm install @velella/lateen@^0.2.3 @velella/mizzen@^0.2.4
```

The theme needs Mizzen 0.2.4 or later. The engine owns collections, blogs, OpenAPI inputs, blog routes, version routing, and theme overrides; the theme only renders what the engine plans. `npm ci` in a 0.2.2 project installs both without a config change. The base stylesheet and the theme script grow in this release, so a site with a strict byte budget should rerun its own checks.

Everything below is optional. Adopt one section at a time and rebuild.

## New page layouts

| Layout | What it adds | Docs |
| --- | --- | --- |
| `record` | One data record: title, summary, facts, status, body sections, history, calendar, and the record's source position. | [Record layout](/layouts/record/) |
| `list` | A collection index as a table, cards, or a dated list, with groups, counts, pagination, and an empty note. | [List layout](/layouts/list/) |
| `post` | A blog post with the docs shell, date, author, highlighted body, and an archive link. The engine also writes the archive, one page per author, and a feed. | [Blog layout](/layouts/post/) |
| `api-reference`, `api-reference-index` | One OpenAPI operation, and the generated reference index, from a pinned document. | [API reference](/layouts/api-reference/) |
| `gallery` | A collection as a grid of cards with facet filters, a sort choice, and an optional "add yours" card. | [Gallery](/components/gallery/) |
| `guide` | A task page with a summary bar, status, reading time, and related guides. | [Guide layout](/components/guide/) |
| `embedded` | A chrome-free view of one record for an iframe, with a full-page link, no script, and `noindex`. | [Embed example](/embed-example/) |

The `doc`, `tutorial`, `home`, `api`, `changelog`, `versions`, `search-results`, and `not-found` layouts keep their 0.2.2 content and section order. The docs shell gains the page actions, source mode, and search additions described below.

## New page chrome

- **Announcement bar.** `theme.options.announcement` adds a dismissible bar with an `id`, `text`, `href`, and `tone`. See [Tokens and options](/tokens/).
- **Footer and logo.** `theme.options.footer` and `theme.options.logo` add the site footer, its links, and the header mark. `theme.options.favicon` adds the icon links. See [Tokens and options](/tokens/).
- **Network.** `theme.options.network` adds a project switcher, a network footer, and a search scope for a family of sites. See [Network chrome](/components/network/).
- **Feedback.** `theme.options.feedback.endpoint` turns on the "Was this page helpful?" vote. See [Tokens and options](/tokens/).
- **Report an issue.** The report link opens a prefilled issue with the page title, address, source, language, and version. Configure it with `theme.options.reportIssue` or `repository.url`. See [Report issue](/components/report-issue/).
- **Edit by heading.** `theme.options.editPage.headingLinks: true` adds a suggest-an-edit link under every heading. See [Tokens and options](/tokens/).
- **Source mode.** A switch shows `file:line` beside every block, remembers the choice, and opens the file in a configured editor. See [Source mode](/source-mode/).
- **Ask your agent.** Search gains an "Ask your agent" row that builds a prompt from the question and the related pages, copies it, or opens a configured provider. See [Ask your agent](/ask-agent/).

## New components

The component reference has the syntax, every option, and a live example for each one.

| Area | Components |
| --- | --- |
| Data views | [Timeline](/components/timeline/), [Compare](/components/compare/), [Data explorer](/components/data-explorer/), [Dated list](/components/dated-list/), [Charts](/components/charts/), [Gallery](/components/gallery/), [Record history](/components/record-history/), [Stale notice](/components/stale-notice/), [Add to calendar](/components/add-to-calendar/), [Related guides](/components/guide/) |
| Status and evidence | [Status and status legend](/components/status/), [Trust panel](/components/trust-panel/), [Drift banner](/components/drift-banner/), [Tested chip](/components/tested-chip/), [Accessibility, performance, and WCAG reports](/components/reports/) |
| Commands and install | [Install tabs and CLI demo](/components/cli-demo/), [Terminal](/components/terminal/), [Output block](/components/output-block/) |
| Embeds and media | [Embed code](/components/embed-code/), [Embed](/components/embed/), [Figure](/components/figure/), [Video](/components/video/) |
| Glossary and terms | [Glossary and inline terms](/components/glossary/) |
| Page tools | [Page tool](/layouts/) inside the docs shell, plus [code annotations](/components/code/) and [Mermaid diagrams](/components/mermaid/) |
| Showpiece home | [Showpiece home](/showpiece/): hero, backdrop, motif, stat strip, feature grid, frame, and call to action |

## Options are now schema-checked

`theme.options` is documented as a JSON Schema at [`schema/options.schema.json`](https://github.com/velella-sh/lateen/blob/main/schema/options.schema.json). It lists every block, its type, and its default. The schema is the complete list; the pages above explain what each unit does with its block.

A site can point an editor at it:

```yaml
# yaml-language-server: $schema=node_modules/@velella/lateen/schema/options.schema.json
theme:
  options: {}
```

## Adopt a starter

The three starters build with 0.2.3 and are updated to the new layouts:

```sh
npx mizzen init my-site --theme node_modules/@velella/lateen --starter data
```

See [Starters](/starters/) for what each one contains.

## For theme authors

This release adds cover for the theme's own work: the [design refinement](/refinement/) rules and tokens, the [visual gates](/visual-gates/), the [performance budget](/performance/) and [accessibility](/accessibility/) reports, the [reports index](/reports/), and theme [overrides](https://github.com/velella-sh/lateen/blob/main/docs/overrides.md). They do not change a site's build.

## If something looks different

A 0.2.2 site is expected to render the same pages. `test/upgrade-0.2.test.ts` builds `fixtures/upgrade-0.2.2/` with this checkout and compares it with the HTML that the `v0.2.2` tag wrote; a difference that is not in its reviewed list fails the test. If your site differs, open an issue with the page and the version you upgraded from.
