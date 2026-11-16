// The baseline flow and the review output of the visual gates (docs/design/visual-gates.md).
// A shot is compared with test/visual/baselines/<case>.png. A pass writes nothing. A failure writes the
// before, after and diff images, and one image with the three side by side, into the review folder and
// reports their paths. A shot with no baseline fails and says how to create one. A baseline is written
// only when `update` is set, never otherwise.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { decodePng, encodePng, compareImages, type CompareOptions, type Raster } from "./visual-compare.ts";

export type CaseStatus = "pass" | "fail" | "missing" | "updated";

export interface CaseReport {
  readonly name: string;
  readonly status: CaseStatus;
  readonly share?: number;
  readonly message?: string;
  /** Review images written for a failure: before, after, diff (when the sizes match) and side by side. */
  readonly files: readonly string[];
}

export interface ReviewOptions {
  /** Folder of the screenshots just taken. */
  readonly shots: string;
  readonly baselines: string;
  /** Folder the review images go to; written only for a failure. */
  readonly review: string;
  readonly update?: boolean;
  readonly compare?: CompareOptions;
}

const GAP = 12;
const BACKGROUND = [128, 128, 128, 255] as const;

/** The panels left to right on a grey background, a gap apart, each panel at the top. */
export function sideBySide(panels: readonly Raster[]): Raster {
  const width = panels.reduce((sum, p) => sum + p.width, 0) + GAP * (panels.length - 1);
  const height = Math.max(...panels.map((p) => p.height));
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < data.length; i += 4) data.set(BACKGROUND, i);
  let left = 0;
  for (const p of panels) {
    for (let y = 0; y < p.height; y++) data.set(p.data.subarray(y * p.width * 4, (y + 1) * p.width * 4), (y * width + left) * 4);
    left += p.width + GAP;
  }
  return { width, height, data };
}

/** The case name of a shot file: its name without the extension. */
export const caseName = (file: string): string => basename(file, ".png");

/** The first message for a case with no baseline. */
export const missingMessage = (name: string): string =>
  `no baseline for "${name}": record it on CI, or locally with "node scripts/test-visual.ts --update" and review the image before it is committed`;

/** Reviews every PNG in `shots` against its baseline and returns one report per case, in name order. */
export function reviewShots(options: ReviewOptions): CaseReport[] {
  const { shots, baselines, review, update = false } = options;
  const reports: CaseReport[] = [];
  for (const file of readdirSync(shots).filter((f) => f.endsWith(".png")).sort()) {
    const name = caseName(file);
    const current = readFileSync(join(shots, file));
    const baselineFile = join(baselines, file);
    if (update) {
      mkdirSync(baselines, { recursive: true });
      writeFileSync(baselineFile, encodePng(decodePng(current)));
      reports.push({ name, status: "updated", files: [baselineFile] });
      continue;
    }
    if (!existsSync(baselineFile)) {
      reports.push({ name, status: "missing", message: missingMessage(name), files: [] });
      continue;
    }
    const before = decodePng(readFileSync(baselineFile));
    const after = decodePng(current);
    const result = compareImages(before, after, options.compare);
    if (result.ok) {
      reports.push({ name, status: "pass", share: result.share, files: [] });
      continue;
    }
    mkdirSync(review, { recursive: true });
    const out = (suffix: string): string => join(review, `${name}.${suffix}.png`);
    const files = [out("before"), out("after")];
    writeFileSync(files[0] as string, encodePng(before));
    writeFileSync(files[1] as string, encodePng(after));
    const panels = [before, after];
    if (result.diff) {
      files.push(out("diff"));
      writeFileSync(out("diff"), encodePng(result.diff));
      panels.push(result.diff);
    }
    files.push(out("side-by-side"));
    writeFileSync(out("side-by-side"), encodePng(sideBySide(panels)));
    reports.push({ name, status: "fail", share: result.share, ...(result.message ? { message: result.message } : {}), files });
  }
  return reports;
}

/** The lines to print for the reports, and whether the run failed. */
export function formatReview(reports: readonly CaseReport[]): { readonly lines: string[]; readonly ok: boolean } {
  const lines: string[] = [];
  for (const r of reports) {
    if (r.status === "pass") lines.push(`ok      ${r.name}`);
    else if (r.status === "updated") lines.push(`updated ${r.name}: ${r.files[0]}`);
    else if (r.status === "missing") lines.push(`FAIL    ${r.message}`);
    else {
      const share = r.share === undefined ? "" : ` (${(r.share * 100).toFixed(3)}% changed)`;
      lines.push(`FAIL    ${r.name}${share}${r.message ? `: ${r.message}` : ""}`);
      for (const f of r.files) lines.push(`          ${f}`);
    }
  }
  const failed = reports.filter((r) => r.status === "fail" || r.status === "missing").length;
  lines.push(failed === 0 ? `${reports.length} cases, no failures` : `${failed} of ${reports.length} cases failed`);
  return { lines, ok: failed === 0 };
}
