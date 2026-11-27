/**
 * The public acceptance cases: one small, data-driven Playwright check per shipped feature.
 *
 * Every case builds against the acceptance site as a consumer sees it — the theme is installed
 * from the packed tarball, the site names it in `theme.name`, and the installed `mizzen` command
 * builds it — so a case cannot pass by reaching into the repository checkout.
 */

/** One visible expectation on a page. Count zero means the selector must not exist. */
export interface Expectation {
  readonly selector: string;
  /** Exact number of matching elements. Omitted: at least one. */
  readonly count?: number;
  /** The element's text must contain this text. */
  readonly text?: string;
  /** The first element's `href` must contain this text. */
  readonly hrefIncludes?: string;
  /** Count hidden elements too. Default `false`, so a case sees what a reader sees. */
  readonly visible?: boolean;
}

/** One interaction, run before the post-action expectations. */
export interface Action {
  readonly selector: string;
  /** Fill the matching input with this text. */
  readonly fill?: string;
  /** Click the matching element. */
  readonly click?: true;
}

/** One step of a keyboard journey. */
export type Step =
  /** Move focus to the first matching element. */
  | { readonly focus: string }
  /** Press a key on whatever has focus. */
  | { readonly press: string }
  /** The focused element matches this selector. */
  | { readonly focused: string }
  /** These expectations hold, after the page settles. */
  | { readonly expect: readonly Expectation[] };

/** A keyboard path through a feature, run in a fresh page with scripting on or off. */
export interface Journey {
  readonly name: string;
  /** Whether JavaScript runs. A feature that claims to work without script runs both. */
  readonly javaScript: boolean;
  readonly steps: readonly Step[];
}

/** One executable acceptance case. */
export interface AcceptanceCase {
  /** The name the feature ledger references. */
  readonly name: string;
  /** URL path on the built acceptance site. */
  readonly path: string;
  /** Expectations checked before the action. */
  readonly expect: readonly Expectation[];
  /** The action that proves the feature works, if any. */
  readonly action?: Action;
  /** Expectations checked after the action. */
  readonly after?: readonly Expectation[];
  /** Keyboard journeys, each run in a fresh page after the expectations above hold. */
  readonly journeys?: readonly Journey[];
}

