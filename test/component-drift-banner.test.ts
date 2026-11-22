import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { ComponentProps, Site } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import { stringsOf } from "../i18n/index.ts";
import driftBanner, {
  CLASS,
  DETAILS_CLASS,
  FINDING_CLASS,
  FINDING_KIND_CLASS,
  FINDING_LINK_CLASS,
  FINDING_MESSAGE_CLASS,
  FINDING_REFERENCE_CLASS,
  FINDING_SEVERITY_CLASS,
  FINDING_UNAVAILABLE_CLASS,
  FINDINGS_CLASS,
  ICONS,
  SEVERITIES,
  STATES,
  STATE_KEYS,
  WHAT_KEYS,
  detailsHrefOf,
  evidenceHrefOf,
  evidenceOf,
  findingDetailsOf,
  findingsOf,
  linkTargetOf,
  messageOf,
  pagesOf,
  referenceOf,
  spanOf,
  viewOf,
  whatOf,
} from "../components/drift-banner/index.ts";

/** A site with the data, theme options, and base the component reads. */
function siteOf(data: Record<string, unknown>, options: Record<string, unknown> = {}, base = ""): Site {
  return { config: { base, theme: { options } }, pages: [], nav: {}, data } as unknown as Site;
}

type RenderOptions = {
  readonly lang?: string;
  readonly options?: Record<string, unknown>;
  readonly base?: string;
  readonly url?: string;
};

/** Render the banner the way the doc layout calls it: the site model and one page. */
function render(data: Record<string, unknown>, options: RenderOptions = {}): string | null {
  const { lang = "en", options: themeOptions = {}, base = "", url = "/guide/" } = options;
  const input = {
    props: {},
    html: "",
    page: { lang, url },
    site: siteOf(data, themeOptions, base),
  } as unknown as ComponentProps;
  const node = driftBanner(input);
  return node === null ? null : renderToString(node as never);
}

const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<
  string,
  Record<string, unknown>
>;
const tokenNames = new Set(
  Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)),
);

const css = "" /* lateen-legacy removed: styles/parts-drift-banner.css */;

test("default export is the drift banner component", () => {
  assert.equal(typeof driftBanner, "function");
  assert.equal(CLASS, "drift-banner");
  assert.equal(DETAILS_CLASS, "drift-banner-details");
  assert.deepEqual([...STATES], ["drifting", "stale", "unavailable", "unchecked"]);
  assert.deepEqual([...SEVERITIES], ["error", "warning", "info", "unknown"]);
});

test("renders nothing when the site has no drift data", () => {
  assert.equal(render({}), null);
  assert.equal(render({ drift: undefined }), null);
  assert.equal(render({ drift: null }), null);
  assert.equal(render({ drift: "not a map" }), null);
  assert.equal(render({ drift: [] }), null);
});

test("renders nothing when the page is clean, missing, or has a value that is not a list", () => {
  assert.equal(render({ drift: {} }), null);
  assert.equal(render({ drift: { "/other/": [{}] } }), null);
  assert.equal(render({ drift: { "/guide/": [] } }), null);
  assert.equal(render({ drift: { "/guide/": "not a list" } }), null);
  assert.equal(render({ drift: { "/guide/": { findings: 0 } } }), null);
});

