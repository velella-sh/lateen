import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import base from "./base.ts";

type RecordValue = Readonly<Record<string, unknown>>;
const record = (value: unknown): RecordValue =>
  typeof value === "object" && value !== null && !Array.isArray(value) ? value as RecordValue : {};
const records = (value: unknown): RecordValue[] =>
  Array.isArray(value)
    ? value.filter((item): item is RecordValue => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];
const text = (value: unknown): string | undefined => typeof value === "string" ? value : undefined;

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
    }, label);
  });
}

function preview(): ComponentChildren {
  return h("aside", { class: "home-preview", "aria-hidden": "true" },
    h("div", { class: "preview-chrome" },
      h("span", { class: "preview-dot" }),
      h("span", { class: "preview-dot" }),
      h("span", { class: "preview-dot" }),
      h("em", null, "layouts.md"),
    ),
    h("div", { class: "preview-body" },
      h("div", { class: "preview-side" },
        h("b", null, "Start"),
        h("i", null), h("i", { class: "on" }), h("i", null),
        h("b", null, "Components"),
        h("i", null), h("i", null),
      ),
      h("div", { class: "preview-article" },
        h("span", { class: "preview-crumb" }),
        h("strong", null, "Layouts"),
        h("span", { class: "preview-line" }),
        h("span", { class: "preview-line short" }),
        h("span", { class: "preview-code" }),
        h("span", { class: "preview-callout" }),
      ),
      h("div", { class: "preview-toc" },
        h("b", null, "On this page"),
        h("i", { class: "on" }), h("i", null), h("i", null),
      ),
    ),
  );
}

export default function home(props: LayoutProps) {
  const { page } = props;
  const hero = record(page.frontMatter.hero);
  const buttons = actions(records(page.frontMatter.actions));
  const sections = records(page.frontMatter.sections);
  return base({
    ...props,
    main: h("div", { class: "home-content" },
      h("div", { class: "home-stage" },
        h("section", { class: "home-hero", "aria-labelledby": "home-title" },
          text(hero.eyebrow)
            ? h("p", { class: "badge home-eyebrow", "data-variant": "outline" },
              h("span", { class: "status-dot" }),
              text(hero.eyebrow),
            )
            : null,
          h("p", { class: "product" }, "Lateen"),
          h("h1", { id: "home-title", class: "display" }, text(hero.title) ?? page.title),
          text(hero.lead) ? h("p", { class: "home-lead lead" }, text(hero.lead)) : null,
          buttons.length ? h("div", { class: "home-actions actions" }, buttons) : null,
          h("p", { class: "hero-hint" },
            h("kbd", null, "⌘"), h("kbd", null, "K"),
            " search · ",
            h("kbd", null, "/"),
            " focus · theme in the corner",
          ),
        ),
        preview(),
      ),
      h("section", { class: "home-sections cards", "aria-label": "Explore Lateen" }, sections.map((section) => {
        const title = text(section.title);
        if (!title) return null;
        const links = records(section.links);
        return h("article", { class: "card home-section" },
          h("h2", null, title),
          text(section.description) ? h("p", null, text(section.description)) : null,
          links.flatMap((link) => {
            const label = text(link.title);
            const href = text(link.url);
            const kind = text(link.kind) ?? text(link.meta) ?? "page";
            return label && href
              ? h("a", { class: "row", href }, h("span", null, label), h("em", null, kind))
              : [];
          }),
        );
      })),
      page.html ? h("div", { class: "home-body", dangerouslySetInnerHTML: { __html: page.html } }) : null,
    ),
  });
}
