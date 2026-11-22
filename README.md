<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/velella-sh/lateen/main/.github/assets/mark-night.svg">
    <img src="https://raw.githubusercontent.com/velella-sh/lateen/main/.github/assets/mark-day.svg" width="96" height="96" alt="Lateen">
  </picture>
</p>

<h1 align="center">Lateen</h1>

<p align="center">
  <strong>Easy to read. Safe to edit.</strong><br>
  A docs theme for people and agents, built on Mizzen.
</p>

<p align="center">
  <a href="https://github.com/velella-sh/lateen/actions/workflows/ci.yml"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/velella-sh/lateen/ci.yml?branch=main&label=CI&logo=github&logoColor=white&labelColor=1F1F28&color=4C6F9A&style=flat"></a>
  <a href="https://www.npmjs.com/package/@velella/lateen"><img alt="npm" src="https://img.shields.io/npm/v/@velella/lateen?label=npm&logo=npm&logoColor=white&labelColor=1F1F28&color=4C6F9A&style=flat"></a>
  <a href="https://github.com/velella-sh/lateen/actions/workflows/ci.yml"><img alt="coverage" src="https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fvelella-sh%2Flateen%2Fbadges%2Fcoverage.json&labelColor=1F1F28&style=flat"></a>
  <a href="https://skills.sh/velella-sh/lateen/lateen"><img alt="skills.sh" src="https://skills.sh/b/velella-sh/lateen"></a>
</p>

<p align="center">
  <a href="https://velella.sh/lateen/install/">Quick start</a> ·
  <a href="https://velella.sh/lateen/">Documentation</a> ·
  <a href="#contributing">Contributing</a> ·
  <a href="https://github.com/velella-sh/mizzen">Mizzen</a>
</p>

---

A docs theme for people and agents, built on Mizzen: layouts, chrome, components, design tokens, and styles. The engine reads it only by listing the folders below; adding a unit never edits a shared index file.

## Why Lateen

- **Easy to read.** An editorial layout with a sidebar, table of contents, and search that works for people and for agents.
- **Safe to edit.** Every visual decision is a design token, and a component is a folder, so a change stays in one place.
- **Accessible.** Tested against WCAG 2.2 AA, with a keyboard gate, a contrast gate, and an RTL gate.
- **Right-to-left ready.** Direction, language, and mirrored icons are handled for RTL languages.

