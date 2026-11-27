import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { parseDiagramProps, type MermaidProps, type MermaidRecord } from "./model.ts";
import { renderDiagram } from "./render.ts";
import { accessibleSvg, naturalWidth, prefixIds, recordJson } from "./svg.ts";
import { instanceId } from "../../src/page-ids.ts";
import { zoomable } from "../../src/zoom.ts";
// The child process imports this module to render; the child module runs only when it is asked to.
import "./child.ts";

export { altFromSource, parseDiagramProps } from "./model.ts";
export type { MermaidAltOrigin, MermaidProps, MermaidRecord, ParsedDiagram } from "./model.ts";
export { diagramKey, normalizeSource, RENDER_OPTIONS, type RenderOptions } from "./key.ts";
export { CHILD_BOOT, clearDiagramCache, diagramRenderCount, renderDiagram } from "./render.ts";
export { accessibleSvg, naturalWidth, prefixIds } from "./svg.ts";
export { installMeasurement } from "./measure.ts";

/** Class on the outer `<figure>`; `style.css` styles it. */
export const MERMAID_CLASS = "mermaid";

/** Class on the element that receives the rendered SVG. */
export const DIAGRAM_CLASS = "mermaid-diagram";

/** Class on the `<details>` block that keeps the diagram source for readers and agents. */
export const SOURCE_CLASS = "mermaid-source";

/** Class on the message shown when a diagram cannot be rendered. */
export const FALLBACK_CLASS = "mermaid-fallback";

/** The diagram and its source. The SVG is rendered at build time; the page never loads Mermaid. */
export default function mermaid({ props, page }: ComponentProps<MermaidProps>) {
  const parsed = parseDiagramProps(props);
  if (parsed === null) return null;
  const { source, alt, src } = parsed;
  const result = renderDiagram(source);
  const record: MermaidRecord = {
    component: "mermaid",
    version: 1,
    source,
    alt,
    src,
    render: result.ok ? "rendered" : "failed",
  };

  const width = result.ok ? naturalWidth(result.svg) : undefined;
  const inline = result.ok ? accessibleSvg(result.svg, alt.text) : "";
  const drawn = (html: string) =>
    h("div", {
      class: DIAGRAM_CLASS,
      ...(width === undefined ? {} : { style: `--mermaid-natural: ${String(width)}px` }),
      dangerouslySetInnerHTML: { __html: html },
    });
  const zoomId = result.ok && props.zoom === "true" ? instanceId(page, "mermaid-zoom") : "";
  const diagram =
    result.ok
      ? zoomId === ""
        ? drawn(inline)
        : zoomable({
            id: zoomId,
            lang: page.lang,
            alt: alt.text,
            trigger: drawn(inline),
            content: drawn(prefixIds(inline, `${zoomId}-`)),
          })
      : h(
          "div",
          { class: FALLBACK_CLASS, role: "note" },
          h("p", null, t(page.lang, "mermaid_failed")),
        );

  return h(
    "figure",
    { class: MERMAID_CLASS, ...(src === null ? {} : { "data-src": src }) },
    diagram,
    h(
      "details",
      { class: SOURCE_CLASS },
      h("summary", null, t(page.lang, "mermaid_source")),
      h("pre", null, h("code", { class: "language-mermaid" }, source)),
    ),
    h("script", {
      type: "application/json",
      "data-mermaid-record": "",
      dangerouslySetInnerHTML: { __html: recordJson(record) },
    }),
  );
}
