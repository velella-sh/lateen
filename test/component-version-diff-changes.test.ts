import assert from "node:assert/strict";
import { test } from "node:test";
import type { ComponentProps } from "@velella/mizzen/contracts";
import { renderToString } from "preact-render-to-string";
import versionDiff, * as indexModule from "../components/version-diff/index.ts";
import {
  DEFAULT_ID,
  KINDS,
  STATES,
  changeOf,
  changesOf,
  diffOf,
  idBase,
  kindOf,
  parseJson,
  versionDiffFor,
  type VersionChange,
  type VersionDiffProps,
} from "../components/version-diff/changes.ts";

/** Render the viewer the way the render host calls it: directive props, language, and front matter. */
function render(props: VersionDiffProps, frontMatter: Record<string, unknown> = {}): string | null {
  const input = {
    props,
    html: "",
    page: { lang: "en", frontMatter },
    site: {},
  } as unknown as ComponentProps<VersionDiffProps>;
  const node = versionDiff(input);
  return node === null ? null : renderToString(node as never);
}

test("index.ts re-exports the pure module, so the public contract is unchanged", () => {
  assert.equal(indexModule.parseJson, parseJson);
  assert.equal(indexModule.kindOf, kindOf);
  assert.equal(indexModule.changeOf, changeOf);
  assert.equal(indexModule.changesOf, changesOf);
  assert.equal(indexModule.diffOf, diffOf);
  assert.equal(indexModule.versionDiffFor, versionDiffFor);
  assert.equal(indexModule.idBase, idBase);
  assert.equal(indexModule.KINDS, KINDS);
  assert.equal(indexModule.STATES, STATES);
  assert.equal(indexModule.DEFAULT_ID, DEFAULT_ID);
});

test("parseJson reads JSON and treats missing, blank, or broken text as absent", () => {
  assert.deepEqual(parseJson('{"from":"v1"}'), { from: "v1" });
  assert.deepEqual(parseJson("[1,2]"), [1, 2]);
  assert.equal(parseJson(undefined), undefined);
  assert.equal(parseJson(42), undefined);
  assert.equal(parseJson(""), undefined);
  assert.equal(parseJson("   "), undefined);
  assert.equal(parseJson("{oops"), undefined);
});

test("kindOf guards the four kinds without case or surrounding spaces", () => {
  for (const kind of KINDS) assert.equal(kindOf(`  ${kind.toUpperCase()} `), kind);
  assert.equal(kindOf("renamed"), undefined);
  assert.equal(kindOf(""), undefined);
  assert.equal(kindOf(3), undefined);
  assert.equal(kindOf(null), undefined);
});

test("changeOf normalizes aliases and numbers, and drops entries without kind or title", () => {
  assert.deepEqual(changeOf({ kind: "changed", heading: " Install ", oldText: "old", newText: "new" }), {
    kind: "changed",
    title: "Install",
    before: "old",
    after: "new",
  });
  assert.deepEqual(changeOf({ kind: "moved", title: 7, from: 3, to: 5 }), {
    kind: "moved",
    title: "7",
    from: "3",
    to: "5",
  });
  // Blank optional fields are omitted, never rendered as empty text.
  assert.deepEqual(changeOf({ kind: "added", title: "Retries", after: "  ", before: "" }), {
    kind: "added",
    title: "Retries",
  });
  assert.equal(changeOf({ kind: "renamed", title: "Install" }), undefined);
  assert.equal(changeOf({ kind: "added", title: "   " }), undefined);
  assert.equal(changeOf({ kind: "added" }), undefined);
  assert.equal(changeOf(null), undefined);
  assert.equal(changeOf([1]), undefined);
});

test("changesOf keeps the written order, including repeated entries, and rejects non-arrays", () => {
  const repeated = { kind: "added", title: "Retries" };
  assert.deepEqual(changesOf([repeated, { kind: "bogus" }, repeated, null]), [
    { kind: "added", title: "Retries" },
    { kind: "added", title: "Retries" },
  ]);
  assert.deepEqual(changesOf({ 0: repeated }), []);
  assert.deepEqual(changesOf(undefined), []);
});

test("diffOf pairs versions: missing or equal ones are unavailable, usable sides are kept", () => {
  assert.deepEqual(diffOf(null), { state: "unavailable", changes: [], dropped: 0 });
  assert.deepEqual(diffOf({ from: "v1", changes: [] }), {
    state: "unavailable",
    from: "v1",
    changes: [],
    dropped: 0,
  });
  assert.deepEqual(diffOf({ from: "v2", to: "v2", changes: [] }), {
    state: "unavailable",
    from: "v2",
    to: "v2",
    changes: [],
    dropped: 0,
  });
});

