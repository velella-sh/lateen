import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** Replaces a content component that no layout uses. */
const kbd: Component = ({ html }) => h("kbd", { class: "site-kbd", dangerouslySetInnerHTML: { __html: html } });

export default kbd;
