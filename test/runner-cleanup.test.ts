// The shared cleanup of the build runners (#884): registered steps run last first on success,
// failure and interruption, a failing step never hides the body's error or the other steps, and
// temporary folders go while reports written outside them stay. The interrupt path is exercised
// in a real child process so the exit code and the removed folder are measured, not assumed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import { withCleanup, withTempOutput } from "../scripts/runner-cleanup.ts";

test("steps run last registered first and the body's value is returned", async () => {
  const order: string[] = [];
  const result = await withCleanup(async (cleanup) => {
    cleanup.add(() => {
      order.push("first");
    });
    cleanup.add(async () => {
      order.push("second");
    });
    return 42;
  });
  assert.equal(result, 42);
  assert.deepEqual(order, ["second", "first"]);
});

test("a failing body still runs every step and keeps its own error", async () => {
  const order: string[] = [];
  const boom = new Error("the gate failed");
  await assert.rejects(
    withCleanup(async (cleanup) => {
      cleanup.add(() => {
        order.push("first");
      });
      cleanup.add(() => {
        order.push("second");
      });
      throw boom;
    }),
    (error: unknown) => error === boom,
  );
  assert.deepEqual(order, ["second", "first"]);
});

test("a throwing step does not stop the others; its error surfaces only without a body error", async () => {
  const order: string[] = [];
  const stepError = new Error("close failed");
  await assert.rejects(
    withCleanup(async (cleanup) => {
      cleanup.add(() => {
        order.push("ran");
      });
      cleanup.add(() => {
        throw stepError;
      });
    }),
    (error: unknown) => error === stepError,
  );
  assert.deepEqual(order, ["ran"]);

  const bodyError = new Error("the gate failed");
  const logged: string[] = [];
  const original = console.error;
  console.error = (line: string) => logged.push(line);
  try {
    await assert.rejects(
      withCleanup(async (cleanup) => {
        cleanup.add(() => {
          throw stepError;
        });
        throw bodyError;
      }),
      (error: unknown) => error === bodyError,
    );
  } finally {
    console.error = original;
  }
  assert.ok(logged.some((line) => line.includes("close failed")));
});

test("a temporary folder is removed on success and failure; a report written outside it stays", async () => {
  const reports = mkdtempSync(join(tmpdir(), "cleanup-reports-"));
  try {
    let kept = "";
    const success = await withCleanup(async (cleanup) => {
      const dir = cleanup.tempDir("lateen-cleanup-test-");
      assert.ok(existsSync(dir));
      writeFileSync(join(dir, "scratch.txt"), "work");
      kept = join(reports, "report.json");
      writeFileSync(kept, "{}");
      return dir;
    });
    assert.ok(!existsSync(success));
    assert.equal(readFileSync(kept, "utf8"), "{}");

    let failed = "";
    await assert.rejects(
      withCleanup(async (cleanup) => {
        failed = cleanup.tempDir("lateen-cleanup-test-");
        throw new Error("the gate failed");
      }),
      /the gate failed/,
    );
    assert.ok(!existsSync(failed));
    assert.equal(readFileSync(kept, "utf8"), "{}");
  } finally {
    rmSync(reports, { recursive: true, force: true });
  }
});

test("a finished run leaves the process's signal listeners as they were", async () => {
  const before = { sigint: process.listenerCount("SIGINT"), sigterm: process.listenerCount("SIGTERM") };
  await withCleanup(async (cleanup) => {
    cleanup.add(() => {});
    assert.equal(process.listenerCount("SIGINT"), before.sigint + 1);
    assert.equal(process.listenerCount("SIGTERM"), before.sigterm + 1);
  });
  assert.equal(process.listenerCount("SIGINT"), before.sigint);
  assert.equal(process.listenerCount("SIGTERM"), before.sigterm);
});

test("withTempOutput removes the folder on success and failure and returns the value", () => {
  let success = "";
  const value = withTempOutput("lateen-cleanup-sync-", (dir) => {
    success = dir;
    assert.ok(existsSync(dir));
    return "measured";
  });
  assert.equal(value, "measured");
  assert.ok(!existsSync(success));

  let failed = "";
  assert.throws(
    () =>
      withTempOutput("lateen-cleanup-sync-", (dir) => {
        failed = dir;
        throw new Error("the build failed");
      }),
    /the build failed/,
  );
  assert.ok(!existsSync(failed));
});

/** Runs a child that hangs inside withCleanup, interrupts it, and returns its exit code and temp dir. */
async function interrupted(signal: "SIGINT" | "SIGTERM"): Promise<{ code: number | null; dir: string }> {
  const helper = pathToFileURL(fileURLToPath(new URL("../scripts/runner-cleanup.ts", import.meta.url))).href;
  const code = `import { withCleanup } from ${JSON.stringify(helper)};
setInterval(() => {}, 1000); // a real runner's server keeps the loop alive; signal listeners alone do not
await withCleanup(async (cleanup) => {
  const dir = cleanup.tempDir("lateen-cleanup-signal-");
  process.stdout.write(dir + "\\n");
  await new Promise(() => {});
});`;
  const child = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "pipe", "inherit"] });
  const deadline = setTimeout(() => child.kill("SIGKILL"), 15000);
  try {
    const dir = await new Promise<string>((resolve, reject) => {
      let buffer = "";
      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString();
        const line = buffer.split("\n")[0];
        if (buffer.includes("\n") && line !== undefined) resolve(line);
      });
      child.on("error", reject);
      child.on("exit", (code) => reject(new Error(`the child exited early with ${code}`)));
    });
    const exited = new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));
    child.kill(signal);
    return { code: await exited, dir };
  } finally {
    clearTimeout(deadline);
  }
}

test("SIGINT cleans the temporary folder up and exits with 130", { timeout: 20000 }, async () => {
  const { code, dir } = await interrupted("SIGINT");
  assert.equal(code, 130);
  assert.ok(!existsSync(dir), `${dir} was removed`);
});

test("SIGTERM cleans the temporary folder up and exits with 143", { timeout: 20000 }, async () => {
  const { code, dir } = await interrupted("SIGTERM");
  assert.equal(code, 143);
  assert.ok(!existsSync(dir), `${dir} was removed`);
});

test("every build runner uses the shared cleanup instead of its own temporary-folder handling", () => {
  for (const name of ["acceptance.ts", "test-a11y.ts", "test-visual.ts", "performance-budget.ts"]) {
    const source = readFileSync(new URL(`../scripts/${name}`, import.meta.url), "utf8");
    assert.ok(source.includes('from "./runner-cleanup.ts"'), `${name} imports the shared cleanup`);
    assert.ok(!source.includes("mkdtempSync"), `${name} creates temporary folders through the helper`);
  }
});