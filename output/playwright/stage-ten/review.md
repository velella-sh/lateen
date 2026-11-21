# Lateen Stage 10 visual review

The base is merged Stage 9 commit `daa466c`. Captures come from local production builds of Lateen's own site. Each desktop pair uses the same Chromium build, 1440 × 1000 viewport, and pixel scroll offsets. The focused Feedback pair uses a 481 × 844 viewport and the same 3781 px scroll offset.

## Page captures

| Page | Light before | Light after | Dark before | Dark after |
| --- | --- | --- | --- | --- |
| Home | [Top](before/home-top-light.png) | [Top](after/home-top-light.png) | [Top](before/home-top-dark.png) | [Top](after/home-top-dark.png) |
| Install and quickstart | [Top](before/quickstart-top-light.png), [end](before/quickstart-end-light.png), [full](before/quickstart-full-light.png) | [Top](after/quickstart-top-light.png), [end](after/quickstart-end-light.png), [full](after/quickstart-full-light.png) | [Top](before/quickstart-top-dark.png), [end](before/quickstart-end-dark.png), [full](before/quickstart-full-dark.png) | [Top](after/quickstart-top-dark.png), [end](after/quickstart-end-dark.png), [full](after/quickstart-full-dark.png) |
| Components | [Top](before/components-top-light.png), [end](before/components-end-light.png), [full](before/components-full-light.png) | [Top](after/components-top-light.png), [end](after/components-end-light.png), [full](after/components-full-light.png) | [Top](before/components-top-dark.png), [end](before/components-end-dark.png), [full](before/components-full-dark.png) | [Top](after/components-top-dark.png), [end](after/components-end-dark.png), [full](after/components-full-dark.png) |
| API Reference | [Top](before/api-top-light.png), [schema](before/api-detail-light.png), [end](before/api-end-light.png), [full](before/api-full-light.png) | [Top](after/api-top-light.png), [schema](after/api-detail-light.png), [end](after/api-end-light.png), [full](after/api-full-light.png) | [Top](before/api-top-dark.png), [schema](before/api-detail-dark.png), [end](before/api-end-dark.png), [full](before/api-full-dark.png) | [Top](after/api-top-dark.png), [schema](after/api-detail-dark.png), [end](after/api-end-dark.png), [full](after/api-full-dark.png) |

## Findings in priority order

| Finding | Pages and themes | Effect and resolution |
| --- | --- | --- |
| Indistinct code copy controls | Quickstart, Components, API Reference in light and dark | The snippet language occupied the copy button. The toolbar now displays language as metadata and gives the action its localized Copy or Copy command label. |
| Article controls were hard to distinguish and an open or hovered control had poor text contrast | Quickstart, Components, API Reference in light and dark | The disclosures now have a quiet button edge. Open and hover surfaces use the muted background token and the panels have a stronger boundary. |
| Feedback panel lost its gutter at the viewport edge | Components at 481 px in light and dark | The panel crossed the viewport edge by 0.39 CSS px. Article panels now open in the page flow at narrow widths. |
| The union separator disappeared in the schema table | API Reference in light and dark | Escaping the pipe preserves the inline code in the rendered table cell. |

The review covered heading hierarchy, section spacing and alignment, surfaces, prose and links, tables, code, header, and both footers. The Home captures match pixel for pixel in each theme.

## Side-by-side comparisons

| Issue | Light | Dark |
| --- | --- | --- |
| Quickstart code toolbar | [Compare](comparisons/quickstart-code-light.png) | [Compare](comparisons/quickstart-code-dark.png) |
| Components code tabs and article tools | [Compare](comparisons/components-tools-light.png) | [Compare](comparisons/components-tools-dark.png) |
| API Reference schema row | [Compare](comparisons/api-schema-light.png) | [Compare](comparisons/api-schema-dark.png) |
| Focused Feedback at 481 px | [Compare](comparisons/narrow-feedback-light.png) | [Compare](comparisons/narrow-feedback-dark.png) |

## Interaction checks

On Components in both themes, Tab reached search and the dialog focused its input. Arrow Down selected a result and Escape restored focus. Arrow Right and End moved and selected code tabs. Space copied the visible command and toggled wrapping. Tab reached Markdown, Use with an agent, Feedback, and their panel links. Back to top returned focus to the main landmark. At 320 px in both themes the four pages fit the viewport horizontally, navigation and search opened, and code, table-of-contents, and Feedback controls were reachable on the docs pages. The Feedback panel also fit at 481 px.

Browser evidence covers Chromium. Firefox, WebKit, and spoken screen-reader output remain unverified.
