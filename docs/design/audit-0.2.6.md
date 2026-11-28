# Design audit 0.2.6

The numbered defect list of the 0.2.6 redesign (epic `design-audit`, issue `design-audit-3`). Every row has one id,
one place where it shows, and one owner issue of this release. Nothing is fixed here.

## How this list was made

The shots come from `node scripts/design-audit.ts --shoot --out <dir>`: every layout and gallery page of the
default-look fixture, in light and dark, at 375, 768 and 1280 px (66 shots; `fa` is the right-to-left sample).
Screenshots are artifacts of a CI run and are not committed. The **Case** column is the file name of the shot
(without `.png`), so a row can be found in any run's artifact folder; link the run's artifact in the pull
request that merges this list.

Each defect shows in more than one case. The table names the clearest case. A fix is checked on all of them.

Categories: token, layout shell, prose, code, component, API, home, search, chart.

## Defects

| Id | Defect | Category | Clearest case | Owner |
| --- | --- | --- | --- | --- |
| D1 | The "this page hasn't been translated yet" notice is drawn twice, once per language, as raw text in the header row. It overflows the header and sits on top of the page edge on every page that has no translation. | layout shell | `document-light-desktop` | #1300 `layout-shell-3` |
| D2 | The language switcher is two bare language names (`فارسی`, `العربية`) stacked in the header, with no menu, no label and no current language. On `home` they overflow the header. | layout shell | `home-light-desktop` | #1301 `layout-shell-4` |
| D3 | The API examples panel falls below the body, under the footer actions, instead of beside it. | API | `api-light-desktop` | #1340 `api-reference-ui-5` |
| D4 | The API page has a single column: `.api-page` has no grid, so there is no second column for the examples at 1280 px. | API | `api-light-desktop` | #1341 `api-reference-ui-6` |
| D5 | Example groups are a heading, a bare language word (`bash`) and a code block, with no grouping by language or response status. | API | `api-light-desktop` | #1342 `api-reference-ui-7` |
| D6 | The parameters list is a plain table: no field list, no required marker beyond the word `yes` or `no`, no nested schema. | API | `api-light-desktop` | #1338 `api-reference-ui-3` |
| D7 | HTTP method badges have one colour. `GET` on the home strip looks like every other pill. | API | `home-light-desktop` | #1336 `api-reference-ui-1` |
| D8 | The response block is unframed monospace text at heading size and is cut off at 375 px (`"url": "/ins`). | code | `api-light-mobile` | #1316 `code-blocks-1` |
| D9 | Code on the tutorial layout has no frame, no copy button and no language label, and a long command is clipped (`--out dist/`). | code | `tutorial-light-desktop` | #1316 `code-blocks-1` |
| D10 | The terminal has an empty header bar with only a Copy button, and its body has no relation to the code frame next to it. | code | `document-light-desktop` | #1319 `code-blocks-4` |
| D11 | Code tabs sit beside the frame, not on it: the tab strip and the frame have different edges. | code | `document-light-desktop` | #1318 `code-blocks-3` |
| D12 | Headings have a flat hierarchy: `h2` is close to the body in weight and size, and the space above and below it is nearly equal. | prose | `document-light-desktop` | #1309 `prose-1` |
| D13 | Table captions are centred (the browser default) and sit apart from the table; they repeat the heading above them. | prose | `gallery-light-mobile` | #1311 `prose-3` |
| D14 | Tables are wider than the mobile screen. The parameters table and the budget table cut off their last columns at 375 px without a visible cue. | prose | `api-light-mobile` | #1311 `prose-3` |
| D15 | The table of rows has cell labels glued to their values on narrow and wide screens (`titleAlpha`, `pages120`, `published9 November 2026`). | chart | `document-light-desktop` | #1394 `dashboard-charts-5` |
| D16 | Steps show `Step 1☐`: the label and a checkbox glyph sit in one pill, and the step title is not tied to it. | component | `document-light-desktop` | #1328 `components-polish-4` |
| D17 | Status pills (`Shipped`, `Pending`, `Blocked`, `Draft`) differ only by one filled colour. Badges, status and tags are three looks. | component | `home-light-desktop` | #1330 `components-polish-6` |
| D18 | Disclosures are a bare triangle and bold text. The open one has a link colour, the closed one does not, and neither has a surface. | component | `document-light-desktop` | #1331 `components-polish-7` |
| D19 | Cards, callouts and link cards use different surface, border and hover looks. | component | `home-light-desktop` | #1325 `components-polish-1` |
| D20 | The Versions list and the changelog's version list are unstyled lists: `v2↑Latest`, `v1!Deprecated` run together with no pill and no spacing. | component | `versions-light-desktop` | #1330 `components-polish-6` |
| D21 | The version menu in the header (`▶ Versions▾`) uses a default marker and a larger type size than the controls next to it. | layout shell | `versions-light-desktop` | #1299 `layout-shell-2` |
| D22 | The search results page is unstyled: a bare label, a bare input column and an empty page. It does not look like the search dialog. | search | `search-results-light-desktop` | #1361 `search-ui-7` |
| D23 | The mobile header splits across two rows (name, then the three controls) and the drawer button is not grouped with the page tools. | layout shell | `api-light-mobile` | #1306 `layout-shell-9` |
| D24 | The footer and the pager do not share columns, and the pager cards differ from the Edit and Back-to-top row above them. | layout shell | `tutorial-light-desktop` | #1305 `layout-shell-8` |
| D25 | The sidebar active marker is a one-pixel bar and the group chevrons point in different directions, so an open group is hard to tell from a closed one. | layout shell | `document-light-desktop` | #1302 `layout-shell-5` |
| D26 | The home hero preview sticks out of the content box on the right (about 33 px at 1280 px) and is a placeholder bar drawing, not the real theme. | home | `home-light-desktop` | #1347 `home-landing-2` |
| D27 | The home feature cards are two narrow cards in a three-column space, and the component strip sits directly on the body text with no gap. | home | `home-light-desktop` | #1348 `home-landing-3` |
| D28 | The brand colour reaches only some pieces: the bridge from the brand tokens stops at `.doc-body`, so chrome, home and the search page keep their own blues. | token | `home-light-desktop` | #1294 `design-system-v2-8` |
| D29 | The bar chart is drawn at a fixed small size on mobile: labels and bars are unreadable at 375 px. | chart | `gallery-light-mobile` | #1396 `dashboard-charts-7` |
| D30 | The article tail (Edit with your agent, Back to top, Copy as Markdown, View Markdown) wraps into two uneven rows. | layout shell | `tutorial-light-desktop` | #1305 `layout-shell-8` |

## What was checked, and what was not

- Reviewed by eye: `home`, `document`, `api`, `tutorial`, `changelog`, `search-results`, `versions`,
  `not-found`, `reports-fa` and `gallery`, in light at 1280 and 375 px, plus `document` and `not-found` in dark.
  D1 shows in dark in the same way.
- Not reviewed shot by shot: the 768 px shots and most dark shots. They share the style rules above; the
  owners re-check them in their own issues.
- The right-to-left sample (`reports-fa`) shows D1, D2 and D13 and no defect of its own.
- `not-found` has no defect beyond D1.

## Owner check

Every owner above is an issue of milestone 0.2.6 in this plan: #1294, #1299, #1300, #1301, #1302, #1305, #1306,
#1309, #1311, #1316, #1318, #1319, #1325, #1328, #1330, #1331, #1336, #1338, #1340, #1341, #1342,
#1347, #1348, #1361, #1394 and #1396.