test("a finding that names code is drifting, with the count and the next step", () => {
  const out = render({ drift: { "/guide/": [{ kind: "drift.missing-symbol", severity: "error" }] } });
  assert.ok(out);
  assert.match(out, new RegExp(`<aside class="${CLASS} ${CLASS}-drifting"`));
  assert.match(out, /role="note"/);
  assert.match(out, /aria-label="Drift"/);
  assert.match(out, /data-drift-state="drifting"/);
  assert.match(out, /data-drift-severity="error"/);
  assert.match(out, /<svg class="drift-banner-icon"[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(out, /<strong class="drift-banner-label">Drift<\/strong>/);
  assert.match(out, /<span class="drift-banner-message">1 drift finding<\/span>/);
  assert.match(out, /<span class="drift-banner-what">This page cites code that has changed\.<\/span>/);
  assert.doesNotMatch(out, /role="alert"|<h[1-6]/, "the banner is a note, not an alert or a heading");
});

test("findings that only describe the page are stale, not drifting", () => {
  const out = render({ drift: { "/guide/": [{ message: "The option was renamed.", line: 42 }] } });
  assert.ok(out);
  assert.match(out, new RegExp(`class="${CLASS} ${CLASS}-stale"`));
  assert.match(out, /aria-label="Stale"/);
  assert.match(out, /data-drift-state="stale"/);
  assert.match(out, /data-drift-severity="warning"/);
  assert.match(out, /<strong class="drift-banner-label">Stale<\/strong>/);
  assert.match(out, /<span class="drift-banner-what">This page may be out of date\.<\/span>/);
});

test("the severity is the worst finding's, while a missing severity uses the engine default", () => {
  const severity = (findings: unknown[]) => evidenceOf(siteOf({ drift: { "/guide/": findings } }), "/guide/")!.severity;
  assert.equal(severity([{ kind: "drift.missing-file", severity: "info" }]), "info");
  assert.equal(severity([{ kind: "drift.missing-file", severity: "info" }, { kind: "drift.moved-symbol", severity: "warning" }]), "warning");
  assert.equal(severity([{ kind: "drift.missing-file", severity: "warning" }, { kind: "drift.moved-symbol", severity: "error" }]), "error");
  assert.equal(severity([{ kind: "drift.missing-file", severity: "error" }, { kind: "drift.moved-symbol", severity: "fatal" }]), "error", "a known error still wins");
  assert.equal(severity([{ kind: "drift.missing-file" }]), "warning", "missing severity is the documented default");
  assert.equal(severity([{ kind: "drift.missing-file", severity: undefined }]), "warning");
});

test("an authored but unrecognized severity stays unknown instead of becoming a warning", () => {
  const severity = (findings: unknown[]) => evidenceOf(siteOf({ drift: { "/guide/": findings } }), "/guide/")!.severity;
  for (const value of ["fatal", "", "ERROR", " warning ", 42, 0, true, null, {}, []]) {
    assert.equal(severity([{ kind: "drift.missing-file", severity: value }]), "unknown", `${String(value)} severity is unknown`);
  }
  for (const finding of ["not a finding", 42, null, ["error"], true]) {
    assert.equal(severity([finding]), "unknown", `${String(finding)} is not a record`);
  }
  assert.deepEqual(
    findingDetailsOf([{ severity: "fatal" }, { severity: null }, "not a finding", null]).map((detail) => detail.severity),
    ["unknown", "unknown", "unknown", "unknown"],
  );
  assert.equal(evidenceOf(siteOf({ drift: { "/guide/": ["x"] } }), "/guide/")!.severity, "unknown");
  assert.equal(evidenceOf(siteOf({ drift: { "/guide/": ["x"] } }), "/guide/")!.state, "stale", "the page entry is still stale");
});

test("an all-unknown finding list never reads as a confident warning or info banner", () => {
  const findings = [
    { kind: "drift.missing-file", reference: "src/app.ts:12", severity: "fatal" },
    { message: "The severity was malformed.", severity: { level: "error" } },
    "not a finding",
  ];
  const out = render({ drift: { "/guide/": findings } });
  assert.ok(out);
  assert.match(out, new RegExp(`class="${CLASS} ${CLASS}-drifting"`), "the cited source keeps the state");
  assert.match(out, /data-drift-state="drifting"/);
  assert.match(out, /data-drift-severity="unknown"/);
  assert.doesNotMatch(out, /data-drift-severity="(?:error|warning|info)"/, "no known severity is invented");
  assert.match(out, /<span class="drift-banner-message">3 drift findings<\/span>/);

  const rows = [...out.matchAll(/<li id="([^"]+)" class="[^"]*" data-drift-severity="([^"]+)"/g)].map((match) => [
    match[1],
    match[2],
  ]);
  assert.deepEqual(rows, [
    ["drift-banner-finding-1", "unknown"],
    ["drift-banner-finding-2", "unknown"],
    ["drift-banner-finding-3", "unknown"],
  ]);
  assert.match(out, /data-drift-path="src\/app.ts" data-drift-line="12"/, "the source span survives the unknown severity");
  assert.match(out, new RegExp(`<span class="${FINDING_SEVERITY_CLASS}" dir="ltr">unknown</span>`));
});

