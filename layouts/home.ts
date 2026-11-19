import { h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps, Layout, LayoutProps } from "@velella/mizzen/contracts";
import shell, { footer } from "../chrome/shell/index.ts";
import backdrop from "../components/backdrop/index.ts";
import ctaBand from "../components/cta-band/index.ts";
import featureGrid from "../components/feature-grid/index.ts";
import frame from "../components/frame/index.ts";
import hero from "../components/hero/index.ts";
import motif from "../components/motif/index.ts";
import statStrip from "../components/stat-strip/index.ts";
import { resolveBrand } from "../src/brand.ts";
import base from "./base.ts";

/**
 * The docs home: sailcloth shell + mockup home stage (brand, preview pane, section cards).
 * `home.style: showpiece` still recomposes from the showpiece components.
 */

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

/** The records of a front-matter list; anything else in it is ignored. */
function recordsOf(value: unknown): readonly Readonly<Record<string, unknown>>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

/** The value at `key` when it is a string. */
function stringAt(record: Readonly<Record<string, unknown>>, key: string): string | undefined {
  const value = record[key];
  return isString(value) ? value : undefined;
}

/** One action: the author's label and URL; `primary: true` gets the filled button. */
function actionLink(fields: Readonly<Record<string, unknown>>): ComponentChildren {
  const label = stringAt(fields, "label");
  const url = stringAt(fields, "url");
  if (label === undefined || url === undefined) return null;
  return h(
    "a",
    { class: fields.primary === true ? "home-btn home-btn-primary" : "home-btn home-btn-quiet", href: url },
    label,
  );
}

/** Decorative docs-window preview from the sailcloth mockup (not interactive). */
function preview(): ComponentChildren {
  return h(
    "aside",
    { class: "home-preview", "aria-hidden": "true" },
    h(
      "div",
      { class: "preview-chrome" },
      h("span", { class: "preview-dot" }),
      h("span", { class: "preview-dot" }),
      h("span", { class: "preview-dot" }),
      h("em", null, "layouts.md"),
    ),
    h(
      "div",
      { class: "preview-body" },
      h(
        "div",
        { class: "preview-side" },
        h("b", null, "Start"),
        h("i", null),
        h("i", { class: "on" }),
        h("i", null),
        h("b", null, "Components"),
        h("i", null),
        h("i", null),
      ),
      h(
        "div",
        { class: "preview-article" },
        h("span", { class: "preview-crumb" }),
        h("strong", null, "Layouts"),
        h("span", { class: "preview-line" }),
        h("span", { class: "preview-line short" }),
        h("span", { class: "preview-code" }),
        h("span", { class: "preview-callout" }),
      ),
      h(
        "div",
        { class: "preview-toc" },
        h("b", null, "On this page"),
        h("i", { class: "on" }),
        h("i", null),
        h("i", null),
      ),
    ),
  );
}

/** One section card matching the mockup: title, description, and row links. */
function sectionBlock(fields: Readonly<Record<string, unknown>>): ComponentChildren {
  const title = stringAt(fields, "title");
  if (title === undefined) return null;
  const description = stringAt(fields, "description");

  const rows: ComponentChildren[] = [];
  for (const link of recordsOf(fields.links)) {
    const linkTitle = stringAt(link, "title");
    const linkUrl = stringAt(link, "url");
    if (linkTitle === undefined || linkUrl === undefined) continue;
    const meta = stringAt(link, "meta") ?? stringAt(link, "kind") ?? "page";
    rows.push(h("a", { class: "row", href: linkUrl }, h("span", null, linkTitle), h("em", null, meta)));
  }

  return h(
    "article",
    { class: "home-section card" },
    h("h2", { class: "home-section-title" }, title),
    description === undefined ? null : h("p", { class: "home-section-description" }, description),
    rows,
  );
}

/** Sailcloth home: stage (hero + preview), section cards, then the page body. */
function content(props: LayoutProps): ComponentChildren {
  const hero = props.page.frontMatter.hero;
  const fields = isRecord(hero) ? hero : {};
  const eyebrow = stringAt(fields, "eyebrow");
  const lead = stringAt(fields, "lead");
  const title = stringAt(fields, "title") ?? props.page.title;
  const product = props.site.config.title || "Lateen";

  const buttons: ComponentChildren[] = [];
  for (const action of recordsOf(props.page.frontMatter.actions)) {
    const button = actionLink(action);
    if (button !== null) buttons.push(button);
  }

  const cards = recordsOf(props.page.frontMatter.sections).map(sectionBlock).filter((card) => card !== null);

  return h(
    "div",
    { class: "home-content" },
    h(
      "div",
      { class: "home-stage" },
      h(
        "section",
        { class: "home-hero", "aria-labelledby": "home-title" },
        eyebrow === undefined
          ? null
          : h("p", { class: "home-eyebrow" }, h("i", { "aria-hidden": "true" }), eyebrow),
        h("p", { class: "product" }, product),
        h("h1", { id: "home-title", class: "home-title display" }, title),
        lead === undefined ? null : h("p", { class: "home-lead lead" }, lead),
        buttons.length === 0 ? null : h("div", { class: "home-actions actions" }, buttons),
        h(
          "p",
          { class: "hero-hint" },
          h("kbd", null, "⌘"),
          h("kbd", null, "K"),
          " search · ",
          h("kbd", null, "/"),
          " focus · theme in the corner",
        ),
      ),
      preview(),
    ),
    cards.length === 0
      ? null
      : h("section", { class: "home-sections cards", "aria-label": "Explore" }, cards),
    props.page.html.length > 0
      ? h("div", { class: "home-body", dangerouslySetInnerHTML: { __html: props.page.html } })
      : null,
  );
}

