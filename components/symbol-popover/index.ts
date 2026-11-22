import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { inlinePopoverId, labelText } from "../../src/inline-popover.ts";
import { t } from "../../i18n/index.ts";

/** The Markdown directive this component handles: `::symbol-popover{name="…"}`. */
export const directive = "symbol-popover";

/** Class on the disclosure root, or on the static chip when there is nothing to disclose. */
export const SYMBOL_CLASS = "symbol-popover";

/** Class on the chip: the button that opens the panel, or the static chip's label. */
export const CHIP_CLASS = "symbol-popover-chip";

/** Class on the panel that holds the signature and the reference link. */
export const PANEL_CLASS = "symbol-popover-panel";

/** Class on the signature, shown as code text. */
export const SIGNATURE_CLASS = "symbol-popover-signature";

/** Class on the optional link to the symbol's reference page. */
export const LINK_CLASS = "symbol-popover-link";

/** Props from the directive: `::symbol-popover{name=… signature=… href=…}`. Every value is a string. */
export type SymbolPopoverProps = {
  /** The symbol name, when the directive has no inline label. */
  name?: string;
  /** The signature shown in the panel, as code text: `runExample(input: Input): Promise<Result>`. */
  signature?: string;
  /** An optional reference page: root-relative or `http`/`https`. Anything else is ignored. */
  href?: string;
};

/**
 * A URL the panel may link to: root-relative (`/reference/runner/`, but not protocol-relative
 * `//host`) or `http`/`https`. Anything else (`javascript:`, a relative path) renders no link.
 */
const SAFE_HREF = /^(?:\/(?![/\\])|https?:\/\/)[^\s"'<>\\]*$/i;

/** A prop as trimmed text; `undefined` for anything that is not a string. */
export function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The reference URL to use, or `undefined` when the prop is missing or not a safe URL. */
export function referenceHref(value: unknown): string | undefined {
  const href = textOf(value);
  return SAFE_HREF.test(href) ? href : undefined;
}

/** What a copy action takes: the signature when there is one, otherwise the name, never the reference label. */
export function copyValueOf(name: string, signature: string): string {
  return signature === "" ? name : signature;
}

/** A symbol in running text whose button opens the signature and reference link. */
const symbolPopover: Component<SymbolPopoverProps> = ({ props, html, page }) => {
  const name = textOf(props.name) || labelText(html);
  if (name === "") return null;

  const signature = textOf(props.signature);
  const href = referenceHref(props.href);
  const copyValue = copyValueOf(name, signature);

  if (signature === "" && href === undefined) {
    return h(
      "span",
      { class: `${SYMBOL_CLASS} ${CHIP_CLASS}`, "data-symbol": name, "data-copy-value": copyValue },
      name,
    );
  }

  const panelId = inlinePopoverId(page);
  return h(
    "span",
    { class: SYMBOL_CLASS, "data-symbol": name },
    h("button", { type: "button", class: CHIP_CLASS, popovertarget: panelId, "data-copy-value": copyValue }, name),
    h("span", { class: "inline-popover-fallback" }, name, " "),
    h(
      "span",
      { class: PANEL_CLASS, id: panelId, popover: "auto" },
      signature === "" ? null : h("code", { class: SIGNATURE_CLASS }, signature),
      href === undefined ? null : [" ", h("a", { class: LINK_CLASS, href }, t(page.lang, "symbol_reference"))],
    ),
  );
};

export default symbolPopover;
