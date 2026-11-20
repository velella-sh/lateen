import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { withEnv } from "./helpers/globals.ts";
import { pathToFileURL } from "node:url";
import { h } from "preact";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import mermaid, {
  altFromSource,
  CHILD_BOOT,
  clearDiagramCache,
  diagramKey,
  diagramRenderCount,
  normalizeSource,
  parseDiagramProps,
  RENDER_OPTIONS,
  renderDiagram,
  type MermaidProps,
  type MermaidRecord,
} from "../components/mermaid/index.ts";
import {
  CACHE_DIR_ENV,
  cacheEntrySvg,
  clearDiagramReadMemo,
  diagramCacheDir,
  diagramCachePath,
  diagramCacheReadStats,
  MAX_ENTRY_BYTES,
  MERMAID_CACHE_FORMAT,
  readDiagramCache,
  writeDiagramCache,
} from "../components/mermaid/cache.ts";

function render(props: MermaidProps, lang = "en"): string {
  const input = {
    props,
    html: "",
    page: { lang } as ComponentProps["page"],
    site: {} as ComponentProps["site"],
  } as ComponentProps<MermaidProps>;
  const node = mermaid(input);
  return node === null ? "" : renderToString(node as never);
}

/** The record published inside a rendered diagram, as a consumer reads it. */
function recordOf(out: string): MermaidRecord {
  const match = /<script[^>]*data-mermaid-record[^>]*>([\s\S]*?)<\/script>/.exec(out);
  assert.ok(match, "expected a diagram record");
  return JSON.parse(match[1]!) as MermaidRecord;
}

const css = "" /* lateen-legacy removed: components/mermaid/style.css */;
const names = JSON.parse(readFileSync(new URL("../tokens/names.json", import.meta.url), "utf8")) as Record<string, Record<string, unknown>>;
const tokenNames = new Set(Object.entries(names).flatMap(([group, entries]) => Object.keys(entries).map((name) => `${group}-${name}`)));

const FLOWCHART = "flowchart TD\n  A[Start] --> B[End]";

const MERMAID_MODULE = new URL("../components/mermaid/index.ts", import.meta.url).href;
const CACHE_MODULE = new URL("../components/mermaid/cache.ts", import.meta.url).href;

/** Runs `run` with the persistent cache pointed at `dir`, restoring the environment afterwards. */
function withCacheDir<T>(dir: string, run: () => T): T {
  return withEnv(CACHE_DIR_ENV, dir, run);
}

interface Probe {
  renders: number;
  result: { ok: boolean; svg?: string; error?: string };
}

/** Renders `source` in a fresh build process with the persistent cache at `dir`. */
function renderInFreshProcess(dir: string, source: string): Probe {
  const script = `
    const mermaid = await import(${JSON.stringify(MERMAID_MODULE)});
    const result = mermaid.renderDiagram(${JSON.stringify(source)});
    process.stdout.write(JSON.stringify({ renders: mermaid.diagramRenderCount(), result }));
  `;
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    env: { ...process.env, NODE_V8_COVERAGE: "", [CACHE_DIR_ENV]: dir },
    encoding: "utf8",
  });
  assert.equal(child.status, 0, typeof child.stderr === "string" ? child.stderr : String(child.error));
  return JSON.parse(typeof child.stdout === "string" ? child.stdout : "") as Probe;
}

/** Runs a module script in a separate Node process and resolves when it exits. */
function runProcess(script: string, env: Record<string, string>): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", script], {
      env: { ...process.env, ...env },
      stdio: ["ignore", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr?.setEncoding("utf8");
    child.stderr?.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`child exited with ${String(code)}: ${stderr}`));
    });
  });
}

/** A temporary cache directory removed when the test ends. */
function tempCacheDir(): { dir: string; clean: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "lateen-mermaid-cache-"));
  return { dir, clean: () => rmSync(dir, { recursive: true, force: true }) };
}

