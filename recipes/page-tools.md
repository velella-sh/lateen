# Recipe: attach a browser tool to a documentation page

A page can load one small browser tool without a server and without changing the engine. The
tool is a static file in the site repository; local input stays in the browser.

## 1. Add the tool to the site

Keep the tool beside the site source, for example:

```
site/
  tool/
    forecast.js
  guide/forecast.md
```

The tool is a browser module. It fills the slot the theme renders and may read local input.
It must not send that input anywhere:

```js
const slot = document.querySelector("[data-page-tool]");
if (slot) {
  slot.innerHTML = '<label for="forecast-place">Place</label><input id="forecast-place"><p data-forecast-out></p>';
  const input = slot.querySelector("input");
  input.addEventListener("input", () => {
    slot.querySelector("[data-forecast-out]").textContent = input.value;
  });
}
```

The engine copies the file to the same site-relative path as the build, so it works at a domain
root and under a nested `base` without a second copy per page.

## 2. Opt the page in

Name the file in the page's front matter:

```yaml
---
title: Forecast
layout: doc
tool: tool/forecast.js
---
```

Only that page loads the module. A page without `tool:` builds exactly as before and has no slot.

## 3. What the theme renders

The doc layout adds a named section after the article body:

- `section.page-tool` with a heading;
- `[data-page-tool]`, the slot the module fills;
- a visible fallback link to the tool file, so the page still offers something without JavaScript;
- `<script type="module" src="/tool/forecast.js">`, with the site's base.

A tool that never runs leaves the fallback readable. A tool that runs replaces the fallback inside
the slot.

## 4. Package it in the consuming repository

The tool belongs to the site, not to Lateen or Mizzen. Ship it with the site source and keep it
small: plain DOM, no framework, no fetch. The consuming example is Offing's Forecast page: Offing
keeps `forecast.js` in its own repository and only names it in `tool:`.

No engine command, configuration key, or rebuild step is needed beyond the page's front matter.
