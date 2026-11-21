import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { CodeXml } from "lucide";
import { patternOf, t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";
import { hostOf } from "../../src/repository.ts";
import { optionOf } from "../../src/options.ts";
import { acceptEditorTemplate } from "./editor.ts";

/** Every config value source mode reads, in the order the docs page lists them. */
export const SOURCE_MODE_OPTIONS = [
  "theme.options.sourceMode.editor",
  "repository.url",
  "repository.branch",
] as const;

/** The `theme.options.sourceMode.editor` template, when it passes the scheme allowlist; else `undefined`. */
export function editorOf(options: Readonly<Record<string, unknown>> | undefined): string | undefined {
  const block = optionOf(options, "sourceMode");
  if (typeof block !== "object" || block === null || Array.isArray(block)) return undefined;
  return acceptEditorTemplate((block as Record<string, unknown>).editor);
}

/** Message keys the island reads as `data-msg-*` patterns, with their `{name}` placeholders intact. */
const MESSAGES = [
  "source_copy_label",
  "source_copied",
  "source_copy_failed",
  "source_repo_label",
  "source_repo_link",
  "source_editor_label",
  "source_editor_link",
  "source_folder_prompt",
  "source_folder_saved",
  "source_jump_other",
  "source_jump_none",
  "source_jump_nearest",
  "source_kind_data",
  "source_kind_template",
] as const;

/**
 * The source mode switch: one toggle button that shows `file:line` beside every block while it is on.
 * Hidden until `client.ts` runs, so a visitor without JavaScript never sees a control that would do
 * nothing. The `role=status` region sits beside the button, not inside it, and is where `client.ts`
 * announces each change in the page language (the two messages ride on the root as data attributes).
 */
const sourceMode: Chrome = ({ site, page }) => {
  const lang = page.lang;
  const repository = site.config.repository;
  const editor = editorOf(site.config.theme.options);
  const messages: Record<string, string> = {};
  for (const key of MESSAGES) messages[`data-msg-${key.slice("source_".length).replaceAll("_", "-")}`] = patternOf(lang, key);
  return h(
    "div",
    {
      class: "source-mode-switch",
      "data-source-mode": true,
      "data-on-message": t(lang, "source_mode_on"),
      "data-off-message": t(lang, "source_mode_off"),
      hidden: true,
      ...messages,
      // Only a repository with a known host gets line links; any other forge has no URL to write.
      ...(repository !== undefined && hostOf(repository) !== undefined
        ? { "data-repository": JSON.stringify({ url: repository.url, branch: repository.branch }) }
        : {}),
      ...(editor === undefined ? {} : { "data-editor": editor }),
      // On a record page the labels say whether a position is the data file or the template.
      ...(page.record === undefined
        ? {}
        : { "data-record-template": page.record.template, "data-record-data": page.record.position.file }),
    },
    h(
      "button",
      {
        type: "button",
        class: "source-mode-button",
        "aria-pressed": "false",
      },
      icon({ node: CodeXml }),
      t(lang, "source_mode_label"),
    ),
    editor === undefined
      ? null
      : h("button", { type: "button", class: "source-folder-button" }, t(lang, "source_folder_button")),
    h("span", { class: "source-mode-status", role: "status" }, ""),
  );
};

export default sourceMode;
