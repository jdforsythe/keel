// Spec: k.scaffold-service, Conformance "In the default project that input with `reason: 'order list'` also changes `topology.ts`: `web` has `origins: { connect: { 'https://api.example.com': 'order list' } }` and its other properties as before, and `keel check` is clean; with `base: 'https://api.example.com/v2'` the key is still `https://api.example.com`."
// seed 1337 (property over hosts and base paths).
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { RUNS, SEED, apply, fresh, lowerName, read } from "./fixtures.ts";
import { cleanup, materialize } from "./keel-cli.ts";
import {
  ORIGIN,
  REASON,
  dependencies,
  expectCheckAndTestClean,
  squash,
  testFileCount,
  withModuleClient,
  withModuleNode,
} from "./service-base-support.ts";

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});

/** `squash`ed topology of `after` is the `before` one plus exactly one `origins: { connect: { origin: reason } }`. */
function expectOnlyConnectAdded(before: string, after: string, origin: string, reason: string): void {
  const entry = `origins:{connect:{"${origin}":"${reason}"}}`;
  const a = squash(after);
  expect(a.split(entry).length - 1, a).toBe(1);
  const rest = a.replace(entry, "").replace(/,,/g, ",").replace(/,\}/g, "}").replace(/\{,/g, "{");
  expect(rest).toBe(squash(before));
}

describe("service in the default project with a reason", () => {
  it("changes topology.ts so web declares connect { origin: reason } and keeps its other properties", () => {
    const before = fresh();
    const out = apply("service", { id: "orders", base: ORIGIN, reason: REASON }, before);
    expect(out.changed).toEqual(["package.json", "topology.ts"]);
    expect(out.created).toEqual(["modules/orders/OrdersApi.schema.ts", "modules/orders/api.server.ts"]);
    expectOnlyConnectAdded(read(before, "topology.ts"), read(out.files, "topology.ts"), ORIGIN, REASON);
    expect(dependencies(out.files)["@keel/services"]).toBe(dependencies(before)["@keel/server"]);
  });
  it("writes the same two files as in a node project", () => {
    fc.assert(
      fc.property(lowerName, (id) => {
        const client = apply("service", { id, base: ORIGIN, reason: REASON }, withModuleClient(id));
        const node = apply("service", { id, base: ORIGIN }, withModuleNode(id));
        expect(client.created).toEqual(node.created);
        for (const p of node.created) expect(read(client.files, p), p).toBe(read(node.files, p));
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("keeps keel check clean", () => {
    const tree = apply("service", { id: "orders", base: ORIGIN, reason: REASON }, fresh()).files;
    const dir = materialize(tree);
    dirs.push(dir);
    expectCheckAndTestClean(dir, testFileCount(tree));
  }, 120000);
  it("with base 'https://api.example.com/v2' the key is still 'https://api.example.com'", () => {
    const out = apply("service", { id: "orders", base: `${ORIGIN}/v2`, reason: REASON }, fresh());
    expectOnlyConnectAdded(read(fresh(), "topology.ts"), read(out.files, "topology.ts"), ORIGIN, REASON);
    expect(read(out.files, "modules/orders/api.server.ts")).toContain(`${ORIGIN}/v2`);
  });
  it("for any host and base path the key is the origin of the base and the value is the reason", () => {
    const seg = fc.array(lowerName, { minLength: 0, maxLength: 3 }).map((xs) => xs.map((x) => `/${x}`).join(""));
    fc.assert(
      fc.property(lowerName, seg, (host, path) => {
        const origin = `https://${host}.example.com`;
        const before = fresh();
        const out = apply("service", { id: "orders", base: `${origin}${path}`, reason: REASON }, before);
        expectOnlyConnectAdded(read(before, "topology.ts"), read(out.files, "topology.ts"), origin, REASON);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
