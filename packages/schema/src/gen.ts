import * as fc from "fast-check";
import type { Schema } from "./Schema.ts";
import type { Node } from "./internal/Node.ts";

const limits = (node: { readonly min?: number; readonly max?: number }): { min?: number; max?: number } => ({
  ...(node.min === undefined ? {} : { min: node.min }),
  ...(node.max === undefined ? {} : { max: node.max }),
});

/** Arbitrary producing values that satisfy `node`. Optional keys are sometimes absent, never undefined. */
function arbitrary(node: Node): fc.Arbitrary<unknown> {
  switch (node.kind) {
    case "string":
      return fc.string(node.max === undefined ? { minLength: node.min } : { minLength: node.min, maxLength: node.max });
    case "number":
      return fc.double({ noNaN: true, noDefaultInfinity: true, ...limits(node) });
    case "int":
      return fc.integer({
        min: Math.max(Math.ceil(node.min ?? Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER),
        max: Math.min(Math.floor(node.max ?? Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER),
      });
    case "boolean":
      return fc.boolean();
    case "literal":
      return fc.constant(node.value);
    case "enum":
      return fc.constantFrom(...node.values);
    case "json":
      return fc.jsonValue();
    case "id":
      return fc.string({ minLength: 1 });
    case "nullable":
      return fc.option(arbitrary(node.inner), { nil: null });
    case "optional":
      return arbitrary(node.inner);
    case "array":
      return fc.array(arbitrary(node.item));
    case "record":
      return fc.dictionary(fc.string(), arbitrary(node.value), { noNullPrototype: true });
    case "union":
      return fc.oneof(...node.variants.map(arbitrary));
    case "object": {
      const fields = Object.entries(node.fields);
      const model = Object.fromEntries(fields.map(([k, f]) => [k, arbitrary(f.kind === "optional" ? f.inner : f)]));
      const requiredKeys = fields.filter(([, f]) => f.kind !== "optional").map(([k]) => k);
      return fc.record(model, { requiredKeys, noNullPrototype: true });
    }
  }
}

type Out<S> = S extends Schema<infer T, boolean> ? T : never;

/** fast-check arbitrary yielding only values the schema accepts. Lives on `@keel/schema/gen` so apps do not bundle fast-check. */
export function gen<S extends Schema<unknown, boolean>>(schema: S): fc.Arbitrary<Out<S>> {
  return arbitrary(schema.node).filter((x): x is Out<S> => schema.parse(x).ok);
}
