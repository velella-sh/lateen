import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { ArrowRight, Blocks, BookOpen, Check, SlidersHorizontal, Terminal } from "lucide";
import { icon } from "../src/icon.ts";
import base from "./base.ts";

type RecordValue = Readonly<Record<string, unknown>>;
const record = (value: unknown): RecordValue => typeof value === "object" && value !== null && !Array.isArray(value) ? value as RecordValue : {};
const records = (value: unknown): RecordValue[] => Array.isArray(value) ? value.filter((item): item is RecordValue => typeof item === "object" && item !== null && !Array.isArray(item)) : [];
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;
const sectionIcons = [BookOpen, Blocks, SlidersHorizontal];

function actions(fields: RecordValue[]): ComponentChildren[] {
  return fields.flatMap((action) => {
    const label = text(action.label);
    const url = text(action.url);
    if (!label || !url) return [];
    return h("a", {
      class: action.primary === true ? "btn home-btn-primary" : "btn",
      "data-size": "lg",
      ...(action.primary === true ? {} : { "data-variant": "outline" }),
      href: url,
    }, label, action.primary === true ? h("span", { "data-icon": "inline-end" }, h(icon, { node: ArrowRight })) : null);
  });
}

export default function home(props: LayoutProps) {
  const { page } = props;
  const hero = record(page.frontMatter.hero);
  const buttons = actions(records(page.frontMatter.actions));
  const sections = records(page.frontMatter.sections);
  return base({ ...props, main: h("div", { class: "home-content" },
    h("section", { class: "home-hero", "aria-labelledby": "home-title" },
      h("div", { class: "hero-copy" },
        text(hero.eyebrow) ? h("p", { class: "badge home-eyebrow", "data-variant": "outline" }, h("span", { class: "status-dot" }), text(hero.eyebrow)) : null,
        h("h1", { id: "home-title" }, text(hero.title) ?? page.title),
        text(hero.lead) ? h("p", { class: "home-lead" }, text(hero.lead)) : null,
        buttons.length ? h("div", { class: "home-actions" }, buttons) : null,
        h("ul", { class: "hero-proofs", "aria-label": "Theme qualities" },
          ["No runtime framework", "RTL ready", "Accessible by default"].map((label) => h("li", null, h(icon, { node: Check }), label)),
        ),
      ),
      h("div", { class: "card home-preview", "aria-label": "Mizzen command preview" },
        h("div", { class: "preview-topbar" }, h("span", null), h("span", null), h("span", null), h("p", null, "your-docs — zsh")),
        h("div", { class: "preview-body" },
          h(icon, { node: Terminal, class: "preview-icon" }),
          h("p", { class: "preview-command" }, h("span", null, "$"), " npx mizzen dev ."),
          h("p", { class: "preview-muted" }, "Building your documentation…"),
          h("div", { class: "preview-success" }, h(icon, { node: Check }), h("span", null, "Ready to explore")),
          h("pre", null, h("code", null, "  Local:   http://localhost:3000\n  Network: http://192.168.1.4:3000")),
          h("div", { class: "preview-footer" }, h("span", null, "6 pages"), h("span", null, "0 client frameworks")),
        ),
      ),
    ),
    h("section", { class: "home-sections", "aria-label": "Explore Lateen" }, sections.map((section, index) => {
      const title = text(section.title);
      if (!title) return null;
      const url = text(section.url);
      const links = records(section.links);
      return h("article", { class: "card home-section" },
        h("div", { class: "section-icon" }, h(icon, { node: sectionIcons[index] ?? BookOpen })),
        h("h2", null, url ? h("a", { href: url }, title, h(icon, { node: ArrowRight })) : title),
        text(section.description) ? h("p", null, text(section.description)) : null,
        links.length ? h("ul", null, links.flatMap((link) => {
          const label = text(link.title);
          const href = text(link.url);
          return label && href ? h("li", null, h("a", { href }, label, h(icon, { node: ArrowRight }))) : [];
        })) : null,
      );
    })),
    page.html ? h("div", { class: "home-body", dangerouslySetInnerHTML: { __html: page.html } }) : null,
  ) });
}
