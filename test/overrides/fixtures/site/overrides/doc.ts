import { h } from "preact";
import type { Layout } from "@velella/mizzen/contracts";

/**
 * The site's own page layout. It keeps the theme's `doc` name, so `layout: doc` now renders this
 * shell, and it places the site's own header instead of the theme's chrome.
 */
const doc: Layout = ({ page }) =>
  h(
    "div",
    { class: "site-shell" },
    h("header", { class: "site-header" }, h("a", { href: "/" }, "Example site")),
    h("main", { id: "content", dangerouslySetInnerHTML: { __html: page.html } }),
  );

export default doc;
