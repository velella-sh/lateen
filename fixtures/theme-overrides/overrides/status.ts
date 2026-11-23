import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** Replaces the theme's status, a component the list and record layouts draw internally. */
const status: Component = ({ props, html }) =>
  h("span", { class: "site-status", "data-tone": String(props.tone ?? "neutral") }, props.label === undefined ? h("span", { dangerouslySetInnerHTML: { __html: html } }) : String(props.label));

export default status;
