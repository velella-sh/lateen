import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { expand, jsonUrl, providersOf, SAFE_SCHEME } from "./providers.ts";
import { twinUrl } from "../copy-markdown/twin.ts";

// The Markdown twin rule is the copy-Markdown unit's, so both page actions name the same file.
export { twinUrl };

/** The chevron that turns over when the menu opens; decorative, so it is hidden from assistive tech. */
function chevron() {
  return h(
    "svg",
    { class: "page-agent-menu-chevron", viewBox: "0 0 16 16", "aria-hidden": "true", focusable: "false" },
    h("path", { d: "M4 6l4 4 4-4" }),
  );
}

/**
 * The page agent menu: a disclosure with a copy button for the page's Markdown, a plain link to the
 * same Markdown (so it works without JavaScript), a link to the page's JSON on a record page, and
 * links that open the page in an agent. The copy
 * button starts `hidden` and `client.ts` reveals it, so a visitor without JavaScript never sees a
 * control that would do nothing. It runs the same island as `chrome/copy-markdown`, so both page
 * actions copy the same twin and announce the same loading, success, and failure; the page keeps a
 * single `m` shortcut, owned by that control. The provider list comes from
 * `theme.options.pageAgent.providers`.
 */
const pageAgentMenu: Chrome = ({ site, page }) => {
  if (page.kind !== "doc") return null;
  const markdown = twinUrl(page.url);
  if (markdown === undefined) return null;

  const lang = page.lang;
  const json = page.record === undefined ? undefined : jsonUrl(page.url);
  const providers: Array<{ title: string; href: string }> = [];
  for (const provider of providersOf(site.config)) {
    const href = expand(site.config, page, provider.url, markdown);
    if (href !== undefined && SAFE_SCHEME.test(href)) providers.push({ title: provider.title, href });
  }

  return h(
    "details",
    { class: "page-agent-menu", "data-page-agent-menu": true },
    h("summary", { class: "page-agent-menu-summary" }, h("span", { class: "page-agent-menu-summary-text" }, t(lang, "page_agent_summary")), chevron()),
    h(
      "div",
      { class: "page-agent-menu-panel" },
      h(
        "button",
        {
          type: "button",
          class: "page-agent-menu-copy",
          hidden: true,
          "data-page-agent-copy": true,
          "data-markdown": markdown,
          "data-copied": t(lang, "copied"),
          "data-copy-failed": t(lang, "copy_failed"),
        },
        t(lang, "copy_page_md"),
      ),
      h("a", { class: "page-agent-menu-view", href: markdown }, t(lang, "view_markdown")),
      json === undefined
        ? null
        : h(
            "a",
            { class: "page-agent-menu-view", href: json, "data-page-agent-json": true },
            t(lang, "view_json"),
          ),
      providers.length === 0 ? null : h("p", { class: "page-agent-menu-heading" }, t(lang, "page_agent_open_in")),
      providers.length === 0
        ? null
        : h(
            "ul",
            { class: "page-agent-menu-providers" },
            ...providers.map((provider) =>
              h(
                "li",
                null,
                h(
                  "a",
                  { class: "page-agent-menu-provider", href: provider.href, target: "_blank", rel: "noopener" },
                  provider.title,
                ),
              ),
            ),
          ),
      h("p", { class: "page-agent-menu-status", role: "status", "data-page-agent-status": true }, ""),
    ),
  );
};

export default pageAgentMenu;
