# Mobile selectors

The narrow-screen selector row: projects, language, and versions as native `<details>/<summary>`
disclosures. Each entry comes from the desktop control's own model (`projectLinks`,
`languageEntries`, `versionsOf`), so the row never invents an option or a URL.

Each language option shows that language's own name and carries its `lang`, so a reader hears
`فارسی` in Persian and `English` in English. The language summary keeps the current language in its
accessible name (`Language: فارسی`), so the compact control still says which language is active
when its visible label is reduced to an icon.

`index.ts` exports the shared renderer plus the three selectors and `mobileSelectors`, which the
drawer places before the sidebar. `styles/src/ui.css` holds the shared label, target-size, marker,
focus, and logical-direction rules. The controls work without JavaScript; the drawer is static on
narrow screens until its island enhances it.
