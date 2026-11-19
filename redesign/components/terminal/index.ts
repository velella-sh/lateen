import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "terminal";
export const TERMINAL_CLASS = "terminal";
export const BODY_CLASS = "terminal-body";
export const COPY_CLASS = "terminal-copy";
export const PROMPT = "$";

export type TerminalProps = { label?: string };

/** Lines that start with `$` are commands; the rest are output. */
export function sessionLines(html: string): { kind: "command" | "output"; text: string }[] {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'");
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/u, ""))
    .filter((line, index, all) => line !== "" || (index > 0 && index < all.length - 1))
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith(`${PROMPT} `) || trimmed === PROMPT) {
        return { kind: "command" as const, text: trimmed.slice(PROMPT.length).trimStart() };
      }
      return { kind: "output" as const, text: line };
    });
}

export default function terminal({ props, html }: ComponentProps<TerminalProps>) {
  const lines = sessionLines(html);
  const copyText = lines
    .filter((line) => line.kind === "command")
    .map((line) => `${PROMPT} ${line.text}`)
    .join("\n");

  return h(
    "div",
    {
      class: TERMINAL_CLASS,
      "data-terminal": "",
      ...(props.label ? { "aria-label": props.label } : { "aria-label": "Terminal" }),
    },
    h(
      "button",
      {
        type: "button",
        class: COPY_CLASS,
        hidden: true,
        "data-terminal-copy": "",
        "data-text": copyText,
      },
      "Copy",
    ),
    h(
      "pre",
      { class: BODY_CLASS, tabindex: 0, dir: "ltr" },
      lines.length === 0
        ? h("code", { dangerouslySetInnerHTML: { __html: html } })
        : lines.map((line) =>
          line.kind === "command"
            ? h("span", { class: "terminal-line terminal-command" }, `${PROMPT} ${line.text}`, "\n")
            : h("span", { class: "terminal-line terminal-output" }, line.text, "\n"),
        ),
    ),
  );
}
