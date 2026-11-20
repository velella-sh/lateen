import assert from "node:assert/strict";
import { test } from "node:test";
import {
  INPUT_SELECTOR,
  createGroupState,
  defaultsOf,
  isBlocked,
  isValid,
  mergeStates,
  recordValue,
  stalenessOf,
  type VariableForm,
  type VariableInput,
} from "../components/variables-form/client.ts";
import { TYPE_ATTRIBUTE } from "../components/variables-form/group.ts";

/** A text input as the state helpers see it: a value, its declared type, and its server default. */
class Field implements VariableInput {
  value: string;
  private readonly attrs: Record<string, string>;

  constructor(name: string, value: string, type = "string", fallback = value) {
    this.value = value;
    this.attrs = { "data-var": name, "data-default": fallback, [TYPE_ATTRIBUTE]: type };
  }

  getAttribute(name: string): string | null {
    return this.attrs[name] ?? null;
  }

  addEventListener(): void {}
}

/** A form holding these inputs, with nothing else the state helpers read. */
function formOf(inputs: VariableInput[]): VariableForm {
  return {
    querySelectorAll: (selector: string) => (selector === INPUT_SELECTOR ? inputs : []),
  };
}

test("state: zero is a value, not an absent one", () => {
  const zero = new Field("retries", "0", "number");
  assert.equal(isValid(zero), true);

  const state = createGroupState();
  state.baselines.set("retries", "0");
  recordValue(state, "retries", zero.value, isValid(zero));
  assert.equal(isBlocked(state), false);
  assert.equal(stalenessOf(state, ["retries"]), "fresh");

  zero.value = "1";
  recordValue(state, "retries", zero.value, isValid(zero));
  assert.equal(stalenessOf(state, ["retries"]), "stale");
});

test("state: a blank value is valid only where its declared type allows it", () => {
  const note = new Field("note", "");
  assert.equal(isValid(note), true);

  const state = createGroupState();
  recordValue(state, "note", note.value, isValid(note));
  assert.equal(isBlocked(state), false);

  for (const type of ["url", "number", "boolean"]) {
    const blank = new Field("value", "", type);
    assert.equal(isValid(blank), false, `${type}: blank is rejected`);
    recordValue(state, "value", blank.value, isValid(blank));
    assert.equal(isBlocked(state), true, `${type}: the group is blocked`);
  }
});

test("state: an invalid value keeps its output stale even at the recorded value", () => {
  const input = new Field("host", "/v1", "url");
  const state = createGroupState();
  state.baselines.set("host", "/v1");
  recordValue(state, "host", input.value, isValid(input));
  assert.equal(stalenessOf(state, ["host"]), "fresh");

  input.value = "//host/path";
  recordValue(state, "host", input.value, isValid(input));
  assert.equal(isBlocked(state), true);
  assert.equal(stalenessOf(state, ["host"]), "stale");

  input.value = "/v1";
  recordValue(state, "host", input.value, isValid(input));
  assert.equal(isBlocked(state), false);
  assert.equal(stalenessOf(state, ["host"]), "fresh");
});

test("reset: the defaults come from the form, and restoring them makes the group fresh", () => {
  const host = new Field("host", "/changed", "url", "/recorded");
  const steps = defaultsOf(formOf([host, new Field("", "ignored")]));
  assert.deepEqual(
    steps.map((step) => [step.name, step.value]),
    [["host", "/recorded"]],
  );

  const state = createGroupState();
  state.baselines.set("host", steps[0]!.value);
  recordValue(state, "host", host.value, isValid(host));
  assert.equal(stalenessOf(state, ["host"]), "stale");

  host.value = steps[0]!.value;
  recordValue(state, "host", host.value, isValid(host));
  assert.equal(stalenessOf(state, ["host"]), "fresh");
  assert.equal(isBlocked(state), false);
});

test("groups: one group's rejection leaves the other fresh and unblocked", () => {
  const a = createGroupState();
  const b = createGroupState();
  a.baselines.set("host", "https://a.example.com");
  b.baselines.set("host", "https://b.example.com");
  const rejected = new Field("host", "not a url", "url");
  recordValue(a, "host", rejected.value, isValid(rejected));
  recordValue(b, "host", "https://b.example.com", true);

  assert.equal(isBlocked(a), true);
  assert.equal(stalenessOf(a, ["host"]), "stale");
  assert.equal(isBlocked(b), false);
  assert.equal(stalenessOf(b, ["host"]), "fresh");
  assert.equal(isBlocked(mergeStates([a, b])), true, "the page-wide check sees both groups");
});

test("state: a dependency no form recorded keeps its output's state", () => {
  const state = createGroupState();
  state.baselines.set("host", "/v1");
  recordValue(state, "host", "/v1", true);
  assert.equal(stalenessOf(state, ["token"]), "unknown");
  assert.equal(stalenessOf(state, ["host", "token"]), "unknown");
});
