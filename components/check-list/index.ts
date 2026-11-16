import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

/** The Markdown directive this component handles: `:::check-list`. */
export const directive = "check-list";

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = [] as const;

/** One check: a command and, when the author wrote it, what the reader should see. */
export interface Check {
  readonly command: string;
  /** The expected result as rendered HTML; empty when the item has none. */
  readonly expected: string;
}

function textOf(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&amp;/g, "&");
}

/**
 * The checks of a list: every `<li>` holds a command, the first `<code>` (or `<pre>`) in it, and what
 * follows it is the expected result. An item with no code is left out; nothing is run.
 */
export function checksOf(html: string): Check[] {
  const checks: Check[] = [];
  for (const item of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const inner = item[1] ?? "";
    const code = /<pre\b[^>]*>\s*<code\b[^>]*>([\s\S]*?)<\/code>\s*<\/pre>|<code\b[^>]*>([\s\S]*?)<\/code>/i.exec(inner);
    if (code === null) continue;
    const command = textOf(code[1] ?? code[2] ?? "").replace(/\n$/, "");
    if (command.trim() === "") continue;
    const expected = (inner.slice(0, code.index) + inner.slice(code.index + code[0].length))
      .replace(/^\s*(?:<br\s*\/?>|<p>\s*<\/p>)?\s*/i, "")
      .trim();
    checks.push({ command, expected: textOf(expected).trim() === "" ? "" : expected });
  }
  return checks;
}

/**
 * The verify step of a guide: a list of commands, each with its expected result below it and its own
 * copy button (shown by the island). The result is labelled in text for assistive technology. Nothing
 * is run: the list only shows the commands.
 */
export default function checkList({ html, page }: ComponentProps<Record<string, never>>) {
  const lang = page.lang;
  const checks = checksOf(html);
  if (checks.length === 0) return h("div", { class: "check-list", dangerouslySetInnerHTML: { __html: html } });

  return h(
    "ol",
    { class: "check-list", "data-check-list": "" },
    ...checks.map((check) =>
      h(
        "li",
        { class: "check-item" },
        h(
          "div",
          { class: "check-command" },
          h("pre", { class: "check-code", tabindex: 0, dir: "ltr" }, h("code", null, check.command)),
          h(
            "button",
            {
              type: "button",
              class: "check-copy",
              hidden: true,
              "data-check-list-copy": "",
              "data-text": check.command,
              "data-copied": t(lang, "copied"),
              "data-copy-failed": t(lang, "copy_failed"),
            },
            t(lang, "guide_check_copy"),
          ),
        ),
        h(
          "div",
          { class: "check-expected", "data-expected": check.expected === "" ? "none" : "text" },
          h("span", { class: "check-expected-label" }, t(lang, "guide_expected")),
          check.expected === ""
            ? h("span", { class: "check-expected-none" }, t(lang, "guide_check_none"))
            : h("div", { class: "check-expected-body", dangerouslySetInnerHTML: { __html: check.expected } }),
        ),
      ),
    ),
  );
}
