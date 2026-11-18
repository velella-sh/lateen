/** Text escaped for an HTML element or a quoted attribute value. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/**
 * `text` with entities decoded (named, decimal, and hexadecimal). A number that is no code point is
 * left as written.
 */
export function decodeEntities(text: string): string {
  return text.replace(/&(?:(amp|lt|gt|quot|apos)|#x([0-9a-f]+)|#(\d+));/gi, (m, name?: string, hex?: string, dec?: string) => {
    if (name) return ENTITIES[name.toLowerCase()] ?? m;
    const point = hex ? parseInt(hex, 16) : Number(dec);
    return point <= 0x10ffff ? String.fromCodePoint(point) : m;
  });
}
