import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { Moon, Sun } from "lucide";
import { icon as lucideIcon } from "../../src/icon.ts";
import type { ThemeChoice } from "./key.ts";

const LABEL = "Color theme";

function icon(value: ThemeChoice) {
  return lucideIcon({ node: value === "light" ? Sun : Moon, class: `theme-toggle-icon theme-toggle-icon-${value}` });
}

/**
 * The theme switch: one icon button that shows the current choice and cycles to the next on a click,
 * Space, or Enter (a native button gives all three). Hidden until `client.ts` runs, so a visitor without
 * JavaScript never sees a control that would do nothing. The `role=status` region sits beside the button,
 * not inside it, and is where `client.ts` announces every change.
 */
const themeToggle: Chrome = () =>
  h(
    "span",
    { class: "theme-toggle", "data-theme-toggle": true, hidden: true },
    h(
      "button",
      { class: "iconbtn theme-toggle-button", type: "button", "aria-label": LABEL },
      icon("light"),
      icon("dark"),
    ),
    h("span", { class: "theme-toggle-status", role: "status" }, ""),
  );

export default themeToggle;
