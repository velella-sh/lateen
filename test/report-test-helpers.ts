import { renderToString } from "preact-render-to-string";
import type { VNode } from "preact";
import { JSDOM } from "jsdom";
import type { Site } from "@velella/mizzen/contracts";

/** A site model with only what a report component reads: `data` and the repository URL. */
export function siteWith(data: Readonly<Record<string, unknown>>, repository = "https://github.com/velella-sh/lateen"): Site {
  return {
    data,
    config: { repository: { url: repository } },
  } as unknown as Site;
}

/** The page model a report component reads: its language. */
export function pageIn(lang: string): { lang: string } {
  return { lang };
}

/** Renders a component's vnode to a document a test can query. */
export function render(vnode: unknown): Document {
  return new JSDOM(renderToString(vnode as VNode)).window.document;
}

/** The collapsed text of the first element matching `selector`, or of the document body. */
export function text(doc: Document | Element, selector?: string): string {
  const root = doc.nodeType === 9 ? (doc as Document).body : (doc as Element);
  const element = selector === undefined ? root : doc.querySelector(selector);
  return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** The rows of one table, as their cells' collapsed text. */
export function rows(doc: Document, table = "table"): string[][] {
  return [...doc.querySelectorAll(`${table} tbody tr`)].map((row) =>
    [...row.querySelectorAll("th, td")].map((cell) => (cell.textContent ?? "").replace(/\s+/g, " ").trim()),
  );
}
