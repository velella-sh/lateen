import { h } from "preact";
import type { Layout } from "@velella/mizzen/contracts";

/**
 * The site's own page layout. It keeps the theme's `doc` name, so `layout: doc` now renders this
 * shell. It prints its own `<head>` so the engine can link the page's stylesheets, including the
 * override CSS sidecar, and places the site's own header instead of the theme's chrome.
 */
const doc: Layout = ({ page, head, site }) =>
  h(
    "html",
    { lang: page.lang, dir: page.dir },
    h("head", null, h("title", null, head.title)),
    h(
      "body",
      null,
      h(
        "div",
        { class: "site-shell" },
        h("header", { class: "site-header" }, h("a", { href: `${site.config.base}/` }, "Example site")),
        h("main", { id: "content", dangerouslySetInnerHTML: { __html: page.html } }),
      ),
    ),
  );

export default doc;
