import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

test("the sailcloth stack deps are declared on the package", () => {
  const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  for (const name of ["tailwindcss", "@tailwindcss/cli", "chart.js", "lucide", "preact"]) {
    assert.ok(deps[name], `${name} is installed`);
  }
});

test("styles/src/ui.css declares the Tailwind design tokens", () => {
  const css = readFileSync(new URL("../../styles/src/ui.css", import.meta.url), "utf8");
  assert.match(css, /@import "tailwindcss"/);
  assert.match(css, /@theme\s*\{/);
  assert.match(css, /--foam:\s*#f4f4f9/i);
  assert.match(css, /--night:\s*#23212c/i);
});

test("ui:build wrote the generated stylesheet and Chart.js asset", () => {
  assert.ok(existsSync(new URL("../../styles/generated.css", import.meta.url)));
  assert.ok(existsSync(new URL("../../components/performance-chart/chart.min.js", import.meta.url)));
});

test("Lucide icon helper and Chart.js components live on the main theme", () => {
  assert.ok(existsSync(new URL("../../src/icon.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../../components/charts/index.ts", import.meta.url)));
  assert.ok(existsSync(new URL("../../components/performance-chart/index.ts", import.meta.url)));
});

test("icons come from Lucide, not the legacy inline SVG sheet", () => {
  assert.equal(existsSync(new URL("../../icons/index.ts", import.meta.url)), false);
});

test("performance chart styles live in the Tailwind source, not a companion sheet", () => {
  assert.equal(existsSync(new URL("../../components/performance-chart/style.css", import.meta.url)), false);
});
