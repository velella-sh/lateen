import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** The looks a backdrop can have. `none` draws nothing. */
export const VARIANTS = ["glow", "grid", "none"] as const;

export type BackdropVariant = (typeof VARIANTS)[number];

/** The variant used when none is given or the value is not one of `VARIANTS`. */
export const DEFAULT_VARIANT: BackdropVariant = "glow";

export type BackdropProps = {
  /** `glow`, `grid` or `none`; anything else is dropped and the default is used. */
  variant?: string | undefined;
};

/** The variant to draw: the requested one when it is known, otherwise the default. */
export function variantOf(value: unknown): BackdropVariant {
  return typeof value === "string" && (VARIANTS as readonly string[]).includes(value)
    ? (value as BackdropVariant)
    : DEFAULT_VARIANT;
}

/**
 * Decoration for the area behind a hero: a soft glow or a faint grid, both drawn by CSS from the
 * accent token, so there is no image file, no script and no animation. It has no content, so it is
 * hidden from assistive technology. `none` renders nothing, which leaves a plain canvas.
 *
 * The element is positioned over its nearest positioned ancestor and sits behind that ancestor's
 * content; the host should be `position: relative; isolation: isolate`.
 */
const backdrop: Component<BackdropProps> = ({ props }) => {
  const variant = variantOf(props?.variant);
  if (variant === "none") return null;
  return h("div", { class: `backdrop backdrop-${variant}`, "aria-hidden": "true" });
};

export default backdrop;