Run `npm ci` to install the published [Mizzen](https://github.com/velella-sh/mizzen) used by the tests and docs site. See the [contributor setup](CONTRIBUTING.md#set-up) to test against a local engine checkout.

The theme may `import type` from `@velella/mizzen/contracts`, by package name and never by relative path, and imports nothing else from the engine. Preact is a peer dependency, with `jsx: react-jsx` and `jsxImportSource: preact` in `tsconfig.json`.

## Folders

| Folder | One unit is | Guide |
| --- | --- | --- |
| `layouts/` | `<name>.ts` | [layouts/README.md](layouts/README.md) |
| `chrome/` | `<name>/` | [chrome/README.md](chrome/README.md) |
| `components/` | `<name>/` | [components/README.md](components/README.md) |
| `tokens/` | `<group>.json` | [tokens/README.md](tokens/README.md) |
| `styles/` | `<name>.css` | [styles/README.md](styles/README.md) |
| `starters/` | `<name>/` | [starters/README.md](starters/README.md) |

## Commands

- `npm test`
- `npm run typecheck`
- `npm run tokens` writes `styles/tokens.css` from `tokens/*.json`; `tokens:check` fails when it is stale.
- `npx mizzen init my-site --theme node_modules/@velella/lateen --starter docs` starts a site from one of the three starters in `starters/`; `--list` names them.

## Layouts

A page picks a layout with `layout` in its front matter, or gets one from `defaults` in the site config. `mizzen build` uses `doc` when neither sets one.

| Layout | What it renders |
| --- | --- |
| `base` | The document shell: `<head>`, skip link, theme script, and slots for the header, sidebar, main column, aside, and footer. The other layouts build on it; a page does not name it. |
| `doc` | The docs page: header, sidebar, breadcrumb, article, table of contents, pager, and page footer. Front matter `status`, `since`, and `replaced_by` add the page-status banner. |
| `home` | The docs home: a hero, action buttons, and section cards from `hero`, `actions`, and `sections` in front matter. `home: { style: showpiece }` composes it from the showpiece sections instead. |
| `not-found` | The 404 page, with base-aware home and documentation-search links that work without JavaScript. |
| `versions` | The versions index: a page's versions from `site.data.docsVersions` or the `versions` front matter key, each row linked to the same page when it exists and marked with Latest, Deprecated, or Dev in text. |
| `record` | One data record: title, summary, facts, status, body sections, history, calendar, and its source position. |
| `list` | A collection index as a table, cards, or a dated list, with groups, counts, pagination, and an empty note. |
| `post` | A blog post in the docs shell; the engine also writes the archive, one page per author, and a feed. |
| `api-reference`, `api-reference-index` | One OpenAPI operation, and the reference index, from a pinned document. |
| `gallery` | A collection as a card grid with facet filters, a sort choice, and an optional "add yours" card. |
| `guide` | A task page with a summary bar, status, reading time, and related guides. |
| `embedded` | A chrome-free view of one record for an iframe, with a full-page link, no script, and `noindex`. |

Each layout is `layouts/<name>.ts`; the rules for adding one are in [layouts/README.md](layouts/README.md).

## Components

Components are the pieces pages use inside their content. Each unit is its folder under `components/`; the table groups them by what a page uses them for.

| Component | What it does | Reference |
| --- | --- | --- |
| Data views | `timeline`, `compare`, `data-explorer`, `dated-list`, `charts`, `gallery`, `record-history`, `stale-notice`, `add-to-calendar`, and related guides. | [Timeline](https://velella.sh/lateen/components/timeline/), [Compare](https://velella.sh/lateen/components/compare/), [Data explorer](https://velella.sh/lateen/components/data-explorer/), [Dated list](https://velella.sh/lateen/components/dated-list/), [Charts](https://velella.sh/lateen/components/charts/), [Gallery](https://velella.sh/lateen/components/gallery/), [Record history](https://velella.sh/lateen/components/record-history/), [Stale notice](https://velella.sh/lateen/components/stale-notice/), [Add to calendar](https://velella.sh/lateen/components/add-to-calendar/) |
| Status and evidence | `status` and `status-legend`, `trust-panel`, `drift-banner`, `tested-chip`, `status-banner`, and the accessibility, performance, and WCAG reports. | [Status](https://velella.sh/lateen/components/status/), [Trust panel](https://velella.sh/lateen/components/trust-panel/), [Drift banner](https://velella.sh/lateen/components/drift-banner/), [Tested chip](https://velella.sh/lateen/components/tested-chip/), [Reports](https://velella.sh/lateen/components/reports/) |
| Commands and install | `install-tabs`, `os-tabs`, `cli-demo`, `terminal`, and `output-block`, all plain text that copies without JavaScript. | [CLI demo](https://velella.sh/lateen/components/cli-demo/), [Terminal](https://velella.sh/lateen/components/terminal/), [OS tabs](https://velella.sh/lateen/components/os-tabs/), [Output block](https://velella.sh/lateen/components/output-block/) |
| Code and diffs | `code` and code annotations, `code-tabs`, `mermaid`, `diff-block`, and version badges and diffs. | [Code](https://velella.sh/lateen/components/code/), [Code tabs](https://velella.sh/lateen/components/code-tabs/), [Mermaid](https://velella.sh/lateen/components/mermaid/), [Diff block](https://velella.sh/lateen/components/diff-block/) |
| Embeds and media | `embed`, `embed-code`, `figure`, and `video`. | [Embed](https://velella.sh/lateen/components/embed/), [Embed code](https://velella.sh/lateen/components/embed-code/), [Figure](https://velella.sh/lateen/components/figure/), [Video](https://velella.sh/lateen/components/video/) |
| Glossary and terms | `glossary` lists every term, and an inline term opens its definition in place. | [Glossary](https://velella.sh/lateen/components/glossary/) |
| Page tools and prose | `callout`, `cards`, `link-card`, `details`, `steps`, `tabs`, `table`, `key-value`, `file-tree`, `tags`, `kbd`, `badge`, `reading-time`, `changelog-entry`, and `variables-form`. | [Callout](https://velella.sh/lateen/components/callout/), [Cards](https://velella.sh/lateen/components/cards/), [Steps](https://velella.sh/lateen/components/steps/), [Key-value list](https://velella.sh/lateen/components/key-value/), [Tabs](https://velella.sh/lateen/components/tabs/), [Variables form](https://velella.sh/lateen/components/variables-form/) |
| Showpiece home | `hero`, `backdrop`, `motif`, `stat-strip`, `feature-grid`, `frame`, `cta-band`, and `preset-preview`. | [Showpiece](https://velella.sh/lateen/showpiece/) |

The component reference lists every unit with its syntax, every option, and a live example.

## Tokens

Every visual decision is a design token, defined once and read from CSS. `tokens/names.json` freezes the names; one file per group (`color.json`, `type.json`, `space.json`, and the rest) sets the values. Run `npm run tokens` after editing a group: it writes `styles/tokens.css`, which `npm test` keeps current. Never edit that CSS by hand, and never put a raw color, length, or duration in a unit's stylesheet; use `var(--color-accent)`, `var(--space-4)`, and the other token variables.

A site does not edit a token file. It sets an accent colour, a neutral tint, its own fonts, a corner radius, and a density under `theme.options.brand`, or picks a shipped `theme.options.preset`; Lateen derives every dependent token at build time, corrects a colour that cannot reach its contrast, and writes the values into the page. The full list, the contrast rule, and what stays fixed are in [site/brand-options.md](site/brand-options.md), and the shipped starting points are in [site/presets.md](site/presets.md).

## Overrides

The rest of `theme.options` is the theme's as well. Lateen reads these blocks:

```yaml
theme:
  options:
    announcement:
      id: v0-4
      text: Mizzen 0.4 is out.
      href: /changelog/
    editPage:
      headingLinks: true
    logo:
      light: /assets/logo.svg
      dark: /assets/logo-dark.svg
    footer:
      copyright: © 2026 Example
      license: MIT
      links:
        - title: Source
          url: https://github.com/example/site
    gallery:
      addCard:
        label: Add your project
        link: /gallery/new/
    pageAgent:
      providers:
        - title: Claude
          url: "https://claude.ai/new?q=Read+{markdown}"
```

| Option | What it changes |
| --- | --- |
| `announcement.id`, `announcement.text`, `announcement.href` | A dismissible bar above the header. `text` is required; the bar renders nothing without it. `href` links the text; `http`, `https`, `mailto`, and root-relative paths are shown. Dismissal is remembered per `id`. |
| `editPage.headingLinks` | `true` adds a per-heading "suggest an edit" issue link under the "Edit this page" link; absent or any other value leaves it out. |
| `logo.light`, `logo.dark` | The header mark. A root-relative path gets the site's `base`; an absolute URL is used as written. With both, the header swaps them with the theme; with one, it shows that one in both modes. |
| `footer.copyright`, `footer.license` | The two lines of the site footer. |
| `footer.links[]` | Footer links with `title` and `url`; only `http`, `https`, `mailto`, and root-relative paths are shown. |
| `gallery.addCard` | The site's own card at the end of a gallery: a `label` and a `link`. The card keeps the record cards' shape and gets the site's `base`; a blank label or an unsafe link renders nothing, and the option itself is optional. |
| `pageAgent.providers[]` | The "Use with an agent" menu. Each provider has a `title` and a `url`; `{markdown}`, `{url}`, and `{title}` are filled per page. Without the block the menu offers Claude, ChatGPT, and Cursor. |
| `favicon.ico`, `favicon.svg`, `favicon.apple` | The icon links, each a path from the site root. |
| `installTabs.managers[]` | The package managers the install tabs offer, each with a `name` and a `command`; `{package}` becomes the package name. |
| `network.switcher`, `network.footer`, `network.position` | Show or hide the project switcher and network footer, and place the switcher in the header or above the footer. |
| `reportIssue` | The report-an-issue link for this site's tracker: `false` turns it off; an `url` template, `labels`, `template`, and `titlePrefix` customise the new issue. The link falls back to `repository.url`. |
| `sourceMode.editor` | A URL template that opens a block in a local editor; it needs `{path}` and may use `{line}` and `{column}`. |
| `status.values` | The site's map from a data value to a `tone`, a `label` (one string or one per language), and the legend's `description`. An unmapped value shows as written in the neutral tone. |
| `glossary.collection`, `glossary.page` | The data collection with `term`, `definition`, and `aliases`, and the page that carries `::glossary` (one address per language allowed). |

## Add a component

A site cannot add a component without changing the theme or its fork: components are theme units, not content files. Adding one never edits a shared index file, because the registry discovers `components/<name>/` by listing the folder.

1. Make `components/<name>/`, using lowercase kebab-case. The folder name is the component's name and the directive an author writes.
2. Add `index.ts` with the Preact component written with `h()`, never JSX, and a default export typed by the engine's component contract. The props arrive as strings from the directive's attributes, and the directive's body arrives as rendered HTML.
3. Add `style.css` only when the component has styles. Read tokens with `var(--…)`, use logical properties, and name classes after the component: the root is `<name>`, its parts add a suffix such as `<name>-title`.
4. Add `client.ts` only when the component needs the browser. It is an island: it ships only on pages that use the component, and every control it enhances starts `hidden` so the page still reads without JavaScript.
5. Add `test/component-<name>.test.ts` beside the other component tests. Test the rendered element, each variant, escaping, and the source position.
6. Run `npm run typecheck` and `npm test`. The registry finds the new folder, and an unknown directive or a missing default export becomes a diagnostic naming the file.

The full rules for a unit are in [components/README.md](components/README.md).

## Layout

- `src/index.ts`: exports the theme manifest (`name` and `folders`) and nothing else.
- `test/`: `*.test.ts` files for `node --test`.

## Contributing

Bug reports, fixes, and docs improvements are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

## License

[MIT](LICENSE).

---

<p align="center">Lateen is part of <a href="https://velella.sh">Velella</a>. Set the sail. Let the docs carry.</p>
