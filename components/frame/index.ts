import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { textOf as trimmed } from "../../src/guards.ts";

/** The Markdown directive this component handles: `:::frame`. */
export const directive = "frame";

/** Class on the `<figure>` that draws the frame; `style.css` styles it. */
export const FRAME_CLASS = "frame";

/** Class on the title bar. */
export const BAR_CLASS = "frame-bar";

/** Class on the scrolling area that holds the wrapped content. */
export const BODY_CLASS = "frame-body";

/** Class on the caption under the frame. */
export const CAPTION_CLASS = "frame-caption";

/** The attributes the directive reads. */
export const OPTIONS = ["title", "caption"] as const;

export type FrameProps = {
  /** Text in the title bar. Without it the bar has no text. */
  title?: string;
  /** Caption under the frame. */
  caption?: string;
};

function text(value: unknown): string {
  return trimmed(value) ?? "";
}

/**
 * A neutral window-style frame (a title bar, the content, a caption) around content that is already
 * rendered: a `terminal`, a `cli-demo`, a `figure` or a code block. It draws no second terminal; the
 * wrapped component keeps its own markup. Overflow scrolls inside the frame, and terminal content stays
 * left to right on a right-to-left page. A frame with no content renders nothing.
 */
export default function frame({ props, html }: ComponentProps<FrameProps>) {
  if (html.trim() === "") return null;
  const title = text(props.title);
  const caption = text(props.caption);

  return h(
    "figure",
    { class: FRAME_CLASS, "data-frame": "" },
    h("div", { class: BAR_CLASS }, title === "" ? null : h("span", { class: "frame-title" }, title)),
    h("div", {
      class: BODY_CLASS,
      tabindex: 0,
      role: "group",
      "aria-label": title === "" ? undefined : title,
      dangerouslySetInnerHTML: { __html: html },
    }),
    caption === "" ? null : h("figcaption", { class: CAPTION_CLASS }, caption),
  );
}
