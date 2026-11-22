import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { CodeXml, ExternalLink, Pencil, X } from "lucide";
import { patternOf, t } from "../../i18n/index.ts";
import { icon, iconHtml } from "../../src/icon.ts";
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
  "source_mode_count",
  "source_mode_empty",
] as const;

/**
 * The source mode switch: one toggle button that shows `file:line` beside every block while it is on.
 * Hidden until `client.ts` runs, so a visitor without JavaScript never sees a control that would do
 * nothing. The `role=status` region sits beside the button, not inside it, and is where `client.ts`
 * announces each change in the page language (the messages ride on the root as data attributes).
 *
 * While the mode is on, `client.ts` reveals the active bar: a count of sourced blocks and one clear
 * Exit control, so the active state and the way out are both visible at a glance. The bar and the
 * count stay out of the layout and the tab order while the mode is off.
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
      // The label actions are icon-only; the server sends the ready SVG, so the island carries no builder.
      ...(editor === undefined && (repository === undefined || hostOf(repository) === undefined)
        ? {}
        : { "data-icon-open": iconHtml({ node: ExternalLink }), "data-icon-editor": iconHtml({ node: Pencil }) }),
      // On a record page the labels say whether a position is the data file or the template.
      ...(page.record === undefined
        ? {}
        : { "data-record-template": page.record.template, "data-record-data": page.record.position.file }),
    },
    h(
      "div",
      { class: "source-mode-controls" },
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
    ),
    // The active bar is revealed by `client.ts` only while the mode is on; `hidden` keeps it out of
    // the tab order and the layout otherwise, without a flash of an empty status.
    h(
      "div",
      { class: "source-mode-active", hidden: true },
      h("span", { class: "source-mode-count", "aria-live": "polite" }, ""),
      h(
        "button",
        { type: "button", class: "source-exit-button" },
        icon({ node: X }),
        t(lang, "source_exit_label"),
      ),
    ),
    h("span", { class: "source-mode-status", role: "status" }, ""),
  );
};

export default sourceMode;
