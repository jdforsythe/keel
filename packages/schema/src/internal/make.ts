import type { Result } from "../Result.ts";
import type { Schema } from "../Schema.ts";
import type { SchemaError } from "../SchemaError.ts";
import { err } from "../err.ts";
import { ok } from "../ok.ts";
import type { Issue } from "./Issue.ts";
import type { Node } from "./Node.ts";
import { check } from "./check.ts";
import { docOf } from "./docOf.ts";
import { hasSecret } from "./hasSecret.ts";
import { invalid } from "./invalid.ts";
import { issueText } from "./issueText.ts";
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
    const value = sealing ? seal(node, input) : input;
    return is(value) ? ok(value) : err(invalid(issues));
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
