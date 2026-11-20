// The typed Page fixture factory (#866): the required fields at neutral values, so a test names
// only the url, title, or record it asserts on.
import type { Page, SourcePos } from "@velella/mizzen/contracts";

const pos: SourcePos = { file: "docs/guide.md", line: 1, column: 1, endLine: 1, endColumn: 1 };

/** A Page with every required field set; focused overrides replace what a test asserts. */
export function pageWith(overrides: Partial<Page> = {}): Page {
  return {
    url: "/guide/",
    source: pos,
    frontMatter: {},
    title: "Guide",
    lang: "en",
    dir: "ltr",
    headings: [],
    html: "",
    markdown: "",
    kind: "doc",
    ...overrides,
  };
}
