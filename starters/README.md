# Starters

A starter is a complete small site that someone copies to begin their own. Lateen ships the folders; copying one into a new project is the engine's job (`mizzen init`), not a command of this package.

## What a starter is

One folder, `starters/<name>/`, with:

| File | What it holds |
| --- | --- |
| `mizzen.yml` | The site's configuration, with `theme.name: "@velella/lateen"`. |
| `starter.json` | `title` and `description` (both required), and optionally `languages`. |
| content | Pages, `_data/`, and anything else the site reads. |

`starter.json` declares optional languages so an installer can leave them out:

```json
{
  "title": "Documentation",
  "description": "One line that says what the site is.",
  "languages": {
    "default": "en",
    "optional": [{ "code": "fa", "name": "فارسی", "prefix": "/fa" }]
  }
}
```

An optional language lives in the folder named by its `prefix`, and in the `languages:` block of `mizzen.yml`. Leaving a language out means deleting its folder and, when none is left, the whole `languages:` block.

## Rules

- **Generic sample content.** Invented tools, people, and dates. Never a real project's name, and nothing that could be read as a fact.
- **Three languages, optional.** English is the default. Persian and Arabic are optional variants, written by a person, not placeholders.
- **No file the engine would not read.** No build output, screenshots, lockfiles, or notes. A starter is the site and nothing else.
- **Only what a new site needs.** Every extra page is one the user has to delete.
- **No shared index.** The folder is the list: adding a folder adds a starter.

## Check

`npm run check:starters` builds every starter with the installed engine and this theme, runs the engine's `check`, and fails on any diagnostic, broken internal link, source file over 256 KiB, or build over 60 seconds. A starter with optional languages is checked twice: with all of them and with the default language alone. CI runs it on every pull request, and no starter is skipped.