test("the child renderer strips types for a query-versioned module under node_modules", () => {
  const root = mkdtempSync(join(tmpdir(), "lateen-mermaid-query-"));
  try {
    const packageDir = join(root, "node_modules");
    mkdirSync(packageDir, { recursive: true });
    const probe = join(packageDir, "query-probe.ts");
    writeFileSync(probe, 'process.stdout.write("loaded\\n");\n');
    const child = spawnSync(process.execPath, ["--input-type=module", "-e", CHILD_BOOT], {
      env: { ...process.env, NODE_V8_COVERAGE: "", LATEEN_MERMAID_MODULE: `${pathToFileURL(probe).href}?v=abc` },
      encoding: "utf8",
    });
    assert.equal(child.status, 0, typeof child.stderr === "string" ? child.stderr : String(child.error));
    assert.equal(child.stdout, "loaded\n");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a small flowchart renders inline SVG at build time, with its source kept", () => {
  const out = render({ source: FLOWCHART, alt: "Start goes to end" });
  assert.match(out, /<figure class="mermaid"/);
  assert.match(out, /<svg[^>]*role="img"/);
  assert.match(out, /<text[^>]*>/);
  assert.match(out, /Start/);
  assert.match(out, /<title>Start goes to end<\/title>/);
  assert.match(out, /aria-label="Start goes to end"/);
  assert.match(out, /<details class="mermaid-source">/);
  assert.match(out, /<code class="language-mermaid">flowchart TD/);
  // The only script is the inert record: the page never loads or runs a renderer.
  assert.match(out, /<script type="application\/json" data-mermaid-record[ >]/);
  assert.doesNotMatch(out, /<script(?![^>]*type="application\/json")/i);
});

test("alt text may start as a Mermaid comment", () => {
  const source = `%% alt: A tiny flow\n${FLOWCHART}`;
  assert.equal(altFromSource(source), "A tiny flow");
  const out = render({ source });
  assert.match(out, /<title>A tiny flow<\/title>/);
  assert.match(out, /aria-label="A tiny flow"/);
});

test("normalization gives equivalent sources one cache key", () => {
  assert.equal(normalizeSource("\r\nflowchart TD  \r\n  A --> B\t\r\n\r\n"), "flowchart TD\n  A --> B");
  assert.equal(diagramKey(FLOWCHART), diagramKey("\r\nflowchart TD \r\n  A[Start] --> B[End]\r\n"));
  assert.notEqual(diagramKey(FLOWCHART), diagramKey("flowchart TD\n  A[Start] --> B[Done]"));
  assert.notEqual(diagramKey(FLOWCHART), diagramKey(FLOWCHART, { ...RENDER_OPTIONS, theme: "dark" }));
});

test("source parsing resolves normalization, alt origin, and position without rendering", () => {
  const renders = diagramRenderCount();
  assert.equal(parseDiagramProps({}), null);
  assert.equal(parseDiagramProps({ source: "  \r\n\t " }), null);

  const parsed = parseDiagramProps({ source: `\r\n${FLOWCHART}  \r\n\r\n`, src: " docs/flow.md:3:1-6:3 " });
  assert.deepEqual(parsed, {
    source: FLOWCHART,
    alt: { text: "", origin: "none" },
    src: "docs/flow.md:3:1-6:3",
  });

  const authored = parseDiagramProps({ source: `%% alt: Ignored\n${FLOWCHART}`, alt: " Authored " });
  assert.deepEqual(authored?.alt, { text: "Authored", origin: "prop" });
  const derived = parseDiagramProps({ source: `%% alt: A tiny flow\n${FLOWCHART}` });
  assert.deepEqual(derived?.alt, { text: "A tiny flow", origin: "comment" });
  assert.equal(parseDiagramProps({ source: FLOWCHART, src: "  " })?.src, null);

  // Unsafe source is parsed verbatim: sanitization belongs to output, not to parsing.
  const unsafe = 'flowchart TD\n  A["</script><script>alert(1)</script>"] -->';
  assert.equal(parseDiagramProps({ source: unsafe })?.source, unsafe);
  assert.equal(diagramRenderCount(), renders, "parsing never starts a render");
});

test("the cache entry decision is pure: only a current, matching, non-empty SVG is a hit", () => {
  const key = diagramKey(FLOWCHART);
  const svg = "<svg>ok</svg>";
  assert.equal(cacheEntrySvg({ format: MERMAID_CACHE_FORMAT, key, svg }, key), svg);
  assert.equal(cacheEntrySvg({ format: MERMAID_CACHE_FORMAT - 1, key, svg }, key), null);
  assert.equal(cacheEntrySvg({ format: MERMAID_CACHE_FORMAT, key: "other-key", svg }, key), null);
  assert.equal(cacheEntrySvg({ format: MERMAID_CACHE_FORMAT, key, svg: 42 }, key), null);
  assert.equal(cacheEntrySvg({ format: MERMAID_CACHE_FORMAT, key, svg: "" }, key), null);
  assert.equal(cacheEntrySvg({ format: MERMAID_CACHE_FORMAT, key }, key), null);
  assert.equal(cacheEntrySvg(null, key), null);
  assert.equal(cacheEntrySvg("not an entry", key), null);
});

test("a failed render is a memory hit but is never persisted", () => {
  const { dir, clean } = tempCacheDir();
  const source = "flowchart TD\n  Persist -->";
  try {
    withCacheDir(dir, () => {
      clearDiagramCache();
      const renders = diagramRenderCount();
      const failed = renderDiagram(source);
      assert.equal(failed.ok, false);
      assert.equal(diagramRenderCount(), renders + 1);
      const key = diagramKey(source);
      assert.equal(readDiagramCache(dir, key), null);
      assert.equal(existsSync(diagramCachePath(dir, key)), false, "a failure is not page output for the next build");

      // The failure is still cached in memory: no second child render for the same source.
      assert.deepEqual(renderDiagram(source), failed);
      assert.equal(diagramRenderCount(), renders + 1);
    });

    // A fresh process finds no persisted failure and renders again instead of trusting one.
    const probe = renderInFreshProcess(dir, source);
    assert.equal(probe.renders, 1);
    assert.equal(probe.result.ok, false);
  } finally {
    clean();
  }
});

test("an unchanged diagram is not rendered twice", () => {
  const first = render({ source: FLOWCHART, alt: "Start goes to end" });
  const renders = diagramRenderCount();
  const variant = render({ source: "flowchart TD\r\n  A[Start] --> B[End]  \r\n\r\n", alt: "Start goes to end" });
  assert.equal(diagramRenderCount(), renders);
  assert.equal(variant, first);
});

test("a changed source or render option renders a new diagram", () => {
  renderDiagram(FLOWCHART);
  const afterBase = diagramRenderCount();

  const changed = renderDiagram("flowchart TD\n  A[Start] --> B[Done]");
  assert.equal(diagramRenderCount(), afterBase + 1);
  assert.ok(changed.ok);
  assert.match(changed.svg, /Done/);

  const dark = renderDiagram(FLOWCHART, { ...RENDER_OPTIONS, theme: "dark" });
  assert.equal(diagramRenderCount(), afterBase + 2);
  assert.ok(dark.ok);
  const base = renderDiagram(FLOWCHART);
  assert.ok(base.ok);
  assert.notEqual(dark.svg, base.svg);
});

test("the figure can keep a source position", () => {
  const out = render({ source: FLOWCHART, src: "docs/flow.md:3:1-6:3" });
  assert.match(out, /data-src="docs\/flow.md:3:1-6:3"/);
});

test("the diagram record publishes a successful render with its complete source", () => {
  const out = render({
    source: `\r\n${FLOWCHART}  \r\n\r\n`,
    alt: "Start goes to end",
    src: "docs/flow.md:3:1-6:3",
  });
  assert.deepEqual(recordOf(out), {
    component: "mermaid",
    version: 1,
    source: FLOWCHART,
    alt: { text: "Start goes to end", origin: "prop" },
    src: "docs/flow.md:3:1-6:3",
    render: "rendered",
  });
});

test("the record says where alt text came from, including an empty alternative", () => {
  const derived = recordOf(render({ source: `%% alt: A tiny flow\n${FLOWCHART}` }));
  assert.deepEqual(derived.alt, { text: "A tiny flow", origin: "comment" });

  // An authored alt wins over the comment, exactly as the SVG's accessible name does.
  const authored = recordOf(render({ source: `%% alt: Ignored\n${FLOWCHART}`, alt: "Authored" }));
  assert.deepEqual(authored.alt, { text: "Authored", origin: "prop" });

  const empty = recordOf(render({ source: FLOWCHART, alt: "   " }));
  assert.deepEqual(empty.alt, { text: "", origin: "none" });
});

test("a missing source position is published as null, not an empty string", () => {
  assert.equal(recordOf(render({ source: FLOWCHART })).src, null);
  assert.equal(recordOf(render({ source: FLOWCHART, src: "  " })).src, null);
});

test("a failed diagram publishes the same complete source and an explicit failure", () => {
  const source = "flowchart TD\n  Orphan -->";
  const out = render({ source, alt: "Broken", src: "docs/broken.md:2:1-3:2" });
  const record = recordOf(out);

  assert.deepEqual(record, {
    component: "mermaid",
    version: 1,
    source,
    alt: { text: "Broken", origin: "prop" },
    src: "docs/broken.md:2:1-3:2",
    render: "failed",
  });
  assert.deepEqual(Object.keys(record).sort(), ["alt", "component", "render", "source", "src", "version"]);
  // The renderer's own error is diagnostic only: it is not published as page content.
  assert.doesNotMatch(out, /Parse error|Lexical error|renderer exited|invalid output/);
  assert.match(out, /class="mermaid-fallback"/);
  assert.match(out, /<details class="mermaid-source">/);
  assert.match(out, /<code class="language-mermaid">flowchart TD/);
});

test("record JSON cannot close its script element", () => {
  // A broken diagram, so the SVG's own text cannot be what holds the closing tag.
  const source = 'flowchart TD\n  A["</script><script>alert(1)</script>"] -->';
  const out = render({ source, alt: '</script>"quoted"', src: '</script>' });

  assert.equal([...out.matchAll(/<script\b/g)].length, 1);
  assert.equal([...out.matchAll(/<\/script>/g)].length, 1);
  const record = recordOf(out);
  assert.equal(record.source, source);
  assert.equal(record.alt.text, '</script>"quoted"');
  assert.equal(record.src, "</script>");
});

test("publishing the record renders nothing extra and keeps the SVG and source disclosure", () => {
  const props: MermaidProps = {
    source: "flowchart TD\n  A[Record] --> B[Cached]",
    alt: "A recorded flow",
    src: "docs/record.md:8:1-10:3",
  };
  const renders = diagramRenderCount();
  const first = render(props);
  assert.equal(diagramRenderCount(), renders + 1);

  // The same diagram in another spelling is a cache hit: the record is published again without a render.
  const second = render({ ...props, source: `\r\n${props.source!}  \r\n` });
  assert.equal(diagramRenderCount(), renders + 1);
  assert.equal(second, first);
  assert.deepEqual(recordOf(second), recordOf(first));

  assert.match(first, /<svg[^>]*role="img"/);
  assert.match(first, /<title>A recorded flow<\/title>/);
  assert.match(first, /aria-label="A recorded flow"/);
  assert.match(first, /<details class="mermaid-source">/);
  assert.match(first, /<code class="language-mermaid">flowchart TD/);
});

test("an invalid diagram falls back without throwing and keeps the source", () => {
  const props: MermaidProps = { source: "flowchart TD\n  A -->", alt: "Broken" };
  const renders = diagramRenderCount();
  const node = mermaid({ props, html: "", page: { lang: "en" }, site: {} } as unknown as ComponentProps<MermaidProps>);
  const out = renderToString(node as never);
  assert.equal(diagramRenderCount(), renders + 1);
  assert.match(out, /class="mermaid-fallback"/);
  assert.match(out, /role="note"/);
  assert.match(out, /<code class="language-mermaid">flowchart TD/);
  assert.doesNotMatch(out, /<svg/);

  // The page around a failed diagram still renders, and the failure is cached instead of retried.
  const page = renderToString(h("div", null, node, h("p", null, "after")) as never);
  assert.match(page, /<\/figure><p>after<\/p>/);
  assert.equal(render(props), out);
  assert.equal(diagramRenderCount(), renders + 1);
});

test("the same diagram has the same output in a fresh cache", () => {
  const first = render({ source: FLOWCHART, alt: "Start goes to end" });
  clearDiagramCache();
  assert.equal(render({ source: FLOWCHART, alt: "Start goes to end" }), first);
});

test("a second build process reuses an unchanged diagram without rendering it", () => {
  const { dir, clean } = tempCacheDir();
  try {
    const first = renderInFreshProcess(dir, FLOWCHART);
    assert.equal(first.renders, 1);
    assert.ok(first.result.ok);

    // A different but equivalent source: normalization is part of the key, so it is the same entry.
    const second = renderInFreshProcess(dir, "flowchart TD\r\n  A[Start] --> B[End]  \r\n\r\n");
    assert.equal(second.renders, 0);
    assert.deepEqual(second.result, first.result, "the same diagram has the same SVG in another process");
  } finally {
    clean();
  }
});

test("source, options, and cache format invalidate exactly their own entry", () => {
  const { dir, clean } = tempCacheDir();
  try {
    withCacheDir(dir, () => {
      const changedSource = "flowchart TD\n  A[Start] --> B[Done]";
      const dark = { ...RENDER_OPTIONS, theme: "dark" as const };
      clearDiagramCache();
      const first = renderDiagram(FLOWCHART);
      assert.ok(first.ok);
      assert.ok(renderDiagram(changedSource).ok);
      assert.ok(renderDiagram(FLOWCHART, dark).ok);
      const rendered = diagramRenderCount();

      // A fresh process's memory: every unchanged entry is a hit.
      clearDiagramCache();
      const hits = renderDiagram(FLOWCHART);
      assert.equal(diagramRenderCount(), rendered);
      assert.deepEqual(hits, first);

      // Its own key is unaffected: each unchanged entry is still a hit.
      assert.ok(renderDiagram(changedSource).ok);
      const darkHit = renderDiagram(FLOWCHART, dark);
      assert.ok(darkHit.ok);
      assert.equal(diagramRenderCount(), rendered);

      // A changed source and a changed option are different entries, with different SVGs.
      const changed = renderDiagram(changedSource);
      assert.ok(changed.ok);
      assert.match(changed.svg, /Done/);
      assert.notEqual(darkHit.svg, first.svg);

      // An entry written by an older cache format is never read, even at the current path.
      const key = diagramKey(FLOWCHART);
      writeFileSync(
        diagramCachePath(dir, key),
        JSON.stringify({ format: MERMAID_CACHE_FORMAT - 1, key, svg: "<svg>stale</svg>" }),
        "utf8",
      );
      clearDiagramCache();
      const fresh = renderDiagram(FLOWCHART);
      assert.equal(diagramRenderCount(), rendered + 1);
      assert.ok(fresh.ok);
      assert.doesNotMatch(fresh.svg, /stale/);
      assert.equal(readDiagramCache(dir, key), fresh.svg);
    });
  } finally {
    clean();
  }
});

test("corrupt, partial, and oversized entries never become page output", () => {
  const { dir, clean } = tempCacheDir();
  try {
    withCacheDir(dir, () => {
      const source = "flowchart TD\n  A[Corrupt] --> B[Recovered]";
      const key = diagramKey(source);
      const path = diagramCachePath(dir, key);
      const cases = [
        '{"format":1,"key":"' + key,
        JSON.stringify({ format: MERMAID_CACHE_FORMAT, key, svg: 42 }),
        "x".repeat(MAX_ENTRY_BYTES + 1),
      ];

      for (const entry of cases) {
        mkdirSync(join(dir, `v${MERMAID_CACHE_FORMAT}`), { recursive: true });
        writeFileSync(path, entry, "utf8");
        clearDiagramCache();
        const renders = diagramRenderCount();
        const result = renderDiagram(source);
        assert.equal(diagramRenderCount(), renders + 1, "a damaged entry is a miss");
        assert.ok(result.ok);
        assert.match(result.svg, /Recovered/);
        assert.equal(readDiagramCache(dir, key), result.svg, "the miss repairs the entry");
      }
    });
  } finally {
    clean();
  }
});

test("a disabled, read-only, or failing cache still renders normally", () => {
  withEnv(CACHE_DIR_ENV, undefined, () => {
    assert.equal(diagramCacheDir(), null);
    process.env[CACHE_DIR_ENV] = "  ";
    assert.equal(diagramCacheDir(), null);

    const { dir, clean } = tempCacheDir();
    try {
      // A cache directory that cannot be created: a plain file is in the way.
      const blocked = join(dir, "blocked");
      writeFileSync(blocked, "not a directory", "utf8");
      const failing = renderInFreshProcess(join(blocked, "cache"), FLOWCHART);
      assert.equal(failing.renders, 1);
      assert.ok(failing.result.ok);
      assert.equal(existsSync(join(blocked, "cache")), false);

      // A cache directory that cannot be written: the build still produces the diagram.
      const readOnly = join(dir, "read-only");
      mkdirSync(readOnly);
      writeFileSync(join(readOnly, "keep"), "", "utf8");
      try {
        process.env[CACHE_DIR_ENV] = readOnly;
        // chmod after creating the directory: the owner may still write on macOS as root only.
        chmodSync(readOnly, 0o500);
        clearDiagramCache();
        const renders = diagramRenderCount();
        const result = renderDiagram("flowchart TD\n  A[Read only] --> B[Renders]");
        assert.equal(diagramRenderCount(), renders + 1);
        assert.ok(result.ok);
        assert.match(result.svg, /Renders/);
      } finally {
        chmodSync(readOnly, 0o700);
      }
    } finally {
      clean();
    }
  });
});

test("a successful read is memoized for the build; misses stay on the disk", () => {
  const { dir, clean } = tempCacheDir();
  try {
    clearDiagramReadMemo();
    const key = "memoized-read-key";

    // A miss goes to the disk and is not memoized: repairing the entry makes the next read a hit.
    assert.equal(readDiagramCache(dir, key), null);
    assert.deepEqual(diagramCacheReadStats(), { memoHits: 0, diskHits: 0, diskMisses: 1 });
    writeDiagramCache(dir, key, "<svg>memo</svg>");
    assert.equal(readDiagramCache(dir, key), "<svg>memo</svg>");
    assert.equal(readDiagramCache(dir, key), "<svg>memo</svg>");
    assert.deepEqual(diagramCacheReadStats(), { memoHits: 1, diskHits: 1, diskMisses: 1 });

    // A memo hit does not touch the disk: the entry can change underneath without changing the answer.
    writeDiagramCache(dir, key, "<svg>changed</svg>");
    assert.equal(readDiagramCache(dir, key), "<svg>memo</svg>", "a repeated read never re-reads the disk");
    assert.equal(diagramCacheReadStats().memoHits, 2);
    assert.equal(diagramCacheReadStats().diskHits, 1);
  } finally {
    clearDiagramReadMemo();
    clean();
  }
});

test("corrupt and oversized entries stay misses on every read", () => {
  const { dir, clean } = tempCacheDir();
  try {
    clearDiagramReadMemo();
    const key = "memoized-corrupt-key";
    const path = diagramCachePath(dir, key);
    mkdirSync(join(dir, `v${String(MERMAID_CACHE_FORMAT)}`), { recursive: true });

    writeFileSync(path, '{"format":1,"key":"' + key, "utf8");
    assert.equal(readDiagramCache(dir, key), null);
    assert.equal(readDiagramCache(dir, key), null, "a corrupt entry is not memoized");
    writeFileSync(path, "x".repeat(MAX_ENTRY_BYTES + 1), "utf8");
    assert.equal(readDiagramCache(dir, key), null, "an oversized entry is not memoized");
    assert.deepEqual(diagramCacheReadStats(), { memoHits: 0, diskHits: 0, diskMisses: 3 });
  } finally {
    clearDiagramReadMemo();
    clean();
  }
});

test("a second diagram in one build reuses the first read without touching the disk", () => {
  const { dir, clean } = tempCacheDir();
  try {
    withCacheDir(dir, () => {
      clearDiagramCache();
      const renders = diagramRenderCount();
      assert.ok(renderDiagram(FLOWCHART).ok);
      assert.equal(diagramRenderCount(), renders + 1);

      // Fresh memory, same build: the entry is read from the disk once, then memoized.
      clearDiagramCache();
      const before = diagramCacheReadStats();
      assert.ok(renderDiagram(FLOWCHART).ok);
      assert.equal(diagramRenderCount(), renders + 1, "the persistent cache served the second render");
      assert.equal(diagramCacheReadStats().diskHits, before.diskHits + 1);

      // The same diagram again: neither a render nor a second disk read.
      assert.ok(renderDiagram(FLOWCHART).ok);
      assert.equal(diagramRenderCount(), renders + 1);
      assert.equal(diagramCacheReadStats().diskHits, before.diskHits + 1);
      assert.equal(diagramCacheReadStats().memoHits, before.memoHits);
    });
  } finally {
    clean();
  }
});

test("concurrent writers leave one complete entry", async () => {
  const { dir, clean } = tempCacheDir();
  try {
    const script = (fill: string) => `
      const { writeDiagramCache } = await import(${JSON.stringify(CACHE_MODULE)});
      const svg = ${JSON.stringify(fill)}.repeat(100000);
      for (let i = 0; i < 20; i++) writeDiagramCache(process.env[${JSON.stringify(CACHE_DIR_ENV)}], "shared-key", svg);
    `;
    await Promise.all([
      runProcess(script("A"), { [CACHE_DIR_ENV]: dir }),
      runProcess(script("B"), { [CACHE_DIR_ENV]: dir }),
    ]);

    const stored = readDiagramCache(dir, "shared-key");
    assert.ok(stored === "A".repeat(100000) || stored === "B".repeat(100000));
    const files = readdirSync(join(dir, `v${MERMAID_CACHE_FORMAT}`));
    assert.deepEqual(files, ["shared-key.json"], "temp files are renamed away, not left behind");
  } finally {
    clean();
  }
});

test("an empty source renders nothing", () => {
  assert.equal(render({}), "");
  assert.equal(render({ source: "  " }), "");
});

test("the fallback and the source disclosure follow the page language", () => {
  const broken = "flowchart TD\n  A -->";
  const fa = render({ source: broken }, "fa");
  assert.match(fa, /<p>این نمودار ترسیم نشد\. منبع زیر کامل است\.<\/p>/);
  assert.match(fa, /<summary>منبع نمودار<\/summary>/);

  const ar = render({ source: broken }, "ar");
  assert.match(ar, /تعذّر رسم هذا المخطط\. المصدر أدناه كامل\./);
  assert.match(ar, /<summary>مصدر المخطط<\/summary>/);

  const rendered = render({ source: FLOWCHART, alt: "A flow" }, "fa");
  assert.match(rendered, /<summary>منبع نمودار<\/summary>/);
});

