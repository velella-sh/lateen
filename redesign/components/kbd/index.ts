import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

export const directive = "kbd";
export const CLASS_NAME = "kbd";

const kbd: Component = ({ html }) =>
  h("kbd", { class: CLASS_NAME, dangerouslySetInnerHTML: { __html: html } });

export default kbd;
