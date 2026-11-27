/* The mermaid component's data model: its props, the record published for automation, and source parsing
 * (normalized source, text alternative and where it came from, source position). No rendering here. */

import { normalizeSource } from "./key.ts";

/** Props from the engine: `source` is the diagram text, `alt` its text alternative. */
export type MermaidProps = {
  /** The Mermaid source. Without it the component renders nothing. */
  source?: string;
  /** Text alternative: the fence's `alt="…"`, else a leading `%% alt: …` comment. */
  alt?: string;
  /** Source position, kept as `data-src` on the figure. */
  src?: string;
  /** `true` opens the diagram larger in a panel when it is selected. */
  zoom?: string;
};

/** Where a diagram's text alternative came from: the fence's `alt`, a leading `%% alt:` comment, or neither. */
export type MermaidAltOrigin = "prop" | "comment" | "none";

/**
 * One diagram's record for automation: the normalized source, its text alternative and where it came from,
 * the source position, and whether the SVG rendered. It is published whether the render succeeded or not,
 * so a failed diagram exposes the same complete source instead of only a fallback class. `version` is
 * bumped when the meaning of a field changes.
 */
export interface MermaidRecord {
  /** Names the component, so a consumer knows how to read the rest. */
  readonly component: "mermaid";
  /** Shape version; bumped when a field changes meaning. */
  readonly version: 1;
  /** The normalized Mermaid source, complete even when the render failed. */
  readonly source: string;
  /** The text alternative and where it came from; `none` means the diagram has an empty alternative. */
  readonly alt: {
    readonly text: string;
    readonly origin: MermaidAltOrigin;
  };
  /** The authored source position as the engine stamped it, or `null` when the block has none. */
  readonly src: string | null;
  /** Whether the SVG rendered; a failed diagram keeps its source and shows the localized fallback. */
  readonly render: "rendered" | "failed";
}

/** A block's props after source parsing: the normalized source, its text alternative and origin, and the source position. */
export type ParsedDiagram = {
  readonly source: string;
  readonly alt: {
    readonly text: string;
    readonly origin: MermaidAltOrigin;
  };
  readonly src: string | null;
};

/**
 * Source parsing, before any rendering or output: normalizes the source, resolves the text alternative
 * (an authored `alt` wins over a leading `%% alt:` comment), and reads the source position. Returns `null`
 * when there is no diagram to render. Unsafe source is kept verbatim here; sanitization belongs to output.
 */
export function parseDiagramProps(props: MermaidProps): ParsedDiagram | null {
  const source = normalizeSource(text(props.source));
  if (source === "") return null;
  const authoredAlt = text(props.alt);
  const derivedAlt = authoredAlt === "" ? altFromSource(source) : "";
  const src = text(props.src);
  return {
    source,
    alt: {
      text: authoredAlt === "" ? derivedAlt : authoredAlt,
      origin: authoredAlt !== "" ? "prop" : derivedAlt !== "" ? "comment" : "none",
    },
    src: src === "" ? null : src,
  };
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The text alternative from a leading `%% alt: …` Mermaid comment, or an empty string. */
export function altFromSource(source: string): string {
  const match = /^\s*%%\s*alt\s*:\s*(.+)$/im.exec(source);
  return match?.[1]?.trim() ?? "";
}
