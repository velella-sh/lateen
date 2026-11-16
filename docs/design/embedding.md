# Embedding a page elsewhere

Any page can offer a small view of itself for other sites to show. This note fixes how, how the view is
sized, and what it never contains. The `embedded` layout and the `embed-code` component follow it. Not
to be confused with the `embed` component, which brings other people's content into our page.

## Three ways to embed

| | `iframe` | Script that injects markup | Plain HTML snippet |
| --- | --- | --- | --- |
| Our code runs in the host page | No: the frame is a separate document | Yes, with the host's cookies and DOM | No |
| Host's security | The host can `sandbox` it | The host must trust our script on every visit | Nothing to trust: it is text the host owns |
| Reader's privacy | One request to our site when the frame loads | Same, plus whatever the script does | None: no request to us |
| Sizing | Needs a rule (below) | The script can measure and resize | The host's own layout |
| Upkeep | Always current | Always current | A copy: it goes stale |
| Blocked by | `X-Frame-Options` or CSP `frame-ancestors` on the host's side | A script-blocking CSP | Nothing |

## Decision

**The `iframe` is the way.** It shows the live page, runs none of our code in the host page, and the host
keeps control through `sandbox`. The embed code carries an absolute address, a title, a size,
`loading="lazy"` and a `sandbox` attribute. For sites that block frames, the embed code also offers a
static HTML snippet and a Markdown snippet; both are copies and say so.

We never choose a script that injects markup, because that runs our code in the host page.

## Sizing without a script on the host

The frame is `width="100%"` and has a fixed `height` in pixels. The page declares that height in front
matter (`embedded.height`, default 360) and the embed code copies it. The view adapts to the width it
gets, from 240 to 720 pixels, with container queries. When the content is taller than the height, it is
clipped and the visible "Open the full page" link stays at the bottom, so the frame never shows a
scrollbar. The view sends no resize messages to the host.

## Front matter

```yaml
layout: embedded
embedded:
  of: /guide/install/      # the full page; absolute address, or a path under the site's url
  scheme: auto             # light, dark or auto (follows the host reader's setting)
  height: 360              # pixels
  transparent: false       # true lets the host's background show through
```

## What the embedded view never contains

- Scripts: none of ours, not even the theme script, and no islands.
- Cookies, local storage or any other stored state.
- Analytics, tracking pixels or third-party requests.
- Links that open inside the frame: the link to the full page opens in the top window (`target="_top"`).
- Chrome: header, sidebar, footer, search and the footnote popover.
- Indexing: the view is `noindex` and its canonical link is the full page.
