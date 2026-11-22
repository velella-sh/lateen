import type { LayoutProps } from "@velella/mizzen/contracts";
import pageTool from "../../components/page-tool/index.ts";

/** The page's own tool, after its content. */
export function pageToolSlot({ page, site }: LayoutProps) {
  const tool = page.frontMatter.tool;
  if (typeof tool !== "string") return null;
  return pageTool({ page, site, html: "", props: { base: site.config.base, tool } });
}