test("an explicit unavailable marker is its own state, never healthy", () => {
  for (const marker of [null, { unavailable: true }]) {
    const out = render({ drift: { "/guide/": marker } });
    assert.ok(out, `${JSON.stringify(marker)} renders`);
    assert.match(out, new RegExp(`class="${CLASS} ${CLASS}-unavailable"`));
    assert.match(out, /aria-label="Not checked"/);
    assert.match(out, /data-drift-state="unavailable"/);
    assert.match(out, /data-drift-severity="unknown"/);
    assert.match(out, /<strong class="drift-banner-label">Not checked<\/strong>/);
    assert.doesNotMatch(out, /drift-banner-message/, "an unchecked page has no finding count");
    assert.match(out, /<span class="drift-banner-what">Drift has not been checked for this page\.<\/span>/);
  }
});

test("each state has its own icon, so shape carries the meaning too", () => {
  const shapes = new Set<string>();
  for (const state of STATES) {
    const shape = JSON.stringify(ICONS[state]);
    assert.ok(!shapes.has(shape), `${state} has its own icon shape`);
    shapes.add(shape);
  }
  assert.ok(render({ drift: { "/guide/": [{ kind: "drift.missing-file" }] } })!.includes("<svg"));
  assert.ok(render({ drift: { "/guide/": [{ message: "x" }] } })!.includes("<svg"));
  assert.ok(render({ drift: { "/guide/": null } })!.includes("<svg"));
});

test("many findings use the plural message with the count", () => {
  const out = render({ drift: { "/guide/": [{}, {}, {}] } });
  assert.ok(out);
  assert.match(out, /<span class="drift-banner-message">3 drift findings<\/span>/);
});

test("the top-level shape is keyed by page URL", () => {
  const data = { drift: { "/guide/": [{}, {}] } };
  assert.deepEqual(findingsOf(siteOf(data), "/guide/"), [{}, {}]);
  assert.equal(findingsOf(siteOf(data), "/other/"), undefined);
  assert.match(render(data)!, /2 drift findings/);
});

test("the nested pages shape is keyed by page URL too", () => {
  const data = { drift: { pages: { "/guide/": [{}, {}, {}, {}] } } };
  assert.deepEqual(pagesOf(data.drift), { "/guide/": [{}, {}, {}, {}] });
  assert.deepEqual(findingsOf(siteOf(data), "/guide/"), [{}, {}, {}, {}]);
  assert.match(render(data)!, /4 drift findings/);
});

test("a nested pages member wins over top-level keys", () => {
  const drift = { pages: { "/guide/": [{}, {}] }, "/guide/": [{}] };
  assert.deepEqual(pagesOf(drift), { "/guide/": [{}, {}] });
  assert.match(render({ drift })!, /2 drift findings/);
});

test("the details link comes from theme.options.drift.detailsUrl, under the site base", () => {
  const out = render(
    { drift: { "/guide/": [{}] } },
    { options: { drift: { detailsUrl: "/drift/" } }, base: "/evergreen" },
  );
  assert.ok(out);
  assert.match(out, /<a class="drift-banner-details" href="\/evergreen\/drift\/">View drift details<\/a>/);
});

test("the unavailable state offers the same details link as a finding does", () => {
  const out = render({ drift: { "/guide/": null } }, { options: { drift: { detailsUrl: "/drift/" } } });
  assert.ok(out);
  assert.match(out, /<a class="drift-banner-details" href="\/drift\/">View drift details<\/a>/);
});

test("an https details link is kept as written and no link is shown without one", () => {
  assert.match(
    render({ drift: { "/guide/": [{}] } }, { options: { drift: { detailsUrl: "https://example.com/drift" } } })!,
    /href="https:\/\/example.com\/drift"/,
  );
  assert.doesNotMatch(render({ drift: { "/guide/": [{}] } })!, /drift-banner-details/);
});