export const CASES: readonly AcceptanceCase[] = [
  {
    name: "page-tools",
    path: "/page-tools/",
    expect: [{ selector: "[data-page-tool] input", count: 1 }],
    action: { selector: "[data-page-tool] input", fill: "hello from the tool" },
    after: [{ selector: "[data-page-tool-out]", text: "hello from the tool" }],
  },
  {
    name: "math",
    path: "/math/",
    expect: [
      { selector: 'math[display="inline"]', count: 2 },
      { selector: 'math[display="block"]', count: 1 },
      { selector: 'math[display="block"]', text: "ab=c" },
    ],
  },
  {
    name: "gallery",
    path: "/gallery/",
    expect: [
      { selector: ".gallery-item", count: 2 },
      { selector: ".gallery-facet", count: 1 },
    ],
    action: { selector: 'a[data-gallery-filter][data-gallery-value="Ada"]', click: true },
    after: [{ selector: ".gallery-item", count: 1 }],
  },
  {
    name: "report-issue",
    path: "/report-issue/",
    expect: [{ selector: ".doc-tools > summary" }],
    action: { selector: ".doc-tools > summary", click: true },
    after: [{ selector: '.doc-tools a:text-is("Report a problem with this page")', hrefIncludes: "/issues/new?title=" }],
  },
  {
    name: "blog",
    path: "/blog/archive/",
    expect: [
      { selector: ".blog-item", count: 2 },
      { selector: ".blog-item-title a", text: "A newer post" },
      { selector: "time[datetime]", text: "10 March 2026" },
    ],
  },
  {
    name: "versions",
    path: "/versions/",
    expect: [
      { selector: ".versions-item", count: 3 },
      { selector: 'a[href="/v1/"]', count: 1 },
    ],
  },
  {
    name: "overrides",
    path: "/overrides/",
    expect: [
      { selector: ".overrides-probe", count: 1 },
      { selector: ".overrides-probe", text: "Site guides" },
    ],
  },
  {
    name: "api-reference",
    path: "/reference/ping/",
    expect: [
      { selector: ".api-reference-method", text: "GET" },
      { selector: ".api-reference-path", text: "/ping" },
      { selector: ".api-reference-status", text: "200" },
    ],
  },
  {
    name: "code-annotations",
    path: "/annotations/",
    expect: [
      { selector: ".code-title", text: "answer.ts" },
      { selector: "pre.code .highlighted", count: 1 },
      { selector: "details.code-annotations summary", text: "Annotations (1)" },
    ],
    action: { selector: "details.code-annotations summary", click: true },
    after: [{ selector: "details.code-annotations a", hrefIncludes: "-line-2" }],
  },
  {
    name: "image-zoom",
    path: "/image-zoom/",
    expect: [
      { selector: ".figure-zoom", count: 6 },
      { selector: ".figure-zoom-panel", count: 0 },
    ],
    journeys: [
      { name: "with script", javaScript: true, steps: [
          {"focus": "button[popovertarget=\"image-zoom-1\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#image-zoom-1", "count": 1}]},
          {"press": "Escape"},
          {"expect": [{"selector": "#image-zoom-1", "count": 0}]},
          {"focused": "button[popovertarget=\"image-zoom-1\"]"},
          {"focus": "button[popovertarget=\"paired-zoom\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#paired-zoom", "count": 1}]},
          {"press": "Escape"},
          {"expect": [{"selector": "#paired-zoom", "count": 0}]},
          {"focused": "button[popovertarget=\"paired-zoom\"]"},
          {"focus": "button[popovertarget=\"mermaid-zoom\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#mermaid-zoom", "count": 1}]},
          {"press": "Escape"},
          {"expect": [{"selector": "#mermaid-zoom", "count": 0}]},
          {"focused": "button[popovertarget=\"mermaid-zoom\"]"},
          {"focus": "button[popovertarget=\"set-zoom-1\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#set-zoom-1", "count": 1}]},
          {"focus": "#set-zoom-1 .figure-zoom-next"},
          {"press": "Enter"},
          {"expect": [{"selector": "#set-zoom-2", "count": 1}]},
          {"focus": "#set-zoom-2 .figure-zoom-next"},
          {"press": "Enter"},
          {"expect": [{"selector": "#set-zoom-3", "count": 1}]},
          {"focus": "#set-zoom-3 .figure-zoom-prev"},
          {"press": "Enter"},
          {"expect": [{"selector": "#set-zoom-2", "count": 1}, {"selector": ".figure-zoom-panel", "count": 1}]},
          {"press": "Escape"},
          {"expect": [{"selector": ".figure-zoom-panel", "count": 0}]},
          {"focused": "button[popovertarget=\"set-zoom-1\"]"},
        ] },
      { name: "without script", javaScript: false, steps: [
          {"focus": "button[popovertarget=\"image-zoom-1\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#image-zoom-1", "count": 1}]},
          {"press": "Escape"},
          {"expect": [{"selector": "#image-zoom-1", "count": 0}]},
          {"focused": "button[popovertarget=\"image-zoom-1\"]"},
          {"focus": "button[popovertarget=\"paired-zoom\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#paired-zoom", "count": 1}]},
          {"press": "Escape"},
          {"expect": [{"selector": "#paired-zoom", "count": 0}]},
          {"focused": "button[popovertarget=\"paired-zoom\"]"},
          {"focus": "button[popovertarget=\"mermaid-zoom\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#mermaid-zoom", "count": 1}]},
          {"press": "Escape"},
          {"expect": [{"selector": "#mermaid-zoom", "count": 0}]},
          {"focused": "button[popovertarget=\"mermaid-zoom\"]"},
          {"focus": "button[popovertarget=\"set-zoom-1\"]"},
          {"press": "Enter"},
          {"expect": [{"selector": "#set-zoom-1", "count": 1}]},
          {"focus": "#set-zoom-1 .figure-zoom-next"},
          {"press": "Enter"},
          {"expect": [{"selector": "#set-zoom-2", "count": 1}]},
          {"focus": "#set-zoom-2 .figure-zoom-next"},
          {"press": "Enter"},
          {"expect": [{"selector": "#set-zoom-3", "count": 1}]},
          {"press": "Escape"},
          {"press": "Escape"},
          {"press": "Escape"},
          {"expect": [{"selector": ".figure-zoom-panel", "count": 0}]},
        ] },
    ],
  },
];
