/* Output hardening for the rendered diagram: HTML escaping, JSON safe inside a `<script>`, and the
 * accessible name and role added to the SVG after anything that would run in the browser is removed. */

import type { MermaidRecord } from "./model.ts";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}

/** JSON safe inside a `<script>` element: a `<` can never close the tag early. */
export function recordJson(record: MermaidRecord): string {
  return JSON.stringify(record).replace(/</g, "\\u003c");
}

/**
 * Adds the accessible name and role to a rendered SVG, and removes anything that would run in the
 * browser. Mermaid's own script and event hooks stay out of the page: rendering happened at build time.
 */
export function accessibleSvg(svg: string, alt: string): string {
  let out = svg
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\srole\s*=\s*(?:"[^"]*"|'[^']*')/i, "");
  out = out.replace(/<svg\b/i, '<svg role="img"');
  if (alt !== "") {
    out = out.replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
      const clean = attrs.replace(/\saria-label\s*=\s*(?:"[^"]*"|'[^']*')/i, "");
      return `<svg${clean} aria-label="${escapeAttr(alt)}"><title>${escapeHtml(alt)}</title>`;
    });
  }
  return out;
}
