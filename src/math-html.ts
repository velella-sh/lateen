import { JSDOM } from "jsdom";
import { t } from "../i18n/index.ts";

/** Give each block equation a keyboard-reachable scroll box while keeping the MathML intact. */
export function mathHtml(html: string, lang: string): string {
  if (!/<math\b[^>]*\bdisplay\s*=\s*["']block["']/i.test(html)) return html;

  const fragment = JSDOM.fragment(html);
  const blocks = [...fragment.querySelectorAll('math[display="block"]')]
    .filter((math) => math.closest(".math-scroll") === null);
  if (blocks.length === 0) return html;

  const container = fragment.ownerDocument.createElement("div");
  for (const math of blocks) {
    const scroll = fragment.ownerDocument.createElement("div");
    scroll.className = "math-scroll";
    scroll.dir = "ltr";
    scroll.tabIndex = 0;
    scroll.setAttribute("role", "region");
    scroll.setAttribute("aria-label", t(lang, "math_equation"));
    math.replaceWith(scroll);
    scroll.append(math);
  }

  container.append(fragment);
  return container.innerHTML;
}
