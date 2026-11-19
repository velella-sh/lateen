import { h } from "preact";
import type { Component } from "@velella/mizzen/contracts";

export const directive = "reading-time";

export type ReadingTimeProps = {
  minutes?: string | number;
  words?: string | number;
  showWords?: string | number | boolean;
};

function countFrom(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? Math.trunc(value) : undefined;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : undefined;
  }
  return undefined;
}

function showWordsOf(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === "string") {
    return !["false", "no", "0", "off"].includes(value.trim().toLowerCase());
  }
  return true;
}

const readingTime: Component<ReadingTimeProps> = ({ props }) => {
  const minutes = countFrom(props.minutes);
  if (minutes === undefined || minutes === 0) return null;
  const words = countFrom(props.words);
  const showWords = showWordsOf(props.showWords);
  return h(
    "p",
    {
      class: "reading-time pill",
      "data-minutes": String(minutes),
      ...(showWords && words !== undefined ? { "data-words": String(words) } : {}),
    },
    h("span", { class: "reading-time-minutes" }, `${minutes} min read`),
    showWords && words !== undefined
      ? h("span", { class: "reading-time-words" }, ` · ${words} words`)
      : null,
  );
};

export default readingTime;
