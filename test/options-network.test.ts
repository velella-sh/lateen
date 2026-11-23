import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_NETWORK_OPTIONS, resolveNetworkOptions } from "../src/options.ts";

test("a site that sets no network block gets the defaults", () => {
  assert.deepEqual(resolveNetworkOptions(undefined), DEFAULT_NETWORK_OPTIONS);
  assert.deepEqual(resolveNetworkOptions({}), DEFAULT_NETWORK_OPTIONS);
  assert.deepEqual(resolveNetworkOptions({ network: undefined }), DEFAULT_NETWORK_OPTIONS);
  assert.deepEqual(DEFAULT_NETWORK_OPTIONS, { switcher: true, footer: true, search: true, position: "header" });
});

test("each option can be turned off and the switcher moved to the footer", () => {
  assert.deepEqual(resolveNetworkOptions({ network: { switcher: false } }), {
    switcher: false,
    footer: true,
    search: true,
    position: "header",
  });
  assert.deepEqual(resolveNetworkOptions({ network: { footer: false } }), {
    switcher: true,
    footer: false,
    search: true,
    position: "header",
  });
  assert.deepEqual(resolveNetworkOptions({ network: { position: "footer" } }), {
    switcher: true,
    footer: true,
    search: true,
    position: "footer",
  });
  assert.equal(resolveNetworkOptions({ network: { position: "header" } }).position, "header");
  assert.deepEqual(resolveNetworkOptions({ network: { search: false } }), { ...DEFAULT_NETWORK_OPTIONS, search: false });
});

test("an unknown value is rejected with the key that names it", () => {
  assert.throws(
    () => resolveNetworkOptions({ network: { switcher: "off" } }),
    /theme\.options\.network\.switcher must be true or false/,
  );
  assert.throws(
    () => resolveNetworkOptions({ network: { footer: 0 } }),
    /theme\.options\.network\.footer must be true or false/,
  );
  assert.throws(
    () => resolveNetworkOptions({ network: { position: "sidebar" } }),
    /theme\.options\.network\.position must be "header" or "footer"/,
  );
  assert.throws(() => resolveNetworkOptions({ network: "all" }), /theme\.options\.network must be an object/);
});
