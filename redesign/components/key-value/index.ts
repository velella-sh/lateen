import { h } from "preact";
import type { ComponentProps } from "@velella/mizzen/contracts";

export const directive = "key-value";
export const LIST_CLASS = "key-value kv";

export type KeyValueItem = { readonly key: string; readonly value: unknown };

export type KeyValueProps = { items?: string };

const ENTITIES: Readonly<Record<string, string>> = { amp: "&", apos: "'", gt: ">", lt: "<", quot: '"' };

function decodeText(text: string): string {
  return text.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z][a-z0-9]*));/gi,
    (match, hex: string | undefined, decimal: string | undefined, named: string | undefined) => {
      if (named !== undefined) return ENTITIES[named.toLowerCase()] ?? match;
      const code = hex !== undefined ? Number.parseInt(hex, 16) : Number.parseInt(decimal ?? "", 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    },
  );
}

export function parseItems(raw: unknown): KeyValueItem[] {
  let value: unknown = raw;
  if (typeof raw === "string") {
    if (raw.trim() === "") return [];
    try {
      value = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (Array.isArray(entry)) {
      const key = String(entry[0] ?? "").trim();
      return key ? [{ key, value: entry[1] ?? "" }] : [];
    }
    if (typeof entry === "object" && entry !== null) {
      const record = entry as Readonly<Record<string, unknown>>;
      const key = typeof record.key === "string" ? record.key.trim() : "";
      return key ? [{ key, value: record.value ?? "" }] : [];
    }
    return [];
  });
}

export function parseBody(html: string): KeyValueItem[] {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|dt|dd|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, "");
  const items: KeyValueItem[] = [];
  for (const line of decodeText(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const value = trimmed.slice(colon + 1).trim();
    if (key) items.push({ key, value });
  }
  return items;
}

export function displayOf(value: unknown): string {
  return typeof value === "string" ? value : (JSON.stringify(value) ?? String(value));
}

export default function keyValue({ props, html }: ComponentProps<KeyValueProps>) {
  const fromProps = parseItems(props.items);
  const items = fromProps.length > 0 ? fromProps : parseBody(html);
  if (items.length === 0) return null;
  return h(
    "dl",
    { class: LIST_CLASS },
    items.flatMap((item) => [
      h("dt", { class: "key-value-key" }, item.key),
      h("dd", { class: "key-value-value" }, displayOf(item.value)),
    ]),
  );
}
