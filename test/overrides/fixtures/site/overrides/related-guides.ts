import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/**
 * The site's own navigation between guides. It keeps the theme's `related-guides` name, so the
 * same <sl-component name="related-guides"> markup now renders this file.
 */
const relatedGuides: Component = ({ page, site }) =>
  h(
    "nav",
    { class: "related-guides", "aria-label": "Guides" },
    h("a", { href: page.url }, "This guide"),
    h("a", { href: `${site.config.base}/` }, "All guides"),
  );

export default relatedGuides;
