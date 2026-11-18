import type { Component } from "@velella/mizzen/contracts";

/**
 * The acceptance site's replacement for `related-guides`: a string render keeps this probe free of
 * a runtime import, while the config still names a theme component the theme actually has.
 */
const relatedGuides: Component = () =>
  '<nav class="overrides-probe" aria-label="Site guides"><a href="/">Site guides</a></nav>';

export default relatedGuides;