test("an unsafe details URL is dropped instead of rendered", () => {
  for (const detailsUrl of ["javascript:alert(1)", "//evil.example/path", "relative/page", " http://example.com/ "]) {
    assert.doesNotMatch(render({ drift: { "/guide/": [{}] } }, { options: { drift: { detailsUrl } } })!, /drift-banner-details/);
  }
  assert.equal(detailsHrefOf(siteOf({}, { drift: { detailsUrl: "javascript:alert(1)" } }).config), undefined);
});

test("the details link is escaped, never parsed as markup", () => {
  const out = render({ drift: { "/guide/": [{}] } }, { options: { drift: { detailsUrl: "/drift?a=1&b=2" } } });
  assert.ok(out);
  assert.match(out, /href="\/drift\?a=1&amp;b=2"/);
  assert.doesNotMatch(out, /<script>/);
});

test("the state label, count, and next step follow the page language", () => {
  const cases: ReadonlyArray<readonly [unknown, (typeof STATES)[number]]> = [
    [[{ kind: "drift.missing-file" }], "drifting"],
    [[{ message: "x" }], "stale"],
    [null, "unavailable"],
    [[{ state: "unchecked" }], "unchecked"],
  ];
  for (const lang of ["en", "fa", "ar"] as const) {
    const strings = stringsOf(lang);
    for (const state of STATES) {
      assert.equal(whatOf(lang, state), strings[WHAT_KEYS[state]]!, `${lang} ${state} says what changed`);
    }
    for (const [entry, state] of cases) {
      const out = render({ drift: { "/guide/": entry } }, { lang });
      assert.ok(out, `${lang} ${state} renders`);
      const label = strings[STATE_KEYS[state]]!;
      assert.ok(out.includes(`<strong class="drift-banner-label">${label}</strong>`), `${lang} ${state} says "${label}"`);
      assert.ok(out.includes(`aria-label="${label}"`), `${lang} ${state} is named "${label}"`);
      assert.ok(out.includes(strings[WHAT_KEYS[state]]!), `${lang} ${state} says what happens next`);
    }
    const one = render({ drift: { "/guide/": [{ message: "x" }] } }, { lang })!;
    const many = render({ drift: { "/guide/": [{ message: "x" }, { message: "y" }] } }, { lang })!;
    assert.equal(messageOf(lang, 1), strings.drift_finding!.replace("{n}", "1"));
    assert.equal(messageOf(lang, 2), strings.drift_findings!.replace("{n}", "2"));
    assert.ok(one.includes(strings.drift_finding!.replace("{n}", "1")), `${lang} counts one`);
    assert.ok(many.includes(strings.drift_findings!.replace("{n}", "2")), `${lang} counts many`);
    assert.ok(
      render({ drift: { "/guide/": [{}] } }, { lang, options: { drift: { detailsUrl: "/drift/" } } })!.includes(
        strings.drift_details!,
      ),
      `${lang} localises the details link`,
    );
  }
});

