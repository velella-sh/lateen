import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";

const collectionApiSchema: Component<{ index: string; schema: string }> = ({ page, props }) =>
  h("li", { hidden: true, "data-api-index": props.index, "data-api-schema": props.schema },
    h("a", null, t(page.lang, "data_api_schema")));

export default collectionApiSchema;
