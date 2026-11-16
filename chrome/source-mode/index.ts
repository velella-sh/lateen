import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { SOURCE_MODE_KEY_CHAR } from "./state.ts";

/**
 * The source mode switch: one toggle button that shows `file:line` beside every block while it is on.
 * Hidden until `client.ts` runs, so a visitor without JavaScript never sees a control that would do
 * nothing. The `role=status` region sits beside the button, not inside it, and is where `client.ts`
 * announces each change in the page language (the two messages ride on the root as data attributes).
 */
const sourceMode: Chrome = ({ page }) => {
  const lang = page.lang;
  return h(
    "div",
    {
      class: "source-mode-switch",
      "data-source-mode": true,
      "data-on-message": t(lang, "source_mode_on"),
      "data-off-message": t(lang, "source_mode_off"),
      hidden: true,
    },
    h(
      "button",
      {
        type: "button",
        class: "source-mode-button",
        "aria-pressed": "false",
        "aria-keyshortcuts": SOURCE_MODE_KEY_CHAR,
      },
      t(lang, "source_mode_label"),
    ),
    h("span", { class: "source-mode-status", role: "status" }, ""),
  );
};

export default sourceMode;
