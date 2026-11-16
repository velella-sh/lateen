import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** The alignments of a hero: text at the start, centred, or text beside a visual. */
export const ALIGNMENTS = ["start", "center", "split"] as const;
export type HeroAlign = (typeof ALIGNMENTS)[number];

export type HeroProps = {
  /** A short line above the title. */
  eyebrow?: string;
  /** The page's one `h1`. Falls back to the page title. */
  title?: string;
  /** One or two sentences under the title. */
  lead?: string;
  /** Buttons: `{ label, url, primary? }`. An entry without a label and a URL is dropped. */
  actions?: unknown;
  /** `start` (default), `center` or `split`. Anything else is `start`. */
  align?: string;
  /** Source position, kept as `data-src`. */
  src?: string;
};

/** The alignment to draw: the requested one when known, else `start`. */
export function alignOf(value: unknown): HeroAlign {
  return ALIGNMENTS.find((a) => a === value) ?? "start";
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * The hero of a showpiece page: an eyebrow, the page's `h1`, a lead, actions and an optional visual.
 *
 * The visual is the component's rendered HTML body (`html`); the component never adds an image or a
 * logo of its own, and without a body it draws no visual and no empty column. The source order is the
 * reading order (eyebrow, title, lead, actions, visual) in every alignment: the `split` alignment only
 * places the visual in a second column and never reorders it. The component renders the only `h1` it
 * knows of, so a page must not put another `h1` in the visual.
 */
const hero: Component<HeroProps> = ({ props, html, page }) => {
  const title = text(props.title) ?? text(page?.title);
  const eyebrow = text(props.eyebrow);
  const lead = text(props.lead);
  const src = text(props.src);
  const buttons = (Array.isArray(props.actions) ? props.actions : []).flatMap((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) return [];
    const { label, url, primary } = entry as Record<string, unknown>;
    const l = text(label);
    const u = text(url);
    if (l === undefined || u === undefined) return [];
    return [h("a", { class: primary === true ? "hero-btn hero-btn-primary" : "hero-btn hero-btn-quiet", href: u }, l)];
  });
  const hasVisual = typeof html === "string" && html.trim() !== "";
  const align = alignOf(props.align);
  // A split hero with nothing to put beside the text is a start hero.
  const shown: HeroAlign = align === "split" && !hasVisual ? "start" : align;

  return h(
    "section",
    { class: `hero hero-${shown}`, ...(src === undefined ? {} : { "data-src": src }) },
    h(
      "div",
      { class: "hero-text" },
      eyebrow === undefined ? null : h("p", { class: "hero-eyebrow" }, eyebrow),
      title === undefined ? null : h("h1", { class: "hero-title" }, title),
      lead === undefined ? null : h("p", { class: "hero-lead" }, lead),
      buttons.length === 0 ? null : h("div", { class: "hero-actions" }, buttons),
    ),
    hasVisual ? h("div", { class: "hero-visual", dangerouslySetInnerHTML: { __html: html } }) : null,
  );
};

export default hero;
