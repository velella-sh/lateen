import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** Replaces the theme's callout wherever the registry resolves the name `callout`. */
const callout: Component = ({ props, html }) =>
  h("aside", { class: "site-callout", "data-kind": String(props.type ?? "note") }, h("div", { dangerouslySetInnerHTML: { __html: html } }));

export default callout;
