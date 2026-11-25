import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CASES,
  EXTERNAL_HOSTS,
  buildSmokeReport,
  classifySmokeEvent,
  externalAllowed,
  orderFailures,
  type SmokeFailure,
  type SmokeResult,
} from "../scripts/test-smoke.ts";

const origin = "http://127.0.0.1:4000";
const tools = { node: "v26.0.0", playwright: "1.65.1", chromium: "140.0.0" };

test("console and uncaught page errors always fail", () => {
  assert.deepEqual(classifySmokeEvent({ kind: "console", text: "boom" }, origin), { kind: "console", detail: "boom" });
  assert.deepEqual(classifySmokeEvent({ kind: "page", message: "ReferenceError: nope" }, origin), {
    kind: "page",
    detail: "ReferenceError: nope",
  });
});

test("same-origin requests and 4xx/5xx responses fail, and successful ones do not", () => {
  assert.deepEqual(
    classifySmokeEvent({ kind: "request", url: `${origin}/assets/app.js`, errorText: "net::ERR_FAILED" }, origin),
    { kind: "request", detail: `${origin}/assets/app.js: net::ERR_FAILED` },
  );
  assert.deepEqual(classifySmokeEvent({ kind: "response", url: `${origin}/missing.css`, status: 404 }, origin), {
    kind: "response",
    detail: `404 ${origin}/missing.css`,
  });
  assert.equal(classifySmokeEvent({ kind: "response", url: `${origin}/app.js`, status: 200 }, origin), undefined);
  assert.equal(
    classifySmokeEvent({ kind: "request", url: "https://cdn.example.com/app.js", errorText: "net::ERR_FAILED" }, origin),
    undefined,
    "a failed external request is the external rule's job",
  );
});

test("external hosts are allowed only when the allowlist names them", () => {
  const cdn = "https://cdn.example.com/app.js";
  assert.deepEqual(classifySmokeEvent({ kind: "external", url: cdn }, origin), { kind: "external", detail: cdn });
  assert.equal(classifySmokeEvent({ kind: "external", url: cdn }, origin, ["cdn.example.com"]), undefined);
  assert.equal(externalAllowed(cdn, origin, ["cdn.example.com"]), true);
  assert.equal(externalAllowed(cdn, origin, []), false);
  assert.equal(externalAllowed(`${origin}/app.js`, origin, []), true);
});

test("the smoke run allows the Cloudflare Web Analytics beacon and nothing else outside the site", () => {
  assert.deepEqual(EXTERNAL_HOSTS, ["static.cloudflareinsights.com"]);
  assert.equal(externalAllowed("https://static.cloudflareinsights.com/beacon.min.js", origin), true);
  assert.equal(externalAllowed("https://cdn.example.com/app.js", origin), false);
});

test("failures sort by kind and then detail", () => {
  const failures: SmokeFailure[] = [
    { kind: "response", detail: `500 ${origin}/api` },
    { kind: "console", detail: "z" },
    { kind: "console", detail: "a" },
    { kind: "request", detail: `${origin}/x.js: net::ERR_FAILED` },
  ];
  assert.deepEqual(
    orderFailures(failures).map((failure) => failure.detail),
    [`a`, `z`, `${origin}/x.js: net::ERR_FAILED`, `500 ${origin}/api`],
  );
});

test("the report is stable when results and failures arrive in another order", () => {
  const results: SmokeResult[] = CASES.map((item, index) => ({
    ...item,
    status: index === 0 ? "fail" : "pass",
    failures:
      index === 0
        ? [
            { kind: "response", detail: `404 ${origin}/gone.js` },
            { kind: "console", detail: "first" },
          ]
        : [],
  }));
  const first = buildSmokeReport({ commit: "abc1234", tools, results });
  const second = buildSmokeReport({
    commit: "abc1234",
    tools,
    results: [...results].reverse().map((result) => ({ ...result, failures: [...result.failures].reverse() })),
  });
  assert.equal(JSON.stringify(second), JSON.stringify(first));
  assert.deepEqual((first as { summary: Record<string, number> }).summary, {
    routes: CASES.length,
    passed: CASES.length - 1,
    failed: 1,
    failures: 2,
  });
  const names = (first as { routes: { name: string }[] }).routes.map((route) => route.name);
  assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
});

test("the routes cover every required feature", () => {
  assert.deepEqual(
    [...new Set(CASES.map((item) => item.category))].sort(),
    ["api", "blog", "data", "documentation", "search", "versioned"],
  );
});
