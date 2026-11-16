/** The attributes of the `sandbox` the frame carries: links open in new windows, and a click may leave the frame for the top window. */
export const SANDBOX = "allow-popups allow-top-navigation-by-user-activation";

/** What a copy of a page says: its title, a few facts as text, and the full page's address. */
export interface SnippetInfo {
  readonly title: string;
  readonly facts: readonly string[];
  /** Absolute address of the full page. */
  readonly href: string;
}

/** One embedded view: the frame's address and size. */
export interface FrameInfo {
  /** Absolute address of the embedded view. */
  readonly src: string;
  readonly title: string;
  readonly height: number;
}

/** Escapes text for an HTML text node or a double-quoted attribute value. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Escapes the characters Markdown reads as markup in running text. */
export function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]<>()#+!|~-]/g, "\\$&");
}

/** The `iframe` markup for an embedded view: absolute address, title, width, height, lazy loading and a sandbox. */
export function frameSnippet(frame: FrameInfo): string {
  return [
    "<iframe",
    `  src="${escapeHtml(frame.src)}"`,
    `  title="${escapeHtml(frame.title)}"`,
    '  width="100%"',
    `  height="${frame.height}"`,
    '  loading="lazy"',
    `  sandbox="${SANDBOX}"`,
    "></iframe>",
  ].join("\n");
}

/** A static HTML copy: the title, the facts as a list, and a link to the full page. No script and no `style` attribute. */
export function htmlSnippet(info: SnippetInfo): string {
  const lines = [`<h2>${escapeHtml(info.title)}</h2>`];
  if (info.facts.length > 0) {
    lines.push("<ul>", ...info.facts.map((fact) => `  <li>${escapeHtml(fact)}</li>`), "</ul>");
  }
  lines.push(`<p><a href="${escapeHtml(info.href)}">${escapeHtml(info.title)}</a></p>`);
  return lines.join("\n");
}

/** The same copy as Markdown. */
export function markdownSnippet(info: SnippetInfo): string {
  const lines = [`## ${escapeMarkdown(info.title)}`, ""];
  if (info.facts.length > 0) lines.push(...info.facts.map((fact) => `- ${escapeMarkdown(fact)}`), "");
  lines.push(`[${escapeMarkdown(info.title)}](${info.href.replace(/[()\s]/g, (c) => encodeURIComponent(c))})`);
  return lines.join("\n");
}