test("each finding has a stable anchor, kind, severity, message, and exact span", () => {
  const findings = [
    { kind: "drift.missing-symbol", reference: "src/app.ts:12", severity: "error", message: "buildDocs is gone." },
    { kind: "drift.moved-symbol", reference: "src/util.ts:4-9:3", severity: "info" },
  ];
  const data = { drift: { "/guide/": findings } };
  const out = render(data);
  assert.ok(out);
  assert.match(out, new RegExp(`<ul class="${FINDINGS_CLASS}">`));
  assert.equal((out.match(/<li /g) ?? []).length, 2, "one row per finding");
  assert.match(
    out,
    new RegExp(
      `<li id="drift-banner-finding-1" class="${FINDING_CLASS}" data-drift-severity="error" ` +
        `data-drift-finding-available="true" data-drift-path="src/app.ts" data-drift-line="12">`,
    ),
  );
  assert.match(out, new RegExp(`<span class="${FINDING_SEVERITY_CLASS}" dir="ltr">error</span>`));
  assert.match(out, new RegExp(`<code class="${FINDING_KIND_CLASS}" dir="ltr">drift.missing-symbol</code>`));
  assert.match(out, new RegExp(`<code class="${FINDING_REFERENCE_CLASS}" dir="ltr">src/app.ts:12</code>`));
  assert.match(out, new RegExp(`<span class="${FINDING_MESSAGE_CLASS}">buildDocs is gone.</span>`));
  assert.match(
    out,
    new RegExp(
      `<li id="drift-banner-finding-2"[^>]*data-drift-path="src/util.ts" data-drift-line="4" ` +
        `data-drift-end-line="9" data-drift-column="3">`,
    ),
  );

  const details = findingDetailsOf(findings, siteOf(data).config);
  assert.deepEqual(
    details.map((detail) => detail.id),
    ["drift-banner-finding-1", "drift-banner-finding-2"],
  );
  assert.equal(details[1]!.reference, "src/util.ts:4-9:3");
  assert.deepEqual(details[1]!.span, { path: "src/util.ts", line: 4, endLine: 9, column: 3 });
  assert.equal(new Set(details.map((detail) => detail.id)).size, findings.length, "ids are unique");
  assert.equal(render(data), out, "the same data gets the same anchors");
});

test("spans parse the documented references and explicit fields, and drop bad parts", () => {
  assert.deepEqual(spanOf({ reference: "src/app.ts" }), { path: "src/app.ts" });
  assert.deepEqual(spanOf({ reference: "src/app.ts:7" }), { path: "src/app.ts", line: 7 });
  assert.deepEqual(spanOf({ reference: "src/app.ts:7-9" }), { path: "src/app.ts", line: 7, endLine: 9 });
  assert.deepEqual(spanOf({ reference: "src/app.ts:7:3" }), { path: "src/app.ts", line: 7, column: 3 });
  assert.deepEqual(spanOf({ path: "src/app.ts", line: "7", endLine: "9", column: "3" }), {
    path: "src/app.ts",
    line: 7,
    endLine: 9,
    column: 3,
  });
  assert.deepEqual(spanOf({ file: "src/app.ts", line: 7 }), { path: "src/app.ts", line: 7 });
  assert.deepEqual(spanOf({ path: "src/app.ts", line: 9, endLine: 3 }), { path: "src/app.ts", line: 9 });
  assert.deepEqual(spanOf({ path: "src/app.ts", column: 3 }), { path: "src/app.ts" });
  assert.equal(spanOf({ message: "The option was renamed.", line: 42 }), undefined, "a page line is not a source span");
  assert.equal(referenceOf({ path: "src/app.ts", line: 7, endLine: 9, column: 3 }), "src/app.ts:7-9:3");
  assert.equal(referenceOf({ path: "src/app.ts" }), "src/app.ts");
});

test("malformed references and unsafe paths never become source claims", () => {
  for (const reference of [
    "javascript:alert(1)",
    "https://evil.example/app.ts:1",
    "//evil.example/app.ts:1",
    "/etc/passwd:1",
    "src/../secret.ts:1",
    "src\\app.ts:1",
    "src/app.ts:0",
    "src/app.ts:1:0",
    "src/app.ts:12-3",
    "src/app.ts:1:",
    "src/app.ts:not-a-line",
  ]) {
    assert.equal(spanOf({ reference }), undefined, `${reference} is not a span`);
  }
  const out = render({ drift: { "/guide/": [{ kind: "drift.missing-file", reference: "src/app.ts:0" }] } });
  assert.ok(out);
  assert.doesNotMatch(out, /data-drift-path|data-drift-line|app\.ts:0/);
  assert.equal((out.match(/<li /g) ?? []).length, 1, "the finding still gets an unavailable row");
});

