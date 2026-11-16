import { Fragment, h } from "preact";
import type { ComponentChildren } from "preact";
import type { ComponentProps, Layout, LayoutProps } from "@velella/mizzen/contracts";
import drawer from "../chrome/drawer/index.ts";
import header from "../chrome/header/index.ts";
import backdrop from "../components/backdrop/index.ts";
import ctaBand from "../components/cta-band/index.ts";
import featureGrid from "../components/feature-grid/index.ts";
import frame from "../components/frame/index.ts";
import hero from "../components/hero/index.ts";
import motif from "../components/motif/index.ts";
import statStrip from "../components/stat-strip/index.ts";
import base from "./base.ts";

/**
 * The docs home, following `docs/design/mockups/home.html`. Everything comes from the page's front
 * matter and body:
 *
 * - `hero: { eyebrow, title, lead }` — the eyebrow pill, the `h1` (falling back to the page title),
 *   and the one-line description.
 * - `actions: [{ label, url, primary }]` — the call-to-action buttons; `primary: true` fills the
 *   button and adds the arrow.
 * - `sections: [{ title, url, description, icon, links }]` — the card grids, where each entry is a
 *   card with a heading (linked when it has a URL), a description, and a list of links with a
 *   right-aligned `meta` note. `icon` is the path data of a 24×24 stroke icon.
 *
 * The page body renders after the hero and the section grids. Values that do not match the shape
 * above are dropped, never a broken page.
 *
 * Showpiece style: `home: { style: showpiece }` recomposes the page from the showpiece components, in
 * this order, each left out when it has no data (see `docs/design/showpiece.md`):
 *
 * 1. hero (`hero`, `actions`), over a backdrop (`home.backdrop`: `glow`, `grid` or `none`) and an
 *    optional motif (`home.motif`: the seed text);
 * 2. stat strip (`stats: [{ value, label, url }]`);
 * 3. feature grid (`features: [{ title, description, icon, url }]`, else the `sections` entries);
 * 4. framed demo (`demo: { title, caption }`): the frame wraps the page body, which then is not
 *    drawn a second time;
 * 5. call to action (`cta: { title, lead, package, actions }`): the first action with a label and a
 *    URL is the band's action.
 *
 * Any other value of `home.style`, or none, is the layout above, unchanged.
 */

/** An arrow pointing toward the reading direction; `style.css` mirrors it under `dir="rtl"`. */
function arrow() {
  return h(
    "svg",
    { class: "home-arrow", viewBox: "0 0 24 24", "aria-hidden": "true", focusable: "false" },
    h("path", { d: "M5 12h14M13 6l6 6-6 6" }),
  );
}

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

/** One action: the author's label and URL; `primary: true` gets the filled button and the arrow. */
function actionLink(fields: Readonly<Record<string, unknown>>): ComponentChildren {
  const label = stringAt(fields, "label");
  const url = stringAt(fields, "url");
  if (label === undefined || url === undefined) return null;
  return h(
    "a",
    { class: fields.primary === true ? "home-btn home-btn-primary" : "home-btn home-btn-quiet", href: url },
    label,
    fields.primary === true ? arrow() : null,
  );
}

/** The hero: the eyebrow pill, the title, the one-line description, and the action buttons. */
function heroBlock(props: LayoutProps): ComponentChildren {
  const hero = props.page.frontMatter.hero;
  const fields = isRecord(hero) ? hero : {};
  const eyebrow = stringAt(fields, "eyebrow");
  const lead = stringAt(fields, "lead");
  const title = stringAt(fields, "title") ?? props.page.title;

  const buttons: ComponentChildren[] = [];
  for (const action of recordsOf(props.page.frontMatter.actions)) {
    const button = actionLink(action);
    if (button !== null) buttons.push(button);
  }

  return h(
    "div",
    { class: "home-hero" },
    eyebrow === undefined ? null : h("p", { class: "home-eyebrow" }, h("i", { "aria-hidden": "true" }), eyebrow),
    h("h1", { class: "home-title" }, title),
    lead === undefined ? null : h("p", { class: "home-lead" }, lead),
    buttons.length === 0 ? null : h("div", { class: "home-actions" }, buttons),
  );
}

/** One section card: a heading (linked when it has a URL), a description, and a list of links. */
function sectionBlock(fields: Readonly<Record<string, unknown>>): ComponentChildren {
  const title = stringAt(fields, "title");
  if (title === undefined) return null;
  const url = stringAt(fields, "url");
  const description = stringAt(fields, "description");
  const icon = stringAt(fields, "icon");

  const items: ComponentChildren[] = [];
  for (const link of recordsOf(fields.links)) {
    const linkTitle = stringAt(link, "title");
    const linkUrl = stringAt(link, "url");
    if (linkTitle === undefined || linkUrl === undefined) continue;
    const meta = stringAt(link, "meta");
    items.push(
      h(
        "li",
        null,
        h("a", { href: linkUrl }, h("span", null, linkTitle), meta === undefined ? null : h("span", { class: "home-link-meta" }, meta)),
      ),
    );
  }

  return h(
    "div",
    { class: "home-section" },
    h(
      "h2",
      { class: "home-section-title" },
      icon === undefined
        ? null
        : h("span", { class: "home-section-icon", "aria-hidden": "true" }, h("svg", { viewBox: "0 0 24 24", focusable: "false" }, h("path", { d: icon }))),
      url === undefined ? title : h("a", { href: url }, title),
    ),
    description === undefined ? null : h("p", { class: "home-section-description" }, description),
    items.length === 0 ? null : h("ul", { class: "home-section-links" }, items),
  );
}

/** The home content: the hero, the section card grids, then the page body. */
function content(props: LayoutProps): ComponentChildren {
  const blocks: ComponentChildren[] = [heroBlock(props)];

  const cards = recordsOf(props.page.frontMatter.sections).map(sectionBlock).filter((card) => card !== null);
  if (cards.length > 0) blocks.push(h("div", { class: "home-sections" }, cards));

  if (props.page.html.length > 0) blocks.push(h("div", { dangerouslySetInnerHTML: { __html: props.page.html } }));
  return blocks;
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

  const seed = stringAt(options, "motif");
  blocks.push(
    h(
      "div",
      { class: "home-showpiece-hero" },
      call(backdrop, { ...shared, props: defined({ variant: stringAt(options, "backdrop") }) }),
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

/** The home page: the base document shell around the hero, the section grids, and the page body. */
const home: Layout = (props) =>
  base({
    ...props,
    header: h(Fragment, null, header(props) as ComponentChildren, drawer(props) as ComponentChildren),
    main: isShowpiece(props) ? showpieceContent(props) : content(props),
  });

export default home;
