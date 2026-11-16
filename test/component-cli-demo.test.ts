import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToString } from "preact-render-to-string";
import type { ComponentProps } from "@velella/mizzen/contracts";
import cliDemo, { allText, commandText, directive, parseSession, wantsPlay } from "../components/cli-demo/index.ts";

function render(html: string, props: Record<string, string> = {}, lang = "en"): string {
  const input = { props, html, page: { lang, source: { file: "site/page.md", line: 3 } }, site: {} } as unknown as ComponentProps;
  return renderToString(cliDemo(input as never) as never);
}

const SESSION = "<p>$ npm ci\nadded 2 packages\n# next, build\n$ npm run build\n! Error: missing file\n&lt;done&gt;</p>";

test("the directive is cli-demo and the default export is a component", () => {
  assert.equal(directive, "cli-demo");
  assert.equal(typeof cliDemo, "function");
});

test("parseSession reads command, comment, error and output lines", () => {
  const lines = parseSession("$ npm ci\nadded 2 packages\n# a note\n$ npm test\n! boom\n!bare");
  assert.deepEqual(
    lines.map((l) => [l.kind, l.text, l.command]),
    [
      ["command", "npm ci", 0],
      ["output", "added 2 packages", 0],
      ["comment", "# a note", 0],
      ["command", "npm test", 1],
      ["error", "boom", 1],
      ["error", "bare", 1],
    ],
  );
});

test("a continuation and a heredoc stay command input, and a mark inside them is not a new line", () => {
  const lines = parseSession("$ cat > f <<EOF\n# not a comment\n! not an error\nEOF\nwrote f");
  assert.deepEqual(lines.map((l) => l.kind), ["command", "command", "command", "command", "output"]);
  assert.equal(commandText(lines), "cat > f <<EOF\n# not a comment\n! not an error\nEOF");
});

test("each kind renders its own class, data-line, and the command number", () => {
  const out = render(SESSION);
  for (const kind of ["command", "output", "error", "comment"]) {
    assert.match(out, new RegExp(`class="cli-demo-line cli-demo-${kind}[^"]*" data-line="${kind}"`), kind);
  }
  assert.match(out, /data-command="1"/);
  assert.match(out, /<span class="cli-demo-prompt" aria-hidden="true">\$ <\/span>/);
});

test("labels are text: hidden 'output' per run, visible 'error' on every error line", () => {
  const out = render("<p>$ a\none\ntwo\n! e1\n! e2</p>");
  assert.equal(out.match(/<span class="cli-demo-label">output<\/span>/g)?.length, 1);
  assert.equal(out.match(/<span class="cli-demo-label cli-demo-label-visible">error<\/span>/g)?.length, 2);
});

test("an empty block renders a message and no buttons", () => {
  const out = render("");
  assert.match(out, /cli-demo-diagnostic/);
  assert.match(out, /This terminal session is empty\./);
  assert.doesNotMatch(out, /<button/);
});

test("text is escaped", () => {
  const out = render("<p>$ echo &lt;b&gt;\n&lt;script&gt;alert(1)&lt;/script&gt;</p>");
  assert.doesNotMatch(out, /<script>alert/);
  assert.match(out, /&lt;script>alert\(1\)&lt;\/script>/);
  assert.match(out, /echo &lt;b>/);
});

test("copy texts: commands without prompt or output, all as written", () => {
  const lines = parseSession("$ npm ci\nadded\n# note\n! bad");
  assert.equal(commandText(lines), "npm ci");
  assert.equal(allText(lines), "$ npm ci\nadded\n# note\n! bad");
  const out = render("<p>$ npm ci\nadded</p>");
  assert.match(out, /data-cli-demo-copy-commands[^>]*data-text="npm ci"/);
});

test("a session without commands has no commands button; the JSON script lists commands with output", () => {
  assert.doesNotMatch(render("<p>just output</p>"), /copy-commands/);
  const out = render(SESSION);
  const json = /<script type="application\/json" data-cli-demo-commands>([\s\S]*?)<\/script>/.exec(out);
  assert.ok(json);
  const records = JSON.parse(json[1]!) as { input: string; output: string[] }[];
  assert.deepEqual(records.map((r) => r.input), ["npm ci", "npm run build"]);
  assert.deepEqual(records[0]!.output, ["added 2 packages"]);
  assert.deepEqual((records[1] as unknown as { errors: string[] }).errors, ["Error: missing file"]);
});

test("the bar and every button start hidden; play adds the playback controls and nothing autoplays", () => {
  const plain = render(SESSION);
  assert.match(plain, /class="cli-demo-bar" hidden/);
  assert.doesNotMatch(plain, /data-play|cli-demo-play/);
  const playing = render(SESSION, { play: "" });
  assert.match(playing, /data-play/);
  for (const k of ["play", "pause", "show-all"]) assert.match(playing, new RegExp(`data-cli-demo-${k}`));
  assert.equal(wantsPlay("false"), false);
  assert.equal(wantsPlay(""), true);
  assert.equal(wantsPlay(undefined), false);
});
