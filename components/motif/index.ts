import { h, type ComponentChild } from "preact";
import type { Component } from "@velella/mizzen/contracts";

/** The Markdown directive this component handles: `::motif{seed="home" pattern="contours"}`. */
export const directive = "motif";

/** The patterns a motif can draw. */
export const PATTERNS = ["contours", "dots", "grid"] as const;
export type Pattern = (typeof PATTERNS)[number];

/** The most bytes one motif may take once rendered to HTML. */
export const MAX_BYTES = 4096;

/** The drawing area. Coordinates are whole numbers inside it, so the markup stays small. */
const WIDTH = 240;
const HEIGHT = 160;

/** Props from the directive. Every value is a string. */
export type MotifProps = {
  /** Any text. The same seed always draws the same motif. Without one the seed is `motif`. */
  seed?: string;
  /** `contours` (default), `dots` or `grid`. Anything else is the default. */
  pattern?: string;
  /** Source position, kept as `data-src`. */
  src?: string;
};

/** A seeded random-number source: FNV-1a over the seed text, then mulberry32. Same seed, same sequence. */
export function random(seed: string): () => number {
  let hash = 0x811c9dc5;
  for (const ch of seed) {
    hash ^= ch.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193);
  }
  let state = hash >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Concentric, wobbling rings around a seeded centre. Alternate rings use the second accent. */
function contours(rand: () => number): ComponentChild[] {
  const cx = 70 + Math.round(rand() * 100);
  const cy = 50 + Math.round(rand() * 60);
  const rings = 7;
  const points = 14;
  const phase = rand() * Math.PI * 2;
  const stretch = 0.6 + rand() * 0.5;
  const out: ComponentChild[] = [];
  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring * 16;
    let d = "";
    for (let i = 0; i < points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const wobble = 1 + 0.18 * Math.sin(angle * 3 + phase + ring * 0.4) + (rand() - 0.5) * 0.08;
      const x = Math.round(cx + Math.cos(angle) * radius * wobble);
      const y = Math.round(cy + Math.sin(angle) * radius * wobble * stretch);
      d += `${i === 0 ? "M" : "L"}${x} ${y}`;
    }
    out.push(h("path", { class: ring % 2 === 0 ? "motif-line motif-line-b" : "motif-line", d: `${d}Z` }));
  }
  return out;
}

/** Rows of round dots, each dot kept or dropped by the seed, in three weights. */
function dots(rand: () => number): ComponentChild[] {
  const paths: string[] = ["", "", ""];
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 14; col++) {
      const r = rand();
      if (r < 0.35) continue;
      const weight = r < 0.6 ? 0 : r < 0.85 ? 1 : 2;
      paths[weight] += `M${12 + col * 16 + (row % 2) * 8} ${12 + row * 17}h0`;
    }
  }
  const classes = ["motif-dot motif-dot-sm", "motif-dot", "motif-dot motif-dot-b"];
  return paths.flatMap((d, i) => (d === "" ? [] : [h("path", { class: classes[i], d })]));
}

/** A grid whose lines are each drawn or skipped by the seed, with a few cells filled. */
function grid(rand: () => number): ComponentChild[] {
  let lines = "";
  let accent = "";
  for (let x = 0; x <= WIDTH; x += 20) if (rand() > 0.2) lines += `M${x} 0V${HEIGHT}`;
  for (let y = 0; y <= HEIGHT; y += 20) if (rand() > 0.2) lines += `M0 ${y}H${WIDTH}`;
  let cells = "";
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rand() * 12) * 20;
    const y = Math.floor(rand() * 8) * 20;
    cells += `M${x} ${y}h20v20h-20Z`;
  }
  for (let i = 0; i < 4; i++) accent += `M${Math.floor(rand() * 12) * 20} ${Math.floor(rand() * 8) * 20}h20`;
  return [
    h("path", { class: "motif-cell", d: cells }),
    h("path", { class: "motif-line", d: lines }),
    h("path", { class: "motif-line motif-line-b", d: accent }),
  ];
}

const DRAW: Record<Pattern, (rand: () => number) => ComponentChild[]> = { contours, dots, grid };

/**
 * A decorative SVG pattern drawn at build time from a seed. It carries no text, no image and no script,
 * is hidden from assistive technology, and takes its colours from the theme's accent tokens in
 * `style.css`, so one markup serves both themes.
 */
const motif: Component<MotifProps> = ({ props }) => {
  const seed = typeof props.seed === "string" && props.seed !== "" ? props.seed : "motif";
  const pattern: Pattern = (PATTERNS as readonly string[]).includes(props.pattern ?? "") ? (props.pattern as Pattern) : "contours";
  const src = typeof props.src === "string" && props.src !== "" ? props.src : undefined;
  return h(
    "svg",
    {
      class: `motif motif-${pattern}`,
      viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
      preserveAspectRatio: "xMidYMid slice",
      "aria-hidden": "true",
      focusable: "false",
      ...(src === undefined ? {} : { "data-src": src }),
    },
    DRAW[pattern](random(`${pattern}:${seed}`)),
  );
};

export default motif;
