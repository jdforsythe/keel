import type { Result } from "../Result.ts";
import type { Schema } from "../Schema.ts";
import type { SchemaError } from "../SchemaError.ts";
import { err } from "../err.ts";
import { ok } from "../ok.ts";
import type { Issue } from "./Issue.ts";
import type { Node } from "./Node.ts";
import { check } from "./check.ts";
import { docOf } from "./docOf.ts";
import { freeze } from "./freeze.ts";
import { hasSecret } from "./hasSecret.ts";
import { invalid } from "./invalid.ts";
import { issueText } from "./issueText.ts";
import { mark } from "./mark.ts";
import { seal } from "./seal.ts";
import { toJson } from "./toJson.ts";

/** Build the public Schema object for a node. The type guard below is the only place unknown becomes T. */
export function make<T, O extends boolean>(node: Node, isOptional: O): Schema<T, O> {
  let issues: Issue[] = [];
  const is = (x: unknown): x is T => {
    issues = [];
    check(node, x, [], issues);
    return issues.length === 0;
  };
  const sealing = hasSecret(node);
  const parse = (input: unknown): Result<T, SchemaError> => {
    if (!sealing) return is(input) ? ok(input) : err(invalid(issues));
    // Each sealed value is frozen deep only once the whole value passes, so a failed parse leaves the input as it
    // was; a value the seal, check or freeze cannot walk (a throwing getter, a revoked Proxy) is an err, never a throw.
    try {
      const made: unknown[] = [];
      const value = seal(node, input, made);
      if (!is(value)) return err(invalid(issues));
      for (const v of made) freeze(v);
      return ok(value);
    } catch {
      return err(invalid([{ path: [], rule: "type" }]));
    }
  };
  return {
    node,
    isOptional,
    parse,
    encode(value) {
      if (!is(value)) throw new Error(issueText(issues));
      return toJson(node, value);
    },
    doc: () => docOf(node),
    pii: (cls) => make<T, O>(mark(node, cls), isOptional),
    toJSON: () => node,
    optional: () => make<T, true>(node.kind === "optional" ? node : { kind: "optional", inner: node }, true),
    nullable() {
      const wrap = (n: Node): Node => (n.kind === "nullable" ? n : { kind: "nullable", inner: n });
      return make<T | null, O>(
        node.kind === "optional" ? { kind: "optional", inner: wrap(node.inner) } : wrap(node),
        isOptional,
      );
    },
  };
}
