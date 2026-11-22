import { h } from "preact";
import type { ScriptTag } from "@velella/mizzen/contracts";

export function deferredScript({ src, attrs = {} }: ScriptTag) {
  const names = Object.keys(attrs).sort();
  const extras = names.filter((name) => !/^(?:defer|src)$/i.test(name));
  return h("script", { defer: true, src, ...Object.fromEntries(extras.map((name) => [name, attrs[name]])) });
}
