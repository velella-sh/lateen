import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { bodyText, parseLines, PROMPT } from "../terminal/index.ts";
import { readSessionFile } from "./source.ts";

/** The Markdown directive this component handles: `:::cli-demo`. */
export const directive = "cli-demo";

/** Class on the frame; `style.css` styles it and `client.ts` finds it by `data-cli-demo`. */
export const CLI_DEMO_CLASS = "cli-demo";

/** Class on the `pre` that holds the session. */
export const BODY_CLASS = "cli-demo-body";

/** Class on the bar of buttons. It starts `hidden`; the island reveals it. */
export const BAR_CLASS = "cli-demo-bar";

/** Class on the message shown in place of a session that could not be read or is empty. */
export const DIAGNOSTIC_CLASS = "cli-demo-diagnostic";

/** The comment mark: a line that starts with it is the author's note, shown and never copied as a command. */
export const COMMENT_MARK = "#";

/** The error mark: a line that starts with it is an error line of the session. */
export const ERROR_MARK = "!";

/** The kinds of line a session has. */
export type DemoKind = "command" | "output" | "error" | "comment";

/** One line of a session. */
export interface DemoLine {
  readonly kind: DemoKind;
  /** The text shown: a command and an error without their mark, a comment with its `#`. */
  readonly text: string;
  /** The 0-based command this line belongs to; `null` for lines before the first command. */
  readonly command: number | null;
  /** True for command input after the prompt line: a backslash continuation or a heredoc line. */
  readonly continuation: boolean;
}

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = ["play", "src"] as const;

export type CliDemoProps = {
  /** Any value but `false` offers playback: the lines reveal one by one when the reader asks. */
  play?: string;
  /** A text file in the site that holds the session in place of the body. `/` starts at the site folder. */
  src?: string;
};

/**
 * Splits session text into lines of the four kinds. `$ ` opens a command, with its continuation and
 * heredoc lines; of the other lines, one that starts with `#` is a comment, one that starts with `!` is an
 * error, and the rest is output. Nothing is executed, expanded, or evaluated.
 */
export function parseSession(text: string): DemoLine[] {
  return parseLines(text).map((line): DemoLine => {
    if (line.kind === "command") return line;
    if (line.text.startsWith(COMMENT_MARK)) return { ...line, kind: "comment" };
    if (line.text.startsWith(ERROR_MARK)) {
      return { ...line, kind: "error", text: line.text.slice(ERROR_MARK.length).replace(/^ /, "") };
    }
    return line;
  });
}

/** The command lines, joined by newlines and without prompts: what "Copy commands" takes. */
export function commandText(lines: readonly DemoLine[]): string {
  return lines
    .filter((line) => line.kind === "command")
    .map((line) => line.text)
    .join("\n");
}

/** The whole session as written, with prompts and marks: what "Copy all" takes. */
export function allText(lines: readonly DemoLine[]): string {
  return lines
    .map((line) => {
      if (line.kind === "command") return line.continuation ? line.text : `${PROMPT} ${line.text}`;
      if (line.kind === "error") return `${ERROR_MARK} ${line.text}`;
      return line.text;
    })
    .join("\n");
}

/** Whether `play` asks for playback: present, and not `false`. */
export function wantsPlay(value: unknown): boolean {
  return typeof value === "string" ? value.trim().toLowerCase() !== "false" : value === true;
}

/** One command and what followed it: the record an agent reads without the styling. */
export interface DemoRecord {
  readonly prompt: string;
  /** The whole command input without prompts. */
  readonly input: string;
  /** The output lines after the command. */
  readonly output: readonly string[];
  /** The error lines after the command, without their mark. */
  readonly errors: readonly string[];
}

/** The session as one record per command, in order. Comments are the author's notes and are left out. */
export function recordsOf(lines: readonly DemoLine[]): DemoRecord[] {
  const inputs: string[][] = [];
  const output: string[][] = [];
  const errors: string[][] = [];
  for (const line of lines) {
    if (line.command === null) continue;
    if (line.kind === "command") (inputs[line.command] ??= []).push(line.text);
    else if (line.kind === "output") (output[line.command] ??= []).push(line.text);
    else if (line.kind === "error") (errors[line.command] ??= []).push(line.text);
  }
  return inputs.map((parts, i) => ({ prompt: PROMPT, input: parts.join("\n"), output: output[i] ?? [], errors: errors[i] ?? [] }));
}

