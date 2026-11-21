import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { markdownTwin } from "./twin.ts";

// The twin rule is shared with the ask-agent island, which may not import the server catalog.
export { markdownTwin, pageUrl, twinUrl } from "./twin.ts";

/**
 * Copy page as Markdown: a button that copies the page's Markdown twin, a plain link to the same
 * twin so the page works without JavaScript, and a status region the island announces on. The
 * twin the link and the button share is resolved against the site's base exactly once, so a
 * subpath deployment never offers a root-relative twin. The button starts `hidden` and `client.ts`
 * reveals it once it knows the browser has a clipboard, so a visitor without JavaScript never sees
 * a control that would do nothing.
 */
const copyMarkdown: Chrome = ({ site, page }) => {
  if (page.kind !== "doc") return null;
  const markdown = markdownTwin(page.url, site.config.base);
  if (markdown === undefined) return null;

  const lang = page.lang;
  return h(
    "div",
    { class: "copy-markdown", "data-copy-markdown": true },
    h(
      "button",
      {
        type: "button",
        class: "copy-markdown-button",
        hidden: true,
        "data-copy-markdown-button": true,
        "data-markdown": markdown,
        "data-copied": t(lang, "copied"),
        "data-copy-failed": t(lang, "copy_failed"),
      },
      t(lang, "copy_page_md"),
    ),
    h("a", { class: "copy-markdown-link", href: markdown }, t(lang, "view_markdown")),
    h("p", { class: "copy-markdown-status", role: "status", "data-copy-markdown-status": true }, ""),
  );
};

export default copyMarkdown;
