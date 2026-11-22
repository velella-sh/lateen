import { h, type ComponentChildren } from "preact";
import type { Chrome, Page } from "@velella/mizzen/contracts";
import { ArrowUp, SquarePen } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";
import { editPrompt } from "../../src/agent.ts";
import copyMarkdown from "../copy-markdown/index.ts";
import editPage from "../edit-page/index.ts";
import pageAgentMenu from "../page-agent-menu/index.ts";
import { reportHref } from "../report-issue/index.ts";

/** The button that copies a prompt asking an agent to edit this page; `client.ts` reveals it. */
function agentAction(page: Page) {
  if (page.frontMatter.agent?.edit === false) return null;
  const lang = page.lang;
  return h(
    "button",
    {
      type: "button",
      class: "page-footer-copy",
      hidden: true,
      "data-page-footer-copy": true,
      "data-prompt": editPrompt(page),
      "data-copied": t(lang, "copied"),
      "data-copy-failed": t(lang, "copy_failed"),
    },
    t(lang, "edit_label"),
  );
}

function backToTop(lang: string) {
  return h(
    "a",
    { class: "back-to-top", href: "#main" },
    icon({ node: ArrowUp, class: "back-to-top-arrow" }),
    t(lang, "back_to_top"),
  );
}

/**
 * The actions under the article on layouts without a Page tools menu: the copy button for the agent
 * prompt, the report link, and Back to top. The button starts `hidden` and `client.ts` reveals it, so
 * a visitor without JavaScript sees no control that would do nothing. The report link is left out
 * when the site gives it no address. The edit link and the last-updated line are separate chrome
 * units, so the layouts place them once.
 */
const pageFooter: Chrome = (props) => {
  const { site, page } = props;
  const report = reportHref(site, page);
  const reportLink =
    report === undefined
      ? null
      : h("p", { class: "page-footer-feedback" },
          h("a", { href: report, rel: "noopener" }, t(page.lang, page.record === undefined ? "report_issue" : "report_data")),
        );
  return h("div", { class: "page-footer" }, agentAction(page), reportLink, backToTop(page.lang));
};

/**
 * The doc layout's Page tools: the page's Markdown, the agent actions, and anything the layout adds
 * (Source mode), as plain rows in one menu beside the breadcrumb, so the article end stays quiet.
 */
export function docPageTools(props: Parameters<Chrome>[0], ...extra: ComponentChildren[]): ComponentChildren[] {
  const { site, page } = props;
  const action = agentAction(page);
  const menu = pageAgentMenu(props, action, { flat: true });
  const report = reportHref(site, page);
  const reportLink =
    report === undefined
      ? null
      : h("a", { class: "page-tools-report", href: report, rel: "noopener" },
          t(page.lang, page.record === undefined ? "report_issue" : "report_data"),
        );
  return [...(menu === null ? [copyMarkdown(props) as ComponentChildren, action] : [menu]), ...extra, reportLink];
}

/** The doc layout's article end: one quiet row with the edit link and Back to top. */
export const docPageFooter: Chrome = (props) => {
  const edit = editPage(props) as ComponentChildren;
  return h("div", { class: "page-end" },
    edit == null ? null : h("div", { class: "page-end-edit" }, icon({ node: SquarePen, class: "page-end-icon" }), edit),
    backToTop(props.page.lang),
  );
};

export default pageFooter;