test("a safe evidence link wraps the reference, takes the base, and keeps its scheme", () => {
  const linked = (url: string, base = "") =>
    render({ drift: { "/guide/": [{ kind: "drift.missing-file", reference: "src/app.ts:12", url }] } }, { base })!;

  assert.match(
    linked("/evidence/12", "/evergreen"),
    new RegExp(
      `<a class="${FINDING_REFERENCE_CLASS} ${FINDING_LINK_CLASS}" href="/evergreen/evidence/12" dir="ltr">src/app.ts:12</a>`,
    ),
  );
  assert.match(linked("https://ci.example/build/12"), /href="https:\/\/ci\.example\/build\/12"/);
  assert.match(
    render({ drift: { "/guide/": [{ kind: "drift.missing-file", url: "https://ci.example/build/12" }] } })!,
    new RegExp(`<a class="${FINDING_KIND_CLASS} ${FINDING_LINK_CLASS}" href="https://ci.example/build/12" dir="ltr">drift.missing-file</a>`),
  );
  assert.match(
    render({ drift: { "/guide/": [{ url: "https://ci.example/build/12" }] } })!,
    new RegExp(`<a class="${FINDING_LINK_CLASS}" href="https://ci.example/build/12">View drift details</a>`),
  );
});

test("unsafe evidence links are dropped instead of rendered", () => {
  for (const url of ["javascript:alert(1)", "//evil.example/path", "relative/path", " http://example.com/ "]) {
    const out = render({ drift: { "/guide/": [{ kind: "drift.missing-file", reference: "src/app.ts:12", url }] } });
    assert.ok(out);
    assert.doesNotMatch(out, new RegExp(FINDING_LINK_CLASS), `${url} is not a link`);
    assert.match(out, new RegExp(`<code class="${FINDING_REFERENCE_CLASS}" dir="ltr">src/app.ts:12</code>`));
  }
  assert.equal(evidenceHrefOf(siteOf({}).config, "javascript:alert(1)"), undefined);
  assert.equal(evidenceHrefOf(siteOf({}, {}, "/evergreen").config, "/evidence/"), "/evergreen/evidence/");
  assert.equal(evidenceHrefOf(siteOf({}, {}, "/").config, "/evidence/"), undefined, "a bare base cannot make //host");
});

test("the evidence link is escaped, never parsed as markup", () => {
  const out = render({
    drift: { "/guide/": [{ kind: "drift.missing-file", reference: "src/app.ts:12", url: "/drift?a=1&b=2" }] },
  });
  assert.ok(out);
  assert.match(out, /href="\/drift\?a=1&amp;b=2"/);
  assert.doesNotMatch(out, /<script>/);
});

test("mixed valid and invalid findings keep the count, severity, and list in agreement", () => {
  const findings = [
    { kind: "drift.missing-file", reference: "src/app.ts:12", severity: "info" },
    "not a finding",
    { kind: "drift.missing-symbol", reference: "src/app.ts:0", severity: "error", url: "javascript:alert(1)" },
    null,
  ];
  const out = render({ drift: { "/guide/": findings } });
  assert.ok(out);
  assert.match(out, /<span class="drift-banner-message">4 drift findings<\/span>/);
  assert.match(out, /data-drift-severity="error"/, "the worst finding still sets the banner severity");

  const rows = [...out.matchAll(/<li id="[^"]+" class="[^"]*" data-drift-severity="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(rows, ["info", "unknown", "error", "unknown"], "every finding has its own severity");

  const unavailable = [...out.matchAll(/data-drift-finding-available="false"/g)];
  assert.equal(unavailable.length, 2, "the string and null findings are plainly unavailable");
  assert.doesNotMatch(out, /drift-banner-finding-link/, "an unsafe link is not rendered");
  assert.doesNotMatch(out, /app\.ts:0/, "a malformed span is not shown");
  assert.match(out, new RegExp(`<span class="${FINDING_CLASS}-note">Not recorded</span>`));
});

test("a mixed known and unknown list keeps its count, anchors, and evidence links", () => {
  const findings = [
    { kind: "drift.missing-file", reference: "src/app.ts:12", severity: "info", url: "/evidence/1" },
    { kind: "drift.moved-symbol", severity: "fatal", url: "https://ci.example/build/2" },
    null,
  ];
  const out = render({ drift: { "/guide/": findings } });
  assert.ok(out);
  assert.match(out, /<span class="drift-banner-message">3 drift findings<\/span>/);
  assert.match(out, /data-drift-severity="unknown"/, "unreadable evidence keeps the banner unknown");

  const rows = [...out.matchAll(/<li id="([^"]+)" class="[^"]*" data-drift-severity="([^"]+)"/g)].map((match) => [
    match[1],
    match[2],
  ]);
  assert.deepEqual(rows, [
    ["drift-banner-finding-1", "info"],
    ["drift-banner-finding-2", "unknown"],
    ["drift-banner-finding-3", "unknown"],
  ]);
  assert.match(out, new RegExp(`<a class="${FINDING_REFERENCE_CLASS} ${FINDING_LINK_CLASS}" href="/evidence/1" dir="ltr">src/app.ts:12</a>`));
  assert.match(out, new RegExp(`<a class="${FINDING_KIND_CLASS} ${FINDING_LINK_CLASS}" href="https://ci.example/build/2" dir="ltr">drift.moved-symbol</a>`));
});

