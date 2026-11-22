/* Render identity shared by the build process and the child renderer: the options that shape the SVG,
 * source normalization, the cache key, and the names of the environment variables the two processes
 * use to talk. Pure; it imports nothing that renders. */

import { createHash } from "node:crypto";
import type { MermaidConfig } from "mermaid";
import { MERMAID_CACHE_FORMAT } from "./cache.ts";

/** Options that shape the generated SVG. They are part of the cache key, so changing one re-renders. */
export type RenderOptions = {
  readonly theme: NonNullable<MermaidConfig["theme"]>;
  readonly htmlLabels: boolean;
};

/**
 * The options the theme renders with: Mermaid's neutral base theme, repainted with the page tokens, and
 * SVG text labels. `htmlLabels: false` keeps labels as text that measures in jsdom, styles from tokens,
 * and reads as text when JavaScript is off.
 */
export const RENDER_OPTIONS: RenderOptions = { theme: "base", htmlLabels: false };

/** Source normalized for rendering and caching: LF line endings, no trailing whitespace or blank lines. */
export function normalizeSource(source: string): string {
  return source.replace(/\r\n?/g, "\n").replace(/[ \t]+$/gm, "").replace(/^\n+|\n+$/g, "");
}

/** Stable key for a source and its render options: equal keys mean the same diagram, and so the same SVG. */
export function diagramKey(source: string, options: RenderOptions = RENDER_OPTIONS): string {
  return createHash("sha1")
    .update(`${String(MERMAID_CACHE_FORMAT)}\n${options.theme}\n${String(options.htmlLabels)}\n${normalizeSource(source)}`)
    .digest("hex");
}

/** Set in the child process's environment so that importing this module runs the child renderer. */
export const CHILD_ENV = "LATEEN_MERMAID_CHILD";

/** Set in the child process's environment: the render options as JSON. */
export const CHILD_OPTIONS = "LATEEN_MERMAID_OPTIONS";
