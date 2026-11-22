/* Child renderer: Mermaid + jsdom, run in its own process so the build stays synchronous. The parent
 * (`render.ts`) starts it with `LATEEN_MERMAID_CHILD=1`; importing this module in that process renders the
 * diagram on stdin and writes one JSON result. Elsewhere, importing it does nothing. */

import { CHILD_ENV, CHILD_OPTIONS, diagramKey, RENDER_OPTIONS, type RenderOptions } from "./key.ts";
import { installMeasurement, type MeasureTarget } from "./measure.ts";

/** True in the child process, where importing this module renders the diagram on stdin. */
const invokedDirectly = process.env[CHILD_ENV] === "1";

/** jsdom has no CSSStyleSheet; Mermaid only inserts and reads rules. */
class StyleSheetPolyfill {
  cssRules: Array<{ cssText: string }> = [];

  insertRule(rule: string, index = this.cssRules.length): number {
    this.cssRules.splice(index, 0, { cssText: rule });
    return index;
  }

  replaceSync(text: string): void {
    this.cssRules = [{ cssText: text }];
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString("utf8");
}

/** The render options the parent put in this child's environment; the defaults if they are missing or unreadable. */
function childOptions(): RenderOptions {
  try {
    const parsed = JSON.parse(process.env[CHILD_OPTIONS] ?? "") as Partial<RenderOptions>;
    return {
      theme: typeof parsed.theme === "string" ? parsed.theme : RENDER_OPTIONS.theme,
      htmlLabels: typeof parsed.htmlLabels === "boolean" ? parsed.htmlLabels : RENDER_OPTIONS.htmlLabels,
    };
  } catch {
    return RENDER_OPTIONS;
  }
}

async function renderInProcess(source: string, options: RenderOptions): Promise<string> {
  const { JSDOM } = await import("jsdom");
  const dom = new JSDOM("<!DOCTYPE html><html><body></body></html>", { pretendToBeVisual: true });
  const global = globalThis as unknown as Record<string, unknown>;
  global.window = dom.window;
  global.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  global.DOMParser = dom.window.DOMParser;
  global.Element = dom.window.Element;
  global.HTMLElement = dom.window.HTMLElement;
  global.SVGElement = dom.window.SVGElement;
  global.CSSStyleSheet = StyleSheetPolyfill;
  installMeasurement(dom.window.SVGElement.prototype as unknown as MeasureTarget);

  const mermaid = (await import("mermaid")).default;
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: options.theme,
    fontFamily: "inherit",
    htmlLabels: options.htmlLabels,
  });
  // A stable id per source and options keeps marker and accessibility ids unique when a page has several
  // diagrams, and the same diagram gets the same ids across pages.
  const id = `mermaid-${diagramKey(source, options).slice(0, 12)}`;
  const { svg } = await mermaid.render(id, source);
  return svg;
}

async function runChild(): Promise<number> {
  // Mermaid logs through console.log; keep stdout for the one JSON result.
  console.log = (...args: unknown[]) => console.error(...args);
  const source = await readStdin();
  try {
    const svg = await renderInProcess(source, childOptions());
    process.stdout.write(JSON.stringify({ ok: true, svg }));
    return 0;
  } catch (error) {
    process.stdout.write(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) }));
    return 0;
  }
}

if (invokedDirectly) process.exitCode = await runChild();
