import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { textOf } from "../../src/guards.ts";
import installTabs, { commandFor, idBase, managersOf, packageOf } from "../install-tabs/index.ts";
import { hrefOf, withBase } from "../link-card/index.ts";

/** The Markdown directive this component handles: `::cta-band{title="…" label="…" url="/start/"}`. */
export const directive = "cta-band";

/** Class on the band; `client.ts` and `style.css` use it. */
export const CTA_BAND_CLASS = "cta-band";

/** Attribute on the one copy button; `client.ts` finds it by this. */
export const COPY_ATTRIBUTE = "data-cta-copy";

/** The attributes the directive reads. The docs page lists exactly these, and a test keeps them in step. */
export const OPTIONS = ["title", "lead", "label", "url", "package", "id"] as const;

export type CtaBandProps = {
  /** The heading. */
  title?: string;
  /** One line of text under the heading. */
  lead?: string;
  /** The primary action's text. It needs a `url` too. */
  label?: string;
  /** Where the primary action goes: a path on this site, or an `http`/`https` address. */
  url?: string;
  /** The package for the optional install command, shown through `install-tabs`. */
  package?: string;
  /** Prefix for the install tabs' element ids. */
  id?: string;
};

/**
 * A closing call to action: a heading, a line of text, one primary action, and an optional install command.
 * The action comes first in the markup, so it is first in the reading and tab order; the command follows. The
 * command is the `install-tabs` component, and the one copy button is the code copy control (`client.ts`
 * wires it; it starts `hidden`). With neither a usable action nor a command nothing is drawn. Every word comes
 * from the props; nothing is invented.
 */
export default function ctaBand(input: ComponentProps<CtaBandProps>) {
  const { props, page, site } = input;
  const title = textOf(props.title);
  const lead = textOf(props.lead);
  const label = textOf(props.label);
  const url = hrefOf(props.url);
  const pkg = textOf(props.package);
  const lang = page.lang;
  const hasAction = label !== undefined && url !== undefined;
  if (!hasAction && pkg === undefined) return null;

  const base = (site as { config?: { base?: string } } | undefined)?.config?.base ?? "";
  const managers = managersOf(site?.config);
  const idPrefix = idBase(`${typeof props.id === "string" && props.id !== "" ? props.id : "cta-band"}`);
  const command =
    pkg === undefined
      ? null
      : h(
          "div",
          { class: "cta-band-command" },
          installTabs({ ...input, props: { package: pkg, id: `${idPrefix}-install` }, html: "" } as never),
          h(
            "button",
            {
              type: "button",
              class: "cta-band-copy",
              hidden: true,
              [COPY_ATTRIBUTE]: "",
              "data-commands": commandFor(managers[0]!, packageOf({ package: pkg }, "")),
              "data-copied": t(lang, "copied"),
              "data-copy-failed": t(lang, "copy_failed_select"),
            },
            t(lang, "copy"),
          ),
          h("span", { class: "cta-band-copy-status", role: "status" }),
        );

  return h(
    "section",
    { class: CTA_BAND_CLASS },
    title === undefined ? null : h("h2", { class: "cta-band-title" }, title),
    lead === undefined ? null : h("p", { class: "cta-band-lead" }, lead),
    hasAction ? h("a", { class: "cta-band-action", href: withBase(base, url) }, label) : null,
    command,
  );
}
