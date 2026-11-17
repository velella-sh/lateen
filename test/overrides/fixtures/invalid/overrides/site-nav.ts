import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** A valid component module under a name the theme does not have; the name is the error. */
const siteNav: Component = () => h("nav", { class: "site-nav" }, h("a", { href: "/" }, "Home"));

export default siteNav;
