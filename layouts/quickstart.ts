import type { Layout } from "@velella/mizzen/contracts";
import doc from "./doc.ts";

const quickstart: Layout = (props) =>
  doc({
    ...props,
    page: {
      ...props.page,
      frontMatter: { ...props.page.frontMatter, quickstart: true },
    },
  });

export default quickstart;
