// Spec: k.scaffold-service, Conformance "In the default project, each is E1353 naming E1590, nothing written: `base: 'http://api.example.com'` with a `reason`; a `reason` of 201 characters; an origin that would be the 17th under `connect`. In the `node` project `base: 'http://internal:8080'` applies."
// Spec: k.scaffold-service, Edits "An origin or reason k.origins refuses, or a 17th `connect` origin, is E1353 naming E1590."
// seed 1337 (property over reason lengths).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, apply, errText, fresh, read, scaffoldRaw, snap } from "./fixtures.ts";
import { ORIGIN, REASON, freshNode, withConnect } from "./service-base-support.ts";

function refused(files: ReturnType<typeof fresh>, input: Record<string, unknown>): void {
  const before = snap(files);
  const r = scaffoldRaw("service", input, files);
  expect(r.ok, JSON.stringify(input).slice(0, 120)).toBe(false);
  const t = errText(r);
  expect(t).toContain("E1353");
  expect(t).toContain("E1590");
  expect(snap(files)).toBe(before);
}
const origins = (n: number): Record<string, string> =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`https://o${i}.example.com`, "declared earlier"]));

describe("service E1353 naming E1590 in the default project", () => {
  it("base http://api.example.com with a reason", () => {
    refused(fresh(), { id: "orders", base: "http://api.example.com", reason: REASON });
  });
  it("a reason of 201 characters", () => {
    refused(fresh(), { id: "orders", base: ORIGIN, reason: "a".repeat(201) });
  });
  it("any reason over 200 characters is refused and any of 1 to 200 characters applies", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 400 }), (n) => {
        const input = { id: "orders", base: ORIGIN, reason: "a".repeat(n) };
        if (n > 200) refused(fresh(), input);
        else expect(apply("service", input, fresh()).created).toContain("modules/orders/api.server.ts");
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("a reason with a line break", () => {
    refused(fresh(), { id: "orders", base: ORIGIN, reason: "two\nlines" });
  });
  it("an origin that would be the 17th under connect", () => {
    refused(withConnect(fresh(), origins(16)), { id: "orders", base: ORIGIN, reason: REASON });
  });
  it("the 16th origin under connect applies", () => {
    const out = apply("service", { id: "orders", base: ORIGIN, reason: REASON }, withConnect(fresh(), origins(15)));
    expect(read(out.files, "topology.ts")).toContain(ORIGIN);
  });
});

describe("service in the node project", () => {
  it("base http://internal:8080 applies, declaring nothing", () => {
    const before = freshNode();
    const out = apply("service", { id: "orders", base: "http://internal:8080" }, before);
    expect(out.created).toEqual(["modules/orders/OrdersApi.schema.ts", "modules/orders/api.server.ts"]);
    expect(out.changed).toEqual(["package.json"]);
    expect(read(out.files, "modules/orders/api.server.ts")).toContain("http://internal:8080");
  });
});
