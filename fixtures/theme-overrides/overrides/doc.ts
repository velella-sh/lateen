import { h } from "preact";
import type { Layout } from "@velella/mizzen/contracts";

/** The site's own doc layout: a minimal shell around the page's HTML. */
const doc: Layout = ({ page, head }) =>
  h(
    "html",
    { lang: page.lang },
    h("head", null, h("title", null, head.title)),
    h("body", null, h("main", { class: "site-doc" }, h("h1", null, page.title), h("div", { class: "site-doc-body", dangerouslySetInnerHTML: { __html: page.html } }))),
  );

export default doc;
