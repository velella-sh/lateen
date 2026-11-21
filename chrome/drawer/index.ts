import { h, type ComponentChildren } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { X } from "lucide";
import { t } from "../../i18n/index.ts";
import { icon } from "../../src/icon.ts";
import { resolveNetworkOptions } from "../../src/options.ts";
import { mobileSelectors } from "../mobile-selectors/index.ts";
import sidebar from "../sidebar/index.ts";

/**
 * The mobile navigation drawer: the sidebar inside a `<dialog>`, opened by the header's menu button below
 * 768 px. The close button and the dialog wait for `client.ts`: the dialog is closed until it opens, and
 * `hidden` controls stay hidden for a visitor without JavaScript. That visitor gets no dialog; `style.css`
 * shows the sidebar above the article on narrow screens instead.
 */
const drawer: Chrome = (props) => {
  const nav = sidebar(props);
  if (nav == null) return null;
  const lang = props.page.lang;
  const menu = t(lang, "menu");
  const network = resolveNetworkOptions(props.site.config.theme.options);
  const selectors = mobileSelectors(props, {
    projects: props.site.network !== undefined && network.switcher,
  });
  return h(
    "dialog",
    { class: "drawer", "data-drawer": true, "aria-label": menu },
    h(
      "div",
      { class: "drawer-header" },
      h("span", null, menu),
      h(
        "button",
        { type: "button", class: "drawer-close", "aria-label": t(lang, "close_menu"), hidden: true, "data-drawer-close": true },
        icon({ node: X }),
      ),
    ),
    selectors,
    nav as ComponentChildren,
  );
};

export default drawer;
