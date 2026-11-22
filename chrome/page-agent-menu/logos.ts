import { h, type VNode } from "preact";

/*
 * Small marks for the agents the menu offers by default. They are simplified drawings in a 24×24
 * box, not the vendors' artwork files, so the menu ships no remote image and no brand asset. A
 * provider the site adds itself has no mark and shows its title alone.
 */

const MARKS: Readonly<Record<string, () => VNode>> = {
  // A burst of rays, in the warm color the Claude product uses.
  claude: () =>
    h(
      "g",
      { stroke: "#d97757", "stroke-width": 2.4, "stroke-linecap": "round" },
      ...[0, 45, 90, 135].map((deg) =>
        h("line", { x1: 12, y1: 3.5, x2: 12, y2: 20.5, transform: `rotate(${deg} 12 12)` }),
      ),
    ),
  // A hexagonal knot: the outline plus three strokes that cross inside it.
  chatgpt: () =>
    h(
      "g",
      { stroke: "currentColor", "stroke-width": 1.8, "stroke-linejoin": "round", "stroke-linecap": "round", fill: "none" },
      h("path", { d: "M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z" }),
      h("path", { d: "M12 2.8v9.2l8 4.6M12 12l-8 4.6M4 7.4l8 4.6 8-4.6" }),
    ),
  // An isometric cube with its front corner cut by a pointer.
  cursor: () =>
    h(
      "g",
      { stroke: "currentColor", "stroke-width": 1.8, "stroke-linejoin": "round", "stroke-linecap": "round", fill: "none" },
      h("path", { d: "M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4z" }),
      h("path", { d: "M4 7.4 20 16.6M12 2.8v18.4M20 7.4 4 16.6", "stroke-opacity": 0 }),
      h("path", { d: "M4 7.4h16L12 21.2z", fill: "currentColor", "fill-opacity": 0.18 }),
    ),
};

/** The mark for a provider title, or `null` when the menu has none for it. */
export function providerLogo(title: string): VNode | null {
  const mark = MARKS[title.trim().toLowerCase().replace(/\s+/g, "")];
  if (mark === undefined) return null;
  return h(
    "svg",
    {
      class: "page-agent-menu-logo",
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      width: 16,
      height: 16,
      "aria-hidden": "true",
      focusable: "false",
    },
    mark(),
  );
}
