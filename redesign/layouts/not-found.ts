import { h } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";

export default function notFound(props: LayoutProps) {
  const basePath = props.site.config.base;
  return base({
    ...props,
    main: h("main", { class: "lonely" },
      h("span", { class: "code-mark" }, "404"),
      h("h1", null, "This page is not in the site."),
      h("p", { class: "lead" },
        "The link may be old, or the page was never published. Search the docs, or go back to the overview.",
      ),
      h("div", { class: "actions" },
        h("a", { class: "btn home-btn-primary", "data-size": "lg", href: `${basePath}/` }, "Back to overview"),
        h("button", {
          type: "button",
          class: "btn",
          "data-variant": "outline",
          "data-size": "lg",
          "data-search-open": true,
        }, "Search the docs"),
      ),
    ),
  });
}
