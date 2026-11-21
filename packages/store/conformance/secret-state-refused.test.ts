// Spec: k.store, clause "`store()` throws E1303 on a state schema with a nested `s.secret`, not on its clean twin."
// Seed 1337
import { scope } from "@keel/reactive";
import { type Schema, s } from "@keel/schema";
import { store } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const opts = { seed: 1337, numRuns: 60 };

type Wrap = "object" | "optionalField" | "array" | "nullable" | "record";
const wrapsArb = fc.array(fc.constantFrom<Wrap>("object", "optionalField", "array", "nullable", "record"), {
  maxLength: 5,
});

/** `leaf` under `wraps` (innermost first), with a value the clean twin accepts. */
function nest(
  leaf: Schema<unknown>,
  value: unknown,
  wraps: readonly Wrap[],
): { schema: Schema<unknown>; value: unknown } {
  let schema = leaf;
  let v = value;
  for (const w of wraps) {
    if (w === "object") [schema, v] = [s.object({ k: schema }), { k: v }];
    else if (w === "optionalField") [schema, v] = [s.object({ k: schema.optional() }), {}];
    else if (w === "array") [schema, v] = [s.array(schema), []];
    else if (w === "nullable") [schema, v] = [schema.nullable(), null];
    else [schema, v] = [s.record(schema), {}];
  }
  return { schema, value: v };
}

const build = (secret: boolean, wraps: readonly Wrap[]) => {
  const inner = nest(secret ? s.secret(s.string()) : s.string(), "x", wraps);
  return () => store(s.object({ field: inner.schema }), { field: inner.value });
};

describe("k.store: a state schema holding a secret", () => {
  it("`store()` throws E1303 on a state schema with a nested `s.secret`, not on its clean twin", () => {
    fc.assert(
      fc.property(wrapsArb, (wraps) => {
        const sc = scope(() => {
          expect(build(true, wraps)).toThrow(/^E1303\b/);
          expect(build(false, wraps)).not.toThrow();
        });
        sc.dispose();
      }),
      opts,
    );
  });
});
