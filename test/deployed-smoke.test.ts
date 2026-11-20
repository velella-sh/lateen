// The deployed smoke gate's pure parts: the base and commit it accepts, the six routes it visits,
// same-origin and base-path failures, and the report it writes. No browser or network here.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DEPLOYED_CASES,
  SCHEMES,
  VIEWPORTS,
  baseFailure,
  buildDeployedReport,
  commitFrom,
  deployedBase,
  deployedRoute,
  isCommit,
  requestFailure,
  responseFailure,
  withinBase,
  type DeployedResult,
} from "../scripts/smoke-deployed.ts";
import { validate, type JsonSchema } from "../src/report-schema.ts";

const schema = JSON.parse(
  readFileSync(new URL("../schema/deployed-smoke.schema.json", import.meta.url), "utf8"),
) as JsonSchema;

const BASE = "https://example.com/lateen/";

test("every route joins under the deployed base path", () => {
  assert.equal(deployedRoute("/", BASE), BASE);
  assert.equal(deployedRoute("/components/", BASE), "https://example.com/lateen/components/");
  assert.equal(deployedRoute("/search/?q=install", BASE), "https://example.com/lateen/search/?q=install");
  assert.equal(deployedRoute("/books/alpha/", "https://example.com/"), "https://example.com/books/alpha/");
});

test("the base must be https and is normalized to one trailing slash", () => {
  assert.equal(deployedBase("https://example.com/lateen"), BASE);
  assert.equal(deployedBase("https://example.com/lateen/?x=1#top"), BASE);
  assert.equal(deployedBase("https://example.com"), "https://example.com/");
  assert.throws(() => deployedBase(undefined), /--base/);
  assert.throws(() => deployedBase("http://example.com/lateen/"), /https/);
  assert.throws(() => deployedBase("not a url"), /not a URL/);
});

test("the commit comes from the flag or CI and is always 7-40 lowercase hex", () => {
  assert.equal(commitFrom(["--commit", "abc1234"]), "abc1234");
  assert.equal(commitFrom([], { GITHUB_SHA: "0123456789abcdef" }), "0123456789abcdef");
  assert.equal(commitFrom([], { LATEN_COMMIT: "abcdef1", GITHUB_SHA: "0123456" }), "abcdef1");
  assert.equal(isCommit("abc1234"), true);
  assert.equal(isCommit("ABC1234"), false);
  assert.equal(isCommit("abc123"), false);
  assert.throws(() => commitFrom([], {}), /--commit/);
  assert.throws(() => commitFrom(["--commit"]), /needs a sha/);
  assert.throws(() => commitFrom(["--commit", "ABC1234"]), /lowercase hex/);
});

test("six public routes are visited, and only the missing page expects a 404", () => {
  assert.deepEqual(
    DEPLOYED_CASES.map((item) => [item.name, item.path, item.status]),
    [
      ["home", "/", 200],
      ["components", "/components/", 200],
      ["search", "/search/?q=install", 200],
      ["changelog", "/changelog/", 200],
      ["data", "/books/alpha/", 200],
      ["not found", "/this-page-does-not-exist/", 404],
    ],
  );
  assert.deepEqual(
    DEPLOYED_CASES.filter((item) => item.status === 404).map((item) => item.name),
    ["not found"],
  );
  assert.deepEqual(
    VIEWPORTS.map((item) => [item.name, item.width, item.height]),
    [
      ["desktop", 1280, 800],
      ["mobile", 390, 844],
    ],
  );
  assert.deepEqual([...SCHEMES], ["light", "dark"]);
});

test("same-origin URLs must stay inside the deployed base path", () => {
  assert.equal(withinBase("https://example.com/lateen/", BASE), true);
  assert.equal(withinBase("https://example.com/lateen/components/", BASE), true);
  assert.equal(withinBase("https://example.com/lateen", BASE), true);
  assert.equal(withinBase("https://example.com/lateenish/", BASE), false);
  assert.equal(withinBase("https://example.com/other/", BASE), false);
  assert.equal(withinBase("https://cdn.example/x.js", BASE), false);

  assert.equal(baseFailure("https://example.com/lateen/components/", BASE), undefined);
  assert.equal(baseFailure("https://cdn.example/x.js", BASE), undefined, "another origin is not this gate's business");
  assert.match(baseFailure("https://example.com/other/", BASE) ?? "", /outside the deployed base/);
});

test("a failed request fails only when it is same-origin and not a navigation abort", () => {
  assert.equal(requestFailure("https://example.com/lateen/x.js", "net::ERR_ABORTED", BASE), undefined);
  assert.equal(requestFailure("https://cdn.example/x.js", "net::ERR_FAILED", BASE), undefined);
  assert.equal(requestFailure("https://example.com/lateen/x.js", "net::ERR_FAILED", BASE), "request failed: https://example.com/lateen/x.js: net::ERR_FAILED");
  assert.match(requestFailure("https://example.com/other/x.js", "net::ERR_FAILED", BASE) ?? "", /outside/);
});

test("a response of 400 or more fails, except the document that is meant to be 404", () => {
  assert.equal(responseFailure("https://example.com/lateen/", 200, BASE), undefined);
  assert.equal(responseFailure("https://example.com/lateen/missing/", 404, BASE, 404, true), undefined);
  assert.equal(responseFailure("https://example.com/lateen/missing/", 404, BASE, 404, false), "HTTP 404 https://example.com/lateen/missing/");
  assert.equal(responseFailure("https://example.com/lateen/x.js", 500, BASE), "HTTP 500 https://example.com/lateen/x.js");
  assert.equal(responseFailure("https://cdn.example/x.js", 500, BASE), undefined);
});

test("the report holds every visit, keeps the first failure, and passes its schema", () => {
  const cases: DeployedResult[] = [];
  for (const item of DEPLOYED_CASES) {
    for (const viewport of VIEWPORTS) {
      for (const scheme of SCHEMES) {
        cases.push({ name: item.name, path: item.path, viewport: viewport.name, scheme, status: item.status, ok: true });
      }
    }
  }
  const report = buildDeployedReport({ base: BASE, commit: "abc1234", cases });
  assert.equal(report.ok, true);
  assert.deepEqual(
    (report.cases as readonly DeployedResult[]).map((item) => `${item.name}/${item.viewport}/${item.scheme}`).slice(0, 4),
    ["home/desktop/light", "home/desktop/dark", "home/mobile/light", "home/mobile/dark"],
  );
  assert.equal((report.cases as readonly DeployedResult[]).length, 24);
  assert.deepEqual(validate(schema, report), []);

  const failed = cases.map((item, index) => (index === 7 ? { ...item, ok: false, error: "console error" } : item));
  const incomplete = buildDeployedReport({ base: BASE, commit: "abc1234", cases: failed });
  assert.equal(incomplete.ok, false);
  assert.equal((incomplete.cases as readonly DeployedResult[])[7]?.error, "console error");
  assert.deepEqual(validate(schema, incomplete), []);

  assert.notDeepEqual(validate(schema, { ...report, commit: "nope" }), []);
  assert.notDeepEqual(validate(schema, { ...report, cases: [] }), []);
});
