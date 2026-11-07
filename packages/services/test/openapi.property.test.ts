// Properties of the OpenAPI generator (k.services OpenAPI, rfc:0034). Seed 1337.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { openapi } from "../src/openapi/openapi.ts";

const SEED = 1337;
const VERBS = ["get", "post", "put", "patch", "delete", "head"];
const ident = fc.stringMatching(/^[a-z][A-Za-z0-9]{0,8}$/);
const verb = fc.constantFrom(...VERBS);
const op = (id: string) => ({
  operationId: id,
  responses: { "200": { content: { "application/json": { schema: {} } } } },
});

describe("openapi", () => {
  test("never throws for any JSON document; an err always carries at least one issue", () => {
    const docs = fc.oneof(
      fc.jsonValue(),
      fc.record({
        openapi: fc.oneof(fc.constant("3.0.3"), fc.jsonValue()),
        servers: fc.oneof(fc.constant([{ url: "https://a.test" }]), fc.jsonValue()),
        paths: fc.dictionary(fc.string(), fc.dictionary(fc.oneof(verb, fc.string()), fc.jsonValue())),
        components: fc.jsonValue(),
      }),
    );
    fc.assert(
      fc.property(docs, (doc) => {
        const r = openapi(doc, { name: "x" });
        if (!r.ok) expect(r.error.data.issues.length).toBeGreaterThan(0);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  test("one declaration per operation, keyed by operationId, in document order", () => {
    const ops = fc.uniqueArray(fc.tuple(ident, ident, verb, ident), {
      minLength: 1,
      maxLength: 8,
      selector: ([id]) => id,
    });
    fc.assert(
      fc.property(ops, (list) => {
        const paths: Record<string, Record<string, unknown>> = {};
        for (const [id, seg, method, extra] of list) {
          const item = paths[`/${seg}`] ?? { [`x-${extra}`]: { operationId: "notAnOperation" } };
          if (item[method] !== undefined) continue;
          item[method] = op(id);
          paths[`/${seg}`] = item;
        }
        const expected = Object.values(paths).flatMap((item) =>
          Object.entries(item)
            .filter(([m]) => VERBS.includes(m))
            .map(([, o]) => (typeof o === "object" && o !== null && "operationId" in o ? String(o.operationId) : "")),
        );
        const r = openapi({ openapi: "3.1.0", servers: [{ url: "https://a.test" }], paths }, { name: "x" });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const keys = [...r.value.schema.matchAll(/^ {2}(\w+): \{$/gm)].map((m) => m[1]);
        expect(keys).toEqual(expected);
      }),
      { seed: SEED, numRuns: 200 },
    );
  });
});
