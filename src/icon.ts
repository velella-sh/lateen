import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import {
  ArrowRight,
  CalendarPlus,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  File,
  Folder,
  GitBranch,
  Info,
  Lightbulb,
  Link,
  Menu,
  Minus,
  Moon,
  OctagonAlert,
  Pencil,
  Rss,
  Search,
  Sun,
  Terminal,
  TriangleAlert,
  X,
} from "lucide";
import type { IconNode } from "lucide";

export function icon({ node, class: className }: { node: IconNode; class?: string }) {
  return h(
    "svg",
    {
      class: className,
      xmlns: "http://www.w3.org/2000/svg",
      width: 24,
      height: 24,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 2,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      "aria-hidden": "true",
      focusable: "false",
    },
    node.map(([tag, attrs]) => h(tag, attrs)),
  );
}

export function iconHtml(options: Parameters<typeof icon>[0]): string {
  return renderToString(icon(options));
}

const ICONS = {
  search: Search,
  menu: Menu,
  close: X,
  chevron: ChevronRight,
  copy: Copy,
  check: Check,
  external: ExternalLink,
  edit: Pencil,
  sun: Sun,
  moon: Moon,
  github: GitBranch,
  info: Info,
  warning: TriangleAlert,
  danger: OctagonAlert,
  tip: Lightbulb,
  link: Link,
  file: File,
  folder: Folder,
  terminal: Terminal,
  arrow: ArrowRight,
  minus: Minus,
  feed: Rss,
  calendarPlus: CalendarPlus,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export function iconByName(name: unknown): IconNode | undefined {
  if (typeof name !== "string" || !Object.hasOwn(ICONS, name)) return undefined;
  return ICONS[name as IconName];
}
