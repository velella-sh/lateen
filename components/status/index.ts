import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { check, danger, info, minus, warning } from "../../icons/index.ts";

/** The Markdown directive this component handles: `:status[Done]{tone=positive}`. */
export const directive = "status";

/** The five tones of a status; each has colour tokens `--status-<tone>-fg|bg|border`. */
export const TONES = ["positive", "caution", "negative", "neutral", "info"] as const;

export type StatusTone = (typeof TONES)[number];

/** Used when the tone is missing or unknown. */
export const DEFAULT_TONE: StatusTone = "neutral";

/** One icon per tone, so tones differ by shape and text as well as by colour. */
export const ICONS: Readonly<Record<StatusTone, string>> = {
  positive: check,
  caution: warning,
  negative: danger,
  neutral: minus,
  info: info,
};

/** Props from the directive: `:status[Done]{tone=positive}`. */
export type StatusProps = {
  tone?: string;
  /** Text shown when the directive has no body. */
  label?: string;
  /** Source position, kept as `data-src`. */
  src?: string;
};

/** The tone to render: the given one (trimmed, case-insensitive) when known, otherwise {@link DEFAULT_TONE}. */
export function toneOf(value: unknown): StatusTone {
  if (typeof value !== "string") return DEFAULT_TONE;
  const tone = value.trim().toLowerCase();
  return (TONES as readonly string[]).includes(tone) ? (tone as StatusTone) : DEFAULT_TONE;
}

/** Class names of a status: `status` plus `status-<tone>`. */
export function classNameOf(tone: StatusTone): string {
  return `status status-${tone}`;
}

/**
 * A small label with a tone's colours and icon. The icon is hidden from assistive technology: the
 * text carries the meaning.
 */
const status: Component<StatusProps> = ({ props, html }) => {
  const tone = toneOf(props.tone);
  const src = typeof props.src === "string" && props.src !== "" ? props.src : undefined;
  const label =
    html === ""
      ? h("span", { class: "status-label" }, props.label ?? "")
      : h("span", { class: "status-label", dangerouslySetInnerHTML: { __html: html } });
  return h(
    "span",
    { class: classNameOf(tone), "data-tone": tone, ...(src === undefined ? {} : { "data-src": src }) },
    h("span", { class: "status-icon", "aria-hidden": "true", dangerouslySetInnerHTML: { __html: ICONS[tone] } }),
    label,
  );
};

export default status;