/** The record without its undefined values, for components that forbid explicit `undefined`. */
function defined(record: Readonly<Record<string, unknown>>): Record<string, string> {
  return Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined)) as Record<string, string>;
}

/** Runs a component with its input and returns what it drew; the engine's node type is opaque. */
function call<P extends Readonly<Record<string, unknown>>>(
  component: (input: ComponentProps<P>) => unknown,
  input: ComponentProps<P>,
): ComponentChildren {
  return component(input) as ComponentChildren;
}

/** True when the page opts in to the showpiece composition. */
function isShowpiece(props: LayoutProps): boolean {
  const option = props.page.frontMatter.home;
  return isRecord(option) && option.style === "showpiece";
}

/** The `home` option record, or an empty one. */
function optionsOf(props: LayoutProps): Readonly<Record<string, unknown>> {
  const option = props.page.frontMatter.home;
  return isRecord(option) ? option : {};
}

/** The showpiece content: hero, stat strip, feature grid, framed demo, call to action, then the body. */
function showpieceContent(props: LayoutProps): ComponentChildren {
  const { page, site } = props;
  const fm = page.frontMatter;
  const options = optionsOf(props);
  const shared = { page, site, html: "" };
  const blocks: ComponentChildren[] = [];

  const look = resolveBrand(site.config.theme.options).brand?.showpiece;
  const seed = stringAt(options, "motif") ?? look?.motif;
  blocks.push(
    h(
      "div",
      { class: "home-showpiece-hero" },
      call(backdrop, { ...shared, props: defined({ variant: stringAt(options, "backdrop") ?? look?.backdrop, intensity: look?.intensity }) }),
      seed === undefined || seed === "" ? null : h("div", { class: "home-showpiece-motif" }, call(motif, { ...shared, props: { seed } })),
      call(hero, {
        ...shared,
        props: {
          ...(isRecord(fm.hero)
            ? defined({ eyebrow: stringAt(fm.hero, "eyebrow"), title: stringAt(fm.hero, "title"), lead: stringAt(fm.hero, "lead") })
            : {}),
          actions: fm.actions,
        },
      }),
    ),
  );

  blocks.push(call(statStrip, { ...shared, props: {} }));

  const features = Array.isArray(fm.features) ? fm.features : recordsOf(fm.sections);
  blocks.push(featureGrid({ features }));

  let bodyUsed = false;
  const demo = fm.demo;
  if (isRecord(demo) && page.html.trim() !== "") {
    bodyUsed = true;
    blocks.push(
      h("div", { class: "home-showpiece-demo" }, call(frame, { page, site, html: page.html, props: defined({ title: stringAt(demo, "title"), caption: stringAt(demo, "caption") }) })),
    );
  }

  const cta = fm.cta;
  if (isRecord(cta)) {
    const action = recordsOf(cta.actions).find((a) => stringAt(a, "label") !== undefined && stringAt(a, "url") !== undefined);
    blocks.push(
      call(ctaBand, {
        ...shared,
        props: defined({
          title: stringAt(cta, "title"),
          lead: stringAt(cta, "lead"),
          package: stringAt(cta, "package"),
          label: action === undefined ? undefined : stringAt(action, "label"),
          url: action === undefined ? undefined : stringAt(action, "url"),
        }),
      }),
    );
  }

  if (!bodyUsed && page.html.length > 0) blocks.push(h("div", { dangerouslySetInnerHTML: { __html: page.html } }));
  return h("div", { class: "home-showpiece" }, blocks);
}

/** The home page: sailcloth shell around the hero, the section grids, and the page body. */
const home: Layout = (props) => {
  const showpiece = isShowpiece(props);
  // The standard landing page starts with prose. Code can request its font from CSS.
  if (!showpiece) props.hints?.skipFontPreload("JetBrains Mono");
  return base({
    ...props,
    header: shell(props) as ComponentChildren,
    footer: footer(props) as ComponentChildren,
    main: showpiece ? showpieceContent(props) : content(props),
  });
};

export default home;
