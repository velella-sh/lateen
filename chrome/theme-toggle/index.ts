import { h } from "preact";
import type { Chrome } from "@velella/mizzen/contracts";
import { Monitor, Moon, Sun } from "lucide";
import type { IconNode } from "lucide";
import { icon as lucideIcon } from "../../src/icon.ts";

const LABEL = "Color theme";

/** The three choices, in the order a press cycles through them; `client.ts` stores them verbatim. */
const OPTIONS = [{ value: "light" }, { value: "system" }, { value: "dark" }] as const;

/** The icon drawn for each choice: a sun, a screen, and a moon. */
function icon(value: (typeof OPTIONS)[number]["value"]) {
  const nodes: Record<(typeof OPTIONS)[number]["value"], IconNode> = { light: Sun, system: Monitor, dark: Moon };
  return lucideIcon({ node: nodes[value], class: `theme-toggle-icon theme-toggle-icon-${value}` });
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
      { class: "theme-toggle-button", type: "button", "aria-label": LABEL },
      ...OPTIONS.map((option) => icon(option.value)),
    ),
    h("span", { class: "theme-toggle-status", role: "status" }, ""),
  );

export default themeToggle;
