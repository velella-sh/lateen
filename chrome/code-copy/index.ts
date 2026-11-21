import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { Check, Copy } from "lucide";
import { t } from "../../i18n/index.ts";

/**
 * Renders no visible chrome: a hidden template carries the copy and wrap controls' localized words and
 * Lucide icons for the island, which adds the controls to every code block. A layout draws most blocks itself and the
 * engine loads a component's island only when page Markdown uses that component, so the behaviour
 * lives in the always-loaded chrome islands. Without the island the template stays inert.
 */
const codeCopy: Chrome = ({ page }) => {
  const lang = page.lang;
  return h("template", {
    "data-code-copy": true,
    "data-copy": t(lang, page.frontMatter.quickstart === true ? "code_copy_command" : "copy"),
    "data-copied": t(lang, "copied"),
    "data-failed": t(lang, "copy_failed_select"),
    "data-wrap": t(lang, "code_wrap"),
    "data-copy-icon": JSON.stringify(Copy),
    "data-check-icon": JSON.stringify(Check),
  });
};

export default codeCopy;
