import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

export const directive = "check-list";

/** Quiet checklist matching the mockup specimens: a plain list with check marks. */
const checkList: Component = ({ html }) =>
  h("div", {
    class: "check-list",
    dangerouslySetInnerHTML: {
      __html: html
        .replace(/<ul\b/gi, '<ul class="checks"')
        .replace(/<ol\b/gi, '<ol class="checks"'),
    },
  });

export default checkList;
