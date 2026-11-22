import type { LayoutProps } from "@velella/mizzen/contracts";
import { renderPageTool } from "../../components/page-tool/render.ts";

/** The page's own tool, after its content. */
export function pageToolSlot({ page, site }: LayoutProps) {
  const tool = page.frontMatter.tool;
  if (typeof tool !== "string") return null;
  return renderPageTool({ page, site, html: "", props: { base: site.config.base, tool } });
}
