import * as fc from "fast-check";
import type { Node } from "./Node.ts";

/** fast-check arbitrary producing values that satisfy `node`. Optional keys are sometimes absent, never undefined. */
export function arbitrary(node: Node): fc.Arbitrary<unknown> {
  switch (node.kind) {
    case "string":
      return fc.string(node.max === undefined ? { minLength: node.min } : { minLength: node.min, maxLength: node.max });
    case "number":
      return fc.double({ noNaN: true, noDefaultInfinity: true });
    case "int":
      return fc.maxSafeInteger();
    case "boolean":
      return fc.boolean();
    case "literal":
      return fc.constant(node.value);
    case "enum":
      return fc.constantFrom(...node.values);
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
