import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps, LinkTag, MetaTag } from "@velella/mizzen/contracts";
import shell from "../chrome/shell/index.ts";

export const themeScript = `(function(){try{var t=localStorage.getItem("lateen-theme");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){var t="light"}var d=document.documentElement;d.dataset.theme=t;d.classList.toggle("dark",t==="dark")})()`;

export type BaseProps = LayoutProps & {
  main: ComponentChildren;
  sidebar?: ComponentChildren;
  aside?: ComponentChildren;
};

const meta = (tag: MetaTag) => h("meta", { [tag.property ? "property" : "name"]: tag.name, content: tag.content });
const link = (tag: LinkTag) => h("link", { ...tag.attrs, rel: tag.rel, href: tag.href });

export default function base(props: BaseProps) {
  const { page, head, islands } = props;
  return h(
    "html",
    { lang: page.lang, dir: page.dir, "data-theme": "light" },
    h("head", null,
      h("meta", { charset: "utf-8" }),
      h("meta", { name: "viewport", content: "width=device-width, initial-scale=1" }),
      h("script", { dangerouslySetInnerHTML: { __html: themeScript } }),
      h("title", null, head.title),
      head.meta.map(meta),
      head.links.map(link),
      head.jsonLd.map((data) => h("script", { type: "application/ld+json", dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, "\\u003c") } })),
    ),
    h("body", null,
      h("a", { class: "skip-link", href: "#main" }, "Skip to content"),
      shell(props) as ComponentChildren,
      h("div", { class: `layout${props.sidebar ? " doc-layout" : " home-layout"}` },
        props.sidebar ? h("div", { class: "docs-sidebar" }, props.sidebar) : null,
        h("main", { id: "main", tabindex: -1 }, props.main),
        props.aside ? h("div", { class: "aside" }, props.aside) : null,
      ),
      h("footer", { class: "site-footer" },
        h("div", null,
          h("p", null, "Built with Mizzen. Designed for people and agents."),
          h("nav", { "aria-label": "Footer" },
            h("a", { href: "https://github.com/velella-sh/lateen" }, "GitHub"),
            h("a", { href: "https://velella.sh/mizzen/" }, "Mizzen"),
            h("a", { href: `${props.site.config.base}/install/` }, "Install"),
          ),
        ),
      ),
      islands.map((island) => h("script", { type: "module", src: island.src })),
    ),
  );
}
