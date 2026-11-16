// The image comparer of the visual gates (docs/design/visual-gates.md, "Comparer").
// Usage: node scripts/visual-compare.ts <baseline.png> <current.png> [diff.png]
//
// Two same-size images are compared pixel by pixel; a pixel is changed when its perceptual YIQ
// distance passes the threshold, and the case fails when the share of changed pixels passes the limit.
// There is no dependency: `node:zlib` decodes and encodes the PNG. Exit status 1 means the case failed.
import { readFileSync, writeFileSync } from "node:fs";
import { crc32, deflateSync, inflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

/** Per-pixel threshold from the note: the normalised YIQ delta a pixel may differ by. */
export const THRESHOLD = 0.1;
/** Largest share of changed pixels from the note: 0.1% of the image. */
export const MAX_SHARE = 0.001;

/** The largest YIQ delta there is (black against white), the divisor that normalises a delta to 0..1. */
const MAX_DELTA = 35215;

/** Decoded 8-bit RGBA pixels, row by row. */
export interface Raster {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
}

/** A rectangle in pixels; a masked region is never counted as changed. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface CompareOptions {
  readonly threshold?: number;
  readonly maxShare?: number;
  readonly masks?: readonly Box[];
}

export interface CompareResult {
  readonly ok: boolean;
  readonly width: number;
  readonly height: number;
  readonly changed: number;
  /** Changed pixels over all pixels of the image, `0..1`. */
  readonly share: number;
  /** The bounding box of each group of touching changed pixels. */
  readonly boxes: readonly Box[];
  /** Changed pixels in red over a dimmed copy of the baseline; absent when the sizes differ. */
  readonly diff?: Raster;
  readonly message?: string;
}

/** Reads a byte; an index past the end reads 0. */
const at = (a: ArrayLike<number>, i: number): number => a[i] ?? 0;

const blend = (channel: number, alpha: number): number => 255 + (channel - 255) * alpha;

/** The normalised perceptual delta (0..1) between the pixels at `i` in `a` and `b`, alpha blended onto white. */
function delta(a: Uint8Array, b: Uint8Array, i: number): number {
  const alphaA = at(a, i + 3) / 255;
  const alphaB = at(b, i + 3) / 255;
  const rA = blend(at(a, i), alphaA), gA = blend(at(a, i + 1), alphaA), bA = blend(at(a, i + 2), alphaA);
  const rB = blend(at(b, i), alphaB), gB = blend(at(b, i + 1), alphaB), bB = blend(at(b, i + 2), alphaB);
  const yA = 0.29889531 * rA + 0.58662247 * gA + 0.11448223 * bA;
  const yB = 0.29889531 * rB + 0.58662247 * gB + 0.11448223 * bB;
  const iA = 0.59597799 * rA - 0.2741761 * gA - 0.32180189 * bA;
  const iB = 0.59597799 * rB - 0.2741761 * gB - 0.32180189 * bB;
  const qA = 0.21147017 * rA - 0.52261711 * gA + 0.31114694 * bA;
  const qB = 0.21147017 * rB - 0.52261711 * gB + 0.31114694 * bB;
  const dy = yA - yB, di = iA - iB, dq = qA - qB;
  return (0.5053 * dy * dy + 0.299 * di * di + 0.1957 * dq * dq) / MAX_DELTA;
}

/** Bounding boxes of the 8-connected groups of set cells in `flags`. */
function groups(flags: Uint8Array, width: number, height: number): Box[] {
  const seen = new Uint8Array(flags.length);
  const boxes: Box[] = [];
  const stack: number[] = [];
  for (let start = 0; start < flags.length; start++) {
    if (!flags[start] || seen[start]) continue;
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    seen[start] = 1;
    stack.push(start);
    while (stack.length > 0) {
      const at = stack.pop() as number;
      const x = at % width, y = (at - x) / width;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const next = ny * width + nx;
          if (flags[next] && !seen[next]) { seen[next] = 1; stack.push(next); }
        }
      }
    }
    boxes.push({ x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 });
  }
  return boxes;
}

/**
 * Compares two rasters. A pixel is changed when `delta > threshold²` (the `pixelmatch` rule, so the
 * numbers carry over if the comparer is swapped); anti-aliasing is not special-cased. Sizes that differ
 * fail without a pixel comparison.
 */