test("diffOf separates empty, malformed, and partial evidence into distinct states", () => {
  const empty = diffOf({ from: "v1", to: "v2", changes: [] });
  assert.equal(empty.state, "unchanged");
  assert.equal(empty.dropped, 0);

  const malformed = diffOf({ from: "v1", to: "v2", changes: [{ kind: "bogus" }, null] });
  assert.equal(malformed.state, "unavailable");
  assert.deepEqual(malformed.changes, []);

  const partial = diffOf({
    from: "v1",
    to: "v2",
    changes: [{ kind: "added", title: "Retries" }, { kind: "bogus" }],
  });
  assert.equal(partial.state, "incomplete");
  assert.equal(partial.changes.length, 1);
  assert.equal(partial.dropped, 1);

  const absent = diffOf({ from: "v1", to: "v2" });
  assert.equal(absent.state, "unavailable");
});

test("diffOf reads the grouped engine shape in KINDS order, and a listed change wins", () => {
  const grouped = diffOf({
    from: "v1",
    to: "v2",
    moved: [{ title: "Upgrade", from: "3", to: "5" }],
    added: [{ title: "Retries", text: "new" }],
    removed: [{ title: "Legacy", text: "old" }],
    changed: [{ title: "Install", oldText: "a", newText: "b" }],
  });
  assert.equal(grouped.state, "changes");
  assert.deepEqual(
    grouped.changes.map((change) => change.kind),
    [...KINDS],
  );
  assert.deepEqual(grouped.changes[0], { kind: "added", title: "Retries", after: "new" });
  assert.deepEqual(grouped.changes[1], { kind: "removed", title: "Legacy", before: "old" });

  const listed = diffOf({
    from: "v1",
    to: "v2",
    changes: [{ kind: "changed", title: "Install" }],
    added: [{ title: "Retries", text: "new" }],
  });
  assert.deepEqual(listed.changes, [{ kind: "changed", title: "Install" }]);
  assert.equal(listed.dropped, 0);
});

test("repeated changes normalize deterministically, in order, without touching the input", () => {
  const entry: VersionChange = { kind: "added", title: "Retries", after: "Try again." };
  const input = { from: "v1", to: "v2", changes: [entry, entry, entry] };
  const before = JSON.stringify(input);
  const first = diffOf(input);
  const second = diffOf(input);
  assert.deepEqual(first, second);
  assert.equal(first.state, "changes");
  assert.deepEqual(first.changes, [entry, entry, entry]);
  assert.equal(JSON.stringify(input), before);
});

test("versionDiffFor prefers data, then attributes, then front matter; nothing written gives undefined", () => {
  const frontMatter = { versionDiff: { from: "v0", to: "v1", changes: [] } };
  assert.equal(versionDiffFor({}, {}), undefined);
  assert.equal(versionDiffFor({}, frontMatter)?.from, "v0");
  assert.equal(versionDiffFor({ from: "v1", to: "v2", changes: "[]" }, frontMatter)?.from, "v1");
  assert.equal(
    versionDiffFor({ data: '{"from":"v2","to":"v3","changes":[]}', from: "v1", to: "v2" }, frontMatter)?.from,
    "v2",
  );
  // Malformed explicit data stays an explicit comparison instead of falling through.
  assert.equal(versionDiffFor({ data: "{oops" }, frontMatter)?.state, "unavailable");
});

test("idBase reduces a prop to safe id characters and falls back when nothing usable remains", () => {
  assert.equal(idBase("Diff 2"), "Diff-2");
  assert.equal(idBase('"><script>'), "script");
  assert.equal(idBase("  "), DEFAULT_ID);
  assert.equal(idBase(undefined), DEFAULT_ID);
});

test("repeated changes render the same markup with stable per-index ids", () => {
  const props: VersionDiffProps = {
    id: "repeat",
    data: JSON.stringify({
      from: "v1",
      to: "v2",
      changes: [
        { kind: "added", title: "Retries" },
        { kind: "added", title: "Retries" },
      ],
    }),
  };
  const out = render(props);
  assert.ok(out);
  assert.equal(out, render(props));
  assert.match(out, /id="repeat-change-1"/);
  assert.match(out, /id="repeat-change-2"/);
  assert.match(out, /id="repeat-change-1-title"/);
  assert.match(out, /id="repeat-change-2-title"/);
  assert.match(out, /data-diff-state="changes"/);
  assert.match(out, /data-changes-usable="2"/);
  assert.match(out, /data-changes-dropped="0"/);
});

test("empty, malformed, and partial evidence keep their public markup states", () => {
  const empty = render({ data: '{"from":"v1","to":"v2","changes":[]}' });
  assert.ok(empty);
  assert.match(empty, /data-diff-state="unchanged"/);

  const malformed = render({ data: "{oops" });
  assert.ok(malformed);
  assert.match(malformed, /data-diff-state="unavailable"/);

  const partial = render({
    data: '{"from":"v1","to":"v2","changes":[{"kind":"added","title":"Retries"},{"kind":"bogus"}]}',
  });
  assert.ok(partial);
  assert.match(partial, /data-diff-state="incomplete"/);
  assert.match(partial, /data-changes-usable="1"/);
  assert.match(partial, /data-changes-dropped="1"/);

  assert.equal(render({}), null);
});