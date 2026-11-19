import type { ComponentChildren } from "preact";
import type { SiteConfig } from "@velella/mizzen/contracts";
import { card, hrefOf } from "../cards/index.ts";
import { optionOf } from "../../src/options.ts";
import { withBase } from "../../src/url.ts";

/** Class on the site's own card, so a gallery can mark it apart from the records. */
export const ADD_CLASS = "gallery-card-add";

/** The `addCard` option as the config writes it. */
interface AddCardOptions {
  readonly label?: unknown;
  readonly link?: unknown;
}

/**
 * The gallery's own "add yours" card from `theme.options.gallery.addCard`, or undefined when the
 * site sets no option. The card keeps the record cards' shape; only a safe link (https or
 * root-relative, as the cards accept) and a non-blank label render it.
 */
export function addCardOf(config: SiteConfig): ComponentChildren {
  const gallery = optionOf(config.theme.options, "gallery");
  if (gallery === null || typeof gallery !== "object") return undefined;

  const add = (gallery as Readonly<Record<string, unknown>>).addCard as AddCardOptions | undefined;
  if (add === null || typeof add !== "object") return undefined;

  const label = typeof add.label === "string" ? add.label.trim() : "";
  const link = typeof add.link === "string" ? add.link.trim() : "";
  if (label === "" || hrefOf(link) === undefined) return undefined;

  return card({ href: withBase(config.base.replace(/\/+$/, ""), link), title: label, class: ADD_CLASS });
}