test("machine values stay left to right on an RTL page while the labels translate", () => {
  for (const lang of ["fa", "ar"] as const) {
    const strings = stringsOf(lang);
    const out = render(
      { drift: { "/guide/": [{ kind: "drift.missing-file", reference: "src/app.ts:12", url: "/evidence/" }] } },
      { lang },
    );
    assert.ok(out, `${lang} renders`);
    assert.ok(out.includes(strings.drift_state_drifting!), `${lang} localises the state label`);
    assert.ok(out.includes(strings.drift_what_source!), `${lang} localises the next step`);
    assert.equal((out.match(/dir="ltr"/g) ?? []).length, 3, `${lang} keeps severity, kind, and path left to right`);
    assert.doesNotMatch(out, /dir="rtl"/, "the page direction is not overridden on machine values");
  }
});

test("an unavailable page shows no finding list", () => {
  const out = render({ drift: { "/guide/": null } });
  assert.ok(out);
  assert.doesNotMatch(out, new RegExp(FINDINGS_CLASS));
  assert.doesNotMatch(out, new RegExp(FINDING_CLASS));
});

test("the link target picks the most specific evidence, and no link means no target", () => {
  const targetOf = (finding: unknown) => linkTargetOf(findingDetailsOf([finding], siteOf({}).config)[0]!);
  const url = "/evidence/12";
  assert.equal(targetOf({ kind: "drift.x", reference: "src/app.ts:12", message: "gone", url }), "reference");
  assert.equal(targetOf({ kind: "drift.x", message: "gone", url }), "kind");
  assert.equal(targetOf({ message: "gone", url }), "message");
  assert.equal(targetOf({ url }), "details", "a link-only finding gets the labelled fallback, not an empty control");
  assert.equal(targetOf({ kind: "drift.x", reference: "src/app.ts:12", message: "gone" }), undefined);
  assert.equal(targetOf({}), undefined);
  assert.equal(targetOf("not a finding"), undefined);
  for (const unsafe of ["javascript:alert(1)", "//evil.example/path", "relative/path", " http://example.com/ "]) {
    assert.equal(targetOf({ kind: "drift.x", reference: "src/app.ts:12", url: unsafe }), undefined, `${unsafe} never links`);
  }
});

