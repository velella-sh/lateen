import { h } from "preact";
import { isRecord } from "../../src/guards.ts";
import type { ComponentProps, SiteConfig } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { optionOf } from "../../src/options.ts";
import { bodyText } from "../terminal/index.ts";

/** The Markdown directive this component handles: `:::install-tabs`. */
export const directive = "install-tabs";

/** Class on the outer element; `client.ts` finds it by `data-install-tabs`. */
export const INSTALL_TABS_CLASS = "install-tabs";

/** The most managers one group shows. */
export const MAX_MANAGERS = 8;

/** Id prefix used when the directive gives none. */
export const DEFAULT_ID = "install-tabs";

/** The one manager shipped when the site sets none. It is a starting point, not a list of managers. */
export const GENERIC_MANAGER: PackageManager = { name: "npm", command: "npm install {package}" };

/** Where a command puts the package name. */
export const PLACEHOLDER = "{package}";

/** One package manager the site offers. */
export interface PackageManager {
  /** The tab label. */
  readonly name: string;
  /** The install command; `{package}` is replaced by the package name. */
  readonly command: string;
}

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = ["package", "id"] as const;

/** The site option the managers come from, under `theme.options`. The docs page lists it. */
export const SITE_OPTION = "installTabs.managers";

export type InstallTabsProps = {
  /** The package to install. Without it, the first line of the body is used. */
  package?: string;
  /** Prefix for this group's element ids. Give each group on a page its own id. */
  id?: string;
};

/**
 * The managers from `theme.options.installTabs.managers`. An entry needs a `name` and a `command` that are
 * non-empty text; anything else, and a repeated name, is skipped. When the option is missing or holds no usable
 * entry, the one generic manager is returned.
 */
export function managersOf(config: Pick<SiteConfig, "theme"> | undefined): PackageManager[] {
  const options = optionOf(config?.theme?.options, "installTabs");
  const list = isRecord(options) ? options.managers : undefined;
  const found: PackageManager[] = [];
  if (Array.isArray(list)) {
    for (const entry of list as unknown[]) {
      if (!isRecord(entry)) continue;
      const name = typeof entry.name === "string" ? entry.name.trim() : "";
      const command = typeof entry.command === "string" ? entry.command.trim() : "";
      if (name === "" || command === "" || found.some((m) => m.name === name)) continue;
      found.push({ name, command });
      if (found.length === MAX_MANAGERS) break;
    }
  }
  return found.length > 0 ? found : [GENERIC_MANAGER];
}

/** The command with the package name in place of every `{package}`. A command without one is shown as written. */
export function commandFor(manager: PackageManager, pkg: string): string {
  return manager.command.split(PLACEHOLDER).join(pkg);
}

/** The id prefix, reduced to letters, digits, `-` and `_` so a prop cannot break the markup. */
export function idBase(raw: string | undefined): string {
  const clean = (raw ?? "").trim().replace(/[^\p{L}\p{N}_-]+/gu, "-").replace(/^-+|-+$/g, "");
  return clean || DEFAULT_ID;
}

/** The package name: the `package` prop, else the first line of the body. */
export function packageOf(props: InstallTabsProps, html: string): string {
  const prop = typeof props.package === "string" ? props.package.trim() : "";
  if (prop !== "") return prop;
  return bodyText(html).split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

/**
 * One install command for several package managers. Every panel is in the HTML, and the tabs are radio
 * buttons that `style.css` switches by `:checked`, so the choice works without JavaScript. The island only
 * remembers the reader's choice. The commands are text; nothing is run or fetched.
 */
export default function installTabs({ props, html, page, site }: ComponentProps<InstallTabsProps>) {
  const base = idBase(typeof props.id === "string" ? props.id : undefined);
  const managers = managersOf(site?.config);
  const pkg = packageOf(props, html);
  const lang = page.lang;

  const panel = (manager: PackageManager) =>
    h(
      "div",
      { class: "install-tabs-panel", "data-manager": manager.name },
      h("pre", { class: "install-tabs-code", tabindex: 0 }, h("code", {}, commandFor(manager, pkg))),
    );

  if (managers.length === 1) {
    return h("div", { class: INSTALL_TABS_CLASS, "data-install-tabs": "", "data-single": "" }, panel(managers[0]!));
  }

  // Each radio sits in its label, and that label sits immediately before its panel, so one
  // `:checked +` rule shows the command. Flex order keeps every pill on the first row.
  const rows = managers.flatMap((manager, i) => [
    h(
      "label",
      { class: "install-tabs-tab" },
      h("input", {
        type: "radio",
        class: "install-tabs-radio",
        name: base,
        id: `${base}-${i + 1}`,
        value: manager.name,
        "data-manager": manager.name,
        ...(i === 0 ? { checked: true } : {}),
      }),
      manager.name,
    ),
    panel(manager),
  ]);

  return h(
    "div",
    { class: INSTALL_TABS_CLASS, "data-install-tabs": "", role: "radiogroup", "aria-label": t(lang, "install_tabs_label") },
    rows,
  );
}