/** JSON safe inside a `<script>` element: a `<` can never close the tag early. */
export function recordsJson(records: readonly DemoRecord[]): string {
  return JSON.stringify(records).replace(/</g, "\\u003c");
}

function lineElement(line: DemoLine, previous: DemoLine | undefined, lang: string) {
  const attributes: Record<string, string> = { "data-line": line.kind };
  if (line.command !== null) attributes["data-command"] = String(line.command);
  const text = h("span", { class: "cli-demo-text" }, line.text);

  if (line.kind === "command") {
    if (line.continuation) {
      return h("span", { class: "cli-demo-line cli-demo-command cli-demo-continuation", ...attributes }, text);
    }
    return h(
      "span",
      { class: "cli-demo-line cli-demo-command", ...attributes },
      h("span", { class: "cli-demo-prompt", "aria-hidden": "true" }, `${PROMPT} `),
      text,
    );
  }

  // An error says "error" on every line; output and comments say what they are once per run, to a screen reader.
  const first = previous?.kind !== line.kind;
  const label =
    line.kind === "error"
      ? h("span", { class: "cli-demo-label cli-demo-label-visible" }, t(lang, "cli_demo_error"))
      : first && line.kind === "output"
        ? h("span", { class: "cli-demo-label" }, t(lang, "cli_demo_output"))
        : first
          ? h("span", { class: "cli-demo-label" }, t(lang, "cli_demo_comment"))
          : null;
  return h("span", { class: `cli-demo-line cli-demo-${line.kind}`, ...attributes }, label, text);
}

function button(kind: string, label: string, extra: Record<string, string> = {}) {
  return h("button", { type: "button", class: `cli-demo-button cli-demo-${kind}`, hidden: true, [`data-cli-demo-${kind}`]: "", ...extra }, label);
}

function message(text: string) {
  return h("div", { class: CLI_DEMO_CLASS }, h("p", { class: DIAGNOSTIC_CLASS, role: "note" }, text));
}

/**
 * A terminal session as fixed text: commands with a prompt, output, errors with a visible label, and
 * comments. Every line says what it is in text, so no colour is needed to tell them apart. Without
 * JavaScript the session is plain selectable text and the decoration (prompt and labels) is not
 * selected. The island adds "Copy commands", "Copy all", and, with `play`, line-by-line playback. An inert
 * JSON script lists the commands with their output for an agent.
 */
export default function cliDemo({ props, html, page }: ComponentProps<CliDemoProps>) {
  const lang = page.lang;
  let text = bodyText(html);

  if (typeof props.src === "string" && props.src.trim() !== "") {
    const file = readSessionFile(props.src, page.source.file);
    if (!file.ok) {
      const key = file.reason === "outside" ? "cli_demo_outside" : "cli_demo_missing";
      return message(`${t(lang, key, { src: props.src.trim() })} (${page.source.file}:${String(page.source.line)})`);
    }
    text = file.text;
  }

  const lines = parseSession(text);
  if (lines.length === 0) return message(t(lang, "cli_demo_empty"));

  const hasCommands = lines.some((line) => line.kind === "command");
  const play = wantsPlay(props.play);
  const records = recordsOf(lines);

  const buttons = [
    hasCommands ? button("copy-commands", t(lang, "cli_demo_copy_commands"), { "data-text": commandText(lines) }) : null,
    button("copy-all", t(lang, "cli_demo_copy_all"), { "data-text": allText(lines) }),
    play ? button("play", t(lang, "cli_demo_play")) : null,
    play ? button("pause", t(lang, "cli_demo_pause")) : null,
    play ? button("show-all", t(lang, "cli_demo_show_all")) : null,
  ];

  return h(
    "div",
    {
      class: CLI_DEMO_CLASS,
      "data-cli-demo": "",
      ...(play ? { "data-play": "" } : {}),
      "data-copied": t(lang, "copied"),
      "data-copy-failed": t(lang, "copy_failed"),
    },
    h("div", { class: BAR_CLASS, hidden: true }, buttons, h("span", { class: "cli-demo-status", role: "status", "data-cli-demo-status": "" })),
    h(
      "pre",
      { class: BODY_CLASS, tabindex: 0 },
      h("code", {}, ...lines.map((line, index) => lineElement(line, lines[index - 1], lang))),
    ),
    records.length === 0
      ? null
      : h("script", {
          type: "application/json",
          "data-cli-demo-commands": "",
          dangerouslySetInnerHTML: { __html: recordsJson(records) },
        }),
  );
}
