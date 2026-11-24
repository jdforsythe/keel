// Spec: k.openapi, Conformance "For the OpenAPI fixture, `openapi(doc, { name: 'gitHub' })` returns `ok`, and each of its `schema` and `service` texts equals the same text of `openapi(doc, { name: 'orders' })` with every `OrdersApi` replaced by `GitHubApi`."
// Spec: k.openapi, Conformance "`openapi(doc, { name })` throws a `RangeError` for each `name` of `Orders`, `my_api`, `order-items`, `1x` and `''`, and returns a `Result` for `orders`, `gitHub` and `v2`."
// seed 1337 (every fast-check run below passes { seed: 1337 }); no wall clock, no Math.random.
import { readFileSync } from "node:fs";
import { openapi } from "@keel/services/openapi";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const doc: unknown = JSON.parse(readFileSync(new URL("./fixtures/orders.openapi.json", import.meta.url), "utf8"));
const RULE = /^[a-z][A-Za-z0-9]*$/;
const lowerCamel = fc.stringMatching(/^[a-z][A-Za-z0-9]{0,10}$/);
const upper = (n: string): string => `${n.charAt(0).toUpperCase()}${n.slice(1)}`;

describe("openapi(doc, { name })", () => {
  it("for the OpenAPI fixture, name 'gitHub' returns ok and each text equals name 'orders' with every OrdersApi replaced by GitHubApi", () => {
    const orders = openapi(doc, { name: "orders" });
    const github = openapi(doc, { name: "gitHub" });
    expect(orders.ok).toBe(true);
    expect(github.ok).toBe(true);
    if (!orders.ok || !github.ok) return;
    expect(github.value.schema).toBe(orders.value.schema.replaceAll("OrdersApi", "GitHubApi"));
    expect(github.value.service).toBe(orders.value.service.replaceAll("OrdersApi", "GitHubApi"));
    expect(github.value.schema).toContain("GitHubApi");
    expect(github.value.service).toContain("./GitHubApi.schema.ts");
  });
  it("for any lowerCamel name the texts are those of 'orders' with OrdersApi replaced by <Name>Api", () => {
    const orders = openapi(doc, { name: "orders" });
    if (!orders.ok) throw new Error("orders failed");
    fc.assert(
      fc.property(lowerCamel, (name) => {
        const r = openapi(doc, { name });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.schema).toBe(orders.value.schema.replaceAll("OrdersApi", `${upper(name)}Api`));
        expect(r.value.service).toBe(orders.value.service.replaceAll("OrdersApi", `${upper(name)}Api`));
      }),
      { seed: 1337, numRuns: 25 },
    );
  });
  for (const name of ["Orders", "my_api", "order-items", "1x", ""]) {
    it(`throws a RangeError for the name ${JSON.stringify(name)}`, () => {
      expect(() => openapi(doc, { name })).toThrow(RangeError);
    });
  }
  for (const name of ["orders", "gitHub", "v2"]) {
    it(`returns a Result for the name ${JSON.stringify(name)}`, () => {
      const r = openapi(doc, { name });
      expect(typeof r.ok).toBe("boolean");
      expect(r.ok).toBe(true);
    });
  }
  it("for any string outside lowerCamel it throws a RangeError, and for any inside it returns a Result", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 12 }), (name) => {
        if (RULE.test(name)) {
          expect(typeof openapi(doc, { name }).ok).toBe("boolean");
        } else {
          expect(() => openapi(doc, { name })).toThrow(RangeError);
        }
      }),
      { seed: 1337, numRuns: 100 },
    );
  });
});
