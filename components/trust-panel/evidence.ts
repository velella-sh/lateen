import { t } from "../../i18n/index.ts";
import { isRecord, knownOf } from "../../src/guards.ts";

const SIGNALS = ["examples", "drift", "review"] as const;
const EVIDENCE = ["measured", "none", "missing", "unknown"] as const;
const SOURCES = ["inline", "computed", "git", "none"] as const;
const AVAILABILITY = ["available", "unavailable", "missing", "not-applicable", "conflict"] as const;
const FACTORS = ["positive", "neutral", "negative", "missing", "conflict"] as const;
const COVERAGE = ["recorded", "untracked", "unavailable", "unknown"] as const;

export interface EvidenceRow {
  readonly label: string;
  readonly text: string;
}

export function evidenceRowsOf(entry: Record<string, unknown>, lang: string): EvidenceRow[] {
  const rows: EvidenceRow[] = [];
  const evidence = entry.evidence;
  const provenance = isRecord(entry.provenance) ? entry.provenance : {};
  if (isRecord(evidence)) {
    for (const signal of SIGNALS) {
      const state = knownOf(EVIDENCE, evidence[signal]) ?? "unknown";
      rows.push({ label: t(lang, `trust_evidence_${signal}`), text: t(lang, `trust_evidence_${state}`) });
    }
  }
  if (Array.isArray(entry.factors)) {
    for (const factor of entry.factors) {
      if (!isRecord(factor)) continue;
      const signal = knownOf(SIGNALS, factor.signal);
      if (signal === undefined) continue;
      const input = provenance[signal];
      const source = isRecord(input) ? knownOf(SOURCES, input.source) : undefined;
      const availability = isRecord(input) ? knownOf(AVAILABILITY, input.availability) : undefined;
      const value = factor.value;
      const state = knownOf(FACTORS, factor.state);
      const verdict = typeof value !== "number" || !Number.isFinite(value) || state === undefined
        ? t(lang, "trust_evidence_unknown")
        : t(lang, `trust_factor_${state}`, { value: new Intl.NumberFormat(lang).format(value) });
      rows.push({
        label: t(lang, `trust_factor_${signal}`),
        text: t(lang, "trust_factor_detail", {
          verdict,
          source: source === undefined ? t(lang, "trust_evidence_unknown") : t(lang, `trust_source_${source}`),
          availability: availability === undefined ? t(lang, "trust_evidence_unknown") : t(lang, `trust_availability_${availability.replaceAll("-", "_")}`),
        }),
      });
    }
  }
  const coverage = knownOf(COVERAGE, entry.reviewCoverage);
  if (coverage !== undefined) {
    rows.push({ label: t(lang, "trust_review_coverage"), text: t(lang, `trust_coverage_${coverage}`) });
  }
  return rows;
}
