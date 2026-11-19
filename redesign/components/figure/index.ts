import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "figure";

export type FigureProps = {
  src?: string;
  src_dark?: string;
  alt?: string;
  caption?: string;
  credit?: string;
  credit_url?: string;
  width?: string;
  height?: string;
  loading?: string;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function creditHref(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const url = value.trim();
  return /^https?:\/\//i.test(url) ? url : undefined;
}

export default function figure({ props, html }: ComponentProps<FigureProps>) {
  const src = text(props.src);
  if (!src) return null;
  const alt = text(props.alt);
  const caption = text(props.caption);
  const credit = text(props.credit);
  const href = creditHref(props.credit_url);
  const dark = text(props.src_dark);
  const paired = dark !== "" && dark !== src;

  return h(
    "figure",
    { class: paired ? "figure figure-paired" : "figure" },
    paired
      ? h(
          "div",
          { class: "figure-pair", role: "img", "aria-label": alt || undefined },
          h("img", {
            class: "figure-img figure-img-light",
            src,
            alt: "",
            loading: props.loading === "eager" ? "eager" : "lazy",
            decoding: "async",
            ...(props.width ? { width: props.width } : {}),
            ...(props.height ? { height: props.height } : {}),
          }),
          h("img", {
            class: "figure-img figure-img-dark",
            src: dark,
            alt: "",
            loading: props.loading === "eager" ? "eager" : "lazy",
            decoding: "async",
            ...(props.width ? { width: props.width } : {}),
            ...(props.height ? { height: props.height } : {}),
          }),
        )
      : h("img", {
          class: "figure-img",
          src,
          alt,
          loading: props.loading === "eager" ? "eager" : "lazy",
          decoding: "async",
          ...(props.width ? { width: props.width } : {}),
          ...(props.height ? { height: props.height } : {}),
        }),
    caption || credit || html
      ? h(
          "figcaption",
          { class: "figure-caption" },
          caption
            ? h("div", { class: "figure-text" }, caption)
            : html
              ? h("div", { class: "figure-text", dangerouslySetInnerHTML: { __html: html } })
              : null,
          credit
            ? href
              ? h("a", { class: "figure-credit", href }, credit)
              : h("span", { class: "figure-credit" }, credit)
            : null,
        )
      : null,
  );
}
