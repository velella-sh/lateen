import { h } from "preact";
import type { LayoutProps } from "@velella/mizzen/contracts";
import { t } from "../../i18n/index.ts";
import { safeHref } from "../../src/url.ts";

export function previewBanner({ site, page, head }: LayoutProps) {
  const preview = site.preview;
  if (preview === undefined) return null;

  const canonical = head.links.find((link) => link.rel === "canonical");
  const href = safeHref(canonical?.href ?? `${preview.canonicalBase.replace(/\/+$/, "")}${page.url}`);
  const commit = preview.commit?.slice(0, 7);
  return h(
    "p",
    { class: "preview-banner", role: "note" },
    t(page.lang, "preview_build"),
    commit ? [" ", h("bdi", { dir: "ltr" }, commit)] : null,
    href === undefined ? null : [" ", h("a", { href }, t(page.lang, "preview_canonical"))],
  );
}
