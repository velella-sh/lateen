import { h } from "preact";
import type { Layout } from "@velella/mizzen/contracts";

/**
 * The site's own page layout. It keeps the theme's `doc` name, so `layout: doc` now renders this
 * shell, and it places the site's own header instead of the theme's chrome. The engine appends the
 * page's stylesheets before `</head>`, so the document keeps a head and the CSS sidecar loads.
 */
const doc: Layout = ({ page, site, head }) =>
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