export function compareImages(baseline: Raster, current: Raster, options: CompareOptions = {}): CompareResult {
  const { threshold = THRESHOLD, maxShare = MAX_SHARE, masks = [] } = options;
  if (baseline.width !== current.width || baseline.height !== current.height) {
    return {
      ok: false,
      width: current.width,
      height: current.height,
      changed: 0,
      share: 0,
      boxes: [],
      message: `Image sizes differ: baseline is ${baseline.width}×${baseline.height}, current is ${current.width}×${current.height}`,
    };
  }
  const { width, height } = baseline;
  const masked = new Uint8Array(width * height);
  for (const m of masks) {
    for (let y = Math.max(0, m.y); y < Math.min(height, m.y + m.height); y++) {
      for (let x = Math.max(0, m.x); x < Math.min(width, m.x + m.width); x++) masked[y * width + x] = 1;
    }
  }
  const limit = threshold * threshold;
  const flags = new Uint8Array(width * height);
  const out = new Uint8Array(width * height * 4);
  let changed = 0;
  for (let p = 0; p < flags.length; p++) {
    const i = p * 4;
    const alpha = at(baseline.data, i + 3) / 255;
    // Dimmed baseline: the pixel blended onto white and faded towards white.
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(255 - (255 - blend(at(baseline.data, i + c), alpha)) * 0.25);
    out[i + 3] = 255;
    if (masked[p]) {
      out[i] = 200; out[i + 1] = 215; out[i + 2] = 255; // masked: a pale blue wash
      continue;
    }
    if (delta(baseline.data, current.data, i) > limit) {
      flags[p] = 1;
      changed++;
      out[i] = 255; out[i + 1] = 0; out[i + 2] = 0;
    }
  }
  const share = changed / (width * height || 1);
  return {
    ok: share <= maxShare,
    width,
    height,
    changed,
    share,
    boxes: groups(flags, width, height),
    diff: { width, height, data: out },
  };
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Decodes a non-interlaced 8-bit grey, grey+alpha, RGB or RGBA PNG; anything else throws. */
export function decodePng(file: Uint8Array): Raster {
  const buf = Buffer.from(file);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("Not a PNG file");
  let width = 0, height = 0, type = -1;
  const idat: Buffer[] = [];
  for (let pos = 8; pos + 8 <= buf.length;) {
    const size = buf.readUInt32BE(pos);
    const name = buf.toString("latin1", pos + 4, pos + 8);
    const body = buf.subarray(pos + 8, pos + 8 + size);
    if (name === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      type = at(body, 9);
      if (at(body, 8) !== 8 || ![0, 2, 4, 6].includes(type) || at(body, 12) !== 0) {
        throw new Error("Unsupported PNG: only non-interlaced 8-bit grey, RGB and RGBA are read");
      }
    } else if (name === "IDAT") idat.push(body);
    else if (name === "IEND") break;
    pos += 12 + size;
  }
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[type as 0 | 2 | 4 | 6];
  if (!channels || width === 0 || height === 0) throw new Error("Not a valid PNG: missing IHDR");
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error("Not a valid PNG: image data is short");
  const px = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = at(raw, y * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const v = at(raw, y * (stride + 1) + 1 + x);
      const left = x >= channels ? at(px, y * stride + x - channels) : 0;
      const up = y > 0 ? at(px, (y - 1) * stride + x) : 0;
      const upLeft = y > 0 && x >= channels ? at(px, (y - 1) * stride + x - channels) : 0;
      let add = 0;
      if (filter === 1) add = left;
      else if (filter === 2) add = up;
      else if (filter === 3) add = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        add = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) throw new Error(`Not a valid PNG: unknown filter ${filter}`);
      px[y * stride + x] = (v + add) & 255;
    }
  }
  const data = new Uint8Array(width * height * 4);
  for (let p = 0; p < width * height; p++) {
    const s = p * channels, d = p * 4;
    if (channels === 1 || channels === 2) {
      data[d] = data[d + 1] = data[d + 2] = at(px, s);
      data[d + 3] = channels === 2 ? at(px, s + 1) : 255;
    } else {
      data[d] = at(px, s); data[d + 1] = at(px, s + 1); data[d + 2] = at(px, s + 2);
      data[d + 3] = channels === 4 ? at(px, s + 3) : 255;
    }
  }
  return { width, height, data };
}

function chunk(name: string, body: Buffer): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(body.length, 0);
  head.write(name, 4, "latin1");
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), body])), 0);
  return Buffer.concat([head, body, tail]);
}

/** Encodes a raster as an 8-bit RGB PNG with no metadata chunks (alpha is dropped; diffs are opaque). */
export function encodePng(image: Raster): Buffer {
  const { width, height, data } = image;
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4, d = y * (width * 3 + 1) + 1 + x * 3;
      raw[d] = at(data, s); raw[d + 1] = at(data, s + 1); raw[d + 2] = at(data, s + 2);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([SIGNATURE, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Compares two PNG files; writes the diff image to `diffFile` when given and there is one. */
export function compareFiles(baselineFile: string, currentFile: string, diffFile?: string, options?: CompareOptions): CompareResult {
  const result = compareImages(decodePng(readFileSync(baselineFile)), decodePng(readFileSync(currentFile)), options);
  if (diffFile && result.diff) writeFileSync(diffFile, encodePng(result.diff));
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [baseline, current, diff] = process.argv.slice(2);
  if (!baseline || !current) {
    console.error("Usage: node scripts/visual-compare.ts <baseline.png> <current.png> [diff.png]");
    process.exit(2);
  }
  const { diff: _drop, ...report } = compareFiles(baseline, current, diff);
  console.log(JSON.stringify(report));
  process.exit(report.ok ? 0 : 1);
}