test("the view model selects evidence, finding rows, and the fix-action link before markup", () => {
  const findings = [
    { kind: "drift.missing-symbol", reference: "src/app.ts:12", severity: "error", url: "/evidence/1" },
    { message: "The option was renamed." },
  ];
  const site = siteOf({ drift: { "/guide/": findings } }, { drift: { detailsUrl: "/drift/" } }, "/evergreen");
  const view = viewOf(site, "/guide/")!;
  assert.deepEqual(view.evidence, { state: "drifting", count: 2, severity: "error" });
  assert.deepEqual(view.findings, findingDetailsOf(findings, site.config));
  assert.equal(view.href, "/evergreen/drift/");

  const stale = viewOf(siteOf({ drift: { "/guide/": [{ message: "x" }] } }), "/guide/")!;
  assert.equal(stale.evidence.state, "stale");
  assert.equal(stale.findings!.length, 1);
  assert.equal(Object.hasOwn(stale, "href"), false, "no details link without a safe detailsUrl");

  for (const marker of [null, { unavailable: true }]) {
    const unchecked = viewOf(siteOf({ drift: { "/guide/": marker } }, { drift: { detailsUrl: "/drift/" } }), "/guide/")!;
    assert.equal(unchecked.evidence.state, "unavailable");
    assert.equal(Object.hasOwn(unchecked, "findings"), false, "the unavailable state selects no finding rows");
    assert.equal(unchecked.href, "/drift/", "the fix-action link stays available");
  }

  const unsafe = viewOf(siteOf({ drift: { "/guide/": findings } }, { drift: { detailsUrl: "javascript:alert(1)" } }), "/guide/")!;
  assert.equal(Object.hasOwn(unsafe, "href"), false, "an unsafe details URL never becomes a control");

  assert.equal(viewOf(siteOf({}), "/guide/"), undefined);
  assert.equal(viewOf(siteOf({ drift: { "/guide/": [] } }), "/guide/"), undefined);
  assert.equal(viewOf(siteOf({ drift: { "/other/": [{}] } }), "/guide/"), undefined);
});

test("partial evidence links exactly one part of a row, never an empty or broken control", () => {
  const cases: ReadonlyArray<readonly [Record<string, unknown>, RegExp]> = [
    [{ kind: "drift.x", reference: "src/app.ts:12", message: "gone", url: "/evidence/" }, new RegExp(`<a class="${FINDING_REFERENCE_CLASS} ${FINDING_LINK_CLASS}"`)],
    [{ kind: "drift.x", message: "gone", url: "/evidence/" }, new RegExp(`<a class="${FINDING_KIND_CLASS} ${FINDING_LINK_CLASS}"`)],
    [{ message: "gone", url: "/evidence/" }, new RegExp(`<a class="${FINDING_MESSAGE_CLASS} ${FINDING_LINK_CLASS}"`)],
    [{ url: "/evidence/" }, new RegExp(`<a class="${FINDING_LINK_CLASS}" href="/evidence/">View drift details</a>`)],
  ];
  for (const [finding, linked] of cases) {
    const out = render({ drift: { "/guide/": [finding] } })!;
    assert.match(out, linked);
    assert.equal((out.match(/<a /g) ?? []).length, 1, "exactly one link in the row");
    assert.doesNotMatch(out, /<a[^>]*><\/a>/, "no empty anchor");
    assert.doesNotMatch(out, /href="(?:javascript:|\/\/)/, "no broken scheme");
  }
});


test("contract claims hide matches, distinguish unchecked claims, and show a fix and target", () => {
  const drift = (findings: unknown[]) => ({ drift: { "/guide/": findings } });
  assert.equal(render(drift([{ state: "match", severity: "error" }])), null);
  const unchecked = { state: "unchecked", kind: "drift.signature-unchecked", severity: "error" };
  const only = render(drift([unchecked]))!;
  assert.match(only, /data-drift-state="unchecked" data-drift-severity="warning"/);
  assert.match(only, /Claim unchecked/);
  assert.doesNotMatch(only, /code that has changed/);
  const mixed = render(drift([unchecked, { state: "moved" }, { state: "missing" }, { state: "mismatch" }]))!;
  assert.match(mixed, /data-drift-state="drifting"/);
  for (const label of ["Source moved", "Source missing", "Signature mismatch"]) assert.ok(mixed.includes(label));

  const input = { state: "moved", reference: "src/old.ts:10", help: "Update the cited line.",
    target: { path: "src/new file.ts", line: 23, identity: "abc" } };
  const site = siteOf(drift([input]));
  const out = renderToString(driftBanner({
    props: {}, html: "",
    page: { lang: "en", url: "/guide/" } as ComponentProps["page"],
    site: { ...site, config: { ...site.config, repository: { url: "https://github.com/example/docs", branch: "main" } } },
  }) as never);
  assert.match(out, /href="https:\/\/github\.com\/example\/docs\/edit\/main\/src\/new%20file\.ts#L23"/);
  assert.match(out, /Update the cited line\./);
});
