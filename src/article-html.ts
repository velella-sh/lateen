import { JSDOM } from "jsdom";
import { REGION_ATTRIBUTE, WRAPPER_CLASS } from "../components/table/index.ts";

/** Keep the table display and its header relationships while the outer box scrolls. */
export function articleHtml(html: string): string {
  if (!/<table[\s>]/i.test(html)) return html;

  const fragment = JSDOM.fragment(html);
  const tables = Array.from(fragment.querySelectorAll("table:not([class]), table[class='table']"))
    .filter((table) => table.closest(`.${WRAPPER_CLASS}`) === null);
  if (tables.length === 0) return html;

  const container = fragment.ownerDocument.createElement("div");
  for (const table of tables) {
    const scroll = container.ownerDocument.createElement("div");
    scroll.className = `${WRAPPER_CLASS} markdown-table-scroll`;
    scroll.setAttribute(REGION_ATTRIBUTE, "");
    scroll.tabIndex = 0;
    const caption = table.querySelector(":scope > caption")?.textContent?.trim();
    if (caption) {
      scroll.setAttribute("role", "region");
      scroll.setAttribute("aria-label", caption);
    }
    table.replaceWith(scroll);
    scroll.append(table);
  }
  container.append(fragment);
  return container.innerHTML;
}
