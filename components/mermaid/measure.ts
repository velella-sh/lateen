/* Text and shape measurement for the child renderer. jsdom has no layout, so Mermaid's `getBBox` and
 * `getComputedTextLength` are answered from the SVG's own attributes and transforms. */

type Matrix = readonly [number, number, number, number, number, number];

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** A jsdom element as the measurement code sees it, without pulling DOM types into the theme. */
interface AnyElement {
  readonly tagName: string;
  readonly children: ArrayLike<AnyElement>;
  readonly textContent: string | null;
  getAttribute(name: string): string | null;
}

interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MeasureTarget {
  getBBox(this: AnyElement): { x: number; y: number; width: number; height: number };
  getComputedTextLength(this: AnyElement): number;
}

function multiply(left: Matrix, right: Matrix): Matrix {
  return [
    left[0]! * right[0]! + left[2]! * right[1]!,
    left[1]! * right[0]! + left[3]! * right[1]!,
    left[0]! * right[2]! + left[2]! * right[3]!,
    left[1]! * right[2]! + left[3]! * right[3]!,
    left[0]! * right[4]! + left[2]! * right[5]! + left[4]!,
    left[1]! * right[4]! + left[3]! * right[5]! + left[5]!,
  ];
}

function parseTransform(value: string): Matrix {
  let matrix = IDENTITY;
  for (const match of value.matchAll(/(translate|scale|rotate|matrix)\s*\(([^)]*)\)/g)) {
    const numbers = (match[2] ?? "").match(/-?[\d.]+/g)?.map(Number) ?? [];
    const name = match[1];
    if (name === "translate") {
      matrix = multiply(matrix, [1, 0, 0, 1, numbers[0] ?? 0, numbers[1] ?? 0]);
    } else if (name === "scale") {
      matrix = multiply(matrix, [numbers[0] ?? 1, 0, 0, numbers[1] ?? numbers[0] ?? 1, 0, 0]);
    } else if (name === "rotate") {
      const radians = ((numbers[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      matrix = multiply(matrix, [cos, sin, -sin, cos, 0, 0]);
    } else if (name === "matrix" && numbers.length === 6) {
      matrix = multiply(matrix, numbers as unknown as Matrix);
    }
  }
  return matrix;
}

function numberAttribute(element: AnyElement, name: string): number {
  const value = Number(element.getAttribute(name) ?? "");
  return Number.isFinite(value) ? value : 0;
}

function addPoint(box: Box, matrix: Matrix, x: number, y: number): void {
  const tx = matrix[0]! * x + matrix[2]! * y + matrix[4]!;
  const ty = matrix[1]! * x + matrix[3]! * y + matrix[5]!;
  if (tx < box.x0) box.x0 = tx;
  if (ty < box.y0) box.y0 = ty;
  if (tx > box.x1) box.x1 = tx;
  if (ty > box.y1) box.y1 = ty;
}

function localBox(element: AnyElement, matrix: Matrix, box: Box): void {
  const tag = element.tagName.toLowerCase();
  const points: Array<readonly [number, number]> = [];
  if (tag === "rect") {
    const x = numberAttribute(element, "x");
    const y = numberAttribute(element, "y");
    const width = numberAttribute(element, "width");
    const height = numberAttribute(element, "height");
    points.push([x, y], [x + width, y], [x, y + height], [x + width, y + height]);
  } else if (tag === "circle") {
    const cx = numberAttribute(element, "cx");
    const cy = numberAttribute(element, "cy");
    const radius = numberAttribute(element, "r");
    points.push([cx - radius, cy - radius], [cx + radius, cy + radius]);
  } else if (tag === "ellipse") {
    const cx = numberAttribute(element, "cx");
    const cy = numberAttribute(element, "cy");
    const rx = numberAttribute(element, "rx");
    const ry = numberAttribute(element, "ry");
    points.push([cx - rx, cy - ry], [cx + rx, cy + ry]);
  } else if (tag === "line") {
    points.push(
      [numberAttribute(element, "x1"), numberAttribute(element, "y1")],
      [numberAttribute(element, "x2"), numberAttribute(element, "y2")],
    );
  } else if (tag === "polygon" || tag === "polyline") {
    const numbers = (element.getAttribute("points") ?? "").match(/-?[\d.]+/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i] ?? 0, numbers[i + 1] ?? 0]);
  } else if (tag === "path") {
    const numbers = (element.getAttribute("d") ?? "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < numbers.length; i += 2) points.push([numbers[i] ?? 0, numbers[i + 1] ?? 0]);
  } else if (tag === "text" || tag === "tspan") {
    const x = numberAttribute(element, "x");
    const y = numberAttribute(element, "y");
    const lines = (element.textContent ?? "").split("\n");
    const width = Math.max(0, ...lines.map((line) => line.length)) * 8;
    const height = Math.max(1, lines.length) * 16;
    points.push([x, y - height], [x + width, y - height], [x, y], [x + width, y]);
  } else if (tag === "foreignobject") {
    const x = numberAttribute(element, "x");
    const y = numberAttribute(element, "y");
    const width = numberAttribute(element, "width");
    const height = numberAttribute(element, "height");
    points.push([x, y], [x + width, y], [x, y + height], [x + width, y + height]);
  }
  for (const [x, y] of points) addPoint(box, matrix, x, y);
}

const SKIP = new Set([
  "defs",
  "style",
  "marker",
  "clippath",
  "mask",
  "pattern",
  "lineargradient",
  "radialgradient",
  "filter",
  "symbol",
]);

function walk(element: AnyElement, matrix: Matrix, box: Box): void {
  if (SKIP.has(element.tagName.toLowerCase())) return;
  const transform = element.getAttribute("transform");
  const own = transform === null ? matrix : multiply(matrix, parseTransform(transform));
  localBox(element, own, box);
  for (let i = 0; i < element.children.length; i++) {
    const child = element.children[i];
    if (child !== undefined) walk(child, own, box);
  }
}

function measured(element: AnyElement, box: Box): { x: number; y: number; width: number; height: number } {
  if (box.x0 === Infinity) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0 };
}

export function installMeasurement(prototype: MeasureTarget): void {
  prototype.getBBox = function (this: AnyElement) {
    const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    const tag = this.tagName.toLowerCase();
    if (tag === "svg" || tag === "g") {
      const transform = this.getAttribute("transform");
      const own = transform === null ? IDENTITY : parseTransform(transform);
      for (let i = 0; i < this.children.length; i++) {
        const child = this.children[i];
        if (child !== undefined) walk(child, own, box);
      }
    } else {
      localBox(this, IDENTITY, box);
    }
    return measured(this, box);
  };
  prototype.getComputedTextLength = function (this: AnyElement) {
    return (this.textContent ?? "").length * 8;
  };
}
