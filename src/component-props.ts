import type { ComponentProps, LayoutProps } from "@velella/mizzen/contracts";

/** What a unit needs from the page it is drawing: a layout's props or a component's props both have it. */
type PageSource = Pick<LayoutProps, "page" | "site" | "renderComponent">;

/**
 * The props for calling another unit's renderer directly (a shared `render.ts`, or a component a layout
 * places in a slot). It carries the page's own `renderComponent`, so a nested unit can still render the
 * registry's components by name, and marks the call as block content, not a text directive.
 */
export function componentProps<P extends Readonly<Record<string, unknown>>>(
  source: PageSource,
  props: P,
  html = "",
): ComponentProps<P> {
  return { props, page: source.page, site: source.site, html, inline: false, renderComponent: source.renderComponent };
}
