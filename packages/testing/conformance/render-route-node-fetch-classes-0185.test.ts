// @vitest-environment happy-dom
// Spec: k.mount, clause "Under `keel test`, `new Response(null, { headers: { 'set-cookie': 'a=1' } }).headers.getSetCookie()` is `['a=1']` and `new Request(url, { headers: { cookie: 'a=1' } })` keeps its `cookie`."
// k.mount, Testing "Under `keel test` the DOM is happy-dom's but `Request`, `Response`, `Headers` and `fetch` are Node's, so `cookie` and `set-cookie` pass in process."
// Seed: 1337 (fc.assert below). Pending: RFC 0185 is not built (happy-dom's `Response` drops `set-cookie`, its `Request` drops `cookie`). To un-skip: change `test.skip` to `test` in this file once `keelConfig` runs the Keel happy-dom environment.
import fc from "fast-check";
import { expect, test } from "vitest";

const SEED = 1337;
const lines = fc.stringMatching(/^[a-z]{1,6}=[a-z0-9]{1,6}$/);

test("under `keel test`, `new Response(null, { headers: { 'set-cookie': 'a=1' } }).headers.getSetCookie()` is `['a=1']`", async () => {
  expect(new Response(null, { headers: { "set-cookie": "a=1" } }).headers.getSetCookie()).toEqual(["a=1"]);
  await fc.assert(
    fc.property(lines, lines, (a, b) => {
      const headers = new Headers();
      headers.append("set-cookie", a);
      headers.append("set-cookie", b);
      expect(new Response(null, { headers }).headers.getSetCookie()).toEqual([a, b]);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("under `keel test`, `new Request(url, { headers: { cookie: 'a=1' } })` keeps its `cookie`", async () => {
  expect(new Request("http://localhost/", { headers: { cookie: "a=1" } }).headers.get("cookie")).toBe("a=1");
  await fc.assert(
    fc.property(lines, (pair) => {
      expect(new Request("http://localhost/", { headers: { cookie: pair } }).headers.get("cookie")).toBe(pair);
    }),
    { seed: SEED, numRuns: 25 },
  );
});
