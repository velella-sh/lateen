import type { Layout } from "@velella/mizzen/contracts";
import { renderDoc } from "./shared/doc.ts";

const quickstart: Layout = (props) =>
  renderDoc({
    ...props,
    page: {
      ...props.page,
      frontMatter: { ...props.page.frontMatter, quickstart: true },
    },
  });

export default quickstart;
