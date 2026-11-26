import type { LayoutProps } from "@velella/mizzen/contracts";
import { componentProps } from "../../src/component-props.ts";
import { renderPageTool } from "../../components/page-tool/render.ts";

/** The page's own tool, after its content. */
export function pageToolSlot(layout: LayoutProps) {
  const { page, site } = layout;
  const tool = page.frontMatter.tool;
  if (typeof tool !== "string") return null;
  return renderPageTool(componentProps(layout, { base: site.config.base, tool }));
}
